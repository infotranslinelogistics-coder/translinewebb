import { formatDistanceToNow } from 'date-fns';
import { Driver } from '../types/location';
import { getStationaryDuration, calculateSpeed, getHeadingDirection, getStatusColor, getStatusLabel } from '../lib/geoUtils';
import { Button } from '../ui/button';

interface DriverInfoPanelProps {
  driver: Driver;
  onClose: () => void;
}

export function DriverInfoPanel({ driver, onClose }: DriverInfoPanelProps) {
  const latestLocation = driver.locations[driver.locations.length - 1];
  const stationaryMinutes = getStationaryDuration(driver.locations);
  const speed = driver.locations.length >= 2
    ? calculateSpeed(driver.locations[driver.locations.length - 2], latestLocation)
    : 0;

  const timeSinceUpdate = latestLocation
    ? formatDistanceToNow(new Date(latestLocation.timestamp), { addSuffix: true })
    : 'Unknown';

  return (
    <div className="absolute top-4 right-4 bg-card rounded-lg shadow-lg p-4 w-80 z-10 border border-border">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-foreground">{driver.full_name}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">Vehicle:</span>
          <span className="ml-2 font-medium text-foreground">
            {driver.vehicle?.registration || 'Not assigned'}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground">Status:</span>
          <span className={`ml-2 font-medium ${getStatusColor(driver.status)}`}>
            {getStatusLabel(driver.status)}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground">Speed:</span>
          <span className="ml-2 font-medium text-foreground">{speed.toFixed(1)} km/h</span>
        </div>

        {latestLocation?.heading && (
          <div>
            <span className="text-muted-foreground">Heading:</span>
            <span className="ml-2 font-medium text-foreground">{getHeadingDirection(latestLocation.heading)}</span>
          </div>
        )}

        <div>
          <span className="text-muted-foreground">Last update:</span>
          <span className="ml-2 font-medium text-foreground">{timeSinceUpdate}</span>
        </div>

        {stationaryMinutes > 0 && (
          <div>
            <span className="text-muted-foreground">Stationary time:</span>
            <span className="ml-2 font-medium text-orange-600">
              {stationaryMinutes} minutes
            </span>
          </div>
        )}

        {latestLocation?.accuracy && (
          <div>
            <span className="text-muted-foreground">Accuracy:</span>
            <span className="ml-2 text-muted-foreground">{latestLocation.accuracy.toFixed(0)}m</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-border space-y-2">
        <Button className="w-full" variant="default">
          View Shift Details
        </Button>
        <Button className="w-full" variant="outline">
          View Route History
        </Button>
      </div>
    </div>
  );
}
