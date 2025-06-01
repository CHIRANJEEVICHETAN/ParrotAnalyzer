import { LocationObject } from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants for accuracy filtering
const MAX_ACCURACY_RADIUS = 100; // in meters
const GOOD_ACCURACY_THRESHOLD = 20; // in meters
const CONFIDENCE_THRESHOLD = 0.7; // minimum confidence score to accept a location
const HISTORY_SIZE = 5; // number of locations to keep for smoothing

// Keys for storage
const LOCATION_HISTORY_KEY = 'filtered_location_history';
const ACCURACY_SETTINGS_KEY = 'location_accuracy_settings';

/**
 * Settings for location accuracy filtering
 */
export interface AccuracyFilterSettings {
  enabled: boolean;
  maxAccuracyRadius: number;
  goodAccuracyThreshold: number;
  confidenceThreshold: number;
  useSmoothing: boolean;
  rejectLowAccuracy: boolean;
}

/**
 * Location with confidence score
 */
export interface ScoredLocation {
  location: LocationObject;
  confidence: number;
  isFiltered: boolean;
  reason?: string;
}

/**
 * Get the current accuracy filter settings
 */
export async function getAccuracyFilterSettings(): Promise<AccuracyFilterSettings> {
  try {
    const settingsStr = await AsyncStorage.getItem(ACCURACY_SETTINGS_KEY);
    if (settingsStr) {
      return JSON.parse(settingsStr);
    }
  } catch (error) {
    console.error('Error loading accuracy filter settings:', error);
  }
  
  // Default settings
  return {
    enabled: true,
    maxAccuracyRadius: MAX_ACCURACY_RADIUS,
    goodAccuracyThreshold: GOOD_ACCURACY_THRESHOLD,
    confidenceThreshold: CONFIDENCE_THRESHOLD,
    useSmoothing: true,
    rejectLowAccuracy: false
  };
}

/**
 * Save accuracy filter settings
 */
export async function saveAccuracyFilterSettings(settings: AccuracyFilterSettings): Promise<boolean> {
  try {
    await AsyncStorage.setItem(ACCURACY_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Error saving accuracy filter settings:', error);
    return false;
  }
}

/**
 * Calculate confidence score for a location
 * Returns a value between 0 and 1
 */
export function calculateLocationConfidence(location: LocationObject): number {
  if (!location || !location.coords) return 0;
  
  const { accuracy, speed, altitude, altitudeAccuracy } = location.coords;
  
  // Base score on accuracy (inverse relationship - lower accuracy radius means higher confidence)
  let confidenceScore = 0;
  
  // Accuracy score (weight: 70%)
  if (accuracy !== undefined && accuracy !== null) {
    // Accuracy is the radius in meters
    if (accuracy <= GOOD_ACCURACY_THRESHOLD) {
      // Good accuracy (0-20m): score from 0.7-1.0
      confidenceScore += 0.7 + (0.3 * (1 - (accuracy / GOOD_ACCURACY_THRESHOLD)));
    } else if (accuracy <= MAX_ACCURACY_RADIUS) {
      // Medium accuracy (20-100m): score from 0.4-0.7
      confidenceScore += 0.4 + (0.3 * (1 - ((accuracy - GOOD_ACCURACY_THRESHOLD) / (MAX_ACCURACY_RADIUS - GOOD_ACCURACY_THRESHOLD))));
    } else {
      // Poor accuracy (>100m): score from 0-0.4 based on how far it exceeds the threshold
      const exceedFactor = Math.min(accuracy / MAX_ACCURACY_RADIUS, 5); // Cap at 5x the threshold
      confidenceScore += 0.4 * (1 / exceedFactor);
    }
  } else {
    // No accuracy information, assume medium confidence
    confidenceScore += 0.5;
  }
  
  // Additional factors can modify the confidence up or down
  
  // Speed reasonability check (weight: 10%)
  if (speed !== undefined && speed !== null) {
    // Check if speed is reasonable (less than ~180 km/h or 50 m/s)
    const maxReasonableSpeed = 50;
    if (speed > maxReasonableSpeed) {
      // Unreasonably high speed, reduce confidence
      confidenceScore -= 0.1;
    } else {
      // Reasonable speed, slightly increase confidence
      confidenceScore += 0.1 * (1 - (speed / maxReasonableSpeed));
    }
  }
  
  // Altitude accuracy if available (weight: 10%)
  if (altitude !== undefined && altitudeAccuracy !== undefined && altitudeAccuracy !== null) {
    if (altitudeAccuracy < 50) {
      // Good altitude accuracy boosts confidence slightly
      confidenceScore += 0.1;
    } else if (altitudeAccuracy > 100) {
      // Poor altitude accuracy slightly reduces confidence
      confidenceScore -= 0.05;
    }
  }
  
  // Ensure confidence is between 0-1
  return Math.max(0, Math.min(1, confidenceScore));
}

/**
 * Filter a location based on accuracy and confidence
 */
export async function filterLocation(location: LocationObject): Promise<ScoredLocation> {
  try {
    // Get settings
    const settings = await getAccuracyFilterSettings();
    
    // If filtering is disabled, return the original location
    if (!settings.enabled) {
      return {
        location,
        confidence: 1.0,
        isFiltered: false
      };
    }
    
    // Quick accuracy check first
    if (settings.rejectLowAccuracy && 
        location.coords.accuracy && 
        location.coords.accuracy > settings.maxAccuracyRadius) {
      return {
        location,
        confidence: 0,
        isFiltered: true,
        reason: 'Accuracy radius too large'
      };
    }
    
    // Calculate confidence score - only if needed
    const confidence = calculateLocationConfidence(location);
    
    // Check if confidence is high enough
    const isLowConfidence = confidence < settings.confidenceThreshold;
    
    // Apply smoothing if enabled and confidence is low
    if (settings.useSmoothing && isLowConfidence) {
      try {
        // Get small sample of recent location history (limit to 5 points for performance)
        const history = (await getLocationHistory()).slice(-5);
        
        // Only smooth if we have previous locations
        if (history.length > 0) {
          const smoothedLocation = smoothLocation(location, history);
          return {
            location: smoothedLocation,
            confidence: confidence * 1.2, // Slightly increase confidence of smoothed location
            isFiltered: false,
            reason: 'Smoothed low confidence location'
          };
        }
      } catch (error) {
        console.error('Error during location smoothing:', error);
        // Continue with original location if smoothing fails
      }
    }
    
    // If confidence is too low and smoothing didn't help, we might filter it
    if (isLowConfidence) {
      return {
        location,
        confidence,
        isFiltered: true,
        reason: 'Low confidence score'
      };
    }
    
    // Add to history if it passed our checks
    try {
      await addToLocationHistory(location);
    } catch (error) {
      // Non-critical error, just log it
      console.error('Error adding location to history:', error);
    }
    
    // Return the location with its confidence score
    return {
      location,
      confidence,
      isFiltered: false
    };
  } catch (error) {
    console.error('Error filtering location:', error);
    // If anything fails, return the original location
    return {
      location,
      confidence: 1.0,
      isFiltered: false,
      reason: 'Filter error, using original'
    };
  }
}

/**
 * Get location history for smoothing
 */
async function getLocationHistory(): Promise<LocationObject[]> {
  try {
    const historyStr = await AsyncStorage.getItem(LOCATION_HISTORY_KEY);
    if (historyStr) {
      return JSON.parse(historyStr);
    }
  } catch (error) {
    console.error('Error loading location history:', error);
  }
  return [];
}

/**
 * Add a location to history
 */
async function addToLocationHistory(location: LocationObject): Promise<void> {
  try {
    const history = await getLocationHistory();
    
    // Add new location
    history.push(location);
    
    // Keep only the latest N locations
    if (history.length > HISTORY_SIZE) {
      history.shift();
    }
    
    // Save back to storage
    await AsyncStorage.setItem(LOCATION_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Error saving location history:', error);
  }
}

/**
 * Smooth a location using weighted average of recent history
 */
function smoothLocation(current: LocationObject, history: LocationObject[]): LocationObject {
  // If no history or only current location, return as is
  if (history.length <= 1) return current;
  
  // Get the most recent locations including current
  const recentLocations = [...history.slice(-2), current];
  
  // Calculate weighted average - more recent locations have higher weight
  let totalWeight = 0;
  let weightedSumLat = 0;
  let weightedSumLng = 0;
  
  recentLocations.forEach((loc, index) => {
    // Weight increases with recency
    const weight = index + 1;
    totalWeight += weight;
    
    weightedSumLat += loc.coords.latitude * weight;
    weightedSumLng += loc.coords.longitude * weight;
  });
  
  // Create smoothed location
  const smoothed = { 
    ...current,
    coords: {
      ...current.coords,
      latitude: weightedSumLat / totalWeight,
      longitude: weightedSumLng / totalWeight
    }
  };
  
  return smoothed;
}

/**
 * Reset location filtering history and settings
 */
export async function resetLocationFiltering(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOCATION_HISTORY_KEY);
    // Don't remove settings, just clear history
    console.log('Location filtering history reset');
  } catch (error) {
    console.error('Error resetting location filtering:', error);
  }
} 