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
import { formatDistanceToNow } from 'date-fns';

type ShiftRow = {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: 'active' | 'ended' | 'cancelled';
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
  const [selectedDriver, setSelectedDriver] = useState<DriverRow | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDriver, setPasswordDriver] = useState<DriverRow | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const resolveDriverId = (driver: DriverRow) =>
    driver.driver_id ?? driver.id ?? driver.auth_user_id;
  const isOnline = (status?: DriverLiveStatus) =>
    isOnlineFromLastSeen(status?.last_seen_at) || Boolean(status?.is_online);

  async function fetchDrivers() {
    const { data, error: driversError } = await supabase
      .from('drivers_with_current_vehicle')
      .select('*')
      .order('full_name');

    if (driversError) {
      console.error('fetchDrivers error:', driversError);
      return [];
    }

    return data ?? [];
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
        supabase.from('view_driver_current_status').select('*'),
        supabase.from('shifts').select('*').or('status.eq.active,ended_at.is.null'),
      ]);

      setDrivers(driversData as DriverRow[]);
      setVehicles(vehiclesData);
      setTotalCount(driversData.length);
      setActiveCount(countDriversByStatus(driversData as DriverRow[], 'active'));

      const statusRows = (statusResponse.data as DriverLiveStatus[]) ?? [];
      const nextStatusMap: Record<string, DriverLiveStatus> = {};
      statusRows.forEach((row) => {
        nextStatusMap[row.driver_id] = {
          ...row,
          is_online: isOnlineFromLastSeen(row.last_seen_at),
        };
      });
      setStatusMap(nextStatusMap);

      const activeShiftRows = (shiftsResponse.data as ShiftRow[]) ?? [];
      const nextShiftMap: Record<string, ShiftRow> = {};
      activeShiftRows.forEach((row) => {
        nextShiftMap[row.driver_id] = row;
      });
      setActiveShiftMap(nextShiftMap);
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
      const aStatus = aId ? statusMap[aId] : undefined;
      const bStatus = bId ? statusMap[bId] : undefined;
      const aOnline = isOnline(aStatus) ? 1 : 0;
      const bOnline = isOnline(bStatus) ? 1 : 0;
      if (aOnline !== bOnline) return bOnline - aOnline;
      const aLastSeen = aStatus?.last_seen_at ? new Date(aStatus.last_seen_at).getTime() : 0;
      const bLastSeen = bStatus?.last_seen_at ? new Date(bStatus.last_seen_at).getTime() : 0;
      return bLastSeen - aLastSeen;
    });
  }, [filteredDrivers, resolveDriverId, statusMap]);

  // Add driver via Supabase Auth (creates profile automatically)
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
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        setError('Not authenticated. Please log in again.');
        return;
      }
      console.info('DriversPage: POST /api/admin/create-driver email=', formData.email);
      const response = await fetch('/api/admin/create-driver', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email: formData.email, password: formData.password, full_name: formData.name || formData.email.split('@')[0], phone: formData.phone }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        console.warn('DriversPage: /api/admin/create-driver error=', errBody);
        setError(errBody?.error || 'Failed to create driver');
        return;
      }
      // Refetch drivers list from drivers_full
      const previousTotal = totalCount;
      const refreshedDrivers = await fetchDrivers();
      const normalizedEmail = formData.email.toLowerCase();
      const createdDriver = refreshedDrivers.find((driver: DriverRow) =>
        (driver.profile_email ?? driver.email ?? '').toLowerCase() === normalizedEmail
      );
      setDrivers(refreshedDrivers as DriverRow[]);
      setTotalCount(refreshedDrivers.length);
      setActiveCount(countDriversByStatus(refreshedDrivers as DriverRow[], 'active'));
      if (!createdDriver || refreshedDrivers.length <= previousTotal) {
        const debugDetails = {
          expectedEmail: formData.email,
          listLength: refreshedDrivers.length,
          totalCount: refreshedDrivers.length,
          previousTotal,
        };
        console.error('DriversPage: verification failed after create', debugDetails);
        setError(`Verification failed after create. Details: ${JSON.stringify(debugDetails)}`);
      }
      setDialogOpen(false);
      setFormData({ name: '', email: '', password: '', phone: '' });
      if (createdDriver) {
        setError(null);
      }
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
      // 1. Close active vehicle assignment via canonical RPC
      await unassignDriverFromAllVehicles(driverToDelete.driver_id);

      // 2. Delete driver-related activity (optional but safe)
      await supabase
        .from('driver_presence')
        .delete()
        .eq('driver_id', driverToDelete.driver_id);

      // 3. Delete driver row
      const { error: driverError } = await supabase
        .from('drivers')
        .delete()
        .eq('id', driverToDelete.driver_id);

      if (driverError) {
        console.error('Delete driver error:', driverError);
        alert('Failed to delete driver');
        return;
      }

      // 4. Delete profile (optional but recommended)
      await supabase
        .from('profiles')
        .delete()
        .eq('id', driverToDelete.auth_user_id);

      // 5. Refresh UI
      const refreshedDrivers = await fetchDrivers();
      setDrivers(refreshedDrivers as DriverRow[]);
      setTotalCount(refreshedDrivers.length);
      setActiveCount(countDriversByStatus(refreshedDrivers as DriverRow[], 'active'));
      setDeleteDialog(false);
      setDriverToDelete(null);
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
                View and manage driver information
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
                    <TableHead className="text-gray-400">Online</TableHead>
                    <TableHead className="text-gray-400">Last Seen</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400">Break</TableHead>
                    <TableHead className="text-gray-400">Current Vehicle</TableHead>
                    <TableHead className="text-gray-400">Current Shift</TableHead>
                    <TableHead className="text-gray-400">Last Location</TableHead>
                    <TableHead className="text-gray-400 text-right">View Profile</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDrivers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        No drivers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {sortedDrivers.map((driver) => {
                        const driverId = resolveDriverId(driver);
                        const status = driverId ? statusMap[driverId] : undefined;
                        const activeShift = driverId ? activeShiftMap[driverId] : undefined;
                        return (
                          <TableRow key={driver.driver_id ?? driverId} className="border-gray-800">
                            <TableCell className="font-medium text-white">
                              <div>
                                <p>{driver.full_name ?? driver.profile_email ?? driver.email ?? driver.driver_id}</p>
                                <p className="text-xs text-gray-500">{driver.profile_email ?? driver.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {isOnline(status) ? (
                                <Badge className="bg-green-950 text-green-400 border-green-900">Online</Badge>
                              ) : (
                                <Badge className="bg-gray-900 text-gray-300 border-gray-700">Offline</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-gray-300">
                              {status?.last_seen_at
                                ? formatDistanceToNow(new Date(status.last_seen_at), { addSuffix: true })
                                : 'Never'}
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
                              {status?.on_break ? (
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
                            <TableCell className="text-gray-300">
                              {status?.last_location_at
                                ? formatDistanceToNow(new Date(status.last_location_at), { addSuffix: true })
                                : 'No GPS'}
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
                                {vehicles.map((vehicle) => (
                                  <option key={vehicle.id} value={String(vehicle.id)}>
                                    {vehicle.rego}
                                  </option>
                                ))}
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
