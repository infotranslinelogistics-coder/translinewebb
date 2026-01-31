import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

interface OpenFreeMapProps {
  center?: [number, number];
  zoom?: number;
  minHeight?: number;
  className?: string;
  onMapReady?: (map: maplibregl.Map) => void;
}

export function OpenFreeMap({
  center = [-122.4194, 37.7749],
  zoom = 11,
  minHeight = 420,
  className,
  onMapReady,
}: OpenFreeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapInstance) return;
    const { clientHeight } = containerRef.current;
    if (clientHeight === 0) {
      console.warn('OpenFreeMap container has zero height. Ensure a minHeight is set.');
    }
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center,
      zoom,
    });
    map.once('load', () => {
      onMapReady?.(map);
    });
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
          mapInstance.resize();
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
