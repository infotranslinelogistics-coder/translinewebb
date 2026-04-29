// Driver logs and incident reports page
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Search, Eye, AlertCircle, Wrench, AlertTriangle, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router';


import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type LogType = 'incident' | 'maintenance' | 'accident' | 'general';
type FilterType = 'all' | LogType;

const severityWeight: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function normalizeLogType(rawType?: string | null): LogType {
  const value = (rawType ?? '').toLowerCase();
  if (value === 'incident') return 'incident';
  if (value === 'maintenance' || value === 'maintenance_issue') return 'maintenance';
  if (value === 'accident') return 'accident';
  return 'general';
}

function getLogTypeLabel(type: LogType): string {
  switch (type) {
    case 'incident':
      return 'Incidents';
    case 'maintenance':
      return 'Maintenance';
    case 'accident':
      return 'Accidents';
    default:
      return 'General';
  }
}

export interface DriverLog {
  id: string;
  driver_name: string;
  vehicle_plate: string;
  log_type: LogType;
  description: string;
  created_at: string;
  severity: string;
}

export function LogsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [logs, setLogs] = useState<DriverLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('driver_logs')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        const normalizedLogs = (data || []).map((row) => ({
          ...row,
          log_type: normalizeLogType(row.log_type),
        })) as DriverLog[];
        setLogs(normalizedLogs);
      } catch (err) {
        setError('Failed to load logs');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const normalizedQuery = searchQuery.toLowerCase();

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      (log.driver_name ?? '').toLowerCase().includes(normalizedQuery) ||
      (log.vehicle_plate ?? '').toLowerCase().includes(normalizedQuery) ||
      (log.description ?? '').toLowerCase().includes(normalizedQuery);

    const matchesType = filterType === 'all' || log.log_type === filterType;

    return matchesSearch && matchesType;
  });

  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      const dateDelta = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (dateDelta !== 0) return dateDelta;

      return (severityWeight[b.severity?.toLowerCase()] ?? 0) - (severityWeight[a.severity?.toLowerCase()] ?? 0);
    });
  }, [filteredLogs]);

  const handleMaintenanceRoute = () => {
    navigate('/maintenance');
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'incident':
        return AlertCircle;
      case 'maintenance':
        return Wrench;
      case 'accident':
        return AlertTriangle;
      default:
        return FileText;
    }
  };

  const getLogTypeBadge = (type: string) => {
    switch (type) {
      case 'incident':
        return 'bg-orange-950 text-orange-400 border-orange-900';
      case 'maintenance':
        return 'bg-yellow-950 text-yellow-400 border-yellow-900';
      case 'accident':
        return 'bg-red-950 text-red-400 border-red-900';
      default:
        return 'bg-blue-950 text-blue-400 border-blue-900';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-950 text-red-400 border-red-900';
      case 'medium':
        return 'bg-yellow-950 text-yellow-400 border-yellow-900';
      default:
        return 'bg-gray-800 text-gray-400 border-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Logs</h1>
        <p className="text-gray-400">Driver logs, incidents, and reports</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Total Logs</p>
            <p className="text-3xl font-bold text-white">{logs.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Incidents</p>
            <p className="text-3xl font-bold text-orange-400">
              {logs.filter((l) => l.log_type === 'incident').length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Maintenance</p>
            <p className="text-3xl font-bold text-yellow-400">
              {logs.filter((l) => l.log_type === 'maintenance').length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Accidents</p>
            <p className="text-3xl font-bold text-red-400">
              {logs.filter((l) => l.log_type === 'accident').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Logs table */}
      <Card className="bg-[#161616] border-gray-800">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-white">All Logs</CardTitle>
                <CardDescription className="text-gray-400">
                  View driver-submitted logs and reports
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#0F0F0F] border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterType('all')}
                className={
                  filterType === 'all'
                    ? 'bg-[#FF6B35] hover:bg-[#E55A2B] text-white'
                    : 'border-gray-700 text-gray-400 hover:text-white'
                }
              >
                All
              </Button>
              <Button
                variant={filterType === 'incident' ? 'default' : 'outline'}
                onClick={() => setFilterType('incident')}
                className={
                  filterType === 'incident'
                    ? 'bg-[#FF6B35] hover:bg-[#E55A2B] text-white'
                    : 'border-gray-700 text-gray-400 hover:text-white'
                }
              >
                Incidents
              </Button>
              <Button
                variant={filterType === 'maintenance' ? 'default' : 'outline'}
                onClick={() => setFilterType('maintenance')}
                className={
                  filterType === 'maintenance'
                    ? 'bg-[#FF6B35] hover:bg-[#E55A2B] text-white'
                    : 'border-gray-700 text-gray-400 hover:text-white'
                }
              >
                Maintenance
              </Button>
              <Button
                variant={filterType === 'accident' ? 'default' : 'outline'}
                onClick={() => setFilterType('accident')}
                className={
                  filterType === 'accident'
                    ? 'bg-[#FF6B35] hover:bg-[#E55A2B] text-white'
                    : 'border-gray-700 text-gray-400 hover:text-white'
                }
              >
                Accidents
              </Button>
              <Button
                variant={filterType === 'general' ? 'default' : 'outline'}
                onClick={() => setFilterType('general')}
                className={
                  filterType === 'general'
                    ? 'bg-[#FF6B35] hover:bg-[#E55A2B] text-white'
                    : 'border-gray-700 text-gray-400 hover:text-white'
                }
              >
                General
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Type</TableHead>
                  <TableHead className="text-gray-400">Driver</TableHead>
                  <TableHead className="text-gray-400">Vehicle</TableHead>
                  <TableHead className="text-gray-400">Description</TableHead>
                  <TableHead className="text-gray-400">Date/Time</TableHead>
                  <TableHead className="text-gray-400">Severity</TableHead>
                  <TableHead className="text-gray-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLogs.map((log) => {
                  const Icon = getLogIcon(log.log_type);
                  return (
                    <TableRow
                      key={log.id}
                      className="border-gray-800"
                      onClick={log.log_type === 'maintenance' ? handleMaintenanceRoute : undefined}
                    >
                      <TableCell>
                        <Badge className={getLogTypeBadge(log.log_type)}>
                          <Icon className="w-3 h-3 mr-1" />
                          {getLogTypeLabel(log.log_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-white">{log.driver_name}</TableCell>
                      <TableCell className="text-gray-300">{log.vehicle_plate}</TableCell>
                      <TableCell className="text-gray-300 max-w-xs truncate">
                        {log.description}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {log.created_at ? format(new Date(log.created_at), 'MMM dd, HH:mm') : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getSeverityBadge(log.severity)}>
                          {log.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-white h-8 w-8 p-0"
                            onClick={() => {
                              if (log.log_type === 'maintenance') {
                                handleMaintenanceRoute();
                                return;
                              }
                            }}
                          >
                            <Eye className="w-4 h-4" />
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
    </div>
  );
}
