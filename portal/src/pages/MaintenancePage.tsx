import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Search, Plus, Wrench, AlertTriangle, CheckCircle, Calendar, Trash2, Loader, Pencil } from 'lucide-react';
import {
  acknowledgeMaintenanceAlert,
  completeMaintenanceAlert,
  generateMaintenanceAlerts,
  listOpenMaintenanceAlerts,
  listMaintenanceItems,
  createMaintenanceItem,
  updateMaintenanceItem,
  deleteMaintenanceItem,
  type MaintenanceAlert,
  type MaintenanceItem,
} from '@/lib/db/maintenance';
import { listVehicles, type Vehicle } from '@/lib/db/vehicles';
import { listDrivers, type Driver } from '@/lib/db/drivers';
import { formatPerthDate, formatPerthDateTime, PERTH_TIME_LABEL } from '@/lib/dateTime';

type MaintenanceStatus = 'due' | 'passed' | 'done';

type FormState = {
  vehicleId: string;
  driverId: string;
  serviceType: string;
  scheduledDate: string;
  status: MaintenanceStatus;
};

const EMPTY_FORM: FormState = {
  vehicleId: '',
  driverId: 'none',
  serviceType: '',
  scheduledDate: '',
  status: 'due',
};

const normalizeStatus = (status: string | null | undefined): MaintenanceStatus => {
  if (status === 'done' || status === 'completed') return 'done';
  if (status === 'passed' || status === 'overdue' || status === 'cancelled') return 'passed';
  return 'due';
};

const statusBadgeClass = (status: MaintenanceStatus) => {
  if (status === 'done') return 'bg-green-950 text-green-400 border-green-900';
  if (status === 'passed') return 'bg-red-950 text-red-400 border-red-900';
  return 'bg-yellow-950 text-yellow-400 border-yellow-900';
};

const toDateInputValue = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

export function MaintenancePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MaintenanceItem | null>(null);
  const [editingItem, setEditingItem] = useState<MaintenanceItem | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [automaticAlerts, setAutomaticAlerts] = useState<MaintenanceAlert[]>([]);
  const [alertBusyId, setAlertBusyId] = useState<string | null>(null);

  const vehicleMap = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach((vehicle) => map.set(vehicle.id, vehicle));
    return map;
  }, [vehicles]);

  const driverMap = useMemo(() => {
    const map = new Map<string, Driver>();
    drivers.forEach((driver) => map.set(driver.driver_id, driver));
    return map;
  }, [drivers]);

  const dedupeAlerts = (alerts: MaintenanceAlert[]) => {
    const byKey = new Map<string, MaintenanceAlert>();
    alerts.forEach((alert) => {
      const key = `${alert.vehicle_id ?? alert.vehicle_rego ?? alert.id}|${alert.service_due_km ?? 'none'}`;
      if (!byKey.has(key)) {
        byKey.set(key, alert);
      }
    });
    return Array.from(byKey.values());
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      await generateMaintenanceAlerts();

      const [itemsList, vehicleList, driverList, alerts] = await Promise.all([
        listMaintenanceItems(),
        listVehicles(),
        listDrivers(),
        listOpenMaintenanceAlerts(),
      ]);
      setMaintenanceItems(itemsList);
      setVehicles(vehicleList);
      setDrivers(driverList);
      setAutomaticAlerts(dedupeAlerts(alerts));
      setError(null);
    } catch (err) {
      setError('Failed to load maintenance data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return maintenanceItems.filter((item) => {
      if (!query) return true;
      const vehicle = vehicleMap.get(item.vehicle_id);
      const driverId = item.driver_id ?? '';
      const driver = driverMap.get(driverId);

      const haystack = [
        item.service_type,
        item.vehicle_id,
        vehicle?.rego,
        vehicle?.make ?? '',
        vehicle?.model ?? '',
        driver?.full_name ?? '',
        driver?.email ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [driverMap, maintenanceItems, searchQuery, vehicleMap]);

  const dueCount = maintenanceItems.filter((item) => normalizeStatus(item.status) === 'due').length;
  const passedCount = maintenanceItems.filter((item) => normalizeStatus(item.status) === 'passed').length;
  const doneCount = maintenanceItems.filter((item) => normalizeStatus(item.status) === 'done').length;

  const getVehicleLabel = (vehicle: Vehicle) => {
    const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
    return makeModel ? `${vehicle.rego} • ${makeModel}` : vehicle.rego;
  };

  const getDriverLabel = (driver: Driver) => {
    return driver.full_name ?? driver.email ?? driver.profile_email ?? driver.driver_id;
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (item: MaintenanceItem) => {
    setEditingItem(item);
    setFormData({
      vehicleId: item.vehicle_id,
      driverId: item.driver_id ?? 'none',
      serviceType: item.service_type,
      scheduledDate: toDateInputValue(item.scheduled_date ?? item.service_date),
      status: normalizeStatus(item.status),
    });
    setDialogOpen(true);
  };

  const buildMutationPayload = () => {
    const serviceDate = formData.scheduledDate
      ? new Date(`${formData.scheduledDate}T00:00:00.000Z`).toISOString()
      : null;

    return {
      vehicle_id: formData.vehicleId,
      service_type: formData.serviceType.trim(),
      service_date: serviceDate,
      scheduled_date: serviceDate,
      status: formData.status,
      driver_id: formData.driverId === 'none' ? null : formData.driverId,
    };
  };

  const runCreateWithDriverFallback = async () => {
    const payload = buildMutationPayload();
    try {
      return await createMaintenanceItem(payload as Omit<MaintenanceItem, 'id' | 'created_at' | 'updated_at'>);
    } catch (err: any) {
      if (String(err?.message ?? '').toLowerCase().includes('driver_id')) {
        const { driver_id, ...withoutDriver } = payload;
        return await createMaintenanceItem(withoutDriver as Omit<MaintenanceItem, 'id' | 'created_at' | 'updated_at'>);
      }
      throw err;
    }
  };

  const runUpdateWithDriverFallback = async (id: string) => {
    const payload = buildMutationPayload();
    try {
      return await updateMaintenanceItem(id, payload as Partial<MaintenanceItem>);
    } catch (err: any) {
      if (String(err?.message ?? '').toLowerCase().includes('driver_id')) {
        const { driver_id, ...withoutDriver } = payload;
        return await updateMaintenanceItem(id, withoutDriver as Partial<MaintenanceItem>);
      }
      throw err;
    }
  };

  const handleSaveMaintenance = async () => {
    if (!formData.vehicleId || !formData.serviceType.trim() || !formData.scheduledDate) {
      setError('Vehicle, service type, and date are required');
      return;
    }

    try {
      if (editingItem) {
        const updated = await runUpdateWithDriverFallback(editingItem.id);
        setMaintenanceItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await runCreateWithDriverFallback();
        setMaintenanceItems((prev) => [created, ...prev]);
      }

      setDialogOpen(false);
      setEditingItem(null);
      setFormData(EMPTY_FORM);
      setError(null);
    } catch (err) {
      setError('Failed to save maintenance item');
      console.error(err);
    }
  };

  const handleDeleteClick = (item: MaintenanceItem) => {
    setSelectedItem(item);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedItem) return;

    try {
      await deleteMaintenanceItem(selectedItem.id);
      setMaintenanceItems((prev) => prev.filter((item) => item.id !== selectedItem.id));
      setDeleteDialog(false);
      setSelectedItem(null);
      setError(null);
    } catch (err) {
      setError('Failed to delete maintenance item');
      console.error(err);
    }
  };

  const handleToggleCompleted = async (item: MaintenanceItem) => {
    const current = normalizeStatus(item.status);
    const next: MaintenanceStatus = current === 'done' ? 'due' : 'done';

    try {
      const updated = await updateMaintenanceItem(item.id, { status: next } as Partial<MaintenanceItem>);
      setMaintenanceItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setError(null);
    } catch (err) {
      setError('Failed to update maintenance status');
      console.error(err);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      setAlertBusyId(alertId);
      await acknowledgeMaintenanceAlert(alertId);
      setAutomaticAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
      setError(null);
    } catch (err) {
      setError('Failed to acknowledge maintenance alert');
      console.error(err);
    } finally {
      setAlertBusyId(null);
    }
  };

  const handleCompleteAlert = async (alertId: string) => {
    try {
      setAlertBusyId(alertId);
      await completeMaintenanceAlert(alertId);
      setAutomaticAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
      setError(null);
    } catch (err) {
      setError('Failed to complete maintenance alert');
      console.error(err);
    } finally {
      setAlertBusyId(null);
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
          <h1 className="text-3xl font-bold text-white mb-2">Maintenance</h1>
          <p className="text-gray-400">Track maintenance tasks ({PERTH_TIME_LABEL})</p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Service
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-950 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Due</p>
                <p className="text-3xl font-bold text-yellow-400">{loading ? '-' : dueCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-950 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Passed</p>
                <p className="text-3xl font-bold text-red-400">{loading ? '-' : passedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-950 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Done</p>
                <p className="text-3xl font-bold text-green-400">{loading ? '-' : doneCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-950 rounded-lg flex items-center justify-center">
                <Wrench className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Total</p>
                <p className="text-3xl font-bold text-blue-400">{loading ? '-' : maintenanceItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {automaticAlerts.length > 0 && (
        <Card className="bg-[#161616] border-yellow-900">
          <CardHeader>
            <CardTitle className="text-yellow-300">Automatic Service Alerts</CardTitle>
            <CardDescription className="text-gray-400">
              Service due soon alerts generated automatically and kept open until acknowledged/completed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Vehicle rego</TableHead>
                    <TableHead className="text-gray-400">Current odometer</TableHead>
                    <TableHead className="text-gray-400">Service due km</TableHead>
                    <TableHead className="text-gray-400">KM remaining</TableHead>
                    <TableHead className="text-gray-400">Created ({PERTH_TIME_LABEL})</TableHead>
                    <TableHead className="text-right text-gray-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {automaticAlerts.map((alert) => {
                    const busy = alertBusyId === alert.id;
                    return (
                      <TableRow key={alert.id} className="border-gray-800">
                        <TableCell className="text-gray-200">{alert.vehicle_rego ?? alert.vehicle_id ?? 'Unknown'}</TableCell>
                        <TableCell className="text-gray-300">
                          {alert.current_odometer != null ? `${Math.round(alert.current_odometer).toLocaleString()} km` : '—'}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {alert.service_due_km != null ? `${Math.round(alert.service_due_km).toLocaleString()} km` : '—'}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {alert.km_remaining != null ? `${Math.round(alert.km_remaining).toLocaleString()} km` : '—'}
                        </TableCell>
                        <TableCell className="text-gray-300">{formatPerthDateTime(alert.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-gray-700 text-gray-200"
                              disabled={busy}
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                            >
                              Acknowledge
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 text-white hover:bg-green-500"
                              disabled={busy}
                              onClick={() => handleCompleteAlert(alert.id)}
                            >
                              Mark completed
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#161616] border-gray-800">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-white">Maintenance Schedule</CardTitle>
              <CardDescription className="text-gray-400">
                Vehicle, optional driver, service type, date, status, and actions
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Search service, vehicle, driver..."
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
                    <TableHead className="text-gray-400">Vehicle</TableHead>
                    <TableHead className="text-gray-400">Driver (optional)</TableHead>
                    <TableHead className="text-gray-400">Type of service</TableHead>
                    <TableHead className="text-gray-400">Date</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No maintenance items found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => {
                      const normalized = normalizeStatus(item.status);
                      const vehicle = vehicleMap.get(item.vehicle_id);
                      const driver = item.driver_id ? driverMap.get(item.driver_id) : null;
                      const rowDate = item.scheduled_date ?? item.service_date;

                      return (
                        <TableRow key={item.id} className="border-gray-800">
                          <TableCell className="text-gray-200 font-medium">
                            {vehicle ? getVehicleLabel(vehicle) : item.vehicle_id}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {driver ? getDriverLabel(driver) : '—'}
                          </TableCell>
                          <TableCell className="text-gray-300">{item.service_type}</TableCell>
                          <TableCell className="text-gray-300">
                            {rowDate ? formatPerthDate(rowDate) : 'Not scheduled'}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusBadgeClass(normalized)}>
                              {normalized}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-300 hover:text-white"
                                onClick={() => openEditDialog(item)}
                              >
                                <Pencil className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-400 hover:text-green-300"
                                onClick={() => handleToggleCompleted(item)}
                              >
                                {normalized === 'done' ? 'Mark uncompleted' : 'Mark completed'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300"
                                onClick={() => handleDeleteClick(item)}
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Delete
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#161616] border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">{editingItem ? 'Edit Maintenance' : 'Add Maintenance'}</DialogTitle>
            <DialogDescription className="text-gray-400">
              Set vehicle, optional driver, type of service, date, and status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Vehicle</Label>
              <Select
                value={formData.vehicleId}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, vehicleId: value }))}
              >
                <SelectTrigger className="bg-[#0F0F0F] border-gray-700 text-white">
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {getVehicleLabel(vehicle)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-300">Driver (optional)</Label>
              <Select
                value={formData.driverId}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, driverId: value }))}
              >
                <SelectTrigger className="bg-[#0F0F0F] border-gray-700 text-white">
                  <SelectValue placeholder="No driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No driver</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.driver_id} value={driver.driver_id}>
                      {getDriverLabel(driver)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-300">Type of service</Label>
              <Input
                value={formData.serviceType}
                onChange={(e) => setFormData((prev) => ({ ...prev, serviceType: e.target.value }))}
                placeholder="e.g., Oil change"
                className="bg-[#0F0F0F] border-gray-700 text-white"
              />
            </div>

            <div>
              <Label className="text-gray-300">Date</Label>
              <Input
                type="date"
                value={formData.scheduledDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, scheduledDate: e.target.value }))}
                className="bg-[#0F0F0F] border-gray-700 text-white"
              />
            </div>

            <div>
              <Label className="text-gray-300">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value as MaintenanceStatus }))}
              >
                <SelectTrigger className="bg-[#0F0F0F] border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due">due</SelectItem>
                  <SelectItem value="passed">passed</SelectItem>
                  <SelectItem value="done">done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleSaveMaintenance}
              className="w-full bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
            >
              {editingItem ? 'Save changes' : 'Add maintenance'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent className="bg-[#161616] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Maintenance Item</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Delete this maintenance record? This action cannot be undone.
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
