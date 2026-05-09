import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { ChevronLeft, ChevronRight, MapPin, Loader, RefreshCw } from 'lucide-react';
import { Driver, listDrivers } from '@/lib/db/drivers';
import { supabase } from '@/lib/supabase';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { listLatestLocationsByDrivers, subscribeToLocationUpdates } from '@/lib/db/locations';
import { fetchShiftEvents } from '@/lib/db/shifts';
import { fetchShiftsFull } from '@/lib/db/shifts';
import { Badge } from '@/app/components/ui/badge';
import type { ShiftFull } from '@/lib/db/shifts';
import { listVehicles } from '@/lib/db/vehicles';
import { formatPerthDateTime, PERTH_TIME_LABEL } from '@/lib/dateTime';

export function LiveMapPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeMarkerRefs = useRef<{
    start: L.Marker | null;
    latest: L.Marker | null;
    lastStop: L.Marker | null;
  }>({
    start: null,
    latest: null,
    lastStop: null,
  });
  const stopMarkersRef = useRef<L.Marker[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<string[]>([]);
  const [locations, setLocations] = useState<Map<string, any>>(new Map());
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedHistoryShiftId, setSelectedHistoryShiftId] = useState<string>('all');
  const [previousShifts, setPreviousShifts] = useState<ShiftFull[]>([]);
  const [activeShifts, setActiveShifts] = useState<ShiftFull[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const extraLayersRef = useRef<L.Layer[]>([]);

const clearRoute = () => {
  const map = mapInstanceRef.current;
  if (!map) return;

  if (routeLayerRef.current) {
    map.removeLayer(routeLayerRef.current);
    routeLayerRef.current = null;
  }

  extraLayersRef.current.forEach(l => map.removeLayer(l));
  extraLayersRef.current = [];

  routeMarkerRefs.current = { start: null, latest: null, lastStop: null };
  stopMarkersRef.current = [];
  setStartPoint(null);
  setLatestPoint(null);
  setLastStopPoint(null);
  setLastStopRecorded(false);
  setStopPoints([]);
  setActiveStopIndex(0);
};

  const flyToQuickPoint = useCallback((point: [number, number] | null, marker: L.Marker | null) => {
    const map = mapInstanceRef.current;
    if (!map || !point) return;
    map.flyTo(point, 16);
    marker?.openPopup();
  }, []);

  const jumpToStopIndex = useCallback((index: number) => {
    const map = mapInstanceRef.current;
    const totalStops = stopPoints.length;
    if (!map || totalStops === 0) return;

    const normalized = ((index % totalStops) + totalStops) % totalStops;
    const point = stopPoints[normalized];
    const marker = stopMarkersRef.current[normalized] ?? null;

    setActiveStopIndex(normalized);
    map.flyTo(point, 16);
    marker?.openPopup();
  }, [stopPoints]);

  const goToPreviousStop = useCallback(() => {
    jumpToStopIndex(activeStopIndex - 1);
  }, [activeStopIndex, jumpToStopIndex]);

  const goToNextStop = useCallback(() => {
    jumpToStopIndex(activeStopIndex + 1);
  }, [activeStopIndex, jumpToStopIndex]);

  function snapToRoute(
    coords: [number, number][],
    lat: number,
    lng: number
  ): [number, number] {
    let minDist = Infinity;
    let nearest: [number, number] = [lat, lng];
    for (const [rlat, rlng] of coords) {
      const d = Math.hypot(rlat - lat, rlng - lng);
      if (d < minDist) { minDist = d; nearest = [rlat, rlng]; }
    }
    return nearest;
  }

  function formatDistance(meters: number): string {
    return meters >= 1000
      ? `${(meters / 1000).toFixed(2)} km`
      : `${Math.round(meters)} m`;
  }
  
  function dotHtml(color: string, size = 12, glow = false): string {
    return `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border:2.5px solid #fff;
      border-radius:50%;
      box-shadow:0 0 0 2px ${color}55${glow ? `,0 0 10px ${color}` : ''};
    "></div>`;
  }

  function popupCard(rows: { label: string; value: string }[], title?: string): string {
    const body = rows.map(r => `
      <div style="display:flex;justify-content:space-between;gap:16px;padding:4px 0;">
        <span style="color:#6b7280;font-size:12px;white-space:nowrap;">${r.label}</span>
        <span style="color:#111827;font-size:12px;font-weight:600;text-align:right;">${r.value}</span>
      </div>`).join('');
    return `
      <div style="font-family:Inter,system-ui,sans-serif;min-width:200px;padding:2px;">
        ${title ? `<div style="font-weight:700;font-size:13px;color:#1d4ed8;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">${title}</div>` : ''}
        ${body}
      </div>`;
  }


  const drawRouteForShift = async (shift: ShiftFull) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      clearRoute();
      setRouteLoading(true);

      // track all layers added so clearRoute can remove them
      extraLayersRef.current = [];
      const addLayer = (l: L.Layer) => { extraLayersRef.current.push(l); l.addTo(map); }


      try {
        if (
          shift.start_lat == null ||
          shift.start_lng == null 
        ) {
          return;
        }

        let end_lat = shift.end_lat;
        let end_lng = shift.end_lng;

        const shiftDriver = gpsDrivers.find(d=>d.driver_id === shift.driver_id);
        if(shift.status !== 'completed' && shiftDriver?.location) {
          end_lat = shiftDriver.location.latitude;
          end_lng = shiftDriver.location.longitude;
        } else if (end_lat == null || end_lng == null) {
          return;
        }

        setSelectedShiftId(shift.id ?? null);

        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${shift.start_lng},${shift.start_lat};${end_lng},${end_lat}` +
          `?overview=full&geometries=geojson&steps=true`;

        const res = await fetch(url);
        const json = await res.json();
        if (json.code !== 'Ok' || !json.routes?.[0]) return;

        const route = json.routes[0];
        const totalDistance: number = route.distance;
        const coords: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );

        const isCompleted = shift.status === 'completed';
        const routeColor = isCompleted ? '#1a1a2e' : '#ff6b35';

        const polyline = L.polyline(coords, {
          color: routeColor,
          weight: 5,
          opacity: 0.88,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(map);
        routeLayerRef.current = polyline;

        // ── shift times / duration ──────────────────────────────────────────────
        const startedAt = shift.started_at ? new Date(shift.started_at) : null;
        const endedAt   = shift.ended_at   ? new Date(shift.ended_at)   : new Date();
        const durationMs = startedAt && endedAt ? endedAt.getTime() - startedAt.getTime() : 0;
        const totalSec = Math.max(0, Math.floor(durationMs / 1000));
        const durationText = `${Math.floor(totalSec / 3600)}h ${Math.floor((totalSec % 3600) / 60)}m`;
        const fmt = (d: Date) => formatPerthDateTime(d);

        // ── events (break + stops) ──────────────────────────────────────────────
        const forceEndEvent = [...sorted].reverse().find((event) => event.event_type === 'force_end_shift');
        const endEventLabel = forceEndEvent ? 'Force ended' : 'Shift End';
        const endEventAt = forceEndEvent?.created_at ?? shift.ended_at;

        // break status
        let breakRows: { label: string; value: string }[] = [];
        const lastBreakStart = [...sorted].reverse().find(e => e.event_type === 'break_start');
        const breakEnd = sorted.find(e => e.event_type == "break_end");
        if (lastBreakStart && !breakEnd) {
          const bMs = Date.now() - new Date(lastBreakStart.created_at).getTime();
          const bSec = Math.floor(bMs / 1000);
          breakRows = [
            { label: 'Break status', value: 'On Break' },
            { label: 'Break duration', value: `${Math.floor(bSec / 60)}m ${bSec % 60}s` },
          ];
        }

        // shared shift summary popup
        const shiftPopupHtml = popupCard([
          { label: 'Driver',    value: shift.driver_name ?? 'Unknown' },
          { label: 'Vehicle',   value: shift.vehicle_rego ?? 'Unknown' },
          { label: 'Started',   value: startedAt ? fmt(startedAt) : '-' },
          { label: 'Duration',  value: durationText },
          { label: 'Distance',  value: formatDistance(totalDistance) },
          ...breakRows,
        ], 'Shift Overview') +
        `<a href="/portal/shifts/${shift.id}" style="
            display:block;margin-top:10px;text-align:center;
            background:#1d4ed8;color:#fff;text-decoration:none;
            padding:8px;border-radius:8px;font-size:12px;font-weight:700;">
          View Full Shift Details →
        </a>`;

        polyline.bindPopup(shiftPopupHtml, { maxWidth: 280, closeButton: false });
        polyline.on('click', function (this: L.Polyline) { this.openPopup(); });

        const snappedStart = snapToRoute(coords, Number(startLocation.latitude), Number(startLocation.longitude));
        const startMarker = L.marker(snappedStart, {
            icon: L.divIcon({ className: '', html: dotHtml('#22c55e', 16, true), iconSize: [16, 16], iconAnchor: [8, 8] }),
          }).bindPopup(popupCard([
            { label: 'Event',   value: 'Shift Start' },
            { label: 'Time',    value: startedAt ? fmt(startedAt) : '-' },
            { label: 'Driver',  value: shift.driver_name ?? '-' },
            { label: 'Vehicle', value: shift.vehicle_rego ?? '-' },
          ], 'Start Point'), { closeButton: false });
        addLayer(startMarker);
        routeMarkerRefs.current.start = startMarker;
        setStartPoint(snappedStart);

        if (endLocation.latitude != null && endLocation.longitude != null) {
          const snappedEnd = snapToRoute(coords, Number(endLocation.latitude), Number(endLocation.longitude));
          const latestMarker = L.marker(snappedEnd, {
              icon: L.divIcon({ className: '', html: dotHtml('#ef4444', 16, true), iconSize: [16, 16], iconAnchor: [8, 8] }),
            }).bindPopup(popupCard([
              { label: 'Event',    value: shiftIsActive ? 'Current Location' : 'Latest Location' },
              { label: 'Time',     value: endEventAt ? fmt(new Date(endEventAt)) : '-' },
              { label: 'Duration', value: durationText },
              { label: 'Distance', value: formatDistance(totalDistance) },
            ], shiftIsActive ? 'Current Point' : 'Latest Point'), { closeButton: false });
          addLayer(latestMarker);
          routeMarkerRefs.current.latest = latestMarker;
          setLatestPoint(snappedEnd);
          setLatestLabel(shiftIsActive ? 'Current' : 'Latest');
        } else {
          routeMarkerRefs.current.latest = null;
          setLatestPoint(null);
        }

        const stopEventsDesc = events
          .filter(e =>
            e.event_type === 'stop_detected' &&
            e.latitude != null && e.longitude != null
          )
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const stopEventsAsc = [...stopEventsDesc].reverse();

        const latestStopEvent = stopEventsDesc[0] ?? null;
        let latestStopMarker: L.Marker | null = null;
        let latestStopCoords: [number, number] | null = null;
        const snappedStopPoints: [number, number][] = [];
        const stopMarkers: L.Marker[] = [];

        stopEventsAsc.forEach((stop, index) => {
          const snapped = snapToRoute(coords, Number(stop.latitude), Number(stop.longitude));
          const isLatestStop = index === stopEventsAsc.length - 1;

          const marker = L.marker(snapped, {
            icon: L.divIcon({ className: '', html: dotHtml(isLatestStop ? '#ef4444' : '#f59e0b', isLatestStop ? 16 : 14, true), iconSize: [16, 16], iconAnchor: [8, 8] }),
            zIndexOffset: isLatestStop ? 220 : 200,
          }).bindPopup(popupCard([
            { label: 'Event', value: isLatestStop ? 'Last Stop' : 'Stop' },
            { label: 'Time', value: fmt(new Date(stop.created_at)) },
          ], isLatestStop ? 'Last Stop' : 'Stop'), { closeButton: false });

          addLayer(marker);
          snappedStopPoints.push(snapped);
          stopMarkers.push(marker);

          if (isLatestStop) {
            latestStopMarker = marker;
            latestStopCoords = snapped;
          }
        });

        routeMarkerRefs.current.lastStop = latestStopMarker;
        stopMarkersRef.current = stopMarkers;
        setLastStopPoint(latestStopCoords);
        setLastStopRecorded(Boolean(latestStopEvent));
        setStopPoints(snappedStopPoints);
        setActiveStopIndex(snappedStopPoints.length > 0 ? snappedStopPoints.length - 1 : 0);

        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

      } catch (err) {
        console.error('Route fetch failed:', err);
      } finally {
        setRouteLoading(false);
      }
  };

  const drawRouteForDriver = async (driverId: string) => {
    setSelectedDriverId(driverId);
    setSelectedHistoryShiftId('all');

    try {
      const allShifts = await fetchShiftsFull({ driverId });
      const shift = allShifts.find(s =>
        s.start_lat != null && s.start_lng != null &&
        s.end_lat != null && s.end_lng != null
      );

      if (!shift || shift.status == "completed") return;
      await drawRouteForShift(shift);
    } catch (err) {
      console.error('Driver route fetch failed:', err);
    }
  };

  const markerIcon = useCallback((online: boolean | null) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          width: 14px;
          height: 14px;
          background: ${online ? '#2f659e' : '#c7c7c7'};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(59,130,246,0.6);
        "></div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }, []);

  const getAllVehicles = async () => {
    try {
      const vehicles = await listVehicles();
      const set = new Set<string>();
      vehicles.forEach(v => {
        if (v.rego) {
          set.add(v.rego);
        }
      });
      setVehicleOptions(Array.from(set));
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
      setVehicleOptions([]);
    }
  };

  const gpsDrivers = useMemo(() => {
    return drivers
      .filter(driver => locations.has(driver.driver_id))

      .map(driver => ({
        ...driver,
        location: locations.get(driver.driver_id)
      }));
  }, [drivers, locations, vehicleFilter]);

  const previousShiftOptions = useMemo(() => {
    return previousShifts.filter((shift) => Boolean(shift.id && shift.ended_at));
  }, [previousShifts]);

  const formatPreviousShiftLabel = useCallback((shift: ShiftFull) => {
    const dateLabel = shift.started_at
      ? formatPerthDateTime(shift.started_at)
      : 'Unknown date';

    return `${shift.vehicle_rego ?? 'Unknown Vehicle'} | ${dateLabel} | ${shift.driver_name ?? 'Unknown Driver'}`;
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [-25.2744, 133.7751], // Australia
      zoom: 4,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    let cancelled = false;

    const init = async () => {
      try {
        const driverRows = await listDrivers();
        if (cancelled) return;
        setDrivers(driverRows);
        getAllVehicles();
        
        // Fetch all shifts to find active and ended ones
        const shifts = await fetchShiftsFull();
        if (cancelled) return;
        const endedShifts = shifts.filter((shift) => shift.ended_at != null);

        // Early return if no ended shifts
        if (endedShifts.length === 0) {
          setPreviousShifts([]);
          setActiveShifts(shifts.filter((shift) => shift.status === 'active'));
          return;
        }
        
        // Fetch ALL location events (with pagination to avoid 1000 row limit)
        let allLocationEvents: any[] = [];
        let hasMore = true;
        let offset = 0;
        const pageSize = 1000;
        
        while (hasMore) {
          const { data, error } = await supabase
            .from('shift_events')
            .select('shift_id')
            .eq('event_type', 'location')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .order('created_at', { ascending: false })
            .range(offset, offset + pageSize - 1);
          
          if (error) {
            console.error('Failed to load location events:', error);
            break;
          }
          
          if (!data || data.length === 0) {
            hasMore = false;
          } else {
            allLocationEvents = allLocationEvents.concat(data);
            if (data.length < pageSize) {
              hasMore = false;
            }
            offset += pageSize;
          }
        }
        if (cancelled) return;
        
        // Track which shift IDs have location events
        const shiftIdsWithLocation = new Set(
          allLocationEvents.map((event) => event.shift_id)
        );
        
        // Filter ended shifts to only those with location events
        const shiftsWithGps = endedShifts.filter(shift => shiftIdsWithLocation.has(shift.id));
        setPreviousShifts(shiftsWithGps);
        
        setActiveShifts(
          shifts.filter((shift) => shift.status === 'active')
        );

        const rows = await listLatestLocationsByDrivers();
        if (cancelled) return;
        const locMap = new Map();

        rows.forEach((loc) => {
          if (cancelled || mapInstanceRef.current !== map) return;
          locMap.set(loc.driver_id, loc);

          const marker = L.marker(
            [loc.latitude, loc.longitude],
            { icon: markerIcon(driverRows.find((d) => d.driver_id === loc.driver_id)?.online_status == "online")}
          ).addTo(map);

          marker.on('click', () => drawRouteForDriver(loc.driver_id));

          markersRef.current.set(loc.driver_id, marker);
        });

        setLocations(locMap);
      } catch (err) {
        console.error(err);
      } 
    };

    init();

    const channel = subscribeToLocationUpdates((loc) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      setLocations((prev) => {
        const next = new Map(prev);
        next.set(loc.driver_id, loc);
        return next;
      });

      const existing = markersRef.current.get(loc.driver_id);
      if (existing) {
        existing.setLatLng([loc.latitude, loc.longitude]);
      } else {
        const marker = L.marker([loc.latitude, loc.longitude], { icon: markerIcon(drivers.find((d) => d.driver_id === loc.driver_id)?.online_status == "online") }).addTo(map);
        marker.on('click', () => drawRouteForDriver(loc.driver_id));
        markersRef.current.set(loc.driver_id, marker);
      }
    });

    return () => {
      cancelled = true;
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current.clear();
      supabase.removeChannel(channel);
      routeLayerRef.current = null;
    };
  }, [markerIcon]);


  return (
    <div className="space-y-6">
      {/* {error && (
        <Card className="bg-red-950 border-red-900">
          <CardContent className="p-4 text-red-400">{error}</CardContent>
        </Card>
      )} */}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Live Map</h1>
          <p className="text-gray-400">Real-time driver and vehicle tracking</p>
        </div>
        <Button
          className="bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="bg-[#161616] border-gray-800 lg:col-span-3">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-white">Live Map</CardTitle>
                <CardDescription className="text-gray-400">
                  Pin locations update in realtime via Supabase. All timestamps shown in {PERTH_TIME_LABEL}.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {routeLoading && (
              <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/40 rounded-lg">
                <div className="flex items-center gap-2 bg-[#161616] px-4 py-2 rounded-lg border border-gray-700">
                  <Loader className="w-4 h-4 text-[#3B82F6] animate-spin" />
                  <span className="text-sm text-gray-300">Loading route...</span>
                </div>
              </div>
            )}
              <div className="mb-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-green-700 text-white hover:bg-green-600"
                  disabled={!startPoint}
                  onClick={() => flyToQuickPoint(startPoint, routeMarkerRefs.current.start)}
                >
                  Start Location
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-blue-700 text-white hover:bg-blue-600"
                  disabled={!latestPoint}
                  onClick={() => flyToQuickPoint(latestPoint, routeMarkerRefs.current.latest)}
                >
                  {latestLabel} Location
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-red-700 text-white hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-300"
                  disabled={!lastStopPoint}
                  onClick={() => flyToQuickPoint(lastStopPoint, routeMarkerRefs.current.lastStop)}
                >
                  {lastStopRecorded ? 'Last Stop' : 'No stops recorded'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#1D4ED8] text-white hover:bg-[#1E40AF] disabled:bg-gray-700 disabled:text-gray-300"
                  disabled={stopPoints.length < 2}
                  onClick={goToPreviousStop}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Prev Stop
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:bg-gray-700 disabled:text-gray-300"
                  disabled={stopPoints.length < 2}
                  onClick={goToNextStop}
                >
                  Next Stop
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <span className="text-xs text-gray-400 self-center">
                  {stopPoints.length > 0 ? `Stop ${activeStopIndex + 1} of ${stopPoints.length}` : 'No stops'}
                </span>
              </div>
              <div className="h-[520px] relative">
                <div ref={mapRef} className="absolute inset-0" />
              </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-[#161616] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Filters</CardTitle>
              <CardDescription className="text-gray-400">
                Refine the live map view
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Vehicle</Label>
                <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                  <SelectTrigger className="bg-[#0F0F0F] border-gray-700 text-white">
                    <SelectValue placeholder="All vehicles" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">All vehicles</SelectItem>

                    {vehicleOptions.map((v: string) => 
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#161616] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Active Shifts</CardTitle>
              <CardDescription className="text-gray-400">

              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {false ? (
                  <div className="flex justify-center py-4">
                    <Loader className="w-6 h-6 text-[#FF6B35] animate-spin" />
                  </div>
                ) :
                  activeShifts.length ? activeShifts.map((shift) => (
                    <button
                      type="button"
                      key={shift.id}
                      onClick={() => drawRouteForShift(shift)}
                      className={`w-full text-left p-3 bg-[#0F0F0F] rounded-lg border transition-colors ${
                        selectedShiftId === shift.id
                          ? 'border-[#3B82F6]'
                          : 'border-gray-800 hover:border-[#FF6B35]'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">
                            {shift?.driver_name || 'Unknown'}
                          </p>
                          
                          <p className="text-gray-400 text-xs mb-2">Vehicle: {shift.vehicle_rego}</p>
                          {gpsDrivers.find(d=>d.driver_id === shift.driver_id)?.online_status === 'online' ? (
                          <>
                          <p className="text-gray-400 text-xs mb-2"> Device ID: {gpsDrivers.find(d=>d.driver_id === shift.driver_id)?.device_id}</p>
                          <Badge className="bg-green-950 text-green-400 border-green-900">
                            Online
                          </Badge>
                          </>
                        ) : (
                          <Badge className="bg-amber-950 text-amber-300 border-amber-800">
                            Offline
                          </Badge>
                        )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <MapPin className="w-3 h-3 text-[#FF6B35] flex-shrink-0" />
                        <span>
                          {gpsDrivers.find(d=>d.driver_id === shift.driver_id)?.location?.latitude?.toFixed(4)}, {gpsDrivers.find(d=>d.driver_id === shift.driver_id)?.location?.longitude?.toFixed(4)}
                        </span>
                      </div>
                    </button>
                  )) : (
                    <p className="text-gray-400 text-sm">No active shifts available.</p>
                  )}

                <div className="pt-3 border-t border-gray-800 space-y-2">
                  <Label className="text-gray-300">Previous Shifts</Label>
                  <Select
                    value={selectedHistoryShiftId}
                    onValueChange={async (value) => {
                      setSelectedHistoryShiftId(value);
                      setSelectedDriverId(null);

                      if (value === 'all') {
                        clearRoute();
                        return;
                      }

                      const selectedShift = previousShiftOptions.find((shift) => shift.id === value);
                      if (!selectedShift) return;

                      await drawRouteForShift(selectedShift);
                    }}
                  >
                    <SelectTrigger className="bg-[#0F0F0F] border-gray-700 text-white">
                      <SelectValue placeholder="Select previous shift" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Select previous shift</SelectItem>
                      {previousShiftOptions.map((shift) => (
                        <SelectItem key={shift.id} value={shift.id}>
                          {formatPreviousShiftLabel(shift)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {previousShifts.find(s => s.id === selectedHistoryShiftId) && 
                  (previousShifts.find(s => s.id === selectedHistoryShiftId)?.vehicle_rego === vehicleFilter || vehicleFilter === 'all') && 
                  (
                    <button
                      type="button"
                      onClick={() => drawRouteForShift(previousShifts.find(s => s.id === selectedHistoryShiftId)!)}
                      className={`w-full text-left p-3 bg-[#0F0F0F] rounded-lg border transition-colors ${
                        selectedShiftId === selectedHistoryShiftId
                          ? 'border-[#3B82F6]'
                          : 'border-gray-800 hover:border-[#FF6B35]'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">
                            Driver Name: {previousShifts.find(s => s.id === selectedHistoryShiftId)?.driver_name || 'Unknown'}
                          </p>
                          
                          <p className="text-gray-400 text-xs mb-2">Vehicle for Shift: {previousShifts.find(s => s.id === selectedHistoryShiftId)?.vehicle_rego}</p>
                          {gpsDrivers.find(d=>d.driver_id === previousShifts.find(s => s.id === selectedHistoryShiftId)?.driver_id)?.online_status === 'online' ? (
                          <>
                          <p className="text-gray-400 text-xs mb-2"> Device ID: {gpsDrivers.find(d=>d.driver_id === previousShifts.find(s => s.id === selectedHistoryShiftId)?.driver_id)?.device_id}</p>
                          <p className="text-gray-400 text-xs">Driver Status: </p><Badge className="bg-green-950 text-green-400 border-green-900">
                            Online
                          </Badge>
                          </>
                        ) : (
                          <Badge className="bg-amber-950 text-amber-300 border-amber-800">
                            Offline
                          </Badge>
                        )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <MapPin className="w-3 h-3 text-[#FF6B35] flex-shrink-0" />
                        <span>
                          <p className='text-gray-400 text-xs'>
                            Latest Location:
                            </p>{gpsDrivers.find(d=>d.driver_id === previousShifts.find(s => s.id === selectedHistoryShiftId)?.driver_id)?.location?.latitude?.toFixed(4)}, {gpsDrivers.find(d=>d.driver_id === previousShifts.find(s => s.id === selectedHistoryShiftId)?.driver_id)?.location?.longitude?.toFixed(4)}
                        </span>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}