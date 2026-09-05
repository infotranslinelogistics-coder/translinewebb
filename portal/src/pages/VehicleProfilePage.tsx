import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, Loader, Truck, MapPin, Navigation, Clock, Activity, TrendingUp, Wrench, Gauge,
} from 'lucide-react';
import {
  formatDistanceToNowStrict, differenceInMinutes, startOfWeek, endOfWeek,
} from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { supabase } from '@/lib/supabase';
import { listLatestLocationsByDrivers } from '@/lib/db/locations';
import { formatPerthDateTime } from '@/lib/dateTime';

/* ─── types ─── */
interface VehicleRow {
  id: string; rego: string; make: string | null; model: string | null;
  status: string | null; year?: number | null; colour?: string | null;
  vin?: string | null; engine_type?: string | null; created_at: string | null;
  last_inspection_date?: string | null;
}
interface ShiftRow {
  id: string; driver_id?: string | null; driver_name: string | null; started_at: string | null;
  ended_at: string | null; status: string | null;
}
interface OdometerRow {
  id: string; reading: number | null; captured_at: string | null;
  driver_id: string | null; driver_name?: string | null; photo_path?: string | null;
  lat?: number | null; lng?: number | null;
}
interface MaintenanceRow {
  id: string; service_type: string; service_date: string; odometer?: number | null;
  cost?: number | null; provider?: string | null; notes?: string | null;
  status: string;
}
interface DriverStatusRow {
  driver_id: string; lat: number | null; lng: number | null;
  speed_kmh: number | null; heading: number | null; last_location_at: string | null;
}

interface DriverLocationRow {
  driver_id: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

const PAGE_SIZE = 10;

function fmtDate(d: string | null | undefined) {
  return formatPerthDateTime(d);
}
function statusBadge(s: string | null | undefined) {
  if (s === 'active') return 'bg-blue-950 text-blue-300 border-blue-800';
  if (s === 'completed') return 'bg-green-950 text-green-400 border-green-900';
  if (s === 'cancelled') return 'bg-red-950 text-red-400 border-red-900';
  return 'bg-gray-800 text-gray-400 border-[#C4C0B7]';
}
function vehicleStatusBadge(s: string | null | undefined) {
  if (s === 'active') return 'bg-green-950 text-green-400 border-green-900';
  if (s === 'maintenance') return 'bg-yellow-950 text-yellow-400 border-yellow-900';
  return 'bg-gray-800 text-gray-400 border-[#C4C0B7]';
}
function maintStatusBadge(s: string) {
  if (s === 'completed') return 'bg-green-950 text-green-400 border-green-900';
  if (s === 'pending') return 'bg-yellow-950 text-yellow-400 border-yellow-900';
  if (s === 'cancelled') return 'bg-red-950 text-red-400 border-red-900';
  return 'bg-gray-800 text-gray-400 border-[#C4C0B7]';
}

export function VehicleProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const gpsMapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);

  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [driverStatus, setDriverStatus] = useState<DriverStatusRow | null>(null);
  const [latestLocation, setLatestLocation] = useState<DriverLocationRow | null>(null);
  const [latestOdo, setLatestOdo] = useState<OdometerRow | null>(null);
  const [firstOdo, setFirstOdo] = useState<OdometerRow | null>(null);
  const [weeklyShifts, setWeeklyShifts] = useState<ShiftRow[]>([]);
  const [activeShift, setActiveShift] = useState<ShiftRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shiftPage, setShiftPage] = useState(1);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [shiftCount, setShiftCount] = useState(0);

  const [odoPage, setOdoPage] = useState(1);
  const [odoLogs, setOdoLogs] = useState<OdometerRow[]>([]);
  const [odoCount, setOdoCount] = useState(0);

  const [maintPage, setMaintPage] = useState(1);
  const [maintLogs, setMaintLogs] = useState<MaintenanceRow[]>([]);
  const [maintCount, setMaintCount] = useState(0);

  const enrichShiftDrivers = async (rows: ShiftRow[]): Promise<ShiftRow[]> => {
    const missingIds = [
      ...new Set(rows.filter((row) => !row.driver_name && row.driver_id).map((row) => row.driver_id as string)),
    ];

    if (missingIds.length === 0) return rows;

    const { data: drivers, error: driverError } = await supabase
      .from('drivers')
      .select('id, full_name')
      .in('id', missingIds);

    if (driverError) {
      console.error(driverError);
      return rows;
    }

    const driverMap = new Map((drivers ?? []).map((driver) => [driver.id, driver.full_name]));

    return rows.map((row) => ({
      ...row,
      driver_name: row.driver_name || (row.driver_id ? driverMap.get(row.driver_id) ?? row.driver_id : null),
    }));
  };

  /* weekly stats */
  const { hoursThisWeek, shiftsThisWeek, avgShiftHours } = useMemo(() => {
    if (!weeklyShifts.length) return { hoursThisWeek: 0, shiftsThisWeek: 0, avgShiftHours: 0 };
    const wkStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const now = new Date();
    let totalMins = 0; let count = 0;
    for (const s of weeklyShifts) {
      const start = new Date(s.started_at!) < wkStart ? wkStart : new Date(s.started_at!);
      const end = s.ended_at ? (new Date(s.ended_at) > now ? now : new Date(s.ended_at)) : now;
      const mins = differenceInMinutes(end, start);
      if (mins > 0) { totalMins += mins; count++; }
    }
    return { hoursThisWeek: totalMins / 60, shiftsThisWeek: count, avgShiftHours: count > 0 ? totalMins / 60 / count : 0 };
  }, [weeklyShifts]);

  const totalKm = useMemo(() => {
    if (!latestOdo?.reading || !firstOdo?.reading) return null;
    const diff = latestOdo.reading - firstOdo.reading;
    return diff > 0 ? diff : null;
  }, [latestOdo, firstOdo]);

  /* base load */
  useEffect(() => {
    if (!id) { setError('Vehicle ID missing'); setLoading(false); return; }
    const load = async () => {
      try {
        setLoading(true);
        const wkStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
        const wkEnd   = endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
        const [vRes, assignRes, latestOdoRes, firstOdoRes, weeklyRes, activeRes] = await Promise.all([
          supabase.from('vehicles').select('id, rego, make, model, status, created_at').eq('id', id).maybeSingle(),
          supabase.from('vehicles_with_driver').select('driver_id, driver_name').eq('vehicle_id', id).maybeSingle(),
          supabase.from('odometer_readings_feed').select('id, reading, captured_at, driver_id, photo_path, lat, lng').eq('vehicle_id', id).order('captured_at', { ascending: false }).limit(1),
          supabase.from('odometer_readings_feed').select('id, reading, captured_at, driver_id').eq('vehicle_id', id).order('captured_at', { ascending: true }).limit(1),
          supabase.from('shifts_full').select('id, driver_id, driver_name, started_at, ended_at, status').eq('vehicle_id', id).lte('started_at', wkEnd).or(`ended_at.gte.${wkStart},ended_at.is.null`),
          supabase.from('shifts_full').select('id, driver_id, driver_name, started_at, ended_at, status').eq('vehicle_id', id).or('status.eq.active,ended_at.is.null').order('started_at', { ascending: false }).limit(1),
        ]);
        if (vRes.error) throw vRes.error;
        if (assignRes.error) throw assignRes.error;
        if (latestOdoRes.error) throw latestOdoRes.error;
        if (firstOdoRes.error) throw firstOdoRes.error;
        if (weeklyRes.error) throw weeklyRes.error;
        if (activeRes.error) throw activeRes.error;

        if (!vRes.data) { setError('Vehicle not found'); return; }
        setVehicle({
          ...(vRes.data as VehicleRow),
          year: null,
          colour: null,
          vin: null,
          engine_type: null,
          last_inspection_date: null,
        });
        const assign = assignRes.data as any;
        setDriverName(assign?.driver_name ?? null);
        setDriverId(assign?.driver_id ?? null);
        setLatestOdo((latestOdoRes.data as OdometerRow[])?.[0] ?? null);
        setFirstOdo((firstOdoRes.data as OdometerRow[])?.[0] ?? null);
        const enrichedWeeklyShifts = await enrichShiftDrivers((weeklyRes.data as ShiftRow[]) ?? []);
        const enrichedActiveShifts = await enrichShiftDrivers((activeRes.data as ShiftRow[]) ?? []);
        setWeeklyShifts(enrichedWeeklyShifts);
        setActiveShift(enrichedActiveShifts[0] ?? null);
        // fetch driver GPS if assigned
        if (assign?.driver_id) {
          const [{ data: dsData }, locationRows] = await Promise.all([
            supabase.from('view_driver_current_status').select('driver_id, lat, lng, speed_kmh, heading, last_location_at').eq('driver_id', assign.driver_id).maybeSingle(),
            listLatestLocationsByDrivers([assign.driver_id]),
          ]);
          setDriverStatus((dsData as DriverStatusRow) ?? null);
          setLatestLocation((locationRows?.[0] as DriverLocationRow) ?? null);
        } else {
          setLatestLocation(null);
        }
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Failed to load vehicle');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  /* paginated shifts */
  useEffect(() => {
    if (!id) return;
    const run = async () => {
      const from = (shiftPage - 1) * PAGE_SIZE;
      const { data, error: e, count } = await supabase.from('shifts_full').select('id, driver_id, driver_name, started_at, ended_at, status', { count: 'exact' }).eq('vehicle_id', id).order('started_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
      if (e) { console.error(e); return; }
      setShifts(await enrichShiftDrivers((data as ShiftRow[]) ?? [])); setShiftCount(count ?? 0);
    };
    run();
  }, [id, shiftPage]);

  /* paginated odometer */
  useEffect(() => {
    if (!id) return;
    const run = async () => {
      const from = (odoPage - 1) * PAGE_SIZE;
      const { data, error: e, count } = await supabase.from('odometer_readings_feed').select('id, reading, captured_at, driver_id, photo_path, lat, lng', { count: 'exact' }).eq('vehicle_id', id).order('captured_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
      if (e) { console.error(e); return; }
      setOdoLogs((data as OdometerRow[]) ?? []); setOdoCount(count ?? 0);
    };
    run();
  }, [id, odoPage]);

  /* paginated maintenance */
  useEffect(() => {
    if (!id) return;
    const run = async () => {
      const from = (maintPage - 1) * PAGE_SIZE;
      const { data, error: e, count } = await supabase.from('maintenance_items').select('id, service_type, service_date, odometer, cost, provider, notes, status', { count: 'exact' }).eq('vehicle_id', id).order('service_date', { ascending: false }).range(from, from + PAGE_SIZE - 1);
      if (e) { console.error(e); return; }
      setMaintLogs((data as MaintenanceRow[]) ?? []); setMaintCount(count ?? 0);
    };
    run();
  }, [id, maintPage]);

  /* GPS map */
  useEffect(() => {
    if (!gpsMapRef.current || latestLocation?.latitude == null || latestLocation?.longitude == null) return;
    let cancelled = false;
    const init = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !gpsMapRef.current) return;
      if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; }
      const map = L.map(gpsMapRef.current, { zoomControl: true, attributionControl: false });
      leafletMapRef.current = map;
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19 }).addTo(map);
      const lat = latestLocation.latitude;
      const lng = latestLocation.longitude;
      map.setView([lat, lng], 15);
      const heading = driverStatus?.heading ?? 0;
      const icon = L.divIcon({
        html: `<div style="width:36px;height:36px;background:#BE1C2D;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 0 12px rgba(190,28,45,0.45);transform:rotate(${heading}deg)"><svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M12 2L4 20l8-4 8 4L12 2z"/></svg></div>`,
        className: '', iconSize: [36, 36], iconAnchor: [18, 18],
      });
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      const updated = latestLocation.created_at ? formatDistanceToNowStrict(new Date(latestLocation.created_at), { addSuffix: true }) : '';
      marker.bindPopup(`<b>${driverName ?? 'Driver'}</b><br/>${updated}`);
    };
    init();
    return () => { cancelled = true; if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; } };
  }, [latestLocation?.latitude, latestLocation?.longitude, latestLocation?.created_at, driverStatus?.heading, driverName]);

  /* realtime GPS */
  useEffect(() => {
    if (!driverId) return;
    const ch = supabase.channel(`vehicle-gps-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'view_driver_current_status', filter: `driver_id=eq.${driverId}` },
        (payload) => {
          setDriverStatus((prev) => ({ ...(prev ?? {} as DriverStatusRow), ...(payload.new as DriverStatusRow) }));
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` },
        (payload) => {
          const loc = payload.new as DriverLocationRow;
          setLatestLocation(loc);
          if (leafletMapRef.current && loc.latitude != null && loc.longitude != null) {
            leafletMapRef.current.panTo([loc.latitude, loc.longitude]);
          }
        })
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [driverId, id]);

  if (loading) return <div className="flex justify-center py-16"><Loader className="w-8 h-8 text-[#BE1C2D] animate-spin" /></div>;
  if (error || !vehicle) return <Card className="bg-red-950 border-red-900"><CardContent className="p-4 text-red-400">{error ?? 'Vehicle not found'}</CardContent></Card>;

  const gpsActive = latestLocation?.created_at
    ? new Date(latestLocation.created_at) > new Date(Date.now() - 5 * 60 * 1000) : false;
  const totalShiftPages = Math.max(1, Math.ceil(shiftCount / PAGE_SIZE));
  const totalOdoPages   = Math.max(1, Math.ceil(odoCount / PAGE_SIZE));
  const totalMaintPages = Math.max(1, Math.ceil(maintCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">
            {vehicle.rego}
            {(vehicle.make || vehicle.model) && (
              <span className="ml-3 text-xl font-normal text-gray-400">
                {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}
              </span>
            )}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <Badge className={`capitalize ${vehicleStatusBadge(vehicle.status)}`}>{vehicle.status ?? 'unknown'}</Badge>
            {driverName
              ? <span className="text-sm text-gray-400">Assigned to <button className="text-[#BE1C2D] hover:underline" onClick={() => driverId && navigate(`/drivers/${driverId}`)}>{driverName}</button></span>
              : <span className="text-sm text-gray-500">Unassigned</span>}
            {activeShift && <Badge className="bg-blue-950 text-blue-300 border-blue-800">Active Shift</Badge>}
            {gpsActive && <Badge className="bg-purple-950 text-purple-300 border-purple-800 flex items-center gap-1"><Navigation className="w-3 h-3" />GPS Active</Badge>}
          </div>
        </div>
        <Button variant="default" className="bg-[#BE1C2D] text-white hover:bg-[#e55a25] shrink-0" onClick={() => navigate('/vehicles')}>
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Vehicles
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Current Odometer', value: latestOdo?.reading != null ? `${latestOdo.reading.toLocaleString()} km` : '—', icon: Gauge,      color: 'text-[#BE1C2D]'  },
          { label: 'Total KM Logged',  value: totalKm != null ? `${totalKm.toLocaleString()} km` : '—',                     icon: TrendingUp, color: 'text-green-400'  },
          { label: 'Hours This Week',  value: `${hoursThisWeek.toFixed(1)}h`,                                                icon: Clock,      color: 'text-blue-400'   },
          { label: 'Shifts This Week', value: String(shiftsThisWeek),                                                        icon: Activity,   color: 'text-purple-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-[#FFFEFA] border-[#D7D3CA]">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-8 h-8 ${color} shrink-0`} />
              <div><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-semibold text-white">{value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-[#FFFEFA] border border-[#D7D3CA]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="odometer">Odometer</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Vehicle details */}
            <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><Truck className="w-4 h-4 text-[#BE1C2D]" />Vehicle Details</CardTitle>
                <CardDescription className="text-gray-400">ID: {vehicle.id}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="grid grid-cols-2 gap-y-2">
                  {([
                    ['Registration', vehicle.rego],
                    ['Make',         vehicle.make ?? '—'],
                    ['Model',        vehicle.model ?? '—'],
                    ['Status',       vehicle.status ?? '—'],
                    ['Last inspection', fmtDate(vehicle.last_inspection_date)],
                    ['Added',        fmtDate(vehicle.created_at)],
                    ['Current driver', driverName ?? 'Unassigned'],
                    ['Latest odometer', latestOdo?.reading != null ? `${latestOdo.reading.toLocaleString()} km` : '—'],
                    ['Last odo reading', fmtDate(latestOdo?.captured_at)],
                    ['Avg shift this week', weeklyShifts.length ? `${avgShiftHours.toFixed(1)}h` : '—'],
                  ] as [string, string][]).map(([label, value]) => (
                    <React.Fragment key={label}>
                      <span className="text-gray-500">{label}</span>
                      <span className="text-gray-200 text-right">{value}</span>
                    </React.Fragment>
                  ))}
                </div>
                {activeShift && (
                  <Button variant="default" size="sm" className="mt-4 bg-[#BE1C2D] text-white hover:bg-[#e55a25]" onClick={() => navigate(`/shifts/${activeShift.id}`)}>
                    View Active Shift Details
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Live GPS */}
            <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-[#BE1C2D]" />Live GPS
                  {gpsActive && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block ml-1" />}
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {latestLocation?.latitude != null && latestLocation?.longitude != null
                    ? `${latestLocation.latitude.toFixed(5)}, ${latestLocation.longitude.toFixed(5)} · updated ${latestLocation.created_at ? formatDistanceToNowStrict(new Date(latestLocation.created_at), { addSuffix: true }) : 'N/A'}`
                    : driverName ? 'No location data for current driver' : 'No driver assigned'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {latestLocation?.latitude != null && latestLocation?.longitude != null ? (
                  <>
                    <div ref={gpsMapRef} className="w-full rounded-b-lg" style={{ height: 280 }} />
                    <div className="px-4 py-2 flex gap-2">
                      <Button asChild size="sm" className="bg-[#BE1C2D] text-white hover:bg-[#e55a25] text-xs">
                        <a href={`https://www.google.com/maps?q=${latestLocation.latitude},${latestLocation.longitude}`} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
                      </Button>
                      {driverId && (
                        <Button size="sm" className="bg-[#BE1C2D] text-white hover:bg-[#e55a25] text-xs" onClick={() => navigate(`/drivers/${driverId}`)}>
                          Driver Profile
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                    <MapPin className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm">{driverName ? 'No GPS location available' : 'Assign a driver to track GPS'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Shifts ── */}
        <TabsContent value="shifts">
          <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
            <CardHeader>
              <CardTitle className="text-white">Shift History</CardTitle>
              <CardDescription className="text-gray-400">{shiftCount} total shifts</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#D7D3CA] hover:bg-transparent">
                    <TableHead className="text-gray-400">Driver</TableHead>
                    <TableHead className="text-gray-400">Start</TableHead>
                    <TableHead className="text-gray-400">End</TableHead>
                    <TableHead className="text-gray-400">Duration</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-gray-500">No shifts found.</TableCell></TableRow>
                  ) : shifts.map((s) => {
                    const mins = differenceInMinutes(s.ended_at ? new Date(s.ended_at) : new Date(), new Date(s.started_at!));
                    const dur = mins >= 60 ? `${(mins / 60).toFixed(1)}h` : `${mins}m`;
                    return (
                      <TableRow key={s.id} className="border-[#D7D3CA]">
                        <TableCell className="text-gray-300">{s.driver_name ?? '—'}</TableCell>
                        <TableCell className="text-gray-300">{fmtDate(s.started_at)}</TableCell>
                        <TableCell className="text-gray-300">{s.ended_at ? fmtDate(s.ended_at) : <Badge className="bg-blue-950 text-blue-300 border-blue-800">Active</Badge>}</TableCell>
                        <TableCell className="text-gray-300">{dur}</TableCell>
                        <TableCell><Badge className={`capitalize text-xs ${statusBadge(s.status)}`}>{s.status}</Badge></TableCell>
                        <TableCell><Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 h-7 px-2 text-xs" onClick={() => navigate(`/shifts/${s.id}`)}>View</Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">Page {shiftPage} of {totalShiftPages}</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-gray-300" disabled={shiftPage === 1} onClick={() => setShiftPage((p) => Math.max(1, p - 1))}>Previous</Button>
                  <Button variant="ghost" size="sm" className="text-gray-300" disabled={shiftPage >= totalShiftPages} onClick={() => setShiftPage((p) => Math.min(totalShiftPages, p + 1))}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Odometer ── */}
        <TabsContent value="odometer">
          <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Gauge className="w-4 h-4 text-[#BE1C2D]" />Odometer Log</CardTitle>
              <CardDescription className="text-gray-400">
                {latestOdo?.reading != null && firstOdo?.reading != null
                  ? `Current: ${latestOdo.reading.toLocaleString()} km · First recorded: ${firstOdo.reading.toLocaleString()} km · ${totalKm != null ? `${totalKm.toLocaleString()} km logged` : ''}`
                  : `${odoCount} readings`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#D7D3CA] hover:bg-transparent">
                    <TableHead className="text-gray-400">Captured</TableHead>
                    <TableHead className="text-gray-400">Reading</TableHead>
                    <TableHead className="text-gray-400">Change</TableHead>
                    <TableHead className="text-gray-400">Driver</TableHead>
                    <TableHead className="text-gray-400">Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {odoLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-500">No odometer records found.</TableCell></TableRow>
                  ) : odoLogs.map((log, idx) => {
                    const next = odoLogs[idx + 1];
                    const change = next?.reading != null && log.reading != null ? log.reading - next.reading : null;
                    return (
                      <TableRow key={log.id} className="border-[#D7D3CA]">
                        <TableCell className="text-gray-300">{fmtDate(log.captured_at)}</TableCell>
                        <TableCell className="text-gray-200 font-medium">{log.reading != null ? `${log.reading.toLocaleString()} km` : '—'}</TableCell>
                        <TableCell className="text-gray-400 text-xs">{change != null ? `+${change.toLocaleString()} km` : '—'}</TableCell>
                        <TableCell className="text-gray-300">{log.driver_id ? <button className="text-[#BE1C2D] hover:underline text-xs" onClick={() => navigate(`/drivers/${log.driver_id}`)}>{log.driver_id.slice(0, 8)}…</button> : '—'}</TableCell>
                        <TableCell className="text-gray-300 text-xs">{log.lat != null && log.lng != null ? `${log.lat.toFixed(4)}, ${log.lng.toFixed(4)}` : '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">Page {odoPage} of {totalOdoPages}</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-gray-300" disabled={odoPage === 1} onClick={() => setOdoPage((p) => Math.max(1, p - 1))}>Previous</Button>
                  <Button variant="ghost" size="sm" className="text-gray-300" disabled={odoPage >= totalOdoPages} onClick={() => setOdoPage((p) => Math.min(totalOdoPages, p + 1))}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Maintenance ── */}
        <TabsContent value="maintenance">
          <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Wrench className="w-4 h-4 text-[#BE1C2D]" />Maintenance Log</CardTitle>
              <CardDescription className="text-gray-400">{maintCount} records</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#D7D3CA] hover:bg-transparent">
                    <TableHead className="text-gray-400">Date</TableHead>
                    <TableHead className="text-gray-400">Service</TableHead>
                    <TableHead className="text-gray-400">Odometer</TableHead>
                    <TableHead className="text-gray-400">Provider</TableHead>
                    <TableHead className="text-gray-400">Cost</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-gray-500">No maintenance records found.</TableCell></TableRow>
                  ) : maintLogs.map((m) => (
                    <TableRow key={m.id} className="border-[#D7D3CA]">
                      <TableCell className="text-gray-300">{fmtDate(m.service_date)}</TableCell>
                      <TableCell className="text-gray-200">{m.service_type}</TableCell>
                      <TableCell className="text-gray-300">{m.odometer != null ? `${m.odometer.toLocaleString()} km` : '—'}</TableCell>
                      <TableCell className="text-gray-300">{m.provider ?? '—'}</TableCell>
                      <TableCell className="text-gray-300">{m.cost != null ? `$${m.cost.toLocaleString()}` : '—'}</TableCell>
                      <TableCell><Badge className={`capitalize text-xs ${maintStatusBadge(m.status)}`}>{m.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">Page {maintPage} of {totalMaintPages}</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-gray-300" disabled={maintPage === 1} onClick={() => setMaintPage((p) => Math.max(1, p - 1))}>Previous</Button>
                  <Button variant="ghost" size="sm" className="text-gray-300" disabled={maintPage >= totalMaintPages} onClick={() => setMaintPage((p) => Math.min(totalMaintPages, p + 1))}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
