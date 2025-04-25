import { Location } from '../types/liveTracking';
import { pool } from '../config/database';

export class LocationValidationService {
  private readonly MIN_ACCURACY = 500; // meters - increased from 100 to allow for less accurate GPS readings
  private readonly BACKGROUND_MIN_ACCURACY = 15000; // meters - much more forgiving for background updates
  private readonly MAX_SPEED = 120; // km/h
  private readonly MIN_BATTERY = 5; // percentage

  async validateLocation(
    location: Location,
    userId: number,
    isBackgroundUpdate: boolean = false
  ): Promise<{ isValid: boolean; reason?: string }> {
    try {
      // Check basic location data
      if (!this.isValidCoordinates(location)) {
        return { isValid: false, reason: "Invalid coordinates" };
      }

      // Background updates are allowed to have lower accuracy
      const accuracyThreshold = isBackgroundUpdate
        ? this.BACKGROUND_MIN_ACCURACY
        : this.MIN_ACCURACY;

      // Check accuracy with appropriate threshold
      if (!this.isValidAccuracy(location, accuracyThreshold)) {
        // If it's a background update, log the issue but accept the location anyway
        if (isBackgroundUpdate) {
          console.log(
            `Accepting low accuracy background update (${location.accuracy}m) for user ${userId}`
          );
          // Continue processing without returning
        } else {
          return { isValid: false, reason: "Poor location accuracy" };
        }
      }

      // Check battery level
      if (!this.isValidBatteryLevel(location)) {
        return { isValid: false, reason: "Low battery level" };
      }

      // Check speed (if previous location exists)
      const isValidSpeed = await this.checkSpeed(location, userId);
      if (!isValidSpeed) {
        return { isValid: false, reason: "Unrealistic speed detected" };
      }

      // Check company settings
      const isCompliantWithSettings = await this.checkCompanySettings(
        location,
        userId
      );
      if (!isCompliantWithSettings) {
        return {
          isValid: false,
          reason: "Does not comply with company settings",
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error("Location validation error:", error);
      // If there's an error during validation and it's a background update,
      // let it through rather than losing the data
      return {
        isValid: isBackgroundUpdate,
        reason: isBackgroundUpdate
          ? "Validation error but accepted as background update"
          : "Validation error",
      };
    }
  }

  private isValidCoordinates(location: Location): boolean {
    return (
      typeof location.latitude === "number" &&
      typeof location.longitude === "number" &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180
    );
  }

  private isValidAccuracy(
    location: Location,
    threshold: number = this.MIN_ACCURACY
  ): boolean {
    return !location.accuracy || location.accuracy <= threshold;
  }

  private isValidBatteryLevel(location: Location): boolean {
    return !location.batteryLevel || location.batteryLevel >= this.MIN_BATTERY;
  }

  private async checkSpeed(
    location: Location,
    userId: number
  ): Promise<boolean> {
    try {
      // Get last location
      const result = await pool.query(
        `SELECT latitude, longitude, timestamp 
                FROM employee_locations 
                WHERE user_id = $1 
                ORDER BY timestamp DESC 
                LIMIT 1`,
        [userId]
      );

      if (!result.rows.length) {
        return true; // First location, no speed to check
      }

      const lastLocation = result.rows[0];
      const timeDiff =
        (new Date(location.timestamp).getTime() -
          new Date(lastLocation.timestamp).getTime()) /
        1000; // seconds

      if (timeDiff <= 0) {
        return false;
      }

      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        lastLocation.latitude,
        lastLocation.longitude
      );

      const speed = distance / 1000 / (timeDiff / 3600); // km/h
      return speed <= this.MAX_SPEED;
    } catch (error) {
      console.error("Speed check error:", error);
      return true; // Allow in case of error
    }
  }

  private async checkCompanySettings(
    location: Location,
    userId: number
  ): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT cs.* 
                FROM company_tracking_settings cs
                JOIN users u ON u.company_id = cs.company_id
                WHERE u.id = $1`,
        [userId]
      );

      if (!result.rows.length) {
        return true; // No settings, allow
      }

      const settings = result.rows[0];

      // Check minimum accuracy requirement
      if (
        location.accuracy &&
        location.accuracy > settings.min_location_accuracy
      ) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Company settings check error:", error);
      return true; // Allow in case of error
    }
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }
} 