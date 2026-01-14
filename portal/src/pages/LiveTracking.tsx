import { useEffect, useState } from 'react';
import { LiveDriverMap } from '../components/LiveDriverMap';
import { StationaryAlertPanel } from '../components/StationaryAlertPanel';
import { DriverInfoPanel } from '../components/DriverInfoPanel';
import { realtimeLocationService } from '../lib/realtimeLocationService';
import { supabase } from '../lib/supabase-client';
import { Driver, LocationLog } from '../types/location';
import { getDriverStatus } from '../lib/geoUtils';

export default function LiveTracking() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDrivers();

    // Subscribe to real-time updates
    const unsubscribe = realtimeLocationService.subscribe((location) => {
      updateDriverLocation(location);
    });

    return () => unsubscribe();
  }, []);

  const loadDrivers = async () => {
    try {
      // Get active shifts with driver and vehicle info
      const { data: shifts, error } = await supabase
        .from('shifts')
        .select(`
          id,
          started_at,
          driver_id,
          profiles!inner (
            id,
            full_name,
            email
          ),
          vehicles (
            registration,
            type
          )
        `)
        .eq('status', 'active');

      if (error) throw error;

      // Get latest locations for each driver
      const driversWithLocations = await Promise.all(
        (shifts || []).map(async (shift: any) => {
          const locations = await realtimeLocationService.getDriverLocations(shift.driver_id, 20);

          return {
            id: shift.driver_id,
            full_name: shift.profiles.full_name,
            email: shift.profiles.email,
            vehicle: shift.vehicles,
            shift: {
              id: shift.id,
              started_at: shift.started_at
            },
            locations,
            status: getDriverStatus(locations)
          };
        })
      );

      setDrivers(driversWithLocations);
    } catch (error) {
      console.error('Error loading drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDriverLocation = (location: LocationLog) => {
    setDrivers(prev => prev.map(driver => {
      if (driver.id === location.driver_id) {
        const updatedLocations = [...driver.locations, location].slice(-20);
        return {
          ...driver,
          locations: updatedLocations,
          status: getDriverStatus(updatedLocations)
        };
      }
      return driver;
    }));
    
    // Update selected driver if it matches
    if (selectedDriver && selectedDriver.id === location.driver_id) {
      setSelectedDriver(prev => {
        if (!prev) return null;
        const updatedLocations = [...prev.locations, location].slice(-20);
        return {
          ...prev,
          locations: updatedLocations,
          status: getDriverStatus(updatedLocations)
        };
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="text-lg text-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="bg-card shadow-sm p-4 border-b border-border">
        <h1 className="text-2xl font-bold text-foreground">Live Driver Tracking</h1>
        <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
          <span>Active: <strong className="text-green-600">{drivers.filter(d => d.status === 'moving').length}</strong></span>
          <span>Stationary: <strong className="text-orange-600">{drivers.filter(d => ['slow', 'warning', 'critical'].includes(d.status)).length}</strong></span>
          <span>Offline: <strong className="text-gray-600">{drivers.filter(d => d.status === 'offline').length}</strong></span>
        </div>
      </header>

      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        <div className="w-80 space-y-4 overflow-y-auto">
          <StationaryAlertPanel drivers={drivers} />
        </div>

        <div className="flex-1 relative bg-card rounded-lg overflow-hidden border border-border">
          <LiveDriverMap
            drivers={drivers}
            onDriverClick={setSelectedDriver}
          />
          {selectedDriver && (
            <DriverInfoPanel
              driver={selectedDriver}
              onClose={() => setSelectedDriver(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
