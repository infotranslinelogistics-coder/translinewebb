// Main dashboard page with real data from Supabase
import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Users, Truck, Calendar, Wrench, AlertCircle, TrendingUp, Loader, Activity, ShieldAlert, ClipboardList } from 'lucide-react';
import { getDashboardStats, DashboardStats, listActivityLogs, ActivityLog } from '@/lib/db/dashboard';
import { supabase } from '@/lib/supabase';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeShiftCount, setActiveShiftCount] = useState(0);
  const [forceEndedToday, setForceEndedToday] = useState(0);
  const [adminActionsToday, setAdminActionsToday] = useState(0);

  const fetchActiveShiftCount = useCallback(async () => {
    const { count, error: err } = await supabase
      .from('shifts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    if (err) { console.error('fetchActiveShiftCount:', err); return; }
    setActiveShiftCount(count || 0);
  }, []);

  const fetchForceEndedToday = useCallback(async () => {
    const { count, error: err } = await supabase
      .from('shifts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'force_ended')
      .gte('ended_at', startOfToday().toISOString());
    if (err) { console.error('fetchForceEndedToday:', err); return; }
    setForceEndedToday(count || 0);
  }, []);

  const fetchAdminActionsToday = useCallback(async () => {
    const { count, error: err } = await supabase
      .from('admin_audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfToday().toISOString());
    if (err) { console.error('fetchAdminActionsToday:', err); return; }
    setAdminActionsToday(count || 0);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const [dashboardStats, logs] = await Promise.all([
          getDashboardStats(),
          listActivityLogs(10),
        ]);
        setStats(dashboardStats);
        setActivityLogs(logs);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    fetchActiveShiftCount();
    fetchForceEndedToday();
    fetchAdminActionsToday();

    // Refresh stats every 30 seconds
    const interval = setInterval(fetchData, 30000);

    return () => clearInterval(interval);
  }, [fetchActiveShiftCount, fetchForceEndedToday, fetchAdminActionsToday]);

  // Realtime subscription: auto-update monitor stats when shifts or audit logs change
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-monitor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        () => {
          fetchActiveShiftCount();
          fetchForceEndedToday();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_audit_logs' },
        () => {
          fetchAdminActionsToday();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActiveShiftCount, fetchForceEndedToday, fetchAdminActionsToday]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">Overview of your fleet operations</p>
        </div>
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-2">
            <Loader className="w-8 h-8 text-[#FF6B35] animate-spin" />
            <p className="text-gray-400">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">Overview of your fleet operations</p>
        </div>
        <Card className="bg-red-950 border-red-900">
          <CardContent className="p-6">
            <p className="text-red-200">{error || 'Failed to load dashboard'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statsCards = [
    {
      name: 'Total Drivers',
      value: stats.totalDrivers.toString(),
      icon: Users,
      change: `${stats.activeDrivers} on active shifts`,
      color: 'bg-blue-500',
    },
    {
      name: 'Total Vehicles',
      value: stats.totalVehicles.toString(),
      icon: Truck,
      change: `${stats.activeVehicles} in active shifts`,
      color: 'bg-purple-500',
    },
    {
      name: 'Active Shifts',
      value: stats.activeShifts.toString(),
      icon: Calendar,
      change: `${stats.todayShifts} today`,
      color: 'bg-orange-500',
    },
    {
      name: 'Due for Service',
      value: stats.vehiclesInMaintenance.toString(),
      icon: Wrench,
      change: `${stats.pendingMaintenance} pending`,
      color: 'bg-yellow-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Overview of your fleet operations</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.name} className="bg-[#161616] border-gray-800">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-400 mb-1">{stat.name}</p>
                    <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.change}</p>
                  </div>
                  <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Live Monitor Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-400 mb-1">Active Shifts Now</p>
                <p className="text-3xl font-bold text-green-400">{activeShiftCount}</p>
              </div>
              <div className="bg-green-700 w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                <Activity className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-400 mb-1">Force-Ended Today</p>
                <p className="text-3xl font-bold text-red-400">{forceEndedToday}</p>
              </div>
              <div className="bg-red-700 w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-400 mb-1">Admin Actions Today</p>
                <p className="text-3xl font-bold text-blue-400">{adminActionsToday}</p>
              </div>
              <div className="bg-blue-700 w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card className="bg-[#161616] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Recent Activity</CardTitle>
          <CardDescription className="text-gray-400">Admin actions and system events</CardDescription>
        </CardHeader>
        <CardContent>
          {activityLogs.length === 0 ? (
            <p className="text-gray-400 text-sm">No recent activity</p>
          ) : (
            <div className="space-y-4">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between p-3 bg-[#0F0F0F] rounded-lg border border-gray-800"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white capitalize">{log.action}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {log.resource_type} · {log.resource_id}
                    </p>
                    {log.details && (
                      <p className="text-xs text-gray-400 mt-1">{log.details}</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 whitespace-nowrap ml-2">
                    {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#161616] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Fleet Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-[#0F0F0F] rounded border border-gray-800">
              <span className="text-gray-300">Drivers on Active Shifts</span>
              <span className="text-lg font-bold text-[#FF6B35]">{stats.activeDrivers}/{stats.totalDrivers}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#0F0F0F] rounded border border-gray-800">
              <span className="text-gray-300">Vehicles in Active Shifts</span>
              <span className="text-lg font-bold text-[#FF6B35]">{stats.activeVehicles}/{stats.totalVehicles}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#0F0F0F] rounded border border-gray-800">
              <span className="text-gray-300">Shifts Active</span>
              <span className="text-lg font-bold text-green-400">{stats.activeShifts}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#161616] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Maintenance Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-[#0F0F0F] rounded border border-gray-800">
              <span className="text-gray-300">Vehicles in Maintenance</span>
              <span className="text-lg font-bold text-yellow-400">{stats.vehiclesInMaintenance}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#0F0F0F] rounded border border-gray-800">
              <span className="text-gray-300">Pending Items</span>
              <span className="text-lg font-bold text-orange-400">{stats.pendingMaintenance}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
