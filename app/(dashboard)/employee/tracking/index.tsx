import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  AppState,
  Dimensions,
  InteractionManager,
  Modal,
  Pressable,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Battery from "expo-battery";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Polyline } from "react-native-maps";
import { useAuth } from "../../../context/AuthContext";
import { useLocationTracking } from "../../../hooks/useLocationTracking";
import { useColorScheme, useThemeColor } from "../../../hooks/useColorScheme";
import { useGeofencing } from "../../../hooks/useGeofencing";
import { useSocket } from "../../../hooks/useSocket";
import useLocationStore, {
  useLocationTrackingStore,
} from "../../../store/locationStore";
import {
  TrackingStatus,
  Location as AppLocation,
} from "../../../types/liveTracking";
import LiveTrackingMap from "../../shared/components/map/LiveTrackingMap";
import StatusIndicator from "../../shared/components/StatusIndicator";
import BatteryLevelIndicator from "../../shared/components/BatteryLevelIndicator";
import {
  isBackgroundLocationTrackingActive,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  BACKGROUND_LOCATION_TASK,
} from "../../../utils/backgroundLocationTask";
import BackgroundTrackingToggle from "../../../components/controls/BackgroundTrackingToggle";
import BatteryOptimizationHelper from "../../../utils/batteryOptimizationHelper";
import { LocationObject, LocationCoords } from "@/types/location";
import { checkLocationServicesStatus } from "@/utils/locationUtils";

// Add a debugging flag to help troubleshoot
const DEBUG_TRACKING = true;

// Enhanced debug logging function
const trackingLog = (message: string, data?: any) => {
  if (DEBUG_TRACKING) {
    if (data) {
      console.log(`[TRACKING] ${message}`, data);
    } else {
      console.log(`[TRACKING] ${message}`);
    }
  }
};

// Replace the existing TRACKING_INTERVALS with this enhanced version
const TRACKING_INTERVALS = {
  FOREGROUND: {
    DEFAULT: 60000,            // 1 minute default
    IMMEDIATE_UPDATE_DEBOUNCE: 3000,
    PERIODIC_UPDATE: 60000,    // 1 minute
    LOW_BATTERY: 120000,       // 2 minutes when battery < 30%
    CRITICAL_BATTERY: 180000,  // 3 minutes when battery < 15%
  },
  BACKGROUND: {
    DEFAULT: 300000,           // 5 minutes default
    CHARGING: 180000,          // 3 minutes when charging
    LOW_BATTERY: 600000,       // 10 minutes when battery < 30%
    CRITICAL_BATTERY: 900000,  // 15 minutes when battery < 15%
  },
  SYSTEM: {
    BATTERY_CHECK: 60000,      // 1 minute for battery checks
    BACKGROUND_STATUS_CHECK: 60000, // 1 minute
    HEARTBEAT: 60000,          // 1 minute 
  },
  DISTANCE: {
    MIN_DISTANCE_FILTER: 10,   // 10 meters minimum distance filter
  }
};

// Constants for map region
// const { width, height } = Dimensions.get("window");

// Add throttling utility to prevent excessive updates
const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return function (this: any, ...args: Parameters<T>): void {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Add this helper function near the top level
const getToken = async (): Promise<string | null> => {
  try {
    // Try SecureStore first
    const token = await SecureStore.getItemAsync("auth_token");
    if (token) {
      console.log("AsyncStorage auth_token: Found token");
      return token;
    }

    // Fallback to AsyncStorage
    const asyncToken = await AsyncStorage.getItem("auth_token");
    if (asyncToken) {
      console.log("AsyncStorage auth_token: Has value");
      return asyncToken;
    }

    console.error("No auth token found");
    return null;
  } catch (error) {
    console.error("Error retrieving auth token:", error);
    return null;
  }
};

// Replace with simplified version that just logs
const showToast = (message: string, type: "success" | "error" = "success") => {
  console.log(`${type.toUpperCase()}: ${message}`);
};

// Ensure location updates include trackingStatus with throttling
const sendLocationUpdate = async (
  location: Location.LocationObject,
  isActive: boolean = true
) => {
  try {
    const { coords, timestamp } = location;
    const token = await getToken();

    if (!token) {
      console.error("No token available for location update");
      return;
    }

    // Get battery level
    let batteryLevel = 100;
    try {
      const level = await Battery.getBatteryLevelAsync();
      if (typeof level === "number" && !isNaN(level)) {
        batteryLevel = Math.round(level * 100);
      }
    } catch (batteryError) {
      console.log("Error getting battery level:", batteryError);
    }

    // Prepare location data with explicit trackingStatus
    const locationData = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      altitude: coords.altitude,
      heading: coords.heading,
      speed: coords.speed,
      timestamp: new Date(timestamp).toISOString(),
      batteryLevel,
      isMoving: coords.speed !== null && coords.speed > 0.5,
      trackingStatus: isActive,
    };

    console.log("Sending location update with trackingStatus:", isActive);

    // Send to API
    await axios.post(
      `${process.env.EXPO_PUBLIC_API_URL}/api/employee-tracking/location`,
      locationData,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return true;
  } catch (error) {
    console.error("Error sending location update:", error);
    return false;
  }
};

// Add distance calculation utility
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
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
};

// Add this check near the top of the file after other utility functions
const isAppInForeground = () => {
  const state = AppState.currentState;
  return state === "active";
};

// Add this at the top of the file near other utility functions
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
};

// Add this Modal component near the top of the file, after other utility functions
interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor = "#ef4444",
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={modalStyles.centeredView}>
        <View style={modalStyles.modalView}>
          <Text style={modalStyles.modalTitle}>{title}</Text>
          <Text style={modalStyles.modalText}>{message}</Text>
          <View style={modalStyles.modalButtonContainer}>
            <Pressable
              style={[modalStyles.modalButton, modalStyles.modalButtonCancel]}
              onPress={onCancel}
            >
              <Text style={modalStyles.modalButtonTextCancel}>
                {cancelText}
              </Text>
            </Pressable>
            <Pressable
              style={[
                modalStyles.modalButton,
                modalStyles.modalButtonConfirm,
                { backgroundColor: confirmColor },
              ]}
              onPress={onConfirm}
            >
              <Text style={modalStyles.modalButtonTextConfirm}>
                {confirmText}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalView: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 20,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
  },
  modalButtonCancel: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  modalButtonConfirm: {
    backgroundColor: "#10b981",
  },
  modalButtonTextCancel: {
    color: "#374151",
    fontWeight: "bold",
    textAlign: "center",
  },
  modalButtonTextConfirm: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
});

// Add a validation function at the top of the file, after other utility functions
const validateLocationData = (location: any) => {
  // Check if coordinates are valid numbers
  if (
    typeof location.latitude !== "number" ||
    typeof location.longitude !== "number" ||
    isNaN(location.latitude) ||
    isNaN(location.longitude) ||
    location.latitude === 0 ||
    location.longitude === 0
  ) {
    console.warn("Invalid location coordinates detected:", location);
    return false;
  }

  // Check if accuracy is reasonable (< 5000 meters)
  if (
    location.accuracy &&
    (typeof location.accuracy !== "number" || location.accuracy > 5000)
  ) {
    console.warn("Unreasonable accuracy value:", location.accuracy);
    return false;
  }

  return true;
};

export default function EmployeeTrackingScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { user } = useAuth();
  const backgroundColor = useThemeColor("#f8fafc", "#0f172a");
  const textColor = useThemeColor("#334155", "#e2e8f0");
  const cardColor = useThemeColor("#ffffff", "#1e293b");

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<Location.PermissionStatus | null>(null);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [isBackgroundTracking, setIsBackgroundTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSendingUpdate, setIsSendingUpdate] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<
    Array<{ latitude: number; longitude: number }>
  >([]);
  const [initialTrackingLocation, setInitialTrackingLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [trackingSessionId, setTrackingSessionId] = useState<string>("");
  const [updateQueue, setUpdateQueue] = useState<Array<any>>([]);
  const [isProcessingUpdate, setIsProcessingUpdate] = useState(false);
  const [backgroundTrackingEnabled, setBackgroundTrackingEnabled] =
    useState(false);
  const [lastBackgroundUpdate, setLastBackgroundUpdate] = useState<
    string | null
  >(null);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);

  // References
  const mapRef = useRef<any>(null);
  const appStateRef = useRef(AppState.currentState);
  const lastLocationUpdateRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const lastPeriodicUpdateRef = useRef<number>(0);
  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null
  );
  const periodicUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const updateQueueRef = useRef<LocationObject[]>([]);
  const isMountedRef = useRef(true);
  const geofenceStatusRef = useRef<{ isInside: boolean; location: any } | null>(
    null
  );
  const locationHistoryRef = useRef<
    Array<{ latitude: number; longitude: number }>
  >([]);

  // Add this near other state declarations
  const [hasInitialized, setHasInitialized] = useState(false);
  const hasInitializedRef = useRef(false);

  // Add the debouncedUpdateRef to the top with other refs
  const debouncedUpdateRef = useRef<NodeJS.Timeout | null>(null);

  // Location tracking hooks and state
  const {
    startTracking,
    stopTracking,
    getCurrentLocation,
    trackingStatus: hookTrackingStatus,
    permissionStatus: hookPermissionStatus,
    isBackgroundTracking: checkIsBackgroundTracking,
  } = useLocationTracking({
    autoStart: false,
    enableBackgroundTracking: true,
    onLocationUpdate: (location) => {
      console.log("Location update received", location);
    },
    onError: (error) => {
      console.error("Location tracking error:", error);
    },
  });

  // Socket for real-time updates
  const { socket, isConnected: socketConnected } = useSocket({
    onConnect: () => {
      console.log(
        "Socket connected for employee tracking with ID:",
        socket?.id
      );
      setError(null);
      console.log("Employee tracking: Auth state:", {
        userId: user?.id,
        role: user?.role,
        isAuthenticated: !!user,
      });
    },
    onDisconnect: () => {
      console.log("Socket disconnected for employee tracking");
      setError("Connection to server lost. Location updates may not be sent.");
    },
    onLocationUpdate: (location) => {
      console.log("Location update received from server:", location);
    },
    onGeofenceTransition: (event) => {
      console.log("Geofence transition event:", event);
      setIsInGeofence(event.isInside, event.geofenceId);
      console.log(
        `Geofence ${event.isInside ? "Entered" : "Exited"}`,
        `You have ${event.isInside ? "entered" : "exited"} a workplace area`
      );
    },
    onError: (error) => {
      console.error("Socket error:", error);
      setError(`Connection error: ${error}`);
    },
  });

  // Store state
  const {
    currentLocation,
    trackingStatus,
    locationAccuracy,
    batteryLevel,
    isInGeofence,
    error: locationError,
    setTrackingStatus,
    backgroundTrackingEnabled: storeBackgroundTrackingEnabled,
    setBackgroundTrackingEnabled: setStoreBackgroundTrackingEnabled,
    setIsInGeofence,
  } = useLocationStore();

  // Geofencing
  const { isLocationInAnyGeofence, geofences, getCurrentGeofence } =
    useGeofencing({
      onGeofenceEnter: (geofence) => {
        console.log("Entered geofence:", geofence);
        console.log(
          `Geofence Alert: You have entered the geofence: ${geofence.name}`
        );
      },
      onGeofenceExit: (geofence) => {
        console.log("Exited geofence:", geofence);
        console.log(
          `Geofence Alert: You have exited the geofence: ${geofence.name}`
        );
      },
    });

  // Get current geofence name for display
  const currentGeofence = getCurrentGeofence();
  const currentGeofenceName = currentGeofence?.name || "In Geofence";

  // Process geofences to ensure radius is a number
  const processedGeofences = useMemo(() => {
    if (!geofences) return [];
    return geofences.map((geofence) => ({
      ...geofence,
      radius:
        typeof geofence.radius === "string"
          ? parseFloat(geofence.radius)
          : geofence.radius,
    }));
  }, [geofences]);

  // Update initialization effect to use constants and optimize
  useEffect(() => {
    isMountedRef.current = true;

    const initializeTracking = async () => {
      // Check if already initialized in current app session
      if (hasInitializedRef.current) {
        console.log(
          "Tracking already initialized in this session, skipping..."
        );
        return;
      }

      try {
        // Check if we have a stored initialization state
        const storedInitState = await AsyncStorage.getItem(
          "tracking_initialized"
        );
        const appState = await AsyncStorage.getItem("app_state");

        if (storedInitState === "true" && appState === "active") {
          console.log(
            "Tracking already initialized and app is active, skipping..."
          );
          hasInitializedRef.current = true;
          setHasInitialized(true);
          return;
        }

        // Run initialization in background
        InteractionManager.runAfterInteractions(async () => {
          try {
            if (!isMountedRef.current) return;

            await checkPermissions();
            await getCurrentLocation();
            await updateBackgroundTrackingStatus();

            // Generate a unique tracking session ID if not exists
            if (!trackingSessionId && isMountedRef.current) {
              const newSessionId = `session_${Date.now()}_${Math.random()
                .toString(36)
                .substring(2, 9)}`;
              setTrackingSessionId(newSessionId);
              await AsyncStorage.setItem(
                "current_tracking_session_id",
                newSessionId
              );
            }

            // Set initialization flags
            if (isMountedRef.current) {
              lastLocationUpdateRef.current = Date.now();
              hasInitializedRef.current = true;
              setHasInitialized(true);
              await AsyncStorage.setItem("tracking_initialized", "true");
              await AsyncStorage.setItem("app_state", "active");
              console.log("Tracking initialized successfully");
            }
          } catch (error) {
            console.error("Error in background initialization:", error);
            if (isMountedRef.current) {
              showToast(
                "Error initializing tracking. Please try again.",
                "error"
              );
            }
          }
        });
      } catch (error) {
        console.error("Error initializing tracking:", error);
        if (isMountedRef.current) {
          showToast("Error initializing tracking. Please try again.", "error");
        }
      }
    };

    initializeTracking();

    // Add app state change listener to handle background/foreground transitions
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        if (nextAppState === "active") {
          await AsyncStorage.setItem("app_state", "active");
        } else if (nextAppState.match(/inactive|background/)) {
          await AsyncStorage.setItem("app_state", "background");
          await AsyncStorage.setItem("tracking_initialized", "false");
          hasInitializedRef.current = false;
          setHasInitialized(false);
        }
      }
    );

    return () => {
      isMountedRef.current = false;
      subscription.remove();
      setUpdateQueue([]);
    };
  }, []);

  // CONSOLIDATED EFFECT: Combine location updates, queue processing, and periodic updates
  useEffect(() => {
    let updateInterval: NodeJS.Timeout | null = null;
    const debouncedUpdateRef = { current: null as any };

    // Function to determine update interval based on battery
    const getUpdateInterval = () => {
      if (batteryLevel <= 15) {
        return TRACKING_INTERVALS.FOREGROUND.CRITICAL_BATTERY;
      } else if (batteryLevel <= 30) {
        return TRACKING_INTERVALS.FOREGROUND.LOW_BATTERY;
      }
      return TRACKING_INTERVALS.FOREGROUND.DEFAULT;
    };

    // Process pending updates in queue
    const processQueue = async () => {
      if (!updateQueue.length || !isMountedRef.current || isProcessingUpdate)
        return;

      try {
        setIsProcessingUpdate(true);

        // Process in small batches to prevent UI freezing
        const batch = updateQueue.slice(0, Math.min(3, updateQueue.length));

        // Process immediately without waiting for InteractionManager
        for (const update of batch) {
          if (!isMountedRef.current || !socket || !socket.connected) break;

          if (update && update.type === "location") {
            // Emit each update with less delay
            socket.emit("location:update", update.data);
          }
        }

        // Remove processed items from queue in a non-blocking way
        if (isMountedRef.current) {
          setUpdateQueue((prev) => (prev ? prev.slice(batch.length) : []));
        }
      } catch (error) {
        console.error("Error processing update queue:", error);
      } finally {
        if (isMountedRef.current) {
          setIsProcessingUpdate(false);
        }
      }
    };

    // Immediate location update with debouncing
    const sendImmediateUpdate = () => {
      if (
        !currentLocation ||
        !socket ||
        !socket.connected ||
        !isMountedRef.current
      ) {
        trackingLog("Skipping immediate update - prerequisites not met");
        return;
      }

      trackingLog("Scheduling debounced immediate update");

      if (debouncedUpdateRef.current) {
        trackingLog("Clearing existing debounce timer");
        clearTimeout(debouncedUpdateRef.current);
      }

      debouncedUpdateRef.current = setTimeout(() => {
        if (!isMountedRef.current) {
          trackingLog("Component unmounted, skipping update");
          return;
        }

        // Validate location data before sending
        if (!validateLocationData(currentLocation)) {
          trackingLog(
            "Skipping location update due to invalid data",
            currentLocation
          );
          return;
        }

        trackingLog("Sending immediate location update", {
          lat: currentLocation.latitude,
          lng: currentLocation.longitude,
          timestamp: new Date().toISOString(),
        });

        socket.emit("location:update", {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          accuracy: currentLocation.accuracy,
          timestamp: new Date().toISOString(),
          batteryLevel: batteryLevel,
          isMoving:
            currentLocation.speed !== null &&
            currentLocation.speed !== undefined &&
            currentLocation.speed > 0.5,
          trackingStatus: TrackingStatus.ACTIVE,
          is_tracking_active: true,
          isActive: true,
          isInGeofence: isInGeofence,
          currentGeofenceId: currentGeofence?.id,
          userId: user?.id,
          employeeId: user?.id,
          sessionId: trackingSessionId,
        });

        // Update last location timestamp
        lastLocationUpdateRef.current = Date.now();
        trackingLog("Immediate update complete");
      }, TRACKING_INTERVALS.FOREGROUND.IMMEDIATE_UPDATE_DEBOUNCE);
    };

    // Periodic update function
    const sendPeriodicUpdate = async () => {
      if (
        trackingStatus !== TrackingStatus.ACTIVE ||
        !socket ||
        !socket.connected ||
        !currentLocation ||
        !isMountedRef.current
      )
        return;

      try {
        // Skip if we've sent an update very recently
        const now = Date.now();
        if (
          lastLocationUpdateRef.current &&
          now - lastLocationUpdateRef.current <
            TRACKING_INTERVALS.FOREGROUND.IMMEDIATE_UPDATE_DEBOUNCE
        ) {
          return;
        }

        // Validate location data before sending directly
        if (validateLocationData(currentLocation)) {
          // Check if we're already processing updates or have a queue
          if (!isProcessingUpdate && updateQueue.length === 0) {
            // Send directly if possible
            socket.emit("location:update", {
              ...currentLocation,
              timestamp: new Date().toISOString(),
              batteryLevel: batteryLevel,
              isMoving:
                currentLocation.speed !== null &&
                currentLocation.speed !== undefined &&
                currentLocation.speed > 0.5,
              trackingStatus: TrackingStatus.ACTIVE,
              is_tracking_active: true,
              isActive: true,
              isInGeofence: isInGeofence,
              currentGeofenceId: currentGeofence?.id,
              userId: user?.id,
              employeeId: user?.id,
              sessionId: trackingSessionId,
            });

            // Update last update timestamp
            lastLocationUpdateRef.current = now;
          } else {
            // Queue the update instead when already processing or queue exists
            setUpdateQueue((prev) => {
              const newUpdate = {
                type: "location",
                data: {
                  ...currentLocation,
                  timestamp: new Date().toISOString(),
                  batteryLevel: batteryLevel,
                  isMoving:
                    currentLocation.speed !== null &&
                    currentLocation.speed !== undefined &&
                    currentLocation.speed > 0.5,
                  trackingStatus: TrackingStatus.ACTIVE,
                  is_tracking_active: true,
                  isActive: true,
                  isInGeofence: isInGeofence,
                  currentGeofenceId: currentGeofence?.id,
                  userId: user?.id,
                  employeeId: user?.id,
                  sessionId: trackingSessionId,
                },
              };

              // Keep queue size reasonable
              const newQueue = Array.isArray(prev)
                ? [...prev, newUpdate]
                : [newUpdate];
              return newQueue.slice(-10); // Only keep last 10 updates
            });
          }
        } else {
          // Only queue if we have at least valid coordinates (even if accuracy is poor)
          if (
            currentLocation?.latitude &&
            currentLocation?.longitude &&
            !isNaN(currentLocation.latitude) &&
            !isNaN(currentLocation.longitude) &&
            currentLocation.latitude !== 0 &&
            currentLocation.longitude !== 0
          ) {
            // Queue the update with a fallback flag
            setUpdateQueue((prev) => {
              const newUpdate = {
                type: "location",
                data: {
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                  accuracy: currentLocation.accuracy || 5000, // Use high accuracy as fallback
                  timestamp: new Date().toISOString(),
                  batteryLevel: batteryLevel,
                  isMoving: false, // Conservative assumption
                  trackingStatus: TrackingStatus.ACTIVE,
                  is_tracking_active: true,
                  isActive: true,
                  isInGeofence: isInGeofence,
                  currentGeofenceId: currentGeofence?.id,
                  userId: user?.id,
                  employeeId: user?.id,
                  sessionId: trackingSessionId,
                  is_fallback: true, // Mark as fallback data
                },
              };

              // Keep queue size reasonable
              const newQueue = Array.isArray(prev)
                ? [...prev, newUpdate]
                : [newUpdate];
              return newQueue.slice(-10); // Only keep last 10 updates
            });
          }
        }
      } catch (error) {
        console.error("Error in periodic update:", error);
      }
    };

    // Setup tracking updates based on status
    if (trackingStatus === TrackingStatus.ACTIVE && isMountedRef.current) {
      // Trigger immediate update when location changes
      if (currentLocation) {
        sendImmediateUpdate();
      }

      // Process any pending updates in queue
      if (updateQueue.length > 0) {
        processQueue();
      }

      // Set up periodic updates with adaptive interval based on battery
      const intervalMs = getUpdateInterval();
      updateInterval = setInterval(sendPeriodicUpdate, intervalMs);

      // Run once immediately
      sendPeriodicUpdate();
    }

    return () => {
      // Clean up all timers
      if (updateInterval) {
        clearInterval(updateInterval);
      }

      if (debouncedUpdateRef.current) {
        clearTimeout(debouncedUpdateRef.current);
      }
    };
  }, [
    trackingStatus,
    currentLocation,
    socket,
    updateQueue,
    isProcessingUpdate,
    batteryLevel,
    isInGeofence,
    currentGeofence,
    user?.id,
    trackingSessionId,
  ]);

  // CONSOLIDATED EFFECT: Combine background status and AppState monitoring
  useEffect(() => {
    let statusCheckInterval: NodeJS.Timeout | null = null;

    const updateBackgroundStatus = async () => {
      try {
        console.log("Checking background location tracking status...");
        // Use the imported function to check if background tracking is active
        const isActive = await isBackgroundLocationTrackingActive();

        if (isMountedRef.current) {
          console.log(
            `Background tracking is ${isActive ? "active" : "inactive"}`
          );
          setIsBackgroundTracking(isActive);
          setBackgroundTrackingEnabled(isActive);

          // Also update the persisted state to match reality
          await AsyncStorage.setItem(
            "backgroundTrackingEnabled",
            isActive ? "true" : "false"
          );

          // If store is available, update that too
          if (typeof setStoreBackgroundTrackingEnabled === "function") {
            setStoreBackgroundTrackingEnabled(isActive);
          }
        }
      } catch (error) {
        console.error("Error checking background tracking status:", error);
        // If there was an error, assume it's not active
        if (isMountedRef.current) {
          setIsBackgroundTracking(false);
          setBackgroundTrackingEnabled(false);

          // Also ensure stores are consistent
          if (typeof setStoreBackgroundTrackingEnabled === "function") {
            setStoreBackgroundTrackingEnabled(false);
          }
          await AsyncStorage.setItem("backgroundTrackingEnabled", "false");
        }
      }
    };

    // AppState change handler with debouncing
    const handleAppStateChange = async (
      nextAppState: AppState["currentState"]
    ) => {
      // Only process if component is still mounted
      if (!isMountedRef.current) return;

      // When app comes back to foreground
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        console.log(
          "App returned to foreground, checking background tracking status"
        );

        // Check background tracking status immediately
        await updateBackgroundTrackingStatus();

        // Also get current location if we're actively tracking
        if (trackingStatus === TrackingStatus.ACTIVE) {
          getCurrentLocation();
        }
      }

      appStateRef.current = nextAppState;
    };

    // Run once on mount
    updateBackgroundStatus();

    // Set interval for periodic checks
    statusCheckInterval = setInterval(
      updateBackgroundStatus,
      TRACKING_INTERVALS.SYSTEM.BACKGROUND_STATUS_CHECK
    );

    // Setup AppState listener
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
      subscription.remove();
    };
  }, [trackingStatus]);

  // Update handleBackgroundToggle function to use the new constants
  const handleBackgroundToggle = async (isEnabled: boolean) => {
    try {
      // Update UI state immediately for responsive feel
      setBackgroundTrackingEnabled(isEnabled);

      if (isEnabled) {
        // Check app state first to ensure we're in foreground
        if (AppState.currentState !== "active") {
          console.warn(
            "❌ Cannot start background tracking when app is not active"
          );
          console.log(
            "App Not Active: Background tracking can only be enabled when the app is in the foreground."
          );
          setBackgroundTrackingEnabled(false);
          if (typeof setStoreBackgroundTrackingEnabled === "function") {
            setStoreBackgroundTrackingEnabled(false);
          }
          return;
        }

        // We'll manually start the background tracking to ensure proper flow
        const permissionsGranted = await requestBackgroundPermission();
        if (!permissionsGranted) {
          console.log(
            "❌ Background permissions not granted, aborting background tracking start"
          );
          // Revert UI state
          setBackgroundTrackingEnabled(false);
          if (typeof setStoreBackgroundTrackingEnabled === "function") {
            setStoreBackgroundTrackingEnabled(false);
          }
          return;
        }

        // Check if background tracking is already active
        const isActive = await isBackgroundLocationTrackingActive();
        if (isActive) {
          console.log("ℹ️ Background tracking is already active");
          return;
        }

        // For Android, check battery optimization
        if (Platform.OS === "android") {
          await BatteryOptimizationHelper.promptForBatteryOptimizationDisable();
        }

        // Start background tracking with a timeout to check status afterward
        const success = await startBackgroundLocationTracking({
          timeInterval: TRACKING_INTERVALS.BACKGROUND.DEFAULT, // Using new constant
          distanceInterval: TRACKING_INTERVALS.DISTANCE.MIN_DISTANCE_FILTER,
          accuracy: Location.Accuracy.Balanced,
        });

        if (success) {
          console.log("✅ Background location tracking started successfully");

          // Set a timeout to check tracking status after a short delay
          setTimeout(async () => {
            const isStillActive = await isBackgroundLocationTrackingActive();
            if (isStillActive) {
              console.log(
                "✅ Background tracking confirmed active after delay"
              );
            } else {
              console.log(
                "⚠️ Background tracking not active after delay - might have failed silently"
              );
            }
            await updateBackgroundTrackingStatus();
          }, 2000);
        } else {
          console.log("❌ Failed to start background tracking");
          // Revert UI state
          setBackgroundTrackingEnabled(false);
          if (typeof setStoreBackgroundTrackingEnabled === "function") {
            setStoreBackgroundTrackingEnabled(false);
          }
        }
      } else {
        // Stop background tracking
        console.log("Stopping background tracking...");
        const success = await stopBackgroundLocationTracking();
        if (success) {
          console.log("✅ Background tracking stopped successfully");
        } else {
          console.log("❌ Failed to stop background tracking");
        }
      }

      // Persist the setting
      await AsyncStorage.setItem(
        "backgroundTrackingEnabled",
        JSON.stringify(isEnabled)
      );

      // Update the store state too, but don't affect the normal tracking status
      if (typeof setStoreBackgroundTrackingEnabled === "function") {
        setStoreBackgroundTrackingEnabled(isEnabled);
      }

      // Update background tracking status
      await updateBackgroundTrackingStatus();
    } catch (error) {
      console.error("Error handling background tracking toggle:", error);
      // Revert UI state on error
      setBackgroundTrackingEnabled(false);
      if (typeof setStoreBackgroundTrackingEnabled === "function") {
        setStoreBackgroundTrackingEnabled(false);
      }
    }
  };

  // Update the toggleTracking function to use new constants
  const toggleTracking = async () => {
    // Prevent multiple rapid clicks
    if (isButtonDisabled) return;

    setIsButtonDisabled(true);
    trackingLog("Toggle tracking initiated, current status:", trackingStatus);

    try {
      if (
        trackingStatus === TrackingStatus.INACTIVE ||
        trackingStatus === TrackingStatus.ERROR
      ) {
        // --- STARTING TRACKING ---
        trackingLog("Starting foreground tracking...");

        // First, ensure all timers and subscriptions are cleared to avoid duplicates
        cleanupAllTracking();

        // Check app state first to ensure we're in foreground
        if (AppState.currentState !== "active") {
          trackingLog("Cannot start tracking when app is not active");
          setIsButtonDisabled(false);
          return;
        }

        await checkPermissions();
        if (!isLocationEnabled) {
          trackingLog("Location Services Disabled");
          setIsButtonDisabled(false);
          return;
        }

        // Generate a new tracking session ID
        const newSessionId = `session_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 9)}`;
        setTrackingSessionId(newSessionId);
        await AsyncStorage.setItem("current_tracking_session_id", newSessionId);

        // Set status to ACTIVE immediately for UI responsiveness
        setTrackingStatus(TrackingStatus.ACTIVE);

        // Start FOREGROUND tracking with retry logic
        let foregroundTrackingStarted = false;
        let retryCount = 0;
        const maxRetries = 3;

        while (!foregroundTrackingStarted && retryCount < maxRetries) {
          try {
            trackingLog(
              `Attempt ${retryCount + 1} to start foreground tracking...`
            );

            // Ensure we don't have existing subscriptions
            if (locationSubscription.current) {
              trackingLog(
                "Cleaning up existing location subscription before starting new one"
              );
              await locationSubscription.current.remove();
              locationSubscription.current = null;
            }

            // Assuming startTracking() is from useLocationTracking for foreground
            const result = await startTracking();
            if (result) {
              foregroundTrackingStarted = true;
              trackingLog("Foreground tracking started successfully!");
            } else {
              trackingLog("Foreground tracking failed to start, retrying...");
              retryCount++;

              // Short delay before retry
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          } catch (error) {
            console.error(
              `Error in foreground tracking start attempt ${retryCount + 1}:`,
              error
            );
            retryCount++;

            // Short delay before retry
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        if (!foregroundTrackingStarted) {
          console.error(
            "Failed to start foreground tracking after multiple attempts"
          );
          setTrackingStatus(TrackingStatus.INACTIVE); // Revert status
          setIsButtonDisabled(false);
          return;
        }

        // Explicitly request current location and send an update
        trackingLog("Getting initial location");
        const location = await getCurrentLocation();
        if (location && socket) {
          trackingLog("Sending initial location update to server");
          socket.emit("location:update", {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            timestamp: new Date().toISOString(),
            batteryLevel: batteryLevel,
            isMoving: false,
            trackingStatus: TrackingStatus.ACTIVE,
            is_tracking_active: true,
            isActive: true,
            isInGeofence: isInGeofence,
            currentGeofenceId: currentGeofence?.id,
            userId: user?.id,
            employeeId: user?.id,
            sessionId: newSessionId,
          });

          // Initialize route with starting point
          setRouteCoordinates([
            {
              latitude: location.latitude,
              longitude: location.longitude,
            },
          ]);
          setInitialTrackingLocation({
            latitude: location.latitude,
            longitude: location.longitude,
          });
          lastLocationUpdateRef.current = Date.now();
        }

        // Start foreground tracking heartbeat - ONLY if not already started
        if (periodicUpdateIntervalRef.current) {
          trackingLog(
            "Clearing existing heartbeat interval before creating new one"
          );
          clearInterval(periodicUpdateIntervalRef.current);
          periodicUpdateIntervalRef.current = null;
        }

        trackingLog("Setting up tracking heartbeat interval");
        periodicUpdateIntervalRef.current = setInterval(() => {
          if (!isMountedRef.current) {
            trackingLog("Component unmounted, clearing foreground heartbeat");
            if (periodicUpdateIntervalRef.current) {
              clearInterval(periodicUpdateIntervalRef.current);
              periodicUpdateIntervalRef.current = null;
            }
            return;
          }

          const currentTrackingState =
            useLocationStore.getState().trackingStatus;
          if (currentTrackingState === TrackingStatus.ACTIVE) {
            trackingLog("Foreground tracking heartbeat: still active");
            getCurrentLocation().catch((error) => {
              console.log(
                "Error in foreground heartbeat location refresh:",
                error
              );
            });
          } else {
            trackingLog(
              "Foreground heartbeat: tracking no longer active, clearing interval"
            );
            if (periodicUpdateIntervalRef.current) {
              clearInterval(periodicUpdateIntervalRef.current);
              periodicUpdateIntervalRef.current = null;
            }
          }
        }, TRACKING_INTERVALS.SYSTEM.HEARTBEAT);

        trackingLog("Tracking startup complete");
      } else if (trackingStatus === TrackingStatus.ACTIVE) {
        // --- PAUSING TRACKING ---
        trackingLog("Pausing foreground tracking...");

        // Clear intervals to avoid continued updates while paused
        cleanupAllTracking();

        setTrackingStatus(TrackingStatus.PAUSED);
        // Assuming stopTracking() is from useLocationTracking for foreground
        await stopTracking();

        // Send status update
        if (socket && currentLocation) {
          trackingLog("Sending pause status update");
          socket.emit("location:update", {
            ...currentLocation,
            timestamp: new Date().toISOString(),
            batteryLevel: batteryLevel,
            isMoving:
              currentLocation.speed !== null &&
              currentLocation.speed !== undefined &&
              currentLocation.speed > 0.5,
            trackingStatus: TrackingStatus.PAUSED,
            is_tracking_active: false,
            isActive: false, // Not active anymore
            isInGeofence: isInGeofence,
            currentGeofenceId: currentGeofence?.id,
            userId: user?.id,
            employeeId: user?.id,
            sessionId: trackingSessionId,
          });

          // Update last location update timestamp
          lastLocationUpdateRef.current = Date.now();
        }

        trackingLog("Tracking paused successfully");
      } else if (trackingStatus === TrackingStatus.PAUSED) {
        // --- RESUMING TRACKING ---
        trackingLog("Resuming foreground tracking...");

        // Clean up any lingering timers before resuming
        cleanupAllTracking();

        setTrackingStatus(TrackingStatus.ACTIVE);

        let foregroundTrackingResumed = false;
        let retryCount = 0;
        const maxRetries = 3;

        while (!foregroundTrackingResumed && retryCount < maxRetries) {
          try {
            trackingLog(
              `Attempt ${retryCount + 1} to resume foreground tracking...`
            );
            // Assuming startTracking() is from useLocationTracking for foreground
            const result = await startTracking();
            if (result) {
              foregroundTrackingResumed = true;
              trackingLog("Foreground tracking resumed successfully!");
            } else {
              trackingLog("Failed to resume foreground tracking, retrying...");
              retryCount++;
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          } catch (error) {
            console.error(
              `Error in foreground tracking resume attempt ${retryCount + 1}:`,
              error
            );
            retryCount++;
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        if (!foregroundTrackingResumed) {
          trackingLog("Failed to resume tracking after multiple attempts");
          setTrackingStatus(TrackingStatus.PAUSED); // Revert status
          setIsButtonDisabled(false);
          return;
        }

        // Send status update
        if (socket && currentLocation) {
          trackingLog("Sending resume status update");
          socket.emit("location:update", {
            ...currentLocation,
            timestamp: new Date().toISOString(),
            batteryLevel: batteryLevel,
            isMoving:
              currentLocation.speed !== null &&
              currentLocation.speed !== undefined &&
              currentLocation.speed > 0.5,
            trackingStatus: TrackingStatus.ACTIVE,
            is_tracking_active: true,
            isActive: true,
            isInGeofence: isInGeofence,
            currentGeofenceId: currentGeofence?.id,
            userId: user?.id,
            employeeId: user?.id,
            sessionId: trackingSessionId,
          });

          // Update last location update timestamp
          lastLocationUpdateRef.current = Date.now();
        }

        // Restart foreground heartbeat - ONLY if not already started
        if (periodicUpdateIntervalRef.current) {
          trackingLog(
            "Clearing existing heartbeat interval before creating new one"
          );
          clearInterval(periodicUpdateIntervalRef.current);
          periodicUpdateIntervalRef.current = null;
        }

        trackingLog("Setting up tracking heartbeat interval");
        periodicUpdateIntervalRef.current = setInterval(() => {
          if (!isMountedRef.current) {
            trackingLog("Component unmounted, clearing foreground heartbeat");
            if (periodicUpdateIntervalRef.current) {
              clearInterval(periodicUpdateIntervalRef.current);
              periodicUpdateIntervalRef.current = null;
            }
            return;
          }

          const currentTrackingState =
            useLocationStore.getState().trackingStatus;
          if (currentTrackingState === TrackingStatus.ACTIVE) {
            trackingLog("Foreground tracking heartbeat: still active");
            getCurrentLocation().catch((error) => {
              console.log(
                "Error in foreground heartbeat location refresh:",
                error
              );
            });
          } else {
            trackingLog(
              "Foreground heartbeat: tracking no longer active, clearing interval"
            );
            if (periodicUpdateIntervalRef.current) {
              clearInterval(periodicUpdateIntervalRef.current);
              periodicUpdateIntervalRef.current = null;
            }
          }
        }, TRACKING_INTERVALS.SYSTEM.HEARTBEAT);

        trackingLog("Tracking resume complete");
      }
    } catch (error) {
      console.error("Error in main toggleTracking function:", error);
      // Ensure we revert to a stable state on error
      setTrackingStatus(TrackingStatus.INACTIVE);
      cleanupAllTracking();
    } finally {
      // Re-enable the button
      setTimeout(() => {
        setIsButtonDisabled(false);
      }, 500);
    }
  };

  // Add a helper function to clean up all tracking-related resources
  const cleanupAllTracking = () => {
    trackingLog("Cleaning up all tracking resources");

    // Clear any existing intervals
    if (periodicUpdateIntervalRef.current) {
      trackingLog("Clearing periodic update interval");
      clearInterval(periodicUpdateIntervalRef.current);
      periodicUpdateIntervalRef.current = null;
    }

    // Clear any debounced updates
    if (debouncedUpdateRef && debouncedUpdateRef.current) {
      trackingLog("Clearing debounced update timer");
      clearTimeout(debouncedUpdateRef.current);
      debouncedUpdateRef.current = null;
    }

    // Cancel any ongoing location subscription
    if (locationSubscription.current) {
      trackingLog("Removing location subscription");
      try {
        locationSubscription.current.remove();
      } catch (e) {
        console.error("Error removing location subscription:", e);
      }
      locationSubscription.current = null;
    }

    trackingLog("All tracking resources cleaned up");
  };

  // Rename the callback version
  const handleLocationUpdate = useCallback(
    throttle((location: any) => {
      if (!isMountedRef.current) return;

      // Only update when location actually changes significantly
      const last =
        locationHistoryRef.current[locationHistoryRef.current.length - 1];
      if (
        !last ||
        calculateDistance(
          last.latitude,
          last.longitude,
          location.latitude,
          location.longitude
        ) > 10
      ) {
        locationHistoryRef.current.push({
          latitude: location.latitude,
          longitude: location.longitude,
        });

        if (locationHistoryRef.current.length > 100) {
          locationHistoryRef.current = locationHistoryRef.current.slice(-100);
        }

        if (trackingStatus === TrackingStatus.ACTIVE) {
          setRouteCoordinates((prev) => {
            const newCoords = [
              ...prev,
              {
                latitude: location.latitude,
                longitude: location.longitude,
              },
            ];
            return newCoords.slice(-100);
          });
        }
      }
    }, 2000),
    [trackingStatus]
  );

  // Optimize map region updates
  const debouncedRegionChange = useMemo(
    () =>
      debounce((region: any) => {
        if (mapRef.current) {
          mapRef.current.animateToRegion(region, 500);
        }
      }, 1000),
    []
  );

  // Update mapProps definition
  const mapProps = useMemo(
    () => ({
      showsUserLocation: true,
      followsUserLocation: trackingStatus === TrackingStatus.ACTIVE,
      initialRegion: currentLocation
        ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }
        : undefined,
      onRegionChangeComplete: debouncedRegionChange,
    }),
    [currentLocation, trackingStatus, debouncedRegionChange]
  );

  // Update the useEffect to use the new name
  useEffect(() => {
    if (currentLocation && handleLocationUpdate) {
      handleLocationUpdate(currentLocation);
    }
  }, [currentLocation, handleLocationUpdate]);

  // Add more efficient geofence status checking
  useEffect(() => {
    // Store current geofence status to avoid duplicative logs/updates
    if (
      currentLocation &&
      JSON.stringify(geofenceStatusRef.current) !==
        JSON.stringify({ isInside: isInGeofence, location: currentLocation })
    ) {
      geofenceStatusRef.current = {
        isInside: isInGeofence,
        location: currentLocation,
      };

      // Run geofence processing after UI is idle
      InteractionManager.runAfterInteractions(() => {
        if (trackingStatus === TrackingStatus.ACTIVE) {
          // Update with reduced logging
          console.log(
            "Geofence status updated:",
            isInGeofence ? "Inside" : "Outside"
          );
        }
      });
    }
  }, [currentLocation, isInGeofence, trackingStatus]);

  // Reset route when tracking is stopped or started
  useEffect(() => {
    if (trackingStatus === TrackingStatus.INACTIVE) {
      // Keep the final route displayed but don't add new points
    } else if (
      trackingStatus === TrackingStatus.ACTIVE &&
      routeCoordinates.length === 0
    ) {
      // Reset route when starting new tracking session
      setRouteCoordinates([]);
      setInitialTrackingLocation(null);
    }
  }, [trackingStatus]);

  // Add a requestBackgroundPermission function similar to the one in tracking-test.tsx
  const requestBackgroundPermission = async () => {
    console.log("Requesting background location permission...");

    try {
      // Check foreground permission first
      const foregroundPermission =
        await Location.getForegroundPermissionsAsync();

      if (foregroundPermission.status !== "granted") {
        console.log(
          "⚠️ Foreground location permission not granted. Requesting it first..."
        );
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          console.log("❌ Foreground location permission denied");
          Alert.alert(
            "Foreground Permission Required",
            "Background location requires foreground location permission first. Please enable location services in settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ]
          );
          return false;
        }
        console.log("✅ Foreground location permission granted");
      }

      // Now request background permission
      console.log("Requesting background location permission...");

      if (Platform.OS === "ios") {
        // On iOS, explain the process clearly first
        return new Promise((resolve) => {
          Alert.alert(
            "Background Location Required",
            "In the next prompt, please select 'Always Allow' to enable background location tracking. This is required for tracking to work when the app is in the background.",
            [
              {
                text: "Continue",
                onPress: async () => {
                  const { status } =
                    await Location.requestBackgroundPermissionsAsync();

                  if (status === "granted") {
                    console.log("✅ Background location permission granted");
                    // Check if we actually got the permission
                    await checkPermissions();
                    resolve(true);
                  } else {
                    console.log("❌ Background location permission denied");
                    Alert.alert(
                      "Permission Denied",
                      "Background location was not granted. Please go to Settings > Privacy > Location Services > Parrot Analyzer and select 'Always' to enable background tracking.",
                      [
                        { text: "Later", style: "cancel" },
                        {
                          text: "Open Settings",
                          onPress: () => Linking.openSettings(),
                        },
                      ]
                    );
                    resolve(false);
                  }
                },
              },
            ]
          );
        });
      } else {
        // On Android, request directly
        const { status } = await Location.requestBackgroundPermissionsAsync();

        if (status === "granted") {
          console.log("✅ Background location permission granted");
          await checkPermissions();
          return true;
        } else {
          console.log("❌ Background location permission denied");
          Alert.alert(
            "Permission Denied",
            "To enable background location tracking, please go to Settings > Apps > Parrot Analyzer > Permissions > Location and select 'Allow all the time'.",
            [
              { text: "Later", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ]
          );
          return false;
        }
      }
    } catch (error: any) {
      console.error(
        "❌ Error requesting background permission:",
        error.message || String(error)
      );
      return false;
    }
  };

  // Format location data with consistent user ID and session ID
  const formatLocationData = (
    location: Location.LocationObject
  ): LocationObject => {
    // Update the last periodic update time
    lastPeriodicUpdateRef.current = Date.now();

    // Check if we're actively tracking with a subscription
    const isActiveTracking = !!locationSubscription.current;

    // Clear any existing periodic update interval to avoid duplicates
    if (periodicUpdateIntervalRef.current) {
      clearInterval(periodicUpdateIntervalRef.current);
      periodicUpdateIntervalRef.current = null;
    }

    // Return formatted location data
    return {
      coords: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        altitude: location.coords.altitude || undefined,
        heading: location.coords.heading || undefined,
        speed: location.coords.speed || undefined,
      },
      timestamp: location.timestamp,
      userId: user?.id,
      sessionId: trackingSessionId,
    };
  };

  // Check location permissions and services
  const checkPermissions = async () => {
    // Use the imported checkLocationServicesStatus function instead of directly calling Location.hasServicesEnabledAsync
    const locationServicesEnabled = await checkLocationServicesStatus();
    setIsLocationEnabled(locationServicesEnabled);

    if (!locationServicesEnabled) {
      Alert.alert(
        "Location Services Disabled",
        "Please enable location services in your device settings to use tracking features.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => {
              // Request permission will prompt system settings on iOS/Android
              Location.requestForegroundPermissionsAsync();
            },
          },
        ]
      );
      return;
    }

    // Check foreground permissions
    let foregroundPermission = await Location.getForegroundPermissionsAsync();

    if (!foregroundPermission.granted) {
      foregroundPermission = await Location.requestForegroundPermissionsAsync();
      if (!foregroundPermission.granted) {
        console.log(
          "Permission Denied: Location permission is required for tracking"
        );
        return;
      }
    }

    // Check background permissions if foreground is granted
    if (foregroundPermission.granted) {
      let backgroundPermission = await Location.getBackgroundPermissionsAsync();

      if (!backgroundPermission.granted) {
        backgroundPermission =
          await Location.requestBackgroundPermissionsAsync();
      }

      setPermissionStatus(backgroundPermission.status);
    }
  };

  // Update background tracking status
  const updateBackgroundTrackingStatus = async () => {
    try {
      console.log("Checking background location tracking status...");
      // Use the imported function to check if background tracking is active
      const isActive = await isBackgroundLocationTrackingActive();

      if (isMountedRef.current) {
        console.log(
          `Background tracking is ${isActive ? "active" : "inactive"}`
        );
        setIsBackgroundTracking(isActive);
        setBackgroundTrackingEnabled(isActive);

        // Also update the persisted state to match reality
        await AsyncStorage.setItem(
          "backgroundTrackingEnabled",
          isActive ? "true" : "false"
        );

        // If store is available, update that too
        if (typeof setStoreBackgroundTrackingEnabled === "function") {
          setStoreBackgroundTrackingEnabled(isActive);
        }
      }
    } catch (error) {
      console.error("Error checking background tracking status:", error);
      // If there was an error, assume it's not active
      if (isMountedRef.current) {
        setIsBackgroundTracking(false);
        setBackgroundTrackingEnabled(false);

        // Also ensure stores are consistent
        if (typeof setStoreBackgroundTrackingEnabled === "function") {
          setStoreBackgroundTrackingEnabled(false);
        }
        await AsyncStorage.setItem("backgroundTrackingEnabled", "false");
      }
    }
  };

  // Enhance the onRefresh function to update geofence status and battery level
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Check permissions first
      await checkPermissions();

      // Get current location using Expo Location
      const expoLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      // Update background tracking status
      await updateBackgroundTrackingStatus();

      // Update battery level
      try {
        const level = await Battery.getBatteryLevelAsync();
        if (typeof level === "number" && !isNaN(level)) {
          const batteryPercent = Math.round(level * 100);
          useLocationStore.setState({ batteryLevel: batteryPercent });
        }
      } catch (batteryError) {
        console.log("Error getting battery level:", batteryError);
      }

      // Check geofence status if we have a valid location
      if (expoLocation && isLocationInAnyGeofence) {
        // Convert Expo Location object to our app's Location type format
        const appLocationObj: AppLocation = {
          latitude: expoLocation.coords.latitude,
          longitude: expoLocation.coords.longitude,
          accuracy: expoLocation.coords.accuracy,
          timestamp: expoLocation.timestamp,
        };

        // Check if current location is inside any geofence
        const isInside = isLocationInAnyGeofence(appLocationObj);
        const currentGeofenceId =
          isInside && getCurrentGeofence()
            ? getCurrentGeofence()!.id
            : undefined;

        // Update geofence status in store - ensure we provide correct types
        setIsInGeofence(isInside, currentGeofenceId);
      }

      // If socket exists, send a manual update to refresh server-side data
      if (socket && socket.connected && expoLocation) {
        socket.emit("location:update", {
          latitude: expoLocation.coords.latitude,
          longitude: expoLocation.coords.longitude,
          accuracy: expoLocation.coords.accuracy,
          timestamp: new Date().toISOString(),
          batteryLevel: batteryLevel,
          isMoving:
            expoLocation.coords.speed !== null &&
            expoLocation.coords.speed > 0.5,
          trackingStatus: trackingStatus,
          is_tracking_active: trackingStatus === TrackingStatus.ACTIVE,
          isActive: trackingStatus === TrackingStatus.ACTIVE,
          isInGeofence: isInGeofence,
          currentGeofenceId: currentGeofence?.id,
          userId: user?.id,
          employeeId: user?.id,
          sessionId: trackingSessionId,
        });

        // Update currentLocation in store with the refreshed data
        useLocationStore.setState({
          currentLocation: {
            latitude: expoLocation.coords.latitude,
            longitude: expoLocation.coords.longitude,
            accuracy: expoLocation.coords.accuracy,
            timestamp: expoLocation.timestamp,
          },
        });
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  }, [
    isLocationInAnyGeofence,
    setIsInGeofence,
    getCurrentGeofence,
    socket,
    trackingStatus,
    batteryLevel,
    user?.id,
    trackingSessionId,
    isInGeofence,
  ]);

  // Navigate to shift management
  const goToShiftManagement = useCallback(() => {
    if (router) {
      router.push("/(dashboard)/shared/shiftTracker");
    }
  }, [router]);

  // Format coordinates for display
  const formatCoordinate = (coord: number | undefined) => {
    if (coord === undefined) return "N/A";
    return coord.toFixed(6);
  };

  // Get status color
  const getStatusColor = () => {
    switch (trackingStatus) {
      case TrackingStatus.ACTIVE:
        return "#10b981"; // Green
      case TrackingStatus.PAUSED:
        return "#f59e0b"; // Yellow
      case TrackingStatus.ERROR:
        return "#ef4444"; // Red
      default:
        return "#6b7280"; // Gray
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (trackingStatus) {
      case TrackingStatus.ACTIVE:
        return "Active";
      case TrackingStatus.PAUSED:
        return "Paused";
      case TrackingStatus.ERROR:
        return "Error";
      default:
        return "Inactive";
    }
  };

  // Get action button text
  const getActionButtonText = () => {
    switch (trackingStatus) {
      case TrackingStatus.ACTIVE:
        return "Pause Tracking";
      case TrackingStatus.PAUSED:
        return "Resume Tracking";
      case TrackingStatus.ERROR:
      case TrackingStatus.INACTIVE:
        return "Start Tracking";
      default:
        return "Start Tracking";
    }
  };

  // Test button to diagnose tracking issues
  const sendTestUpdate = async () => {
    if (isButtonDisabled) return;

    setIsButtonDisabled(true);

    try {
      setIsSendingUpdate(true);

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Get current battery level
      const batteryLevel = await Battery.getBatteryLevelAsync();
      const batteryPercent = Math.round(batteryLevel * 100);

      // Validate data before sending
      if (
        socket &&
        validateLocationData({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        })
      ) {
        socket.emit("location:update", {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          timestamp: new Date().toISOString(),
          batteryLevel: batteryPercent,
          isMoving:
            location.coords.speed !== null && location.coords.speed > 0.5,
          trackingStatus: trackingStatus,
          is_tracking_active: trackingStatus === TrackingStatus.ACTIVE,
          isActive: trackingStatus === TrackingStatus.ACTIVE,
          isInGeofence: isInGeofence,
          currentGeofenceId: currentGeofence?.id,
          userId: user?.id,
          employeeId: user?.id,
          sessionId: trackingSessionId,
        });

        // Update last location update timestamp
        lastLocationUpdateRef.current = Date.now();

        // Show success message
        console.log("Success: Location updated via socket successfully");
      } else if (!socket) {
        console.log("Error: Socket connection not available");
        return;
      } else {
        console.log(
          "Error: Invalid location data detected. Unable to send update."
        );
        return;
      }
    } catch (error) {
      console.error("Error sending test update:", error);
      console.log(
        "Error: Error sending location update. Please check your connection."
      );
    } finally {
      setIsSendingUpdate(false);
      setTimeout(() => {
        setIsButtonDisabled(false);
      }, 500);
    }
  };

  // Replace handleStopTracking with this version
  const handleStopTracking = () => {
    setShowStopModal(true);
  };

  // Handle stopping tracking
  const confirmStopTracking = async () => {
    setShowStopModal(false);
    setIsButtonDisabled(true);

    try {
      // Clear any tracking intervals
      if (periodicUpdateIntervalRef.current) {
        clearInterval(periodicUpdateIntervalRef.current);
        periodicUpdateIntervalRef.current = null;
      }

      await stopTracking();
      setTrackingStatus(TrackingStatus.INACTIVE);
      await updateBackgroundTrackingStatus();

      // Send status update
      if (socket && currentLocation) {
        socket.emit("location:update", {
          ...currentLocation,
          timestamp: new Date().toISOString(),
          batteryLevel: batteryLevel,
          isMoving: false,
          trackingStatus: TrackingStatus.INACTIVE,
          is_tracking_active: false,
          isActive: false, // Not active anymore
          isInGeofence: isInGeofence,
          currentGeofenceId: currentGeofence?.id,
          userId: user?.id,
          employeeId: user?.id,
          sessionId: trackingSessionId,
        });
      }
    } catch (error) {
      console.error("Error stopping tracking:", error);
      console.log("Error: Failed to stop tracking. Please try again.");
    } finally {
      setTimeout(() => {
        setIsButtonDisabled(false);
      }, 500);
    }
  };

  // Add a cleanup effect to ensure tracking stops when component unmounts
  useEffect(() => {
    // Set mount flag
    isMountedRef.current = true;

    return () => {
      console.log(
        "EmployeeTrackingScreen unmounting - cleaning up FOREGROUND resources"
      );
      isMountedRef.current = false;

      // Clear foreground tracking intervals
      if (periodicUpdateIntervalRef.current) {
        clearInterval(periodicUpdateIntervalRef.current);
        periodicUpdateIntervalRef.current = null;
        console.log("Foreground heartbeat interval cleared on unmount");
      }

      // Only stop FOREGROUND tracking if it was active when unmounting
      // We capture the status at the time the cleanup function is defined
      const statusOnUnmount = trackingStatus;
      if (statusOnUnmount === TrackingStatus.ACTIVE) {
        console.log("Stopping active FOREGROUND tracking on unmount");
        // Assuming stopTracking() handles only foreground
        stopTracking().catch((error) => {
          console.error(
            "Error stopping foreground tracking on unmount:",
            error
          );
        });
      }

      // --- REMOVED Background Stop Logic ---
      // Background task lifecycle is managed independently by its toggle/system
    };
    // Only re-run cleanup if trackingStatus changes, to stop foreground tracking correctly
  }, [trackingStatus]);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen
        options={{
          title: "Live Location",
          headerStyle: {
            backgroundColor: cardColor,
          },
          headerTintColor: textColor,
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {isBackgroundTracking && (
                <View style={styles.headerBackgroundIndicator}>
                  <Ionicons name="locate" size={16} color="#10b981" />
                </View>
              )}
              <TouchableOpacity style={{ marginLeft: 12 }} onPress={onRefresh}>
                <Ionicons name="refresh-outline" size={24} color={textColor} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Map View */}
        <View style={styles.mapContainer}>
          <LiveTrackingMap
            {...mapProps}
            containerStyle={styles.map}
            geofences={processedGeofences}
            currentGeofence={currentGeofence}
          />

          {/* Draw route line separately on the map */}
          {routeCoordinates.length > 1 && (
            <View style={StyleSheet.absoluteFill}>
              <Polyline
                coordinates={routeCoordinates}
                strokeWidth={4}
                strokeColor="#3b82f6"
              />
            </View>
          )}

          {/* Map Overlay with Status */}
          <View style={styles.mapOverlay}>
            <View style={[styles.statusPill, { backgroundColor: cardColor }]}>
              <View
                style={[
                  styles.statusIndicator,
                  { backgroundColor: getStatusColor() },
                ]}
              />
              <Text style={[styles.statusText, { color: textColor }]}>
                {getStatusText()}
              </Text>
            </View>

            {socketConnected && (
              <View
                style={[styles.connectionPill, { backgroundColor: cardColor }]}
              >
                <Ionicons name="wifi" size={14} color="#10b981" />
                <Text style={[styles.connectionText, { color: textColor }]}>
                  Connected
                </Text>
              </View>
            )}

            {isBackgroundTracking && (
              <View
                style={[styles.backgroundPill, { backgroundColor: cardColor }]}
              >
                <Ionicons name="sync" size={14} color="#10b981" />
                <Text style={[styles.connectionText, { color: textColor }]}>
                  Background
                </Text>
              </View>
            )}

            {isInGeofence && (
              <View
                style={[styles.geofencePill, { backgroundColor: cardColor }]}
              >
                <Ionicons name="location" size={14} color="#10b981" />
                <Text style={[styles.connectionText, { color: textColor }]}>
                  {isInGeofence ? currentGeofenceName : "No"}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View className="px-4">
          {/* <View className="flex-row justify-between items-center">
            <BackgroundTrackingNotification
              onPress={goToShiftManagement}
              autoHide={false}
            />
          </View> */}

          {/* Status Cards */}
          <View style={styles.cardsContainer}>
            {/* Refresh Hint */}
            <View className="flex-1 justify-center items-center flex-row p-4 mb-3 bg-blue-50/80 dark:bg-blue-900/30 rounded-xl shadow-sm border border-blue-100 dark:border-blue-800">
              <Ionicons
                name="information-circle"
                size={20}
                color="#3b82f6"
                style={{ marginRight: 5 }}
              />
              <Text
                numberOfLines={1}
                className="flex-1 text-blue-700 dark:text-blue-300 text-[12px] font-medium"
              >
                Pull down to refresh for the most accurate tracking data
              </Text>
            </View>

            {/* Location Card */}
            <View style={[styles.card, { backgroundColor: cardColor }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>
                Current Location
              </Text>
              <View style={styles.cardContent}>
                <View style={styles.locationDetail}>
                  <Text style={[styles.locationLabel, { color: textColor }]}>
                    Latitude:
                  </Text>
                  <Text style={[styles.locationValue, { color: textColor }]}>
                    {formatCoordinate(currentLocation?.latitude)}
                  </Text>
                </View>
                <View style={styles.locationDetail}>
                  <Text style={[styles.locationLabel, { color: textColor }]}>
                    Longitude:
                  </Text>
                  <Text style={[styles.locationValue, { color: textColor }]}>
                    {formatCoordinate(currentLocation?.longitude)}
                  </Text>
                </View>
                <View style={styles.locationDetail}>
                  <Text style={[styles.locationLabel, { color: textColor }]}>
                    Accuracy:
                  </Text>
                  <Text style={[styles.locationValue, { color: textColor }]}>
                    {currentLocation?.accuracy
                      ? `${Math.round(currentLocation.accuracy)}m`
                      : "N/A"}
                  </Text>
                </View>
                <View style={styles.locationDetail}>
                  <Text style={[styles.locationLabel, { color: textColor }]}>
                    Updated:
                  </Text>
                  <Text style={[styles.locationValue, { color: textColor }]}>
                    {currentLocation?.timestamp
                      ? new Date(
                          typeof currentLocation.timestamp === "string"
                            ? currentLocation.timestamp
                            : currentLocation.timestamp
                        ).toLocaleTimeString()
                      : "Never"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Status Card */}
            <View style={[styles.card, { backgroundColor: cardColor }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>
                Tracking Status
              </Text>
              <View style={styles.cardContent}>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusLabel, { color: textColor }]}>
                    Status:
                  </Text>
                  <StatusIndicator status={trackingStatus} showText={true} />
                </View>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusLabel, { color: textColor }]}>
                    Battery:
                  </Text>
                  <BatteryLevelIndicator level={batteryLevel} />
                </View>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusLabel, { color: textColor }]}>
                    In Geofence:
                  </Text>
                  <View style={styles.geofenceIndicator}>
                    <View
                      style={[
                        styles.geofenceDot,
                        {
                          backgroundColor: isInGeofence ? "#10b981" : "#ef4444",
                        },
                      ]}
                    />
                    <Text style={[styles.geofenceText, { color: textColor }]}>
                      {isInGeofence ? currentGeofenceName : "No"}
                    </Text>
                  </View>
                </View>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusLabel, { color: textColor }]}>
                    Permissions:
                  </Text>
                  <View style={styles.geofenceIndicator}>
                    <View
                      style={[
                        styles.geofenceDot,
                        {
                          backgroundColor:
                            permissionStatus === "granted"
                              ? "#10b981"
                              : "#ef4444",
                        },
                      ]}
                    />
                    <Text style={[styles.geofenceText, { color: textColor }]}>
                      {permissionStatus === "granted" ? "Granted" : "Limited"}
                    </Text>
                  </View>
                </View>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusLabel, { color: textColor }]}>
                    Background:
                  </Text>
                  <View style={styles.geofenceIndicator}>
                    <View
                      style={[
                        styles.geofenceDot,
                        {
                          backgroundColor: backgroundTrackingEnabled
                            ? "#10b981"
                            : "#6b7280",
                        },
                      ]}
                    />
                    <Text style={[styles.geofenceText, { color: textColor }]}>
                      {backgroundTrackingEnabled ? "Enabled" : "Disabled"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Error message */}
          {error && (
            <View style={[styles.errorCard, { backgroundColor: "#fee2e2" }]}>
              <Ionicons name="alert-circle" size={20} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor:
                    trackingStatus === TrackingStatus.ACTIVE
                      ? "#f59e0b"
                      : trackingStatus === TrackingStatus.PAUSED
                      ? "#10b981"
                      : "#3b82f6",
                  opacity: isButtonDisabled ? 0.7 : 1,
                },
              ]}
              onPress={() => toggleTracking()}
              disabled={isButtonDisabled}
            >
              {isButtonDisabled ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons
                  name={
                    trackingStatus === TrackingStatus.ACTIVE ? "pause" : "play"
                  }
                  size={20}
                  color="#ffffff"
                />
              )}
              <Text style={styles.actionButtonText}>
                {getActionButtonText()}
              </Text>
            </TouchableOpacity>

            {trackingStatus !== TrackingStatus.INACTIVE && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: "#ef4444",
                    opacity: isButtonDisabled ? 0.7 : 1,
                  },
                ]}
                onPress={() => handleStopTracking()}
                disabled={isButtonDisabled}
              >
                <Ionicons name="stop" size={20} color="#ffffff" />
                <Text style={styles.actionButtonText}>Stop Tracking</Text>
              </TouchableOpacity>
            )}

            {/* Test button to diagnose tracking issues */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: "#9333ea",
                  opacity: isButtonDisabled || isSendingUpdate ? 0.7 : 1,
                },
              ]}
              onPress={sendTestUpdate}
              disabled={isButtonDisabled || isSendingUpdate}
            >
              {isSendingUpdate ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="bug" size={20} color="#ffffff" />
              )}
              <Text style={styles.actionButtonText}>Send Test Update</Text>
            </TouchableOpacity>

            {/* Background Tracking Toggle Component */}
            <BackgroundTrackingToggle onToggle={handleBackgroundToggle} />

            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: "#10b981",
                },
              ]}
              onPress={goToShiftManagement}
              disabled={isButtonDisabled}
            >
              <Ionicons name="time" size={20} color="#ffffff" />
              <Text style={styles.actionButtonText}>Shift Management</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={showStopModal}
        title="Stop Tracking"
        message="Are you sure you want to stop location tracking?"
        onConfirm={confirmStopTracking}
        onCancel={() => setShowStopModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
    // paddingHorizontal: 16,
  },
  mapContainer: {
    height: 500,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  mapOverlay: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "column",
    gap: 8,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  connectionPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 6,
  },
  backgroundPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  cardContent: {
    gap: 8,
  },
  locationDetail: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  locationLabel: {
    fontSize: 14,
    opacity: 0.8,
  },
  locationValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLabel: {
    fontSize: 14,
    opacity: 0.8,
  },
  geofenceIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  geofenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  geofenceText: {
    fontSize: 14,
    fontWeight: "500",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#ef4444",
    fontWeight: "500",
    flex: 1,
  },
  actionsContainer: {
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  headerBackgroundIndicator: {
    backgroundColor: "#10b981",
    borderRadius: 12,
    padding: 4,
  },
  geofencePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: "center",
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalView: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 20,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
  },
  modalButtonCancel: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  modalButtonConfirm: {
    backgroundColor: "#10b981",
  },
  modalButtonTextCancel: {
    color: "#374151",
    fontWeight: "bold",
    textAlign: "center",
  },
  modalButtonTextConfirm: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
});
