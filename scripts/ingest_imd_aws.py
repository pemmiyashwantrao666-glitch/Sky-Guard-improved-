#!/usr/bin/env python3
"""
IMD AWS (India Meteorological Department) CSV Parser

Converts IMD AWS CSV format to common schema Parquet.

Usage:
    python ingest_imd_aws.py --input data/raw/imd_aws/maharashtra_2024_01.csv \
                             --output data/processed/station_hourly.parquet

Features:
    - Parses IMD CSV format
    - Handles missing values (-999, NA, empty)
    - Converts IST to UTC (UTC = IST - 5:30)
    - Station coordinate lookup (requires metadata CSV)
    - Quality flag assignment
    - Appends to existing Parquet

Data source: https://mausam.imd.gov.in/ or https://dsp.imdpune.gov.in/
"""

import argparse
import csv
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

# Optional: pandas for Parquet
try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False
    print("Warning: pandas not installed. Output will be CSV.")


class IMDAWSParser:
    """Parser for IMD AWS CSV format"""
    
    # Missing value indicators
    MISSING_VALUES = ['-999', '-999.0', 'NA', 'N/A', '', 'NULL']
    
    # IST to UTC offset
    IST_OFFSET = timedelta(hours=5, minutes=30)
    
    def __init__(self, station_metadata_path: Optional[Path] = None):
        self.station_coords = {}
        
        # Load station metadata if provided
        if station_metadata_path and station_metadata_path.exists():
            self.load_station_metadata(station_metadata_path)
        
        self.records_parsed = 0
        self.records_valid = 0
    
    def load_station_metadata(self, metadata_path: Path):
        """
        Load station coordinates from metadata CSV
        
        Format: station_id,lat,lon,elevation_m
        """
        print(f"Loading station metadata from {metadata_path}...")
        
        with open(metadata_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                station_id = row['station_id']
                self.station_coords[station_id] = {
                    'lat': float(row['lat']) if row.get('lat') else None,
                    'lon': float(row['lon']) if row.get('lon') else None,
                    'elevation_m': float(row['elevation_m']) if row.get('elevation_m') else None
                }
        
        print(f"  Loaded {len(self.station_coords)} station coordinates")
    
    def parse_value(self, value_str: str, value_type: str = 'float') -> Optional[float]:
        """
        Parse value with missing value handling
        
        Args:
            value_str: String value from CSV
            value_type: 'float' or 'int'
        
        Returns:
            Parsed value or None if missing
        """
        if not value_str or value_str.strip() in self.MISSING_VALUES:
            return None
        
        try:
            if value_type == 'int':
                return int(float(value_str))
            else:
                return float(value_str)
        except ValueError:
            return None
    
    def ist_to_utc(self, ist_datetime: datetime) -> datetime:
        """Convert IST timestamp to UTC"""
        return ist_datetime - self.IST_OFFSET
    
    def parse_datetime(self, datetime_str: str) -> Optional[datetime]:
        """
        Parse IMD datetime string (multiple formats supported)
        
        Formats:
            - "2024-09-26 19:00:00"
            - "26/09/2024 19:00"
            - "2024-09-26T19:00:00"
        """
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%d/%m/%Y %H:%M',
            '%Y-%m-%dT%H:%M:%S',
            '%d-%m-%Y %H:%M:%S',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(datetime_str.strip(), fmt)
            except ValueError:
                continue
        
        return None
    
    def assign_quality_flag(self, value: Optional[float], param_type: str) -> str:
        """
        Assign quality flag based on physical ranges
        
        Args:
            value: Parameter value
            param_type: 'temperature' | 'humidity' | 'pressure'
        
        Returns:
            'GOOD' | 'SUSPECT' | 'BAD' | 'MISSING'
        """
        if value is None:
            return 'MISSING'
        
        # Physical limits (extended for extreme cases)
        ranges = {
            'temperature': (-50, 60),  # °C
            'humidity': (0, 100),      # %
            'pressure': (870, 1084)    # hPa
        }
        
        # Suspect ranges (unusual but possible)
        suspect_ranges = {
            'temperature': (-40, -35, 50, 55),
            'humidity': (0, 5, 95, 100),
            'pressure': (950, 970, 1030, 1050)
        }
        
        min_val, max_val = ranges.get(param_type, (-1e9, 1e9))
        
        if not (min_val <= value <= max_val):
            return 'BAD'
        
        if param_type in suspect_ranges:
            low1, low2, high1, high2 = suspect_ranges[param_type]
            if (low1 <= value < low2) or (high1 < value <= high2):
                return 'SUSPECT'
        
        return 'GOOD'
    
    def parse_row(self, row: Dict) -> Optional[Dict]:
        """
        Parse single CSV row
        
        Expected columns (flexible):
            - Station_ID or StationID or station_id
            - Datetime or DateTime or timestamp
            - Temperature_C or Temperature or temp
            - Humidity_Pct or Humidity or RH
            - Pressure_hPa or Pressure or pressure
            - Optional: Wind_Speed, Wind_Direction, Rainfall
        """
        try:
            # Extract station ID (flexible column names)
            station_id = (
                row.get('Station_ID') or 
                row.get('StationID') or 
                row.get('station_id') or 
                row.get('Station ID')
            )
            
            if not station_id:
                return None
            
            # Standardize station ID format
            if not station_id.startswith('IMD-'):
                station_id = f'IMD-{station_id}'
            
            # Extract datetime
            datetime_str = (
                row.get('Datetime') or 
                row.get('DateTime') or 
                row.get('timestamp') or
                row.get('Timestamp')
            )
            
            if not datetime_str:
                return None
            
            ist_datetime = self.parse_datetime(datetime_str)
            if not ist_datetime:
                return None
            
            # Convert IST to UTC
            utc_datetime = self.ist_to_utc(ist_datetime)
            
            # Extract measurements
            temperature = self.parse_value(
                row.get('Temperature_C') or row.get('Temperature') or row.get('temp') or ''
            )
            
            humidity = self.parse_value(
                row.get('Humidity_Pct') or row.get('Humidity') or row.get('RH') or ''
            )
            
            pressure = self.parse_value(
                row.get('Pressure_hPa') or row.get('Pressure') or row.get('pressure') or ''
            )
            
            wind_speed = self.parse_value(
                row.get('Wind_Speed_kmh') or row.get('Wind_Speed') or row.get('wind_speed') or ''
            )
            
            # Convert wind speed from km/h to m/s if present
            if wind_speed is not None:
                wind_speed = wind_speed / 3.6
            
            wind_direction = self.parse_value(
                row.get('Wind_Direction_deg') or row.get('Wind_Direction') or row.get('wind_dir') or ''
            )
            
            rainfall = self.parse_value(
                row.get('Rainfall_mm') or row.get('Rainfall') or row.get('rainfall') or ''
            )
            
            # Get station coordinates (from metadata or CSV)
            coords = self.station_coords.get(station_id, {})
            
            lat = coords.get('lat') or self.parse_value(row.get('Latitude') or row.get('lat') or '')
            lon = coords.get('lon') or self.parse_value(row.get('Longitude') or row.get('lon') or '')
            elevation = coords.get('elevation_m') or self.parse_value(row.get('Elevation') or row.get('elevation') or '')
            
            # Assign quality flags
            quality_temp = self.assign_quality_flag(temperature, 'temperature')
            quality_humidity = self.assign_quality_flag(humidity, 'humidity')
            quality_pressure = self.assign_quality_flag(pressure, 'pressure')
            
            # Build record
            record = {
                'station_id': station_id,
                'source': 'IMD',
                'timestamp_utc': utc_datetime,
                'lat': lat,
                'lon': lon,
                'elevation_m': elevation,
                'temperature_c': temperature,
                'humidity_pct': humidity,
                'pressure_hpa': pressure,
                'wind_speed_ms': wind_speed,
                'wind_direction_deg': wind_direction,
                'rainfall_mm': rainfall,
                'visibility_m': None,
                'quality_temp': quality_temp,
                'quality_humidity': quality_humidity,
                'quality_pressure': quality_pressure,
                'is_synthetic': False,
                'anomaly_label': None
            }
            
            self.records_parsed += 1
            if temperature is not None or humidity is not None or pressure is not None:
                self.records_valid += 1
            
            return record
        
        except Exception as e:
            print(f"Warning: Failed to parse row: {e}")
            print(f"Row: {row}")
            return None
    
    def parse_file(self, filepath: Path) -> List[Dict]:
        """
        Parse entire IMD CSV file
        
        Args:
            filepath: Path to IMD CSV file
        
        Returns:
            List of parsed records
        """
        records = []
        
        print(f"Parsing {filepath}...")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row_num, row in enumerate(reader, 1):
                if row_num % 1000 == 0:
                    print(f"  Processed {row_num} rows...", end='\r')
                
                record = self.parse_row(row)
                if record:
                    records.append(record)
        
        print(f"  Processed {row_num} rows... Done!")
        print(f"  Parsed {self.records_parsed} records, {self.records_valid} valid")
        
        return records


def save_to_parquet(records: List[Dict], output_path: Path, append: bool = True):
    """Save records to Parquet file"""
    if not HAS_PANDAS:
        # Fallback to CSV
        csv_path = output_path.with_suffix('.csv')
        save_to_csv(records, csv_path, append)
        return
    
    df_new = pd.DataFrame(records)
    
    # Convert timestamp to datetime64
    df_new['timestamp_utc'] = pd.to_datetime(df_new['timestamp_utc'])
    
    # Append to existing Parquet if exists
    if append and output_path.exists():
        df_existing = pd.read_parquet(output_path)
        df = pd.concat([df_existing, df_new], ignore_index=True)
        
        # Remove duplicates (same station + timestamp)
        df = df.drop_duplicates(subset=['station_id', 'timestamp_utc'], keep='last')
        
        print(f"Appended {len(df_new)} records to existing {len(df_existing)} (total {len(df)} after dedup)")
    else:
        df = df_new
        print(f"Created new Parquet with {len(df)} records")
    
    # Sort by timestamp
    df = df.sort_values(['station_id', 'timestamp_utc'])
    
    # Save
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(output_path, index=False, compression='snappy')
    
    print(f"Saved to {output_path}")


def save_to_csv(records: List[Dict], output_path: Path, append: bool = True):
    """Fallback CSV save"""
    import csv
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    mode = 'a' if append and output_path.exists() else 'w'
    
    with open(output_path, mode, newline='') as f:
        if records:
            writer = csv.DictWriter(f, fieldnames=records[0].keys())
            
            if mode == 'w':
                writer.writeheader()
            
            writer.writerows(records)
    
    print(f"Saved {len(records)} records to {output_path} (CSV)")


def main():
    parser = argparse.ArgumentParser(description='Parse IMD AWS CSV to common schema')
    parser.add_argument('--input', required=True, help='Input IMD CSV file')
    parser.add_argument('--output', required=True, help='Output Parquet file')
    parser.add_argument('--metadata', help='Station metadata CSV (station_id,lat,lon,elevation_m)')
    parser.add_argument('--no-append', action='store_true', help='Overwrite output (default: append)')
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    output_path = Path(args.output)
    metadata_path = Path(args.metadata) if args.metadata else None
    
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)
    
    # Parse
    parser_obj = IMDAWSParser(station_metadata_path=metadata_path)
    records = parser_obj.parse_file(input_path)
    
    if not records:
        print("Error: No valid records parsed")
        sys.exit(1)
    
    # Save
    save_to_parquet(records, output_path, append=not args.no_append)
    
    print("\nSummary:")
    print(f"  Input file: {input_path}")
    print(f"  Output file: {output_path}")
    print(f"  Records parsed: {parser_obj.records_parsed}")
    print(f"  Records valid: {parser_obj.records_valid}")
    print(f"  Success rate: {100.0 * parser_obj.records_valid / parser_obj.records_parsed:.1f}%")


if __name__ == '__main__':
    main()
