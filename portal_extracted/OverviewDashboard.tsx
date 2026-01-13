import { useState, useEffect } from 'react';
import { AlertTriangle, Activity, Users, Truck, Camera, XCircle, Clock } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Card } from './ui/card';
import { fetchDrivers as apiFetchDrivers, fetchVehicles as apiFetchVehicles } from '../utils/assignments';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-987e9da2`;

interface OverviewDashboardProps {
  onViewShift: (shiftId: string) => void;
}

export function OverviewDashboard({ onViewShift }: OverviewDashboardProps) {
  const [stats, setStats] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, activityRes, shiftsRes, drivers, vehicles] = await Promise.all([
        fetch(`${API_BASE}/stats`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
        fetch(`${API_BASE}/activity`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
        fetch(`${API_BASE}/shifts?status=active`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
        apiFetchDrivers(),
        apiFetchVehicles(),
      ]);

      const statsData = await statsRes.json();
      const activityData = await activityRes.json();
      const shiftsData = await shiftsRes.json();

      // augment stats with driver/vehicle assignment info
      const totalDrivers = Array.isArray(drivers) ? drivers.length : 0;
      const totalVehicles = Array.isArray(vehicles) ? vehicles.length : 0;
      const assignedVehicles = Array.isArray(vehicles) ? vehicles.filter(v => v.assigned_driver_id).length : 0;

      setStats({
        ...statsData,
        totalDrivers,
        totalVehicles,
        assignedVehicles,
        unassignedVehicles: totalVehicles - assignedVehicles,
      });

      setActivities(activityData.activities || []);
      setShifts(shiftsData.shifts || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  const stuckShifts = shifts.filter(s => {
    const duration = Date.now() - new Date(s.start_time).getTime();
    return duration > 12 * 60 * 60 * 1000;
  });

  const missingOdometer = shifts.filter(s => !s.start_odometer_photo);

  return (
    <div className="p-6 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Shifts</p>
              <p className="text-3xl font-bold text-[#ff6b35] mt-1">{stats?.activeShiftsCount || 0}</p>
            </div>
            <Activity className="w-8 h-8 text-[#ff6b35] opacity-50" />
          </div>
        </Card>

        <Card className="bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Drivers</p>
              <p className="text-3xl font-bold text-[#1e90ff] mt-1">{stats?.totalDrivers ?? 0}</p>
            </div>
            <Users className="w-8 h-8 text-[#1e90ff] opacity-50" />
          </div>
        </Card>

        <Card className="bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Vehicles Assigned</p>
              <p className="text-3xl font-bold text-[#10b981] mt-1">{stats?.assignedVehicles ?? 0}</p>
              <p className="text-xs text-muted-foreground">Unassigned: {stats?.unassignedVehicles ?? 0}</p>
            </div>
            <Truck className="w-8 h-8 text-[#10b981] opacity-50" />
          </div>
        </Card>

        <Card className="bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Failed Events</p>
              <p className="text-3xl font-bold text-[#ef4444] mt-1">{stats?.alerts?.failedEvents || 0}</p>
            </div>
            <XCircle className="w-8 h-8 text-[#ef4444] opacity-50" />
          </div>
        </Card>
      </div>

      {/* Alerts Section */}
      <Card className="bg-card border border-[#ef4444]/30 p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-[#ef4444]" />
          <h3 className="text-lg font-bold text-foreground">Critical Alerts</h3>
        </div>
        
        <div className="space-y-3">
          {stats?.alerts?.stuckShifts > 0 && (
            <div className="flex items-center justify-between p-3 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-[#ef4444]" />
                <div>
                  <p className="text-sm font-medium text-foreground">Stuck Shifts Detected</p>
                  <p className="text-xs text-muted-foreground">{stats.alerts.stuckShifts} shift(s) running longer than 12 hours</p>
                </div>
              </div>
              <span className="text-xl font-bold text-[#ef4444]">{stats.alerts.stuckShifts}</span>
            </div>
          )}

          {stats?.alerts?.missingOdometer > 0 && (
            <div className="flex items-center justify-between p-3 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded">
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-[#f59e0b]" />
                <div>
                  <p className="text-sm font-medium text-foreground">Missing Odometer Photos</p>
                  <p className="text-xs text-muted-foreground">{stats.alerts.missingOdometer} active shift(s) without start photo</p>
                </div>
              </div>
              <span className="text-xl font-bold text-[#f59e0b]">{stats.alerts.missingOdometer}</span>
            </div>
          )}

          {stats?.alerts?.failedEvents > 0 && (
            <div className="flex items-center justify-between p-3 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded">
              <div className="flex items-center gap-3">
                <XCircle className="w-5 h-5 text-[#ef4444]" />
                <div>
                  <p className="text-sm font-medium text-foreground">Failed Events Queue</p>
                  <p className="text-xs text-muted-foreground">{stats.alerts.failedEvents} event(s) require attention</p>
                </div>
              </div>
              <span className="text-xl font-bold text-[#ef4444]">{stats.alerts.failedEvents}</span>
            </div>
          )}

          {stats?.alerts?.stuckShifts === 0 && stats?.alerts?.missingOdometer === 0 && stats?.alerts?.failedEvents === 0 && (
            <div className="flex items-center justify-center p-6 text-muted-foreground">
              <p className="text-sm">No critical alerts at this time</p>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Problem Shifts */}
        <Card className="bg-card border border-border p-5">
          <h3 className="text-lg font-bold text-foreground mb-4">Problem Shifts</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {stuckShifts.length > 0 || missingOdometer.length > 0 ? (
              <>
                {stuckShifts.map(shift => (
                  <div
                    key={shift.id}
                    onClick={() => onViewShift(shift.id)}
                    className="p-3 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded cursor-pointer hover:bg-[#ef4444]/20 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{shift.driver_id}</p>
                        <p className="text-xs text-muted-foreground">Vehicle: {shift.vehicle_id}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#ef4444] font-medium">STUCK</p>
                        <p className="text-xs text-muted-foreground">{Math.floor((Date.now() - new Date(shift.start_time).getTime()) / 3600000)}h</p>
                      </div>
                    </div>
                  </div>
                ))}
                {missingOdometer.filter(s => !stuckShifts.includes(s)).map(shift => (
                  <div
                    key={shift.id}
                    onClick={() => onViewShift(shift.id)}
                    className="p-3 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded cursor-pointer hover:bg-[#f59e0b]/20 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{shift.driver_id}</p>
                        <p className="text-xs text-muted-foreground">Vehicle: {shift.vehicle_id}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#f59e0b] font-medium">NO ODOMETER</p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No problem shifts</p>
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-card border border-border p-5">
          <h3 className="text-lg font-bold text-foreground mb-4">Recent Admin Activity</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {activities.length > 0 ? (
              activities.slice(0, 10).map((activity, idx) => (
                <div key={idx} className="p-3 bg-muted/30 border border-border rounded">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{activity.action.replace(/_/g, ' ').toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        By: {activity.admin_name}
                      </p>
                      {activity.data?.reason && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{activity.data.reason}"</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
