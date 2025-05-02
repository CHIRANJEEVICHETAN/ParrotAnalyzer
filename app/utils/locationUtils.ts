import * as Location from "expo-location";
import { Platform } from "react-native";
import { LocationObject } from 'expo-location';
import { EnhancedLocation } from '../store/locationStore';

/**
 * Checks if location services are enabled on the device
 * @returns Promise<boolean> - Whether location services are enabled
 */
export const checkLocationServicesStatus = async (): Promise<boolean> => {
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    return enabled;
  } catch (error) {
    console.error("Error checking location services status:", error);
    return false;
  }
};

/**
 * Gets the current location with high accuracy
 * @returns Promise with location object or null if error
 */
export const getCurrentLocation = async () => {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });
    return location;
  } catch (error) {
    console.error("Error getting current location:", error);
    return null;
  }
};

/**
 * Calculates the distance between two coordinates in meters
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const radlat1 = (Math.PI * lat1) / 180;
  const radlat2 = (Math.PI * lat2) / 180;
  const theta = lon1 - lon2;
  const radtheta = (Math.PI * theta) / 180;
  let dist =
    Math.sin(radlat1) * Math.sin(radlat2) +
    Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
  dist = Math.acos(Math.min(dist, 1));
  dist = (dist * 180) / Math.PI;
  dist = dist * 60 * 1.1515 * 1.609344 * 1000; // convert to meters
  return dist;
};

/**
 * Creates an EnhancedLocation object that has both direct properties and nested coords
 * This helps maintain compatibility with different parts of the codebase
 */
export function createEnhancedLocation(location: LocationObject | any): EnhancedLocation {
  // If it's already a LocationObject with coords
  if (location.coords) {
    return {
      // Direct properties for compatibility with old code
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude,
      altitudeAccuracy: location.coords.altitudeAccuracy,
      heading: location.coords.heading,
      speed: location.coords.speed,
      // Keep the nested structure for compatibility with expo-location
      coords: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        altitudeAccuracy: location.coords.altitudeAccuracy,
        heading: location.coords.heading,
        speed: location.coords.speed,
      },
      timestamp: location.timestamp,
      // Additional properties
      batteryLevel: location.batteryLevel,
      isMoving: location.isMoving,
      address: location.address,
      recordedAt: location.recordedAt,
    };
  }
  
  // If it's a flat object with direct properties
  if (location.latitude && location.longitude) {
    return {
      // Direct properties
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      altitude: location.altitude,
      altitudeAccuracy: location.altitudeAccuracy,
      heading: location.heading,
      speed: location.speed,
      // Create nested structure
      coords: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        altitude: location.altitude,
        altitudeAccuracy: location.altitudeAccuracy,
        heading: location.heading,
        speed: location.speed,
      },
      timestamp: location.timestamp,
      // Additional properties
      batteryLevel: location.batteryLevel,
      isMoving: location.isMoving,
      address: location.address,
      recordedAt: location.recordedAt,
    };
  }
  
  // Return empty location as fallback
  return {
    latitude: 0,
    longitude: 0,
    accuracy: 0,
    coords: {
      latitude: 0,
      longitude: 0,
      accuracy: 0,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  };
}

/**
 * Safe access to location properties regardless of structure (flat or nested)
 */
export function getLatitude(location: EnhancedLocation | LocationObject | any): number {
  if (!location) return 0;
  return location.latitude || (location.coords && location.coords.latitude) || 0;
}

export function getLongitude(location: EnhancedLocation | LocationObject | any): number {
  if (!location) return 0;
  return location.longitude || (location.coords && location.coords.longitude) || 0;
}

export function getAccuracy(location: EnhancedLocation | LocationObject | any): number | null {
  if (!location) return null;
  return location.accuracy || (location.coords && location.coords.accuracy) || null;
}

export function getSpeed(location: EnhancedLocation | LocationObject | any): number | null {
  if (!location) return null;
  return location.speed || (location.coords && location.coords.speed) || null;
}

export function isLocationValid(location: EnhancedLocation | LocationObject | any): boolean {
  if (!location) return false;
  
  const lat = getLatitude(location);
  const lng = getLongitude(location);
  
  return (
    lat !== 0 &&
    lng !== 0 &&
    !isNaN(lat) &&
    !isNaN(lng)
  );
}
