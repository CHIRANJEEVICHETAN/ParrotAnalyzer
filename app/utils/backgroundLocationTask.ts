import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Location as LocationType } from '../types/liveTracking';
import axios from 'axios';
import * as SecureStore from "expo-secure-store";
import * as Network from "expo-network";
import io from "socket.io-client";
import { Alert, AppState } from "react-native";

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
 * Start background location tracking with retry mechanism
 */
export async function startBackgroundLocationTracking(
  options: {
    timeInterval?: number;
    distanceInterval?: number;
    accuracy?: Location.Accuracy;
  },
  retryCount: number = 0 // Add retry count parameter
): Promise<boolean> {
  try {
    console.log(
      `Attempting to start background tracking (Attempt ${retryCount + 1}/${
        MAX_START_RETRIES + 1
      })...`
    );

    // Check app state immediately to fail fast if not in foreground
    if (AppState.currentState !== "active") {
      console.warn(
        `App is not active (State: ${AppState.currentState}). Checking retry count (${retryCount}/${MAX_START_RETRIES}).`
      );
      if (retryCount < MAX_START_RETRIES) {
        console.log(`Waiting ${RETRY_DELAY_MS}ms before retrying start...`);
        // Return a Promise with a timeout instead of using await, to prevent nesting too many promises
        return new Promise((resolve) =>
          setTimeout(() => {
            // When timeout completes, retry with incremented count and resolve with that result
            startBackgroundLocationTracking(options, retryCount + 1)
              .then(resolve)
              .catch(() => resolve(false));
          }, RETRY_DELAY_MS)
        );
      } else {
        // Max retries reached
        console.error(
          "Attempted to start foreground service while app is not active. Max retries reached. Aborting start."
        );
        Alert.alert(
          "Start Error",
          "Cannot start tracking when the app is not in the foreground. Please bring the app to the front and try again."
        );
        // Ensure the stored setting reflects failure
        await AsyncStorage.setItem(
          "backgroundTrackingSettings",
          JSON.stringify({
            isActive: false,
            error: "not_foreground_on_start_after_retries",
          })
        );
        return false; // Indicate failure clearly
      }
    }

    // Request permissions first - this is still essential
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== "granted") {
      console.error("Foreground location permission not granted");
      Alert.alert(
        "Permission Denied",
        "Foreground location permission is required."
      );
      return false;
    }

    const { status: backgroundStatus } =
      await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== "granted") {
      console.error("Background location permission not granted");
      Alert.alert(
        "Permission Denied",
        "Background location permission (Allow all the time / Always Allow) is required."
      );
      return false;
    }

    console.log("Permissions granted.");

    // Check again if app is still in foreground after permissions
    if (AppState.currentState !== "active") {
      console.warn(
        `App state changed during permission request (State: ${AppState.currentState}). Checking retry count (${retryCount}/${MAX_START_RETRIES}).`
      );
      if (retryCount < MAX_START_RETRIES) {
        console.log(`Waiting ${RETRY_DELAY_MS}ms before retrying start...`);
        return new Promise((resolve) =>
          setTimeout(() => {
            startBackgroundLocationTracking(options, retryCount + 1)
              .then(resolve)
              .catch(() => resolve(false));
          }, RETRY_DELAY_MS)
        );
      } else {
        console.error(
          "App state is not active after permissions. Max retries reached. Aborting start."
        );
        Alert.alert(
          "Start Error",
          "Cannot start tracking when the app is not in the foreground. Please bring the app to the front and try again."
        );
        await AsyncStorage.setItem(
          "backgroundTrackingSettings",
          JSON.stringify({
            isActive: false,
            error: "not_foreground_after_permissions",
          })
        );
        return false;
      }
    }

    console.log("App is active. Configuring tracking options...");

    // Get battery level to adjust the tracking interval
    const batteryLevel = await getBatteryLevel();
    const batteryState = await Battery.getBatteryStateAsync();
    const isCharging =
      batteryState === Battery.BatteryState.CHARGING ||
      batteryState === Battery.BatteryState.FULL;

    // Connect to socket for background location updates
    const token = await getAuthToken();
    const userDataStr = await AsyncStorage.getItem("user_data");
    const userData = userDataStr ? JSON.parse(userDataStr) : null;
    const userId = userData?.id;

    if (token && userId) {
      const apiUrl =
        process.env.EXPO_PUBLIC_API_URL ||
        (await AsyncStorage.getItem("apiUrl")) ||
        "http://localhost:3000";

      // Initialize socket connection
      await ensureSocketConnection(apiUrl, token, userId);
    }

    // Much larger time intervals to reduce battery usage and database load
    // Default is now 1 minute instead of 2 minutes
    let timeInterval = options.timeInterval || 60000; // 1 minute default

    if (!isCharging) {
      if (batteryLevel < 15) timeInterval = 300000; // 5 min
      else if (batteryLevel < 30) timeInterval = 180000; // 3 min
      else if (batteryLevel < 50) timeInterval = 120000; // 2 min
    }

    let distanceInterval = options.distanceInterval || 10; // 10 meters default
    if (!isCharging && batteryLevel < 30) distanceInterval = 30; // 30 meters
    distanceInterval = Math.max(distanceInterval, 10); // Min 10m

    console.log(
      `Calculated Intervals - Time: ${
        timeInterval / 1000
      }s, Distance: ${distanceInterval}m`
    );

    // Make sure we have a minimum distance to avoid too many updates
    distanceInterval = Math.max(distanceInterval, 10);

    // Stop existing task if running
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_LOCATION_TASK
    );
    if (isTaskRegistered) {
      console.log("Task already registered, stopping it before restarting...");
      try {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        console.log("Existing task stopped.");
      } catch (stopError: any) {
        console.warn(
          "Error stopping existing task, proceeding anyway:",
          stopError.message
        );
      }
    }

    // Final app state check before starting the task
    if (AppState.currentState !== "active") {
      console.error(
        `App state changed before starting task (State: ${AppState.currentState}). Cannot start tracking.`
      );
      Alert.alert(
        "Start Error",
        "Cannot start tracking when the app is not in the foreground. Please ensure the app is fully active and try again."
      );
      await AsyncStorage.setItem(
        "backgroundTrackingSettings",
        JSON.stringify({
          isActive: false,
          error: "app_state_changed_before_start",
        })
      );
      return false;
    }

    console.log("Starting Expo background location updates task...");

    // Start the location tracking task
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: options.accuracy || Location.Accuracy.Balanced,
      timeInterval,
      distanceInterval,
      deferredUpdatesInterval: 60000, // 1 min
      deferredUpdatesDistance: 50, // 50m
      foregroundService: {
        notificationTitle: "Parrot Analyzer is tracking your location",
        notificationBody:
          "To stop tracking, open the app and turn off tracking",
        notificationColor: "#10b981",
      },
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,
    });

    // Store tracking settings
    await AsyncStorage.setItem(
      "backgroundTrackingSettings",
      JSON.stringify({
        isActive: true,
        timeInterval,
        distanceInterval,
        startedAt: new Date().toISOString(),
      })
    );

    console.log(`Background location tracking started successfully.`);
    return true;
  } catch (error: any) {
    console.error(
      `Failed to start background location tracking (Attempt ${
        retryCount + 1
      }):`,
      error.message
    );
    if (error.message && error.message.includes("foreground service")) {
      Alert.alert(
        "Start Error",
        "Could not start tracking service. Please ensure the app is fully active and try again."
      );
    } else if (error.message && error.message.includes("permission")) {
      Alert.alert(
        "Permission Error",
        "Location permissions are required. Please check app settings."
      );
    } else {
      Alert.alert(
        "Start Error",
        "An unexpected error occurred while starting background tracking."
      );
    }
    // Store failure in settings on catch
    await AsyncStorage.setItem(
      "backgroundTrackingSettings",
      JSON.stringify({
        isActive: false,
        error: error.message || "unknown_start_error",
      })
    );
    return false;
  }
}

/**
 * Stop background location tracking
 */
export async function stopBackgroundLocationTracking(): Promise<boolean> {
  try {
    console.log("Attempting to stop background location tracking...");

    // First check if the task is actually registered
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_LOCATION_TASK
    );

    if (isTaskRegistered) {
      console.log("Background tracking task is registered, stopping it...");
      try {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        console.log("Background tracking task successfully stopped");
      } catch (error: any) {
        // If we get a "task not found" error, we can ignore it as the end result is the same
        if (error.message && error.message.includes("TaskNotFoundException")) {
          console.log("Task was already stopped or not found, this is fine");
        } else {
          // For other errors, we should log but still continue with cleanup
          console.error("Error stopping background tracking task:", error);
        }
      }
    } else {
      console.log(
        "Background tracking task was not registered, nothing to stop"
      );
    }

    // Always perform cleanup regardless of task status
    // Disconnect any socket connection
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
      console.log("Socket connection closed");
    }

    // Clear socket reconnect interval
    if (socketReconnectInterval) {
      clearInterval(socketReconnectInterval);
      socketReconnectInterval = null;
      console.log("Socket reconnect interval cleared");
    }

    // Always update the tracking settings to indicate it's stopped
    await AsyncStorage.setItem(
      "backgroundTrackingSettings",
      JSON.stringify({
        isActive: false,
        stoppedAt: new Date().toISOString(),
      })
    );

    console.log("Background location tracking fully stopped and cleaned up");
    return true;
  } catch (error) {
    console.error("Error in stopBackgroundLocationTracking:", error);

    // Even on error, try to update the background tracking status
    try {
      await AsyncStorage.setItem(
        "backgroundTrackingSettings",
        JSON.stringify({
          isActive: false,
          stoppedAt: new Date().toISOString(),
          stoppedWithError: true,
        })
      );
    } catch (storageError) {
      console.error(
        "Failed to update background tracking settings:",
        storageError
      );
    }

    return false;
  }
}

/**
 * Check if background location task is running
 */
export async function isBackgroundLocationTrackingActive(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  } catch (error) {
    console.error("Failed to check background location task status:", error);
    return false;
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
} 