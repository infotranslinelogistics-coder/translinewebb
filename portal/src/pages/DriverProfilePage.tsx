import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Loader, MapPin } from 'lucide-react';
import { format, formatDistanceToNowStrict, differenceInMinutes } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { listVehicles, Vehicle } from '@/lib/db/vehicles';
import { clearOdometerPhotoCache, getOdometerPhotoUrl } from '@/lib/storage/odometerPhotos';

interface DriverStatusRow {
  driver_id: string;
  last_seen_at: string | null;
  is_online: boolean | null;
  status_state: string | null;
  on_break: boolean | null;
  status_started_at: string | null;
  last_location_at: string | null;
  lat: number | null;
  lng: number | null;
  speed_kmh: number | null;
  heading: number | null;
  vehicle_id: string | null;
  shift_id: string | null;
}

interface ShiftRow {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: 'active' | 'ended' | 'cancelled';
}

interface AssignmentRow {
  id: string;
  driver_id: string;
  vehicle_id: string;
  assigned_at: string;
  unassigned_at: string | null;
}

interface OdometerRow {
  id: string;
  driver_id: string;
  vehicle_id: string;
  shift_id: string | null;
  reading: number | null;
  photo_path?: string | null;
  captured_at?: string | null;
  created_at?: string | null;
  lat?: number | null;
  lng?: number | null;
  signed_url?: string | null;
  photo_error?: string | null;
}

interface DriverRow {
  driver_id?: string;
  id?: string;
  full_name?: string;
  name?: string;
  email?: string;
  profile_email?: string;
  phone?: string;
  status?: string;
}

interface DriverAssignmentSnapshot {
  current_vehicle_id: string | null;
  current_vehicle_rego: string | null;
}

const PAGE_SIZE = 10;

export function DriverProfilePage() {
  const { id } = useParams();
  const driverId = id ?? '';
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [status, setStatus] = useState<DriverStatusRow | null>(null);
  const [assignmentSnapshot, setAssignmentSnapshot] = useState<DriverAssignmentSnapshot | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeShift, setActiveShift] = useState<ShiftRow | null>(null);
  const [latestOdometer, setLatestOdometer] = useState<OdometerRow | null>(null);
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

  const vehicleMap = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach((vehicle) => map.set(vehicle.id, vehicle));
    return map;
  }, [vehicles]);

  const resolveOdometerPhoto = async (row: OdometerRow) => {
    const { url, error } = await getOdometerPhotoUrl({
      photoPath: row.photo_path,
    });
    return {
      ...row,
      signed_url: url,
      photo_error: error,
    };
  };

  useEffect(() => {
    if (!driverId) return;
    const fetchBase = async () => {
      try {
        setLoading(true);
        const [
          driverResponse,
          statusResponse,
          assignmentResponse,
          vehicleList,
          activeShiftResponse,
          latestOdometerResponse,
        ] =
          await Promise.all([
            supabase.from('drivers_full').select('*').eq('driver_id', driverId).maybeSingle(),
            supabase.from('view_driver_current_status').select('*').eq('driver_id', driverId).maybeSingle(),
            supabase
              .from('drivers_with_current_vehicle')
              .select('current_vehicle_id, current_vehicle_rego')
              .eq('driver_id', driverId)
              .maybeSingle(),
            listVehicles(),
            supabase.from('shifts').select('*').eq('driver_id', driverId).or('status.eq.active,ended_at.is.null').order('started_at', { ascending: false }).limit(1),
            supabase
              .from('odometer_readings')
              .select('id, driver_id, vehicle_id, shift_id, reading, photo_path, captured_at, created_at, lat, lng')
              .eq('driver_id', driverId)
              .order('captured_at', { ascending: false })
              .limit(1),
          ]);
        setDriver((driverResponse.data as DriverRow) ?? null);
        setStatus((statusResponse.data as DriverStatusRow) ?? null);
        setAssignmentSnapshot((assignmentResponse.data as DriverAssignmentSnapshot) ?? null);
        setVehicles(vehicleList ?? []);
        setActiveShift((activeShiftResponse.data as ShiftRow[])?.[0] ?? null);
        const latest = (latestOdometerResponse.data as OdometerRow[])?.[0] ?? null;
        const resolvedLatest = latest ? await resolveOdometerPhoto(latest) : null;
        setLatestOdometer(resolvedLatest);
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
    const fetchShifts = async () => {
      const from = (shiftPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error: fetchError, count } = await supabase
        .from('shifts')
        .select('*', { count: 'exact' })
        .eq('driver_id', driverId)
        .order('started_at', { ascending: false })
        .range(from, to);
      if (fetchError) {
        console.error(fetchError);
        return;
      }
      const rows = (data as ShiftRow[]) ?? [];
      setShifts(rows);
      setShiftCount(count ?? 0);

      if (rows.length > 0) {
        const shiftIds = rows.map((row) => row.id);
        const { data: breakData } = await supabase
          .from('driver_status_events')
          .select('shift_id')
          .in('shift_id', shiftIds)
          .eq('state', 'break');
        const counts: Record<string, number> = {};
        (breakData ?? []).forEach((row) => {
          const shiftId = row.shift_id as string;
          counts[shiftId] = (counts[shiftId] ?? 0) + 1;
        });
        setBreakCounts(counts);
      }
    };
    fetchShifts();
  }, [driverId, shiftPage]);

  useEffect(() => {
    if (!driverId) return;
    const fetchAssignments = async () => {
      const from = (assignmentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error: fetchError, count } = await supabase
        .from('vehicle_assignments')
        .select('*', { count: 'exact' })
        .eq('driver_id', driverId)
        .order('assigned_at', { ascending: false })
        .range(from, to);
      if (fetchError) {
        console.error(fetchError);
        return;
      }
      setAssignments((data as AssignmentRow[]) ?? []);
      setAssignmentCount(count ?? 0);
    };
    fetchAssignments();
  }, [driverId, assignmentPage]);

  useEffect(() => {
    if (!driverId) return;
    const fetchOdometer = async () => {
      const from = (odometerPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error: fetchError, count } = await supabase
        .from('odometer_readings')
        .select('id, driver_id, vehicle_id, shift_id, reading, photo_path, captured_at, created_at, lat, lng', { count: 'exact' })
        .eq('driver_id', driverId)
        .order('captured_at', { ascending: false })
        .range(from, to);
      if (fetchError) {
        console.error(fetchError);
        return;
      }
      const rows = (data as OdometerRow[]) ?? [];
      const signedRows = await Promise.all(rows.map(resolveOdometerPhoto));
      setOdometerLogs(signedRows);
      setOdometerCount(count ?? 0);
    };
    fetchOdometer();
  }, [driverId, odometerPage]);

  const handleLatestPhotoRetry = async () => {
    if (!latestOdometer) return;
    clearOdometerPhotoCache(latestOdometer.photo_path ?? null);
    const resolved = await resolveOdometerPhoto(latestOdometer);
    setLatestOdometer(resolved);
  };

  const handleOdometerPhotoRetry = async (log: OdometerRow) => {
    clearOdometerPhotoCache(log.photo_path ?? null);
    const resolved = await resolveOdometerPhoto(log);
    setOdometerLogs((prev) => prev.map((row) => (row.id === log.id ? resolved : row)));
  };

  useEffect(() => {
    if (!driverId) return;
    const fetchStatusEvents = async () => {
      const from = (statusPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error: fetchError, count } = await supabase
        .from('driver_status_events')
        .select('*', { count: 'exact' })
        .eq('driver_id', driverId)
        .order('started_at', { ascending: false })
        .range(from, to);
      if (fetchError) {
        console.error(fetchError);
        return;
      }
      setStatusEvents(data ?? []);
      setStatusCount(count ?? 0);
    };
    fetchStatusEvents();
  }, [driverId, statusPage]);

  if (!driverId) {
    return <p className="text-gray-400">Driver ID missing.</p>;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader className="w-8 h-8 text-[#FF6B35] animate-spin" />
      </div>
    );
  }

  const driverName = driver?.full_name ?? driver?.name ?? driver?.email ?? driverId;
  const assignedVehicle = assignmentSnapshot?.current_vehicle_id
    ? vehicleMap.get(assignmentSnapshot.current_vehicle_id)
    : null;
  const telemetryVehicle = status?.vehicle_id ? vehicleMap.get(status.vehicle_id) : null;
  const formatVehicleLabel = (vehicle?: Vehicle | null) => {
    if (!vehicle) return null;
    const rego = vehicle.rego ?? 'Unknown rego';
    const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
    return makeModel ? `${rego} • ${makeModel}` : rego;
  };
  const gpsActive = status?.last_location_at
    ? new Date(status.last_location_at) > new Date(Date.now() - 5 * 60 * 1000)
    : false;
  const lastSeenLabel = status?.last_seen_at
    ? formatDistanceToNowStrict(new Date(status.last_seen_at), { addSuffix: true })
    : 'Never';
  const isOnline = status?.last_seen_at
    ? new Date(status.last_seen_at) > new Date(Date.now() - 60 * 1000)
    : Boolean(status?.is_online);

  const totalShiftPages = Math.max(1, Math.ceil(shiftCount / PAGE_SIZE));
  const totalAssignmentPages = Math.max(1, Math.ceil(assignmentCount / PAGE_SIZE));
  const totalOdometerPages = Math.max(1, Math.ceil(odometerCount / PAGE_SIZE));
  const totalStatusPages = Math.max(1, Math.ceil(statusCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {error && (
        <Card className="bg-red-950 border-red-900">
          <CardContent className="p-4 text-red-400">{error}</CardContent>
        </Card>
      )}

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">{driverName}</h1>
        <p className="text-gray-400">Driver profile & history</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-[#161616] border border-gray-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="assignments">Vehicle Assignments</TabsTrigger>
          <TabsTrigger value="odometer">Odometer</TabsTrigger>
          <TabsTrigger value="status">Status History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-[#161616] border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Current Status</CardTitle>
                <CardDescription className="text-gray-400">Live operational indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {isOnline ? (
                    <Badge className="bg-green-950 text-green-400 border-green-900">Online</Badge>
                  ) : (
                    <Badge className="bg-gray-900 text-gray-300 border-gray-700">Offline</Badge>
                  )}
                  {status?.on_break ? (
                    <Badge className="bg-amber-950 text-amber-300 border-amber-800">On Break</Badge>
                  ) : null}
                  {activeShift ? (
                    <Badge className="bg-blue-950 text-blue-300 border-blue-800">On Shift</Badge>
                  ) : (
                    <Badge className="bg-gray-900 text-gray-300 border-gray-700">Off Shift</Badge>
                  )}
                  {status?.status_state ? (
                    <Badge className="bg-purple-950 text-purple-300 border-purple-800">
                      {status.status_state}
                    </Badge>
                  ) : null}
                </div>
                <div className="text-sm text-gray-300 space-y-1">
                  <p>
                    <span className="text-gray-500">Last seen:</span> {lastSeenLabel}
                  </p>
                  <p>
                    <span className="text-gray-500">GPS sharing:</span> {gpsActive ? 'On' : 'Off'}
                  </p>
                  <p>
                    <span className="text-gray-500">Current shift:</span>{' '}
                    {activeShift ? format(new Date(activeShift.started_at), 'MMM dd, HH:mm') : 'None'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#161616] border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Location Snapshot</CardTitle>
                <CardDescription className="text-gray-400">Most recent GPS update</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {status?.lat && status?.lng ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <MapPin className="w-4 h-4 text-[#FF6B35]" />
                      {status.lat.toFixed(5)}, {status.lng.toFixed(5)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Updated {status.last_location_at ? formatDistanceToNowStrict(new Date(status.last_location_at), { addSuffix: true }) : 'N/A'}
                    </div>
                    <Button
                      asChild
                      className="w-full bg-[#0F0F0F] border border-gray-700 text-gray-200 hover:bg-[#1F1F1F]"
                    >
                      <a
                        href={`https://www.google.com/maps?q=${status.lat},${status.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open in Google Maps
                      </a>
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No GPS location available.</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#161616] border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Assigned Vehicle</CardTitle>
                <CardDescription className="text-gray-400">Assignment truth & odometer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {assignedVehicle ? (
                  <div className="text-sm text-gray-300">
                    <p>{formatVehicleLabel(assignedVehicle)}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No assignment active.</p>
                )}
                <p className="text-xs text-gray-500">
                  Telemetry vehicle: {formatVehicleLabel(telemetryVehicle) ?? 'None'}
                </p>
                <div className="text-sm text-gray-300">
                  <p>
                    <span className="text-gray-500">Latest odometer:</span>{' '}
                    {latestOdometer?.reading ?? '—'}
                  </p>
                  <p>
                    <span className="text-gray-500">Captured:</span>{' '}
                    {latestOdometer?.captured_at || latestOdometer?.created_at
                      ? format(new Date(latestOdometer.captured_at ?? latestOdometer.created_at ?? ''), 'MMM dd, HH:mm')
                      : '—'}
                  </p>
                  <p>
                    <span className="text-gray-500">Location:</span>{' '}
                    {latestOdometer?.lat != null && latestOdometer?.lng != null
                      ? `${latestOdometer.lat.toFixed(5)}, ${latestOdometer.lng.toFixed(5)}`
                      : '—'}
                  </p>
                </div>
                {latestOdometer?.signed_url ? (
                  <img src={latestOdometer.signed_url} alt="Latest odometer" className="w-full rounded-lg" />
                ) : latestOdometer?.photo_error ? (
                  <div className="flex items-center justify-between rounded border border-red-900 bg-red-950/40 p-2 text-sm text-red-300">
                    <span>Photo failed to load.</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-300 hover:text-red-200"
                      onClick={handleLatestPhotoRetry}
                    >
                      Retry
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No photo.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="shifts">
          <Card className="bg-[#161616] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Shifts</CardTitle>
              <CardDescription className="text-gray-400">Detailed shift history</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Start</TableHead>
                    <TableHead className="text-gray-400">End</TableHead>
                    <TableHead className="text-gray-400">Total Hours</TableHead>
                    <TableHead className="text-gray-400">Breaks</TableHead>
                    <TableHead className="text-gray-400">Vehicle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                        No shifts found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    shifts.map((shift) => {
                      const endTime = shift.ended_at ? new Date(shift.ended_at) : new Date();
                      const totalHours = differenceInMinutes(endTime, new Date(shift.started_at)) / 60;
                      const vehicle = shift.vehicle_id ? vehicleMap.get(shift.vehicle_id) : null;
                      return (
                        <TableRow key={shift.id} className="border-gray-800">
                          <TableCell className="text-gray-300">
                            {format(new Date(shift.started_at), 'MMM dd, HH:mm')}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {shift.ended_at ? format(new Date(shift.ended_at), 'MMM dd, HH:mm') : 'Active'}
                          </TableCell>
                          <TableCell className="text-gray-300">{totalHours.toFixed(1)}h</TableCell>
                          <TableCell className="text-gray-300">{breakCounts[shift.id] ?? 0}</TableCell>
                          <TableCell className="text-gray-300">
                            {formatVehicleLabel(vehicle) ?? 'N/A'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">Page {shiftPage} of {totalShiftPages}</p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300"
                    disabled={shiftPage === 1}
                    onClick={() => setShiftPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300"
                    disabled={shiftPage >= totalShiftPages}
                    onClick={() => setShiftPage((prev) => Math.min(totalShiftPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-gray-500">
                        No assignments found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignments.map((assignment) => {
                      const vehicle = vehicleMap.get(assignment.vehicle_id);
                      return (
                        <TableRow key={assignment.id} className="border-gray-800">
                          <TableCell className="text-gray-300">
                            {format(new Date(assignment.assigned_at), 'MMM dd, HH:mm')}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {assignment.unassigned_at
                              ? format(new Date(assignment.unassigned_at), 'MMM dd, HH:mm')
                              : 'Current'}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {formatVehicleLabel(vehicle) ?? assignment.vehicle_id}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">Page {assignmentPage} of {totalAssignmentPages}</p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300"
                    disabled={assignmentPage === 1}
                    onClick={() => setAssignmentPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300"
                    disabled={assignmentPage >= totalAssignmentPages}
                    onClick={() => setAssignmentPage((prev) => Math.min(totalAssignmentPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
                    <TableHead className="text-gray-400">Odometer</TableHead>
                    <TableHead className="text-gray-400">Location</TableHead>
                    <TableHead className="text-gray-400">Photo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {odometerLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                        No odometer logs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    odometerLogs.map((log) => {
                      const vehicle = vehicleMap.get(log.vehicle_id);
                      return (
                        <TableRow key={log.id} className="border-gray-800">
                          <TableCell className="text-gray-300">
                            {log.captured_at || log.created_at
                              ? format(new Date(log.captured_at ?? log.created_at ?? ''), 'MMM dd, HH:mm')
                              : '—'}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {formatVehicleLabel(vehicle) ?? log.vehicle_id}
                          </TableCell>
                          <TableCell className="text-gray-300">{log.reading ?? '—'}</TableCell>
                          <TableCell className="text-gray-300">
                            {log.lat != null && log.lng != null
                              ? `${log.lat.toFixed(5)}, ${log.lng.toFixed(5)}`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {log.signed_url ? (
                              <img src={log.signed_url} alt="Odometer" className="h-12 w-20 rounded border border-gray-700 object-cover" />
                            ) : log.photo_error ? (
                              <div className="flex items-center gap-2 text-sm text-red-300">
                                <span>Photo failed</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-300 hover:text-red-200"
                                  onClick={() => handleOdometerPhotoRetry(log)}
                                >
                                  Retry
                                </Button>
                              </div>
                            ) : (
                              'No photo'
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">Page {odometerPage} of {totalOdometerPages}</p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300"
                    disabled={odometerPage === 1}
                    onClick={() => setOdometerPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300"
                    disabled={odometerPage >= totalOdometerPages}
                    onClick={() => setOdometerPage((prev) => Math.min(totalOdometerPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
                    <TableHead className="text-gray-400">Shift</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statusEvents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-gray-500">
                        No status events found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    statusEvents.map((event) => (
                      <TableRow key={event.id} className="border-gray-800">
                        <TableCell className="text-gray-300 capitalize">{event.state ?? 'unknown'}</TableCell>
                        <TableCell className="text-gray-300">
                          {event.started_at ? format(new Date(event.started_at), 'MMM dd, HH:mm') : '—'}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {event.ended_at ? format(new Date(event.ended_at), 'MMM dd, HH:mm') : 'Active'}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {event.shift_id ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">Page {statusPage} of {totalStatusPages}</p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300"
                    disabled={statusPage === 1}
                    onClick={() => setStatusPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300"
                    disabled={statusPage >= totalStatusPages}
                    onClick={() => setStatusPage((prev) => Math.min(totalStatusPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
