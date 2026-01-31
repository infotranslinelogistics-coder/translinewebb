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
import { listFuelLogs, FuelLog } from '@/lib/db/vehicleLogs';
import { getVehicleLogPhotoUrl } from '@/lib/storage/vehicleLogPhotos';

const PAGE_SIZE = 20;

interface FuelLogRow extends FuelLog {
  signed_url?: string | null;
}

export function FuelLogsPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [logs, setLogs] = useState<FuelLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [driverFilter, setDriverFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [costMin, setCostMin] = useState('');
  const [costMax, setCostMax] = useState('');
  const [selectedLog, setSelectedLog] = useState<FuelLog | null>(null);

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
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        costMin: costMin ? Number(costMin) : null,
        costMax: costMax ? Number(costMax) : null,
      };
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count } = await listFuelLogs(filters, { from, to });
      const signed = await Promise.all(
        data.map(async (row) => ({
          ...row,
          receipt_photo_path: row.receipt_photo_path,
          signed_url: row.receipt_photo_path
            ? await getVehicleLogPhotoUrl(row.receipt_photo_path)
            : null,
        }))
      );
      setLogs(signed as FuelLogRow[]);
      setTotalCount(count);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load fuel logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [driverFilter, vehicleFilter, startDate, endDate, costMin, costMax]);

  useEffect(() => {
    fetchLogs();
  }, [driverFilter, vehicleFilter, startDate, endDate, costMin, costMax, page]);

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
        <p className="text-gray-400">Track fueling events with receipts and GPS context</p>
        <div className="flex gap-2 mt-4">
          <Button asChild className="bg-[#FF6B35] hover:bg-[#E55A2B] text-white">
            <Link to="/vehicle-logs/fuel">Fuel</Link>
          </Button>
          <Button asChild variant="outline" className="border-gray-700 text-gray-200">
            <Link to="/vehicle-logs/maintenance">Maintenance</Link>
          </Button>
        </div>
      </div>

      <Card className="bg-[#161616] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Filters</CardTitle>
          <CardDescription className="text-gray-400">Filter by driver, vehicle, date, and cost</CardDescription>
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
          <div className="space-y-2">
            <Label className="text-gray-300">Cost range</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={costMin}
                onChange={(e) => setCostMin(e.target.value)}
                className="bg-[#0F0F0F] border-gray-700 text-white"
              />
              <Input
                type="number"
                placeholder="Max"
                value={costMax}
                onChange={(e) => setCostMax(e.target.value)}
                className="bg-[#0F0F0F] border-gray-700 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#161616] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Fuel Entries</CardTitle>
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
                    <TableHead className="text-gray-400">Liters</TableHead>
                    <TableHead className="text-gray-400">Cost</TableHead>
                    <TableHead className="text-gray-400">Station</TableHead>
                    <TableHead className="text-gray-400">Location</TableHead>
                    <TableHead className="text-gray-400">Receipt</TableHead>
                    <TableHead className="text-gray-400">Notes/Meta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        No fuel logs found
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
                          <TableCell className="text-gray-300">{log.liters ?? '—'}</TableCell>
                          <TableCell className="text-gray-300">{log.cost ?? '—'}</TableCell>
                          <TableCell className="text-gray-300">
                            {log.station_name ?? '—'}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {log.lat && log.lng ? (
                              <a
                                href={`https://www.google.com/maps?q=${log.lat},${log.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#FF6B35] hover:underline"
                              >
                                {log.lat.toFixed(4)}, {log.lng.toFixed(4)}
                              </a>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {log.signed_url ? (
                              <img
                                src={log.signed_url}
                                alt="Receipt"
                                className="h-10 w-14 object-cover rounded border border-gray-700"
                              />
                            ) : (
                              <span className="text-gray-500 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4" /> None
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-300 max-w-[200px] truncate">
                            {log.meta && Object.keys(log.meta).length > 0 ? JSON.stringify(log.meta) : '—'}
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
            <DrawerTitle className="text-white">Fuel Log Details</DrawerTitle>
            <DrawerDescription className="text-gray-400">
              Review the fueling record and receipt.
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
                  <p className="text-sm text-gray-500">Fuel type</p>
                  <p>{selectedLog.fuel_type ?? '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Station</p>
                  <p>{selectedLog.station_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Station address</p>
                  <p>{selectedLog.station_address ?? '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Liters / Cost</p>
                  <p>{selectedLog.liters ?? '—'} / {selectedLog.cost ?? '—'}</p>
                </div>
              </div>

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
                  alt="Receipt"
                  className="w-full max-h-[320px] object-contain rounded border border-gray-700"
                />
              ) : (
                <p className="text-gray-500">No receipt image.</p>
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
