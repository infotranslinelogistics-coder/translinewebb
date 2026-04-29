import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { MapPin, Loader, Search, RefreshCw } from 'lucide-react';
import { Driver, listDrivers } from '@/lib/db/drivers';
import { supabase } from '@/lib/supabase';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { listLatestLocationsByDrivers, subscribeToLocationUpdates } from '@/lib/db/locations';
import { fetchShiftEvents } from '@/lib/db/shifts';
import { fetchShiftsFull } from '@/lib/db/shifts';
import { Badge } from '@/app/components/ui/badge';

export function LiveMapPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Map<string, any>>(new Map());
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  const clearRoute = () => {
    if (routeLayerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
  };

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

  function turnIcon(modifier: string): string {
    const icons: Record<string, string> = {
      left: '↰', right: '↱', 'slight left': '↖', 'slight right': '↗',
      'sharp left': '⬅', 'sharp right': '➡', straight: '↑', uturn: '↩',
    };
    return icons[modifier] ?? '•';
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


  const drawRouteForDriver = async (driverId: string) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      clearRoute();
      setSelectedDriverId(driverId);
      setRouteLoading(true);

      // track all layers added so clearRoute can remove them
      const extraLayers: L.Layer[] = [];
      const addLayer = (l: L.Layer) => { extraLayers.push(l); l.addTo(map); };

      // store cleanup alongside polyline
      (routeLayerRef as any)._extra = extraLayers;

      try {
        const allShifts = await fetchShiftsFull();
        const shift = allShifts.find(s =>
          s.driver_id === driverId &&
          s.start_lat != null && s.start_lng != null &&
          s.end_lat != null && s.end_lng != null
        );
        if (!shift) return;

        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${shift.start_lng},${shift.start_lat};${shift.end_lng},${shift.end_lat}` +
          `?overview=full&geometries=geojson&steps=true`;

        const res = await fetch(url);
        const json = await res.json();
        if (json.code !== 'Ok' || !json.routes?.[0]) return;

        const route = json.routes[0];
        const totalDistance: number = route.distance; // metres
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
        const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // ── events (break + stops) ──────────────────────────────────────────────
        const events = await fetchShiftEvents(shift.id);
        const sorted = [...events].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

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

        const snappedStart = snapToRoute(coords, Number(shift.start_lat), Number(shift.start_lng));
        addLayer(
          L.marker(snappedStart, {
            icon: L.divIcon({ className: '', html: dotHtml('#22c55e', 16, true), iconSize: [16, 16], iconAnchor: [8, 8] }),
          }).bindPopup(popupCard([
            { label: 'Event',   value: 'Shift Start' },
            { label: 'Time',    value: startedAt ? fmt(startedAt) : '-' },
            { label: 'Driver',  value: shift.driver_name ?? '-' },
            { label: 'Vehicle', value: shift.vehicle_rego ?? '-' },
          ], 'Start Point'), { closeButton: false })
        );

        if (shift.end_lat != null && shift.end_lng != null) {
          const snappedEnd = snapToRoute(coords, Number(shift.end_lat), Number(shift.end_lng));
          addLayer(
            L.marker(snappedEnd, {
              icon: L.divIcon({ className: '', html: dotHtml('#ef4444', 16, true), iconSize: [16, 16], iconAnchor: [8, 8] }),
            }).bindPopup(popupCard([
              { label: 'Event',    value: 'Shift End' },
              { label: 'Time',     value: endedAt ? fmt(endedAt) : '-' },
              { label: 'Duration', value: durationText },
              { label: 'Distance', value: formatDistance(totalDistance) },
            ], 'End Point'), { closeButton: false })
          );
        }

        // ── turn-by-turn markers ────────────────────────────────────────────────
        const legs: any[] = route.legs ?? [];
        const allSteps: any[] = legs.flatMap((leg: any) => leg.steps ?? []);

        allSteps.forEach((step: any, i: number) => {
          const [sLng, sLat] = step.maneuver.location;
          const snapped = snapToRoute(coords, sLat, sLng);

          const type: string     = step.maneuver.type ?? '';
          const modifier: string = step.maneuver.modifier ?? 'straight';
          const streetName: string = step.name || 'Unnamed road';

          // skip depart/arrive — those are the start/end markers above
          if (type === 'depart' || type === 'arrive') return;

          const icon = turnIcon(modifier);
          const markerHtml = `
            <div style="
              width:10px;height:10px;
              background:white;
              border:2px solid #fff;
              border-radius:50%;
              box-shadow:0 0 0 2px #1d4ed855;
            "></div>`;

          addLayer(
            L.marker(snapped, {
              icon: L.divIcon({ className: '', html: markerHtml, iconSize: [10, 10], iconAnchor: [5, 5] }),
              zIndexOffset: 100,
            }).bindPopup(
              popupCard([
                { label: 'Turn',     value: `${icon} ${modifier}` },
                { label: 'Street',   value: streetName }
              ], `Turn ${i + 1}`),
              { closeButton: false }
            )
          );
        });

        // ── snapped STOP markers (amber) ────────────────────────────────────────
        const MIN_STOP_MS = 3 * 60 * 1000;
        const MIN_R = 50, MAX_R = 100;

        events
          .filter(e =>
            e.event_type === 'stop_detected' &&
            e.latitude != null && e.longitude != null && e.metadata
          )
          .forEach(stop => {
            const meta = stop.metadata as any;
            const startTime = meta?.start_time ? new Date(meta.start_time) : null;
            const endTime   = meta?.end_time   ? new Date(meta.end_time)   : null;
            if (!startTime || !endTime) return;

            const durMs = endTime.getTime() - startTime.getTime();
            if (durMs < MIN_STOP_MS) return;

            const radius = Number(meta?.radius_m);
            if (Number.isNaN(radius) || radius < MIN_R || radius > MAX_R) return;

            const snapped = snapToRoute(coords, Number(stop.latitude), Number(stop.longitude));

            const stopHtml = `
              <div style="position:relative;width:18px;height:18px;">
                <div style="
                  position:absolute;inset:0;
                  background:#f59e0b33;
                  border-radius:50%;
                  animation:pulse 1.4s ease-out infinite;
                "></div>
                ${dotHtml('#f59e0b', 14, true)}
              </div>`;

            addLayer(
              L.marker(snapped, {
                icon: L.divIcon({ className: '', html: stopHtml, iconSize: [18, 18], iconAnchor: [9, 9] }),
                zIndexOffset: 200,
              }).bindPopup(
                popupCard([
                  { label: 'Duration', value: `${Math.round(durMs / 60000)} min` },
                  { label: 'Radius',   value: `${radius} m` },
                ], 'Stop'),
                { closeButton: false }
              )
            );
          });

        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

      } catch (err) {
        console.error('Route fetch failed:', err);
      } finally {
        setRouteLoading(false);
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

  const vehicleOptions = useMemo(() => {
    const set = new Set<string>();

    drivers.forEach(d => {
      if (d.current_vehicle_rego) {
        set.add(d.current_vehicle_rego);
      }
    });

    return Array.from(set);
  }, [drivers]);

  const gpsDrivers = useMemo(() => {
    return drivers
      .filter(driver => locations.has(driver.driver_id))

      // online filter
      .filter(driver => {
        if (!onlineOnly) return true;
        return driver.online_status === "online";
      })

      // vehicle filter
      .filter(driver => {
        if (vehicleFilter === 'all') return true;
        return driver.current_vehicle_rego === vehicleFilter;
      })

      .map(driver => ({
        ...driver,
        location: locations.get(driver.driver_id)
      }));
  }, [drivers, locations, onlineOnly, vehicleFilter]);

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

    const init = async () => {
      try {
        const driverRows = await listDrivers();
        setDrivers(driverRows);

        const rows = await listLatestLocationsByDrivers();
        const locMap = new Map();

        rows.forEach((loc) => {
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
      map.remove();
      mapInstanceRef.current = null;
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
                  Pin locations update in realtime via Supabase
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                {/* <Input
                  type="search"
                  placeholder="Search drivers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#0F0F0F] border-gray-700 text-white placeholder:text-gray-500"
                /> */}
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
              <div className="flex items-center justify-between">
                <Label className="text-gray-300">Online only</Label>
                <input
                  type="checkbox"
                  checked={onlineOnly}
                  onChange={(e) => setOnlineOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-700 bg-[#0F0F0F]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Vehicle</Label>
                <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                  <SelectTrigger className="bg-[#0F0F0F] border-gray-700 text-white">
                    <SelectValue placeholder="All vehicles" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">All vehicles</SelectItem>

                    {vehicleOptions.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#161616] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Active Drivers</CardTitle>
              <CardDescription className="text-gray-400">
                {String(gpsDrivers.length)} drivers sharing GPS
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {false ? (
                  <div className="flex justify-center py-4">
                    <Loader className="w-6 h-6 text-[#FF6B35] animate-spin" />
                  </div>
                ) :
                  gpsDrivers.map((driver) => (
                    <button
                      type="button"
                      key={driver.driver_id}
                      onClick={() => drawRouteForDriver(driver.driver_id)}
                      className={`w-full text-left p-3 bg-[#0F0F0F] rounded-lg border transition-colors ${
                        selectedDriverId === driver.driver_id
                          ? 'border-[#3B82F6]'
                          : 'border-gray-800 hover:border-[#FF6B35]'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">
                            {driver?.full_name || 'Unknown'}
                          </p>
                          
                          <p className="text-gray-400 text-xs mb-2"> Current Vehicle: {driver.current_vehicle_rego}</p>
                          {driver.online_status === 'online' ? (
                          <>
                          <p className="text-gray-400 text-xs mb-2"> Device ID: {driver.device_id}</p>
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
                          {driver.location?.latitude?.toFixed(4)}, {driver.location?.longitude?.toFixed(4)}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}