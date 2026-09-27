#!/usr/bin/env python3
"""
ERA5 NetCDF Reader

Extracts ERA5 reanalysis data at station locations.

Usage:
    python ingest_era5.py --input data/raw/era5/era5_india_2024_01.nc \
                          --stations data/metadata/stations.csv \
                          --output data/processed/era5_at_stations.parquet

Note: ERA5 is used for VALIDATION ONLY, not for training.

Features:
    - Reads ERA5 NetCDF files (requires xarray, netCDF4)
    - Extracts nearest grid point for each station
    - Bilinear interpolation (optional)
    - Converts to common schema
    - Marks as validation source (not for training)

Data source: https://cds.climate.copernicus.eu/
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# ERA5 requires xarray and netCDF4
try:
    import xarray as xr
    import numpy as np
    HAS_XARRAY = True
except ImportError:
    HAS_XARRAY = False
    print("Error: xarray not installed. Install with: pip install xarray netCDF4")

# Optional: pandas for Parquet
try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False


class ERA5Reader:
    """Extract ERA5 reanalysis data at station locations"""
    
    def __init__(self, stations_csv: Path):
        self.stations = self.load_stations(stations_csv)
        self.records_extracted = 0
    
    def load_stations(self, stations_csv: Path) -> List[Dict]:
        """Load station metadata (station_id, lat, lon)"""
        import csv
        
        stations = []
        
        print(f"Loading stations from {stations_csv}...")
        
        with open(stations_csv, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('lat') and row.get('lon'):
                    stations.append({
                        'station_id': row['station_id'],
                        'lat': float(row['lat']),
                        'lon': float(row['lon']),
                        'elevation_m': float(row['elevation_m']) if row.get('elevation_m') else None
                    })
        
        print(f"  Loaded {len(stations)} stations")
        return stations
    
    def extract_at_stations(self, era5_path: Path, method: str = 'nearest') -> List[Dict]:
        """
        Extract ERA5 data at station locations
        
        Args:
            era5_path: Path to ERA5 NetCDF file
            method: 'nearest' or 'bilinear' interpolation
        
        Returns:
            List of records in common schema
        """
        if not HAS_XARRAY:
            print("Error: xarray required. Install with: pip install xarray netCDF4")
            sys.exit(1)
        
        print(f"Reading ERA5 file: {era5_path}")
        
        # Open ERA5 dataset
        ds = xr.open_dataset(era5_path)
        
        print(f"  Variables: {list(ds.data_vars)}")
        print(f"  Dimensions: {dict(ds.dims)}")
        
        # Identify variable names (ERA5 uses different conventions)
        temp_var = self._find_variable(ds, ['t2m', '2t', 'temperature_2m', 't'])
        pressure_var = self._find_variable(ds, ['sp', 'surface_pressure', 'msl', 'pressure'])
        dewpoint_var = self._find_variable(ds, ['d2m', '2d', 'dewpoint_2m', 'd'])
        
        if not temp_var:
            print("Error: Temperature variable not found in ERA5 file")
            return []
        
        records = []
        
        # Extract for each station
        for station in self.stations:
            station_id = station['station_id']
            lat = station['lat']
            lon = station['lon']
            
            print(f"  Extracting {station_id} at ({lat:.2f}, {lon:.2f})...")
            
            # Select nearest grid point or interpolate
            if method == 'nearest':
                station_data = ds.sel(latitude=lat, longitude=lon, method='nearest')
            else:  # bilinear
                station_data = ds.interp(latitude=lat, longitude=lon, method='linear')
            
            # Extract time series
            times = station_data['time'].values
            
            for time_idx, time_val in enumerate(times):
                timestamp = pd.Timestamp(time_val).to_pydatetime()
                
                # Extract temperature
                temp_kelvin = station_data[temp_var].isel(time=time_idx).values
                temperature = float(temp_kelvin) - 273.15  # Convert K to °C
                
                # Extract pressure (if available)
                pressure = None
                if pressure_var:
                    pressure_pa = station_data[pressure_var].isel(time=time_idx).values
                    pressure = float(pressure_pa) / 100.0  # Convert Pa to hPa
                
                # Extract dewpoint and calculate humidity (if available)
                humidity = None
                if dewpoint_var:
                    dewpoint_kelvin = station_data[dewpoint_var].isel(time=time_idx).values
                    dewpoint = float(dewpoint_kelvin) - 273.15
                    humidity = self._calculate_relative_humidity(temperature, dewpoint)
                
                # Build record
                record = {
                    'station_id': f'{station_id}-ERA5',  # Mark as ERA5 reference
                    'source': 'ERA5',
                    'timestamp_utc': timestamp,
                    'lat': lat,
                    'lon': lon,
                    'elevation_m': station.get('elevation_m'),
                    'temperature_c': temperature,
                    'humidity_pct': humidity,
                    'pressure_hpa': pressure,
                    'wind_speed_ms': None,  # Not extracted (available as u10/v10)
                    'wind_direction_deg': None,
                    'rainfall_mm': None,
                    'visibility_m': None,
                    'quality_temp': 'GOOD',  # ERA5 is reanalysis (assumed good)
                    'quality_humidity': 'GOOD' if humidity else 'MISSING',
                    'quality_pressure': 'GOOD' if pressure else 'MISSING',
                    'is_synthetic': True,  # ERA5 is model-generated
                    'anomaly_label': None
                }
                
                records.append(record)
                self.records_extracted += 1
        
        print(f"  Extracted {self.records_extracted} records from ERA5")
        
        return records
    
    def _find_variable(self, ds: xr.Dataset, possible_names: List[str]) -> Optional[str]:
        """Find variable in dataset by trying multiple names"""
        for name in possible_names:
            if name in ds.data_vars:
                return name
        return None
    
    @staticmethod
    def _calculate_relative_humidity(temp_c: float, dewpoint_c: float) -> float:
        """Calculate RH from temperature and dewpoint (Magnus-Tetens)"""
        import math
        
        a = 17.27
        b = 237.7
        
        es_temp = 6.112 * math.exp((a * temp_c) / (b + temp_c))
        es_dewpoint = 6.112 * math.exp((a * dewpoint_c) / (b + dewpoint_c))
        
        rh = 100.0 * (es_dewpoint / es_temp)
        
        return max(0.0, min(100.0, rh))


def save_to_parquet(records: List[Dict], output_path: Path):
    """Save records to Parquet file"""
    if not HAS_PANDAS:
        print("Error: pandas required for Parquet output")
        sys.exit(1)
    
    df = pd.DataFrame(records)
    
    # Convert timestamp to datetime64
    df['timestamp_utc'] = pd.to_datetime(df['timestamp_utc'])
    
    # Sort by timestamp
    df = df.sort_values(['station_id', 'timestamp_utc'])
    
    # Save
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(output_path, index=False, compression='snappy')
    
    print(f"Saved to {output_path}")


def main():
    parser = argparse.ArgumentParser(description='Extract ERA5 data at station locations')
    parser.add_argument('--input', required=True, help='Input ERA5 NetCDF file')
    parser.add_argument('--stations', required=True, help='Station metadata CSV')
    parser.add_argument('--output', required=True, help='Output Parquet file')
    parser.add_argument('--method', default='nearest', choices=['nearest', 'bilinear'],
                        help='Interpolation method (default: nearest)')
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    stations_path = Path(args.stations)
    output_path = Path(args.output)
    
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)
    
    if not stations_path.exists():
        print(f"Error: Stations file not found: {stations_path}")
        sys.exit(1)
    
    # Extract
    reader = ERA5Reader(stations_path)
    records = reader.extract_at_stations(input_path, method=args.method)
    
    if not records:
        print("Error: No records extracted")
        sys.exit(1)
    
    # Save
    save_to_parquet(records, output_path)
    
    print("\nSummary:")
    print(f"  ERA5 file: {input_path}")
    print(f"  Stations: {len(reader.stations)}")
    print(f"  Records extracted: {reader.records_extracted}")
    print(f"  Output: {output_path}")
    print("\n⚠️  Note: ERA5 data is marked as 'synthetic' and should be used for validation only, not training.")


if __name__ == '__main__':
    main()
