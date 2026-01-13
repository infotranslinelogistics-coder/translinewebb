import { useState, useEffect } from 'react';
import { AlertTriangle, Activity, Users, Truck, Camera, XCircle, Clock } from 'lucide-react';
import { Card } from '../ui/card';
import { fetchDashboardStats, fetchActiveShifts, fetchAdminActions } from '../lib/api';

interface OverviewDashboardProps {
  onViewShift: (shiftId: string) => void;
}

export default function OverviewDashboard({ onViewShift }: OverviewDashboardProps) {
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
      const [statsData, shiftsData, actionsData] = await Promise.all([
        fetchDashboardStats(),
        fetchActiveShifts(),
        fetchAdminActions(10), // Fetch last 10 admin actions
      ]);

      setStats(statsData);
      setActivities(actionsData);
      setShifts(shiftsData);
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
    const duration = Date.now() - new Date(s.started_at).getTime();
    return duration > 12 * 60 * 60 * 1000;
  });

  const missingOdometer = shifts.filter(s => !s.odometer_photo_url);

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
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Drivers</p>
              <p className="text-3xl font-bold text-[#1e90ff] mt-1">{stats?.activeDriversCount || 0}</p>
            </div>
            <Users className="w-8 h-8 text-[#1e90ff] opacity-50" />
          </div>
        </Card>

        <Card className="bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Vehicles in Use</p>
              <p className="text-3xl font-bold text-[#10b981] mt-1">{stats?.vehiclesInUseCount || 0}</p>
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
                        <p className="text-sm font-medium text-foreground">{shift.driver?.full_name || 'Unknown Driver'}</p>
                        <p className="text-xs text-muted-foreground">Vehicle: {shift.vehicle?.registration || 'Unknown'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#ef4444] font-medium">STUCK</p>
                        <p className="text-xs text-muted-foreground">{Math.floor((Date.now() - new Date(shift.started_at).getTime()) / 3600000)}h</p>
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
                        <p className="text-sm font-medium text-foreground">{shift.driver?.full_name || 'Unknown Driver'}</p>
                        <p className="text-xs text-muted-foreground">Vehicle: {shift.vehicle?.registration || 'Unknown'}</p>
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
                      <p className="text-sm font-medium text-foreground">{activity.action_type.replace(/_/g, ' ').toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        By: {activity.admin_name}
                      </p>
                      {activity.reason && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{activity.reason}"</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.created_at).toLocaleTimeString()}
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
