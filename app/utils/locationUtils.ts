import * as Location from "expo-location";
import { Platform } from "react-native";

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
