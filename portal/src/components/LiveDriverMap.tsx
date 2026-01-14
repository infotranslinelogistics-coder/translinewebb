import { useEffect, useRef, useState } from 'react';
import Map, { MapRef } from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Driver } from '../types/location';
import { DriverMarker } from './DriverMarker';

interface LiveDriverMapProps {
  drivers: Driver[];
  onDriverClick: (driver: Driver) => void;
}

export function LiveDriverMap({ drivers, onDriverClick }: LiveDriverMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState({
    latitude: -33.8688,
    longitude: 151.2093,
    zoom: 11
  });

  // Auto-center map to fit all drivers
  useEffect(() => {
    if (drivers.length === 0 || !mapRef.current) return;

    const locations = drivers
      .map(d => d.locations[d.locations.length - 1])
      .filter(l => l);

    if (locations.length === 0) return;

    const lats = locations.map(l => l.latitude);
    const lngs = locations.map(l => l.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Only fit bounds if we have multiple drivers, otherwise center on single driver
    if (locations.length === 1) {
      setViewState({
        latitude: locations[0].latitude,
        longitude: locations[0].longitude,
        zoom: 13
      });
    } else {
      try {
        mapRef.current.fitBounds(
          [[minLng, minLat], [maxLng, maxLat]],
          { padding: 50, duration: 1000 }
        );
      } catch (e) {
        console.error('Error fitting bounds:', e);
      }
    }
  }, [drivers.length]);

  const mapStyle = {
    version: 8 as const,
    sources: {
      osm: {
        type: 'raster' as const,
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors'
      }
    },
    layers: [{
      id: 'osm',
      type: 'raster' as const,
      source: 'osm',
      minzoom: 0,
      maxzoom: 19
    }]
  };

  return (
    <div className="w-full h-full relative">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapLib={maplibregl}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
      >
        {drivers.map(driver => (
          <DriverMarker
            key={driver.id}
            driver={driver}
            onClick={onDriverClick}
          />
        ))}
      </Map>
    </div>
  );
}
