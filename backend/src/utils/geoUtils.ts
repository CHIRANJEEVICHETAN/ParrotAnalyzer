/**
 * Geographic utility functions
 */

/**
 * Calculate the distance between two coordinates in kilometers using the Haversine formula
 * 
 * @param lat1 Latitude of the first point in decimal degrees
 * @param lon1 Longitude of the first point in decimal degrees
 * @param lat2 Latitude of the second point in decimal degrees
 * @param lon2 Longitude of the second point in decimal degrees
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  // Earth radius in kilometers
  const R = 6371;
  
  // Convert latitude and longitude from degrees to radians
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  // Haversine formula
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Convert degrees to radians
 * 
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a point is inside a circle
 * 
 * @param pointLat Latitude of the point
 * @param pointLon Longitude of the point
 * @param circleLat Latitude of the circle center
 * @param circleLon Longitude of the circle center
 * @param circleRadius Radius of the circle in kilometers
 * @returns True if the point is inside the circle, false otherwise
 */
export function isPointInCircle(
  pointLat: number,
  pointLon: number,
  circleLat: number,
  circleLon: number,
  circleRadius: number
): boolean {
  const distance = calculateDistance(pointLat, pointLon, circleLat, circleLon);
  return distance <= circleRadius;
}

/**
 * Calculate bearing between two points
 * 
 * @param lat1 Latitude of the first point in decimal degrees
 * @param lon1 Longitude of the first point in decimal degrees
 * @param lat2 Latitude of the second point in decimal degrees
 * @param lon2 Longitude of the second point in decimal degrees
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const y = Math.sin(toRadians(lon2 - lon1)) * Math.cos(toRadians(lat2));
  const x = 
    Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(toRadians(lon2 - lon1));
  
  let bearing = Math.atan2(y, x);
  bearing = toDegrees(bearing);
  
  // Normalize bearing to 0-360
  return (bearing + 360) % 360;
}

/**
 * Convert radians to degrees
 * 
 * @param radians Angle in radians
 * @returns Angle in degrees
 */
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Detect whether a device is moving based on speed
 * 
 * @param speedMetersPerSecond Speed in meters per second
 * @param threshold Threshold in meters per second (default: 0.5 m/s or 1.8 km/h)
 * @returns True if the device is considered moving, false otherwise
 */
export function isDeviceMoving(
  speedMetersPerSecond: number | null | undefined,
  threshold: number = 0.5
): boolean {
  if (speedMetersPerSecond === null || speedMetersPerSecond === undefined) {
    return false;
  }
  
  return speedMetersPerSecond > threshold;
} 