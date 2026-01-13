import { useState, useEffect } from 'react';
import { Truck, CheckCircle, XCircle, Wrench, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { fetchVehicles, logAdminAction } from '../lib/api';
import { supabase } from '../lib/supabase-client';

export default function VehiclesManagement() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState({
    open: false,
    license_plate: '',
    make: '',
    model: '',
    year: '',
  });

  useEffect(() => {
    fetchVehiclesData();
  }, []);

  const fetchVehiclesData = async () => {
    try {
      const data = await fetchVehicles();
      setVehicles(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setLoading(false);
    }
  };

  const handleCreateVehicle = async () => {
    if (!createDialog.license_plate.trim()) {
      alert('Please enter a license plate');
      return;
    }

    try {
      const { data, error } = await supabase.from('vehicles').insert({
        registration: createDialog.license_plate,
        make: createDialog.make,
        model: createDialog.model,
        year: createDialog.year ? parseInt(createDialog.year) : null,
      }).select().single();

      if (error) throw error;

      // Log admin action
      await logAdminAction(
        'create_vehicle',
        data?.id || null,
        'vehicle',
        `Created vehicle ${createDialog.license_plate}`,
        { registration: createDialog.license_plate, make: createDialog.make, model: createDialog.model, year: createDialog.year }
      );

      setCreateDialog({ open: false, license_plate: '', make: '', model: '', year: '' });
      fetchVehiclesData();
      alert('Vehicle created successfully');
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
      const { error } = await supabase
        .from('vehicles')
        .update({
          maintenance_required: newStatus,
          status: newStatus ? 'maintenance' : 'active',
        })
        .eq('id', vehicleId);

      if (error) throw error;

      // Log admin action
      await logAdminAction(
        'update_vehicle',
        vehicleId,
        'vehicle',
        `${newStatus ? 'Flagged vehicle for maintenance' : 'Cleared maintenance flag'}`,
        { maintenance_required: newStatus }
      );

      fetchVehiclesData();
      alert(`Vehicle maintenance flag ${newStatus ? 'set' : 'cleared'} successfully`);
    } catch (error) {
      console.error('Error updating vehicle:', error);
      alert('Failed to update vehicle');
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
              <TableHead className="text-xs font-bold text-foreground uppercase">Maintenance</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase">Created</TableHead>
              <TableHead className="text-xs font-bold text-foreground uppercase text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No vehicles found
                </TableCell>
              </TableRow>
            ) : (
              vehicles.map((vehicle) => (
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
                    {vehicle.registration}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{vehicle.make || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{vehicle.model || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{vehicle.year || '-'}</TableCell>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Vehicle Dialog */}
      <Dialog open={createDialog.open} onOpenChange={(open: boolean) => setCreateDialog({ ...createDialog, open })}>
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
