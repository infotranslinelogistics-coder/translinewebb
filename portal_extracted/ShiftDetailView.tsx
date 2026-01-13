import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, User, Truck, Camera, FileText, AlertCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-987e9da2`;

interface ShiftDetailViewProps {
  shiftId: string;
  onBack: () => void;
}

export function ShiftDetailView({ shiftId, onBack }: ShiftDetailViewProps) {
  const [shift, setShift] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteDialog, setNoteDialog] = useState({ open: false, note: '' });

  useEffect(() => {
    fetchShiftDetail();
  }, [shiftId]);

  const fetchShiftDetail = async () => {
    try {
      const response = await fetch(`${API_BASE}/shifts/${shiftId}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await response.json();
      setShift(data.shift);
      setEvents(data.events || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching shift detail:', error);
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteDialog.note.trim()) {
      alert('Please enter a note');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/shifts/${shiftId}/add-note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          note: noteDialog.note,
          admin_name: 'Admin User',
        }),
      });

      if (response.ok) {
        setNoteDialog({ open: false, note: '' });
        fetchShiftDetail();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Failed to add note');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading shift details...</div>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="p-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="text-center py-12 text-muted-foreground">Shift not found</div>
      </div>
    );
  }

  const getDuration = () => {
    const start = new Date(shift.start_time).getTime();
    const end = shift.end_time ? new Date(shift.end_time).getTime() : Date.now();
    const duration = end - start;
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Shifts
        </Button>
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1 rounded text-xs font-bold ${
              shift.status === 'active'
                ? 'bg-[#10b981]/20 text-[#10b981]'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {shift.status.toUpperCase()}
          </div>
          {shift.force_ended && (
            <div className="px-3 py-1 rounded text-xs font-bold bg-[#ef4444]/20 text-[#ef4444]">
              FORCE ENDED
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shift Info */}
        <Card className="lg:col-span-2 bg-card border border-border p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">Shift Information</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <User className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Driver</span>
              </div>
              <p className="text-lg font-bold text-foreground">{shift.driver_id}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Truck className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Vehicle</span>
              </div>
              <p className="text-lg font-bold text-foreground">{shift.vehicle_id}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Start Time</span>
              </div>
              <p className="text-sm text-foreground">{new Date(shift.start_time).toLocaleString()}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Duration</span>
              </div>
              <p className="text-sm text-foreground">{getDuration()}</p>
            </div>
          </div>

          {shift.end_time && (
            <div className="mb-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">End Time</span>
              </div>
              <p className="text-sm text-foreground">{new Date(shift.end_time).toLocaleString()}</p>
            </div>
          )}

          {shift.force_ended && (
            <div className="mb-6 p-3 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-[#ef4444]" />
                <span className="text-sm font-bold text-[#ef4444]">Force Ended by Admin</span>
              </div>
              <p className="text-xs text-muted-foreground">Admin: {shift.force_ended_by}</p>
              <p className="text-xs text-foreground mt-1">Reason: {shift.force_end_reason}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Camera className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Start Odometer</span>
              </div>
              {shift.start_odometer_photo ? (
                <img
                  src={shift.start_odometer_photo}
                  alt="Start odometer"
                  className="w-full h-32 object-cover rounded border border-border"
                />
              ) : (
                <div className="w-full h-32 bg-muted border border-border rounded flex items-center justify-center text-muted-foreground text-xs">
                  No photo uploaded
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Camera className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">End Odometer</span>
              </div>
              {shift.end_odometer_photo ? (
                <img
                  src={shift.end_odometer_photo}
                  alt="End odometer"
                  className="w-full h-32 object-cover rounded border border-border"
                />
              ) : (
                <div className="w-full h-32 bg-muted border border-border rounded flex items-center justify-center text-muted-foreground text-xs">
                  {shift.status === 'active' ? 'Not yet available' : 'No photo uploaded'}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Admin Notes */}
        <Card className="bg-card border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">Admin Notes</h3>
            <Button size="sm" onClick={() => setNoteDialog({ open: true, note: '' })}>
              Add Note
            </Button>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {shift.admin_notes && shift.admin_notes.length > 0 ? (
              shift.admin_notes.map((note: any, idx: number) => (
                <div key={idx} className="p-3 bg-muted/30 border border-border rounded">
                  <p className="text-xs text-foreground mb-1">{note.note}</p>
                  <p className="text-xs text-muted-foreground">
                    {note.admin_name} - {new Date(note.timestamp).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No admin notes</p>
            )}
          </div>
        </Card>
      </div>

      {/* Event Timeline */}
      <Card className="bg-card border border-border p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Event Timeline</h3>
        
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {events.length > 0 ? (
            events.map((event, idx) => (
              <div key={idx} className="flex items-start gap-4 p-3 bg-muted/30 border border-border rounded">
                <div className="flex-shrink-0">
                  <div
                    className={`w-3 h-3 rounded-full mt-1 ${
                      event.status === 'success'
                        ? 'bg-[#10b981]'
                        : event.status === 'failed'
                        ? 'bg-[#ef4444]'
                        : 'bg-[#f59e0b]'
                    }`}
                  ></div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-foreground">{event.type.replace(/_/g, ' ').toUpperCase()}</p>
                    <span
                      className={`text-xs font-bold ${
                        event.status === 'success'
                          ? 'text-[#10b981]'
                          : event.status === 'failed'
                          ? 'text-[#ef4444]'
                          : 'text-[#f59e0b]'
                      }`}
                    >
                      {event.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</p>
                  {event.error && (
                    <p className="text-xs text-[#ef4444] mt-1">Error: {event.error}</p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No events recorded</p>
          )}
        </div>
      </Card>

      {/* Add Note Dialog */}
      <Dialog open={noteDialog.open} onOpenChange={(open) => setNoteDialog({ ...noteDialog, open })}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Add Admin Note</DialogTitle>
            <DialogDescription>
              Add a note to this shift for future reference. This will be logged with your admin name.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter your note here..."
              value={noteDialog.note}
              onChange={(e) => setNoteDialog({ ...noteDialog, note: e.target.value })}
              className="min-h-24"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialog({ open: false, note: '' })}>
              Cancel
            </Button>
            <Button onClick={handleAddNote}>Add Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
