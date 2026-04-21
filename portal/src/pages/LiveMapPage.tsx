import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { MapPin, Loader, Search, RefreshCw, ExternalLink } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { listLatestLocationsByDrivers, DriverLocation } from '@/lib/db/locations';
import { listDrivers } from '@/lib/db/drivers';
import { listVehicles, Vehicle } from '@/lib/db/vehicles';
import { supabase } from '@/lib/supabase';
import { useDriverLiveState, isOnlineFromLastSeen, type DriverLiveStatus } from '@/lib/realtime/useDriverLiveState';

const DEFAULT_CENTER: [number, number] = [37.7749, -122.4194];

export function LiveMapPage() {
  const { statusMap, setStatusMap, locationMap, setLocationMap } = useDriverLiveState();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [gpsOnly, setGpsOnly] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const hasCenteredRef = useRef(false);

  const driverMap = useMemo(() => {
    const map = new Map<string, any>();
    drivers.forEach((driver) => {
      const id = driver.id ?? driver.driver_id ?? driver.auth_user_id;
      if (id) map.set(id, driver);
    });
    return map;
  }, [drivers]);

  const vehicleMap = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach((vehicle) => map.set(vehicle.id, vehicle));
    return map;
  }, [vehicles]);
  const isOnline = (status?: DriverLiveStatus | null) =>
    isOnlineFromLastSeen(status?.last_seen_at) || Boolean(status?.is_online);

  const refreshData = async () => {
    try {
      setLoading(true);
      const [driversList, locationsList, vehiclesList, statusList] = await Promise.all([
        listDrivers(),
        listLatestLocationsByDrivers(),
        listVehicles(),
        supabase.from('view_driver_current_status').select('*'),
      ]);
      setDrivers(driversList ?? []);
      const nextLocationMap: Record<string, DriverLocation> = {};
      (locationsList ?? []).forEach((location) => {
        nextLocationMap[location.driver_id] = location;
      });
      setLocationMap(nextLocationMap);
      setVehicles(vehiclesList ?? []);
      const statusRows = (statusList.data as DriverLiveStatus[]) ?? [];
      const nextStatusMap: Record<string, DriverLiveStatus> = {};
      statusRows.forEach((row) => {
        nextStatusMap[row.driver_id] = {
          ...row,
          is_online: isOnlineFromLastSeen(row.last_seen_at),
        };
      });
      setStatusMap(nextStatusMap);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError('Failed to load location data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (Object.keys(locationMap).length > 0) {
      setLastUpdate(new Date());
    }
  }, [locationMap]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || !window.L) return;
    const map = window.L.map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: 11,
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

  const locationList = useMemo(() => Object.values(locationMap), [locationMap]);

  const filteredLocations = useMemo(() => {
    return locationList.filter((loc) => {
      const driver = driverMap.get(loc.driver_id);
      const driverName = (driver?.name ?? driver?.full_name ?? '').toLowerCase();
      const matchesSearch = driverName.includes(searchQuery.toLowerCase());
      const status = statusMap[loc.driver_id];
      const online = isOnline(status);
      const isGpsRecent = new Date(loc.recorded_at) > new Date(Date.now() - 5 * 60 * 1000);
      const matchesOnline = !onlineOnly || online;
      const matchesGps = !gpsOnly || isGpsRecent;
      const matchesVehicle =
        vehicleFilter === 'all' || status?.vehicle_id === vehicleFilter || loc.vehicle_id === vehicleFilter;
      return matchesSearch && matchesOnline && matchesGps && matchesVehicle && isGpsRecent;
    });
  }, [locationList, driverMap, searchQuery, onlineOnly, gpsOnly, vehicleFilter, statusMap]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.L) return;

    markersRef.current.forEach((marker) => {
      map.removeLayer(marker);
    });
    markersRef.current.clear();

    filteredLocations.forEach((loc) => {
      const status = statusMap[loc.driver_id];
      const online = isOnline(status);
      const isStale = new Date(loc.recorded_at) < new Date(Date.now() - 5 * 60 * 1000);
      const color = online ? (isStale ? '#F59E0B' : '#22C55E') : '#6B7280';
      const marker = window.L.marker([loc.lat, loc.lng], {
        icon: window.L.divIcon({
          className: 'driver-marker',
          html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.45)"></div>`,
        }),
      });
      marker.addTo(map);
      marker.on('click', () => setSelectedDriverId(loc.driver_id));
      markersRef.current.set(loc.driver_id, marker);
    });

    if (!hasCenteredRef.current && filteredLocations.length > 0) {
      const bounds = window.L.latLngBounds(filteredLocations.map((loc) => [loc.lat, loc.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
      hasCenteredRef.current = true;
    }
  }, [filteredLocations, statusMap]);

  const selectedLocation = selectedDriverId ? locationMap[selectedDriverId] : null;
  const selectedDriver = selectedDriverId ? driverMap.get(selectedDriverId) : null;
  const selectedStatus = selectedDriverId ? statusMap[selectedDriverId] : null;
  const selectedVehicle = selectedStatus?.vehicle_id
    ? vehicleMap.get(selectedStatus.vehicle_id)
    : selectedLocation?.vehicle_id
      ? vehicleMap.get(selectedLocation.vehicle_id)
      : null;
  const formatVehicleLabel = (vehicle?: Vehicle | null) => {
    if (!vehicle) return null;
    const rego = vehicle.rego ?? 'Unknown rego';
    const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
    return makeModel ? `${rego} • ${makeModel}` : rego;
  };

  const activeDrivers = filteredLocations.length;

  const handleRefresh = async () => {
    await refreshData();
  };

  const getLastUpdateLabel = (dateString?: string | null) => {
    if (!dateString) return 'No update';
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  return (
    <div className="space-y-6">
      {error && (
        <Card className="bg-red-950 border-red-900">
          <CardContent className="p-4 text-red-400">{error}</CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Live Map</h1>
          <p className="text-gray-400">Real-time driver and vehicle tracking</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={loading}
          className="bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {lastUpdate && (
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm text-gray-400">
                Last updated: {format(lastUpdate, 'MMM dd, HH:mm:ss')}
              </span>
            </div>
            <span className="text-sm font-medium text-green-400">{activeDrivers} Active</span>
          </CardContent>
        </Card>
      )}

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
                <Input
                  type="search"
                  placeholder="Search drivers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#0F0F0F] border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && locationList.length === 0 ? (
              <div className="flex justify-center py-16">
                <Loader className="w-8 h-8 text-[#FF6B35] animate-spin" />
              </div>
            ) : (
              <div className="h-[520px] rounded-lg overflow-hidden border border-gray-800">
                <div ref={mapRef} className="h-full w-full" />
              </div>
            )}
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
              <div className="flex items-center justify-between">
                <Label className="text-gray-300">GPS active only</Label>
                <input
                  type="checkbox"
                  checked={gpsOnly}
                  onChange={(e) => setGpsOnly(e.target.checked)}
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
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {formatVehicleLabel(vehicle)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#161616] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Selected Driver</CardTitle>
              <CardDescription className="text-gray-400">
                Click a pin to view details
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedLocation ? (
                <p className="text-sm text-gray-500">No driver selected.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {selectedDriver?.name || selectedDriver?.full_name || 'Driver'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {selectedVehicle
                        ? `Telemetry vehicle: ${formatVehicleLabel(selectedVehicle)}`
                        : 'Telemetry vehicle unknown'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isOnline(selectedStatus) ? (
                      <Badge className="bg-green-950 text-green-400 border-green-900">
                        Online
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-900 text-gray-300 border-gray-700">Offline</Badge>
                    )}
                    {selectedStatus?.on_break ? (
                      <Badge className="bg-amber-950 text-amber-300 border-amber-800">On Break</Badge>
                    ) : null}
                    {selectedStatus?.status_state ? (
                      <Badge className="bg-blue-950 text-blue-300 border-blue-800">
                        {selectedStatus.status_state}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="space-y-1 text-sm text-gray-300">
                    <p>
                      <span className="text-gray-500">Last update:</span>{' '}
                      {getLastUpdateLabel(selectedLocation.recorded_at)}
                    </p>
                    <p>
                      <span className="text-gray-500">Speed:</span>{' '}
                      {selectedLocation.speed_kmh ? `${selectedLocation.speed_kmh.toFixed(1)} km/h` : 'N/A'}
                    </p>
                    <p>
                      <span className="text-gray-500">Heading:</span>{' '}
                      {selectedLocation.heading ? `${selectedLocation.heading.toFixed(0)}°` : 'N/A'}
                    </p>
                  </div>
                  <Button
                    asChild
                    className="w-full bg-[#0F0F0F] border border-gray-700 text-gray-200 hover:bg-[#1F1F1F]"
                  >
                    <a
                      href={`https://www.google.com/maps?q=${selectedLocation.lat},${selectedLocation.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in Google Maps
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#161616] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Active Drivers</CardTitle>
              <CardDescription className="text-gray-400">
                {activeDrivers} drivers sharing GPS
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loading && locationList.length === 0 ? (
                  <div className="flex justify-center py-4">
                    <Loader className="w-6 h-6 text-[#FF6B35] animate-spin" />
                  </div>
                ) : filteredLocations.length === 0 ? (
                  <p className="text-gray-500 text-sm py-4">No drivers found</p>
                ) : (
                  filteredLocations.map((location) => {
                    const driver = driverMap.get(location.driver_id);
                    const status = statusMap[location.driver_id];
                    const online = isOnline(status);
                    const isStale =
                      new Date(location.recorded_at) < new Date(Date.now() - 5 * 60 * 1000);
                    return (
                      <button
                        type="button"
                        key={location.id}
                        onClick={() => setSelectedDriverId(location.driver_id)}
                        className="w-full text-left p-3 bg-[#0F0F0F] rounded-lg border border-gray-800 hover:border-[#FF6B35] transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">
                              {driver?.name || driver?.full_name || 'Unknown'}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{driver?.email}</p>
                          </div>
                          <Badge className="ml-2 flex-shrink-0 bg-green-950 text-green-400 border-green-900 text-xs">
                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1 animate-pulse" />
                            {online ? 'Online' : 'Offline'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <MapPin className="w-3 h-3 text-[#FF6B35] flex-shrink-0" />
                          <span>
                            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                          </span>
                          {isStale && (
                            <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-[10px]">
                              Stale
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
