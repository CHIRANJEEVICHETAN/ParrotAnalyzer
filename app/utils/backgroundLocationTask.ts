import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Location as LocationType } from '../types/liveTracking';
import axios from 'axios';
import * as SecureStore from "expo-secure-store";
import * as Network from "expo-network";
import io from "socket.io-client";
import { Alert, AppState, Platform } from "react-native";
import { TrackingStatus } from '../types/liveTracking';
import { createEnhancedLocation } from './locationUtils';
import EventEmitter from './EventEmitter';

// Task name for background location updates
export const BACKGROUND_LOCATION_TASK = "background-location-tracking";

// Queue for storing locations when offline
const LOCATION_QUEUE_KEY = "offline-location-queue";
// Key for storing the last update time
const LAST_UPDATE_TIME_KEY = "last-location-update-time";
// Minimum time between updates in milliseconds (30 seconds instead of 1 minute)
const MIN_UPDATE_INTERVAL = 30000;
// Maximum queue size to prevent excessive memory usage
const MAX_QUEUE_SIZE = 10;
// Socket connection retry interval
const SOCKET_RECONNECT_INTERVAL = 60000; // 1 minute

// Socket instance for background tracking
let socketInstance: any = null;
let socketReconnectInterval: NodeJS.Timeout | null = null;

// Maximum retries for starting the service if app is temporarily inactive
const MAX_START_RETRIES = 2;
const RETRY_DELAY_MS = 2000; // 2 seconds

// Add these constants near the top of the file with other constants
const HEALTH_CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes
const LAST_HEALTH_CHECK_KEY = 'last_location_health_check';
const HEALTH_CHECK_THRESHOLD = 30 * 60 * 1000; // 30 minutes - if no updates for this long, restart tracking
const TRACKING_RESTART_ATTEMPTS_KEY = 'tracking_restart_attempts';
const MAX_RESTART_ATTEMPTS = 3; // Maximum number of auto-restart attempts within RESTART_PERIOD
const RESTART_PERIOD = 24 * 60 * 60 * 1000; // 24 hours - reset restart counter after this period
let healthCheckTimer: NodeJS.Timeout | null = null;

// Add these additional constants for adaptive tracking
const BATTERY_ADAPTIVE_TRACKING_KEY = 'battery_adaptive_tracking';
const ACTIVITY_ADAPTIVE_TRACKING_KEY = 'activity_adaptive_tracking';
const STATIONARY_ADAPTIVE_TRACKING_KEY = 'stationary_adaptive_tracking';

// Battery level thresholds for adaptive tracking
const BATTERY_CRITICAL = 15; // 15% - critical battery level
const BATTERY_LOW = 30;      // 30% - low battery level
const BATTERY_MEDIUM = 50;   // 50% - medium battery level

// Update intervals based on battery level (in milliseconds)
const INTERVAL_BATTERY_CRITICAL = 5 * 60 * 1000;  // 5 minutes
const INTERVAL_BATTERY_LOW = 2 * 60 * 1000;       // 2 minutes
const INTERVAL_BATTERY_MEDIUM = 60 * 1000;        // 1 minute
const INTERVAL_BATTERY_HIGH = 30 * 1000;          // 30 seconds

// Update intervals based on activity (in milliseconds)
const INTERVAL_STATIONARY = 3 * 60 * 1000;        // 3 minutes
const INTERVAL_WALKING = 45 * 1000;               // 45 seconds
const INTERVAL_RUNNING = 30 * 1000;               // 30 seconds
const INTERVAL_AUTOMOTIVE = 20 * 1000;            // 20 seconds

// Movement detection thresholds
const MOVEMENT_SIGNIFICANT = 20;  // 20 meters
const MOVEMENT_MINIMAL = 5;       // 5 meters

// Stationary detection
const STATIONARY_TIMEOUT = 5 * 60 * 1000;  // 5 minutes without significant movement
const LAST_SIGNIFICANT_MOVEMENT_KEY = 'last_significant_movement';

// Add these constants
const MEMORY_CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes
const LOCATION_CACHE_SIZE = 100; // Maximum number of locations to store in memory
const LOCATION_HISTORY_KEY = 'location_history';
let memoryCheckTimer: NodeJS.Timeout | null = null;
let locationCache: any[] = [];

/**
 * Define the background location task
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Background location task error:", error);
    // Log the error but don't terminate the task
    return;
  }

  if (!data) {
    console.warn("No data received in background location task");
    return;
  }

  try {
    // Extract the locations from the data
    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations || locations.length === 0) {
      console.warn("Empty locations array received in background task");
      return;
    }

    console.log(
      `Background location update received (${locations.length} locations)`
    );

    const location = locations[0];
    
    // Update movement status for adaptive tracking
    await updateMovementStatus(location);
    
    const { coords, timestamp } = location;

    // Log basic location data for debugging
    console.log(
      `Location data: ${coords.latitude}, ${coords.longitude}, accuracy: ${coords.accuracy}m`
    );

    // RATE LIMITING: Check if enough time has passed since the last update
    const now = Date.now();
    const lastUpdateTimeStr = await AsyncStorage.getItem(LAST_UPDATE_TIME_KEY);
    const lastUpdateTime = lastUpdateTimeStr ? parseInt(lastUpdateTimeStr) : 0;

    if (now - lastUpdateTime < MIN_UPDATE_INTERVAL) {
      console.log(
        `Rate limiting - skipping update (${Math.round(
          (now - lastUpdateTime) / 1000
        )}s since last update)`
      );

      // Only store significant location changes to prevent queue bloat
      const lastLocationStr = await AsyncStorage.getItem("lastLocation");
      if (lastLocationStr) {
        const lastLocation = JSON.parse(lastLocationStr);
        // Calculate distance between this location and the last one
        const distance = calculateDistance(
          coords.latitude,
          coords.longitude,
          lastLocation.latitude,
          lastLocation.longitude
        );

        // Only queue if movement is significant (more than 20 meters)
        if (distance > 20) {
          console.log(
            `Significant movement detected: ${distance.toFixed(
              1
            )}m, queueing update`
          );
          await manageLocationQueue(location);
        } else {
          console.log(
            `Insignificant movement: ${distance.toFixed(
              1
            )}m, not queueing location`
          );
        }
      } else {
        // No previous location, go ahead and queue this one
        console.log("No previous location found, queueing this one");
        await manageLocationQueue(location);
      }
      return;
    }

    // Process the location update normally
    console.log("Processing background location update normally");

    // Get the auth token
    const token = await getAuthToken();
    if (!token) {
      console.warn(
        "No authentication token available for background location updates"
      );
      await manageLocationQueue(location);
      return;
    }

    // Get user ID from storage
    const userDataStr = await AsyncStorage.getItem("user_data");
    const userData = userDataStr ? JSON.parse(userDataStr) : null;
    const userId = userData?.id;

    if (!userId) {
      console.warn("No user ID available for background location updates");
      await manageLocationQueue(location);
      return;
    }

    // Get current battery level for the location update
    const batteryLevel = await getBatteryLevel();

    console.log(`User ID: ${userId}, Battery: ${batteryLevel}%`);

    // Format location data
    const locationData: LocationType = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      altitude: coords.altitude,
      heading: coords.heading,
      speed: coords.speed,
      timestamp: new Date(timestamp).toISOString(),
      batteryLevel,
      isMoving: coords.speed !== null && coords.speed > 0.5,
      isBackground: true, // Mark as background update
      userId: userId, // Include user ID
    };

    // Get API URL from storage
    const apiUrl =
      process.env.EXPO_PUBLIC_API_URL ||
      (await AsyncStorage.getItem("apiUrl")) ||
      "http://localhost:3000";

    // Check network connectivity
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      console.log("No network connection, queueing location update");
      await manageLocationQueue(location);
      return;
    }

    // Try to send the location to the server via socket first
    const socketConnected = await ensureSocketConnection(apiUrl, token, userId);

    // If socket is connected, send location update via socket
    if (socketConnected && socketInstance) {
      try {
        // Validate and sanitize location data before sending
        const validatedLocationData: LocationType = {
          latitude: typeof coords.latitude === "number" ? coords.latitude : 0,
          longitude:
            typeof coords.longitude === "number" ? coords.longitude : 0,
          accuracy:
            typeof coords.accuracy === "number" ? coords.accuracy : null,
          altitude:
            typeof coords.altitude === "number" ? coords.altitude : null,
          heading: typeof coords.heading === "number" ? coords.heading : null,
          speed: typeof coords.speed === "number" ? coords.speed : null,
          timestamp: new Date(timestamp).toISOString(),
          batteryLevel: typeof batteryLevel === "number" ? batteryLevel : 100,
          isMoving: typeof coords.speed === "number" && coords.speed > 0.5,
          isBackground: true,
          userId: userId,
        };

        socketInstance.emit("location:update", validatedLocationData);
        console.log("Background location update sent via socket");

        // Update the last update time
        await AsyncStorage.setItem(LAST_UPDATE_TIME_KEY, now.toString());

        // Save to AsyncStorage for use when app resumes
        await AsyncStorage.setItem(
          "lastLocation",
          JSON.stringify({
            ...validatedLocationData,
            savedAt: new Date().toISOString(),
          })
        );
      } catch (socketError) {
        console.error(
          "Failed to send location via socket, falling back to HTTP:",
          socketError
        );
        // Fall back to HTTP if socket fails
        await sendLocationViaHttp(apiUrl, token, locationData);
      }
    } else {
      // Send via HTTP API if socket is not connected
      await sendLocationViaHttp(apiUrl, token, locationData);
    }

    // Process queued locations if we have a connection
    const queueStr = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
    const queue = queueStr ? JSON.parse(queueStr) : [];

    if (queue.length > 0) {
      // Process queued locations (max 5 at a time)
      await sendQueuedLocations(token, apiUrl, 5);
    }

    // Add to in-memory cache with minimal data for memory efficiency
    const minimalLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: location.timestamp,
      speed: location.coords.speed
    };
    
    // Add to cache with memory limit checking
    locationCache.push(minimalLocation);
    if (locationCache.length > LOCATION_CACHE_SIZE) {
      // Remove oldest entries when cache gets too large
      locationCache = locationCache.slice(-LOCATION_CACHE_SIZE);
    }
  } catch (taskError) {
    console.error("Error in background location task:", taskError);
    // Don't rethrow - we want the task to keep running even if there's an error
  }
});

/**
 * Send location data via HTTP API
 */
async function sendLocationViaHttp(
  apiUrl: string,
  token: string,
  locationData: LocationType
) {
  try {
    // Add log before API calls to help debug
    const formattedData = formatLocationForApi(locationData);

    console.log("Sending location update via HTTP:", {
      latitude: formattedData.latitude,
      longitude: formattedData.longitude,
      isBackground: true,
    });

    await axios.post(
      `${apiUrl}/api/employee-tracking/location`,
      formattedData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Update the last update time
    await AsyncStorage.setItem(LAST_UPDATE_TIME_KEY, Date.now().toString());

    console.log("Background location update sent to server via HTTP");

    // Save to AsyncStorage for use when app resumes
    await AsyncStorage.setItem(
      "lastLocation",
      JSON.stringify({
        ...locationData,
        savedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error("Failed to send background location update via HTTP:", error);
    throw error;
  }
}

/**
 * Ensure socket connection is established and authenticated
 */
async function ensureSocketConnection(
  apiUrl: string,
  token: string,
  userId: string
): Promise<boolean> {
  try {
    // If socket exists and is connected, return true
    if (socketInstance && socketInstance.connected) {
      console.log("Socket already connected for background updates");
      return true;
    }

    // Clear any existing reconnect interval
    if (socketReconnectInterval) {
      clearInterval(socketReconnectInterval);
      socketReconnectInterval = null;
    }

    // Create a new socket connection
    socketInstance = io(apiUrl, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      auth: {
        token: token,
      },
      query: {
        userId: userId,
      },
    });

    // Return a promise that resolves when the socket connects or fails
    return new Promise((resolve) => {
      // Set a timeout in case connection takes too long
      const connectionTimeout = setTimeout(() => {
        console.log("Socket connection timeout in background");
        resolve(false);
      }, 5000);

      // Handle connection
      socketInstance.on("connect", () => {
        console.log("Socket connected for background tracking");
        clearTimeout(connectionTimeout);

        // Set up reconnection interval for maintaining connection
        socketReconnectInterval = setInterval(() => {
          if (socketInstance && !socketInstance.connected) {
            console.log("Attempting to reconnect socket in background");
            socketInstance.connect();
          }
        }, SOCKET_RECONNECT_INTERVAL);

        resolve(true);
      });

      // Handle connection error
      socketInstance.on("connect_error", (error: any) => {
        console.error("Socket connection error in background:", error);
        clearTimeout(connectionTimeout);
        resolve(false);
      });

      // Try to connect
      socketInstance.connect();
    });
  } catch (error) {
    console.error("Error establishing socket connection in background:", error);
    return false;
  }
}

/**
 * Helper to calculate distance between two coordinates in meters
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Manage the location queue to prevent it from growing too large
 */
async function manageLocationQueue(
  location: Location.LocationObject
): Promise<void> {
  try {
    // Get existing queue
    const queueStr = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
    let queue = queueStr ? JSON.parse(queueStr) : [];

    // Format the location data
    const { coords, timestamp } = location;
    const formattedLocation = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      altitude: coords.altitude,
      heading: coords.heading,
      speed: coords.speed,
      timestamp: new Date(timestamp).toISOString(),
      queuedAt: new Date().toISOString(),
    };

    // If queue is at max capacity, replace the oldest entry
    if (queue.length >= MAX_QUEUE_SIZE) {
      // Sort by timestamp to find the oldest
      queue.sort(
        (a: any, b: any) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      // Remove the oldest entry
      queue.shift();
      console.log(
        `Queue at max capacity (${MAX_QUEUE_SIZE}), replaced oldest entry`
      );
    }

    // Add to queue
    queue.push(formattedLocation);

    // Save back to storage
    await AsyncStorage.setItem(LOCATION_QUEUE_KEY, JSON.stringify(queue));

    console.log(`Location queued for later. Queue size: ${queue.length}`);
  } catch (error) {
    console.error("Failed to queue location for later:", error);
  }
}

/**
 * Starts background location tracking with the specified options
 */
export async function startBackgroundLocationTracking(
  options: {
    timeInterval?: number;
    distanceInterval?: number;
    accuracy?: Location.Accuracy;
  },
  retryCount: number = 0
): Promise<boolean> {
  try {
    console.log('Starting background location tracking...');
    
    // Start memory monitoring
    startMemoryMonitoring();
    
    // Check if background permissions are granted
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.error('Background location permission not granted');
      return false;
    }

    // Store tracking configuration for future restarts
    await AsyncStorage.setItem('trackingConfig', JSON.stringify(options));
    
    // Get adaptive parameters if enabled, otherwise use provided options
    const adaptiveTrackingEnabled = await AsyncStorage.getItem(BATTERY_ADAPTIVE_TRACKING_KEY);
    let locationOptions;
    
    if (adaptiveTrackingEnabled === 'true') {
      const adaptiveParams = await getAdaptiveTrackingParams();
      
      locationOptions = {
        accuracy: adaptiveParams.accuracy || options.accuracy || Location.Accuracy.BestForNavigation,
        timeInterval: adaptiveParams.timeInterval || options.timeInterval || 20000,
        distanceInterval: adaptiveParams.distanceInterval || options.distanceInterval || 5,
        foregroundService: {
          notificationTitle: "Parrot Analyzer is tracking your location",
          notificationBody: "To stop tracking, open the app and turn off tracking",
          notificationColor: "#3B82F6"
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        activityType: Location.ActivityType.AutomotiveNavigation,
        deferredUpdatesInterval: 0
      };
      
      console.log(`Using adaptive tracking parameters: interval=${locationOptions.timeInterval}ms, distance=${locationOptions.distanceInterval}m`);
    } else {
      // Use fixed parameters
      locationOptions = {
        accuracy: options.accuracy || Location.Accuracy.BestForNavigation,
        timeInterval: options.timeInterval || 20000,
        distanceInterval: options.distanceInterval || 5,
        foregroundService: {
          notificationTitle: "Parrot Analyzer is tracking your location",
          notificationBody: "To stop tracking, open the app and turn off tracking",
          notificationColor: "#3B82F6"
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        activityType: Location.ActivityType.AutomotiveNavigation,
        deferredUpdatesInterval: 0
      };
      
      console.log(`Using fixed tracking parameters: interval=${locationOptions.timeInterval}ms, distance=${locationOptions.distanceInterval}m`);
    }
    
    // Stop any existing tasks first
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
    
    // Start the location updates task
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, locationOptions);
    
    console.log('Background location tracking task started');
    
    // Store tracking state
    await AsyncStorage.setItem('backgroundTrackingEnabled', 'true');
    await AsyncStorage.setItem('backgroundTrackingStartTime', new Date().toISOString());
    await AsyncStorage.setItem('trackingStatus', TrackingStatus.ACTIVE);

    // On Android, explicitly request location updates via FusedLocationProvider
    if (Platform.OS === 'android') {
      await requestAndroidLocationUpdates();
    }
    
    // Start health check
    startLocationHealthCheck().catch(err => 
      console.error('Failed to start location health check:', err)
    );

    // Emit event for tracking started
    EventEmitter.emit('backgroundTrackingStarted');
    
    return true;
  } catch (error) {
    console.error('Error starting background tracking:', error);
    
    // Retry logic for resilience
    if (retryCount < 2) {
      console.log(`Retrying background tracking start (attempt ${retryCount + 1})...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return startBackgroundLocationTracking(options, retryCount + 1);
    }
    
    return false;
  }
}

/**
 * Stops background location tracking
 */
export async function stopBackgroundLocationTracking(): Promise<boolean> {
  try {
    // Check if task is registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);

    if (isRegistered) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('Background location tracking stopped');
    }
    
    // Stop health check timer
    if (healthCheckTimer) {
      clearInterval(healthCheckTimer);
      healthCheckTimer = null;
      console.log('Location health check stopped');
    }
    
    // Stop memory monitoring
    if (memoryCheckTimer) {
      clearInterval(memoryCheckTimer);
      memoryCheckTimer = null;
      console.log('Memory monitoring stopped');
    }

    // Perform final cleanup
    await performMemoryCleanup();
    
    // Update stored tracking state
    await AsyncStorage.setItem('backgroundTrackingEnabled', 'false');
    
    // Clean up socket
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
    }

    if (socketReconnectInterval) {
      clearInterval(socketReconnectInterval);
      socketReconnectInterval = null;
    }
    
    // Clear references
    locationCache = [];
    
    // Emit event for tracking stopped
    EventEmitter.emit('backgroundTrackingStopped');
    
    return true;
  } catch (error) {
    console.error('Error stopping background tracking:', error);
    return false;
  }
}

/**
 * Checks if background location tracking is currently active
 */
export async function isBackgroundLocationTrackingActive(): Promise<boolean> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    return isRegistered;
  } catch (error) {
    console.error('Error checking if background location tracking is active:', error);
    return false;
  }
}

/**
 * Android-specific function to handle location requests
 */
async function requestAndroidLocationUpdates(): Promise<void> {
  if (Platform.OS !== 'android') return;
  
  try {
    // Ensure location services are enabled
    const hasServicesEnabled = await Location.hasServicesEnabledAsync();
    if (!hasServicesEnabled) {
      console.warn('Location services are not enabled on this device');
      return;
    }
    
    // Get current position to "warm up" the location provider
    await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation
    });
    
    console.log('Successfully initialized Android location provider');
  } catch (error) {
    console.error('Error initializing Android location provider:', error);
  }
}

/**
 * Sets up a periodic location wakeup timer to keep the location provider active
 */
export async function setupLocationWakeupTimer(): Promise<() => void> {
  try {
    // Check if background timer is already set
    const timerExists = await AsyncStorage.getItem('locationWakeupTimerSet');
    if (timerExists === 'true') return () => {};
    
    // Set up a background timer that periodically requests location
    const interval = setInterval(async () => {
      try {
        const isActive = await isBackgroundLocationTrackingActive();
        if (isActive) {
          console.log('Location wakeup timer triggered');
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation
          });
          
          if (location) {
            // Store the last location
            await AsyncStorage.setItem('lastLocation', JSON.stringify({
              ...createEnhancedLocation(location),
              timestamp: new Date().toISOString()
            }));
          }
        }
      } catch (err) {
        console.log('Wakeup location error:', err);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
    
    await AsyncStorage.setItem('locationWakeupTimerSet', 'true');
    
    return () => {
      clearInterval(interval);
      AsyncStorage.removeItem('locationWakeupTimerSet');
    };
  } catch (error) {
    console.error('Error setting up location wakeup timer:', error);
    return () => {};
  }
}

/**
 * Get the current battery level
 */
async function getBatteryLevel(): Promise<number> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    // Ensure level is a valid number between 0-100
    if (typeof level !== "number" || isNaN(level)) {
      console.log("Invalid battery level value:", level);
      return 100; // Default fallback
    }
    // Convert to percentage and ensure it's an integer
    return Math.round(level * 100);
  } catch (error) {
    console.error("Failed to get battery level:", error);
    return 100; // Default to 100% if we can't get the battery level
  }
}

/**
 * Send queued locations to the server
 */
async function sendQueuedLocations(
  token: string,
  apiUrl: string,
  maxLocations: number = 5
): Promise<void> {
  try {
    // Get the queue
    const queueStr = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
    if (!queueStr) return;

    const queue = JSON.parse(queueStr);
    if (queue.length === 0) return;

    console.log(
      `Processing location queue (${queue.length} items, sending max ${maxLocations})`
    );

    // Get battery level
    const batteryLevel = await getBatteryLevel();

    // Get user ID
    const userDataStr = await AsyncStorage.getItem("user_data");
    const userData = userDataStr ? JSON.parse(userDataStr) : null;
    const userId = userData?.id;

    if (!userId) {
      console.warn("No user ID available for queued locations");
      return;
    }

    // Check if socket is connected
    const socketConnected = socketInstance && socketInstance.connected;

    // Process only a limited number of locations per call
    const locationsToProcess = queue.slice(0, maxLocations);
    const remainingQueue = queue.slice(maxLocations);
    const failedIndices: number[] = [];

    for (let i = 0; i < locationsToProcess.length; i++) {
      const location = locationsToProcess[i];

      try {
        // Add user ID and battery level to the location
        const locationWithUser = {
          ...location,
          userId: userId,
          batteryLevel: typeof batteryLevel === "number" ? batteryLevel : 100,
          isBackground: true,
        };

        // Add log before API calls to help debug
        const formattedData = formatLocationForApi(locationWithUser);

        // Try to send via socket first if connected
        if (socketConnected) {
          try {
            socketInstance.emit("location:update", formattedData);
            console.log("Queued location sent via socket:", i);
            continue; // Skip HTTP if socket succeeded
          } catch (socketError) {
            console.error(
              "Failed to send queued location via socket:",
              socketError
            );
            // Fall back to HTTP
          }
        }

        // Send via HTTP if socket failed or not connected
        await axios.post(
          `${apiUrl}/api/employee-tracking/location`,
          formattedData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        console.log("Queued location sent via HTTP:", i);
      } catch (error) {
        console.error(`Failed to send queued location at index ${i}:`, error);
        failedIndices.push(i);
      }
    }

    // Create new queue with failed locations plus remaining locations
    const newQueue = [
      ...failedIndices.map((index) => locationsToProcess[index]),
      ...remainingQueue,
    ];

    if (newQueue.length > 0) {
      await AsyncStorage.setItem(LOCATION_QUEUE_KEY, JSON.stringify(newQueue));
      console.log(`Queue updated: ${newQueue.length} locations remaining`);
    } else {
      // Clear the queue if all were successful
      await AsyncStorage.removeItem(LOCATION_QUEUE_KEY);
      console.log("All processed queued locations sent successfully");
    }
  } catch (error) {
    console.error("Failed to process queued locations:", error);
  }
}

// Before sending location, ensure we have a valid token
async function getAuthToken(): Promise<string | null> {
  try {
    // First try SecureStore which is more secure
    let token = null;

    try {
      if (SecureStore) {
        token = await SecureStore.getItemAsync("auth_token");
        if (token) {
          console.log("Using token from SecureStore");
          return token;
        }
      }
    } catch (secureError) {
      console.log("SecureStore not available or error:", secureError);
    }

    // Fallback to AsyncStorage
    token = await AsyncStorage.getItem("auth_token");
    if (token) {
      console.log("Using token from AsyncStorage");
      return token;
    }

    // Try from refresh token if we have it
    const refreshToken = await AsyncStorage.getItem("refresh_token");
    if (refreshToken) {
      const apiUrl =
        process.env.EXPO_PUBLIC_API_URL ||
        (await AsyncStorage.getItem("apiUrl")) ||
        "http://localhost:3000";

      // Try to refresh the token
      const response = await axios.post(`${apiUrl}/api/auth/refresh-token`, {
        refreshToken,
      });

      if (response.data && response.data.accessToken) {
        // Save the new token
        await AsyncStorage.setItem("auth_token", response.data.accessToken);
        try {
          if (SecureStore) {
            await SecureStore.setItemAsync(
              "auth_token",
              response.data.accessToken
            );
          }
        } catch (secureError) {
          console.log("SecureStore not available for saving:", secureError);
        }

        console.log("Using refreshed token");
        return response.data.accessToken;
      }
    }

    console.log("No authentication token available");
    return null;
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
}

// Check and fix coordinates function
function formatLocationForApi(locationData: LocationType) {
  const longitude =
    typeof locationData.longitude === "number" ? locationData.longitude : 0;
  const latitude =
    typeof locationData.latitude === "number" ? locationData.latitude : 0;

  // Create properly formatted GeoJSON coordinates
  return {
    ...locationData,
    // Format coordinates as valid GeoJSON
    coordinates: {
      type: "Point",
      coordinates: [longitude, latitude],
    },
    // Keep latitude and longitude as numbers for the backend validation
    latitude: latitude,
    longitude: longitude,
    batteryLevel:
      typeof locationData.batteryLevel === "number"
        ? locationData.batteryLevel
        : 100,
    is_tracking_active: true, // Use backend naming convention instead of trackingStatus
    trackingStatus: "active", // Include both formats for compatibility
    // Include timestamp in consistent format
    timestamp:
      typeof locationData.timestamp === "string"
        ? locationData.timestamp
        : new Date().toISOString(),
    // Make sure userId is included
    userId: locationData.userId,
    // Mark as background update
    isBackground: true,
  };
}

// Clean up socket when app is closed
export function cleanupBackgroundTracking() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  if (socketReconnectInterval) {
    clearInterval(socketReconnectInterval);
    socketReconnectInterval = null;
  }
  
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  
  if (memoryCheckTimer) {
    clearInterval(memoryCheckTimer);
    memoryCheckTimer = null;
  }
  
  // Clear any in-memory caches
  locationCache = [];
  
  console.log('All background tracking resources cleaned up');
}

/**
 * Periodic health check for background location tracking
 * Will restart tracking if no updates have been received for a while
 */
export async function startLocationHealthCheck(): Promise<() => void> {
  // Clear any existing health check timer
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  
  // Record start of health check
  await AsyncStorage.setItem(LAST_HEALTH_CHECK_KEY, Date.now().toString());
  
  console.log('Starting location tracking health check');
  
  // Set up periodic health check
  healthCheckTimer = setInterval(async () => {
    try {
      // Check if tracking is supposed to be active
      const isEnabled = await AsyncStorage.getItem('backgroundTrackingEnabled');
      if (isEnabled !== 'true') {
        console.log('Background tracking not enabled, skipping health check');
        return;
      }
      
      // Check if the task is still running
      const isActive = await isBackgroundLocationTrackingActive();
      if (!isActive) {
        console.log('Background tracking task not active, attempting to restart');
        await attemptTrackingRestart();
        return;
      }
      
      // Check when the last location update was received
      const lastUpdateTimeStr = await AsyncStorage.getItem(LAST_UPDATE_TIME_KEY);
      if (!lastUpdateTimeStr) {
        console.log('No record of last location update, skipping health check');
        return;
      }
      
      const lastUpdateTime = parseInt(lastUpdateTimeStr);
      const now = Date.now();
      
      // If it's been too long since the last update, restart tracking
      if (now - lastUpdateTime > HEALTH_CHECK_THRESHOLD) {
        console.warn(`No location updates for ${Math.round((now - lastUpdateTime) / 60000)} minutes, attempting to restart tracking`);
        await attemptTrackingRestart();
      } else {
        console.log(`Location tracking healthy, last update ${Math.round((now - lastUpdateTime) / 60000)} minutes ago`);
        // Update health check timestamp
        await AsyncStorage.setItem(LAST_HEALTH_CHECK_KEY, now.toString());
      }
    } catch (error) {
      console.error('Error in location health check:', error);
    }
  }, HEALTH_CHECK_INTERVAL);
  
  // Return cleanup function
  return () => {
    if (healthCheckTimer) {
      clearInterval(healthCheckTimer);
      healthCheckTimer = null;
      console.log('Location health check stopped');
    }
  };
}

/**
 * Attempt to restart tracking with rate limiting to prevent excessive restarts
 */
async function attemptTrackingRestart(): Promise<boolean> {
  try {
    // Check restart attempts counter
    const attemptsStr = await AsyncStorage.getItem(TRACKING_RESTART_ATTEMPTS_KEY);
    const attemptsData = attemptsStr ? JSON.parse(attemptsStr) : { count: 0, timestamp: Date.now() };
    
    const now = Date.now();
    
    // Reset counter if it's been more than RESTART_PERIOD since the first attempt
    if (now - attemptsData.timestamp > RESTART_PERIOD) {
      attemptsData.count = 0;
      attemptsData.timestamp = now;
    }
    
    // Abort if we've exceeded max attempts
    if (attemptsData.count >= MAX_RESTART_ATTEMPTS) {
      console.warn(`Maximum restart attempts (${MAX_RESTART_ATTEMPTS}) exceeded within period, aborting auto-restart`);
      
      // Add an event emission for tracking failure
      EventEmitter.emit('trackingAutoRestartFailed', {
        attempts: attemptsData.count,
        since: new Date(attemptsData.timestamp).toISOString()
      });
      
      return false;
    }
    
    // Attempt to restart tracking
    console.log(`Attempting to auto-restart tracking (attempt ${attemptsData.count + 1} of ${MAX_RESTART_ATTEMPTS})`);
    
    // First stop any existing task
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('Stopped existing background location task before restart');
    }
    
    // Get tracking configuration from storage or use defaults
    const configStr = await AsyncStorage.getItem('trackingConfig');
    const config = configStr ? JSON.parse(configStr) : {
      timeInterval: 20000,
      distanceInterval: 5,
      accuracy: Location.Accuracy.BestForNavigation
    };
    
    // Restart tracking
    const success = await startBackgroundLocationTracking(config);
    
    if (success) {
      console.log('Successfully auto-restarted background tracking');
      
      // Reset attempts counter if successful
      await AsyncStorage.setItem(TRACKING_RESTART_ATTEMPTS_KEY, JSON.stringify({
        count: 0,
        timestamp: now
      }));
      
      // Emit event for successful restart
      EventEmitter.emit('trackingAutoRestartSuccess', {
        timestamp: new Date().toISOString()
      });
      
      return true;
    } else {
      console.error('Failed to auto-restart tracking');
      
      // Increment attempts counter
      attemptsData.count++;
      await AsyncStorage.setItem(TRACKING_RESTART_ATTEMPTS_KEY, JSON.stringify(attemptsData));
      
      return false;
    }
  } catch (error) {
    console.error('Error attempting to restart tracking:', error);
    return false;
  }
}

/**
 * Calculate optimal tracking parameters based on battery level, movement, and activity
 */
export async function getAdaptiveTrackingParams(): Promise<{
  timeInterval: number;
  distanceInterval: number;
  accuracy: Location.Accuracy;
}> {
  try {
    // Default values
    const defaultParams = {
      timeInterval: 30000,  // 30 seconds
      distanceInterval: 10, // 10 meters
      accuracy: Location.Accuracy.Balanced
    };
    
    // Check if adaptive tracking is enabled
    const batteryAdaptive = await AsyncStorage.getItem(BATTERY_ADAPTIVE_TRACKING_KEY);
    const activityAdaptive = await AsyncStorage.getItem(ACTIVITY_ADAPTIVE_TRACKING_KEY);
    const stationaryAdaptive = await AsyncStorage.getItem(STATIONARY_ADAPTIVE_TRACKING_KEY);
    
    // If all adaptive features are disabled, return default params
    if (batteryAdaptive !== 'true' && activityAdaptive !== 'true' && stationaryAdaptive !== 'true') {
      return defaultParams;
    }
    
    // Initialize with default params
    let params = { ...defaultParams };
    
    // Get battery level
    const batteryLevel = await getBatteryLevel();
    
    // Get last known activity and movement
    const lastLocationStr = await AsyncStorage.getItem('lastLocation');
    const lastMovementStr = await AsyncStorage.getItem(LAST_SIGNIFICANT_MOVEMENT_KEY);
    const lastMovementTime = lastMovementStr ? parseInt(lastMovementStr) : 0;
    const now = Date.now();
    
    // Check if we're stationary
    const isStationary = now - lastMovementTime > STATIONARY_TIMEOUT;
    
    // Adapt based on battery level if enabled
    if (batteryAdaptive === 'true') {
      if (batteryLevel <= BATTERY_CRITICAL) {
        params.timeInterval = INTERVAL_BATTERY_CRITICAL;
        params.distanceInterval = MOVEMENT_SIGNIFICANT;
        params.accuracy = Location.Accuracy.Lowest;
        console.log(`Battery critical (${batteryLevel}%), using power saving settings`);
      } else if (batteryLevel <= BATTERY_LOW) {
        params.timeInterval = INTERVAL_BATTERY_LOW;
        params.distanceInterval = MOVEMENT_MINIMAL;
        params.accuracy = Location.Accuracy.Low;
        console.log(`Battery low (${batteryLevel}%), reducing tracking frequency`);
      } else if (batteryLevel <= BATTERY_MEDIUM) {
        params.timeInterval = INTERVAL_BATTERY_MEDIUM;
        params.distanceInterval = MOVEMENT_MINIMAL;
        params.accuracy = Location.Accuracy.Balanced;
        console.log(`Battery medium (${batteryLevel}%), using balanced settings`);
      } else {
        params.timeInterval = INTERVAL_BATTERY_HIGH;
        params.distanceInterval = 5;
        params.accuracy = Location.Accuracy.High;
        console.log(`Battery good (${batteryLevel}%), using high accuracy`);
      }
    }
    
    // Further adapt based on activity if enabled
    if (activityAdaptive === 'true' && lastLocationStr) {
      try {
        const lastLocation = JSON.parse(lastLocationStr);
        
        // Use speed to infer activity type
        const speed = lastLocation.speed !== null && lastLocation.speed !== undefined 
          ? lastLocation.speed 
          : 0;
        
        // Convert m/s to km/h for easier understanding
        const speedKmh = speed * 3.6;
        
        if (speedKmh >= 20) {
          // Driving/transport
          params.timeInterval = Math.min(params.timeInterval, INTERVAL_AUTOMOTIVE);
          params.distanceInterval = 15; // Larger distance when moving fast
          console.log(`Fast movement detected (${speedKmh.toFixed(1)} km/h), using vehicle settings`);
        } else if (speedKmh >= 5) {
          // Running/cycling
          params.timeInterval = Math.min(params.timeInterval, INTERVAL_RUNNING);
          params.distanceInterval = 10;
          console.log(`Moderate movement detected (${speedKmh.toFixed(1)} km/h), using running/cycling settings`);
        } else if (speedKmh >= 1) {
          // Walking
          params.timeInterval = Math.min(params.timeInterval, INTERVAL_WALKING);
          params.distanceInterval = 5;
          console.log(`Slow movement detected (${speedKmh.toFixed(1)} km/h), using walking settings`);
        }
      } catch (e) {
        console.error('Error parsing last location for activity detection:', e);
      }
    }
    
    // Adapt based on stationary detection if enabled
    if (stationaryAdaptive === 'true' && isStationary) {
      // If we've been stationary for a while, drastically reduce updates
      params.timeInterval = Math.max(params.timeInterval, INTERVAL_STATIONARY);
      params.distanceInterval = MOVEMENT_SIGNIFICANT;
      params.accuracy = Location.Accuracy.Balanced;
      console.log(`Stationary for ${Math.round((now - lastMovementTime) / 60000)} minutes, reducing updates`);
    }
    
    console.log(`Adaptive tracking params: interval=${params.timeInterval}ms, distance=${params.distanceInterval}m, accuracy=${params.accuracy}`);
    return params;
  } catch (error) {
    console.error('Error calculating adaptive tracking params:', error);
    return {
      timeInterval: 30000,
      distanceInterval: 10,
      accuracy: Location.Accuracy.Balanced
    };
  }
}

/**
 * Update the movement status based on new location
 */
async function updateMovementStatus(newLocation: Location.LocationObject): Promise<boolean> {
  try {
    const lastLocationStr = await AsyncStorage.getItem('lastLocation');
    if (!lastLocationStr) {
      // First location, record it as movement
      await AsyncStorage.setItem(LAST_SIGNIFICANT_MOVEMENT_KEY, Date.now().toString());
      return true;
    }
    
    try {
      const lastLocation = JSON.parse(lastLocationStr);
      
      // Calculate distance from last location
      const distance = calculateDistance(
        newLocation.coords.latitude,
        newLocation.coords.longitude,
        lastLocation.latitude,
        lastLocation.longitude
      );
      
      // If significant movement detected, update last movement time
      if (distance > MOVEMENT_SIGNIFICANT) {
        await AsyncStorage.setItem(LAST_SIGNIFICANT_MOVEMENT_KEY, Date.now().toString());
        console.log(`Significant movement detected: ${distance.toFixed(1)}m`);
        return true;
      }
      
      return false;
    } catch (e) {
      console.error('Error parsing last location for movement detection:', e);
      return false;
    }
  } catch (error) {
    console.error('Error updating movement status:', error);
    return false;
  }
}

// Add new function to toggle adaptive tracking settings
export async function toggleAdaptiveTracking(
  type: 'battery' | 'activity' | 'stationary', 
  enabled: boolean
): Promise<boolean> {
  try {
    const key = type === 'battery' 
      ? BATTERY_ADAPTIVE_TRACKING_KEY 
      : type === 'activity'
        ? ACTIVITY_ADAPTIVE_TRACKING_KEY
        : STATIONARY_ADAPTIVE_TRACKING_KEY;
    
    await AsyncStorage.setItem(key, enabled ? 'true' : 'false');
    console.log(`${type} adaptive tracking ${enabled ? 'enabled' : 'disabled'}`);
    
    // If tracking is currently active, restart it with new settings
    const isTrackingActive = await isBackgroundLocationTrackingActive();
    if (isTrackingActive) {
      const configStr = await AsyncStorage.getItem('trackingConfig');
      const config = configStr ? JSON.parse(configStr) : {};
      
      console.log(`Restarting tracking with updated adaptive settings`);
      await stopBackgroundLocationTracking();
      await startBackgroundLocationTracking(config);
    }
    
    return true;
  } catch (error) {
    console.error(`Error toggling ${type} adaptive tracking:`, error);
    return false;
  }
}

/**
 * Perform memory cleanup to prevent leaks during long tracking sessions
 */
export async function performMemoryCleanup(): Promise<void> {
  try {
    console.log('Performing memory cleanup for tracking...');
    
    // Clear any excessive socket listeners
    if (socketInstance) {
      // Remove any duplicate listeners
      socketInstance.off('connect_error');
      socketInstance.off('disconnect');
      
      // Reconnect with fresh instance if needed
      if (!socketInstance.connected && socketReconnectInterval) {
        clearInterval(socketReconnectInterval);
        socketReconnectInterval = null;
        
        // Only create a new instance if we truly need it
        socketInstance.disconnect();
        socketInstance = null;
      }
    }
    
    // Trim location history in AsyncStorage to prevent storage bloat
    const historyStr = await AsyncStorage.getItem(LOCATION_HISTORY_KEY);
    if (historyStr) {
      try {
        const history = JSON.parse(historyStr);
        if (Array.isArray(history) && history.length > LOCATION_CACHE_SIZE) {
          // Keep only the most recent locations
          const trimmedHistory = history.slice(-LOCATION_CACHE_SIZE);
          await AsyncStorage.setItem(LOCATION_HISTORY_KEY, JSON.stringify(trimmedHistory));
          console.log(`Trimmed location history from ${history.length} to ${trimmedHistory.length} entries`);
        }
      } catch (e) {
        // If parse fails, just remove the corrupted data
        await AsyncStorage.removeItem(LOCATION_HISTORY_KEY);
        console.log('Removed corrupted location history');
      }
    }
    
    // Clear in-memory location cache if it's too large
    if (locationCache.length > LOCATION_CACHE_SIZE) {
      locationCache = locationCache.slice(-LOCATION_CACHE_SIZE);
      console.log(`Trimmed in-memory location cache to ${locationCache.length} entries`);
    }
    
    // Clear any location queue that's too old
    const queueStr = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
    if (queueStr) {
      try {
        const queue = JSON.parse(queueStr);
        if (Array.isArray(queue) && queue.length > 0) {
          // Filter out locations older than 24 hours
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          const freshQueue = queue.filter(item => {
            const timestamp = item.queuedAt ? new Date(item.queuedAt).getTime() : 0;
            return timestamp > oneDayAgo;
          });
          
          if (freshQueue.length < queue.length) {
            await AsyncStorage.setItem(LOCATION_QUEUE_KEY, JSON.stringify(freshQueue));
            console.log(`Removed ${queue.length - freshQueue.length} stale items from location queue`);
          }
        }
      } catch (e) {
        console.error('Error cleaning location queue:', e);
      }
    }
    
    // Force garbage collection by clearing references
    locationCache = [];
    
    console.log('Memory cleanup completed');
  } catch (error) {
    console.error('Error in memory cleanup:', error);
  }
}

// Add this function to start periodic memory cleanup
export function startMemoryMonitoring(): () => void {
  // Clear any existing timer
  if (memoryCheckTimer) {
    clearInterval(memoryCheckTimer);
    memoryCheckTimer = null;
  }
  
  console.log('Starting memory usage monitoring');
  
  // Schedule periodic cleanup
  memoryCheckTimer = setInterval(() => {
    performMemoryCleanup().catch(error => 
      console.error('Error in scheduled memory cleanup:', error)
    );
  }, MEMORY_CHECK_INTERVAL);
  
  // Return cleanup function
  return () => {
    if (memoryCheckTimer) {
      clearInterval(memoryCheckTimer);
      memoryCheckTimer = null;
      console.log('Memory monitoring stopped');
    }
  };
} 