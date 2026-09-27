#!/usr/bin/env python3
"""
Fault Injection Tool

Inject synthetic anomalies into clean weather station data for evaluation.

Usage:
    python inject_faults.py --input data/processed/station_hourly.parquet \
                            --output data/labels/anomaly_labels.parquet \
                            --faults spike,frozen,drift,comm_loss \
                            --rate 0.05

Features:
    - Inject multiple fault types
    - Configurable fault rate
    - Preserve original data (separate label column)
    - Generate evaluation dataset

Fault Types:
    - spike: Sudden jump (temperature +15°C, humidity ±30%, pressure ±8hPa)
    - frozen: Sensor stuck (8+ identical consecutive readings)
    - drift: Gradual bias accumulation (+0.5°C per hour)
    - comm_loss: Missing data (NaN values)
    - pressure_drop: Rapid pressure fall (8-14 hPa in 2-4 readings)
    - multi_sensor: Multiple parameters fail simultaneously
"""

import argparse
import sys
import random
from pathlib import Path
from typing import List, Dict, Tuple

try:
    import pandas as pd
    import numpy as np
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False
    print("Error: pandas required. Install with: pip install pandas")
    sys.exit(1)


class FaultInjector:
    """Inject synthetic faults into weather station data"""
    
    FAULT_TYPES = [
        'spike',
        'frozen',
        'drift',
        'comm_loss',
        'pressure_drop',
        'multi_sensor'
    ]
    
    def __init__(self, seed: int = 42):
        random.seed(seed)
        np.random.seed(seed)
        self.injected_faults = []
    
    def inject_spike(self, df: pd.DataFrame, station_id: str, start_idx: int) -> pd.DataFrame:
        """Inject temperature spike"""
        # Jump +15°C (or -15°C randomly)
        direction = random.choice([1, -1])
        df.loc[start_idx, 'temperature_c'] += direction * 15.0
        df.loc[start_idx, 'anomaly_label'] = 'SPIKE'
        df.loc[start_idx, 'is_synthetic'] = True
        
        self.injected_faults.append({
            'station_id': station_id,
            'start_idx': start_idx,
            'fault_type': 'SPIKE',
            'duration': 1
        })
        
        return df
    
    def inject_frozen(self, df: pd.DataFrame, station_id: str, start_idx: int, duration: int = 8) -> pd.DataFrame:
        """Inject frozen sensor (identical readings)"""
        frozen_value_t = df.loc[start_idx, 'temperature_c']
        frozen_value_h = df.loc[start_idx, 'humidity_pct']
        frozen_value_p = df.loc[start_idx, 'pressure_hpa']
        
        for i in range(duration):
            idx = start_idx + i
            if idx < len(df):
                df.loc[idx, 'temperature_c'] = frozen_value_t
                df.loc[idx, 'humidity_pct'] = frozen_value_h
                df.loc[idx, 'pressure_hpa'] = frozen_value_p
                df.loc[idx, 'anomaly_label'] = 'FROZEN'
                df.loc[idx, 'is_synthetic'] = True
        
        self.injected_faults.append({
            'station_id': station_id,
            'start_idx': start_idx,
            'fault_type': 'FROZEN',
            'duration': duration
        })
        
        return df
    
    def inject_drift(self, df: pd.DataFrame, station_id: str, start_idx: int, duration: int = 10) -> pd.DataFrame:
        """Inject gradual drift (+0.5°C per reading)"""
        for i in range(duration):
            idx = start_idx + i
            if idx < len(df):
                df.loc[idx, 'temperature_c'] += i * 0.5  # Cumulative drift
                df.loc[idx, 'anomaly_label'] = 'DRIFT'
                df.loc[idx, 'is_synthetic'] = True
        
        self.injected_faults.append({
            'station_id': station_id,
            'start_idx': start_idx,
            'fault_type': 'DRIFT',
            'duration': duration
        })
        
        return df
    
    def inject_comm_loss(self, df: pd.DataFrame, station_id: str, start_idx: int, duration: int = 5) -> pd.DataFrame:
        """Inject communication loss (NaN values)"""
        for i in range(duration):
            idx = start_idx + i
            if idx < len(df):
                df.loc[idx, 'temperature_c'] = np.nan
                df.loc[idx, 'humidity_pct'] = np.nan
                df.loc[idx, 'pressure_hpa'] = np.nan
                df.loc[idx, 'anomaly_label'] = 'COMM_LOSS'
                df.loc[idx, 'is_synthetic'] = True
        
        self.injected_faults.append({
            'station_id': station_id,
            'start_idx': start_idx,
            'fault_type': 'COMM_LOSS',
            'duration': duration
        })
        
        return df
    
    def inject_pressure_drop(self, df: pd.DataFrame, station_id: str, start_idx: int, duration: int = 3) -> pd.DataFrame:
        """Inject rapid pressure drop (storm simulation)"""
        drop_per_reading = -4.0  # hPa per reading
        
        for i in range(duration):
            idx = start_idx + i
            if idx < len(df):
                df.loc[idx, 'pressure_hpa'] += i * drop_per_reading
                df.loc[idx, 'anomaly_label'] = 'PRESSURE_DROP'
                df.loc[idx, 'is_synthetic'] = True
        
        self.injected_faults.append({
            'station_id': station_id,
            'start_idx': start_idx,
            'fault_type': 'PRESSURE_DROP',
            'duration': duration
        })
        
        return df
    
    def inject_multi_sensor(self, df: pd.DataFrame, station_id: str, start_idx: int) -> pd.DataFrame:
        """Inject multi-sensor fault (temperature spike + humidity spike)"""
        df.loc[start_idx, 'temperature_c'] += 18.0
        df.loc[start_idx, 'humidity_pct'] += 30.0
        df.loc[start_idx, 'humidity_pct'] = min(100.0, df.loc[start_idx, 'humidity_pct'])
        df.loc[start_idx, 'anomaly_label'] = 'MULTI_SENSOR'
        df.loc[start_idx, 'is_synthetic'] = True
        
        self.injected_faults.append({
            'station_id': station_id,
            'start_idx': start_idx,
            'fault_type': 'MULTI_SENSOR',
            'duration': 1
        })
        
        return df
    
    def inject_faults(self, df: pd.DataFrame, fault_types: List[str], fault_rate: float = 0.05) -> pd.DataFrame:
        """
        Inject faults into dataset
        
        Args:
            df: Input DataFrame (common schema)
            fault_types: List of fault types to inject
            fault_rate: Fraction of readings to corrupt (0.0-1.0)
        
        Returns:
            DataFrame with injected faults and labels
        """
        # Add label columns if not present
        if 'anomaly_label' not in df.columns:
            df['anomaly_label'] = None
        if 'is_synthetic' not in df.columns:
            df['is_synthetic'] = False
        
        # Make a copy to avoid modifying original
        df = df.copy()
        
        # Get unique stations
        stations = df['station_id'].unique()
        
        print(f"Injecting faults into {len(stations)} stations...")
        print(f"  Fault types: {fault_types}")
        print(f"  Fault rate: {fault_rate * 100:.1f}%")
        
        for station_id in stations:
            station_mask = df['station_id'] == station_id
            station_indices = df[station_mask].index.tolist()
            
            num_faults = max(1, int(len(station_indices) * fault_rate))
            
            print(f"  {station_id}: Injecting {num_faults} faults")
            
            for _ in range(num_faults):
                fault_type = random.choice(fault_types)
                
                # Choose random start index (ensure space for fault duration)
                if fault_type == 'frozen':
                    duration = 8
                elif fault_type == 'drift':
                    duration = 10
                elif fault_type == 'comm_loss':
                    duration = 5
                elif fault_type == 'pressure_drop':
                    duration = 3
                else:
                    duration = 1
                
                if len(station_indices) > duration + 10:
                    start_idx = random.choice(station_indices[10:-duration-10])  # Avoid edges
                    
                    # Inject fault
                    if fault_type == 'spike':
                        df = self.inject_spike(df, station_id, start_idx)
                    elif fault_type == 'frozen':
                        df = self.inject_frozen(df, station_id, start_idx, duration)
                    elif fault_type == 'drift':
                        df = self.inject_drift(df, station_id, start_idx, duration)
                    elif fault_type == 'comm_loss':
                        df = self.inject_comm_loss(df, station_id, start_idx, duration)
                    elif fault_type == 'pressure_drop':
                        df = self.inject_pressure_drop(df, station_id, start_idx, duration)
                    elif fault_type == 'multi_sensor':
                        df = self.inject_multi_sensor(df, station_id, start_idx)
        
        print(f"\nTotal faults injected: {len(self.injected_faults)}")
        
        # Print summary
        fault_counts = {}
        for fault in self.injected_faults:
            fault_type = fault['fault_type']
            fault_counts[fault_type] = fault_counts.get(fault_type, 0) + 1
        
        print("\nFault type distribution:")
        for fault_type, count in sorted(fault_counts.items()):
            print(f"  {fault_type}: {count}")
        
        return df


def main():
    parser = argparse.ArgumentParser(description='Inject synthetic faults into weather data')
    parser.add_argument('--input', required=True, help='Input Parquet file (clean data)')
    parser.add_argument('--output', required=True, help='Output Parquet file (with labels)')
    parser.add_argument('--faults', default='spike,frozen,drift',
                        help='Comma-separated fault types (default: spike,frozen,drift)')
    parser.add_argument('--rate', type=float, default=0.05,
                        help='Fault rate (fraction of readings, default: 0.05 = 5%%)')
    parser.add_argument('--seed', type=int, default=42, help='Random seed (default: 42)')
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    output_path = Path(args.output)
    
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)
    
    # Parse fault types
    fault_types = [f.strip() for f in args.faults.split(',')]
    invalid_faults = [f for f in fault_types if f not in FaultInjector.FAULT_TYPES]
    if invalid_faults:
        print(f"Error: Invalid fault types: {invalid_faults}")
        print(f"Valid types: {FaultInjector.FAULT_TYPES}")
        sys.exit(1)
    
    # Load data
    print(f"Loading {input_path}...")
    df = pd.read_parquet(input_path)
    print(f"  Loaded {len(df)} records from {df['station_id'].nunique()} stations")
    
    # Inject faults
    injector = FaultInjector(seed=args.seed)
    df_labeled = injector.inject_faults(df, fault_types, fault_rate=args.rate)
    
    # Save
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df_labeled.to_parquet(output_path, index=False, compression='snappy')
    
    print(f"\nSaved to {output_path}")
    
    # Print label distribution
    label_counts = df_labeled['anomaly_label'].value_counts()
    print("\nLabel distribution:")
    print(f"  Normal (unlabeled): {label_counts.get(None, 0) + label_counts.get('', 0)}")
    for label, count in label_counts.items():
        if label and label != '':
            print(f"  {label}: {count}")


if __name__ == '__main__':
    main()
