import distance from '@turf/distance';
import { point } from '@turf/helpers';
import { LocationLog, DriverStatus } from '../types/location';

/**
 * Calculate distance between two coordinates using Haversine formula via Turf.js
 * @param coord1 First coordinate
 * @param coord2 Second coordinate
 * @returns Distance in meters
 */
export function getDistance(
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number }
): number {
  const from = point([coord1.lng, coord1.lat]);
  const to = point([coord2.lng, coord2.lat]);
  const distanceKm = distance(from, to, { units: 'kilometers' });
  return distanceKm * 1000; // Convert to meters
}

/**
 * Check if driver is stationary based on recent locations
 * @param locations Array of location logs
 * @param radiusMeters Maximum radius to consider stationary (default: 50m)
 * @param durationMinutes Minimum duration to consider stationary (default: 10 min)
 * @returns true if driver is stationary
 */
export function isDriverStationary(
  locations: LocationLog[],
  radiusMeters: number = 50,
  durationMinutes: number = 10
): boolean {
  // Get recent locations
  const recent = locations.slice(-5);
  if (recent.length < 2) return false;

  // Check if all locations within radius
  const center = recent[0];
  const allNearby = recent.every(loc =>
    getDistance(
      { lat: center.latitude, lng: center.longitude },
      { lat: loc.latitude, lng: loc.longitude }
    ) < radiusMeters
  );

  // Check if time elapsed exceeds duration
  const duration = new Date(recent[recent.length - 1].timestamp).getTime()
    - new Date(recent[0].timestamp).getTime();
  const minutes = duration / (1000 * 60);

  return allNearby && minutes >= durationMinutes;
}

/**
 * Get stationary duration in minutes
 * @param locations Array of location logs
 * @returns Minutes driver has been stationary, or 0 if not stationary
 */
export function getStationaryDuration(locations: LocationLog[]): number {
  if (locations.length < 2) return 0;

  const radiusMeters = 50;
  const recent = locations.slice(-20); // Look at last 20 locations
  
  // Find the start of the stationary period by working backwards
  let stationaryStart = recent.length - 1;
  const latest = recent[recent.length - 1];
  
  for (let i = recent.length - 2; i >= 0; i--) {
    const dist = getDistance(
      { lat: latest.latitude, lng: latest.longitude },
      { lat: recent[i].latitude, lng: recent[i].longitude }
    );
    
    if (dist < radiusMeters) {
      stationaryStart = i;
    } else {
      break; // Found movement, stop searching
    }
  }
  
  // Calculate duration from start of stationary period to latest
  const duration = new Date(latest.timestamp).getTime()
    - new Date(recent[stationaryStart].timestamp).getTime();
  const minutes = duration / (1000 * 60);
  
  return minutes > 1 ? Math.floor(minutes) : 0;
}

/**
 * Calculate speed between two location points
 * @param loc1 First location
 * @param loc2 Second location
 * @returns Speed in km/h
 */
export function calculateSpeed(
  loc1: LocationLog,
  loc2: LocationLog
): number {
  const dist = getDistance(
    { lat: loc1.latitude, lng: loc1.longitude },
    { lat: loc2.latitude, lng: loc2.longitude }
  );
  
  const timeDiff = Math.abs(
    new Date(loc2.timestamp).getTime() - new Date(loc1.timestamp).getTime()
  );
  const hours = timeDiff / (1000 * 60 * 60);
  
  if (hours === 0) return 0;
  
  const distKm = dist / 1000;
  return distKm / hours;
}

/**
 * Get driver status based on latest location data
 * @param locations Array of location logs
 * @returns Driver status
 */
export function getDriverStatus(locations: LocationLog[]): DriverStatus {
  if (locations.length === 0) return 'offline';

  const latest = locations[locations.length - 1];
  const timeSinceUpdate = Date.now() - new Date(latest.timestamp).getTime();

  // Offline if no update in 5 minutes
  if (timeSinceUpdate > 5 * 60 * 1000) return 'offline';

  // Check if stationary
  const stationaryMinutes = getStationaryDuration(locations);
  if (stationaryMinutes >= 15) return 'critical';
  if (stationaryMinutes >= 10) return 'warning';
  if (stationaryMinutes >= 5) return 'slow';

  // Check speed
  if (locations.length >= 2) {
    const speed = calculateSpeed(locations[locations.length - 2], latest);
    if (speed < 5) return 'slow';
  }

  return 'moving';
}

/**
 * Get heading direction from degrees
 * @param heading Heading in degrees (0-360)
 * @returns Direction string (N, NE, E, SE, S, SW, W, NW)
 */
export function getHeadingDirection(heading: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(heading / 45) % 8;
  return directions[index];
}

/**
 * Get color for driver status
 * @param status Driver status
 * @returns Tailwind color class
 */
export function getStatusColor(status: DriverStatus): string {
  switch (status) {
    case 'moving': return 'text-green-600';
    case 'slow': return 'text-yellow-600';
    case 'warning': return 'text-orange-600';
    case 'critical': return 'text-red-600';
    case 'offline': return 'text-gray-600';
    default: return 'text-gray-600';
  }
}

/**
 * Get label for driver status
 * @param status Driver status
 * @returns Human-readable status label
 */
export function getStatusLabel(status: DriverStatus): string {
  switch (status) {
    case 'moving': return 'Moving';
    case 'slow': return 'Slow/Stopped';
    case 'warning': return 'Stationary (10+ min)';
    case 'critical': return 'Critical Alert (15+ min)';
    case 'offline': return 'Offline';
    default: return 'Unknown';
  }
}
