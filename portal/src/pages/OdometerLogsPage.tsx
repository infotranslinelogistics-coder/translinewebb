import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Download, Image as ImageIcon, Loader, Search, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { listVehicles, Vehicle } from '@/lib/db/vehicles';
import { fetchDriverOptions } from '@/lib/drivers';
import { getOdometerPhotoUrl } from '@/lib/storage/odometerPhotos';
import { findNearestDriverLocation } from '@/lib/db/locations';

interface OdometerLogRow {
  id: string;
  driver_id: string;
  vehicle_id: string;
  shift_id: string | null;
  odometer_value: number | null;
  photo_path: string;
  recorded_at: string;
  lat?: number | null;
  lng?: number | null;
  accuracy_m?: number | null;
  signed_url?: string | null;
  location_source?: 'log' | 'nearest' | null;
}

interface ShiftRow {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  started_at: string;
  ended_at: string | null;
}

const PAGE_SIZE = 20;

export function OdometerLogsPage() {
  const [logs, setLogs] = useState<OdometerLogRow[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [driverFilter, setDriverFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [view, setView] = useState<'logs' | 'anomalies'>('logs');
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loadingAnomalies, setLoadingAnomalies] = useState(false);

  const driverMap = useMemo(() => {
    const map = new Map<string, any>();
    drivers.forEach((driver) => {
      const id = driver.driver_id ?? driver.id ?? driver.auth_user_id;
      if (id) map.set(id, driver);
    });
    return map;
  }, [drivers]);

  const vehicleMap = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach((vehicle) => map.set(vehicle.id, vehicle));
    return map;
  }, [vehicles]);

  const shiftMap = useMemo(() => {
    const map = new Map<string, ShiftRow>();
    shifts.forEach((shift) => map.set(shift.id, shift));
    return map;
  }, [shifts]);

  const fetchFilters = async () => {
    const [driverOptions, vehicleOptions, shiftOptions] = await Promise.all([
      fetchDriverOptions(),
      listVehicles(),
      supabase.from('shifts').select('id, driver_id, vehicle_id, started_at, ended_at').order('started_at', { ascending: false }).limit(200),
    ]);
    setDrivers(driverOptions ?? []);
    setVehicles(vehicleOptions ?? []);
    setShifts((shiftOptions.data as ShiftRow[]) ?? []);
  };

  const resolveLocations = async (rows: OdometerLogRow[]) => {
    return Promise.all(
      rows.map(async (row) => {
        if (row.lat && row.lng) {
          return { ...row, location_source: 'log' as const };
        }
        const nearest = await findNearestDriverLocation(row.driver_id, row.recorded_at);
        if (nearest) {
          return {
            ...row,
            lat: nearest.lat,
            lng: nearest.lng,
            accuracy_m: nearest.accuracy_m ?? null,
            location_source: 'nearest' as const,
          };
        }
        return { ...row, location_source: null };
      })
    );
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('odometer_logs')
        .select('*', { count: 'exact' })
        .order('recorded_at', { ascending: false });

      if (driverFilter !== 'all') {
        query = query.eq('driver_id', driverFilter);
      }
      if (vehicleFilter !== 'all') {
        query = query.eq('vehicle_id', vehicleFilter);
      }
      if (shiftFilter !== 'all') {
        query = query.eq('shift_id', shiftFilter);
      }
      if (startDate) {
        query = query.gte('recorded_at', new Date(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('recorded_at', new Date(endDate).toISOString());
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error: fetchError, count } = await query.range(from, to);
      if (fetchError) throw fetchError;

      const rows = (data as OdometerLogRow[]) ?? [];
      const signedRows = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          signed_url: await getOdometerPhotoUrl(row.photo_path),
        }))
      );
      const locatedRows = await resolveLocations(signedRows);

      const filteredRows = search
        ? locatedRows.filter((row) => {
            const driver = driverMap.get(row.driver_id);
            const driverName = (driver?.full_name ?? driver?.name ?? driver?.email ?? '').toLowerCase();
            return driverName.includes(search.toLowerCase());
          })
        : locatedRows;

      setLogs(filteredRows);
      setTotalCount(count ?? 0);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load odometer logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [driverFilter, vehicleFilter, shiftFilter, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [driverFilter, vehicleFilter, shiftFilter, startDate, endDate, page, search, driverMap]);

  const fetchAnomalies = async () => {
    try {
      setLoadingAnomalies(true);
      let query = supabase
        .from('odometer_logs')
        .select('*')
        .order('vehicle_id', { ascending: true })
        .order('recorded_at', { ascending: true })
        .limit(500);

      if (driverFilter !== 'all') {
        query = query.eq('driver_id', driverFilter);
      }
      if (vehicleFilter !== 'all') {
        query = query.eq('vehicle_id', vehicleFilter);
      }
      if (startDate) {
        query = query.gte('recorded_at', new Date(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('recorded_at', new Date(endDate).toISOString());
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      const rows = (data as OdometerLogRow[]) ?? [];
      const withLocation = await resolveLocations(rows);
      const grouped = new Map<string, OdometerLogRow[]>();
      withLocation.forEach((row) => {
        if (!grouped.has(row.vehicle_id)) grouped.set(row.vehicle_id, []);
        grouped.get(row.vehicle_id)?.push(row);
      });

      const flagged: any[] = [];
      const maxKmPerHour = 140;
      grouped.forEach((vehicleRows) => {
        const sorted = vehicleRows.sort(
          (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
        );
        for (let i = 1; i < sorted.length; i += 1) {
          const prev = sorted[i - 1];
          const curr = sorted[i];
          if (prev.odometer_value === null || curr.odometer_value === null) continue;
          const delta = curr.odometer_value - prev.odometer_value;
          const hours = (new Date(curr.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 3600000;
          if (delta < 0) {
            flagged.push({ ...curr, prev_odometer_value: prev.odometer_value, delta, reason: 'Odometer decreased', hours });
          } else if (hours > 0 && delta / hours > maxKmPerHour) {
            flagged.push({
              ...curr,
              prev_odometer_value: prev.odometer_value,
              delta,
              reason: `Jump ${Math.round(delta / hours)} km/h`,
              hours,
            });
          }
        }
      });
      setAnomalies(flagged);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load anomalies');
    } finally {
      setLoadingAnomalies(false);
    }
  };

  useEffect(() => {
    if (view === 'anomalies') {
      fetchAnomalies();
    }
  }, [view, driverFilter, vehicleFilter, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {error && (
        <Card className="bg-red-950 border-red-900">
          <CardContent className="p-4 text-red-400">{error}</CardContent>
        </Card>
      )}

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Odometer Logs</h1>
        <p className="text-gray-400">Photo-backed odometer submissions with filters and downloads</p>
      </div>

      <Card className="bg-[#161616] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Filters</CardTitle>
          <CardDescription className="text-gray-400">Refine logs by driver, vehicle, date, and shift</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Driver</Label>
            <Select value={driverFilter} onValueChange={setDriverFilter}>
              <SelectTrigger className="bg-[#0F0F0F] border-gray-700 text-white">
                <SelectValue placeholder="All drivers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All drivers</SelectItem>
                {drivers.map((driver) => {
                  const id = driver.driver_id ?? driver.id ?? driver.auth_user_id;
                  return (
                    <SelectItem key={id} value={id}>
                      {driver.full_name ?? driver.name ?? driver.email ?? id}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
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
                    {vehicle.plate_number} • {vehicle.make} {vehicle.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Shift</Label>
            <Select value={shiftFilter} onValueChange={setShiftFilter}>
              <SelectTrigger className="bg-[#0F0F0F] border-gray-700 text-white">
                <SelectValue placeholder="All shifts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All shifts</SelectItem>
                {shifts.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {format(new Date(shift.started_at), 'MMM dd, HH:mm')} {shift.ended_at ? '• Ended' : '• Active'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <div className="md:col-span-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Search driver name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10 bg-[#0F0F0F] border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={view} onValueChange={(value) => setView(value as 'logs' | 'anomalies')}>
        <TabsList className="bg-[#161616] border border-gray-800">
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="anomalies">Odometer Anomalies</TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <Card className="bg-[#161616] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Logs</CardTitle>
              <CardDescription className="text-gray-400">{totalCount} total entries</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader className="w-8 h-8 text-[#FF6B35] animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-transparent">
                        <TableHead className="text-gray-400">Date/Time</TableHead>
                        <TableHead className="text-gray-400">Driver</TableHead>
                        <TableHead className="text-gray-400">Vehicle</TableHead>
                        <TableHead className="text-gray-400">Shift</TableHead>
                        <TableHead className="text-gray-400">Odometer</TableHead>
                        <TableHead className="text-gray-400">Location</TableHead>
                        <TableHead className="text-gray-400">Photo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                            No odometer logs found
                          </TableCell>
                        </TableRow>
                      ) : (
                        logs.map((log) => {
                          const driver = driverMap.get(log.driver_id);
                          const vehicle = vehicleMap.get(log.vehicle_id);
                          const shift = log.shift_id ? shiftMap.get(log.shift_id) : null;
                          return (
                            <TableRow key={log.id} className="border-gray-800">
                              <TableCell className="text-gray-300">
                                {format(new Date(log.recorded_at), 'MMM dd, yyyy HH:mm')}
                              </TableCell>
                              <TableCell className="text-gray-300">
                                {driver?.full_name ?? driver?.name ?? driver?.email ?? log.driver_id}
                              </TableCell>
                              <TableCell className="text-gray-300">
                                {vehicle ? `${vehicle.plate_number} • ${vehicle.make} ${vehicle.model}` : 'Unknown'}
                              </TableCell>
                              <TableCell className="text-gray-300">
                                {shift ? format(new Date(shift.started_at), 'MMM dd, HH:mm') : 'N/A'}
                              </TableCell>
                              <TableCell className="text-gray-300">
                                {log.odometer_value ?? '—'}
                              </TableCell>
                              <TableCell className="text-gray-300">
                                {log.lat && log.lng ? (
                                  <a
                                    href={`https://www.google.com/maps?q=${log.lat},${log.lng}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[#FF6B35] hover:underline"
                                  >
                                    {log.lat.toFixed(4)}, {log.lng.toFixed(4)}
                                  </a>
                                ) : (
                                  '—'
                                )}
                              </TableCell>
                              <TableCell>
                                {log.signed_url ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewUrl(log.signed_url ?? null)}
                                      className="h-12 w-16 rounded border border-gray-700 overflow-hidden"
                                    >
                                      <img
                                        src={log.signed_url}
                                        alt="Odometer"
                                        className="h-full w-full object-cover"
                                      />
                                    </button>
                                    <Button
                                      asChild
                                      variant="ghost"
                                      size="icon"
                                      className="text-gray-400 hover:text-white"
                                    >
                                      <a href={log.signed_url} download>
                                        <Download className="w-4 h-4" />
                                      </a>
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-gray-500 flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4" /> No photo
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300"
                    disabled={page === 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300"
                    disabled={page >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anomalies">
          <Card className="bg-[#161616] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Odometer Anomalies</CardTitle>
              <CardDescription className="text-gray-400">
                Suspicious decreases or rapid jumps across recent logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-4">
                <Button
                  onClick={fetchAnomalies}
                  className="bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
                  disabled={loadingAnomalies}
                >
                  {loadingAnomalies ? (
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 mr-2" />
                  )}
                  Refresh anomalies
                </Button>
              </div>
              {loadingAnomalies ? (
                <div className="flex justify-center py-10">
                  <Loader className="w-8 h-8 text-[#FF6B35] animate-spin" />
                </div>
              ) : anomalies.length === 0 ? (
                <p className="text-gray-500 text-sm">No anomalies detected for the selected filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-transparent">
                        <TableHead className="text-gray-400">Date/Time</TableHead>
                        <TableHead className="text-gray-400">Driver</TableHead>
                        <TableHead className="text-gray-400">Vehicle</TableHead>
                        <TableHead className="text-gray-400">Odometer</TableHead>
                        <TableHead className="text-gray-400">Delta</TableHead>
                        <TableHead className="text-gray-400">Reason</TableHead>
                        <TableHead className="text-gray-400">Location</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {anomalies.map((log) => {
                        const driver = driverMap.get(log.driver_id);
                        const vehicle = vehicleMap.get(log.vehicle_id);
                        return (
                          <TableRow key={`${log.id}-${log.reason}`} className="border-gray-800">
                            <TableCell className="text-gray-300">
                              {format(new Date(log.recorded_at), 'MMM dd, yyyy HH:mm')}
                            </TableCell>
                            <TableCell className="text-gray-300">
                              {driver?.full_name ?? driver?.name ?? driver?.email ?? log.driver_id}
                            </TableCell>
                            <TableCell className="text-gray-300">
                              {vehicle ? `${vehicle.plate_number} • ${vehicle.make} ${vehicle.model}` : 'Unknown'}
                            </TableCell>
                            <TableCell className="text-gray-300">{log.odometer_value}</TableCell>
                            <TableCell className="text-gray-300">{log.delta}</TableCell>
                            <TableCell className="text-gray-300">{log.reason}</TableCell>
                            <TableCell className="text-gray-300">
                              {log.lat && log.lng ? (
                                <a
                                  href={`https://www.google.com/maps?q=${log.lat},${log.lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#FF6B35] hover:underline"
                                >
                                  {log.lat.toFixed(4)}, {log.lng.toFixed(4)}
                                </a>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(previewUrl)} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="bg-[#161616] border-gray-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Odometer Photo</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img src={previewUrl} alt="Odometer" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
