import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-987e9da2`;

export function EventLogs() {
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'failed' | 'invalid'>('all');
  const [loading, setLoading] = useState(true);
  const [markFailedDialog, setMarkFailedDialog] = useState<{ open: boolean; eventId: string | null; reason: string }>({
    open: false,
    eventId: null,
    reason: '',
  });

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchEvents = async () => {
    try {
      const url = filter === 'all' ? `${API_BASE}/events` : `${API_BASE}/events?status=${filter}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await response.json();
      setEvents(data.events || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching events:', error);
      setLoading(false);
    }
  };

  const handleRetry = async (eventId: string) => {
    if (!confirm('Are you sure you want to retry this event?')) return;

    try {
      const response = await fetch(`${API_BASE}/events/${eventId}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ admin_name: 'Admin User' }),
      });

      if (response.ok) {
        fetchEvents();
        alert('Event retry initiated');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error retrying event:', error);
      alert('Failed to retry event');
    }
  };

  const handleMarkFailed = async () => {
    if (!markFailedDialog.eventId || !markFailedDialog.reason.trim()) {
      alert('Please provide a reason');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/events/${markFailedDialog.eventId}/mark-failed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          reason: markFailedDialog.reason,
          admin_name: 'Admin User',
        }),
      });

      if (response.ok) {
        setMarkFailedDialog({ open: false, eventId: null, reason: '' });
        fetchEvents();
        alert('Event marked as permanently failed');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error marking event as failed:', error);
      alert('Failed to mark event');
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;

    try {
      const response = await fetch(`${API_BASE}/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ admin_name: 'Admin User' }),
      });

      if (response.ok) {
        fetchEvents();
        alert('Event deleted successfully');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Event Logs & Failures</h2>
        <p className="text-sm text-muted-foreground mt-1">Monitor and debug event processing</p>
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          size="sm"
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          All Events
        </Button>
        <Button
          size="sm"
          variant={filter === 'failed' ? 'default' : 'outline'}
          onClick={() => setFilter('failed')}
        >
          Failed Only
        </Button>
        <Button
          size="sm"
          variant={filter === 'invalid' ? 'default' : 'outline'}
          onClick={() => setFilter('invalid')}
        >
          Invalid Only
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-b border-border hover:bg-muted/30">
              <TableHead className="text-xs font-bold text-foreground uppercase">Status</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Event Type</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Shift ID</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Timestamp</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Retries</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Error</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No events found
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow key={event.id} className="border-b border-border hover:bg-muted/20">
                  <TableCell>
                    {event.status === 'success' && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-[#10b981]" />
                        <span className="text-xs text-[#10b981] font-medium">SUCCESS</span>
                      </div>
                    )}
                    {event.status === 'failed' && (
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-[#ef4444]" />
                        <span className="text-xs text-[#ef4444] font-medium">FAILED</span>
                      </div>
                    )}
                    {event.status === 'invalid' && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-[#f59e0b]" />
                        <span className="text-xs text-[#f59e0b] font-medium">INVALID</span>
                      </div>
                    )}
                    {event.status === 'permanently_failed' && (
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-[#ef4444]" />
                        <span className="text-xs text-[#ef4444] font-medium">PERM FAILED</span>
                      </div>
                    )}
                    {event.status === 'retrying' && (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-[#1e90ff]" />
                        <span className="text-xs text-[#1e90ff] font-medium">RETRYING</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-foreground">
                    {event.type.replace(/_/g, ' ').toUpperCase()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {event.shift_id || <span className="text-[#ef4444]">NULL</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(event.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{event.retry_count || 0}</TableCell>
                  <TableCell className="text-xs text-[#ef4444] max-w-xs truncate">
                    {event.error || event.failure_reason || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      {event.status === 'failed' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetry(event.id)}
                            className="text-xs"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Retry
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setMarkFailedDialog({ open: true, eventId: event.id, reason: '' })}
                            className="text-xs"
                          >
                            Mark Failed
                          </Button>
                        </>
                      )}
                      {(event.status === 'invalid' || event.status === 'permanently_failed') && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(event.id)}
                          className="text-xs"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mark Failed Dialog */}
      <Dialog open={markFailedDialog.open} onOpenChange={(open) => setMarkFailedDialog({ ...markFailedDialog, open })}>
        <DialogContent className="bg-card border-destructive">
          <DialogHeader>
            <DialogTitle className="text-destructive">Mark Event as Permanently Failed</DialogTitle>
            <DialogDescription>
              This event will be marked as permanently failed and will not be retried. Provide a reason for this action.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-foreground mb-2 block">Reason (Required)</label>
            <Textarea
              placeholder="e.g., Invalid data structure, deprecated event type, etc."
              value={markFailedDialog.reason}
              onChange={(e) => setMarkFailedDialog({ ...markFailedDialog, reason: e.target.value })}
              className="min-h-24"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkFailedDialog({ open: false, eventId: null, reason: '' })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleMarkFailed}>
              Confirm Mark Failed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
