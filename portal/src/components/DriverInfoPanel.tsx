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
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 w-80 z-10">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{driver.full_name}</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <span className="text-gray-600">Vehicle:</span>
          <span className="ml-2 font-medium text-gray-900">
            {driver.vehicle?.registration || 'Not assigned'}
          </span>
        </div>

        <div>
          <span className="text-gray-600">Status:</span>
          <span className={`ml-2 font-medium ${getStatusColor(driver.status)}`}>
            {getStatusLabel(driver.status)}
          </span>
        </div>

        <div>
          <span className="text-gray-600">Speed:</span>
          <span className="ml-2 font-medium text-gray-900">{speed.toFixed(1)} km/h</span>
        </div>

        {latestLocation?.heading && (
          <div>
            <span className="text-gray-600">Heading:</span>
            <span className="ml-2 font-medium text-gray-900">{getHeadingDirection(latestLocation.heading)}</span>
          </div>
        )}

        <div>
          <span className="text-gray-600">Last update:</span>
          <span className="ml-2 font-medium text-gray-900">{timeSinceUpdate}</span>
        </div>

        {stationaryMinutes > 0 && (
          <div>
            <span className="text-gray-600">Stationary time:</span>
            <span className="ml-2 font-medium text-orange-600">
              {stationaryMinutes} minutes
            </span>
          </div>
        )}

        {latestLocation?.accuracy && (
          <div>
            <span className="text-gray-600">Accuracy:</span>
            <span className="ml-2 text-gray-500">{latestLocation.accuracy.toFixed(0)}m</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t space-y-2">
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
