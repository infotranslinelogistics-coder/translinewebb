import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import {
  ArrowLeft, Loader, MapPin, Clock, TrendingUp, Activity, Navigation, PhoneCall, Mail,
} from 'lucide-react';
import {
  formatDistanceToNowStrict, differenceInMinutes, startOfWeek, endOfWeek,
} from 'date-fns';
import { supabase } from '@/lib/supabase';
import { listLatestLocationsByDrivers } from '@/lib/db/locations';
import { listVehicles, Vehicle } from '@/lib/db/vehicles';
import { clearOdometerPhotoCache, getOdometerPhotoUrl } from '@/lib/storage/odometerPhotos';
import { formatPerthDateTime } from '@/lib/dateTime';

/* ─── types ─── */
interface DriverStatusRow {
  driver_id: string; last_seen_at: string | null; is_online: boolean | null;
  status_state: string | null; on_break: boolean | null; status_started_at: string | null;
  last_location_at: string | null; lat: number | null; lng: number | null;
  speed_kmh: number | null; heading: number | null; vehicle_id: string | null; shift_id: string | null;
}
interface ShiftRow {
  id: string; driver_id: string; vehicle_id: string | null;
  started_at: string; ended_at: string | null; status: 'active' | 'ended' | 'completed' | 'cancelled';
}
interface AssignmentRow {
  id: string; driver_id: string; vehicle_id: string; assigned_at: string; unassigned_at: string | null;
}
interface OdometerRow {
  id: string; driver_id: string; vehicle_id: string; shift_id: string | null; reading: number | null;
  photo_path?: string | null; captured_at?: string | null; created_at?: string | null;
  lat?: number | null; lng?: number | null; signed_url?: string | null; photo_error?: string | null;
}
interface DriverRow {
  driver_id?: string; id?: string; full_name?: string; name?: string; email?: string;
  profile_email?: string; phone?: string; profile_phone?: string; phone_number?: string;
  mobile_number?: string; contact_number?: string; status?: string; licence_number?: string;
}
interface DriverAssignmentSnapshot {
  current_vehicle_id: string | null; current_vehicle_rego: string | null;
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

function pickFirstText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function statusBadge(s: string | null | undefined) {
  if (s === 'active') return 'bg-blue-950 text-blue-300 border-blue-800';
  if (s === 'completed') return 'bg-green-950 text-green-400 border-green-900';
  if (s === 'cancelled') return 'bg-red-950 text-red-400 border-red-900';
  return 'bg-gray-800 text-gray-400 border-gray-700';
}

export function DriverProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const driverId = id ?? '';
  const gpsMapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);

  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [status, setStatus] = useState<DriverStatusRow | null>(null);
  const [assignmentSnapshot, setAssignmentSnapshot] = useState<DriverAssignmentSnapshot | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeShift, setActiveShift] = useState<ShiftRow | null>(null);
  const [latestOdometer, setLatestOdometer] = useState<OdometerRow | null>(null);
  const [weeklyShifts, setWeeklyShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shiftPage, setShiftPage] = useState(1);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [odometerPage, setOdometerPage] = useState(1);
  const [statusPage, setStatusPage] = useState(1);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [shiftCount, setShiftCount] = useState(0);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [odometerLogs, setOdometerLogs] = useState<OdometerRow[]>([]);
  const [odometerCount, setOdometerCount] = useState(0);
  const [statusEvents, setStatusEvents] = useState<any[]>([]);
  const [statusCount, setStatusCount] = useState(0);
  const [breakCounts, setBreakCounts] = useState<Record<string, number>>({});
  const [latestLocation, setLatestLocation] = useState<DriverLocationRow | null>(null);

  const vehicleMap = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach((v) => map.set(v.id, v));
    return map;
  }, [vehicles]);

  const { hoursThisWeek, avgShiftHours } = useMemo(() => {
    if (!weeklyShifts.length) return { hoursThisWeek: 0, avgShiftHours: 0 };
    const wkStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const wkEnd   = new Date(); // cap at now, not future
    let totalMins = 0;
    let countWithHours = 0;
    for (const s of weeklyShifts) {
      // clamp to week window
      const start = new Date(s.started_at) < wkStart ? wkStart : new Date(s.started_at);
      const end   = s.ended_at ? (new Date(s.ended_at) > wkEnd ? wkEnd : new Date(s.ended_at)) : wkEnd;
      const mins  = differenceInMinutes(end, start);
      if (mins > 0) { totalMins += mins; countWithHours++; }
    }
    return { hoursThisWeek: totalMins / 60, avgShiftHours: countWithHours > 0 ? totalMins / 60 / countWithHours : 0 };
  }, [weeklyShifts]);

  const resolveOdometerPhoto = async (row: OdometerRow) => {
    const { url, error: pErr } = await getOdometerPhotoUrl({ photoPath: row.photo_path });
    return { ...row, signed_url: url, photo_error: pErr };
  };

  useEffect(() => {
    if (!driverId) return;
    const fetchBase = async () => {
      try {
        setLoading(true);
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
        const weekEnd   = endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
        const [driverRes, contactRes, statusRes, assignRes, vehicleList, activeShiftRes, latestOdoRes, weeklyRes, locationRows] =
          await Promise.all([
            supabase.from('drivers_full').select('*').eq('driver_id', driverId).maybeSingle(),
            supabase.from('drivers').select('profiles!drivers_user_id_fkey ( email, phone )').eq('id', driverId).maybeSingle(),
            supabase.from('view_driver_current_status').select('*').eq('driver_id', driverId).maybeSingle(),
            supabase.from('drivers_with_current_vehicle').select('current_vehicle_id, current_vehicle_rego').eq('driver_id', driverId).maybeSingle(),
            listVehicles(),
            supabase.from('shifts').select('*').eq('driver_id', driverId).or('status.eq.active,ended_at.is.null').order('started_at', { ascending: false }).limit(1),
            supabase.from('odometer_readings').select('id, driver_id, vehicle_id, shift_id, reading, photo_path, captured_at, created_at, lat, lng').eq('driver_id', driverId).order('captured_at', { ascending: false }).limit(1),
            // Fetch all shifts that OVERLAP this week (started before weekEnd AND (ended after weekStart OR still active))
            supabase.from('shifts').select('id, driver_id, vehicle_id, started_at, ended_at, status').eq('driver_id', driverId).lte('started_at', weekEnd).or(`ended_at.gte.${weekStart},ended_at.is.null`),
            listLatestLocationsByDrivers([driverId]),
          ]);
        const contact = (contactRes.data as { profiles?: { email?: string | null; phone?: string | null } | null } | null)?.profiles;
        setDriver(driverRes.data ? { ...(driverRes.data as DriverRow), email: contact?.email ?? (driverRes.data as DriverRow).email, phone: contact?.phone ?? (driverRes.data as DriverRow).phone } : null);
        setStatus((statusRes.data as DriverStatusRow) ?? null);
        setAssignmentSnapshot((assignRes.data as DriverAssignmentSnapshot) ?? null);
        setVehicles(vehicleList ?? []);
        setActiveShift((activeShiftRes.data as ShiftRow[])?.[0] ?? null);
        setWeeklyShifts((weeklyRes.data as ShiftRow[]) ?? []);
        setLatestLocation((locationRows?.[0] as DriverLocationRow) ?? null);
        const latest = (latestOdoRes.data as OdometerRow[])?.[0] ?? null;
        setLatestOdometer(latest ? await resolveOdometerPhoto(latest) : null);
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Failed to load driver profile');
      } finally {
        setLoading(false);
      }
    };
    fetchBase();
  }, [driverId]);

  useEffect(() => {
    if (!driverId) return;
    const run = async () => {
      const from = (shiftPage - 1) * PAGE_SIZE;
      const { data, error: e, count } = await supabase.from('shifts').select('*', { count: 'exact' }).eq('driver_id', driverId).order('started_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
      if (e) { console.error(e); return; }
      const rows = (data as ShiftRow[]) ?? [];
      setShifts(rows); setShiftCount(count ?? 0);
      if (rows.length) {
        const { data: bd } = await supabase.from('driver_status_events').select('shift_id').in('shift_id', rows.map((r) => r.id)).eq('state', 'break');
        const counts: Record<string, number> = {};
        (bd ?? []).forEach((r: any) => { counts[r.shift_id] = (counts[r.shift_id] ?? 0) + 1; });
        setBreakCounts(counts);
      }
    };
    run();
  }, [driverId, shiftPage]);

  useEffect(() => {
    if (!driverId) return;
    const run = async () => {
      const from = (assignmentPage - 1) * PAGE_SIZE;
      const { data, error: e, count } = await supabase.from('vehicle_assignments').select('*', { count: 'exact' }).eq('driver_id', driverId).order('assigned_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
      if (e) { console.error(e); return; }
      setAssignments((data as AssignmentRow[]) ?? []); setAssignmentCount(count ?? 0);
    };
    run();
  }, [driverId, assignmentPage]);

  useEffect(() => {
    if (!driverId) return;
    const run = async () => {
      const from = (odometerPage - 1) * PAGE_SIZE;
      const { data, error: e, count } = await supabase.from('odometer_readings').select('id, driver_id, vehicle_id, shift_id, reading, photo_path, captured_at, created_at, lat, lng', { count: 'exact' }).eq('driver_id', driverId).order('captured_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
      if (e) { console.error(e); return; }
      setOdometerLogs(await Promise.all(((data as OdometerRow[]) ?? []).map(resolveOdometerPhoto)));
      setOdometerCount(count ?? 0);
    };
    run();
  }, [driverId, odometerPage]);

  useEffect(() => {
    if (!driverId) return;
    const run = async () => {
      const from = (statusPage - 1) * PAGE_SIZE;
      const { data, error: e, count } = await supabase.from('driver_status_events').select('*', { count: 'exact' }).eq('driver_id', driverId).order('started_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
      if (e) { console.error(e); return; }
      setStatusEvents(data ?? []); setStatusCount(count ?? 0);
    };
    run();
  }, [driverId, statusPage]);

  /* live GPS Leaflet map */
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
      const lat = latestLocation.latitude; const lng = latestLocation.longitude;
      map.setView([lat, lng], 15);
      const heading = status?.heading ?? 0;
      const icon = L.divIcon({
        html: `<div style="width:36px;height:36px;background:#FF6B35;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 0 12px rgba(255,107,53,0.6);transform:rotate(${heading}deg)"><svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M12 2L4 20l8-4 8 4L12 2z"/></svg></div>`,
        className: '', iconSize: [36, 36], iconAnchor: [18, 18],
      });
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      const updated = latestLocation.created_at ? formatDistanceToNowStrict(new Date(latestLocation.created_at), { addSuffix: true }) : '';
      marker.bindPopup(`<b>Driver Location</b><br/>${updated}`);
    };
    init();
    return () => { cancelled = true; if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; } };
  }, [latestLocation?.latitude, latestLocation?.longitude, latestLocation?.created_at, status?.heading, status?.speed_kmh]);

  /* realtime GPS ping */
  useEffect(() => {
    if (!driverId) return;
    const channel = supabase.channel(`driver-gps-${driverId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'view_driver_current_status', filter: `driver_id=eq.${driverId}` },
        (payload) => {
          setStatus((prev) => ({ ...(prev ?? {} as DriverStatusRow), ...(payload.new as DriverStatusRow) }));
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
    return () => { channel.unsubscribe(); };
  }, [driverId]);

  if (!driverId) return <p className="text-gray-400">Driver ID missing.</p>;
  if (loading) return <div className="flex justify-center py-16"><Loader className="w-8 h-8 text-[#FF6B35] animate-spin" /></div>;

  const driverName = driver?.full_name ?? driver?.name ?? driver?.email ?? driverId;
  const driverEmail = pickFirstText(driver?.email, driver?.profile_email);
  const driverPhone = pickFirstText(
    driver?.phone,
    driver?.profile_phone,
    driver?.phone_number,
    driver?.mobile_number,
    driver?.contact_number
  );
  const assignedVehicle = assignmentSnapshot?.current_vehicle_id ? vehicleMap.get(assignmentSnapshot.current_vehicle_id) : null;
  const telemetryVehicle = status?.vehicle_id ? vehicleMap.get(status.vehicle_id) : null;
  const formatVehicleLabel = (v?: Vehicle | null) => {
    if (!v) return null;
    const mm = [v.make, v.model].filter(Boolean).join(' ');
    return mm ? `${v.rego} • ${mm}` : v.rego;
  };
  const gpsActive = latestLocation?.created_at ? new Date(latestLocation.created_at) > new Date(Date.now() - 5 * 60 * 1000) : false;
  const lastSeenLabel = latestLocation?.created_at
    ? formatDistanceToNowStrict(new Date(latestLocation.created_at), { addSuffix: true })
    : (status?.last_seen_at ? formatDistanceToNowStrict(new Date(status.last_seen_at), { addSuffix: true }) : 'Never');
  const isOnline = latestLocation?.created_at
    ? new Date(latestLocation.created_at) > new Date(Date.now() - 60 * 1000)
    : (status?.last_seen_at ? new Date(status.last_seen_at) > new Date(Date.now() - 60 * 1000) : Boolean(status?.is_online));

  const totalShiftPages      = Math.max(1, Math.ceil(shiftCount / PAGE_SIZE));
  const totalAssignmentPages = Math.max(1, Math.ceil(assignmentCount / PAGE_SIZE));
  const totalOdometerPages   = Math.max(1, Math.ceil(odometerCount / PAGE_SIZE));
  const totalStatusPages     = Math.max(1, Math.ceil(statusCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {error && <Card className="bg-red-950 border-red-900"><CardContent className="p-4 text-red-400">{error}</CardContent></Card>}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">{driverName}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
            {driverEmail && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{driverEmail}</span>}
            {driverPhone && <span className="flex items-center gap-1"><PhoneCall className="w-3.5 h-3.5" />{driverPhone}</span>}
            {driver?.licence_number && <span className="text-gray-500">Licence: {driver.licence_number}</span>}
          </div>
        </div>
        <Button variant="default" className="bg-[#FF6B35] text-white hover:bg-[#e55a25] shrink-0" onClick={() => navigate('/drivers')}>
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Drivers
        </Button>
      </div>

      {/* Status strip */}
      <div className="flex flex-wrap gap-2">
        {isOnline ? <Badge className="bg-green-950 text-green-400 border-green-900">Online</Badge> : <Badge className="bg-gray-900 text-gray-400 border-gray-700">Offline</Badge>}
        {activeShift ? <Badge className="bg-blue-950 text-blue-300 border-blue-800">On Shift</Badge> : <Badge className="bg-gray-900 text-gray-400 border-gray-700">Off Shift</Badge>}
        {status?.on_break && <Badge className="bg-amber-950 text-amber-300 border-amber-800">On Break</Badge>}
        {gpsActive && <Badge className="bg-purple-950 text-purple-300 border-purple-800 flex items-center gap-1"><Navigation className="w-3 h-3" />GPS Active</Badge>}
        {driver?.status && <Badge className="bg-gray-900 text-gray-300 border-gray-700 capitalize">{driver.status}</Badge>}
      </div>

      {/* Weekly stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Hours This Week',  value: `${hoursThisWeek.toFixed(1)}h`,                                      icon: Clock,      color: 'text-[#FF6B35]'  },
          { label: 'Shifts This Week', value: String(weeklyShifts.length),                                          icon: Activity,   color: 'text-blue-400'   },
          { label: 'Avg Shift Length', value: weeklyShifts.length ? `${avgShiftHours.toFixed(1)}h` : '—',          icon: TrendingUp, color: 'text-green-400'  },
          { label: 'Total Shifts',     value: String(shiftCount),                                                   icon: Activity,   color: 'text-purple-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-[#161616] border-gray-800">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-8 h-8 ${color} shrink-0`} />
              <div><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-semibold text-white">{value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-[#161616] border border-gray-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="assignments">Vehicle Assignments</TabsTrigger>
          <TabsTrigger value="odometer">Odometer</TabsTrigger>
          <TabsTrigger value="status">Status History</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-[#161616] border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Driver Details</CardTitle>
                <CardDescription className="text-gray-400">Core contact and identity information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-y-2">
                  {([
                    ['Driver name', driverName],
                    ['Email', driverEmail ?? '—'],
                    ['Phone number', driverPhone ?? '—'],
                    ['Driver ID', driverId],
                  ] as [string, string][]).map(([label, value]) => (
                    <React.Fragment key={label}>
                      <span className="text-gray-500">{label}</span>
                      <span className="text-gray-200 text-right break-all">{value}</span>
                    </React.Fragment>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#161616] border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Current Status</CardTitle>
                <CardDescription className="text-gray-400">Live operational indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-y-2">
                  {([
                    ['Driver name',      driverName],
                    ['Email',            driverEmail ?? '—'],
                    ['Phone number',     driverPhone ?? '—'],
                    ['Last seen',         lastSeenLabel],
                    ['GPS sharing',       gpsActive ? 'Active' : 'Inactive'],
                    ['On shift since',    activeShift ? fmtDate(activeShift.started_at) : 'Not on shift'],
                    ['Assigned vehicle',  formatVehicleLabel(assignedVehicle) ?? 'None'],
                    ['Latest odometer',   latestOdometer?.reading != null ? `${latestOdometer.reading.toLocaleString()} km` : '—'],
                  ] as [string, string][]).map(([label, value]) => (
                    <React.Fragment key={label}>
                      <span className="text-gray-500">{label}</span>
                      <span className="text-gray-200 text-right">{value}</span>
                    </React.Fragment>
                  ))}
                </div>
                {activeShift && (
                  <Button variant="default" size="sm" className="mt-2 bg-[#FF6B35] text-white hover:bg-[#e55a25]" onClick={() => navigate(`/shifts/${activeShift.id}`)}>
                    View Active Shift Details
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#161616] border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-[#FF6B35]" />Live GPS
                  {gpsActive && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block ml-1" />}
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {latestLocation?.latitude != null && latestLocation?.longitude != null
                    ? `${latestLocation.latitude.toFixed(5)}, ${latestLocation.longitude.toFixed(5)} · updated ${latestLocation.created_at ? formatDistanceToNowStrict(new Date(latestLocation.created_at), { addSuffix: true }) : 'N/A'}`
                    : 'No location data available'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {latestLocation?.latitude != null && latestLocation?.longitude != null ? (
                  <>
                    <div ref={gpsMapRef} className="w-full rounded-b-lg" style={{ height: 280 }} />
                    <div className="px-4 py-2 flex gap-2">
                      <Button asChild size="sm" className="bg-[#FF6B35] text-white hover:bg-[#e55a25] text-xs">
                        <a href={`https://www.google.com/maps?q=${latestLocation.latitude},${latestLocation.longitude}`} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
                      </Button>
                      {assignedVehicle && (
                        <Button size="sm" className="bg-[#FF6B35] text-white hover:bg-[#e55a25] text-xs" onClick={() => navigate(`/vehicles/${assignmentSnapshot?.current_vehicle_id}`)}>Vehicle Details</Button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                    <MapPin className="w-8 h-8 mb-2 opacity-30" /><p className="text-sm">No GPS location available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {latestOdometer && (
              <Card className="bg-[#161616] border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Latest Odometer</CardTitle>
                  <CardDescription className="text-gray-400">Most recent submission</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-y-1">
                    <span className="text-gray-500">Reading</span><span className="text-gray-200 text-right">{latestOdometer.reading != null ? `${latestOdometer.reading.toLocaleString()} km` : '—'}</span>
                    <span className="text-gray-500">Captured</span><span className="text-gray-200 text-right">{fmtDate(latestOdometer.captured_at ?? latestOdometer.created_at)}</span>
                    <span className="text-gray-500">Location</span><span className="text-gray-200 text-right">{latestOdometer.lat != null && latestOdometer.lng != null ? `${latestOdometer.lat.toFixed(4)}, ${latestOdometer.lng.toFixed(4)}` : '—'}</span>
                  </div>
                  {latestOdometer.signed_url ? (
                    <img src={latestOdometer.signed_url} alt="Latest odometer" className="w-full rounded-lg mt-2" />
                  ) : latestOdometer.photo_error ? (
                    <div className="flex items-center justify-between rounded border border-red-900 bg-red-950/40 p-2 text-sm text-red-300">
                      <span>Photo failed to load.</span>
                      <Button variant="ghost" size="sm" className="text-red-300 hover:text-red-200" onClick={async () => { clearOdometerPhotoCache(latestOdometer.photo_path ?? null); setLatestOdometer(await resolveOdometerPhoto(latestOdometer)); }}>Retry</Button>
                    </div>
                  ) : <p className="text-sm text-gray-500">No photo.</p>}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Shifts */}
        <TabsContent value="shifts">
          <Card className="bg-[#161616] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Shift History</CardTitle>
              <CardDescription className="text-gray-400">{shiftCount} total shifts</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Start</TableHead>
                    <TableHead className="text-gray-400">End</TableHead>
                    <TableHead className="text-gray-400">Duration</TableHead>
                    <TableHead className="text-gray-400">Breaks</TableHead>
                    <TableHead className="text-gray-400">Vehicle</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-gray-500">No shifts found.</TableCell></TableRow>
                  ) : shifts.map((shift) => {
                    const mins = differenceInMinutes(shift.ended_at ? new Date(shift.ended_at) : new Date(), new Date(shift.started_at));
                    const dur = mins >= 60 ? `${(mins / 60).toFixed(1)}h` : `${mins}m`;
                    const vehicle = shift.vehicle_id ? vehicleMap.get(shift.vehicle_id) : null;
                    return (
                      <TableRow key={shift.id} className="border-gray-800">
                        <TableCell className="text-gray-300">{fmtDate(shift.started_at)}</TableCell>
                        <TableCell className="text-gray-300">{shift.ended_at ? fmtDate(shift.ended_at) : <Badge className="bg-blue-950 text-blue-300 border-blue-800">Active</Badge>}</TableCell>
                        <TableCell className="text-gray-300">{dur}</TableCell>
                        <TableCell className="text-gray-300">{breakCounts[shift.id] ?? 0}</TableCell>
                        <TableCell className="text-gray-300">{formatVehicleLabel(vehicle) ?? '—'}</TableCell>
                        <TableCell><Badge className={`capitalize text-xs ${statusBadge(shift.status)}`}>{shift.status}</Badge></TableCell>
                        <TableCell><Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 h-7 px-2 text-xs" onClick={() => navigate(`/shifts/${shift.id}`)}>View</Button></TableCell>
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

        {/* Assignments */}
        <TabsContent value="assignments">
          <Card className="bg-[#161616] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Vehicle Assignments</CardTitle>
              <CardDescription className="text-gray-400">Timeline of assigned vehicles</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Assigned</TableHead>
                    <TableHead className="text-gray-400">Unassigned</TableHead>
                    <TableHead className="text-gray-400">Vehicle</TableHead>
                    <TableHead className="text-gray-400">Duration</TableHead>
                    <TableHead className="text-gray-400"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-500">No assignments found.</TableCell></TableRow>
                  ) : assignments.map((a) => {
                    const vehicle = vehicleMap.get(a.vehicle_id);
                    const durMins = differenceInMinutes(a.unassigned_at ? new Date(a.unassigned_at) : new Date(), new Date(a.assigned_at));
                    const durLabel = durMins >= 1440 ? `${(durMins / 1440).toFixed(0)}d` : durMins >= 60 ? `${(durMins / 60).toFixed(0)}h` : `${durMins}m`;
                    return (
                      <TableRow key={a.id} className="border-gray-800">
                        <TableCell className="text-gray-300">{fmtDate(a.assigned_at)}</TableCell>
                        <TableCell className="text-gray-300">{a.unassigned_at ? fmtDate(a.unassigned_at) : <Badge className="bg-green-950 text-green-400 border-green-900">Current</Badge>}</TableCell>
                        <TableCell className="text-gray-300">{formatVehicleLabel(vehicle) ?? a.vehicle_id}</TableCell>
                        <TableCell className="text-gray-300">{durLabel}</TableCell>
                        <TableCell>{vehicle && <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 h-7 px-2 text-xs" onClick={() => navigate(`/vehicles/${a.vehicle_id}`)}>Profile</Button>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">Page {assignmentPage} of {totalAssignmentPages}</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-gray-300" disabled={assignmentPage === 1} onClick={() => setAssignmentPage((p) => Math.max(1, p - 1))}>Previous</Button>
                  <Button variant="ghost" size="sm" className="text-gray-300" disabled={assignmentPage >= totalAssignmentPages} onClick={() => setAssignmentPage((p) => Math.min(totalAssignmentPages, p + 1))}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Odometer */}
        <TabsContent value="odometer">
          <Card className="bg-[#161616] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Odometer Logs</CardTitle>
              <CardDescription className="text-gray-400">Latest odometer submissions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Recorded</TableHead>
                    <TableHead className="text-gray-400">Vehicle</TableHead>
                    <TableHead className="text-gray-400">Reading</TableHead>
                    <TableHead className="text-gray-400">Location</TableHead>
                    <TableHead className="text-gray-400">Photo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {odometerLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-500">No odometer logs found.</TableCell></TableRow>
                  ) : odometerLogs.map((log) => {
                    const vehicle = vehicleMap.get(log.vehicle_id);
                    return (
                      <TableRow key={log.id} className="border-gray-800">
                        <TableCell className="text-gray-300">{fmtDate(log.captured_at ?? log.created_at)}</TableCell>
                        <TableCell className="text-gray-300">{formatVehicleLabel(vehicle) ?? log.vehicle_id}</TableCell>
                        <TableCell className="text-gray-300">{log.reading != null ? `${log.reading.toLocaleString()} km` : '—'}</TableCell>
                        <TableCell className="text-gray-300">{log.lat != null && log.lng != null ? `${log.lat.toFixed(4)}, ${log.lng.toFixed(4)}` : '—'}</TableCell>
                        <TableCell className="text-gray-300">
                          {log.signed_url ? <img src={log.signed_url} alt="Odometer" className="h-12 w-20 rounded border border-gray-700 object-cover" />
                            : log.photo_error ? <div className="flex items-center gap-2 text-sm text-red-300"><span>Failed</span><Button variant="ghost" size="sm" className="text-red-300 hover:text-red-200" onClick={async () => { clearOdometerPhotoCache(log.photo_path ?? null); const r = await resolveOdometerPhoto(log); setOdometerLogs((prev) => prev.map((x) => x.id === log.id ? r : x)); }}>Retry</Button></div>
                            : 'No photo'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">Page {odometerPage} of {totalOdometerPages}</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-gray-300" disabled={odometerPage === 1} onClick={() => setOdometerPage((p) => Math.max(1, p - 1))}>Previous</Button>
                  <Button variant="ghost" size="sm" className="text-gray-300" disabled={odometerPage >= totalOdometerPages} onClick={() => setOdometerPage((p) => Math.min(totalOdometerPages, p + 1))}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Status History */}
        <TabsContent value="status">
          <Card className="bg-[#161616] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Status History</CardTitle>
              <CardDescription className="text-gray-400">Driver status events timeline</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">State</TableHead>
                    <TableHead className="text-gray-400">Started</TableHead>
                    <TableHead className="text-gray-400">Ended</TableHead>
                    <TableHead className="text-gray-400">Duration</TableHead>
                    <TableHead className="text-gray-400">Shift</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statusEvents.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-500">No status events found.</TableCell></TableRow>
                  ) : statusEvents.map((ev) => {
                    const durMins = ev.started_at && ev.ended_at ? differenceInMinutes(new Date(ev.ended_at), new Date(ev.started_at)) : null;
                    const durLabel = durMins != null ? durMins >= 60 ? `${(durMins / 60).toFixed(1)}h` : `${durMins}m` : '—';
                    return (
                      <TableRow key={ev.id} className="border-gray-800">
                        <TableCell className="text-gray-300 capitalize">{ev.state ?? 'unknown'}</TableCell>
                        <TableCell className="text-gray-300">{fmtDate(ev.started_at)}</TableCell>
                        <TableCell className="text-gray-300">{ev.ended_at ? fmtDate(ev.ended_at) : <Badge className="bg-blue-950 text-blue-300 border-blue-800">Active</Badge>}</TableCell>
                        <TableCell className="text-gray-300">{durLabel}</TableCell>
                        <TableCell>{ev.shift_id ? <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 h-7 px-2 text-xs font-mono" onClick={() => navigate(`/shifts/${ev.shift_id}`)}>{ev.shift_id.slice(0, 8)}…</Button> : '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">Page {statusPage} of {totalStatusPages}</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-gray-300" disabled={statusPage === 1} onClick={() => setStatusPage((p) => Math.max(1, p - 1))}>Previous</Button>
                  <Button variant="ghost" size="sm" className="text-gray-300" disabled={statusPage >= totalStatusPages} onClick={() => setStatusPage((p) => Math.min(totalStatusPages, p + 1))}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
