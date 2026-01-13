import { useState, useEffect } from 'react';
import { Users, CheckCircle, XCircle, Lock, Unlock } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { fetchDrivers as apiFetchDrivers, fetchVehicles as apiFetchVehicles, assignVehicleToDriver, unassignVehicle } from '../utils/assignments';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-987e9da2`;

export function DriversManagement() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState({
    open: false,
    name: '',
    email: '',
    phone: '',
  });

  const [assignDialog, setAssignDialog] = useState({ open: false, driverId: '', vehicleId: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [d, v] = await Promise.all([apiFetchDrivers(), apiFetchVehicles()]);
      const driversWithAssignment = d.map((dr: any) => {
        const assigned = v.find((veh: any) => veh.assigned_driver_id === dr.id);
        return { ...dr, assigned_vehicle: assigned ? assigned.license_plate : null, assigned_vehicle_id: assigned ? assigned.id : null };
      });
      setDrivers(driversWithAssignment);
      setVehicles(v);
    } catch (error) {
      console.error('Error loading drivers/vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    await loadData();
  };

  const handleCreateDriver = async () => {
    if (!createDialog.name.trim()) {
      alert('Please enter a driver name');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/drivers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          name: createDialog.name,
          email: createDialog.email,
          phone: createDialog.phone,
          admin_name: 'Admin User',
        }),
      });

      if (response.ok) {
        setCreateDialog({ open: false, name: '', email: '', phone: '' });
        fetchDrivers();
        alert('Driver created successfully');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating driver:', error);
      alert('Failed to create driver');
    }
  };

  const handleToggleStatus = async (driverId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    if (!confirm(`Are you sure you want to ${newStatus === 'active' ? 'activate' : 'deactivate'} this driver?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/drivers/${driverId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          status: newStatus,
          admin_name: 'Admin User',
        }),
      });

      if (response.ok) {
        fetchDrivers();
        alert(`Driver ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating driver:', error);
      alert('Failed to update driver status');
    }
  };

  const openAssignDialog = (driverId: string) => {
    setAssignDialog({ open: true, driverId, vehicleId: '' });
  };

  const handleAssign = async () => {
    if (!assignDialog.vehicleId) {
      alert('Please select a vehicle');
      return;
    }
    try {
      const res = await assignVehicleToDriver(assignDialog.vehicleId, assignDialog.driverId);
      if (res.ok) {
        setAssignDialog({ open: false, driverId: '', vehicleId: '' });
        await loadData();
        alert('Vehicle assigned');
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'assignment failed'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Assignment failed');
    }
  };

  const handleUnassign = async (vehicleId: string) => {
    if (!confirm('Unassign this vehicle?')) return;
    try {
      const res = await unassignVehicle(vehicleId);
      if (res.ok) {
        await loadData();
        alert('Vehicle unassigned');
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'unassign failed'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Unassign failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading drivers...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Drivers Management</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage driver accounts and permissions</p>
        </div>
        <Button onClick={() => setCreateDialog({ open: true, name: '', email: '', phone: '' })}>
          <Users className="w-4 h-4 mr-2" />
          Add Driver
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-b border-border hover:bg-muted/30">
              <TableHead className="text-xs font-bold text-foreground uppercase">Status</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Name</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Email</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Phone</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Assigned Vehicle</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Created</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No drivers found
                </TableCell>
              </TableRow>
            ) : (
              drivers.map((driver) => (
                <TableRow key={driver.id} className="border-b border-border hover:bg-muted/20">
                  <TableCell>
                    {driver.status === 'active' ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-[#10b981]" />
                        <span className="text-xs text-[#10b981] font-medium">ACTIVE</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground font-medium">INACTIVE</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-foreground">{driver.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{driver.email || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{driver.phone || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{driver.assigned_vehicle || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(driver.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      {driver.assigned_vehicle ? (
                        <Button size="sm" variant="outline" onClick={() => handleUnassign(driver.assigned_vehicle_id)} className="text-xs">
                          Unassign
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => openAssignDialog(driver.id)} className="text-xs">
                          Assign Vehicle
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant={driver.status === 'active' ? 'destructive' : 'default'}
                        onClick={() => handleToggleStatus(driver.id, driver.status)}
                        className="text-xs"
                      >
                        {driver.status === 'active' ? (
                          <>
                            <Lock className="w-3 h-3 mr-1" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3 h-3 mr-1" />
                            Activate
                          </>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Assign Vehicle Dialog */}
      <Dialog open={assignDialog.open} onOpenChange={(open) => setAssignDialog({ ...assignDialog, open })}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Assign Vehicle</DialogTitle>
            <DialogDescription>Select an unassigned vehicle to assign to this driver.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Vehicle</label>
              <select value={assignDialog.vehicleId} onChange={(e) => setAssignDialog({ ...assignDialog, vehicleId: e.target.value })} className="w-full p-2 rounded border">
                <option value="">-- Select vehicle --</option>
                {vehicles.filter(v => !v.assigned_driver_id).map(v => (
                  <option key={v.id} value={v.id}>{v.license_plate} {v.make ? `- ${v.make}` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog({ open: false, driverId: '', vehicleId: '' })}>
              Cancel
            </Button>
            <Button onClick={handleAssign}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Driver Dialog */}
      <Dialog open={createDialog.open} onOpenChange={(open) => setCreateDialog({ ...createDialog, open })}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Add New Driver</DialogTitle>
            <DialogDescription>
              Create a new driver account. The driver will be able to log in and manage shifts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Name (Required)</label>
              <Input
                placeholder="John Doe"
                value={createDialog.name}
                onChange={(e) => setCreateDialog({ ...createDialog, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Email</label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={createDialog.email}
                onChange={(e) => setCreateDialog({ ...createDialog, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Phone</label>
              <Input
                placeholder="555-0101"
                value={createDialog.phone}
                onChange={(e) => setCreateDialog({ ...createDialog, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog({ open: false, name: '', email: '', phone: '' })}>
              Cancel
            </Button>
            <Button onClick={handleCreateDriver}>Create Driver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
