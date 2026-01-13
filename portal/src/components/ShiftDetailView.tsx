import { useState, useEffect } from 'react';
import { ArrowLeft, User, Truck, Clock, MapPin, Fuel, AlertTriangle, FileText, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { fetchShiftDetails } from '../lib/api';

interface ShiftDetailViewProps {
  shiftId: string | null;
  onBack?: () => void;
}

export default function ShiftDetailView({ shiftId, onBack }: ShiftDetailViewProps) {
  const [shiftData, setShiftData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shiftId) {
      loadShiftDetails();
    }
  }, [shiftId]);

  const loadShiftDetails = async () => {
    if (!shiftId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await fetchShiftDetails(shiftId);
      setShiftData(data);
    } catch (err: any) {
      console.error('Error loading shift details:', err);
      setError(err.message || 'Failed to load shift details');
    } finally {
      setLoading(false);
    }
  };

  if (!shiftId) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">No shift selected</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Loading shift details...</div>
      </div>
    );
  }

  if (error || !shiftData) {
    return (
      <div className="p-6">
        <div className="text-center text-destructive">
          {error || 'Failed to load shift details'}
        </div>
        {onBack && (
          <div className="text-center mt-4">
            <Button onClick={onBack} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        )}
      </div>
    );
  }

  const { shift, events, fuelLogs, incidents, notes } = shiftData;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button onClick={onBack} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-foreground">Shift Details</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Status: <span className="font-medium text-foreground">{shift.status.toUpperCase()}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Shift Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border border-border">
          <div className="flex items-center gap-3">
            <User className="w-8 h-8 text-[#1e90ff]" />
            <div>
              <p className="text-xs text-muted-foreground">Driver</p>
              <p className="text-sm font-medium text-foreground">{shift.driver?.full_name || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">{shift.driver?.phone || ''}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border border-border">
          <div className="flex items-center gap-3">
            <Truck className="w-8 h-8 text-[#10b981]" />
            <div>
              <p className="text-xs text-muted-foreground">Vehicle</p>
              <p className="text-sm font-medium text-foreground">{shift.vehicle?.registration || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">{shift.vehicle?.type || ''}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border border-border">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-[#ff6b35]" />
            <div>
              <p className="text-xs text-muted-foreground">Started</p>
              <p className="text-sm font-medium text-foreground">
                {new Date(shift.started_at).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border border-border">
          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-[#f59e0b]" />
            <div>
              <p className="text-xs text-muted-foreground">Depot</p>
              <p className="text-sm font-medium text-foreground">{shift.vehicle?.depot || 'N/A'}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Events Timeline */}
      <Card className="bg-card border border-border p-5">
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Events Timeline ({events.length})
        </h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No events recorded</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 border-b border-border hover:bg-muted/30">
                  <TableHead className="text-xs font-bold text-foreground">Time</TableHead>
                  <TableHead className="text-xs font-bold text-foreground">Event Type</TableHead>
                  <TableHead className="text-xs font-bold text-foreground">Status</TableHead>
                  <TableHead className="text-xs font-bold text-foreground">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event: any, idx: number) => (
                  <TableRow key={idx} className="border-b border-border hover:bg-muted/20">
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(event.occurred_at).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground">
                      {event.event_type.replace(/_/g, ' ').toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded ${
                        event.status === 'success' ? 'bg-green-500/20 text-green-500' :
                        event.status === 'failed' ? 'bg-red-500/20 text-red-500' :
                        'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        {event.status || 'pending'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {event.metadata ? JSON.stringify(event.metadata).substring(0, 50) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fuel Logs */}
        <Card className="bg-card border border-border p-5">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Fuel className="w-5 h-5" />
            Fuel Logs ({fuelLogs.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {fuelLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No fuel logs</p>
            ) : (
              fuelLogs.map((log: any, idx: number) => (
                <div key={idx} className="p-3 bg-muted/30 border border-border rounded">
                  <p className="text-sm font-medium text-foreground">{log.amount} L</p>
                  <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                  {log.cost && <p className="text-xs text-muted-foreground">Cost: ${log.cost}</p>}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Incidents */}
        <Card className="bg-card border border-border p-5">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#ef4444]" />
            Incidents ({incidents.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No incidents</p>
            ) : (
              incidents.map((incident: any, idx: number) => (
                <div key={idx} className="p-3 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded">
                  <p className="text-sm font-medium text-foreground">{incident.type || 'Incident'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(incident.created_at).toLocaleString()}</p>
                  {incident.description && (
                    <p className="text-xs text-muted-foreground mt-1">{incident.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Notes */}
        <Card className="bg-card border border-border p-5">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Notes ({notes.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No notes</p>
            ) : (
              notes.map((note: any, idx: number) => (
                <div key={idx} className="p-3 bg-muted/30 border border-border rounded">
                  <p className="text-sm text-foreground">{note.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(note.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
