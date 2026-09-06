import React, { useEffect, useMemo, useState } from 'react';
import { endOfWeek, startOfWeek } from 'date-fns';
import { useNavigate } from 'react-router';
import { Droplets, ExternalLink, Image as ImageIcon, Loader, MapPin, Receipt } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/app/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { listDrivers } from '@/lib/db/drivers';
import { listVehicles, type Vehicle } from '@/lib/db/vehicles';
import { supabase } from '@/lib/supabase';
import { formatPerthDateTime, PERTH_TIME_LABEL } from '@/lib/dateTime';
import { getSignedStorageUrl } from '@/lib/storage/privateFiles';

interface FuelMetadata {
  litres: number | null;
  cost: number | null;
  odometer_km: number | null;
  stationName: string | null;
  receiptPhotoPath: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
}

interface FuelLogRow {
  id: string;
  shift_id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  latitude?: number | null;
  longitude?: number | null;
  receipt_url?: string | null;
  receipt_error?: string | null;
}

interface ShiftLookupRow {
  id: string;
  driver_id: string | null;
  driver_name: string | null;
  vehicle_id: string | null;
  vehicle_rego: string | null;
}

type DriverOption = {
  driver_id?: string | null;
  id?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
};

const PAGE_SIZE = 20;

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return formatPerthDateTime(value);
}

function formatCurrency(value: number | null) {
  return value != null ? `$${value.toFixed(2)}` : '—';
}

function formatLitres(value: number | null) {
  return value != null ? `${value.toFixed(2)} L` : '—';
}

function formatOdometer(value: number | null) {
  return value != null ? `Odometer: ${Math.round(value).toLocaleString()} km` : '—';
}

function isLegacyLocalUri(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('data:') || normalized.startsWith('file:') || normalized.startsWith('blob:');
}

function asStoragePath(value: unknown): string | null {
  const text = toText(value);
  if (!text) return null;
  if (isLegacyLocalUri(text)) return null;
  return text;
}

function getReceiptPath(metadata: Record<string, unknown>): string | null {
  const newPath = asStoragePath(metadata.receipt_photo_path);
  if (newPath) return newPath;

  const legacy = metadata.receipt_urls;
  if (Array.isArray(legacy) && legacy.length > 0) {
    const validPath = legacy.map((entry) => asStoragePath(entry)).find((entry): entry is string => Boolean(entry));
    return validPath ?? null;
  }

  if (typeof legacy === 'string') {
    return asStoragePath(legacy);
  }

  return null;
}

function parseFuelMetadata(row: FuelLogRow): FuelMetadata {
  const metadata = row.metadata ?? {};
  return {
    litres: toNumber(metadata.litres),
    cost: toNumber(metadata.cost),
    odometer_km: toNumber(metadata.odometer_km),
    stationName: toText(metadata.station_name) ?? toText(metadata.location_name),
    receiptPhotoPath: getReceiptPath(metadata),
    lat: toNumber(metadata.lat) ?? toNumber(metadata.latitude) ?? row.latitude ?? null,
    lng: toNumber(metadata.lng) ?? toNumber(metadata.longitude) ?? row.longitude ?? null,
    notes: toText(metadata.notes),
  };
}

function isFuelLogReviewed(row: FuelLogRow) {
  const metadata = row.metadata ?? {};
  return metadata.reviewed === true || metadata.seen === true || typeof metadata.reviewed_at === 'string';
}

function getDriverLabel(driver: DriverOption) {
  return driver.full_name ?? driver.name ?? driver.email ?? driver.driver_id ?? driver.id ?? 'Unknown driver';
}

function getDriverId(driver: DriverOption) {
  return driver.driver_id ?? driver.id ?? null;
}

function endOfSelectedDay(value: string) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

export function FuelLogsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [logs, setLogs] = useState<FuelLogRow[]>([]);
  const [weeklySummaryRows, setWeeklySummaryRows] = useState<FuelLogRow[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [shifts, setShifts] = useState<ShiftLookupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [driverFilter, setDriverFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reviewingIds, setReviewingIds] = useState<string[]>([]);
  const [deleteFuelLogId, setDeleteFuelLogId] = useState<string | null>(null);
  const [deletingFuelLogId, setDeletingFuelLogId] = useState<string | null>(null);

  const driverMap = useMemo(() => {
    const map = new Map<string, DriverOption>();
    drivers.forEach((driver) => {
      const id = getDriverId(driver);
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
    const map = new Map<string, ShiftLookupRow>();
    shifts.forEach((shift) => map.set(shift.id, shift));
    return map;
  }, [shifts]);

  const matchingShiftIds = useMemo(() => {
    const rows = shifts.filter((shift) => {
      const matchesDriver = driverFilter === 'all' || shift.driver_id === driverFilter;
      const matchesVehicle = vehicleFilter === 'all' || shift.vehicle_id === vehicleFilter;
      return matchesDriver && matchesVehicle;
    });
    return rows.map((shift) => shift.id);
  }, [driverFilter, shifts, vehicleFilter]);

  const weeklySummary = useMemo(() => {
    const parsed = weeklySummaryRows.map(parseFuelMetadata);
    const totalFuelLogs = weeklySummaryRows.length;
    const totalLitres = parsed.reduce((sum, row) => sum + (row.litres ?? 0), 0);
    const totalCost = parsed.reduce((sum, row) => sum + (row.cost ?? 0), 0);
    const averageCostPerLitre = totalLitres > 0 ? totalCost / totalLitres : null;

    return {
      totalFuelLogs,
      totalLitres,
      totalCost,
      averageCostPerLitre,
    };
  }, [weeklySummaryRows]);

  const fetchFilters = async () => {
    const [driverOptions, vehicleOptions, shiftOptions] = await Promise.all([
      listDrivers(),
      listVehicles(),
      supabase
        .from('shifts_full')
        .select('id, driver_id, driver_name, vehicle_id, vehicle_rego')
        .order('started_at', { ascending: false }),
    ]);

    if (shiftOptions.error) throw shiftOptions.error;
    setDrivers(driverOptions ?? []);
    setVehicles(vehicleOptions ?? []);
    setShifts((shiftOptions.data as ShiftLookupRow[]) ?? []);
  };

  const resolveReceipt = async (row: FuelLogRow) => {
    const metadata = row.metadata ?? {};
    const receiptPath = getReceiptPath(metadata);

    console.log('[FuelLogs receipt]', {
      id: row.id,
      receipt_photo_path: metadata?.receipt_photo_path,
      receipt_urls: metadata?.receipt_urls,
      chosenPath: receiptPath,
    });

    if (!receiptPath) {
      return {
        ...row,
        receipt_url: null,
        receipt_error: null,
      };
    }

    const signed = await getSignedStorageUrl({
      filePath: receiptPath,
      bucket: 'fuel_receipts',
      bucketCandidates: ['fuel_receipts', 'receipts', 'shift_event_receipts', 'event_receipts'],
      expiresInSeconds: 3600,
    });

    return {
      ...row,
      receipt_url: signed.url ?? null,
      receipt_error: signed.error ?? null,
    };
  };

  const buildFuelLogsQuery = ({ withCount = false, weeklyOnly = false }: { withCount?: boolean; weeklyOnly?: boolean } = {}) => {
    let query = supabase
      .from('shift_events')
      .select('id, shift_id, created_at, metadata, latitude, longitude', withCount ? { count: 'exact' } : undefined)
      .eq('event_type', 'fuel_log')
      .order('created_at', { ascending: false });

    if (driverFilter !== 'all' || vehicleFilter !== 'all') {
      if (matchingShiftIds.length === 0) {
        return null;
      }
      query = query.in('shift_id', matchingShiftIds);
    }

    if (weeklyOnly) {
      query = query
        .gte('created_at', startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString())
        .lte('created_at', endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString());
    } else {
      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endOfSelectedDay(endDate));
      }
    }

    return query;
  };

  const updateFuelLogRow = (rowId: string, updater: (row: FuelLogRow) => FuelLogRow) => {
    setLogs((current) => current.map((row) => (row.id === rowId ? updater(row) : row)));
    setWeeklySummaryRows((current) => current.map((row) => (row.id === rowId ? updater(row) : row)));
  };

  const handleToggleReviewed = async (row: FuelLogRow) => {
    const reviewed = isFuelLogReviewed(row);
    const nextMetadata: Record<string, unknown> = {
      ...(row.metadata ?? {}),
      reviewed: !reviewed,
      seen: !reviewed,
      reviewed_at: !reviewed ? new Date().toISOString() : null,
      reviewed_by: !reviewed ? (user?.email ?? user?.id ?? null) : null,
    };

    setReviewingIds((current) => [...current, row.id]);

    try {
      const { error: updateError } = await supabase
        .from('shift_events')
        .update({ metadata: nextMetadata })
        .eq('id', row.id);

      if (updateError) throw updateError;

      updateFuelLogRow(row.id, (currentRow) => ({
        ...currentRow,
        metadata: nextMetadata,
      }));
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to update fuel log review status');
    } finally {
      setReviewingIds((current) => current.filter((id) => id !== row.id));
    }
  };

  const fetchFuelLogs = async () => {
    try {
      setLoading(true);

      const basePagedQuery = buildFuelLogsQuery({ withCount: true });

      const baseWeeklySummaryQuery = buildFuelLogsQuery({ weeklyOnly: true });

      if (!basePagedQuery || !baseWeeklySummaryQuery) {
        setLogs([]);
        setWeeklySummaryRows([]);
        setTotalCount(0);
        setError(null);
        return;
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const [{ data, error: listError, count }, { data: weeklyData, error: weeklyError }] = await Promise.all([
        basePagedQuery.range(from, to),
        baseWeeklySummaryQuery,
      ]);

      if (listError) throw listError;
      if (weeklyError) throw weeklyError;

      const rows = (data as FuelLogRow[]) ?? [];
      const resolvedRows = await Promise.all(rows.map(resolveReceipt));

      setLogs(resolvedRows);
      setWeeklySummaryRows((weeklyData as FuelLogRow[]) ?? []);
      setTotalCount(count ?? 0);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load fuel logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters().catch((err) => {
      console.error(err);
      setError('Failed to load fuel log filters');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [driverFilter, vehicleFilter, startDate, endDate]);

  useEffect(() => {
    if (shifts.length === 0 && (driverFilter !== 'all' || vehicleFilter !== 'all')) {
      return;
    }
    fetchFuelLogs();
  }, [driverFilter, vehicleFilter, startDate, endDate, page, shifts]);

  const handleDeleteFuelLog = async () => {
    if (!deleteFuelLogId) return;

    const eventId = deleteFuelLogId;
    setDeletingFuelLogId(eventId);

    try {
      const { error: deleteError } = await supabase.rpc('delete_fuel_log_admin', {
        p_event_id: eventId,
      });

      if (deleteError) {
        console.error('delete_fuel_log_admin RPC error', {
          eventId,
          code: deleteError.code,
          message: deleteError.message,
          details: deleteError.details,
          hint: deleteError.hint,
        });
        throw deleteError;
      }

      await fetchFuelLogs();
      setDeleteFuelLogId(null);
      setError(null);
    } catch (err) {
      console.error('handleDeleteFuelLog failed', {
        eventId,
        error: err,
      });
      setError('Failed to delete fuel log');
      setDeleteFuelLogId(null);
    } finally {
      setDeletingFuelLogId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {error && (
        <Card className="bg-red-950 border-red-900">
          <CardContent className="p-4 text-red-400">{error}</CardContent>
        </Card>
      )}

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Fuel Logs</h1>
        <p className="text-gray-400">Fuel purchases recorded from shift events</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
          <CardContent className="p-6 flex items-center gap-3">
            <Receipt className="w-8 h-8 text-[#BE1C2D]" />
            <div>
              <p className="text-sm text-gray-400 mb-1">Weekly Fuel Logs</p>
              <p className="text-3xl font-bold text-white">{weeklySummary.totalFuelLogs}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
          <CardContent className="p-6 flex items-center gap-3">
            <Droplets className="w-8 h-8 text-blue-400" />
            <div>
              <p className="text-sm text-gray-400 mb-1">Weekly Litres</p>
              <p className="text-3xl font-bold text-white">{weeklySummary.totalLitres.toFixed(2)} L</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
          <CardContent className="p-6 flex items-center gap-3">
            <Receipt className="w-8 h-8 text-green-400" />
            <div>
              <p className="text-sm text-gray-400 mb-1">Weekly Cost</p>
              <p className="text-3xl font-bold text-white">{formatCurrency(weeklySummary.totalCost)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
          <CardContent className="p-6 flex items-center gap-3">
            <Droplets className="w-8 h-8 text-yellow-400" />
            <div>
              <p className="text-sm text-gray-400 mb-1">Weekly Avg / Litre</p>
              <p className="text-3xl font-bold text-white">{weeklySummary.averageCostPerLitre != null ? `$${weeklySummary.averageCostPerLitre.toFixed(2)}` : '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
        <CardHeader>
          <CardTitle className="text-white">Filters</CardTitle>
          <CardDescription className="text-gray-400">Refine fuel logs by driver, vehicle, and date range. All times shown in {PERTH_TIME_LABEL}.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Driver</Label>
            <Select value={driverFilter} onValueChange={setDriverFilter}>
              <SelectTrigger className="bg-[#F5F2EB] border-[#C4C0B7] text-white">
                <SelectValue placeholder="All drivers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All drivers</SelectItem>
                {drivers.map((driver) => {
                  const id = getDriverId(driver);
                  if (!id) return null;
                  return (
                    <SelectItem key={id} value={id}>
                      {getDriverLabel(driver)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Vehicle</Label>
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger className="bg-[#F5F2EB] border-[#C4C0B7] text-white">
                <SelectValue placeholder="All vehicles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vehicles</SelectItem>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.rego} {vehicle.make || vehicle.model ? `• ${[vehicle.make, vehicle.model].filter(Boolean).join(' ')}` : ''}
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
              className="bg-[#F5F2EB] border-[#C4C0B7] text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">End date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="bg-[#F5F2EB] border-[#C4C0B7] text-white"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
        <CardHeader>
          <CardTitle className="text-white">Fuel Log Entries</CardTitle>
          <CardDescription className="text-gray-400">Receipt-backed fuel events captured during shifts</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader className="w-8 h-8 text-[#BE1C2D] animate-spin" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#D7D3CA] hover:bg-transparent">
                    <TableHead className="text-gray-400">Created</TableHead>
                    <TableHead className="text-gray-400">Driver</TableHead>
                    <TableHead className="text-gray-400">Vehicle</TableHead>
                    <TableHead className="text-gray-400">Shift</TableHead>
                    <TableHead className="text-gray-400">Litres</TableHead>
                    <TableHead className="text-gray-400">Cost</TableHead>
                    <TableHead className="text-gray-400">Odometer</TableHead>
                    <TableHead className="text-gray-400">Station</TableHead>
                    <TableHead className="text-gray-400">Location</TableHead>
                    <TableHead className="text-gray-400">Receipt</TableHead>
                    <TableHead className="text-gray-400">Seen</TableHead>
                    <TableHead className="text-gray-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8 text-gray-500">No fuel logs found.</TableCell>
                    </TableRow>
                  ) : logs.map((row) => {
                    const metadata = parseFuelMetadata(row);
                    const shiftId = row.shift_id ?? '';
                    const shift = shiftId ? shiftMap.get(shiftId) : undefined;
                    const driver = shift?.driver_id ? driverMap.get(shift.driver_id) : null;
                    const vehicle = shift?.vehicle_id ? vehicleMap.get(shift.vehicle_id) : null;
                    const driverLabel = shift?.driver_name ?? (driver ? getDriverLabel(driver) : '—');
                    const vehicleLabel = shift?.vehicle_rego ?? vehicle?.rego ?? '—';
                    const hasCoords = metadata.lat != null && metadata.lng != null;
                    const reviewed = isFuelLogReviewed(row);
                    const reviewing = reviewingIds.includes(row.id);

                    return (
                      <TableRow key={row.id} className="border-[#D7D3CA]">
                        <TableCell className="text-gray-300">{formatDateTime(row.created_at)}</TableCell>
                        <TableCell className="text-gray-300">{driverLabel}</TableCell>
                        <TableCell className="text-gray-300">{vehicleLabel}</TableCell>
                        <TableCell className="text-gray-300">
                          <div className="flex flex-col items-start gap-2">
                            <span className="text-xs text-gray-500">{shiftId ? `${shiftId.slice(0, 8)}...` : '—'}</span>
                            <Button
                              size="sm"
                              className="bg-[#BE1C2D] text-white hover:bg-[#e55a25] text-xs"
                              disabled={!shiftId}
                              onClick={() => {
                                if (!shiftId) return;
                                navigate(`/shifts/${shiftId}`);
                              }}
                            >
                              View Shift
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-300">{formatLitres(metadata.litres)}</TableCell>
                        <TableCell className="text-gray-300">{formatCurrency(metadata.cost)}</TableCell>
                        <TableCell className="text-gray-300">{formatOdometer(metadata.odometer_km)}</TableCell>
                        <TableCell className="text-gray-300">
                          <div className="max-w-[16rem]">
                            <p>{metadata.stationName ?? '—'}</p>
                            {metadata.notes && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{metadata.notes}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-300 text-xs">
                          {hasCoords ? (
                            <div className="space-y-1">
                              <p>{metadata.lat?.toFixed(5)}, {metadata.lng?.toFixed(5)}</p>
                              <a
                                href={`https://www.google.com/maps?q=${metadata.lat},${metadata.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#BE1C2D] hover:underline"
                              >
                                <MapPin className="w-3 h-3" />
                                Open in Maps
                              </a>
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {row.receipt_url ? (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                className="bg-[#BE1C2D] text-white hover:bg-[#e55a25] text-xs"
                                onClick={() => setPreviewUrl(row.receipt_url ?? null)}
                              >
                                <ImageIcon className="w-3.5 h-3.5 mr-1" />
                                View Receipt
                              </Button>
                              <a
                                href={row.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#BE1C2D] hover:underline inline-flex items-center gap-1 text-xs"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Open
                              </a>
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          <div className="flex flex-col items-start gap-2">
                            <Badge className={reviewed ? 'bg-green-950 text-green-400 border-green-900' : 'bg-gray-900 text-gray-300 border-[#C4C0B7]'}>
                              {reviewed ? 'Seen' : 'Unseen'}
                            </Badge>
                            <Button
                              size="sm"
                              className="bg-[#BE1C2D] text-white hover:bg-[#e55a25] text-xs"
                              disabled={reviewing}
                              onClick={() => handleToggleReviewed(row)}
                            >
                              {reviewing ? 'Saving...' : reviewed ? 'Mark Unseen' : 'Mark Seen'}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-300">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="bg-red-700 text-white hover:bg-red-600 text-xs"
                            disabled={deletingFuelLogId === row.id}
                            onClick={() => setDeleteFuelLogId(row.id)}
                          >
                            {deletingFuelLogId === row.id ? 'Deleting...' : 'Delete Fuel Log'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300"
                    disabled={page === 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(previewUrl)} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="bg-[#FFFEFA] border-[#D7D3CA] max-w-3xl [&>button]:text-[#BE1C2D] [&>button:hover]:text-[#e55a25]">
          <DialogHeader>
            <DialogTitle className="text-white">Fuel Receipt</DialogTitle>
          </DialogHeader>
          {previewUrl ? (
            <img src={previewUrl} alt="Fuel receipt" className="w-full max-h-[75vh] object-contain rounded-lg border border-[#D7D3CA]" />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteFuelLogId)} onOpenChange={(open) => !open && setDeleteFuelLogId(null)}>
        <AlertDialogContent className="bg-[#FFFEFA] border-[#D7D3CA]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Fuel Log</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will delete the selected fuel log event. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-4">
            <AlertDialogCancel className="bg-gray-800 text-gray-300 hover:bg-gray-700" disabled={Boolean(deletingFuelLogId)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFuelLog}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={Boolean(deletingFuelLogId)}
            >
              {deletingFuelLogId ? 'Deleting...' : 'Delete Fuel Log'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}