import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, Home, Activity, Users, Truck, FileText, Shield, Eye, MapPin } from 'lucide-react';

// Portal page components
import OverviewDashboard from './src/components/OverviewDashboard';
import LiveShiftsMonitor from './src/components/LiveShiftsMonitor';
import DriversManagement from './src/components/DriversManagement';
import VehiclesManagement from './src/components/VehiclesManagement';
import EventLogs from './src/components/EventLogs';
import AdminOverrides from './src/components/AdminOverrides';
import ShiftDetailView from './src/components/ShiftDetailView';
import OdometerReview from './src/components/OdometerReview';
import LiveTracking from './src/pages/LiveTracking';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Home className="w-5 h-5" />, path: '/' },
  { id: 'live-shifts', label: 'Live Shifts', icon: <Activity className="w-5 h-5" />, path: '/live-shifts' },
  { id: 'live-tracking', label: 'Live Tracking', icon: <MapPin className="w-5 h-5" />, path: '/live-tracking' },
  { id: 'drivers', label: 'Drivers', icon: <Users className="w-5 h-5" />, path: '/drivers' },
  { id: 'vehicles', label: 'Vehicles', icon: <Truck className="w-5 h-5" />, path: '/vehicles' },
  { id: 'events', label: 'Events', icon: <FileText className="w-5 h-5" />, path: '/events' },
  { id: 'odometer', label: 'Odometer', icon: <Eye className="w-5 h-5" />, path: '/odometer' },
  { id: 'admin', label: 'Admin', icon: <Shield className="w-5 h-5" />, path: '/admin' },
];

function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen w-64 bg-card border-r border-border z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:static md:z-auto overflow-y-auto`}
        style={{ backgroundColor: '#141416', borderColor: '#27272a' }}
      >
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary mb-8">Transline Portal</h1>
          
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.id}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-8 pt-8 border-t border-border">
            <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-foreground hover:bg-muted w-full transition-colors">
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<string | null>(null);

  useEffect(() => {
    // Close sidebar on route change
    setSidebarOpen(false);
  }, []);

  return (
    <Router basename="/portal">
      <div 
        className="flex h-screen bg-background text-foreground"
        style={{
          backgroundColor: '#0a0a0b',
          color: '#e5e5e7'
        }}
      >
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between md:justify-end">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden text-foreground hover:bg-muted p-2 rounded-lg"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div className="text-sm text-muted-foreground">
              translinelogistics.org/portal
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<OverviewDashboard onViewShift={setSelectedShift} />} />
              <Route path="/live-shifts" element={<LiveShiftsMonitor onViewShift={setSelectedShift} />} />
              <Route path="/live-tracking" element={<LiveTracking />} />
              <Route path="/drivers" element={<DriversManagement />} />
              <Route path="/vehicles" element={<VehiclesManagement />} />
              <Route path="/events" element={<EventLogs />} />
              <Route path="/odometer" element={<OdometerReview />} />
              <Route path="/admin" element={<AdminOverrides />} />
              <Route path="/shift/:shiftId" element={<ShiftDetailView shiftId={selectedShift} />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
