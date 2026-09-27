#!/usr/bin/env python3
"""
NOAA ISD (Integrated Surface Database) Parser

Converts NOAA ISD fixed-width format to common schema Parquet.

Usage:
    python ingest_noaa_isd.py --input data/raw/noaa_isd/430030-99999-2024 \
                               --output data/processed/station_hourly.parquet

Features:
    - Parses fixed-width ISD format
    - Handles missing values (+9999, 99999)
    - Quality flag filtering
    - Converts to common schema
    - Appends to existing Parquet (if exists)

Data source: ftp://ftp.ncei.noaa.gov/pub/data/noaa/
Format doc: https://www.ncei.noaa.gov/data/global-hourly/doc/isd-format-document.pdf
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# Optional: pandas for Parquet output (fallback to CSV if unavailable)
try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False
    print("Warning: pandas not installed. Output will be CSV instead of Parquet.")


class NOAAISDParser:
    """Parser for NOAA ISD fixed-width format"""
    
    # Missing value codes
    MISSING_TEMP = ['+9999', '-9999']
    MISSING_PRESSURE = ['99999']
    MISSING_WIND = ['9999']
    
    # Quality codes to accept
    VALID_QUALITY = ['1', '2', '3', '5']  # 1=passed all, 2=gross limits, 3=climate, 5=failed (we filter later)
    
    def __init__(self, station_metadata: Optional[Dict] = None):
        self.station_metadata = station_metadata or {}
        self.records_parsed = 0
        self.records_valid = 0
    
    def parse_line(self, line: str) -> Optional[Dict]:
        """
        Parse single ISD record line
        
        Returns:
            Dict with parsed fields, or None if invalid
        """
        if len(line) < 105:
            return None  # Too short to be valid
        
        try:
            # Mandatory header (control data)
            usaf = line[4:10].strip()
            wban = line[10:15].strip()
            year = int(line[15:19])
            month = int(line[19:21])
            day = int(line[21:23])
            hour = int(line[23:25])
            minute = int(line[25:27])
            
            # Geolocation (optional, may be missing)
            lat_str = line[28:34].strip()
            lon_str = line[34:41].strip()
            
            lat = float(lat_str) / 1000.0 if lat_str and lat_str not in ['+99999', '-99999'] else None
            lon = float(lon_str) / 1000.0 if lon_str and lon_str not in ['+99999', '-99999'] else None
            
            # Elevation (optional)
            elev_str = line[46:51].strip()
            elevation = float(elev_str) if elev_str and elev_str not in ['+9999', '-9999'] else None
            
            # Wind (positions 60-69)
            wind_dir_str = line[60:63].strip()
            wind_speed_str = line[65:69].strip()
            
            wind_direction = int(wind_dir_str) if wind_dir_str and wind_dir_str not in ['999'] else None
            wind_speed_raw = int(wind_speed_str) if wind_speed_str and wind_speed_str not in self.MISSING_WIND else None
            wind_speed = wind_speed_raw / 10.0 if wind_speed_raw is not None else None  # Scale: m/s
            
            # Temperature (positions 87-92)
            temp_str = line[87:92].strip()
            temp_quality = line[92] if len(line) > 92 else '9'
            
            if temp_str in self.MISSING_TEMP or temp_quality not in self.VALID_QUALITY:
                temperature = None
                quality_temp = "MISSING" if temp_str in self.MISSING_TEMP else "BAD"
            else:
                temperature = int(temp_str) / 10.0  # Scale: °C
                quality_temp = "GOOD" if temp_quality in ['1', '2', '3'] else "SUSPECT"
            
            # Dewpoint (positions 93-98)
            dewpoint_str = line[93:98].strip()
            dewpoint_quality = line[98] if len(line) > 98 else '9'
            
            if dewpoint_str in self.MISSING_TEMP or dewpoint_quality not in self.VALID_QUALITY:
                dewpoint = None
            else:
                dewpoint = int(dewpoint_str) / 10.0  # Scale: °C
            
            # Sea level pressure (positions 99-104)
            pressure_str = line[99:104].strip()
            pressure_quality = line[104] if len(line) > 104 else '9'
            
            if pressure_str in self.MISSING_PRESSURE or pressure_quality not in self.VALID_QUALITY:
                pressure = None
                quality_pressure = "MISSING"
            else:
                pressure = int(pressure_str) / 10.0  # Scale: hPa
                quality_pressure = "GOOD" if pressure_quality in ['1', '2', '3'] else "SUSPECT"
            
            # Calculate relative humidity from temperature and dewpoint
            humidity = None
            quality_humidity = "MISSING"
            if temperature is not None and dewpoint is not None:
                try:
                    humidity = self.calculate_relative_humidity(temperature, dewpoint)
                    quality_humidity = "GOOD"
                except Exception:
                    pass
            
            # Build timestamp
            timestamp = datetime(year, month, day, hour, minute)
            
            # Build record
            record = {
                'station_id': f'NOAA-{usaf}-{wban}',
                'source': 'NOAA',
                'timestamp_utc': timestamp,
                'lat': lat,
                'lon': lon,
                'elevation_m': elevation,
                'temperature_c': temperature,
                'humidity_pct': humidity,
                'pressure_hpa': pressure,
                'wind_speed_ms': wind_speed,
                'wind_direction_deg': wind_direction,
                'rainfall_mm': None,  # Not in mandatory section
                'visibility_m': None,  # Additional data sections (not parsed yet)
                'quality_temp': quality_temp,
                'quality_humidity': quality_humidity,
                'quality_pressure': quality_pressure,
                'is_synthetic': False,
                'anomaly_label': None
            }
            
            self.records_parsed += 1
            if temperature is not None or pressure is not None or humidity is not None:
                self.records_valid += 1
            
            return record
        
        except Exception as e:
            print(f"Warning: Failed to parse line: {e}")
            print(f"Line: {line[:80]}...")
            return None
    
    @staticmethod
    def calculate_relative_humidity(temp_c: float, dewpoint_c: float) -> float:
        """
        Calculate relative humidity from temperature and dewpoint using Magnus-Tetens
        
        Args:
            temp_c: Temperature in °C
            dewpoint_c: Dewpoint in °C
        
        Returns:
            Relative humidity in % (0-100)
        """
        import math
        
        # Magnus-Tetens formula constants
        a = 17.27
        b = 237.7
        
        # Saturation vapor pressure at temperature
        es_temp = 6.112 * math.exp((a * temp_c) / (b + temp_c))
        
        # Actual vapor pressure at dewpoint
        es_dewpoint = 6.112 * math.exp((a * dewpoint_c) / (b + dewpoint_c))
        
        # Relative humidity
        rh = 100.0 * (es_dewpoint / es_temp)
        
        # Clamp to [0, 100]
        return max(0.0, min(100.0, rh))
    
    def parse_file(self, filepath: Path) -> List[Dict]:
        """
        Parse entire ISD file
        
        Args:
            filepath: Path to ISD file (uncompressed)
        
        Returns:
            List of parsed records
        """
        records = []
        
        print(f"Parsing {filepath}...")
        
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for line_num, line in enumerate(f, 1):
                if line_num % 1000 == 0:
                    print(f"  Processed {line_num} lines...", end='\r')
                
                record = self.parse_line(line.strip())
                if record:
                    records.append(record)
        
        print(f"  Processed {line_num} lines... Done!")
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
    """Fallback CSV save (when pandas unavailable)"""
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
    parser = argparse.ArgumentParser(description='Parse NOAA ISD files to common schema')
    parser.add_argument('--input', required=True, help='Input ISD file (uncompressed)')
    parser.add_argument('--output', required=True, help='Output Parquet file')
    parser.add_argument('--no-append', action='store_true', help='Overwrite output (default: append)')
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    output_path = Path(args.output)
    
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)
    
    # Parse
    parser_obj = NOAAISDParser()
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
