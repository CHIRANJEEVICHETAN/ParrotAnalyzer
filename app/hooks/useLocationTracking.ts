import { useEffect, useRef, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { AppState, AppStateStatus } from 'react-native';
import { LocationAccuracy, TrackingStatus, Location as LocationType, LocationHistory } from '../types/liveTracking';
import useLocationStore from '../store/locationStore';
import { useSocket } from './useSocket';
import { useAuth } from '../context/AuthContext';
import { 
  startBackgroundLocationTracking, 
  stopBackgroundLocationTracking, 
  isBackgroundLocationTrackingActive,
  BACKGROUND_LOCATION_TASK 
} from '../utils/backgroundLocationTask';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Map location accuracy levels to Expo accuracy constants
const accuracyMap = {
  high: Location.Accuracy.High,
  balanced: Location.Accuracy.Balanced,
  low: Location.Accuracy.Low,
  passive: Location.Accuracy.Lowest
};

interface UseLocationTrackingOptions {
  initialAccuracy?: LocationAccuracy;
  initialIntervalMs?: number;
  distanceInterval?: number;
  onLocationUpdate?: (location: LocationType) => void;
  onError?: (error: string) => void;
  autoStart?: boolean;
  enableBackgroundTracking?: boolean;
}

export function useLocationTracking({
  initialAccuracy = 'balanced',
  initialIntervalMs = 30000,
  distanceInterval = 10,
  onLocationUpdate,
  onError,
  autoStart = false,
  enableBackgroundTracking = false
}: UseLocationTrackingOptions = {}) {
  const { user } = useAuth();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [intervalMs, setIntervalMs] = useState<number>(initialIntervalMs);
  
  const { 
    setCurrentLocation,
    addLocationToHistory,
    setTrackingStatus,
    setLocationAccuracy,
    setError,
    setBatteryLevel,
    locationAccuracy,
    trackingStatus,
    backgroundTrackingEnabled
  } = useLocationStore();
  
  const { 
    emitLocation, 
    getOptimalUpdateInterval, 
    isConnected
  } = useSocket({
    onError: (errorMessage) => {
      setError(errorMessage);
      onError?.(errorMessage);
    }
  });

  // Check if background location task is active on mount
  useEffect(() => {
    const checkBackgroundTaskStatus = async () => {
      try {
        const isActive = await isBackgroundLocationTrackingActive();
        if (isActive) {
          // If the background task is active, update the store state
          setTrackingStatus(TrackingStatus.ACTIVE);
          
          // Also check for last location saved from background task
          const lastLocationStr = await AsyncStorage.getItem('lastLocation');
          if (lastLocationStr) {
            try {
              const lastLocation = JSON.parse(lastLocationStr);
              // Only use if it's recent (within the last hour)
              const savedAt = new Date(lastLocation.savedAt);
              const now = new Date();
              const diff = now.getTime() - savedAt.getTime();
              const hourInMs = 60 * 60 * 1000;
              
              if (diff < hourInMs) {
                setCurrentLocation({
                  coords: {
                    latitude: lastLocation.latitude,
                    longitude: lastLocation.longitude,
                    accuracy: lastLocation.accuracy,
                    altitude: lastLocation.altitude || null,
                    altitudeAccuracy: lastLocation.altitudeAccuracy || null,
                    heading: lastLocation.heading || null,
                    speed: lastLocation.speed || null,
                  },
                  timestamp: lastLocation.timestamp,
                  batteryLevel: lastLocation.batteryLevel,
                  isMoving: lastLocation.isMoving
                });
              }
            } catch (error) {
              console.error('Failed to parse last location from storage:', error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to check background task status:', error);
      }
    };
    
    checkBackgroundTaskStatus();
  }, [setTrackingStatus, setCurrentLocation]);

  // Check battery level periodically
  useEffect(() => {
    let batterySubscription: { remove: () => void } | null = null;
    let batteryCheckInterval: NodeJS.Timeout | null = null;

    const checkBatteryLevel = async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        // Convert 0-1 to 0-100
        const batteryPercent = Math.round(level * 100);
        setBatteryLevel(batteryPercent);
        return batteryPercent;
      } catch (error) {
        console.error('Failed to get battery level:', error);
        return null;
      }
    };

    const setupBatteryMonitoring = async () => {
      // Initial check
      await checkBatteryLevel();
      
      // Subscribe to battery updates
      batterySubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
        const batteryPercent = Math.round(batteryLevel * 100);
        setBatteryLevel(batteryPercent);
      });
      
      // Also check every minute as a fallback
      batteryCheckInterval = setInterval(checkBatteryLevel, 60000);
    };

    if (trackingStatus === 'active') {
      setupBatteryMonitoring();
    }

    return () => {
      if (batterySubscription) {
        batterySubscription.remove();
      }
      if (batteryCheckInterval) {
        clearInterval(batteryCheckInterval);
      }
    };
  }, [trackingStatus, setBatteryLevel]);

  // Update tracking interval based on battery level
  useEffect(() => {
    const updateTrackingInterval = async () => {
      if (trackingStatus !== "active") return;

      try {
        const level = await Battery.getBatteryLevelAsync();
        const batteryPercent = Math.round(level * 100);
        // Check if device is charging
        const chargingState = await Battery.getBatteryStateAsync();
        const isCharging = chargingState === 2 || chargingState === 3; // CHARGING or FULL

        // Get optimal interval from server
        const optimalInterval = await getOptimalUpdateInterval(
          batteryPercent,
          isCharging
        );

        // Only update if significantly different
        if (Math.abs(optimalInterval - intervalMs) > 5000) {
          setIntervalMs(optimalInterval);

          // Restart tracking with new interval if active
          if (trackingStatus === "active") {
            if (backgroundTrackingEnabled || enableBackgroundTracking) {
              // Stop and restart background tracking with new interval
              // await stopBackgroundLocationTracking();
              // await startBackgroundLocationTracking({
              //   timeInterval: optimalInterval,
              //   distanceInterval,
              //   accuracy: accuracyMap[locationAccuracy]
              // });
            } else if (locationSubscription.current) {
              // Or restart foreground tracking
              await stopLocationTracking();
              await startLocationTracking();
            }
          }
        }
      } catch (error) {
        console.error("Failed to update tracking interval:", error);
      }
    };

    if (trackingStatus === "active") {
      updateTrackingInterval();
    }
  }, [
    trackingStatus,
    getOptimalUpdateInterval,
    intervalMs,
    backgroundTrackingEnabled,
    enableBackgroundTracking,
    locationAccuracy,
    distanceInterval,
  ]);

  // Handle app state changes with debouncing
  useEffect(() => {
    let debounceTimeout: NodeJS.Timeout | null = null;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // Skip if no real change
      if (appStateRef.current === nextAppState) return;

      // Clear any pending debounce
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      // Debounce the AppState change handling to prevent rapid firing
      debounceTimeout = setTimeout(async () => {
        console.log(
          `[LocationTracking] AppState changed: ${appStateRef.current} -> ${nextAppState}`
        );

        // App has gone to the background
        if (
          (appStateRef.current === "active" || appStateRef.current === null) &&
          nextAppState.match(/inactive|background/)
        ) {
          // Only log once when entering background
          console.log("[LocationTracking] App has gone to the background");

          // If we were tracking in active state
          if (trackingStatus === TrackingStatus.ACTIVE) {
            // If background tracking is enabled, ensure background tracking is active
            if (backgroundTrackingEnabled || enableBackgroundTracking) {
              const isActive = await isBackgroundLocationTrackingActive();
              if (!isActive) {
                // await startBackgroundLocationTracking({
                //   timeInterval: intervalMs,
                //   distanceInterval,
                //   accuracy: accuracyMap[locationAccuracy]
                // });
              }
            } else {
              // Otherwise pause tracking
              setTrackingStatus(TrackingStatus.PAUSED);
              await stopLocationTracking();
            }
          }
        }
        // App has come to the foreground
        else if (
          appStateRef.current?.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          // Only log once when entering foreground
          console.log("[LocationTracking] App has come to the foreground");

          // Check for background tracking status
          if (backgroundTrackingEnabled || enableBackgroundTracking) {
            const isActive = await isBackgroundLocationTrackingActive();
            if (isActive) {
              setTrackingStatus(TrackingStatus.ACTIVE);

              // Check for the last saved location from background task
              const lastLocationStr = await AsyncStorage.getItem(
                "lastLocation"
              );
              if (lastLocationStr) {
                try {
                  const lastLocation = JSON.parse(lastLocationStr);
                  setCurrentLocation({
                    coords: {
                      latitude: lastLocation.latitude,
                      longitude: lastLocation.longitude,
                      accuracy: lastLocation.accuracy,
                      altitude: lastLocation.altitude || null,
                      altitudeAccuracy: lastLocation.altitudeAccuracy || null,
                      heading: lastLocation.heading || null,
                      speed: lastLocation.speed || null,
                    },
                    timestamp: lastLocation.timestamp,
                    batteryLevel: lastLocation.batteryLevel,
                    isMoving: lastLocation.isMoving,
                  });
                } catch (error) {
                  console.error(
                    "Failed to parse last location from storage:",
                    error
                  );
                }
              }
            }
          }
          // If we were previously tracking in foreground, resume
          else if (trackingStatus === TrackingStatus.PAUSED) {
            setTrackingStatus(TrackingStatus.ACTIVE);
            await startLocationTracking();
          }
        }

        // Update ref
        appStateRef.current = nextAppState;
      }, 300); // 300ms debounce
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription.remove();
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [
    trackingStatus,
    backgroundTrackingEnabled,
    enableBackgroundTracking,
    setTrackingStatus,
    intervalMs,
    distanceInterval,
    locationAccuracy,
    setCurrentLocation,
  ]);

  // Request location permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const { status: foregroundStatus } =
        await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(foregroundStatus);

      if (foregroundStatus !== "granted") {
        throw new Error("Location permission not granted");
      }

      // Request background permissions if needed
      if (enableBackgroundTracking || backgroundTrackingEnabled) {
        const { status: backgroundStatus } =
          await Location.requestBackgroundPermissionsAsync();

        if (backgroundStatus !== "granted") {
          console.warn("Background location permission not granted");
        }
      }

      return true;
    } catch (error: any) {
      const errorMsg =
        error.message || "Failed to request location permissions";
      setError(errorMsg);
      onError?.(errorMsg);
      return false;
    }
  }, [enableBackgroundTracking, backgroundTrackingEnabled, setError, onError]);

  // Process location updates
  const processLocation = useCallback(
    (location: Location.LocationObject): LocationType => {
      const { coords, timestamp } = location;

      // Format as our location type with the correct structure
      const processedLocation: LocationType = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        altitude: coords.altitude || null,
        altitudeAccuracy: coords.altitudeAccuracy || null,
        heading: coords.heading || null,
        speed: coords.speed || null,
        timestamp: new Date(timestamp).toISOString(),
        batteryLevel: undefined, // Will be added by the server
        isMoving: coords.speed !== null && coords.speed > 0.5, // Consider moving if speed > 0.5 m/s
      };

      // Create enhanced location with coords property for setCurrentLocation
      const enhancedLocation = {
        coords: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy || 0,
          altitude: coords.altitude || null,
          altitudeAccuracy: coords.altitudeAccuracy || null,
          heading: coords.heading || null,
          speed: coords.speed || null,
        },
        timestamp: timestamp,
        batteryLevel: processedLocation.batteryLevel,
        isMoving: processedLocation.isMoving
      };

      // Update stores with correctly structured enhanced location
      setCurrentLocation(enhancedLocation);

      // Add to history if user ID exists
      if (user && user.id) {
        const historyItem: LocationHistory = {
          ...processedLocation,
          id: Date.now(),
          userId: parseInt(user.id),
          sessionId: Date.now().toString(), // Generate a session ID
          startTime: Date.now(), // Use current timestamp as start time
          locations: [processedLocation], // Include the current location in the history
        };

        // Convert the history item for proper type handling
        const historyItemForStore = {
          coords: {
            latitude: processedLocation.latitude,
            longitude: processedLocation.longitude,
            accuracy: processedLocation.accuracy || 0,
            altitude: processedLocation.altitude || null,
            altitudeAccuracy: null, // Not usually available in our history format
            heading: processedLocation.heading || null,
            speed: processedLocation.speed || null,
          },
          timestamp: typeof processedLocation.timestamp === 'string' 
            ? new Date(processedLocation.timestamp).getTime() 
            : processedLocation.timestamp || Date.now(),
          id: historyItem.id,
          userId: historyItem.userId,
          sessionId: historyItem.sessionId,
          startTime: historyItem.startTime,
          batteryLevel: processedLocation.batteryLevel,
          isMoving: processedLocation.isMoving
        };

        addLocationToHistory(historyItemForStore);
      }

      // Send to server if connected
      if (isConnected) {
        emitLocation(processedLocation);
      }

      // Call callback if provided
      onLocationUpdate?.(processedLocation);

      return processedLocation;
    },
    [
      setCurrentLocation,
      addLocationToHistory,
      user,
      isConnected,
      emitLocation,
      onLocationUpdate,
    ]
  );

  // Start location tracking
  const startLocationTracking = useCallback(async (): Promise<boolean> => {
    try {
      // Check permissions first
      const hasPermission = await requestPermissions();

      if (!hasPermission) {
        throw new Error("Location permissions not granted");
      }

      // Set status to active
      setTrackingStatus(TrackingStatus.ACTIVE);

      // If background tracking is enabled, use the background task
      if (backgroundTrackingEnabled || enableBackgroundTracking) {
        // Store user token and ID in storage for background task
        if (user?.id) {
          await AsyncStorage.setItem("userId", user.id.toString());
        }

        // Check if task is already running
        const isActive = await isBackgroundLocationTrackingActive();
        if (!isActive) {
          // Start background tracking
          // const result = await startBackgroundLocationTracking({
          //   timeInterval: intervalMs,
          //   distanceInterval,
          //   accuracy: accuracyMap[locationAccuracy]
          // });
          // if (!result) {
          //   throw new Error('Failed to start background location tracking');
          // }
        }

        return true;
      }

      // Otherwise, use foreground tracking

      // Stop any existing subscription
      if (locationSubscription.current) {
        await locationSubscription.current.remove();
      }

      // Set accuracy based on current state
      const accuracy = accuracyMap[locationAccuracy];

      // Start watching location
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy,
          timeInterval: intervalMs,
          distanceInterval,
        },
        (location) => {
          processLocation(location);
        }
      );

      return true;
    } catch (error: any) {
      const errorMsg = error.message || "Failed to start location tracking";
      setError(errorMsg);
      setTrackingStatus(TrackingStatus.INACTIVE);
      onError?.(errorMsg);
      return false;
    }
  }, [
    requestPermissions,
    processLocation,
    intervalMs,
    distanceInterval,
    locationAccuracy,
    setTrackingStatus,
    setError,
    onError,
    backgroundTrackingEnabled,
    enableBackgroundTracking,
    user,
  ]);

  // Stop location tracking
  const stopLocationTracking = useCallback(async (): Promise<boolean> => {
    try {
      // If background tracking is enabled, stop the background task
      if (backgroundTrackingEnabled || enableBackgroundTracking) {
        // await stopBackgroundLocationTracking();
      }

      // Also stop foreground tracking if active
      if (locationSubscription.current) {
        await locationSubscription.current.remove();
        locationSubscription.current = null;
      }

      if (trackingStatus !== TrackingStatus.PAUSED) {
        setTrackingStatus(TrackingStatus.INACTIVE);
      }

      return true;
    } catch (error: any) {
      const errorMsg = error.message || "Failed to stop location tracking";
      setError(errorMsg);
      onError?.(errorMsg);
      return false;
    }
  }, [
    trackingStatus,
    setTrackingStatus,
    setError,
    onError,
    backgroundTrackingEnabled,
    enableBackgroundTracking,
  ]);

  // Get current location once
  const getCurrentLocation = useCallback(async (): Promise<Location.LocationObject | null> => {
    try {
      // Check permissions first
      const hasPermission = await requestPermissions();
      
      if (!hasPermission) {
        throw new Error('Location permissions not granted');
      }
      
      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: accuracyMap[locationAccuracy]
      });
      
      // Create the enhanced location
      const enhancedLocation = {
        coords: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || 0,
          altitude: location.coords.altitude || null,
          altitudeAccuracy: location.coords.altitudeAccuracy || null,
          heading: location.coords.heading || null,
          speed: location.coords.speed || null,
        },
        timestamp: location.timestamp
      };
      
      // Process and update state
      processLocation(location);
      
      // Return the original location object for compatibility
      return location;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to get current location';
      setError(errorMsg);
      onError?.(errorMsg);
      return null;
    }
  }, [requestPermissions, locationAccuracy, processLocation, setError, onError]);

  // Change location accuracy
  const changeAccuracy = useCallback(async (accuracy: LocationAccuracy): Promise<boolean> => {
    try {
      setLocationAccuracy(accuracy);
      
      // Restart tracking if active
      if (trackingStatus === 'active') {
        await stopLocationTracking();
        await startLocationTracking();
      }
      
      return true;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to change location accuracy';
      setError(errorMsg);
      onError?.(errorMsg);
      return false;
    }
  }, [trackingStatus, startLocationTracking, stopLocationTracking, setLocationAccuracy, setError, onError]);

  // Auto-start tracking if requested
  useEffect(() => {
    if (autoStart) {
      startLocationTracking();
    }
    
    return () => {
      // Cleanup on unmount - only stop foreground tracking, not background
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, [autoStart, startLocationTracking]);

  return {
    startTracking: startLocationTracking,
    stopTracking: stopLocationTracking,
    getCurrentLocation,
    changeAccuracy,
    trackingStatus,
    permissionStatus,
    intervalMs,
    isBackgroundTracking: useCallback(async () => {
      return await isBackgroundLocationTrackingActive();
    }, [])
  };
} 