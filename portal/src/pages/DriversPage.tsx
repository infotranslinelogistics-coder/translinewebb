// Drivers management page
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/app/components/ui/alert-dialog';
import { Search, UserPlus, Trash2, Loader, Eye, Key } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useDriverLiveState, isOnlineFromLastSeen, type DriverLiveStatus } from '@/lib/realtime/useDriverLiveState';
import { formatDistanceStrict } from 'date-fns';
import { listDrivers } from '@/lib/db/drivers';

type ShiftRow = {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: 'active' | 'ended' | 'cancelled';
};

type ShiftBreakEventRow = {
  shift_id: string;
  event_type: 'break_start' | 'break_end';
  created_at: string;
};

type DriverCurrentStatusRow = {
  driver_id: string;
  status: string | null;
  shift_id: string | null;
  last_location_at: string | null;
  lat: number | null;
  lng: number | null;
  speed_kmh: number | null;
  heading: number | null;
  vehicle_id: string | null;
  last_seen_at: string | null;
};

type VehicleOption = {
  id: string;
  rego: string;
  status: string;
};

type DriverRow = {
  id?: string | null;
  driver_id: string;
  full_name?: string | null;
  profile_email?: string | null;
  email?: string | null;
  auth_user_id?: string | null;
  phone?: string | null;
  status?: string | null;
  current_vehicle_id?: string | null;
  current_vehicle_rego?: string | null;
};

const countDriversByStatus = (rows: DriverRow[], status: string) =>
  rows.filter((driver) => driver.status === status).length;

export function DriversPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<DriverRow | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
  });
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const { statusMap, setStatusMap } = useDriverLiveState();
  const [activeShiftMap, setActiveShiftMap] = useState<Record<string, ShiftRow>>({});
  const [breakByShiftId, setBreakByShiftId] = useState<Record<string, boolean>>({});
  const [selectedDriver, setSelectedDriver] = useState<DriverRow | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDriver, setPasswordDriver] = useState<DriverRow | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [durationNow, setDurationNow] = useState(() => Date.now());
  const resolveDriverId = (driver: DriverRow) =>
    driver.driver_id ?? driver.id ?? driver.auth_user_id;
  const getShiftDurationLabel = (shift?: ShiftRow) => {
    if (!shift?.started_at) return 'No active shift';
    const startedAt = new Date(shift.started_at);
    if (Number.isNaN(startedAt.getTime())) return 'No active shift';
    return formatDistanceStrict(startedAt, durationNow, { roundingMethod: 'floor' });
  };

  async function fetchDrivers() {
    try {
      const data = await listDrivers();
      return data as DriverRow[];
    } catch (driversError) {
      console.error('fetchDrivers error:', driversError);
      return [];
    }
  }

  async function fetchVehicles() {
    const { data, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('id, rego, status')
      .eq('status', 'active')
      .order('rego');

    if (vehiclesError) {
      console.error('fetchVehicles error:', vehiclesError);
      return [];
    }

    return data ?? [];
  }

  async function unassignDriverFromAllVehicles(driverId: string) {
    const { error } = await supabase.rpc('unassign_driver', {
      p_driver: driverId,
    });
    if (error) throw error;
  }

  function openVehicleModal(driver: DriverRow) {
    setSelectedDriver(driver);
    setSelectedVehicleId(driver.current_vehicle_id ? String(driver.current_vehicle_id) : '');
    setIsVehicleModalOpen(true);
  }

  async function saveVehicleAssignment() {
    if (!selectedDriver) return;

    try {
      const selectedDriverId = resolveDriverId(selectedDriver);
      if (selectedVehicleId) {
        const occupancy = vehicleOccupancy.get(String(selectedVehicleId));
        if (occupancy && occupancy.driverId !== selectedDriverId) {
          alert(`Vehicle is already assigned to ${occupancy.label}. Unassign it first.`);
          return;
        }
      }

      if (!selectedVehicleId) {
        try {
          await unassignDriverFromAllVehicles(selectedDriver.driver_id);
        } catch (unassignError) {
          console.error('assign_vehicle unassign error:', unassignError);
          alert('Failed to unassign vehicle');
          return;
        }
      } else {
        const { error: assignError } = await supabase.rpc('assign_vehicle', {
          p_driver: selectedDriver.driver_id,
          p_vehicle: selectedVehicleId,
        });

        if (assignError) {
          console.error('assign_vehicle error:', assignError);
          alert('Failed to assign vehicle');
          return;
        }
      }

      const refreshedDrivers = await fetchDrivers();
  setDrivers(refreshedDrivers as DriverRow[]);
      setTotalCount(refreshedDrivers.length);
  setActiveCount(countDriversByStatus(refreshedDrivers as DriverRow[], 'active'));

      setIsVehicleModalOpen(false);
      setSelectedDriver(null);
      setSelectedVehicleId('');

      alert('Vehicle updated successfully');
    } catch (err) {
      console.error('saveVehicleAssignment unexpected error:', err);
      alert('Unexpected error updating vehicle');
    }
  }

  async function loadPage() {
    try {
      setLoading(true);
      const [driversData, vehiclesData, statusResponse, shiftsResponse] = await Promise.all([
        fetchDrivers(),
        fetchVehicles(),
        supabase
          .from('view_driver_current_status')
          .select('driver_id, status, shift_id, last_location_at, lat, lng, speed_kmh, heading, vehicle_id, last_seen_at'),
        supabase
          .from('shifts')
          .select('id, driver_id, vehicle_id, started_at, ended_at, status')
          .or('status.eq.active,ended_at.is.null'),
      ]);

      setDrivers(driversData as DriverRow[]);
      setVehicles(vehiclesData);
      setTotalCount(driversData.length);
      setActiveCount(countDriversByStatus(driversData as DriverRow[], 'active'));

      const statusRows = (statusResponse.data as DriverCurrentStatusRow[]) ?? [];
      const nextStatusMap: Record<string, DriverLiveStatus> = {};
      statusRows.forEach((row) => {
        nextStatusMap[row.driver_id] = {
          driver_id: row.driver_id,
          last_seen_at: row.last_seen_at ?? null,
          is_online: isOnlineFromLastSeen(row.last_seen_at ?? null),
          status_state: row.status ?? null,
          on_break: null,
          status_started_at: null,
          last_location_at: row.last_location_at ?? null,
          lat: row.lat ?? null,
          lng: row.lng ?? null,
          speed_kmh: row.speed_kmh ?? null,
          heading: row.heading ?? null,
          vehicle_id: row.vehicle_id ?? null,
          shift_id: row.shift_id ?? null,
        };
      });
      setStatusMap(nextStatusMap);

      const activeShiftRows = (shiftsResponse.data as ShiftRow[]) ?? [];
      const nextShiftMap: Record<string, ShiftRow> = {};
      activeShiftRows.forEach((row) => {
        nextShiftMap[row.driver_id] = row;
      });
      setActiveShiftMap(nextShiftMap);

      const shiftIds = activeShiftRows.map((row) => row.id);
      const nextBreakByShiftId: Record<string, boolean> = {};
      if (shiftIds.length > 0) {
        const { data: breakEventsData, error: breakEventsError } = await supabase
          .from('shift_events')
          .select('shift_id, event_type, created_at')
          .in('shift_id', shiftIds)
          .in('event_type', ['break_start', 'break_end'])
          .order('created_at', { ascending: false });

        if (breakEventsError) {
          console.error('fetch shift_events break status error:', breakEventsError);
        } else {
          ((breakEventsData as ShiftBreakEventRow[]) ?? []).forEach((event) => {
            if (nextBreakByShiftId[event.shift_id] === undefined) {
              nextBreakByShiftId[event.shift_id] = event.event_type === 'break_start';
            }
          });
        }
      }
      setBreakByShiftId(nextBreakByShiftId);
      setError(null);
    } catch (err) {
      setError('Failed to load drivers or vehicles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Fetch drivers (from profiles) and vehicles on mount
  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDurationNow(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  const filteredDrivers = drivers.filter(
    (driver) =>
      (driver.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.phone?.includes(searchQuery))
  );

  const sortedDrivers = useMemo(() => {
    return [...filteredDrivers].sort((a, b) => {
      const aId = resolveDriverId(a);
      const bId = resolveDriverId(b);
      const aShift = aId ? activeShiftMap[aId] : undefined;
      const bShift = bId ? activeShiftMap[bId] : undefined;
      const aActive = aShift ? 1 : 0;
      const bActive = bShift ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;

      const aStartedAt = aShift?.started_at ? new Date(aShift.started_at).getTime() : 0;
      const bStartedAt = bShift?.started_at ? new Date(bShift.started_at).getTime() : 0;
      if (aStartedAt !== bStartedAt) return bStartedAt - aStartedAt;

      return (a.full_name ?? a.profile_email ?? a.email ?? '').localeCompare(
        b.full_name ?? b.profile_email ?? b.email ?? ''
      );
    });
  }, [filteredDrivers, resolveDriverId, activeShiftMap]);

  const vehicleOccupancy = useMemo(() => {
    const occupancy = new Map<string, { driverId: string; label: string }>();
    drivers.forEach((driver) => {
      const vehicleId = driver.current_vehicle_id;
      const driverId = resolveDriverId(driver);
      if (!vehicleId || !driverId) return;

      occupancy.set(String(vehicleId), {
        driverId,
        label: driver.full_name ?? driver.profile_email ?? driver.email ?? driverId,
      });
    });
    return occupancy;
  }, [drivers]);

  const parseCreateDriverError = (rawBody: string, status: number) => {
    if (!rawBody) return `Create driver failed (${status})`;

    try {
      const parsed = JSON.parse(rawBody) as { error?: string; message?: string; detail?: string };
      return parsed.error || parsed.message || parsed.detail || `Create driver failed (${status})`;
    } catch {
      return rawBody;
    }
  };

  // Add driver via admin API (requires server-side service role privileges)
  const handleAddDriver = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      setError('Name, email, and password are required');
      return;
    }
    // Check for duplicate email
    if (drivers.some((d) => d.email?.toLowerCase() === formData.email.toLowerCase())) {
      setError('A driver with this email already exists');
      return;
    }
    try {
      setError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        setError('Not authenticated. Please log in again.');
        return;
      }

      const endpoints = ['/api/admin/create-driver', '/admin/create-driver'];
      const payload = {
        email: formData.email,
        password: formData.password,
        full_name: formData.name || formData.email.split('@')[0],
        name: formData.name || formData.email.split('@')[0],
        phone: formData.phone,
      };

      let created = false;
      let lastErrorMessage = 'Failed to create driver';
      let sawNotFound = false;
      let createdResponse: { user_id?: string; driver?: { user_id?: string; full_name?: string | null } } | null = null;

      for (const endpoint of endpoints) {
        console.info('DriversPage: POST create-driver', { endpoint, email: formData.email });
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          createdResponse = await response.json().catch(() => null);
          created = true;
          break;
        }

        const responseBody = await response.text().catch(() => '');
        console.warn('DriversPage: create-driver non-OK response', {
          endpoint,
          status: response.status,
          body: responseBody,
        });

        if (response.status === 404) {
          sawNotFound = true;
          continue;
        }

        lastErrorMessage = parseCreateDriverError(responseBody, response.status);
        break;
      }

      if (!created) {
        if (sawNotFound) {
          setError('Driver creation API is not configured in this environment. Start the root dev server with "npm run dev" or configure an admin API endpoint.');
          return;
        }

        setError(lastErrorMessage);
        return;
      }

      // Refetch drivers list from drivers_full
      const previousTotal = totalCount;
      const refreshedDrivers = await fetchDrivers();
      const createdUserId = createdResponse?.driver?.user_id ?? createdResponse?.user_id ?? null;
      const normalizedName = (formData.name || formData.email.split('@')[0]).trim().toLowerCase();
      const createdDriver = refreshedDrivers.find((driver: DriverRow) => {
        if (createdUserId && driver.auth_user_id === createdUserId) {
          return true;
        }

        return (driver.full_name ?? '').trim().toLowerCase() === normalizedName;
      });
      setDrivers(refreshedDrivers as DriverRow[]);
      setTotalCount(refreshedDrivers.length);
      setActiveCount(countDriversByStatus(refreshedDrivers as DriverRow[], 'active'));
      if (!createdDriver && refreshedDrivers.length <= previousTotal) {
        const debugDetails = {
          expectedName: formData.name,
          createdUserId,
          listLength: refreshedDrivers.length,
          totalCount: refreshedDrivers.length,
          previousTotal,
        };
        console.warn('DriversPage: created driver not yet visible after refresh', debugDetails);
      }
      setDialogOpen(false);
      setFormData({ name: '', email: '', password: '', phone: '' });
      setError(null);
    } catch (err) {
      setError('Failed to create driver');
      console.error(err);
    }
  };

  const handleDeleteClick = (driver: DriverRow) => {
    setDriverToDelete(driver);
    setDeleteDialog(true);
  };

  async function handleDeleteConfirm() {
    if (!driverToDelete) return;

    try {
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        setError('Admin session expired. Please log in again.');
        return;
      }

      const endpoints = ['/api/admin/delete-driver', '/admin/delete-driver'];
      let deleted = false;
      let lastErrorMessage = 'Failed to delete driver';
      let sawNotFound = false;

      for (const endpoint of endpoints) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ driver_id: driverToDelete.driver_id }),
        });

        if (response.ok) {
          deleted = true;
          break;
        }

        const responseBody = await response.text().catch(() => '');
        console.warn('DriversPage: delete-driver non-OK response', {
          endpoint,
          status: response.status,
          body: responseBody,
        });

        if (response.status === 404) {
          sawNotFound = true;
          continue;
        }

        lastErrorMessage = parseCreateDriverError(responseBody, response.status);
        break;
      }

      if (!deleted) {
        if (sawNotFound) {
          setError('Driver delete API is not configured in this environment. Start the root dev server with "npm run dev" or configure an admin API endpoint.');
          return;
        }

        setError(lastErrorMessage);
        return;
      }

      // 5. Refresh UI
      const refreshedDrivers = await fetchDrivers();
      setDrivers(refreshedDrivers as DriverRow[]);
      setTotalCount(refreshedDrivers.length);
      setActiveCount(countDriversByStatus(refreshedDrivers as DriverRow[], 'active'));
      setDeleteDialog(false);
      setDriverToDelete(null);
      setError(null);
      alert('Driver deleted successfully');
    } catch (err) {
      console.error('Delete unexpected error:', err);
      alert('Unexpected error deleting driver');
    }
  }

  const handlePasswordReset = async () => {
    if (!passwordDriver) return;
    const email = passwordDriver.profile_email ?? passwordDriver.email;
    if (!email) {
      setError('Selected driver is missing an email address.');
      return;
    }
    try {
      setPasswordSaving(true);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) throw resetError;
      setError(null);
      setPasswordDialogOpen(false);
    } catch (err: any) {
      setError(err?.message ? `Failed to send reset link: ${err.message}` : 'Failed to send reset link.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <Card className="bg-red-950 border-red-900">
          <CardContent className="p-4 text-red-400">{error}</CardContent>
        </Card>
      )}

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Drivers</h1>
          <p className="text-gray-400">Manage your driver fleet</p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add Driver
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Total Drivers</p>
            <p className="text-3xl font-bold text-white">{loading ? '-' : totalCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Active Drivers</p>
            <p className="text-3xl font-bold text-green-400">{loading ? '-' : activeCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Offline</p>
            <p className="text-3xl font-bold text-blue-400">
              {loading ? '-' : totalCount - activeCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Drivers table */}
      <Card className="bg-[#161616] border-gray-800">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-white">All Drivers</CardTitle>
              <CardDescription className="text-gray-400">
                Shift duration is calculated from active shift start time.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Search drivers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#0F0F0F] border-gray-700 text-white placeholder:text-gray-500"
              />
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
                    <TableHead className="text-gray-400">Shift Duration</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400">Break</TableHead>
                    <TableHead className="text-gray-400">Current Vehicle</TableHead>
                    <TableHead className="text-gray-400">Current Shift</TableHead>
                    <TableHead className="text-gray-400 text-right">View Profile</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDrivers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No drivers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {sortedDrivers.map((driver) => {
                        const driverId = resolveDriverId(driver);
                        const status = driverId ? statusMap[driverId] : undefined;
                        const activeShift = driverId ? activeShiftMap[driverId] : undefined;
                        const isOnBreak = activeShift ? Boolean(breakByShiftId[activeShift.id]) : false;
                        return (
                          <TableRow key={driver.driver_id ?? driverId} className="border-gray-800">
                            <TableCell className="font-medium text-white">
                              <div>
                                <p>{driver.full_name ?? driver.profile_email ?? driver.email ?? driver.driver_id}</p>
                                <p className="text-xs text-gray-500">{driver.profile_email ?? driver.email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-300">
                              {getShiftDurationLabel(activeShift)}
                            </TableCell>
                            <TableCell>
                              {status?.status_state ? (
                                <Badge className="bg-blue-950 text-blue-300 border-blue-800">
                                  {status.status_state}
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-900 text-gray-300 border-gray-700">Unknown</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {isOnBreak ? (
                                <Badge className="bg-amber-950 text-amber-300 border-amber-800">On Break</Badge>
                              ) : (
                                <Badge className="bg-gray-900 text-gray-300 border-gray-700">No</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-gray-300">
                              {driver.current_vehicle_rego || 'None'}
                            </TableCell>
                            <TableCell className="text-gray-300">
                              {activeShift ? (
                                <Badge className="bg-blue-950 text-blue-300 border-blue-800">On Shift</Badge>
                              ) : (
                                <Badge className="bg-gray-900 text-gray-300 border-gray-700">Off Shift</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-2">
                                {driverId && (
                                  <Button
                                    asChild
                                    variant="ghost"
                                    size="sm"
                                    className="text-gray-300 hover:text-emerald-400"
                                  >
                                    <Link to={`/drivers/${driverId}`}>
                                      View profile
                                    </Link>
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-400 hover:text-blue-400 h-8 w-8 p-0"
                                  onClick={() => {
                                    openVehicleModal(driver);
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-400 hover:text-[#FF6B35] h-8 w-8 p-0"
                                  onClick={() => {
                                    setPasswordDriver(driver);
                                    setPasswordDialogOpen(true);
                                  }}
                                >
                                  <Key className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-400 hover:text-red-400 h-8 w-8 p-0"
                                  onClick={() => handleDeleteClick(driver)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  )}
                      {/* Edit Vehicle Assignment Dialog */}
                      <Dialog open={isVehicleModalOpen} onOpenChange={setIsVehicleModalOpen}>
                        <DialogContent className="bg-[#161616] border-gray-800">
                          <DialogHeader>
                            <DialogTitle className="text-white">Change Assigned Vehicle</DialogTitle>
                            <DialogDescription className="text-gray-400">
                              Assign a different vehicle to this driver
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label className="text-gray-300">Vehicle</Label>
                              <select
                                value={String(selectedVehicleId || '')}
                                onChange={(e) => setSelectedVehicleId(String(e.target.value))}
                                className="w-full bg-[#0F0F0F] border border-gray-700 text-white p-2 rounded"
                              >
                                <option value="">None</option>
                                {vehicles.map((vehicle) => {
                                  const occupancy = vehicleOccupancy.get(String(vehicle.id));
                                  const selectedDriverId = selectedDriver ? resolveDriverId(selectedDriver) : null;
                                  const occupiedByOtherDriver = Boolean(occupancy && occupancy.driverId !== selectedDriverId);

                                  return (
                                    <option
                                      key={vehicle.id}
                                      value={String(vehicle.id)}
                                      disabled={occupiedByOtherDriver}
                                    >
                                      {occupiedByOtherDriver
                                        ? `${vehicle.rego} (Assigned to ${occupancy?.label})`
                                        : vehicle.rego}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <Button
                              onClick={saveVehicleAssignment}
                              className="w-full bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
                            >
                              Save
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Set Driver Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="bg-[#161616] border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Set Driver Password</DialogTitle>
            <DialogDescription className="text-gray-400">
              A password reset link will be emailed to the selected driver.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Driver</Label>
              <div className="text-sm text-gray-200">
                {passwordDriver?.full_name ?? passwordDriver?.profile_email ?? passwordDriver?.email ?? 'Selected driver'}
              </div>
            </div>
            <Button
              onClick={handlePasswordReset}
              className="w-full bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
              disabled={passwordSaving}
            >
              {passwordSaving ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Driver Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#161616] border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Add Driver</DialogTitle>
            <DialogDescription className="text-gray-400">
              Create a new driver in the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Full Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Smith"
                className="bg-[#0F0F0F] border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                className="bg-[#0F0F0F] border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">Password</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Password"
                className="bg-[#0F0F0F] border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">Phone (optional)</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 234-567-8900"
                className="bg-[#0F0F0F] border-gray-700 text-white"
              />
            </div>
            <Button
              onClick={handleAddDriver}
              className="w-full bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
            >
              Create Driver
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent className="bg-[#161616] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Driver</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete {driverToDelete?.full_name ?? driverToDelete?.profile_email ?? driverToDelete?.driver_id}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-4">
            <AlertDialogCancel className="bg-gray-800 text-gray-300 hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
