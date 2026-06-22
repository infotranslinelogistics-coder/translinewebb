// Main dashboard layout with sidebar and header
import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { GlobalSearch } from '@/components/GlobalSearch';
import { Card, CardContent } from '@/app/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { formatPerthDateTime } from '@/lib/dateTime';
import { InboxProvider, useInbox } from '@/contexts/InboxContext';
import {
  LayoutDashboard,
  Users,
  Truck,
  MapPin,
  Calendar,
  Droplets,
  Wrench,
  FileText,
  Camera,
  Settings,
  LogOut,
  RefreshCw,
  Bell,
  Inbox,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader,
  ClipboardCheck,
  Menu,
  X,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Drivers', href: '/drivers', icon: Users },
  { name: 'Vehicles', href: '/vehicles', icon: Truck },
  { name: 'Live Map', href: '/live-map', icon: MapPin },
  { name: 'Odometer', href: '/odometer', icon: Camera },
  { name: 'Fuel Logs', href: '/fuel-logs', icon: Droplets },
  { name: 'Shifts', href: '/shifts', icon: Calendar },
  { name: 'Checklist Approvals', href: '/checklist-approvals', icon: ClipboardCheck },
  { name: 'Maintenance', href: '/maintenance', icon: Wrench },
  { name: 'Logs', href: '/logs', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

function InboxDialogButton() {
  const { notifications, checklistPendingCount, loading, busyId, unreadCount, refresh, acknowledge, complete } = useInbox();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="relative border-gray-700 bg-[#0F0F0F] text-gray-200 hover:bg-[#1C1C1C] hover:text-white"
        onClick={() => setOpen(true)}
      >
        <Bell className="w-4 h-4 mr-2" />
        Inbox
        {unreadCount > 0 && (
          <span className="ml-2 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl border-gray-800 bg-[#161616] text-gray-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Inbox className="w-5 h-5" />
              Notification Centre
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Service alerts and maintenance notifications.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-300 hover:text-white"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader className="w-5 h-5 animate-spin mr-2" />
                Loading notifications...
              </div>
            ) : unreadCount === 0 ? (
              <div className="rounded-lg border border-gray-800 bg-[#0F0F0F] p-4 text-sm text-gray-400">
                No unacknowledged notifications.
              </div>
            ) : (
              <>
                {checklistPendingCount > 0 && (
                  <Card className="border-gray-800 bg-[#0F0F0F]">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-red-300">Failed checklist approvals pending</p>
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                      </div>
                      <p className="text-sm text-gray-300">
                        {checklistPendingCount} pending checklist approval request(s) require admin action.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="bg-[#FF6B35] text-white hover:bg-[#E55A2B]"
                          onClick={() => { setOpen(false); navigate('/checklist-approvals'); }}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Review checklist approvals
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {notifications.map((notification) => {
                  const busy = busyId === notification.maintenance_item_id;
                  return (
                    <Card key={notification.maintenance_item_id} className="border-gray-800 bg-[#0F0F0F]">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-yellow-300">Service due soon</p>
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <p className="text-gray-300">Vehicle rego: <span className="text-white">{notification.vehicle_rego ?? notification.vehicle_id ?? 'Unknown'}</span></p>
                          <p className="text-gray-300">Current km: <span className="text-white">{notification.current_km != null ? `${Math.round(notification.current_km).toLocaleString()} km` : '—'}</span></p>
                          <p className="text-gray-300">Target service km: <span className="text-white">{notification.target_service_km != null ? `${Math.round(notification.target_service_km).toLocaleString()} km` : '—'}</span></p>
                          <p className="text-gray-300">KM remaining: <span className="text-white">{notification.km_remaining != null ? `${Math.round(notification.km_remaining).toLocaleString()} km` : '—'}</span></p>
                          <p className="text-gray-300 sm:col-span-2">Created: <span className="text-white">{formatPerthDateTime(notification.created_at)}</span></p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="bg-[#FF6B35] text-white hover:bg-[#E55A2B]"
                            disabled={busy}
                            onClick={() => acknowledge(notification.maintenance_item_id)}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Acknowledge
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 text-white hover:bg-green-500"
                            disabled={busy}
                            onClick={() => complete(notification.maintenance_item_id)}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Mark completed
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-300 hover:text-white"
                            onClick={() => { setOpen(false); navigate('/maintenance'); }}
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Go to Maintenance
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DashboardLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [onlineDrivers] = useState(12); // Mock data - replace with real data

  const handleLogout = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const source = event.currentTarget;
    const clickedElement = event.target instanceof HTMLElement ? event.target : null;
    const clickedTag = clickedElement?.tagName ?? 'unknown';
    const clickedId = clickedElement?.id ?? '';
    const clickedClass = clickedElement?.className ?? '';
    const clickedText = clickedElement?.textContent?.trim().slice(0, 80) ?? '';

    console.error('[AUTH LOGOUT CLICK]', {
      trusted: event.nativeEvent.isTrusted,
      clickedTag,
      clickedId,
      clickedClass,
      clickedText,
      sourceTag: source.tagName,
      sourceDataAttr: source.dataset.logoutTrigger,
    });

    if (!event.nativeEvent.isTrusted) {
      console.error('[AUTH LOGOUT SOURCE]', 'blocked-untrusted-logout-click');
      return;
    }

    if (source.dataset.logoutTrigger !== 'true') {
      console.error('[AUTH LOGOUT SOURCE]', 'blocked-non-logout-click-source');
      return;
    }

    console.error('[AUTH LOGOUT SOURCE]', 'dashboard-layout-logout-button');
    await signOut();
    setSidebarOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <InboxProvider>
    <div className="min-h-screen bg-[#0F0F0F]">
      {/* Sidebar for desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-[#161616] border-r border-gray-800">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 border-b border-gray-800">
            <div className="w-10 h-10 bg-[#FF6B35] rounded-lg flex items-center justify-center mr-3">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">TransLine</h1>
              <p className="text-xs text-gray-400">Admin Portal</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#FF6B35] text-white'
                      : 'text-gray-300 hover:bg-[#0F0F0F] hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Logout button */}
          <div className="p-4 border-t border-gray-800">
            <Button
              data-logout-trigger="true"
              onClick={handleLogout}
              variant="ghost"
              className="w-full justify-start text-gray-300 hover:bg-[#0F0F0F] hover:text-white"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-40 bg-black/80"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (event.target === event.currentTarget) {
                setSidebarOpen(false);
              }
            }}
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 w-64 bg-[#161616] border-r border-gray-800"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between h-16 px-6 border-b border-gray-800">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-[#FF6B35] rounded-lg flex items-center justify-center mr-3">
                    <Truck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white">TransLine</h1>
                    <p className="text-xs text-gray-400">Admin Portal</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;

                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-[#FF6B35] text-white'
                          : 'text-gray-300 hover:bg-[#0F0F0F] hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-gray-800">
                <Button
                  data-logout-trigger="true"
                  onClick={handleLogout}
                  variant="ghost"
                  className="w-full justify-start text-gray-300 hover:bg-[#0F0F0F] hover:text-white"
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  Logout
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-[#161616] border-b border-gray-800">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-gray-400 hover:text-white"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>

              <div className="hidden sm:block">
                <GlobalSearch />
              </div>

              <InboxDialogButton />
            </div>

            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="bg-green-950 text-green-400 border-green-900">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
                {onlineDrivers} Drivers Online
              </Badge>

              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white"
              >
                <RefreshCw className="w-5 h-5" />
              </Button>

              <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-gray-800">
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{user?.email || 'Admin'}</p>
                  <p className="text-xs text-gray-400">Administrator</p>
                </div>
                <div className="w-10 h-10 bg-[#FF6B35] rounded-full flex items-center justify-center text-white font-medium">
                  {user?.email?.[0].toUpperCase() || 'A'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
    </InboxProvider>
  );
}
