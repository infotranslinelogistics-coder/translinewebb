import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import '@maplibre/maplibre-gl-leaflet';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

declare module 'leaflet' {
  export function maplibreGL(opts: { style: string }): L.Layer;
}

interface OpenFreeMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  minHeight?: number;
  className?: string;
  onMapReady?: (map: L.Map) => void;
}

export function OpenFreeMap({
  center = { lat: 37.7749, lng: -122.4194 },
  zoom = 11,
  minHeight = 420,
  className,
  onMapReady,
}: OpenFreeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapInstance) return;
    const { clientHeight } = containerRef.current;
    if (clientHeight === 0) {
      console.warn('OpenFreeMap container has zero height. Ensure a minHeight is set.');
    }
    const map = L.map(containerRef.current, {
      zoomControl: true,
      preferCanvas: true,
    }).setView([center.lat, center.lng], zoom);

    L.maplibreGL({ style: STYLE_URL }).addTo(map);
    setTimeout(() => map.invalidateSize(true), 0);
    onMapReady?.(map);
    setMapInstance(map);

    return () => {
      map.remove();
    };
  }, [center, mapInstance, onMapReady, zoom]);

  useEffect(() => {
    if (!mapInstance || !containerRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.contentRect.height === 0) {
          console.warn('OpenFreeMap container has zero height.');
        }
        if (entry.contentRect.height > 0 && entry.contentRect.width > 0) {
          mapInstance.invalidateSize();
        }
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [mapInstance]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ minHeight }}
    />
  );
}
