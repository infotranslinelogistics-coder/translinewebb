// Shifts management page
import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/app/components/ui/alert-dialog';
import { Search, Clock, Loader } from 'lucide-react';
import { format } from 'date-fns';
import { listShifts, Shift, countActiveShifts, countTodayShifts } from '@/lib/db/shifts';
import { supabase } from '@/lib/supabase';

const formatChecklistLabel = (key: string) =>
  key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

type ShiftEvent = {
  id?: string;
  shift_id: string;
  event_type: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  latitude?: number;
  longitude?: number;
};

type TimelineItem = {
  id: string;
  eventType: string;
  label: string;
  timestamp: string;
  details?: string;
};

type ChecklistDisplayStatus = 'pass' | 'fail' | 'pending';

type ChecklistDisplayItem = {
  key: string;
  label: string;
  status: ChecklistDisplayStatus;
  statusLabel: string;
  valueLabel: string | null;
  notes: string | null;
};

type ChecklistSummary = {
  total: number;
  pass: number;
  fail: number;
  pending: number;
};

type BreakSummary = {
  allowanceSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  isOnBreak: boolean;
  latestBreakAt: string | null;
};

const BREAK_ALLOWANCE_SECONDS = 30 * 60;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const formatTimestamp = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'MMM dd, yyyy HH:mm:ss');
};

const formatDurationSeconds = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

const toDisplayText = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value.map((entry) => toDisplayText(entry)).filter(Boolean) as string[];
    return parts.length > 0 ? parts.join(', ') : null;
  }
  if (isRecord(value)) {
    const preview = Object.entries(value)
      .slice(0, 3)
      .map(([k, v]) => `${formatChecklistLabel(k)}: ${toDisplayText(v) ?? 'Not recorded'}`)
      .join(' | ');
    return preview || null;
  }
  return null;
};

const parseChecklistStatus = (value: unknown): ChecklistDisplayStatus => {
  if (value == null) return 'pending';
  if (typeof value === 'boolean') return value ? 'pass' : 'fail';
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['pass', 'passed', 'ok', 'true', 'yes'].includes(normalized)) return 'pass';
    if (['fail', 'failed', 'false', 'no'].includes(normalized)) return 'fail';
  }
  return 'pending';
};

const getChecklistItem = (key: string, rawValue: unknown): ChecklistDisplayItem => {
  const label = formatChecklistLabel(key);

  if (!isRecord(rawValue)) {
    const status = parseChecklistStatus(rawValue);
    return {
      key,
      label,
      status,
      statusLabel: status === 'pass' ? 'Pass' : status === 'fail' ? 'Fail' : 'Pending',
      valueLabel: status === 'pending' ? toDisplayText(rawValue) ?? 'Not recorded' : null,
      notes: null,
    };
  }

  const statusCandidate = rawValue.status ?? rawValue.result ?? rawValue.outcome ?? rawValue.state ?? rawValue.pass;
  const valueCandidate = rawValue.value ?? rawValue.reading ?? rawValue.answer ?? rawValue.level;
  const notesCandidate = rawValue.notes ?? rawValue.note ?? rawValue.comment ?? rawValue.details;
  const status = parseChecklistStatus(statusCandidate);

  return {
    key,
    label,
    status,
    statusLabel: status === 'pass' ? 'Pass' : status === 'fail' ? 'Fail' : 'Pending',
    valueLabel: toDisplayText(valueCandidate) ?? (status === 'pending' ? 'Not recorded' : null),
    notes: toDisplayText(notesCandidate),
  };
};

const normalizeChecklist = (checklist: Shift['checklist'] | null | undefined): ChecklistDisplayItem[] => {
  if (!isRecord(checklist)) return [];
  return Object.entries(checklist).map(([key, value]) => getChecklistItem(key, value));
};

const getChecklistSummary = (items: ChecklistDisplayItem[] | null | undefined): ChecklistSummary => {
  const safeItems = Array.isArray(items) ? items : [];

  if (safeItems.length === 0) {
    return { total: 0, pass: 0, fail: 0, pending: 0 };
  }

  let pass = 0;
  let fail = 0;
  let pending = 0;
  safeItems.forEach((item) => {
    if (item.status === 'pass') pass += 1;
    else if (item.status === 'fail') fail += 1;
    else pending += 1;
  });

  return {
    total: safeItems.length,
    pass,
    fail,
    pending,
  };
};

const getDurationSecondsFromMetadata = (metadata: Record<string, unknown> | null | undefined): number | null => {
  if (!metadata) return null;
  const candidate = metadata.duration_seconds;
  if (typeof candidate === 'number' && Number.isFinite(candidate)) return Math.max(0, candidate);
  if (typeof candidate === 'string') {
    const parsed = Number(candidate);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return null;
};

const getMetadataDuration = (metadata: Record<string, unknown> | null | undefined): string | null => {
  const seconds = getDurationSecondsFromMetadata(metadata);
  return seconds == null ? null : formatDurationSeconds(seconds);
};

const getLocationSummary = (metadata: Record<string, unknown> | null | undefined): string | null => {
  if (!metadata) return null;
  const lat = metadata.lat ?? metadata.latitude;
  const lng = metadata.lng ?? metadata.longitude;
  const speed = metadata.speed;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (typeof speed === 'number') {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)} (${speed} km/h)`;
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

const getEventLabel = (eventType: string) => {
  switch (eventType) {
    case 'shift_start':
      return 'Shift started';
    case 'shift_end':
      return 'Shift ended';
    case 'break_start':
      return 'Break started';
    case 'break_end':
      return 'Break ended';
    case 'location':
      return 'Location update';
    default:
      return eventType
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
  }
};

const buildTimeline = (shift: Shift, events: ShiftEvent[]): TimelineItem[] => {
  const timeline: TimelineItem[] = [];

  if (shift.started_at) {
    timeline.push({
      id: `${shift.id}-started`,
      eventType: 'shift_start',
      label: 'Shift started',
      timestamp: shift.started_at,
    });
  }

  events.forEach((event, index) => {
    const metadata = isRecord(event.metadata) ? event.metadata : null;
    const durationLabel = event.event_type === 'break_end' ? getMetadataDuration(metadata) : null;
    const locationLabel = getLocationSummary(metadata);
    const details = durationLabel
      ? `Duration: ${durationLabel}`
      : locationLabel ?? undefined;

    timeline.push({
      id: event.id ?? `${event.shift_id}-${event.event_type}-${event.created_at}-${index}`,
      eventType: event.event_type,
      label: getEventLabel(event.event_type),
      timestamp: event.created_at,
      details,
    });
  });

  if (shift.ended_at) {
    timeline.push({
      id: `${shift.id}-ended`,
      eventType: 'shift_end',
      label: 'Shift ended',
      timestamp: shift.ended_at,
    });
  }

  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return timeline;
};

const getBreakSummary = (events: ShiftEvent[]): BreakSummary => {
  const breakEvents = events
    .filter((event) => event.event_type === 'break_start' || event.event_type === 'break_end')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  let openBreakStart: number | null = null;
  let totalSeconds = 0;

  breakEvents.forEach((event) => {
    const eventMs = new Date(event.created_at).getTime();
    if (Number.isNaN(eventMs)) return;

    if (event.event_type === 'break_start') {
      openBreakStart = eventMs;
      return;
    }

    if (openBreakStart != null) {
      totalSeconds += Math.max(0, Math.floor((eventMs - openBreakStart) / 1000));
      openBreakStart = null;
      return;
    }

    const metadata = isRecord(event.metadata) ? event.metadata : null;
    const fallbackDuration = getDurationSecondsFromMetadata(metadata);
    if (fallbackDuration != null) {
      totalSeconds += Math.floor(fallbackDuration);
    }
  });

  const latestBreakEvent = breakEvents.length > 0 ? breakEvents[breakEvents.length - 1] : null;
  const isOnBreak = latestBreakEvent?.event_type === 'break_start';
  const latestBreakAt = latestBreakEvent?.created_at ?? null;

  if (isOnBreak && openBreakStart != null) {
    totalSeconds += Math.max(0, Math.floor((Date.now() - openBreakStart) / 1000));
  }

  return {
    allowanceSeconds: BREAK_ALLOWANCE_SECONDS,
    usedSeconds: totalSeconds,
    remainingSeconds: Math.max(0, BREAK_ALLOWANCE_SECONDS - totalSeconds),
    isOnBreak,
    latestBreakAt,
  };
};

export function ShiftsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'ended'>('all');
  const [activeCount, setActiveCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [endShiftDialog, setEndShiftDialog] = useState(false);
  const [endShiftReason, setEndShiftReason] = useState('');
  const [detailShift, setDetailShift] = useState<Shift | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [shiftEvents, setShiftEvents] = useState<ShiftEvent[]>([]);

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true);
      const [shiftsList, active, today] = await Promise.all([
        listShifts(),
        countActiveShifts(),
        countTodayShifts(),
      ]);
      setShifts(shiftsList);
      setActiveCount(active);
      setTodayCount(today);
      setError(null);
    } catch (err) {
      setError('Failed to load shifts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  useEffect(() => {
    const channel = supabase
      .channel('shifts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
        fetchShifts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchShifts]);

  useEffect(() => {
    const channel = supabase
      .channel('shift-events-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shift_events' }, () => {
        fetchShifts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchShifts]);

  const normalizedQuery = searchQuery.toLowerCase();
  const getDriverDisplay = (shift: Shift) => {
    if (shift.driver_name) return shift.driver_name;
    if (shift.driver_id) return `Missing driver record (${shift.driver_id.slice(0, 8)}...)`;
    return 'No driver linked';
  };
  const getVehicleDisplay = (shift: Shift) => {
    if (shift.vehicle_rego) return shift.vehicle_rego;
    if (shift.vehicle_id) return `Missing vehicle record (${shift.vehicle_id.slice(0, 8)}...)`;
    return 'No vehicle linked';
  };

  const filteredShifts = shifts.filter((shift) => {
    const matchesSearch =
      getDriverDisplay(shift).toLowerCase().includes(normalizedQuery) ||
      getVehicleDisplay(shift).toLowerCase().includes(normalizedQuery) ||
      shift.driver_id.toLowerCase().includes(normalizedQuery) ||
      (shift.vehicle_id ?? '').toLowerCase().includes(normalizedQuery);
    const matchesStatus = filterStatus === 'all' || shift.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleEndShift = async () => {
    if (!selectedShift) return;
    try {
      const { error } = await supabase.rpc('force_end_shift', {
        p_shift_id: selectedShift.id,
        p_reason: endShiftReason || 'Ended by admin',
      });
      if (error) throw error;
      setShifts(shifts.map((s) =>
        s.id === selectedShift.id
          ? { ...s, status: 'ended', ended_at: new Date().toISOString() }
          : s
      ));
      setActiveCount(Math.max(0, activeCount - 1));
      setEndShiftDialog(false);
      setSelectedShift(null);
      setEndShiftReason('');
      setError(null);
    } catch (err) {
      setError('Failed to end shift');
      console.error(err);
    }
  };

  const handleEndShiftDialogChange = (open: boolean) => {
    setEndShiftDialog(open);
    if (!open) setEndShiftReason('');
  };

  const loadShiftDetails = useCallback(async (shift: Shift) => {
    try {
      setDetailsLoading(true);
      setDetailsError(null);
      setDetailShift(shift);
      setDetailsOpen(true);

      const { data, error: fetchError } = await supabase
        .from('shift_events')
        .select('id, shift_id, event_type, created_at, metadata, latitude, longitude')
        .eq('shift_id', shift.id)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      setShiftEvents((data as ShiftEvent[]) ?? []);
    } catch (err) {
      console.error('loadShiftDetails error:', err);
      setDetailsError('Failed to load shift events');
      setShiftEvents([]);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const handleDetailsOpenChange = (open: boolean) => {
    setDetailsOpen(open);
    if (!open) {
      setDetailShift(null);
      setDetailsError(null);
      setShiftEvents([]);
    }
  };

  const checklistItems = normalizeChecklist(detailShift?.checklist ?? null);
  const checklistSummary = getChecklistSummary(checklistItems);
  const timelineItems = detailShift ? buildTimeline(detailShift, shiftEvents) : [];
  const breakSummary = getBreakSummary(shiftEvents);
  const locationItems = shiftEvents
    .filter((event) => event.event_type === 'location');
  const latestLocationItems = locationItems.slice(-5).reverse();

  return (
    <div className="space-y-6">
      {error && (
        <Card className="bg-red-950 border-red-900">
          <CardContent className="p-4 text-red-400">{error}</CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Shifts</h1>
          <p className="text-gray-400">Track driver shifts and checklists</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Active Shifts</p>
            <p className="text-3xl font-bold text-green-400">{loading ? '-' : activeCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Today's Shifts</p>
            <p className="text-3xl font-bold text-white">{loading ? '-' : todayCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Total Shifts</p>
            <p className="text-3xl font-bold text-blue-400">{loading ? '-' : shifts.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#161616] border-gray-800">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-white">All Shifts</CardTitle>
                <CardDescription className="text-gray-400">
                  View shift history and current shifts
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Search shifts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#0F0F0F] border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {(['all', 'active', 'ended'] as const).map((status) => (
                <Button
                  key={status}
                  variant={filterStatus === status ? 'default' : 'outline'}
                  onClick={() => setFilterStatus(status)}
                  className={
                    filterStatus === status
                      ? 'bg-[#FF6B35] hover:bg-[#E55A2B] text-white'
                      : 'border-gray-700 text-gray-400 hover:text-white'
                  }
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader className="w-8 h-8 text-[#FF6B35] animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Driver</TableHead>
                    <TableHead className="text-gray-400">Vehicle</TableHead>
                    <TableHead className="text-gray-400">Start Time</TableHead>
                    <TableHead className="text-gray-400">End Time</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400">Checklist</TableHead>
                    <TableHead className="text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShifts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No shifts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredShifts.map((shift) => {
                      const checklistEntries = normalizeChecklist(shift.checklist);

                      return (
                        <TableRow key={shift.id} className="border-gray-800 align-top">
                          <TableCell className="font-medium text-white">
                            {getDriverDisplay(shift)}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {getVehicleDisplay(shift)}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-500" />
                              {shift.started_at
                                ? format(new Date(shift.started_at), 'MMM dd, HH:mm')
                                : '—'}
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {shift.ended_at
                              ? format(new Date(shift.ended_at), 'MMM dd, HH:mm')
                              : <span className="text-yellow-400">In progress</span>}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                shift.status === 'active'
                                  ? 'bg-green-950 text-green-400 border-green-900 capitalize'
                                  : 'bg-gray-800 text-gray-400 border-gray-700 capitalize'
                              }
                            >
                              {shift.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="min-w-[280px]">
                            {checklistEntries.length === 0 ? (
                              <span className="text-sm text-gray-500">No checklist saved</span>
                            ) : (
                              <div className="space-y-1">
                                {checklistEntries.map((item) => (
                                  <div
                                    key={`${shift.id}-${item.key}`}
                                    className="flex items-center justify-between gap-3 rounded bg-[#0F0F0F] px-2 py-1 text-xs"
                                  >
                                    <span className="text-gray-400">{item.label}</span>
                                    <span
                                      className={
                                        item.status === 'fail'
                                          ? 'font-medium text-red-400'
                                          : item.status === 'pass'
                                            ? 'font-medium text-green-400'
                                            : 'text-yellow-400'
                                      }
                                    >
                                      {item.statusLabel}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-400 hover:text-blue-400 h-8 px-2 text-xs"
                                onClick={() => {
                                  loadShiftDetails(shift);
                                }}
                              >
                                View Details
                              </Button>
                              {shift.status === 'active' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-400 hover:text-red-400 h-8 px-2 text-xs"
                                  onClick={() => {
                                    setSelectedShift(shift);
                                    setEndShiftDialog(true);
                                  }}
                                >
                                  End Shift
                                </Button>
                              )}
                            </div>
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

      <AlertDialog open={endShiftDialog} onOpenChange={handleEndShiftDialogChange}>
        <AlertDialogContent className="bg-[#161616] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">End Shift</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to end the shift for {selectedShift ? getDriverDisplay(selectedShift) : 'this driver'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              value={endShiftReason}
              onChange={(e) => setEndShiftReason(e.target.value)}
              placeholder="Reason (optional)"
              className="bg-[#0F0F0F] border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
          <div className="flex gap-4">
            <AlertDialogCancel className="bg-gray-800 text-gray-300 hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndShift}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              End Shift
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

<Dialog open={detailsOpen} onOpenChange={handleDetailsOpenChange}>
  <DialogContent
    style={{ maxWidth: "1200px" }}
    className="bg-[#161616] border-gray-800 text-white max-h-[90vh] overflow-y-auto"
  >
    <DialogHeader>
      <DialogTitle className="text-lg font-semibold">Shift Details</DialogTitle>
      <DialogDescription className="text-gray-400">
        Full timeline and event breakdown for the selected shift
      </DialogDescription>
    </DialogHeader>

    {!detailShift ? (
      <div className="text-sm text-gray-500">No shift selected.</div>
    ) : (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* LEFT COLUMN */}
        <div className="xl:col-span-2 space-y-4">

          {/* OVERVIEW */}
          <Card className="bg-[#0F0F0F] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Overview</CardTitle>
            </CardHeader>

            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                ["Driver", getDriverDisplay(detailShift)],
                ["Vehicle", getVehicleDisplay(detailShift)],
                ["Start Time", formatTimestamp(detailShift.started_at)],
                ["End Time", formatTimestamp(detailShift.ended_at)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg bg-[#121212] border border-gray-800 px-3 py-2"
                >
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm text-gray-100 truncate">{value}</p>
                </div>
              ))}

              <div className="rounded-lg bg-[#121212] border border-gray-800 px-3 py-2">
                <p className="text-xs text-gray-500">Status</p>
                <Badge
                  className={
                    detailShift.status === "active"
                      ? "bg-green-950 text-green-400 border-green-900 mt-1 capitalize"
                      : "bg-gray-800 text-gray-400 border-gray-700 mt-1 capitalize"
                  }
                >
                  {detailShift.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* GPS */}
          <Card className="bg-[#0F0F0F] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Live GPS Tracking</CardTitle>
              <CardDescription className="text-gray-500">
                Latest location updates from shift events
              </CardDescription>
            </CardHeader>

            <CardContent>
              {detailsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader className="w-5 h-5 text-[#FF6B35] animate-spin" />
                </div>
              ) : latestLocationItems.length === 0 ? (
                <p className="text-sm text-gray-500">No GPS data available</p>
              ) : (
                <div className="space-y-2">
                  {latestLocationItems.map((item) => (
                    <div
                      key={`loc-${item.id}`}
                      className="rounded-lg bg-[#121212] border border-gray-800 px-3 py-2 text-xs"
                    >
                      <div className="flex justify-between text-gray-400">
                        <span>{item.latitude}</span>
                        <span>{item.longitude}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {formatTimestamp(item.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* CHECKLIST + BREAKS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            <Card className="bg-[#0F0F0F] border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Checklist</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#121212] rounded-lg px-2 py-2 text-gray-300">Total: {checklistSummary.total}</div>
                  <div className="bg-[#121212] rounded-lg px-2 py-2 text-green-400">Passed: {checklistSummary.pass}</div>
                  <div className="bg-[#121212] rounded-lg px-2 py-2 text-red-400">Failed: {checklistSummary.fail}</div>
                  <div className="bg-[#121212] rounded-lg px-2 py-2 text-yellow-400">Pending: {checklistSummary.pending}</div>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {checklistItems.map((item) => (
                    <div
                      key={`detail-${detailShift.id}-${item.key}`}
                      className="rounded-lg border border-gray-800 bg-[#121212] px-3 py-2 text-xs"
                    >
                      <div className="flex justify-between">
                        <span className="text-gray-300">{item.label}</span>
                        <span
                          className={
                            item.status === "fail"
                              ? "text-red-400"
                              : item.status === "pass"
                              ? "text-green-400"
                              : "text-yellow-400"
                          }
                        >
                          {item.statusLabel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#0F0F0F] border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Breaks</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3 text-sm">
                <div className="space-y-2 text-xs">
                  <div className="bg-[#121212] rounded-lg px-3 py-2 text-gray-300">
                    Used: {formatDurationSeconds(breakSummary.usedSeconds)}
                  </div>
                  <div className="bg-[#121212] rounded-lg px-3 py-2 text-gray-300">
                    Allowance: {formatDurationSeconds(breakSummary.allowanceSeconds)}
                  </div>
                  <div className="bg-[#121212] rounded-lg px-3 py-2 text-gray-300">
                    Remaining: {formatDurationSeconds(breakSummary.remainingSeconds)}
                  </div>
                  <div className="bg-[#121212] rounded-lg px-3 py-2">
                    <span className="text-gray-400">Status:</span>{" "}
                    <span className={breakSummary.isOnBreak ? "text-yellow-400" : "text-green-400"}>
                      {breakSummary.isOnBreak ? "On break" : "Working"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* RIGHT COLUMN - TIMELINE */}
        <div className="xl:col-span-1">
          <Card className="bg-[#0F0F0F] border-gray-800 h-full">
            <CardHeader>
              <CardTitle className="text-white">Timeline</CardTitle>
              <CardDescription className="text-gray-500">
                Chronological event history
              </CardDescription>
            </CardHeader>

            <CardContent>
              {detailsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader className="w-5 h-5 text-[#FF6B35] animate-spin" />
                </div>
              ) : timelineItems.length === 0 ? (
                <p className="text-sm text-gray-500">No events found</p>
              ) : (
                <div className="space-y-2">
                  {timelineItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-gray-800 bg-[#121212] px-3 py-2"
                    >
                      <div className="flex justify-between">
                        <p className="text-sm text-gray-200">{item.label}</p>
                        <p className="text-xs text-gray-500">
                          {formatTimestamp(item.timestamp)}
                        </p>
                      </div>

                      {item.details && (
                        <p className="text-xs text-gray-400 mt-1">
                          {item.details}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    )}
  </DialogContent>
</Dialog>
    </div>
  );
}
