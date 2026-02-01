// Router configuration for TransLine Admin Portal
import { createBrowserRouter } from 'react-router';
import { LoginPage } from '@/pages/LoginPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { DriversPage } from '@/pages/DriversPage';
import { VehiclesPage } from '@/pages/VehiclesPage';
import { LiveMapPage } from '@/pages/LiveMapPage';
import { OdometerLogsPage } from '@/pages/OdometerLogsPage';
import { DriverProfilePage } from '@/pages/DriverProfilePage';
import { DriverStopsPage } from '@/pages/DriverStopsPage';
import { ShiftsPage } from '@/pages/ShiftsPage';
import { MaintenancePage } from '@/pages/MaintenancePage';
import { FuelLogsPage } from '@/pages/FuelLogsPage';
import { MaintenanceLogsPage } from '@/pages/MaintenanceLogsPage';
import { LogsPage } from '@/pages/LogsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter(
  [
    {
      path: '/login',
      element: <LoginPage />,
    },
    {
      path: '/',
      element: (
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      ),
      children: [
        { index: true, element: <DashboardPage /> },
        { path: 'drivers', element: <DriversPage /> },
        { path: 'drivers/:id', element: <DriverProfilePage /> },
        { path: 'drivers/:id/stops', element: <DriverStopsPage /> },
        { path: 'vehicles', element: <VehiclesPage /> },
        { path: 'live-map', element: <LiveMapPage /> },
        { path: 'odometer', element: <OdometerLogsPage /> },
        { path: 'shifts', element: <ShiftsPage /> },
        { path: 'vehicle-logs/fuel', element: <FuelLogsPage /> },
        { path: 'vehicle-logs/maintenance', element: <MaintenanceLogsPage /> },
        { path: 'maintenance', element: <MaintenancePage /> },
        { path: 'logs', element: <LogsPage /> },
        { path: 'settings', element: <SettingsPage /> },
      ],
    },
    {
      path: '*',
      element: <NotFoundPage />,
    },
  ],
  { basename: '/portal' }
);
