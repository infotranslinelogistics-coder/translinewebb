import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Activity, FileText } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Card } from './ui/card';
import { Button } from './ui/button';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-987e9da2`;

export function AdminOverrides() {
  const [adminActions, setAdminActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminActions();
    const interval = setInterval(fetchAdminActions, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchAdminActions = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin-actions`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await response.json();
      setAdminActions(data.actions || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching admin actions:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading admin actions...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Admin Overrides</h2>
        <p className="text-sm text-muted-foreground mt-1">Dangerous actions and admin activity log</p>
      </div>

      {/* Warning Banner */}
      <Card className="bg-[#ef4444]/10 border border-[#ef4444]/30 p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-8 h-8 text-[#ef4444] flex-shrink-0" />
          <div>
            <h3 className="text-lg font-bold text-[#ef4444] mb-2">⚠️ DANGER ZONE ⚠️</h3>
            <p className="text-sm text-foreground mb-3">
              Actions performed in other sections (Force End Shift, Delete Events, etc.) are considered admin overrides.
              All dangerous actions require confirmation and are logged immutably with admin name, timestamp, and reason.
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Force Close Shift - Immediately ends an active shift</p>
              <p>• Upload Override - Admin uploads odometer photos on behalf of drivers</p>
              <p>• Delete Events - Removes invalid or permanently failed events</p>
              <p>• Mark Event Failed - Permanently marks events as failed to prevent retries</p>
              <p>• Driver/Vehicle Management - Changes to accounts and fleet status</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-card border border-border p-5 hover:border-primary/50 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#ff6b35]/20 rounded flex items-center justify-center">
              <Activity className="w-5 h-5 text-[#ff6b35]" />
            </div>
            <h4 className="font-bold text-foreground">Live Shifts</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Force-end stuck shifts or upload missing odometer photos
          </p>
          <Button size="sm" variant="outline" className="w-full text-xs">
            Go to Live Shifts
          </Button>
        </Card>

        <Card className="bg-card border border-border p-5 hover:border-primary/50 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#ef4444]/20 rounded flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#ef4444]" />
            </div>
            <h4 className="font-bold text-foreground">Event Logs</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Retry failed events or delete invalid queue items
          </p>
          <Button size="sm" variant="outline" className="w-full text-xs">
            Go to Event Logs
          </Button>
        </Card>

        <Card className="bg-card border border-border p-5 hover:border-primary/50 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#1e90ff]/20 rounded flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#1e90ff]" />
            </div>
            <h4 className="font-bold text-foreground">Driver Access</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Lock/disable driver accounts or reset app state
          </p>
          <Button size="sm" variant="outline" className="w-full text-xs">
            Go to Drivers
          </Button>
        </Card>
      </div>

      {/* Admin Action Log */}
      <Card className="bg-card border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-foreground" />
          <h3 className="text-lg font-bold text-foreground">Immutable Admin Action Log</h3>
        </div>

        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {adminActions.length > 0 ? (
            adminActions.map((action, idx) => (
              <div
                key={idx}
                className="p-4 bg-muted/30 border border-border rounded hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#ff6b35]" />
                    <span className="text-sm font-bold text-foreground">
                      {action.action.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(action.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div>
                    <span className="text-muted-foreground">Admin: </span>
                    <span className="text-foreground font-medium">{action.admin_name}</span>
                  </div>
                  {action.data?.shift_id && (
                    <div>
                      <span className="text-muted-foreground">Shift: </span>
                      <span className="text-foreground font-mono">{action.data.shift_id}</span>
                    </div>
                  )}
                  {action.data?.driver_id && (
                    <div>
                      <span className="text-muted-foreground">Driver: </span>
                      <span className="text-foreground">{action.data.driver_id}</span>
                    </div>
                  )}
                  {action.data?.vehicle_id && (
                    <div>
                      <span className="text-muted-foreground">Vehicle: </span>
                      <span className="text-foreground">{action.data.vehicle_id}</span>
                    </div>
                  )}
                  {action.data?.event_id && (
                    <div>
                      <span className="text-muted-foreground">Event: </span>
                      <span className="text-foreground font-mono">{action.data.event_id}</span>
                    </div>
                  )}
                </div>

                {action.data?.reason && (
                  <div className="mt-2 p-2 bg-muted/50 border border-border rounded">
                    <p className="text-xs text-muted-foreground mb-1">Reason:</p>
                    <p className="text-xs text-foreground italic">"{action.data.reason}"</p>
                  </div>
                )}

                {action.data?.license_plate && (
                  <div className="mt-2 text-xs">
                    <span className="text-muted-foreground">License Plate: </span>
                    <span className="text-foreground font-mono">{action.data.license_plate}</span>
                  </div>
                )}

                {action.data?.name && (
                  <div className="mt-2 text-xs">
                    <span className="text-muted-foreground">Name: </span>
                    <span className="text-foreground">{action.data.name}</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No admin actions logged yet</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
