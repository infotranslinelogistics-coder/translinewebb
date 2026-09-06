// Settings page for admin configuration
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { User, Database, Shield, Bell, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const NOTIFICATION_PREFS_KEY = 'transline.notificationPrefs';

const EMAIL_NOTIFICATIONS = [
  'Vehicle maintenance due',
  'Driver incident reports',
  'System alerts',
  'Daily summary reports',
] as const;

const PUSH_NOTIFICATIONS = [
  'Critical alerts',
  'New driver logs',
  'Shift start/end',
  'Maintenance overdue',
] as const;

type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

function defaultNotificationPrefs(): Record<string, boolean> {
  const prefs: Record<string, boolean> = {};
  EMAIL_NOTIFICATIONS.forEach((item) => {
    prefs[item] = true;
  });
  PUSH_NOTIFICATIONS.forEach((item) => {
    prefs[item] = item === 'Critical alerts';
  });
  return prefs;
}

function loadNotificationPrefs(): Record<string, boolean> {
  const defaults = defaultNotificationPrefs();
  try {
    const raw = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (!raw) return defaults;
    const stored = JSON.parse(raw) as Record<string, boolean>;
    return { ...defaults, ...stored };
  } catch (error) {
    console.error('Failed to read notification preferences:', error);
    return defaults;
  }
}

export function SettingsPage() {
  const { user } = useAuth();

  // Real Supabase connection status (replaces the previous hardcoded mock).
  const [supabaseStatus, setSupabaseStatus] = React.useState<ConnectionStatus>('checking');

  // Password change form state.
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordSaving, setPasswordSaving] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = React.useState<string | null>(null);

  // Notification preferences state (persisted to localStorage).
  const [notificationPrefs, setNotificationPrefs] = React.useState<Record<string, boolean>>(() =>
    loadNotificationPrefs()
  );
  const [prefsSaved, setPrefsSaved] = React.useState(false);

  const supabaseConnected = supabaseStatus === 'connected';

  // Check the live database/auth connection on mount.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { error } = await supabase.auth.getUser();
        if (cancelled) return;
        setSupabaseStatus(error ? 'disconnected' : 'connected');
      } catch (error) {
        console.error('Supabase connection check failed:', error);
        if (!cancelled) setSupabaseStatus('disconnected');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from the current password.');
      return;
    }
    if (!user?.email) {
      setPasswordError('No authenticated admin account found. Please sign in again.');
      return;
    }

    try {
      setPasswordSaving(true);

      // Verify the current password by re-authenticating before changing it.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        setPasswordError('Current password is incorrect.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      setPasswordSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(
        err?.message ? `Failed to update password: ${err.message}` : 'Failed to update password.'
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const toggleNotification = (item: string) => {
    setPrefsSaved(false);
    setNotificationPrefs((prev) => ({ ...prev, [item]: !prev[item] }));
  };

  const handleSavePreferences = () => {
    try {
      localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(notificationPrefs));
      setPrefsSaved(true);
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Manage admin settings and configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Admin Profile */}
        <Card className="bg-[#FFFEFA] border-[#D7D3CA] lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <User className="w-5 h-5" />
              Admin Profile
            </CardTitle>
            <CardDescription className="text-gray-400">
              Update your admin account information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-[#F5F2EB] border-[#C4C0B7] text-gray-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-white">Role</Label>
                <Input
                  id="role"
                  value="Administrator"
                  disabled
                  className="bg-[#F5F2EB] border-[#C4C0B7] text-gray-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-white">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-[#F5F2EB] border-[#C4C0B7] text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-white">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-[#F5F2EB] border-[#C4C0B7] text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-white">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-[#F5F2EB] border-[#C4C0B7] text-white placeholder:text-gray-500"
                />
              </div>

              {passwordError && (
                <p className="text-sm text-red-400">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="text-sm text-green-400">{passwordSuccess}</p>
              )}

              <Button
                type="submit"
                disabled={passwordSaving}
                className="bg-[#BE1C2D] hover:bg-[#A81828] text-white"
              >
                {passwordSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {passwordSaving ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* System Status */}
        <div className="space-y-6">
          <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Database className="w-5 h-5" />
                System Status
              </CardTitle>
              <CardDescription className="text-gray-400">
                Connection and health status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Supabase</p>
                  <p className="text-xs text-gray-500">Database connection</p>
                </div>
                {supabaseStatus === 'checking' ? (
                  <Badge className="bg-gray-800 text-gray-400 border-[#C4C0B7]">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Checking
                  </Badge>
                ) : (
                  <Badge
                    className={
                      supabaseConnected
                        ? 'bg-green-950 text-green-400 border-green-900'
                        : 'bg-red-950 text-red-400 border-red-900'
                    }
                  >
                    {supabaseConnected ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connected
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Not Connected
                      </>
                    )}
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">API Server</p>
                  <p className="text-xs text-gray-500">Backend services</p>
                </div>
                <Badge className="bg-green-950 text-green-400 border-green-900">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Operational
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">GPS Tracking</p>
                  <p className="text-xs text-gray-500">Real-time location</p>
                </div>
                <Badge className="bg-yellow-950 text-yellow-400 border-yellow-900">
                  Pending Setup
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Shield className="w-5 h-5" />
                Security
              </CardTitle>
              <CardDescription className="text-gray-400">
                Security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white">Two-Factor Auth</p>
                <Badge className="bg-gray-800 text-gray-400 border-[#C4C0B7]">
                  Disabled
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-white">Session Timeout</p>
                <Badge className="bg-blue-950 text-blue-400 border-blue-900">
                  8 hours
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Notifications Settings */}
      <Card className="bg-[#FFFEFA] border-[#D7D3CA]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Bell className="w-5 h-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription className="text-gray-400">
            Configure notification settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white">Email Notifications</h3>
              <div className="space-y-3">
                {EMAIL_NOTIFICATIONS.map((item) => (
                  <label key={item} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!notificationPrefs[item]}
                      onChange={() => toggleNotification(item)}
                      className="w-4 h-4 rounded border-[#C4C0B7] bg-[#F5F2EB] text-[#BE1C2D] focus:ring-[#BE1C2D]"
                    />
                    <span className="text-sm text-gray-300">{item}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white">Push Notifications</h3>
              <div className="space-y-3">
                {PUSH_NOTIFICATIONS.map((item) => (
                  <label key={item} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!notificationPrefs[item]}
                      onChange={() => toggleNotification(item)}
                      className="w-4 h-4 rounded border-[#C4C0B7] bg-[#F5F2EB] text-[#BE1C2D] focus:ring-[#BE1C2D]"
                    />
                    <span className="text-sm text-gray-300">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-[#D7D3CA] flex items-center gap-4">
            <Button
              onClick={handleSavePreferences}
              className="bg-[#BE1C2D] hover:bg-[#A81828] text-white"
            >
              Save Preferences
            </Button>
            {prefsSaved && (
              <span className="text-sm text-green-400">Preferences saved.</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Database Setup Instructions */}
      {supabaseStatus === 'disconnected' && (
        <Card className="bg-[#FFFEFA] border-yellow-900/50 border-2">
          <CardHeader>
            <CardTitle className="text-yellow-400">Supabase Setup Required</CardTitle>
            <CardDescription className="text-gray-400">
              Connect your Supabase database to enable full functionality
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-300">
              <p>To connect Supabase:</p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>Create a Supabase project at <a href="https://supabase.com" className="text-[#BE1C2D] underline" target="_blank" rel="noopener noreferrer">supabase.com</a></li>
                <li>Add your Supabase URL and anon key to environment variables</li>
                <li>Run the provided SQL migrations to create database tables</li>
                <li>Restart the application</li>
              </ol>
              <div className="mt-4 p-4 bg-[#F5F2EB] rounded-lg border border-[#D7D3CA]">
                <p className="text-xs text-gray-400 mb-2">Environment Variables:</p>
                <code className="text-xs text-green-400 block">
                  VITE_SUPABASE_URL=your-project-url
                  <br />
                  VITE_SUPABASE_ANON_KEY=your-anon-key
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
