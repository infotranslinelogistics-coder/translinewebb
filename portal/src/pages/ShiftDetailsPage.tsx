import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Loader } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/app/components/ui/alert-dialog';
import { fetchShiftWithEvents, type Shift, type ShiftEvent, type ShiftFull } from '@/lib/db/shifts';
import { supabase } from '@/lib/supabase';
import { getOdometerPhotoUrl } from '@/lib/storage/odometerPhotos';
import { formatPerthDateTime, PERTH_TIME_LABEL } from '@/lib/dateTime';

function formatTimestamp(value?: string | null) {
  if (!value) return '—';
  return formatPerthDateTime(value);
}

function eventLabel(eventType: string) {
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
}

function eventDetails(event: ShiftEvent) {
  if (event.event_type === 'location' && event.latitude != null && event.longitude != null) {
    const flagged = isLikelyDefaultCoordinate(event.latitude, event.longitude);
    return flagged
      ? `${event.latitude.toFixed(5)}, ${event.longitude.toFixed(5)} (Invalid/default coordinate)`
      : `${event.latitude.toFixed(5)}, ${event.longitude.toFixed(5)}`;
  }

  if (event.metadata && typeof event.metadata === 'object') {
    const metadata = event.metadata as Record<string, unknown>;
    const reason = metadata.reason;
    if (typeof reason === 'string' && reason.trim().length > 0) {
      return reason;
    }
  }

  return null;
}

type ChecklistDisplayStatus = 'pass' | 'fail' | 'pending';

type ChecklistDisplayItem = {
  key: string;
  label: string;
  status: ChecklistDisplayStatus;
  statusLabel: string;
  valueLabel: string | null;
  notes: string | null;
};

type BreakSession = {
  startAt: string;
  endAt: string | null;
  durationSeconds: number;
  isOpen: boolean;
};

type BreakSummaryStatus = 'none' | 'on-break' | 'completed';

type BreakSummary = {
  status: BreakSummaryStatus;
  sessions: BreakSession[];
  totalBreakSeconds: number;
  currentBreakSeconds: number | null;
  latestBreakStartAt: string | null;
  latestBreakEndAt: string | null;
};

const CHECKLIST_EVENT_TYPES = ['checklist_submitted', 'checklist_completed', 'shift_checklist_submitted'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const formatChecklistLabel = (key: string) =>
  key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const toDisplayText = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isLikelyDefaultCoordinate = (latitude?: number | null, longitude?: number | null) => {
  if (latitude == null || longitude == null) return false;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;

  const nearGoogleHq = Math.abs(lat - 37.422) <= 0.005 && Math.abs(lng - -122.084) <= 0.005;
  const invalidRange = lat < -90 || lat > 90 || lng < -180 || lng > 180;
  const zeroCoordinate = Math.abs(lat) < 0.00001 && Math.abs(lng) < 0.00001;

  return nearGoogleHq || invalidRange || zeroCoordinate;
};

const formatCoordinateText = (latitude?: number | null, longitude?: number | null) => {
  if (latitude == null || longitude == null) return 'Pending';
  const coords = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  return isLikelyDefaultCoordinate(latitude, longitude) ? `${coords} (Invalid/default coordinate)` : coords;
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

const getChecklistAnswersFromMetadata = (metadata: Record<string, unknown> | null | undefined): Record<string, unknown> | null => {
  if (!metadata) return null;
  const directAnswers = metadata.answers;
  if (isRecord(directAnswers)) return directAnswers;
  const directChecklist = metadata.checklist;
  if (isRecord(directChecklist)) return directChecklist;
  const checklistSnapshot = metadata.checklist_snapshot;
  if (isRecord(checklistSnapshot)) return checklistSnapshot;
  const checklistPayload = metadata.checklist_payload;
  if (isRecord(checklistPayload)) return checklistPayload;
  return null;
};

const mergeChecklistSources = (
  primary: Record<string, unknown> | null,
  secondary: Shift['checklist'] | null | undefined
): ChecklistDisplayItem[] => {
  const merged = new Map<string, unknown>();

  if (isRecord(secondary)) {
    Object.entries(secondary).forEach(([key, value]) => {
      merged.set(key, value);
    });
  }

  if (isRecord(primary)) {
    Object.entries(primary).forEach(([key, value]) => {
      merged.set(key, value);
    });
  }

  return Array.from(merged.entries()).map(([key, value]) => getChecklistItem(key, value));
};

const getLatestChecklistEvent = (events: ShiftEvent[]): ShiftEvent | null => {
  const checklistEvents = events.filter((event) => CHECKLIST_EVENT_TYPES.includes(event.event_type));
  if (checklistEvents.length === 0) return null;
  return checklistEvents.reduce<ShiftEvent | null>((latest, event) => {
    if (!latest) return event;
    return new Date(event.created_at).getTime() >= new Date(latest.created_at).getTime() ? event : latest;
  }, null);
};

const normalizeChecklist = (checklist: Shift['checklist'] | null | undefined): ChecklistDisplayItem[] => {
  if (!isRecord(checklist)) return [];
  return Object.entries(checklist).map(([key, value]) => getChecklistItem(key, value));
};

const formatDuration = (totalSeconds: number | null | undefined) => {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return '—';
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
};

const getBreakSummary = (events: ShiftEvent[]): BreakSummary => {
  const breakEvents = events
    .filter((event) => event.event_type === 'break_start' || event.event_type === 'break_end')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (breakEvents.length === 0) {
    return {
      status: 'none',
      sessions: [],
      totalBreakSeconds: 0,
      currentBreakSeconds: null,
      latestBreakStartAt: null,
      latestBreakEndAt: null,
    };
  }

  const sessions: BreakSession[] = [];
  let openBreakStartAt: string | null = null;
  let totalBreakSeconds = 0;
  let latestBreakStartAt: string | null = null;
  let latestBreakEndAt: string | null = null;

  breakEvents.forEach((event) => {
    const eventMs = new Date(event.created_at).getTime();
    if (Number.isNaN(eventMs)) return;

    if (event.event_type === 'break_start') {
      if (openBreakStartAt) {
        return;
      }
      openBreakStartAt = event.created_at;
      latestBreakStartAt = event.created_at;
      return;
    }

    latestBreakEndAt = event.created_at;

    if (!openBreakStartAt) {
      return;
    }

    const startMs = new Date(openBreakStartAt).getTime();
    if (Number.isNaN(startMs)) {
      openBreakStartAt = null;
      return;
    }

    const durationSeconds = Math.max(0, Math.floor((eventMs - startMs) / 1000));
    sessions.push({
      startAt: openBreakStartAt,
      endAt: event.created_at,
      durationSeconds,
      isOpen: false,
    });
    totalBreakSeconds += durationSeconds;
    openBreakStartAt = null;
  });

  let currentBreakSeconds: number | null = null;

  if (openBreakStartAt) {
    const startMs = new Date(openBreakStartAt).getTime();
    if (!Number.isNaN(startMs)) {
      currentBreakSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      totalBreakSeconds += currentBreakSeconds;
      sessions.push({
        startAt: openBreakStartAt,
        endAt: null,
        durationSeconds: currentBreakSeconds,
        isOpen: true,
      });
    }
  }

  return {
    status: openBreakStartAt ? 'on-break' : 'completed',
    sessions,
    totalBreakSeconds,
    currentBreakSeconds,
    latestBreakStartAt,
    latestBreakEndAt,
  };
};

const buildCondensedTimeline = (events: ShiftEvent[]): ShiftEvent[] => {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const condensed: ShiftEvent[] = [];
  let locationBuffer: ShiftEvent[] = [];

  const flushLocationBuffer = () => {
    if (locationBuffer.length === 0) return;
    const first = locationBuffer[0];
    const last = locationBuffer[locationBuffer.length - 1];

    if (locationBuffer.length <= 2) {
      condensed.push(...locationBuffer);
    } else {
      condensed.push(first);
      condensed.push({
        ...last,
        id: `${last.id}-summary`,
        event_type: 'location_summary',
        metadata: {
          count: locationBuffer.length,
          first_at: first.created_at,
          last_at: last.created_at,
        },
      });
      condensed.push(last);
    }

    locationBuffer = [];
  };

  sorted.forEach((event) => {
    if (event.event_type === 'location') {
      locationBuffer.push(event);
      return;
    }

    flushLocationBuffer();
    condensed.push(event);
  });

  flushLocationBuffer();
  return condensed;
};

function dotHtml(color: string, size = 12, glow = false): string {
  return `<div style="
    width:${size}px;height:${size}px;
    background:${color};
    border:2.5px solid #fff;
    border-radius:50%;
    box-shadow:0 0 0 2px ${color}55${glow ? `,0 0 10px ${color}` : ''};
  "></div>`;
}

function snapToRoute(coords: [number, number][], lat: number, lng: number): [number, number] {
  let minDist = Infinity;
  let nearest: [number, number] = [lat, lng];
  for (const [rlat, rlng] of coords) {
    const d = Math.hypot(rlat - lat, rlng - lng);
    if (d < minDist) {
      minDist = d;
      nearest = [rlat, rlng];
    }
  }
  return nearest;
}

export function ShiftDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markerLayersRef = useRef<L.Layer[]>([]);
  const routeMarkerRefs = useRef<{
    start: L.Marker | null;
    latest: L.Marker | null;
    lastStop: L.Marker | null;
  }>({
    start: null,
    latest: null,
    lastStop: null,
  });
  const [shift, setShift] = useState<ShiftFull | null>(null);
  const [events, setEvents] = useState<ShiftEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const [latestPoint, setLatestPoint] = useState<[number, number] | null>(null);
  const [lastStopPoint, setLastStopPoint] = useState<[number, number] | null>(null);
  const [lastStopRecorded, setLastStopRecorded] = useState(false);
  const [startOdometerPhotoUrl, setStartOdometerPhotoUrl] = useState<string | null>(null);
  const [endOdometerPhotoUrl, setEndOdometerPhotoUrl] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingShift, setDeletingShift] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setError('Shift id is missing');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await fetchShiftWithEvents(id);
      setShift(result.shift);
      setEvents(result.events);
      setError(null);
    } catch (err) {
      console.error('Failed to load shift details:', err);
      setError('Failed to load shift details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const locationEvents = useMemo(
    () =>
      events
        .filter((event) => event.event_type === 'location' && event.latitude != null && event.longitude != null)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [events]
  );
  const locationCount = locationEvents.length;
  const shiftOdometer = useMemo(() => {
    const odometerStartEvents = events
      .filter((event) => event.event_type === 'odometer_start')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const odometerEndEvents = events
      .filter((event) => event.event_type === 'odometer_end')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const fuelEvents = events
      .filter((event) => event.event_type === 'fuel_log')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const parseOdometerEvent = (event: ShiftEvent | undefined) => {
      if (!event || !isRecord(event.metadata)) return null;
      const metadata = event.metadata;
      return {
        id: event.id,
        created_at: event.created_at,
        value:
          toNumber(metadata.odometer_value) ??
          toNumber(metadata.odometer_km) ??
          toNumber(metadata.reading) ??
          toNumber(metadata.value),
        unit: toDisplayText(metadata.unit) ?? 'km',
        photoPath: toDisplayText(metadata.photo_path),
        latitude: toNumber(event.latitude),
        longitude: toNumber(event.longitude),
      };
    };

    const start = parseOdometerEvent(odometerStartEvents[0]);
    const end = parseOdometerEvent(odometerEndEvents[odometerEndEvents.length - 1]);

    const fuelRows = fuelEvents.map((event) => {
      const metadata = isRecord(event.metadata) ? event.metadata : {};
      return {
        id: event.id,
        created_at: event.created_at,
        litres: toNumber(metadata.litres),
        cost: toNumber(metadata.cost),
        odometerKm: toNumber(metadata.odometer_km),
        stationName:
          toDisplayText(metadata.station_name) ??
          toDisplayText(metadata.location_name) ??
          null,
      };
    });

    const totalFuelLitres = fuelRows.reduce((sum, row) => sum + (row.litres ?? 0), 0);
    const totalFuelCost = fuelRows.reduce((sum, row) => sum + (row.cost ?? 0), 0);

    return {
      start,
      end,
      distanceDriven:
        start?.value != null && end?.value != null
          ? end.value - start.value
          : null,
      fuelRows,
      totalFuelLogs: fuelRows.length,
      totalFuelLitres,
      totalFuelCost,
    };
  }, [events]);

  useEffect(() => {
    let cancelled = false;

    const resolvePhotos = async () => {
      const [startPhoto, endPhoto] = await Promise.all([
        getOdometerPhotoUrl({ photoPath: shiftOdometer.start?.photoPath ?? null }),
        getOdometerPhotoUrl({ photoPath: shiftOdometer.end?.photoPath ?? null }),
      ]);

      if (cancelled) return;
      setStartOdometerPhotoUrl(startPhoto.url ?? null);
      setEndOdometerPhotoUrl(endPhoto.url ?? null);
    };

    resolvePhotos().catch((err) => {
      console.error('Failed to resolve shift odometer photos:', err);
      if (!cancelled) {
        setStartOdometerPhotoUrl(null);
        setEndOdometerPhotoUrl(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [shiftOdometer.start?.photoPath, shiftOdometer.end?.photoPath]);
  const stopEvents = useMemo(
    () =>
      events
        .filter((event) => event.event_type === 'stop_detected' && event.latitude != null && event.longitude != null)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [events]
  );

  const flyToQuickPoint = useCallback((point: [number, number] | null, marker: L.Marker | null) => {
    const map = mapInstanceRef.current;
    if (!map || !point) return;
    map.flyTo(point, 16);
    marker?.openPopup();
  }, []);

  const handleDeleteShift = useCallback(async () => {
    if (!shift?.id) return;

    setDeletingShift(true);

    try {
      const { error: deleteError } = await supabase.rpc('delete_shift_admin', {
        p_shift_id: shift.id,
      });

      if (deleteError) {
        console.error('delete_shift_admin RPC error', {
          shiftId: shift.id,
          code: deleteError.code,
          message: deleteError.message,
          details: deleteError.details,
          hint: deleteError.hint,
        });
        throw deleteError;
      }

      setDeleteDialogOpen(false);
      navigate('/shifts');
    } catch (err) {
      console.error('handleDeleteShift failed', {
        shiftId: shift.id,
        error: err,
      });
      setError('Failed to delete shift');
      setDeleteDialogOpen(false);
    } finally {
      setDeletingShift(false);
    }
  }, [navigate, shift?.id]);

  const latestChecklistEvent = useMemo(() => getLatestChecklistEvent(events), [events]);
  const checklistItems = useMemo(() => {
    const eventAnswers = getChecklistAnswersFromMetadata(
      isRecord(latestChecklistEvent?.metadata) ? latestChecklistEvent.metadata : null
    );
    return mergeChecklistSources(eventAnswers, shift?.checklist as Shift['checklist']);
  }, [latestChecklistEvent, shift]);
  const breakSummary = useMemo(() => getBreakSummary(events), [events]);
  const timelineEvents = useMemo(() => buildCondensedTimeline(events), [events]);

  useEffect(() => {
    if (!mapRef.current || !shift || locationEvents.length === 0) {
      return;
    }

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        center: [Number(locationEvents[0].latitude), Number(locationEvents[0].longitude)],
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    markerLayersRef.current.forEach((layer) => map.removeLayer(layer));
    markerLayersRef.current = [];
    routeMarkerRefs.current = { start: null, latest: null, lastStop: null };
    setStartPoint(null);
    setLatestPoint(null);
    setLastStopPoint(null);
    setLastStopRecorded(false);

    const renderRoadSnappedRoute = async () => {
      const startEvent = locationEvents[0];
      const endEvent = locationEvents[locationEvents.length - 1];

      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${Number(endEvent.longitude)},${Number(endEvent.latitude)};${Number(startEvent.longitude)},${Number(startEvent.latitude)}` +
        `?overview=full&geometries=geojson&steps=true`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.code !== 'Ok' || !json.routes?.[0]) {
        return;
      }

      const roadRouteCoords: [number, number][] = json.routes[0].geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng]
      );

      const routeColor = shift.status === 'completed' ? '#1a1a2e' : '#ff6b35';
      routeLayerRef.current = L.polyline(roadRouteCoords, {
        color: routeColor,
        weight: 5,
        opacity: 0.88,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(map);

      const snappedStart = snapToRoute(roadRouteCoords, Number(startEvent.latitude), Number(startEvent.longitude));
      const startMarker = L.marker(snappedStart, {
        icon: L.divIcon({ className: '', html: dotHtml('#22c55e', 16, true), iconSize: [16, 16], iconAnchor: [8, 8] }),
      }).bindPopup(`Shift Start: ${formatTimestamp(startEvent.created_at)}`);

      const snappedEnd = snapToRoute(roadRouteCoords, Number(endEvent.latitude), Number(endEvent.longitude));
      const endMarker = L.marker(snappedEnd, {
        icon: L.divIcon({ className: '', html: dotHtml('#ef4444', 16, true), iconSize: [16, 16], iconAnchor: [8, 8] }),
      }).bindPopup(`${shift.status === 'active' ? 'Current' : 'Latest'} Location: ${formatTimestamp(endEvent.created_at)}`);

      startMarker.addTo(map);
      endMarker.addTo(map);
      markerLayersRef.current = [startMarker, endMarker];
      routeMarkerRefs.current.start = startMarker;
      routeMarkerRefs.current.latest = endMarker;
      setStartPoint(snappedStart);
      setLatestPoint(snappedEnd);

      const lastStop = stopEvents[0] ?? null;
      if (lastStop) {
        const snappedStop = snapToRoute(roadRouteCoords, Number(lastStop.latitude), Number(lastStop.longitude));
        const lastStopMarker = L.marker(snappedStop, {
          icon: L.divIcon({ className: '', html: dotHtml('#ef4444', 14, true), iconSize: [14, 14], iconAnchor: [7, 7] }),
          zIndexOffset: 200,
        }).bindPopup(`Last Stop: ${formatTimestamp(lastStop.created_at)}`);
        lastStopMarker.addTo(map);
        markerLayersRef.current.push(lastStopMarker);
        routeMarkerRefs.current.lastStop = lastStopMarker;
        setLastStopPoint(snappedStop);
        setLastStopRecorded(true);
      }

      map.fitBounds(routeLayerRef.current.getBounds(), { padding: [50, 50] });
      requestAnimationFrame(() => map.invalidateSize());
    };

    renderRoadSnappedRoute().catch((err) => {
      console.error('ShiftDetails route render failed:', err);
    });

    return () => {
      if (!mapInstanceRef.current) return;
      if (routeLayerRef.current) {
        mapInstanceRef.current.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
      markerLayersRef.current.forEach((layer) => mapInstanceRef.current?.removeLayer(layer));
      markerLayersRef.current = [];
    };
  }, [shift, locationEvents, stopEvents]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Shift Details</h1>
          <p className="text-gray-400">Detailed timeline and event history</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            className="bg-red-700 text-white hover:bg-red-600"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deletingShift || !shift?.id}
          >
            {deletingShift ? 'Deleting...' : 'Delete Shift'}
          </Button>
          <Button
            variant="default"
            className="bg-[#FF6B35] text-white hover:bg-[#e55a25]"
            onClick={() => navigate('/shifts')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Shifts
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader className="w-8 h-8 text-[#FF6B35] animate-spin" />
        </div>
      ) : error ? (
        <Card className="bg-red-950 border-red-900">
          <CardContent className="p-4 text-red-400">{error}</CardContent>
        </Card>
      ) : !shift ? (
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6 text-gray-400">Shift not found</CardContent>
        </Card>
      ) : (
        <>
          <Card className="bg-[#161616] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Overview</CardTitle>
              <CardDescription className="text-gray-400">Shift id: {shift.id} · {PERTH_TIME_LABEL}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-[#0F0F0F] border border-gray-800 px-3 py-2">
                <p className="text-xs text-gray-500">Driver</p>
                <p className="text-sm text-gray-100 truncate">{shift.driver_name ?? 'Unknown driver'}</p>
              </div>
              <div className="rounded-lg bg-[#0F0F0F] border border-gray-800 px-3 py-2">
                <p className="text-xs text-gray-500">Vehicle</p>
                <p className="text-sm text-gray-100 truncate">{shift.vehicle_rego ?? 'Unknown vehicle'}</p>
                {shift.vehicle_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-7 px-2 text-xs text-blue-400 hover:text-blue-300"
                    onClick={() => navigate(`/vehicles/${shift.vehicle_id}`)}
                  >
                    Vehicle Details
                  </Button>
                )}
              </div>
              <div className="rounded-lg bg-[#0F0F0F] border border-gray-800 px-3 py-2">
                <p className="text-xs text-gray-500">Status</p>
                <Badge className="mt-1 bg-gray-800 text-gray-200 border-gray-700 capitalize">
                  {shift.status ?? 'unknown'}
                </Badge>
              </div>
              <div className="rounded-lg bg-[#0F0F0F] border border-gray-800 px-3 py-2">
                <p className="text-xs text-gray-500">Started</p>
                <p className="text-sm text-gray-100">{formatTimestamp(shift.started_at)}</p>
              </div>
              <div className="rounded-lg bg-[#0F0F0F] border border-gray-800 px-3 py-2">
                <p className="text-xs text-gray-500">Ended</p>
                <p className="text-sm text-gray-100">{formatTimestamp(shift.ended_at)}</p>
              </div>
              <div className="rounded-lg bg-[#0F0F0F] border border-gray-800 px-3 py-2">
                <p className="text-xs text-gray-500">Location updates</p>
                <p className="text-sm text-gray-100">{locationCount}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="bg-[#161616] border-gray-800 xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-white">Timeline</CardTitle>
                <CardDescription className="text-gray-400">Chronological event history in {PERTH_TIME_LABEL}</CardDescription>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-sm text-gray-500">No events found</p>
                ) : (
                  <div className="space-y-2">
                    {timelineEvents.map((event) => (
                      <div key={event.id} className="rounded-lg border border-gray-800 bg-[#0F0F0F] px-3 py-2">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm text-gray-200">
                            {event.event_type === 'location_summary'
                              ? `${(isRecord(event.metadata) ? toNumber(event.metadata.count) : null) ?? 0} location updates`
                              : eventLabel(event.event_type)}
                          </p>
                          <p className="text-xs text-gray-500">{formatTimestamp(event.created_at)}</p>
                        </div>
                        {event.event_type === 'location_summary' ? (
                          <p className="mt-1 text-xs text-gray-400">Location updates condensed for readability.</p>
                        ) : eventDetails(event) ? (
                          <p className="mt-1 text-xs text-gray-400">{eventDetails(event)}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="bg-[#161616] border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Odometer & Fuel</CardTitle>
                  <CardDescription className="text-gray-400">Odometer start/end from shift events and fuel log summary in {PERTH_TIME_LABEL}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-[#0F0F0F] border border-gray-800 p-2">
                      <p className="text-gray-500">Start KM</p>
                      <p className="text-gray-200 text-sm">
                        {shiftOdometer.start?.value != null
                          ? `${Math.round(shiftOdometer.start.value).toLocaleString()} ${shiftOdometer.start.unit ?? 'km'}`
                          : 'Pending'}
                      </p>
                      <p className="mt-1 text-[11px] text-gray-500">{formatTimestamp(shiftOdometer.start?.created_at)}</p>
                    </div>
                    <div className="rounded bg-[#0F0F0F] border border-gray-800 p-2">
                      <p className="text-gray-500">End KM</p>
                      <p className="text-gray-200 text-sm">
                        {shiftOdometer.end?.value != null
                          ? `${Math.round(shiftOdometer.end.value).toLocaleString()} ${shiftOdometer.end.unit ?? 'km'}`
                          : shift?.ended_at
                            ? 'Missing end odometer'
                            : 'Pending'}
                      </p>
                      <p className="mt-1 text-[11px] text-gray-500">{formatTimestamp(shiftOdometer.end?.created_at)}</p>
                    </div>
                    <div className="rounded bg-[#0F0F0F] border border-gray-800 p-2">
                      <p className="text-gray-500">Distance</p>
                      <p className="text-gray-200 text-sm">
                        {shiftOdometer.distanceDriven != null
                          ? shiftOdometer.distanceDriven < 0
                            ? 'Invalid odometer'
                            : `${Math.round(shiftOdometer.distanceDriven).toLocaleString()} km`
                          : shift?.ended_at
                            ? 'Missing end odometer'
                            : 'Pending'}
                      </p>
                    </div>
                    <div className="rounded bg-[#0F0F0F] border border-gray-800 p-2">
                      <p className="text-gray-500">Fuel Logs</p>
                      <p className="text-gray-200 text-sm">{shiftOdometer.totalFuelLogs}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-[#0F0F0F] border border-gray-800 p-2">
                      <p className="text-gray-500">Start Location</p>
                      <p className="text-gray-200 text-sm">
                        {formatCoordinateText(shiftOdometer.start?.latitude, shiftOdometer.start?.longitude)}
                      </p>
                    </div>
                    <div className="rounded bg-[#0F0F0F] border border-gray-800 p-2">
                      <p className="text-gray-500">End Location</p>
                      <p className="text-gray-200 text-sm">
                        {formatCoordinateText(shiftOdometer.end?.latitude, shiftOdometer.end?.longitude)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-[#0F0F0F] border border-gray-800 p-2">
                      <p className="text-gray-500">Start Photo</p>
                      {startOdometerPhotoUrl ? (
                        <a href={startOdometerPhotoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm">
                          View Photo
                        </a>
                      ) : (
                        <p className="text-gray-200 text-sm">No photo</p>
                      )}
                    </div>
                    <div className="rounded bg-[#0F0F0F] border border-gray-800 p-2">
                      <p className="text-gray-500">End Photo</p>
                      {endOdometerPhotoUrl ? (
                        <a href={endOdometerPhotoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm">
                          View Photo
                        </a>
                      ) : (
                        <p className="text-gray-200 text-sm">No photo</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded bg-[#0F0F0F] border border-gray-800 p-2 text-xs">
                    <p className="text-gray-500">Fuel Summary</p>
                    <p className="text-gray-200 text-sm">
                      {shiftOdometer.totalFuelLogs > 0
                        ? `${shiftOdometer.totalFuelLitres.toFixed(2)} L • $${shiftOdometer.totalFuelCost.toFixed(2)}`
                        : 'No fuel logs recorded'}
                    </p>
                  </div>
                  {shiftOdometer.fuelRows.length === 0 ? (
                    <p className="text-xs text-gray-500">No fuel logs recorded for this shift.</p>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {shiftOdometer.fuelRows.slice().reverse().map((fuelRow) => (
                        <div key={fuelRow.id} className="rounded bg-[#0F0F0F] border border-gray-800 p-2 text-xs">
                          <div className="flex items-center justify-between">
                            <p className="text-gray-300">{fuelRow.stationName ?? 'Fuel Log'}</p>
                            <p className="text-gray-500">{formatTimestamp(fuelRow.created_at)}</p>
                          </div>
                          <p className="text-gray-400 mt-1">
                            {fuelRow.litres != null ? `${fuelRow.litres.toFixed(2)} L` : '—'} • {fuelRow.cost != null ? `$${fuelRow.cost.toFixed(2)}` : '—'} • {fuelRow.odometerKm != null ? `${Math.round(fuelRow.odometerKm).toLocaleString()} km` : '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-[#161616] border-gray-800">
              <CardHeader>
                  <CardTitle className="text-white">Break Summary</CardTitle>
                  <CardDescription className="text-gray-400">Break sessions from shift events in {PERTH_TIME_LABEL}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-[#0F0F0F] border border-gray-800 p-2">
                      <p className="text-gray-500">Break status</p>
                      <p className="mt-1 text-sm text-gray-200">
                        {breakSummary.status === 'none'
                          ? 'No break taken'
                          : breakSummary.status === 'on-break'
                            ? 'On break'
                            : 'Completed'}
                      </p>
                    </div>
                    <div className="rounded bg-[#0F0F0F] border border-gray-800 p-2">
                      <p className="text-gray-500">Total break time</p>
                      <p className="mt-1 text-sm text-gray-200">{formatDuration(breakSummary.totalBreakSeconds)}</p>
                    </div>
                    <div className="rounded bg-[#0F0F0F] border border-gray-800 p-2">
                      <p className="text-gray-500">Break start time</p>
                      <p className="mt-1 text-sm text-gray-200">{formatTimestamp(breakSummary.latestBreakStartAt)}</p>
                    </div>
                    <div className="rounded bg-[#0F0F0F] border border-gray-800 p-2">
                      <p className="text-gray-500">Break end time</p>
                      <p className="mt-1 text-sm text-gray-200">{formatTimestamp(breakSummary.latestBreakEndAt)}</p>
                    </div>
                    <div className="rounded bg-[#0F0F0F] border border-gray-800 p-2">
                      <p className="text-gray-500">Break duration</p>
                      <p className="mt-1 text-sm text-gray-200">
                        {breakSummary.status === 'on-break'
                          ? formatDuration(breakSummary.currentBreakSeconds)
                          : breakSummary.sessions.length > 0
                            ? formatDuration(breakSummary.sessions[breakSummary.sessions.length - 1]?.durationSeconds)
                            : '—'}
                      </p>
                    </div>
                    <div className="rounded bg-[#0F0F0F] border border-gray-800 p-2">
                      <p className="text-gray-500">Break sessions</p>
                      <p className="mt-1 text-sm text-gray-200">{breakSummary.sessions.length}</p>
                    </div>
                  </div>

                  {breakSummary.sessions.length === 0 ? (
                    <p className="text-xs text-gray-500">No break taken</p>
                  ) : (
                    <div className="rounded border border-gray-800 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-800 hover:bg-transparent">
                            <TableHead className="text-gray-400">Start</TableHead>
                            <TableHead className="text-gray-400">End</TableHead>
                            <TableHead className="text-gray-400">Duration</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {breakSummary.sessions.map((session, index) => (
                            <TableRow key={`${session.startAt}-${index}`} className="border-gray-800">
                              <TableCell className="text-gray-300 text-xs">{formatTimestamp(session.startAt)}</TableCell>
                              <TableCell className="text-gray-300 text-xs">
                                {session.endAt ? formatTimestamp(session.endAt) : 'On break'}
                              </TableCell>
                              <TableCell className="text-gray-300 text-xs">{formatDuration(session.durationSeconds)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-[#161616] border-gray-800">
                <CardHeader>
                <CardTitle className="text-white">Checklist</CardTitle>
                <CardDescription className="text-gray-400">Latest submitted checklist answers</CardDescription>
              </CardHeader>
              <CardContent>
                {checklistItems.length === 0 ? (
                  <p className="text-sm text-gray-500">No checklist data found</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {checklistItems.map((item) => (
                      <div key={item.key} className="rounded-lg border border-gray-800 bg-[#0F0F0F] px-3 py-2 text-xs">
                        <div className="flex justify-between gap-3">
                          <span className="text-gray-300">{item.label}</span>
                          <span
                            className={
                              item.status === 'fail'
                                ? 'text-red-400'
                                : item.status === 'pass'
                                  ? 'text-green-400'
                                  : 'text-yellow-400'
                            }
                          >
                            {item.statusLabel}
                          </span>
                        </div>
                        {item.valueLabel && <p className="mt-1 text-[11px] text-gray-400">{item.valueLabel}</p>}
                        {item.notes && <p className="mt-1 text-[11px] text-gray-500">{item.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            </div>

            <Card className="bg-[#161616] border-gray-800 xl:col-span-3">
              <CardHeader>
                <CardTitle className="text-white">GPS Route</CardTitle>
                <CardDescription className="text-gray-400">Location points from shift events in {PERTH_TIME_LABEL}</CardDescription>
              </CardHeader>
              <CardContent>
                {locationEvents.length === 0 ? (
                  <p className="text-sm text-gray-500">No GPS data available</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-green-700 text-white hover:bg-green-600"
                        disabled={!startPoint}
                        onClick={() => flyToQuickPoint(startPoint, routeMarkerRefs.current.start)}
                      >
                        Start Location
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-blue-700 text-white hover:bg-blue-600"
                        disabled={!latestPoint}
                        onClick={() => flyToQuickPoint(latestPoint, routeMarkerRefs.current.latest)}
                      >
                        {shift?.status === 'active' ? 'Current Location' : 'Latest Location'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-red-700 text-white hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-300"
                        disabled={!lastStopPoint}
                        onClick={() => flyToQuickPoint(lastStopPoint, routeMarkerRefs.current.lastStop)}
                      >
                        {lastStopRecorded ? 'Last Stop' : 'No stops recorded'}
                      </Button>
                    </div>
                    <div ref={mapRef} className="w-full h-[360px] rounded-lg border border-gray-800 overflow-hidden" />
                    <p className="text-xs text-gray-500">
                      {locationEvents.length} points from {formatTimestamp(locationEvents[0]?.created_at)} to {formatTimestamp(locationEvents[locationEvents.length - 1]?.created_at)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#161616] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Shift</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This deletes the shift and all related events. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-4">
            <AlertDialogCancel className="bg-gray-800 text-gray-300 hover:bg-gray-700" disabled={deletingShift}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteShift}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deletingShift}
            >
              {deletingShift ? 'Deleting...' : 'Delete Shift'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
