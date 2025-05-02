import { LocationObject } from 'expo-location';
import { EnhancedLocation } from '../store/locationStore';

/**
 * Route calculator utility functions for location tracking
 */

/**
 * Point interface used for route calculations
 */
export interface Point {
  latitude: number;
  longitude: number;
}

/**
 * Calculate distance between two coordinates using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in meters
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Return 0 if coordinates are identical
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  // Earth's radius in meters
  const R = 6371e3;
  
  // Convert latitude and longitude from degrees to radians
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  // Haversine formula
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // Distance in meters
  return R * c;
}

/**
 * Calculate distance between two points
 */
export function calculateDistance(point1: Point, point2: Point): number {
  return haversineDistance(
    point1.latitude,
    point1.longitude,
    point2.latitude,
    point2.longitude
  );
}

/**
 * Calculate total distance of a route
 * @param route Array of points representing a route
 * @returns Total distance in meters
 */
export function calculateRouteDistance(route: Point[]): number {
  if (!route || route.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < route.length - 1; i++) {
    totalDistance += calculateDistance(route[i], route[i + 1]);
  }

  return totalDistance;
}

/**
 * Format distance in a human-readable way
 * @param distance Distance in meters
 * @returns Formatted distance string (e.g., "1.2 km" or "650 m")
 */
export function formatDistance(distance: number): string {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)} km`;
  }
  return `${Math.round(distance)} m`;
}

/**
 * Format speed in a human-readable way
 * @param speedMps Speed in meters per second
 * @returns Formatted speed string (e.g., "5.4 km/h")
 */
export function formatSpeed(speedMps: number | null | undefined): string {
  if (speedMps === null || speedMps === undefined || isNaN(speedMps)) {
    return '0 km/h';
  }
  
  // Convert m/s to km/h
  const speedKmh = speedMps * 3.6;
  return `${speedKmh.toFixed(1)} km/h`;
}

/**
 * Detect if device is moving based on speed
 * @param speed Speed in meters per second
 * @param threshold Movement threshold in meters per second (default: 0.5 m/s or 1.8 km/h)
 * @returns Whether the device is considered moving
 */
export function isMoving(
  speed: number | null | undefined,
  threshold: number = 0.5
): boolean {
  if (speed === null || speed === undefined || isNaN(speed)) {
    return false;
  }
  return speed > threshold;
}

/**
 * Simplify a route by reducing the number of points while preserving shape
 * Uses the Ramer-Douglas-Peucker algorithm
 * 
 * @param points Array of points representing a route
 * @param epsilon Maximum distance threshold (in meters)
 * @returns Simplified array of points
 */
export function simplifyRoute(points: Point[], epsilon: number = 10): Point[] {
  if (points.length <= 2) {
    return [...points];
  }

  // Find the point with the maximum distance
  let maxDistance = 0;
  let maxDistanceIndex = 0;
  
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], firstPoint, lastPoint);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxDistanceIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    // Recursive call
    const firstHalf = simplifyRoute(points.slice(0, maxDistanceIndex + 1), epsilon);
    const secondHalf = simplifyRoute(points.slice(maxDistanceIndex), epsilon);
    
    // Concatenate the results
    return [...firstHalf.slice(0, -1), ...secondHalf];
  } else {
    // Base case - return just the first and last points
    return [firstPoint, lastPoint];
  }
}

/**
 * Calculate perpendicular distance from a point to a line
 * 
 * @param point The point to calculate distance from
 * @param lineStart Start point of the line
 * @param lineEnd End point of the line
 * @returns Distance in meters
 */
function perpendicularDistance(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): number {
  // Handle case where line start and end are the same point
  if (
    lineStart.latitude === lineEnd.latitude &&
    lineStart.longitude === lineEnd.longitude
  ) {
    return calculateDistance(point, lineStart);
  }

  // Calculate area of triangle
  const area = Math.abs(
    (lineStart.latitude * (lineEnd.longitude - point.longitude) +
     lineEnd.latitude * (point.longitude - lineStart.longitude) +
     point.latitude * (lineStart.longitude - lineEnd.longitude)) / 2
  );

  // Calculate length of the base
  const baseLengthMeters = haversineDistance(
    lineStart.latitude,
    lineStart.longitude,
    lineEnd.latitude,
    lineEnd.longitude
  );

  // Return height (perpendicular distance)
  return (area * 2) / baseLengthMeters;
}

/**
 * Convert a location object to a simple point
 */
export function locationToPoint(
  location: LocationObject | EnhancedLocation | any
): Point {
  // Extract coordinates from either nested structure or flat structure
  const latitude = location.latitude || (location.coords && location.coords.latitude) || 0;
  const longitude = location.longitude || (location.coords && location.coords.longitude) || 0;
  
  return { latitude, longitude };
}

/**
 * Clean a route by removing invalid points and duplicates
 * 
 * @param route Array of points
 * @returns Cleaned route
 */
export function cleanRoute(route: Point[]): Point[] {
  if (!route || route.length === 0) return [];
  
  return route.filter((point, index) => {
    // Skip invalid points
    if (
      !point ||
      point.latitude === undefined ||
      point.longitude === undefined ||
      isNaN(point.latitude) ||
      isNaN(point.longitude) ||
      (point.latitude === 0 && point.longitude === 0)
    ) {
      return false;
    }
    
    // Skip duplicate consecutive points
    if (index > 0) {
      const prevPoint = route[index - 1];
      return !(prevPoint.latitude === point.latitude && 
               prevPoint.longitude === point.longitude);
    }
    
    return true;
  });
}

/**
 * Convert an array of LocationObjects to an array of simple Points
 */
export function locationsToPoints(
  locations: Array<LocationObject | EnhancedLocation | any>
): Point[] {
  return locations.map(locationToPoint);
}

/**
 * Get route statistics
 * 
 * @param route Array of points with timestamps
 * @returns Object with total distance, average speed, and duration
 */
export function getRouteStats(
  route: Array<Point & { timestamp?: number }>
): { 
  distance: number;
  formattedDistance: string;
  averageSpeed: number;
  formattedSpeed: string;
  duration: number;
  formattedDuration: string;
} {
  if (!route || route.length < 2) {
    return {
      distance: 0,
      formattedDistance: '0 m',
      averageSpeed: 0,
      formattedSpeed: '0 km/h',
      duration: 0,
      formattedDuration: '0 min'
    };
  }

  // Calculate total distance
  const distance = calculateRouteDistance(route);
  
  // Calculate duration if timestamps are available
  let duration = 0;
  if (route[0].timestamp && route[route.length - 1].timestamp) {
    duration = (route[route.length - 1].timestamp! - route[0].timestamp!) / 1000; // in seconds
  }
  
  // Calculate average speed (m/s)
  const averageSpeed = duration > 0 ? distance / duration : 0;
  
  // Format duration
  let formattedDuration = '0 min';
  if (duration >= 3600) {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    formattedDuration = `${hours} hr ${minutes} min`;
  } else if (duration >= 60) {
    const minutes = Math.floor(duration / 60);
    formattedDuration = `${minutes} min`;
  } else {
    formattedDuration = `${Math.round(duration)} sec`;
  }

  return {
    distance,
    formattedDistance: formatDistance(distance),
    averageSpeed,
    formattedSpeed: formatSpeed(averageSpeed),
    duration, // in seconds
    formattedDuration
  };
} 