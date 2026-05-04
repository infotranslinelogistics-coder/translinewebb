import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { format } from 'date-fns';
import { ArrowLeft, Loader } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { fetchShiftWithEvents, type Shift, type ShiftEvent, type ShiftFull } from '@/lib/db/shifts';

function formatTimestamp(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'MMM dd, yyyy HH:mm:ss');
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
    return `${event.latitude.toFixed(5)}, ${event.longitude.toFixed(5)}`;
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
  return null;
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
  const [shift, setShift] = useState<ShiftFull | null>(null);
  const [events, setEvents] = useState<ShiftEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const latestChecklistEvent = useMemo(() => getLatestChecklistEvent(events), [events]);
  const checklistItems = useMemo(() => {
    const eventAnswers = getChecklistAnswersFromMetadata(
      isRecord(latestChecklistEvent?.metadata) ? latestChecklistEvent.metadata : null
    );
    if (isRecord(eventAnswers)) {
      return Object.entries(eventAnswers).map(([key, value]) => getChecklistItem(key, value));
    }

    return normalizeChecklist(shift?.checklist as Shift['checklist']);
  }, [latestChecklistEvent, shift]);

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
      }).bindPopup(`Shift End: ${formatTimestamp(endEvent.created_at)}`);

      startMarker.addTo(map);
      endMarker.addTo(map);
      markerLayersRef.current = [startMarker, endMarker];

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
  }, [shift, locationEvents]);

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
        <Button
          variant="default"
          className="bg-[#FF6B35] text-white hover:bg-[#e55a25]"
          onClick={() => navigate('/shifts')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Shifts
        </Button>
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
              <CardDescription className="text-gray-400">Shift id: {shift.id}</CardDescription>
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

          <Card className="bg-[#161616] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Timeline</CardTitle>
              <CardDescription className="text-gray-400">Chronological event history</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-gray-500">No events found</p>
              ) : (
                <div className="space-y-2">
                  {events.map((event) => (
                    <div key={event.id} className="rounded-lg border border-gray-800 bg-[#0F0F0F] px-3 py-2">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-gray-200">{eventLabel(event.event_type)}</p>
                        <p className="text-xs text-gray-500">{formatTimestamp(event.created_at)}</p>
                      </div>
                      {eventDetails(event) && <p className="mt-1 text-xs text-gray-400">{eventDetails(event)}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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

            <Card className="bg-[#161616] border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">GPS Route</CardTitle>
                <CardDescription className="text-gray-400">Location points from shift events</CardDescription>
              </CardHeader>
              <CardContent>
                {locationEvents.length === 0 ? (
                  <p className="text-sm text-gray-500">No GPS data available</p>
                ) : (
                  <div className="space-y-3">
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
    </div>
  );
}
