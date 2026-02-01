import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Button } from '@/app/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/app/components/ui/drawer';
import { ExternalLink, Image as ImageIcon, Loader } from 'lucide-react';
import { format } from 'date-fns';
import { listVehicles, Vehicle } from '@/lib/db/vehicles';
import { fetchDriverOptions } from '@/lib/drivers';
import { listMaintenanceLogs, MaintenanceLog } from '@/lib/db/vehicleLogs';
import { getVehicleLogPhotoUrl } from '@/lib/storage/vehicleLogPhotos';

const PAGE_SIZE = 20;
const CATEGORIES = ['service', 'repair', 'tyres', 'battery', 'other'];

interface MaintenanceLogRow extends MaintenanceLog {
  signed_url?: string | null;
}

export function MaintenanceLogsPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [logs, setLogs] = useState<MaintenanceLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [driverFilter, setDriverFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<MaintenanceLogRow | null>(null);

  const driverMap = useMemo(() => {
    const map = new Map<string, any>();
    drivers.forEach((driver) => {
      const id = driver.driver_id ?? driver.id ?? driver.auth_user_id;
      if (id) map.set(id, driver);
    });
    return map;
  }, [drivers]);

  const vehicleMap = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach((vehicle) => map.set(vehicle.id, vehicle));
    return map;
  }, [vehicles]);

  useEffect(() => {
    const fetchFilters = async () => {
      const [driverOptions, vehicleOptions] = await Promise.all([
        fetchDriverOptions(),
        listVehicles(),
      ]);
      setDrivers(driverOptions ?? []);
      setVehicles(vehicleOptions ?? []);
    };
    fetchFilters();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const filters = {
        driverId: driverFilter !== 'all' ? driverFilter : undefined,
        vehicleId: vehicleFilter !== 'all' ? vehicleFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
      };
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count } = await listMaintenanceLogs(filters, { from, to });
      const signed = await Promise.all(
        data.map(async (row) => ({
          ...row,
          signed_url: row.photo_path ? await getVehicleLogPhotoUrl(row.photo_path) : null,
        }))
      );
      setLogs(signed as MaintenanceLogRow[]);
      setTotalCount(count);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load maintenance logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [driverFilter, vehicleFilter, categoryFilter, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [driverFilter, vehicleFilter, categoryFilter, startDate, endDate, page]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {error && (
        <Card className="bg-red-950 border-red-900">
          <CardContent className="p-4 text-red-400">{error}</CardContent>
        </Card>
      )}

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Vehicle Logs</h1>
        <p className="text-gray-400">Track repairs, services, and vehicle upkeep</p>
        <div className="flex gap-2 mt-4">
          <Button asChild variant="outline" className="border-gray-700 text-gray-200">
            <Link to="/vehicle-logs/fuel">Fuel</Link>
          </Button>
          <Button asChild className="bg-[#FF6B35] hover:bg-[#E55A2B] text-white">
            <Link to="/vehicle-logs/maintenance">Maintenance</Link>
          </Button>
        </div>
      </div>

      <Card className="bg-[#161616] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Filters</CardTitle>
          <CardDescription className="text-gray-400">Filter by driver, vehicle, category, and date</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Driver</Label>
            <Select value={driverFilter} onValueChange={setDriverFilter}>
              <SelectTrigger className="bg-[#0F0F0F] border-gray-700 text-white">
                <SelectValue placeholder="All drivers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All drivers</SelectItem>
                {drivers.map((driver) => {
                  const id = driver.driver_id ?? driver.id ?? driver.auth_user_id;
                  return (
                    <SelectItem key={id} value={id}>
                      {driver.full_name ?? driver.name ?? driver.email ?? id}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Vehicle</Label>
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger className="bg-[#0F0F0F] border-gray-700 text-white">
                <SelectValue placeholder="All vehicles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vehicles</SelectItem>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.plate_number} • {vehicle.make} {vehicle.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="bg-[#0F0F0F] border-gray-700 text-white">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Start date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#0F0F0F] border-gray-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">End date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[#0F0F0F] border-gray-700 text-white"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#161616] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Maintenance Entries</CardTitle>
          <CardDescription className="text-gray-400">{totalCount} total entries</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader className="w-8 h-8 text-[#FF6B35] animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Noted</TableHead>
                    <TableHead className="text-gray-400">Driver</TableHead>
                    <TableHead className="text-gray-400">Vehicle</TableHead>
                    <TableHead className="text-gray-400">Category</TableHead>
                    <TableHead className="text-gray-400">Title</TableHead>
                    <TableHead className="text-gray-400">Cost</TableHead>
                    <TableHead className="text-gray-400">Odometer</TableHead>
                    <TableHead className="text-gray-400">Vendor</TableHead>
                    <TableHead className="text-gray-400">Photo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        No maintenance logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => {
                      const driver = log.driver_id ? driverMap.get(log.driver_id) : null;
                      const vehicle = log.vehicle_id ? vehicleMap.get(log.vehicle_id) : null;
                      return (
                        <TableRow
                          key={log.id}
                          className="border-gray-800 cursor-pointer hover:bg-[#0F0F0F]"
                          onClick={() => setSelectedLog(log)}
                        >
                          <TableCell className="text-gray-300">
                            {format(new Date(log.noted_at), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {driver?.full_name ?? driver?.name ?? driver?.email ?? log.driver_id ?? '—'}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {vehicle ? `${vehicle.plate_number} • ${vehicle.make} ${vehicle.model}` : 'Unknown'}
                          </TableCell>
                          <TableCell className="text-gray-300">{log.category}</TableCell>
                          <TableCell className="text-gray-300">{log.title}</TableCell>
                          <TableCell className="text-gray-300">{log.cost ?? '—'}</TableCell>
                          <TableCell className="text-gray-300">{log.odometer_value ?? '—'}</TableCell>
                          <TableCell className="text-gray-300">{log.vendor_name ?? '—'}</TableCell>
                          <TableCell className="text-gray-300">
                            {log.signed_url ? (
                              <img
                                src={log.signed_url}
                                alt="Maintenance"
                                className="h-10 w-14 object-cover rounded border border-gray-700"
                              />
                            ) : (
                              <span className="text-gray-500 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4" /> None
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-300"
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-300"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Drawer open={Boolean(selectedLog)} onOpenChange={() => setSelectedLog(null)}>
        <DrawerContent className="bg-[#161616] border-gray-800">
          <DrawerHeader>
            <DrawerTitle className="text-white">Maintenance Log Details</DrawerTitle>
            <DrawerDescription className="text-gray-400">
              Review repair details, vendor info, and attachments.
            </DrawerDescription>
          </DrawerHeader>
          {selectedLog && (
            <div className="px-6 pb-6 space-y-4 text-gray-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Driver</p>
                  <p>{driverMap.get(selectedLog.driver_id ?? '')?.full_name ?? selectedLog.driver_id ?? '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vehicle</p>
                  <p>
                    {selectedLog.vehicle_id && vehicleMap.get(selectedLog.vehicle_id)
                      ? `${vehicleMap.get(selectedLog.vehicle_id)?.plate_number} • ${vehicleMap.get(selectedLog.vehicle_id)?.make} ${vehicleMap.get(selectedLog.vehicle_id)?.model}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p>{selectedLog.category}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Title</p>
                  <p>{selectedLog.title}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cost</p>
                  <p>{selectedLog.cost ?? '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Odometer</p>
                  <p>{selectedLog.odometer_value ?? '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vendor</p>
                  <p>{selectedLog.vendor_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vendor address</p>
                  <p>{selectedLog.vendor_address ?? '—'}</p>
                </div>
              </div>

              {selectedLog.description && (
                <div>
                  <p className="text-sm text-gray-500">Description</p>
                  <p>{selectedLog.description}</p>
                </div>
              )}

              {selectedLog.lat && selectedLog.lng && (
                <Button asChild variant="outline" className="border-gray-700 text-gray-200">
                  <a
                    href={`https://www.google.com/maps?q=${selectedLog.lat},${selectedLog.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in Google Maps
                  </a>
                </Button>
              )}

              {selectedLog.signed_url ? (
                <img
                  src={selectedLog.signed_url}
                  alt="Maintenance"
                  className="w-full max-h-[320px] object-contain rounded border border-gray-700"
                />
              ) : (
                <p className="text-gray-500">No maintenance photo.</p>
              )}

              <div>
                <p className="text-sm text-gray-500">Meta</p>
                <pre className="text-xs bg-[#0F0F0F] p-3 rounded border border-gray-800 whitespace-pre-wrap">
                  {selectedLog.meta && Object.keys(selectedLog.meta).length > 0
                    ? JSON.stringify(selectedLog.meta, null, 2)
                    : '—'}
                </pre>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
