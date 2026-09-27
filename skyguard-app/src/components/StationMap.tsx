// Station Map Component - GIS visualization using MapLibre
// Shows all registered AWS stations with real-time health status

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Station } from '@/types';

interface StationMapProps {
  stations: Station[];
  selectedStation?: string;
  onStationSelect?: (stationId: string) => void;
  className?: string;
}

const INDIA_CENTER: [number, number] = [78.9629, 20.5937];
const INDIA_ZOOM = 4.5;

// Health status colors
const STATUS_COLORS = {
  HEALTHY: '#22c55e',      // green-500
  WARNING: '#f59e0b',      // amber-500
  CRITICAL: '#ef4444',     // red-500
  OFFLINE: '#6b7280',      // gray-500
  UNKNOWN: '#9ca3af'       // gray-400
};

export function StationMap({ 
  stations, 
  selectedStation, 
  onStationSelect,
  className = '' 
}: StationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: INDIA_CENTER,
      zoom: INDIA_ZOOM,
      attributionControl: true
    });

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    
    // Add scale bar
    map.current.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update markers when stations change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove old markers that are no longer in stations
    const currentStationIds = new Set(stations.map(s => s.station_id));
    for (const [id, marker] of markers.current.entries()) {
      if (!currentStationIds.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }

    // Add or update markers
    stations.forEach(station => {
      if (!station.lat || !station.lon) return;

      let marker = markers.current.get(station.station_id);

      if (!marker) {
        // Create new marker
        const el = createMarkerElement(station);
        
        marker = new maplibregl.Marker({ element: el })
          .setLngLat([station.lon, station.lat])
          .addTo(map.current!);

        // Add click handler
        el.addEventListener('click', () => {
          if (onStationSelect) {
            onStationSelect(station.station_id);
          }
        });

        // Add popup
        const popup = new maplibregl.Popup({ offset: 25 })
          .setHTML(createPopupHTML(station));
        
        marker.setPopup(popup);
        
        markers.current.set(station.station_id, marker);
      } else {
        // Update existing marker
        const el = marker.getElement();
        updateMarkerElement(el, station);
        
        // Update popup
        const popup = marker.getPopup();
        if (popup) {
          popup.setHTML(createPopupHTML(station));
        }
      }

      // Highlight selected station
      const el = marker.getElement();
      if (station.station_id === selectedStation) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });

    // Fit bounds if stations exist
    if (stations.length > 0 && stations.some(s => s.lat && s.lon)) {
      const bounds = new maplibregl.LngLatBounds();
      stations.forEach(station => {
        if (station.lat && station.lon) {
          bounds.extend([station.lon, station.lat]);
        }
      });
      
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 12
      });
    }
  }, [stations, selectedStation, mapLoaded, onStationSelect]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainer} className="w-full h-full rounded-lg" />
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 text-sm">
        <div className="font-semibold mb-2">Station Health</div>
        <div className="space-y-1">
          <LegendItem color={STATUS_COLORS.HEALTHY} label="Healthy" />
          <LegendItem color={STATUS_COLORS.WARNING} label="Warning" />
          <LegendItem color={STATUS_COLORS.CRITICAL} label="Critical" />
          <LegendItem color={STATUS_COLORS.OFFLINE} label="Offline" />
        </div>
      </div>

      {/* Station count badge */}
      <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-3 py-2 text-sm font-semibold">
        {stations.length} {stations.length === 1 ? 'Station' : 'Stations'}
      </div>
    </div>
  );
}

function createMarkerElement(station: Station): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'station-marker';
  
  const color = STATUS_COLORS[station.status] || STATUS_COLORS.UNKNOWN;
  
  el.innerHTML = `
    <div class="marker-outer" style="border-color: ${color};">
      <div class="marker-inner" style="background-color: ${color};"></div>
    </div>
  `;
  
  return el;
}

function updateMarkerElement(el: HTMLElement, station: Station) {
  const color = STATUS_COLORS[station.status] || STATUS_COLORS.UNKNOWN;
  
  const outer = el.querySelector('.marker-outer') as HTMLElement;
  const inner = el.querySelector('.marker-inner') as HTMLElement;
  
  if (outer) outer.style.borderColor = color;
  if (inner) inner.style.backgroundColor = color;
}

function createPopupHTML(station: Station): string {
  const statusBadge = `
    <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
          style="background-color: ${STATUS_COLORS[station.status]}20; color: ${STATUS_COLORS[station.status]};">
      ${station.status}
    </span>
  `;

  const lastSeenText = station.last_seen 
    ? new Date(station.last_seen).toLocaleString()
    : 'Never';

  return `
    <div class="station-popup">
      <div class="font-semibold text-base mb-2">${station.station_id}</div>
      ${statusBadge}
      <div class="mt-3 space-y-1 text-sm">
        <div><span class="text-gray-600">Location:</span> ${station.lat?.toFixed(4)}, ${station.lon?.toFixed(4)}</div>
        ${station.elevation ? `<div><span class="text-gray-600">Elevation:</span> ${station.elevation}m</div>` : ''}
        <div><span class="text-gray-600">Last Seen:</span> ${lastSeenText}</div>
        ${station.anomaly_count ? `<div><span class="text-red-600">Anomalies:</span> ${station.anomaly_count}</div>` : ''}
      </div>
    </div>
  `;
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div 
        className="w-3 h-3 rounded-full border-2" 
        style={{ 
          backgroundColor: color,
          borderColor: color
        }} 
      />
      <span className="text-gray-700 dark:text-gray-300">{label}</span>
    </div>
  );
}

// Add CSS styles
const styles = `
  .station-marker {
    cursor: pointer;
    transition: transform 0.2s;
  }
  
  .station-marker:hover {
    transform: scale(1.2);
    z-index: 1000;
  }
  
  .station-marker.selected {
    transform: scale(1.3);
    z-index: 1001;
  }
  
  .marker-outer {
    width: 24px;
    height: 24px;
    border: 3px solid;
    border-radius: 50%;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  
  .marker-inner {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  
  .station-marker.selected .marker-outer {
    border-width: 4px;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }
  
  .station-popup {
    font-family: system-ui, -apple-system, sans-serif;
    min-width: 200px;
  }
  
  .maplibregl-popup-content {
    padding: 12px;
    border-radius: 8px;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
