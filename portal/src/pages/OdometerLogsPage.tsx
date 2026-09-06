import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Download, Image as ImageIcon, Loader } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { supabase } from '@/lib/supabase';
import { listDrivers, type Driver } from '@/lib/db/drivers';
import { listVehicles, type Vehicle } from '@/lib/db/vehicles';
import { clearOdometerPhotoCache, getOdometerPhotoUrl } from '@/lib/storage/odometerPhotos';
import { formatPerthDateTime, PERTH_TIME_LABEL } from '@/lib/dateTime';

interface OdometerShiftRow {
  shift_id: string;
  driver_id: string | null;
  driver_name: string | null;
  vehicle_id: string | null;
  vehicle_rego: string | null;
  start_captured_at: string | null;
  end_captured_at: string | null;
  odometer_start: number | null;
  odometer_end: number | null;
  start_photo_path: string | null;
  end_photo_path: string | null;
  start_photo_url?: string | null;
  end_photo_url?: string | null;
  start_photo_error?: string | null;
  end_photo_error?: string | null;
  shift_status?: string | null;
  shift_ended_at?: string | null;
}

const PAGE_SIZE = 20;

function formatDateTime(value: string | null): string {
  if (!value) return 'Pending';
  return formatPerthDateTime(value, 'Pending');
}

function formatVehicleLabel(vehicle: Vehicle | null | undefined, fallback: string | null): string {
  if (vehicle) {
    const rego = vehicle.rego ?? vehicle.plate_number ?? fallback ?? 'Unknown';
    const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
    return makeModel ? `${rego} • ${makeModel}` : rego;
  }

  return fallback ?? 'Unknown';
}

function buildDayEndIso(dateValue: string): string {
  const date = new Date(dateValue);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

export function OdometerLogsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<OdometerShiftRow[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [driverFilter, setDriverFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [currentOdometerVehicleId, setCurrentOdometerVehicleId] = useState('all');
  const [currentOdometerValue, setCurrentOdometerValue] = useState<number | null>(null);
    const [latestRecordedAt, setLatestRecordedAt] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const vehicleMap = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach((vehicle) => {
      map.set(vehicle.id, vehicle);
    });
    return map;
  }, [vehicles]);

  const fetchFilters = async () => {
    try {
      const [driverOptions, vehicleOptions] = await Promise.all([listDrivers(), listVehicles()]);
      setDrivers(driverOptions ?? []);
      setVehicles(vehicleOptions ?? []);
    } catch (fetchError) {
      console.error(fetchError);
      setError('Failed to load odometer filters');
    }
  };

  const resolvePhotos = async (row: OdometerShiftRow): Promise<OdometerShiftRow> => {
    const [startPhoto, endPhoto] = await Promise.all([
      getOdometerPhotoUrl({ photoPath: row.start_photo_path }),
      getOdometerPhotoUrl({ photoPath: row.end_photo_path }),
    ]);

    return {
      ...row,
      start_photo_url: startPhoto.url,
      start_photo_error: startPhoto.error,
      end_photo_url: endPhoto.url,
      end_photo_error: endPhoto.error,
    };
  };

  const hydrateShiftState = async (rowsToHydrate: OdometerShiftRow[]): Promise<OdometerShiftRow[]> => {
    const shiftIds = Array.from(new Set(rowsToHydrate.map((row) => row.shift_id).filter(Boolean)));
    if (shiftIds.length === 0) return rowsToHydrate;

    const { data, error: shiftError } = await supabase
      .from('shifts')
      .select('id, status, ended_at')
      .in('id', shiftIds);

    if (shiftError) {
      console.error('Failed to hydrate shift status for odometer rows:', shiftError);
      return rowsToHydrate;
    }

    const shiftMap = new Map(
      ((data as { id: string; status: string | null; ended_at: string | null }[]) ?? []).map((row) => [row.id, row])
    );

    return rowsToHydrate.map((row) => {
      const shift = shiftMap.get(row.shift_id);
      return {
        ...row,
        shift_status: shift?.status ?? null,
        shift_ended_at: shift?.ended_at ?? null,
      };
    });
  };

  const fetchRows = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('odometer_readings_admin')
        .select(
          'shift_id, driver_id, driver_name, vehicle_id, vehicle_rego, start_captured_at, end_captured_at, odometer_start, odometer_end, start_photo_path, end_photo_path',
          { count: 'exact' }
        )
        .order('start_captured_at', { ascending: false, nullsFirst: false });

      if (driverFilter !== 'all') {
        query = query.eq('driver_id', driverFilter);
      }

      if (vehicleFilter !== 'all') {
        query = query.eq('vehicle_id', vehicleFilter);
      }

      if (startDate) {
        query = query.gte('start_captured_at', new Date(startDate).toISOString());
      }

      if (endDate) {
        query = query.lte('start_captured_at', buildDayEndIso(endDate));
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error: fetchError, count } = await query.range(from, to);

      if (fetchError) {
        throw fetchError;
      }

      const hydratedRows = await Promise.all(((data as OdometerShiftRow[]) ?? []).map(resolvePhotos));
      const hydratedWithShiftState = await hydrateShiftState(hydratedRows);
      setRows(hydratedWithShiftState);
      setTotalCount(count ?? 0);
      setError(null);
    } catch (fetchError) {
      console.error(fetchError);
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
  }, [driverFilter, vehicleFilter, startDate, endDate]);

  useEffect(() => {
    fetchRows();
  }, [driverFilter, vehicleFilter, startDate, endDate, page]);

  const fetchCurrentOdometer = async () => {
    try {
      setCurrentOdometerValue(null);
      setLatestRecordedAt(null);

      if (currentOdometerVehicleId === 'all') {
        setCurrentOdometerValue(null);
        return;
      }

      const { data, error: currentError } = await supabase
        .from('vehicle_latest_odometer')
        .select('latest_odometer_value, latest_recorded_at')
        .eq('vehicle_id', currentOdometerVehicleId)
        .single();

      if (currentError) {
        console.error('Failed to load current odometer:', currentError);
        setCurrentOdometerValue(null);
        setLatestRecordedAt(null);
        return;
      }

      setCurrentOdometerValue(data?.latest_odometer_value ?? null);
      setLatestRecordedAt(data?.latest_recorded_at ?? null);
    } catch (err) {
      console.error('Failed to load current odometer:', err);
      setCurrentOdometerValue(null);
      setLatestRecordedAt(null);
    }
  };

  useEffect(() => {
    fetchCurrentOdometer();
  }, [currentOdometerVehicleId]);

  const handlePhotoRetry = async (row: OdometerShiftRow, side: 'start' | 'end') => {
    const photoPath = side === 'start' ? row.start_photo_path : row.end_photo_path;
    clearOdometerPhotoCache(photoPath ?? null);

    const refreshed = await resolvePhotos(row);
    setRows((previous) => previous.map((entry) => (entry.shift_id === row.shift_id ? refreshed : entry)));
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-red-900 bg-red-950">
          <CardContent className="p-4 text-red-400">{error}</CardContent>
        </Card>
      )}

      <div>
        <h1 className="mb-2 text-3xl font-bold text-white">Odometer Logs</h1>
        <p className="text-gray-400">One row per shift with start and end odometer readings, photos, and distance. All times shown in {PERTH_TIME_LABEL}.</p>
      </div>

      <Card className="border-[#D7D3CA] bg-[#FFFEFA]">
        <CardContent className="p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-gray-400">Current Odometer</p>
              <div className="mt-2 w-full md:w-64">
                <Select value={currentOdometerVehicleId} onValueChange={setCurrentOdometerVehicleId}>
                  <SelectTrigger className="border-[#C4C0B7] bg-[#F5F2EB] text-white">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All vehicles</SelectItem>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {formatVehicleLabel(vehicle, vehicle.rego ?? vehicle.plate_number ?? null)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-4xl font-bold text-white">
            {currentOdometerValue != null ? `${currentOdometerValue.toLocaleString()} km` : 'No reading yet'}
            </p>
            {latestRecordedAt && (
              <p className="text-xs text-gray-500">
                Recorded: {formatPerthDateTime(latestRecordedAt)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#D7D3CA] bg-[#FFFEFA]">
        <CardHeader>
          <CardTitle className="text-white">Filters</CardTitle>
          <CardDescription className="text-gray-400">Filter by driver, vehicle, and shift date.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Driver</Label>
            <Select value={driverFilter} onValueChange={setDriverFilter}>
              <SelectTrigger className="border-[#C4C0B7] bg-[#F5F2EB] text-white">
                <SelectValue placeholder="All drivers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All drivers</SelectItem>
                {drivers.map((driver) => (
                  <SelectItem key={driver.driver_id} value={driver.driver_id}>
                    {driver.full_name ?? driver.email ?? driver.profile_email ?? driver.driver_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Vehicle</Label>
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger className="border-[#C4C0B7] bg-[#F5F2EB] text-white">
                <SelectValue placeholder="All vehicles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vehicles</SelectItem>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {formatVehicleLabel(vehicle, vehicle.rego ?? vehicle.plate_number ?? null)}
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
              onChange={(event) => setStartDate(event.target.value)}
              className="border-[#C4C0B7] bg-[#F5F2EB] text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">End date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="border-[#C4C0B7] bg-[#F5F2EB] text-white"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#D7D3CA] bg-[#FFFEFA]">
        <CardHeader>
          <CardTitle className="text-white">Shift Odometers</CardTitle>
          <CardDescription className="text-gray-400">{totalCount} total shifts</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader className="h-8 w-8 animate-spin text-[#BE1C2D]" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#D7D3CA] hover:bg-transparent">
                    <TableHead className="text-gray-400">Driver</TableHead>
                    <TableHead className="text-gray-400">Vehicle</TableHead>
                    <TableHead className="text-gray-400">Shift Time</TableHead>
                    <TableHead className="text-gray-400">Start KM</TableHead>
                    <TableHead className="text-gray-400">End KM</TableHead>
                    <TableHead className="text-gray-400">Distance</TableHead>
                    <TableHead className="text-gray-400">Start Photo</TableHead>
                    <TableHead className="text-gray-400">End Photo</TableHead>
                    <TableHead className="text-right text-gray-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-gray-500">
                        No odometer shifts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const vehicle = row.vehicle_id ? vehicleMap.get(row.vehicle_id) : null;
                      const hasStartReading = row.odometer_start != null;
                      const hasEndReading = row.odometer_end != null;
                      const startReading = row.odometer_start;
                      const endReading = row.odometer_end;
                      const distance =
                        startReading != null && endReading != null
                          ? endReading - startReading
                          : null;
                      const shiftStatus = (row.shift_status ?? '').trim().toLowerCase();
                      const isShiftCompleted =
                        Boolean(row.shift_ended_at) ||
                        ['ended', 'completed', 'cancelled'].includes(shiftStatus);

                      const endKmLabel = hasEndReading
                        ? `${row.odometer_end?.toLocaleString()} km`
                        : isShiftCompleted
                          ? 'Missing end odometer'
                          : 'Pending';

                      const distanceLabel = (() => {
                        if (!hasStartReading) return 'Pending';
                        if (!hasEndReading) return isShiftCompleted ? 'Missing end odometer' : 'Pending';
                        if ((distance ?? 0) < 0) return 'Invalid odometer';
                        return `${(distance ?? 0).toLocaleString()} km`;
                      })();

                      const renderPhotoCell = (
                        title: string,
                        url: string | null | undefined,
                        photoError: string | null | undefined,
                        photoPath: string | null,
                        side: 'start' | 'end'
                      ) => {
                        if (url) {
                          return (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setPreviewImage({ url, title })}
                                className="h-12 w-16 overflow-hidden rounded border border-[#C4C0B7]"
                              >
                                <img src={url} alt={title} className="h-full w-full object-cover" />
                              </button>
                              <Button asChild variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                                <a href={url} download>
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            </div>
                          );
                        }

                        if (!photoPath) {
                          return (
                            <span className="flex items-center gap-2 text-gray-500">
                              <ImageIcon className="h-4 w-4" />
                              No photo
                            </span>
                          );
                        }

                        if (photoError) {
                          return (
                            <div className="flex items-center gap-2 text-sm text-red-400">
                              <span>Photo failed</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-300 hover:text-red-200"
                                onClick={() => handlePhotoRetry(row, side)}
                              >
                                Retry
                              </Button>
                            </div>
                          );
                        }

                        return (
                          <span className="flex items-center gap-2 text-gray-500">
                            <ImageIcon className="h-4 w-4" />
                            No photo
                          </span>
                        );
                      };

                      return (
                        <TableRow key={row.shift_id} className="border-[#D7D3CA]">
                          <TableCell className="text-gray-300">{row.driver_name ?? row.driver_id ?? 'Unknown driver'}</TableCell>
                          <TableCell className="text-gray-300">{formatVehicleLabel(vehicle, row.vehicle_rego)}</TableCell>
                          <TableCell className="text-gray-300">
                            <div className="space-y-1 text-xs">
                              <div>
                                <span className="text-gray-500">Start:</span> {formatDateTime(row.start_captured_at)}
                              </div>
                              <div>
                                <span className="text-gray-500">End:</span> {formatDateTime(row.end_captured_at)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {hasStartReading ? `${row.odometer_start?.toLocaleString()} km` : 'Pending'}
                          </TableCell>
                          <TableCell className={endKmLabel === 'Missing end odometer' ? 'text-amber-300' : 'text-gray-300'}>
                            {endKmLabel}
                          </TableCell>
                          <TableCell className={distanceLabel === 'Invalid odometer' ? 'text-red-400' : 'text-gray-300'}>
                            {distanceLabel}
                          </TableCell>
                          <TableCell>
                            {renderPhotoCell('Start odometer photo', row.start_photo_url, row.start_photo_error, row.start_photo_path, 'start')}
                          </TableCell>
                          <TableCell>
                            {renderPhotoCell('End odometer photo', row.end_photo_url, row.end_photo_error, row.end_photo_path, 'end')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-blue-400 hover:text-blue-300"
                              onClick={() => navigate(`/shifts/${row.shift_id}`)}
                            >
                              View Shift
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-300"
                disabled={page === 1}
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-300"
                disabled={page >= totalPages}
                onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(previewImage)} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl border-[#D7D3CA] bg-[#FFFEFA]">
          <DialogHeader>
            <DialogTitle className="text-white">{previewImage?.title ?? 'Odometer Photo'}</DialogTitle>
          </DialogHeader>
          {previewImage && <img src={previewImage.url} alt={previewImage.title} className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
