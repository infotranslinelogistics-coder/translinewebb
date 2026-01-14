import { Driver } from '../types/location';
import { getStationaryDuration } from '../lib/geoUtils';

interface StationaryAlertPanelProps {
  drivers: Driver[];
}

export function StationaryAlertPanel({ drivers }: StationaryAlertPanelProps) {
  const stationaryDrivers = drivers.filter(d =>
    ['slow', 'warning', 'critical'].includes(d.status)
  ).sort((a, b) =>
    getStationaryDuration(b.locations) - getStationaryDuration(a.locations)
  );

  if (stationaryDrivers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-2 text-gray-900">⚠️ Alerts</h3>
        <p className="text-sm text-gray-500">No stationary drivers</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-3 text-gray-900">
        ⚠️ Alerts ({stationaryDrivers.length})
      </h3>

      <div className="space-y-2">
        {stationaryDrivers.map(driver => {
          const minutes = getStationaryDuration(driver.locations);
          const severity = driver.status === 'critical' ? 'bg-red-100 border-red-300'
                         : driver.status === 'warning' ? 'bg-orange-100 border-orange-300'
                         : 'bg-yellow-100 border-yellow-300';

          return (
            <div key={driver.id} className={`p-3 rounded border ${severity}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-gray-900">{driver.full_name}</div>
                  <div className="text-sm text-gray-600">
                    Vehicle: {driver.vehicle?.registration || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Stationary for <strong>{minutes} minutes</strong>
                  </div>
                </div>
                <div className="text-2xl">
                  {driver.status === 'critical' ? '🔴'
                   : driver.status === 'warning' ? '🟠'
                   : '🟡'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
