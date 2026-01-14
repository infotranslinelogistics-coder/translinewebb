import { Marker } from 'react-map-gl';
import { Driver } from '../types/location';

interface DriverMarkerProps {
  driver: Driver;
  onClick: (driver: Driver) => void;
}

export function DriverMarker({ driver, onClick }: DriverMarkerProps) {
  const latestLocation = driver.locations[driver.locations.length - 1];
  if (!latestLocation) return null;

  const getMarkerColor = () => {
    switch (driver.status) {
      case 'moving': return '#10B981'; // Green
      case 'slow': return '#F59E0B'; // Yellow
      case 'warning': return '#F97316'; // Orange
      case 'critical': return '#EF4444'; // Red
      case 'offline': return '#6B7280'; // Gray
      default: return '#6B7280';
    }
  };

  return (
    <Marker
      latitude={latestLocation.latitude}
      longitude={latestLocation.longitude}
      anchor="bottom"
      onClick={() => onClick(driver)}
    >
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        backgroundColor: getMarkerColor(),
        border: '3px solid white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16
      }}>
        🚗
      </div>
    </Marker>
  );
}
