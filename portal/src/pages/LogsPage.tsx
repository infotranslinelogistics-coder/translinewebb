import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader,
  MapPin,
  Search,
  Wrench,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { formatPerthDateTime, PERTH_TIME_LABEL } from '@/lib/dateTime';

type LogType = 'incident' | 'maintenance' | 'accident' | 'general';
type FilterType = 'all' | LogType;

type DriverLogRow = {
  id: string;
  shift_id: string | null;
  driver_name: string | null;
  vehicle_rego: string | null;
  description: string;
  category: LogType;
  severity: string;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  photo_path: string | null;
  photo_url?: string | null;
};

const PHOTO_BUCKET = 'driver_log_photos';

function toText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeLogType(value: unknown): LogType {
  const text = (toText(value) ?? '').toLowerCase();
  if (text.includes('incident')) return 'incident';
  if (text.includes('maintenance')) return 'maintenance';
  if (text.includes('accident')) return 'accident';
  return 'general';
}

function formatDateTime(value: string): string {
  return formatPerthDateTime(value);
}

function getTypeLabel(type: LogType): string {
  switch (type) {
    case 'incident':
      return 'Incidents';
    case 'maintenance':
      return 'Maintenance';
    case 'accident':
      return 'Accidents';
    default:
      return 'General';
  }
}

function getTypeIcon(type: LogType) {
  switch (type) {
    case 'incident':
      return AlertCircle;
    case 'maintenance':
      return Wrench;
    case 'accident':
      return AlertTriangle;
    default:
      return FileText;
  }
}

function getTypeBadge(type: LogType): string {
  switch (type) {
    case 'incident':
      return 'bg-orange-950 text-orange-400 border-orange-900';
    case 'maintenance':
      return 'bg-yellow-950 text-yellow-400 border-yellow-900';
    case 'accident':
      return 'bg-red-950 text-red-400 border-red-900';
    default:
      return 'bg-blue-950 text-blue-400 border-blue-900';
  }
}

function getSeverityBadge(severity: string): string {
  const normalized = severity.toLowerCase();
  if (normalized === 'high') return 'bg-red-950 text-red-400 border-red-900';
  if (normalized === 'medium') return 'bg-yellow-950 text-yellow-400 border-yellow-900';
  if (normalized === 'low') return 'bg-blue-950 text-blue-400 border-blue-900';
  return 'bg-gray-800 text-gray-300 border-[#C4C0B7]';
}

function mapFromRecord(row: Record<string, unknown>): DriverLogRow {
  const metadata = row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {};

  return {
    id: String(row.id),
    shift_id: toText(row.shift_id),
    driver_name: toText(row.driver_name) ?? toText(metadata.driver_name),
    vehicle_rego:
      toText(row.vehicle_rego) ??
      toText(row.vehicle_plate) ??
      toText(metadata.vehicle_rego) ??
      toText(metadata.vehicle_plate),
    description:
      toText(row.description) ?? toText(row.notes) ?? toText(metadata.description) ?? toText(metadata.notes) ?? '—',
    category: normalizeLogType(
      row.category ?? row.log_type ?? row.type ?? row.event_type ?? metadata.category ?? metadata.log_type,
    ),
    severity: toText(row.severity) ?? toText(metadata.severity) ?? 'low',
    created_at: toText(row.created_at) ?? new Date().toISOString(),
    latitude: toNumber(row.latitude) ?? toNumber(row.lat) ?? toNumber(metadata.latitude) ?? toNumber(metadata.lat),
    longitude: toNumber(row.longitude) ?? toNumber(row.lng) ?? toNumber(metadata.longitude) ?? toNumber(metadata.lng),
    photo_path: toText(row.photo_path) ?? toText(metadata.photo_path),
  };
}

async function withSignedPhotoUrl(row: DriverLogRow): Promise<DriverLogRow> {
  if (!row.photo_path) return { ...row, photo_url: null };

  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(row.photo_path, 3600);
  if (error || !data?.signedUrl) {
    console.error('[Logs photo] failed to create signed url', { path: row.photo_path, error });
    return { ...row, photo_url: null };
  }

  return { ...row, photo_url: data.signedUrl };
}

export function LogsPage() {
  const [logs, setLogs] = useState<DriverLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);

      const { data: viewData, error: viewError } = await supabase
        .from('driver_logs_admin')
        .select('*')
        .order('created_at', { ascending: false });

      let sourceRows: Record<string, unknown>[] = [];

      if (viewError) {
        console.error('driver_logs_admin query failed, falling back to shift_events', viewError);

        const { data: fallbackData, error: fallbackError } = await supabase
          .from('shift_events')
          .select('id, shift_id, created_at, metadata, latitude, longitude')
          .eq('event_type', 'driver_log')
          .order('created_at', { ascending: false });

        if (fallbackError) throw fallbackError;
        sourceRows = ((fallbackData ?? []) as Record<string, unknown>[]).map((row) => ({
          ...row,
          event_type: 'driver_log',
        }));
      } else {
        sourceRows = (viewData ?? []) as Record<string, unknown>[];
      }

      const mappedRows = sourceRows.map(mapFromRecord);
      const hydratedRows = await Promise.all(mappedRows.map(withSignedPhotoUrl));
      setLogs(hydratedRows);
      setError(null);
    } catch (err) {
      console.error('Failed to load logs', err);
      setLogs([]);
      setError('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const summary = useMemo(() => {
    const incidents = logs.filter((log) => log.category === 'incident').length;
    const maintenance = logs.filter((log) => log.category === 'maintenance').length;
    const accidents = logs.filter((log) => log.category === 'accident').length;

    return {
      total: logs.length,
      incidents,
      maintenance,
      accidents,
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      if (filterType !== 'all' && log.category !== filterType) return false;
      if (!query) return true;

      const haystack = [log.description, log.driver_name ?? '', log.vehicle_rego ?? ''].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [filterType, logs, searchQuery]);

  const handleDeleteLog = async () => {
    if (!deleteLogId) return;

    const logId = deleteLogId;
    setDeletingLogId(logId);

    try {
      const { error: deleteError } = await supabase.rpc('delete_driver_log_admin', {
        p_event_id: logId,
      });

      if (deleteError) {
        console.error('delete_driver_log_admin RPC error', {
          logId,
          code: deleteError.code,
          message: deleteError.message,
          details: deleteError.details,
          hint: deleteError.hint,
        });
        throw deleteError;
      }

      await fetchLogs();
      setDeleteLogId(null);
      setError(null);
    } catch (err) {
      console.error('handleDeleteLog failed', {
        logId,
        error: err,
      });
      setError('Failed to delete log');
      setDeleteLogId(null);
    } finally {
      setDeletingLogId(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Card className="bg-red-950 border-red-900">
          <CardContent className="p-4 text-red-400">{error}</CardContent>
        </Card>
      )}

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Logs</h1>
        <p className="text-gray-400">Driver logs and reports. All times shown in {PERTH_TIME_LABEL}.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Total Logs</p>
            <p className="text-3xl font-bold text-white">{summary.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Incidents</p>
            <p className="text-3xl font-bold text-orange-400">{summary.incidents}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Maintenance</p>
            <p className="text-3xl font-bold text-yellow-400">{summary.maintenance}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Accidents</p>
            <p className="text-3xl font-bold text-red-400">{summary.accidents}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-white">All Logs</CardTitle>
                <CardDescription className="text-gray-400">Search by description, driver, or vehicle in {PERTH_TIME_LABEL}</CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-10 bg-[#F5F2EB] border-[#C4C0B7] text-white placeholder:text-gray-500"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'incident', 'maintenance', 'accident', 'general'] as FilterType[]).map((type) => (
                <Button
                  key={type}
                  variant={filterType === type ? 'default' : 'outline'}
                  onClick={() => setFilterType(type)}
                  className={
                    filterType === type
                      ? 'bg-[#BE1C2D] hover:bg-[#A81828] text-white'
                      : 'border-[#C4C0B7] text-gray-400 hover:text-white'
                  }
                >
                  {type === 'all'
                    ? 'All'
                    : type === 'incident'
                      ? 'Incidents'
                      : type === 'maintenance'
                        ? 'Maintenance'
                        : type === 'accident'
                          ? 'Accidents'
                          : 'General'}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader className="w-8 h-8 text-[#BE1C2D] animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#D7D3CA] hover:bg-transparent">
                    <TableHead className="text-gray-400">Type/category</TableHead>
                    <TableHead className="text-gray-400">Driver</TableHead>
                    <TableHead className="text-gray-400">Vehicle</TableHead>
                    <TableHead className="text-gray-400">Description</TableHead>
                    <TableHead className="text-gray-400">Date/time</TableHead>
                    <TableHead className="text-gray-400">Severity</TableHead>
                    <TableHead className="text-gray-400">Location / Maps</TableHead>
                    <TableHead className="text-gray-400">Photo</TableHead>
                    <TableHead className="text-gray-400">Shift</TableHead>
                    <TableHead className="text-right text-gray-400">Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                        No logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => {
                      const Icon = getTypeIcon(log.category);
                      const hasLocation = log.latitude != null && log.longitude != null;

                      return (
                        <TableRow key={log.id} className="border-[#D7D3CA]">
                          <TableCell>
                            <Badge className={getTypeBadge(log.category)}>
                              <Icon className="w-3 h-3 mr-1" />
                              {getTypeLabel(log.category)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-300">{log.driver_name ?? '—'}</TableCell>
                          <TableCell className="text-gray-300">{log.vehicle_rego ?? '—'}</TableCell>
                          <TableCell className="text-gray-300 max-w-[24rem]">{log.description}</TableCell>
                          <TableCell className="text-gray-300">{formatDateTime(log.created_at)}</TableCell>
                          <TableCell>
                            <Badge className={getSeverityBadge(log.severity)}>{log.severity}</Badge>
                          </TableCell>
                          <TableCell className="text-gray-300 text-xs">
                            {hasLocation ? (
                              <div className="space-y-1">
                                <p>
                                  {log.latitude?.toFixed(5)}, {log.longitude?.toFixed(5)}
                                </p>
                                <a
                                  href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[#BE1C2D] hover:underline"
                                >
                                  <MapPin className="w-3 h-3" />
                                  Open in Maps
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            {log.photo_path && log.photo_url ? (
                              <Button
                                size="sm"
                                className="bg-[#BE1C2D] text-white hover:bg-[#e55a25] text-xs"
                                onClick={() => setPreviewUrl(log.photo_url ?? null)}
                              >
                                <ImageIcon className="w-3.5 h-3.5 mr-1" />
                                View
                              </Button>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            {log.shift_id ? (
                              <Button asChild size="sm" className="bg-[#BE1C2D] text-white hover:bg-[#e55a25] text-xs">
                                <Link to={`/shifts/${log.shift_id}`}>Shift Details</Link>
                              </Button>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="bg-red-700 text-white hover:bg-red-600 text-xs"
                              disabled={deletingLogId === log.id}
                              onClick={() => setDeleteLogId(log.id)}
                            >
                              {deletingLogId === log.id ? 'Deleting...' : 'Delete Log'}
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
        </CardContent>
      </Card>

      <Dialog open={Boolean(previewUrl)} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="bg-[#FFFEFA] border-[#D7D3CA] max-w-3xl [&>button]:text-[#BE1C2D] [&>button:hover]:text-[#e55a25]">
          <DialogHeader>
            <DialogTitle className="text-white">Driver Log Photo</DialogTitle>
          </DialogHeader>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Driver log"
              className="w-full max-h-[75vh] object-contain rounded-lg border border-[#D7D3CA]"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteLogId)} onOpenChange={(open) => !open && setDeleteLogId(null)}>
        <AlertDialogContent className="bg-[#FFFEFA] border-[#D7D3CA]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Log</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will permanently delete the selected log. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-4">
            <AlertDialogCancel className="bg-gray-800 text-gray-300 hover:bg-gray-700" disabled={Boolean(deletingLogId)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLog}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={Boolean(deletingLogId)}
            >
              {deletingLogId ? 'Deleting...' : 'Delete Log'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
