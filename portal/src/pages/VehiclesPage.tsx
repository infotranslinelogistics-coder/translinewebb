import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Search, Plus, Eye, Trash2, Loader } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { listVehicles as listVehiclesWithAssignments, type Vehicle as DbVehicle } from '@/lib/db/vehicles';

interface Vehicle {
  id: string;
  rego: string;
  make: string | null;
  model: string | null;
  status: string;
  driver_name?: string | null;
  driver_id?: string | null;
}

interface Driver {
  driver_id: string;
  full_name: string;
}

export function VehiclesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [maintenanceCount, setMaintenanceCount] = useState(0);
  const [formData, setFormData] = useState({
    rego: '',
    make: '',
    model: '',
    status: 'active',
  });
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  const resolveVehicleId = (vehicle: Vehicle | null) => vehicle?.id ?? '';

  const applyVehicleState = (vehiclesData: Vehicle[]) => {
    setVehicles(vehiclesData);
    setTotalCount(vehiclesData.length);
    setActiveCount(vehiclesData.filter((v) => v.status === 'active').length);
    setMaintenanceCount(vehiclesData.filter((v) => v.status === 'maintenance').length);
  };

  async function fetchVehicles() {
    try {
      const vehicles = await listVehiclesWithAssignments();
      return (vehicles as DbVehicle[]).map((vehicle) => ({
        id: vehicle.id,
        rego: vehicle.rego,
        make: vehicle.make,
        model: vehicle.model,
        status: vehicle.status,
        driver_id: vehicle.driver_id ?? null,
        driver_name: vehicle.driver_name ?? null,
      }));
    } catch (error) {
      console.error('fetchVehicles error:', error);
      return [];
    }
  }

  async function fetchDrivers() {
    const { data, error } = await supabase
      .from('drivers_with_current_vehicle')
      .select('driver_id, full_name')
      .order('full_name');

    if (error) {
      console.error('fetchDrivers error:', error);
      return [];
    }

    return data ?? [];
  }

  async function loadPage() {
    try {
      setLoading(true);
      const [vehiclesData, driversData] = await Promise.all([
        fetchVehicles(),
        fetchDrivers(),
      ]);

      applyVehicleState(vehiclesData as Vehicle[]);
      setDrivers(driversData as Driver[]);
      setError(null);
    } catch (err: any) {
      setError('Failed to load vehicles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredVehicles = vehicles.filter((v) => {
    const q = searchQuery.toLowerCase();
    return (
      (v.rego ?? '').toLowerCase().includes(q) ||
      (v.make ?? '').toLowerCase().includes(q) ||
      (v.model ?? '').toLowerCase().includes(q)
    );
  });

  const handleAddVehicle = async () => {
    if (!formData.rego) {
      setError('Rego is required');
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from('vehicles')
        .insert({
          rego: formData.rego,
          make: formData.make || null,
          model: formData.model || null,
          status: formData.status || 'active',
        });

      if (insertError) {
        throw new Error(insertError.message || 'Failed to create vehicle');
      }

      setDialogOpen(false);
      setFormData({ rego: '', make: '', model: '', status: 'active' });
      setError(null);
      const updatedVehicles = await fetchVehicles();
      applyVehicleState(updatedVehicles as Vehicle[]);
    } catch (err: any) {
      setError(err.message || 'Failed to create vehicle');
      console.error(err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedVehicle) return;

    const vehicleId = resolveVehicleId(selectedVehicle);
    if (!vehicleId) {
      setError('Missing vehicle id');
      return;
    }

    try {
      const { error: delError } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', vehicleId);

      if (delError) throw delError;

      setDeleteDialog(false);
      setSelectedVehicle(null);
      setError(null);
      const updatedVehicles = await fetchVehicles();
      applyVehicleState(updatedVehicles as Vehicle[]);
    } catch (err: any) {
      setError('Failed to delete vehicle');
      console.error(err);
    }
  };

  function openAssignModal(vehicle: Vehicle) {
    setSelectedVehicle(vehicle);
    setSelectedDriverId(vehicle.driver_id ? String(vehicle.driver_id) : '');
    setIsAssignModalOpen(true);
  }

  async function saveVehicleAssignment() {
    if (!selectedVehicle) return;

    const vehicleId = resolveVehicleId(selectedVehicle);
    if (!vehicleId) {
      alert('Missing vehicle id');
      return;
    }

    try {
      if (!selectedDriverId) {
        const { error } = await supabase.rpc('assign_vehicle', {
          p_driver: null,
          p_vehicle: vehicleId,
        });

        if (error) {
          console.error(error);
          alert('Failed to unassign vehicle');
          return;
        }
      } else {
        const { error } = await supabase.rpc('assign_vehicle', {
          p_driver: selectedDriverId,
          p_vehicle: vehicleId,
        });

        if (error) {
          console.error(error);
          alert('Failed to assign vehicle');
          return;
        }
      }

      const refreshedVehicles = await fetchVehicles();
      applyVehicleState(refreshedVehicles as Vehicle[]);

      setIsAssignModalOpen(false);
      setSelectedVehicle(null);
      setSelectedDriverId('');

      alert('Vehicle updated successfully');
    } catch (err) {
      console.error(err);
      alert('Unexpected error');
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-950 text-green-400 border-green-900';
      case 'maintenance': return 'bg-yellow-950 text-yellow-400 border-yellow-900';
      default: return 'bg-gray-800 text-gray-400 border-gray-700';
    }
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
          <h1 className="text-3xl font-bold text-white mb-2">Vehicles</h1>
          <p className="text-gray-400">Manage your vehicle fleet</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#FF6B35] hover:bg-[#E55A2B] text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Vehicle
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Vehicles', value: totalCount, color: 'text-white' },
          { label: 'Active', value: activeCount, color: 'text-green-400' },
          { label: 'In Maintenance', value: maintenanceCount, color: 'text-yellow-400' },
          { label: 'Inactive', value: totalCount - activeCount - maintenanceCount, color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="bg-[#161616] border-gray-800">
            <CardContent className="p-6">
              <p className="text-sm text-gray-400 mb-1">{label}</p>
              <p className={`text-3xl font-bold ${color}`}>{loading ? '-' : value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-[#161616] border-gray-800">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-white">All Vehicles</CardTitle>
              <CardDescription className="text-gray-400">View and manage vehicle information</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Search vehicles..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
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
                    <TableHead className="text-gray-400">Rego</TableHead>
                    <TableHead className="text-gray-400">Make / Model</TableHead>
                    <TableHead className="text-gray-400">Driver</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVehicles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No vehicles found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVehicles.map((vehicle) => {
                      return (
                        <TableRow key={vehicle.id} className="border-gray-800">
                          <TableCell className="font-medium text-white">{vehicle.rego}</TableCell>
                          <TableCell className="text-gray-300">
                            {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {vehicle.driver_name || <span className="text-gray-500">Unassigned</span>}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusBadge(vehicle.status)}>{vehicle.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-400 hover:text-blue-400 h-8 w-8 p-0"
                                onClick={() => {
                                  openAssignModal(vehicle);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-400 hover:text-red-400 h-8 w-8 p-0"
                                onClick={() => { setSelectedVehicle(vehicle); setDeleteDialog(true); }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Vehicle Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open: boolean) => { setDialogOpen(open); if (!open) setFormData({ rego: '', make: '', model: '', status: 'active' }); }}>
        <DialogContent className="bg-[#161616] border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Add Vehicle</DialogTitle>
            <DialogDescription className="text-gray-400">Add a new vehicle to the fleet</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Rego <span className="text-red-400">*</span></Label>
              <Input
                value={formData.rego}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, rego: e.target.value })}
                placeholder="ABC123"
                className="bg-[#0F0F0F] border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">Make</Label>
              <Input
                value={formData.make}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, make: e.target.value })}
                placeholder="Ford"
                className="bg-[#0F0F0F] border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">Model</Label>
              <Input
                value={formData.model}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, model: e.target.value })}
                placeholder="Transit"
                className="bg-[#0F0F0F] border-gray-700 text-white"
              />
            </div>
            <Button onClick={handleAddVehicle} className="w-full bg-[#FF6B35] hover:bg-[#E55A2B] text-white">
              Create Vehicle
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Driver Modal */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="bg-[#161616] border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Assign Driver</DialogTitle>
            <DialogDescription className="text-gray-400">
              Assign or change the driver for {selectedVehicle?.rego}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Driver</Label>
              <select
                value={String(selectedDriverId || '')}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedDriverId(String(e.target.value))}
                className="w-full bg-[#0F0F0F] border border-gray-700 text-white p-2 rounded"
              >
                <option value="">Unassigned</option>
                {drivers.map((driver) => (
                  <option key={driver.driver_id} value={String(driver.driver_id)}>
                    {driver.full_name}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={saveVehicleAssignment} className="w-full bg-[#FF6B35] hover:bg-[#E55A2B] text-white">
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent className="bg-[#161616] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Vehicle</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete {selectedVehicle?.rego}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-4">
            <AlertDialogCancel className="bg-gray-800 text-gray-300 hover:bg-gray-700">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 text-white hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
