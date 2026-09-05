// Main dashboard page with real data from Supabase
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Users, Truck, Calendar, Wrench, AlertCircle, TrendingUp, Loader, Activity, ShieldAlert, ClipboardList } from 'lucide-react';
import { getDashboardStats, DashboardStats } from '@/lib/db/dashboard';
import { supabase } from '@/lib/supabase';
import { PERTH_TIME_LABEL } from '@/lib/dateTime';
import { useInbox } from '@/contexts/InboxContext';
import { RouteMap } from '@shared/components/RouteMap';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const {
    notifications,
    checklistPendingCount,
    busyId: alertBusyId,
    acknowledge,
    complete,
  } = useInbox();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeShiftCount, setActiveShiftCount] = useState<number | null>(0);
  const [forceEndedToday, setForceEndedToday] = useState<number | null>(0);
  const [adminActionsToday, setAdminActionsToday] = useState<number | null>(0);
  const [serviceAlertOpen, setServiceAlertOpen] = useState(false);
  const autoOpenedRef = useRef(false);

  const fetchActiveShiftCount = useCallback(async () => {
    const { count, error: err } = await supabase
      .from('shifts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    if (err) { console.error('fetchActiveShiftCount:', err); setActiveShiftCount(null); return; }
    setActiveShiftCount(count || 0);
  }, []);

  const fetchForceEndedToday = useCallback(async () => {
    const { count, error: err } = await supabase
      .from('shifts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'force_ended')
      .gte('ended_at', startOfToday().toISOString());
    if (err) { console.error('fetchForceEndedToday:', err); setForceEndedToday(null); return; }
    setForceEndedToday(count || 0);
  }, []);

  const fetchAdminActionsToday = useCallback(async () => {
    const { count, error: err } = await supabase
      .from('admin_audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfToday().toISOString());
    if (err) { console.error('fetchAdminActionsToday:', err); setAdminActionsToday(null); return; }
    setAdminActionsToday(count || 0);
  }, []);

  // Auto-open popup once on first load if there are unacknowledged alerts
  useEffect(() => {
    if (!autoOpenedRef.current && notifications.length > 0) {
      autoOpenedRef.current = true;
      setServiceAlertOpen(true);
    }
  }, [notifications.length]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const dashboardStats = await getDashboardStats();
        setStats(dashboardStats);
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
            <Loader className="w-8 h-8 text-[#BE1C2D] animate-spin" />
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
      {checklistPendingCount > 0 && (
        <Card className="bg-red-950/30 border-red-900">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-red-300 font-medium">Checklist approvals pending</p>
              <p className="text-red-400 text-sm">{checklistPendingCount} failed pre-start checklist request(s) need admin review.</p>
            </div>
            <Button
              onClick={() => navigate('/checklist-approvals')}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              Review checklist approvals
            </Button>
          </CardContent>
        </Card>
      )}

      {notifications.length > 0 && (
        <Card className="bg-yellow-950/30 border-yellow-900">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-yellow-300 font-medium">Service due soon</p>
              <p className="text-yellow-400 text-sm">{notifications.length} open automatic service alert(s)</p>
            </div>
            <Button
              onClick={() => setServiceAlertOpen(true)}
              className="bg-yellow-600 text-black hover:bg-yellow-500"
            >
              View alerts
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Page header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#BE1C2D]">Perth operations</p>
        <h1 className="portalShellTitle text-5xl font-bold text-[#17191B] mt-1">Dispatch board</h1>
        <p className="text-gray-400 mt-2">Current fleet, shift and service position.</p>
      </div>

      <section className="grid overflow-hidden border border-[#D7D3CA] bg-[#FFFEFA] lg:grid-cols-[.72fr_1.28fr]">
        <div className="flex flex-col justify-between border-b border-[#D7D3CA] p-6 lg:border-b-0 lg:border-r">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#BE1C2D]">Network snapshot</p>
            <h2 className="portalShellTitle mt-2 text-4xl font-bold text-[#17191B]">Active corridors</h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[#686B6F]">A shared network view for dispatch. Open Live Map for vehicle-level GPS and shift history.</p>
          </div>
          <Button onClick={() => navigate('/live-map')} variant="outline" className="mt-6 w-full justify-between rounded-none border-[#A6A6A6] text-[#17191B] hover:bg-[#F5F2EB]">Open live map <span aria-hidden="true">→</span></Button>
        </div>
        <div className="min-h-[340px] p-3 sm:p-5">
          <RouteMap variant="portal" routeIds={['per-kal', 'per-hed', 'per-adl', 'per-mel']} />
        </div>
      </section>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.name} className="bg-[#FFFEFA] border-[#D7D3CA]">
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
        <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-400 mb-1">Active Shifts Now</p>
                <p className="text-3xl font-bold text-green-400">{activeShiftCount ?? '—'}</p>
              </div>
              <div className="bg-green-700 w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                <Activity className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-400 mb-1">Force-Ended Today</p>
                <p className="text-3xl font-bold text-red-400">{forceEndedToday ?? '—'}</p>
              </div>
              <div className="bg-red-700 w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-400 mb-1">Admin Actions Today</p>
                <p className="text-3xl font-bold text-blue-400">{adminActionsToday ?? '—'}</p>
              </div>
              <div className="bg-blue-700 w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
          <CardHeader>
            <CardTitle className="text-white">Fleet Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-[#F5F2EB] rounded border border-[#D7D3CA]">
              <span className="text-gray-300">Drivers on Active Shifts</span>
              <span className="text-lg font-bold text-[#BE1C2D]">{stats.activeDrivers}/{stats.totalDrivers}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#F5F2EB] rounded border border-[#D7D3CA]">
              <span className="text-gray-300">Vehicles in Active Shifts</span>
              <span className="text-lg font-bold text-[#BE1C2D]">{stats.activeVehicles}/{stats.totalVehicles}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#F5F2EB] rounded border border-[#D7D3CA]">
              <span className="text-gray-300">Shifts Active</span>
              <span className="text-lg font-bold text-green-400">{stats.activeShifts}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
          <CardHeader>
            <CardTitle className="text-white">Maintenance Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-[#F5F2EB] rounded border border-[#D7D3CA]">
              <span className="text-gray-300">Vehicles in Maintenance</span>
              <span className="text-lg font-bold text-yellow-400">{stats.vehiclesInMaintenance}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#F5F2EB] rounded border border-[#D7D3CA]">
              <span className="text-gray-300">Pending Items</span>
              <span className="text-lg font-bold text-orange-400">{stats.pendingMaintenance}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={serviceAlertOpen} onOpenChange={setServiceAlertOpen}>
        <DialogContent className="bg-[#FFFEFA] border-[#D7D3CA] max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-white">Service due soon</DialogTitle>
            <DialogDescription className="text-gray-400">
              Open maintenance alerts. Times shown in {PERTH_TIME_LABEL}.
            </DialogDescription>
          </DialogHeader>

          {notifications.length === 0 ? (
            <p className="text-sm text-gray-400">No open service alerts.</p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {notifications.map((notification) => {
                const itemId = notification.maintenance_item_id;
                const busy = alertBusyId === itemId;
                return (
                  <div key={itemId} className="rounded-lg border border-[#D7D3CA] bg-[#F5F2EB] p-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500">Vehicle</p>
                        <p className="text-gray-200">{notification.vehicle_rego ?? notification.vehicle_id ?? 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Current km</p>
                        <p className="text-gray-200">{notification.current_km != null ? `${Math.round(notification.current_km).toLocaleString()} km` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Target service km</p>
                        <p className="text-gray-200">{notification.target_service_km != null ? `${Math.round(notification.target_service_km).toLocaleString()} km` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">KM remaining</p>
                        <p className="text-gray-200">{notification.km_remaining != null ? `${Math.round(notification.km_remaining).toLocaleString()} km` : '—'}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="bg-[#BE1C2D] text-white hover:bg-[#A81828]"
                        disabled={busy}
                        onClick={() => acknowledge(itemId)}
                      >
                        Acknowledge
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 text-white hover:bg-green-500"
                        disabled={busy}
                        onClick={() => complete(itemId)}
                      >
                        Mark completed
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-300 hover:text-white"
                        onClick={() => {
                          setServiceAlertOpen(false);
                          navigate('/maintenance');
                        }}
                      >
                        Go to Maintenance page
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
