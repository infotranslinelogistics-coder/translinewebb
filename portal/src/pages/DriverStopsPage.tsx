import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Loader, MapPin, Play } from 'lucide-react';
import { format, formatDistanceStrict } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { computeDriverStops, computeStopsFromLocations, DriverStop } from '@/lib/db/stops';
import { listDriverLocationsRange, type DriverLocation } from '@/lib/db/locations';

const DEFAULT_CENTER: [number, number] = [37.7749, -122.4194];

export function DriverStopsPage() {
  const { id } = useParams();
  const driverId = id ?? '';
  const [driver, setDriver] = useState<any>(null);
  const [stops, setStops] = useState<DriverStop[]>([]);
  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [playbackIndex, setPlaybackIndex] = useState(0);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const stopMarkersRef = useRef<any[]>([]);
  const startEndMarkersRef = useRef<any[]>([]);
  const playbackMarkerRef = useRef<any>(null);

  const rangeStartIso = useMemo(() => new Date(`${startDate}T00:00:00Z`).toISOString(), [startDate]);
  const rangeEndIso = useMemo(() => new Date(`${endDate}T23:59:59Z`).toISOString(), [endDate]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || !window.L) return;
    const map = window.L.map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: 12,
      zoomControl: true,
    });
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!driverId) return;
    const loadDriver = async () => {
      const { data } = await supabase.from('drivers_full').select('*').eq('driver_id', driverId).maybeSingle();
      setDriver(data ?? null);
    };
    loadDriver();
  }, [driverId]);

  const fetchStopsAndLocations = async () => {
    if (!driverId) return;
    try {
      setLoading(true);
      const [stopRows, locationRows] = await Promise.all([
        computeDriverStops(driverId, rangeStartIso, rangeEndIso),
        listDriverLocationsRange(driverId, rangeStartIso, rangeEndIso),
      ]);
      setLocations(locationRows ?? []);
      if (stopRows.length > 0) {
        setStops(stopRows);
      } else if (locationRows.length > 0) {
        setStops(computeStopsFromLocations(locationRows));
      } else {
        setStops([]);
      }
      setPlaybackIndex(0);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load stops and playback data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStopsAndLocations();
  }, [driverId, rangeStartIso, rangeEndIso]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.L) return;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    stopMarkersRef.current.forEach((marker) => map.removeLayer(marker));
    stopMarkersRef.current = [];
    startEndMarkersRef.current.forEach((marker) => map.removeLayer(marker));
    startEndMarkersRef.current = [];

    if (locations.length > 0) {
      const latlngs = locations.map((loc) => [loc.lat, loc.lng]);
      routeLayerRef.current = window.L.polyline(latlngs, { color: '#FF6B35', weight: 3 });
      routeLayerRef.current.addTo(map);
      map.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });

      const start = locations[0];
      const end = locations[locations.length - 1];
      const startMarker = window.L.marker([start.lat, start.lng], {
        title: 'Route start',
      }).addTo(map);
      const endMarker = window.L.marker([end.lat, end.lng], {
        title: 'Route end',
      }).addTo(map);
      startEndMarkersRef.current.push(startMarker, endMarker);
    }

    stops.forEach((stop) => {
      const marker = window.L.circleMarker([stop.lat, stop.lng], {
        radius: selectedStopId === stop.id ? 8 : 6,
        color: selectedStopId === stop.id ? '#F59E0B' : '#22C55E',
        fillColor: selectedStopId === stop.id ? '#F59E0B' : '#22C55E',
        fillOpacity: 0.9,
      }).addTo(map);
      stopMarkersRef.current.push(marker);
    });
  }, [locations, stops, selectedStopId]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.L) return;
    if (playbackMarkerRef.current) {
      map.removeLayer(playbackMarkerRef.current);
      playbackMarkerRef.current = null;
    }
    if (locations.length === 0) return;
    const location = locations[playbackIndex] ?? locations[0];
    playbackMarkerRef.current = window.L.marker([location.lat, location.lng]);
    playbackMarkerRef.current.addTo(map);
  }, [locations, playbackIndex]);

  const selectedStop = stops.find((stop) => stop.id === selectedStopId) ?? null;
  const playbackLocation = locations[playbackIndex];

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedStop) return;
    map.setView([selectedStop.lat, selectedStop.lng], 14);
  }, [selectedStop]);

  return (
    <div className="space-y-6">
      {error && (
        <Card className="bg-red-950 border-red-900">
          <CardContent className="p-4 text-red-400">{error}</CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Driver Stops</h1>
          <p className="text-gray-400">
            {driver?.full_name ?? driver?.name ?? driver?.email ?? driverId}
          </p>
        </div>
        <Button
          onClick={fetchStopsAndLocations}
          className="bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
        >
          Refresh
        </Button>
      </div>

      <Card className="bg-[#161616] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Range</CardTitle>
          <CardDescription className="text-gray-400">Select the date range for stops and playback</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Start date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#0F0F0F] border-gray-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">End date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[#0F0F0F] border-gray-700 text-white"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={fetchStopsAndLocations}
              className="w-full bg-[#0F0F0F] border border-gray-700 text-gray-200 hover:bg-[#1F1F1F]"
            >
              <Play className="w-4 h-4 mr-2" />
              Load Range
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-[#161616] border-gray-800 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white">Route Playback</CardTitle>
            <CardDescription className="text-gray-400">Timeline slider follows the recorded route</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader className="w-8 h-8 text-[#FF6B35] animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-[420px] rounded-lg overflow-hidden border border-gray-800">
                  <div ref={mapRef} className="h-full w-full" />
                </div>
                {locations.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-gray-300">Playback timeline</Label>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, locations.length - 1)}
                      value={playbackIndex}
                      onChange={(e) => setPlaybackIndex(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-sm text-gray-400">
                      {playbackLocation
                        ? format(new Date(playbackLocation.recorded_at), 'MMM dd, yyyy HH:mm:ss')
                        : 'No location data'}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500">No location data for playback.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#161616] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Stops</CardTitle>
            <CardDescription className="text-gray-400">{stops.length} detected stops</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader className="w-6 h-6 text-[#FF6B35] animate-spin" />
              </div>
            ) : stops.length === 0 ? (
              <p className="text-gray-500 text-sm">No stops detected in this range.</p>
            ) : (
              <div className="space-y-3">
                {stops.map((stop) => (
                  <button
                    key={stop.id}
                    type="button"
                    onClick={() => setSelectedStopId(stop.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedStopId === stop.id
                        ? 'border-[#FF6B35] bg-[#0F0F0F]'
                        : 'border-gray-800 bg-[#0F0F0F] hover:border-[#FF6B35]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-white">
                          {format(new Date(stop.start_at), 'MMM dd, HH:mm')} - {format(new Date(stop.end_at), 'HH:mm')}
                        </p>
                        <p className="text-xs text-gray-500">
                          Duration: {formatDistanceStrict(new Date(stop.start_at), new Date(stop.end_at))}
                        </p>
                      </div>
                      <MapPin className="w-4 h-4 text-[#FF6B35]" />
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${stop.lat},${stop.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#FF6B35] hover:underline"
                    >
                      {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                    </a>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedStop && (
        <Card className="bg-[#161616] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Selected Stop</CardTitle>
            <CardDescription className="text-gray-400">Details for the highlighted stop</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-gray-300">
            <div>
              <p className="text-sm text-gray-500">Start</p>
              <p>{format(new Date(selectedStop.start_at), 'MMM dd, yyyy HH:mm')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">End</p>
              <p>{format(new Date(selectedStop.end_at), 'MMM dd, yyyy HH:mm')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Duration</p>
              <p>{formatDistanceStrict(new Date(selectedStop.start_at), new Date(selectedStop.end_at))}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
