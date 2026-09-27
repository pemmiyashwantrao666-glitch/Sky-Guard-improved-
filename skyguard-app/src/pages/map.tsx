// Map Page - GIS visualization of all AWS stations
import React, { useEffect, useState } from 'react';
import { StationMap } from '@/components/StationMap';
import { getStations } from '@/lib/edge-api';
import type { Station } from '@/types';

export default function MapPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStations();
    
    // Refresh stations every 30 seconds
    const interval = setInterval(loadStations, 30000);
    
    return () => clearInterval(interval);
  }, []);

  async function loadStations() {
    try {
      const data = await getStations();
      setStations(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load stations:', err);
      setError('Failed to load stations');
    } finally {
      setLoading(false);
    }
  }

  function handleStationSelect(stationId: string) {
    setSelectedStation(stationId);
    // Could navigate to station detail page here
    // router.push(`/stations/${stationId}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading stations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
          <button 
            onClick={loadStations}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Station Network Map
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Real-time health monitoring of all AWS stations
            </p>
          </div>
          
          {/* Stats summary */}
          <div className="flex gap-4">
            <StatBadge 
              label="Total" 
              value={stations.length} 
              color="blue" 
            />
            <StatBadge 
              label="Healthy" 
              value={stations.filter(s => s.status === 'HEALTHY').length} 
              color="green" 
            />
            <StatBadge 
              label="Warning" 
              value={stations.filter(s => s.status === 'WARNING').length} 
              color="yellow" 
            />
            <StatBadge 
              label="Critical" 
              value={stations.filter(s => s.status === 'CRITICAL').length} 
              color="red" 
            />
            <StatBadge 
              label="Offline" 
              value={stations.filter(s => s.status === 'OFFLINE').length} 
              color="gray" 
            />
          </div>
        </div>
      </header>

      {/* Map Container */}
      <main className="flex-1 p-6">
        <StationMap 
          stations={stations}
          selectedStation={selectedStation}
          onStationSelect={handleStationSelect}
          className="h-full"
        />
      </main>

      {/* Selected Station Panel */}
      {selectedStation && (
        <StationPanel 
          station={stations.find(s => s.station_id === selectedStation)!}
          onClose={() => setSelectedStation(undefined)}
        />
      )}
    </div>
  );
}

function StatBadge({ 
  label, 
  value, 
  color 
}: { 
  label: string; 
  value: number; 
  color: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  };

  return (
    <div className={`px-3 py-2 rounded-lg ${colorClasses[color]}`}>
      <div className="text-xs font-medium">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function StationPanel({ 
  station, 
  onClose 
}: { 
  station: Station; 
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-6 left-6 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {station.station_id}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {station.source} Station
          </p>
        </div>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          ✕
        </button>
      </div>

      {/* Status */}
      <div className="mb-4">
        <StatusBadge status={station.status} />
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        <DetailRow 
          label="Location" 
          value={`${station.lat?.toFixed(4)}, ${station.lon?.toFixed(4)}`} 
        />
        {station.elevation && (
          <DetailRow 
            label="Elevation" 
            value={`${station.elevation}m`} 
          />
        )}
        <DetailRow 
          label="Last Seen" 
          value={station.last_seen ? formatTimestamp(station.last_seen) : 'Never'} 
        />
        {station.anomaly_count > 0 && (
          <DetailRow 
            label="Anomalies (24h)" 
            value={station.anomaly_count.toString()}
            valueClass="text-red-600 dark:text-red-400 font-semibold"
          />
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <a 
          href={`/stations/${station.station_id}`}
          className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          View Details →
        </a>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Station['status'] }) {
  const statusConfig = {
    HEALTHY: { label: 'Healthy', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
    WARNING: { label: 'Warning', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
    CRITICAL: { label: 'Critical', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
    OFFLINE: { label: 'Offline', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300' },
    UNKNOWN: { label: 'Unknown', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300' }
  };

  const config = statusConfig[status];

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

function DetailRow({ 
  label, 
  value, 
  valueClass = 'text-gray-900 dark:text-white' 
}: { 
  label: string; 
  value: string; 
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600 dark:text-gray-400">{label}:</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
