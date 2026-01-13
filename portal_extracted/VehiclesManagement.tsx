import { useState, useEffect } from 'react';
import { Truck, CheckCircle, XCircle, Wrench, AlertTriangle } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { fetchDrivers as apiFetchDrivers, fetchVehicles as apiFetchVehicles, assignVehicleToDriver, unassignVehicle } from '../utils/assignments';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-987e9da2`;

export function VehiclesManagement() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState({
    open: false,
    license_plate: '',
    make: '',
    model: '',
    year: '',
  });

  const [assignDialog, setAssignDialog] = useState({ open: false, vehicleId: '', driverId: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [v, d] = await Promise.all([apiFetchVehicles(), apiFetchDrivers()]);
      setVehicles(v);
      setDrivers(d);
    } catch (error) {
      console.error('Error fetching vehicles/drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    await loadData();
  };

  const handleCreateVehicle = async () => {
    if (!createDialog.license_plate.trim()) {
      alert('Please enter a license plate');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/vehicles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          license_plate: createDialog.license_plate,
          make: createDialog.make,
          model: createDialog.model,
          year: createDialog.year ? parseInt(createDialog.year) : null,
          admin_name: 'Admin User',
        }),
      });

      if (response.ok) {
        setCreateDialog({ open: false, license_plate: '', make: '', model: '', year: '' });
        fetchVehicles();
        alert('Vehicle created successfully');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating vehicle:', error);
      alert('Failed to create vehicle');
    }
  };

  const handleToggleMaintenance = async (vehicleId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    
    if (!confirm(`Are you sure you want to ${newStatus ? 'flag this vehicle for maintenance' : 'clear maintenance flag'}?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          maintenance_required: newStatus,
          status: newStatus ? 'maintenance' : 'active',
          admin_name: 'Admin User',
        }),
      });

      if (response.ok) {
        fetchVehicles();
        alert(`Vehicle maintenance flag ${newStatus ? 'set' : 'cleared'} successfully`);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating vehicle:', error);
      alert('Failed to update vehicle');
    }
  };

  const openAssignDialog = (vehicleId: string) => {
    setAssignDialog({ open: true, vehicleId, driverId: '' });
  };

  const handleAssign = async () => {
    if (!assignDialog.driverId) {
      alert('Please select a driver');
      return;
    }
    try {
      const res = await assignVehicleToDriver(assignDialog.vehicleId, assignDialog.driverId);
      if (res.ok) {
        setAssignDialog({ open: false, vehicleId: '', driverId: '' });
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
        <div className="text-muted-foreground">Loading vehicles...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Vehicles Management</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage fleet vehicles and maintenance</p>
        </div>
        <Button onClick={() => setCreateDialog({ open: true, license_plate: '', make: '', model: '', year: '' })}>
          <Truck className="w-4 h-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-b border-border hover:bg-muted/30">
              <TableHead className="text-xs font-bold text-foreground uppercase">Status</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">License Plate</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Make</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Model</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Year</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Assigned Driver</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Maintenance</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Created</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No vehicles found
                </TableCell>
              </TableRow>
            ) : (
              vehicles.map((vehicle) => {
                const assigned = drivers.find(d => d.id === vehicle.assigned_driver_id);
                return (
                <TableRow key={vehicle.id} className="border-b border-border hover:bg-muted/20">
                  <TableCell>
                    {vehicle.status === 'active' ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-[#10b981]" />
                        <span className="text-xs text-[#10b981] font-medium">ACTIVE</span>
                      </div>
                    ) : vehicle.status === 'maintenance' ? (
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-[#f59e0b]" />
                        <span className="text-xs text-[#f59e0b] font-medium">MAINTENANCE</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground font-medium">INACTIVE</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-foreground font-mono">
                    {vehicle.license_plate}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{vehicle.make || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{vehicle.model || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{vehicle.year || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{assigned ? assigned.name : '-'}</TableCell>
                  <TableCell>
                    {vehicle.maintenance_required ? (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
                        <span className="text-xs text-[#f59e0b] font-medium">REQUIRED</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">OK</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(vehicle.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      {vehicle.assigned_driver_id ? (
                        <Button size="sm" variant="outline" onClick={() => handleUnassign(vehicle.id)} className="text-xs">Unassign</Button>
                      ) : (
                        <Button size="sm" onClick={() => openAssignDialog(vehicle.id)} className="text-xs">Assign Driver</Button>
                      )}

                      <Button
                        size="sm"
                        variant={vehicle.maintenance_required ? 'default' : 'outline'}
                        onClick={() => handleToggleMaintenance(vehicle.id, vehicle.maintenance_required)}
                        className="text-xs"
                      >
                        {vehicle.maintenance_required ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Clear
                          </>
                        ) : (
                          <>
                            <Wrench className="w-3 h-3 mr-1" />
                            Flag
                          </>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignDialog.open} onOpenChange={(open) => setAssignDialog({ ...assignDialog, open })}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Assign Driver</DialogTitle>
            <DialogDescription>Select a driver to assign to this vehicle.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Driver</label>
              <select value={assignDialog.driverId} onChange={(e) => setAssignDialog({ ...assignDialog, driverId: e.target.value })} className="w-full p-2 rounded border">
                <option value="">-- Select driver --</option>
                {drivers.filter(d => d.status === 'active').map(d => (
                  <option key={d.id} value={d.id}>{d.name} {d.email ? `- ${d.email}` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog({ open: false, vehicleId: '', driverId: '' })}>
              Cancel
            </Button>
            <Button onClick={handleAssign}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Vehicle Dialog */}
      <Dialog open={createDialog.open} onOpenChange={(open) => setCreateDialog({ ...createDialog, open })}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Add New Vehicle</DialogTitle>
            <DialogDescription>
              Add a new vehicle to the fleet. Make sure to enter accurate information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">License Plate (Required)</label>
              <Input
                placeholder="ABC-1234"
                value={createDialog.license_plate}
                onChange={(e) => setCreateDialog({ ...createDialog, license_plate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Make</label>
              <Input
                placeholder="Ford"
                value={createDialog.make}
                onChange={(e) => setCreateDialog({ ...createDialog, make: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Model</label>
              <Input
                placeholder="Transit"
                value={createDialog.model}
                onChange={(e) => setCreateDialog({ ...createDialog, model: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Year</label>
              <Input
                type="number"
                placeholder="2023"
                value={createDialog.year}
                onChange={(e) => setCreateDialog({ ...createDialog, year: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog({ open: false, license_plate: '', make: '', model: '', year: '' })}>
              Cancel
            </Button>
            <Button onClick={handleCreateVehicle}>Create Vehicle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
