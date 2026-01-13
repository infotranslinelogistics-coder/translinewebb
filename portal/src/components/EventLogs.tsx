import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { supabase } from '../lib/supabase-client';

export default function EventLogs() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [filter]);

  const fetchEvents = async () => {
    try {
      let query = supabase
        .from('events')
        .select(`
          *,
          shift:shifts(
            id,
            driver:profiles!shifts_driver_id_fkey(full_name),
            vehicle:vehicles(registration)
          )
        `)
        .order('occurred_at', { ascending: false })
        .limit(100);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEvents(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching events:', error);
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-[#10b981]" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-[#ef4444]" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-[#f59e0b]" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-[#10b981]/20 text-[#10b981]';
      case 'failed':
        return 'bg-[#ef4444]/20 text-[#ef4444]';
      case 'pending':
        return 'bg-[#f59e0b]/20 text-[#f59e0b]';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading event logs...</div>
        </div>
      </div>
    );
  }

  const failedCount = events.filter(e => e.status === 'failed').length;
  const pendingCount = events.filter(e => e.status === 'pending').length;
  const successCount = events.filter(e => e.status === 'success').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Event Logs</h2>
          <p className="text-sm text-muted-foreground mt-1">Monitor and manage event queues</p>
        </div>
        <Button onClick={fetchEvents} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          className={`p-4 cursor-pointer transition-colors ${filter === 'all' ? 'border-primary' : 'border-border'}`}
          onClick={() => setFilter('all')}
        >
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Events</p>
            <p className="text-3xl font-bold text-foreground mt-1">{events.length}</p>
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-colors ${filter === 'failed' ? 'border-[#ef4444]' : 'border-border'}`}
          onClick={() => setFilter('failed')}
        >
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Failed</p>
            <p className="text-3xl font-bold text-[#ef4444] mt-1">{failedCount}</p>
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-colors ${filter === 'pending' ? 'border-[#f59e0b]' : 'border-border'}`}
          onClick={() => setFilter('pending')}
        >
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending</p>
            <p className="text-3xl font-bold text-[#f59e0b] mt-1">{pendingCount}</p>
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-colors ${filter === 'success' ? 'border-[#10b981]' : 'border-border'}`}
          onClick={() => setFilter('success')}
        >
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Success</p>
            <p className="text-3xl font-bold text-[#10b981] mt-1">{successCount}</p>
          </div>
        </Card>
      </div>

      {/* Events Table */}
      <Card className="bg-card border border-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 border-b border-border hover:bg-muted/30">
                <TableHead className="text-xs font-bold text-foreground">Status</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Time</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Event Type</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Driver</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Vehicle</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No events found
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => (
                  <TableRow key={event.id} className="border-b border-border hover:bg-muted/20">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(event.status)}
                        <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(event.status)}`}>
                          {event.status || 'unknown'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(event.occurred_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground">
                      {event.event_type.replace(/_/g, ' ').toUpperCase()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {event.shift?.driver?.full_name || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {event.shift?.vehicle?.registration || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {event.metadata ? JSON.stringify(event.metadata) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
