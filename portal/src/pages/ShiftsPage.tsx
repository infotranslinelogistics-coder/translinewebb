// Shifts management page
import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/app/components/ui/alert-dialog';
import { Search, Clock, Loader } from 'lucide-react';
import { format } from 'date-fns';
import { listShifts, Shift, countActiveShifts, countTodayShifts } from '@/lib/db/shifts';
import { supabase } from '@/lib/supabase';

export function ShiftsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');
  const [activeCount, setActiveCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [endShiftDialog, setEndShiftDialog] = useState(false);
  const [endShiftReason, setEndShiftReason] = useState('');

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
  const filteredShifts = shifts.filter((shift) => {
    const matchesSearch =
      (shift.driver_name ?? '').toLowerCase().includes(normalizedQuery) ||
      (shift.vehicle_rego ?? '').toLowerCase().includes(normalizedQuery);
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
              {(['all', 'active', 'completed'] as const).map((status) => (
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
                    <TableHead className="text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShifts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No shifts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredShifts.map((shift) => (
                      <TableRow key={shift.id} className="border-gray-800">
                        <TableCell className="font-medium text-white">
                          {shift.driver_name ?? '—'}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {shift.vehicle_rego ?? '—'}
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
                                ? 'bg-green-950 text-green-400 border-green-900'
                                : 'bg-gray-800 text-gray-400 border-gray-700'
                            }
                          >
                            {shift.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
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
                    ))
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
              Are you sure you want to end the shift for {selectedShift?.driver_name}? This action cannot be undone.
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
    </div>
  );
}
