// Main dashboard layout with sidebar and header
import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { GlobalSearch } from '@/components/GlobalSearch';
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
  { name: 'Maintenance', href: '/maintenance', icon: Wrench },
  { name: 'Logs', href: '/logs', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function DashboardLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [onlineDrivers] = useState(12); // Mock data - replace with real data

  const handleLogout = async () => {
    await signOut();
    setSidebarOpen(false);
    navigate('/login', { replace: true });
  };

  return (
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
          <div className="fixed inset-0 z-40 bg-black/80" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-[#161616] border-r border-gray-800">
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
  );
}
