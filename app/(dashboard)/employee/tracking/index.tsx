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
import { useTracking } from "../../../context/TrackingContext";
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
import * as TaskManager from "expo-task-manager";
import { 
  createEnhancedLocation, 
  getLatitude, 
  getLongitude, 
  getAccuracy, 
  getSpeed, 
  isLocationValid 
} from '../../../utils/locationUtils';
import AdaptiveTrackingSettings from '../../../components/controls/AdaptiveTrackingSettings';
import TrackingStatusNotification from '../../../components/controls/TrackingStatusNotification';
import LocationAccuracySettings from '../../../components/controls/LocationAccuracySettings';
import { filterLocation } from '../../../utils/locationAccuracyFilter';
import PermissionsManager from '../../../utils/permissionsManager';

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

interface ExtendedConfirmationModalProps extends ConfirmationModalProps {
  showCancel?: boolean;
}

const ConfirmationModal: React.FC<ExtendedConfirmationModalProps> = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor = "#ef4444",
  showCancel = true,
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
          <View style={[
            modalStyles.modalButtonContainer,
            !showCancel && { justifyContent: 'center' }
          ]}>
            {showCancel && (
              <Pressable
                style={[modalStyles.modalButton, modalStyles.modalButtonCancel]}
                onPress={onCancel}
              >
                <Text style={modalStyles.modalButtonTextCancel}>
                  {cancelText}
                </Text>
              </Pressable>
            )}
            <Pressable
              style={[
                modalStyles.modalButton,
                modalStyles.modalButtonConfirm,
                { backgroundColor: confirmColor },
                !showCancel && { flex: 0.6 }
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

// Add this interface near the top of the file or with other interfaces
interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp?: number;
}

export default function EmployeeTrackingScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { user } = useAuth();
  const backgroundColor = useThemeColor("#f8fafc", "#0f172a");
  const textColor = useThemeColor("#334155", "#e2e8f0");
  const cardColor = useThemeColor("#ffffff", "#1e293b");

  // Add the global tracking context
  const { 
    checkTrackingStatus, 
    restartBackgroundTracking, 
    isInitialized,
    toggleBackgroundTracking
  } = useTracking();

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<Location.PermissionStatus | null>(null);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [isBackgroundTracking, setIsBackgroundTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSendingUpdate, setIsSendingUpdate] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<RoutePoint[]>([]);
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
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionModalProps, setPermissionModalProps] = useState({
    title: '',
    message: '',
    confirmText: 'OK',
    cancelText: 'Cancel',
    confirmColor: '#3b82f6',
    onConfirm: () => {},
    showCancel: false,
  });

  // References
  const mapRef = useRef<any>(null);
  const appStateRef = useRef(AppState.currentState);
  const lastLocationUpdateRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const lastPeriodicUpdateRef = useRef<number>(0);
  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null
  );
  const appStateSubscription = useRef<any>(null);
  const periodicUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const updateQueueRef = useRef<LocationObject[]>([]);
  const isMountedRef = useRef(true);
  const geofenceStatusRef = useRef<{ isInside: boolean; location: any } | null>(
    null
  );
  const locationHistoryRef = useRef<
    Array<{ latitude: number; longitude: number }>
  >([]);
  // Add reconnect timeout ref
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add this near other state declarations
  const [hasInitialized, setHasInitialized] = useState(false);
  const hasInitializedRef = useRef(false);

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
    setCurrentLocation,
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

  // Update initialization effect
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

  // Optimize queue processing function to be more efficient and avoid UI freezing
  useEffect(() => {
    if (updateQueue && updateQueue.length > 0 && !isProcessingUpdate) {
      const processQueue = async () => {
        try {
          if (!isMountedRef.current) return;

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

      processQueue();
    }
  }, [updateQueue, isProcessingUpdate, socket]);

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

  // Add function to validate location coordinates
  const isValidLocationCoordinate = useCallback((latitude?: number, longitude?: number): boolean => {
    return (
      typeof latitude === 'number' && 
      typeof longitude === 'number' && 
      !isNaN(latitude) && 
      !isNaN(longitude) && 
      latitude !== 0 && 
      longitude !== 0
    );
  }, []);

  // Add function to calculate distance between coordinates
  const calculateDistanceBetweenPoints = useCallback((
    lat1: number, lon1: number, lat2: number, lon2: number
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
    return R * c; // Distance in meters
  }, []);

  // Update mapProps definition to be more stable
  const mapProps = useMemo(
    () => ({
      showsUserLocation: true,
      followsUserLocation: trackingStatus === TrackingStatus.ACTIVE,
      initialRegion: currentLocation
        ? {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }
        : undefined,
      onRegionChangeComplete: debouncedRegionChange,
      // Add memoized geofences prop that won't change frequently
      geofences: processedGeofences,
      // Add memoized route coordinates
      routeCoordinates: routeCoordinates.length > 0 ? routeCoordinates : undefined,
      // Add currentGeofence
      currentGeofence: currentGeofence,
    }),
    [
      currentLocation, 
      trackingStatus, 
      debouncedRegionChange, 
      processedGeofences,
      routeCoordinates,
      currentGeofence
    ]
  );

  // Add state for accuracy settings modal
  const [showAccuracySettings, setShowAccuracySettings] = useState(false);

  // Add useCallback for filtering location updates with accuracy filter
  const processLocationUpdate = useCallback(async (location: Location.LocationObject): Promise<Location.LocationObject> => {
    if (!location) return location;

    try {
      // Filter location through accuracy filter
      const result = await filterLocation(location);
      
      if (result.isFiltered) {
        console.log(`Location filtered: ${result.reason}`);
        // Return the original location but mark it in debug UI if needed
        return location;
      }
      
      // Use the filtered/smoothed location
      return result.location;
    } catch (error) {
      console.error('Error filtering location:', error);
      return location;
    }
  }, []);

  // Update the handleLocationUpdate to use the processed location
  const handleLocationUpdate = useCallback(async (location: Location.LocationObject) => {
    try {
      // First validate location before any throttling
      if (!isValidLocationCoordinate(location.coords.latitude, location.coords.longitude)) {
        console.log('Invalid location coordinates, skipping update');
        return;
      }

      // Process location through accuracy filter first
      const processedLocation = await processLocationUpdate(location);
      
      // Implement smarter throttling:
      // 1. Always accept first location update
      // 2. Accept updates with better accuracy than previous
      // 3. Accept updates if enough time has passed
      const now = Date.now();
      const previousLocation = currentLocation;
      const timeSinceLastUpdate = lastLocationUpdateRef.current ? now - lastLocationUpdateRef.current : Infinity;
      
      // Determine if we should accept this update
      const shouldAcceptUpdate = 
        !lastLocationUpdateRef.current || // First update
        timeSinceLastUpdate >= 2000 || // Regular throttle interval
        (previousLocation && // Better accuracy than previous
         processedLocation.coords.accuracy && 
         previousLocation.coords.accuracy && 
         processedLocation.coords.accuracy < previousLocation.coords.accuracy);
      
      if (!shouldAcceptUpdate) {
        console.log('Throttling location update');
        return;
      }

      // Update the timestamp AFTER we've decided to use this location
      lastLocationUpdateRef.current = now;
      
      // Use existing function to set current location
      setCurrentLocation(createEnhancedLocation({
        coords: {
          latitude: processedLocation.coords.latitude,
          longitude: processedLocation.coords.longitude,
          accuracy: processedLocation.coords.accuracy ?? undefined,
          heading: processedLocation.coords.heading ?? undefined,
          speed: processedLocation.coords.speed ?? undefined,
          altitude: processedLocation.coords.altitude ?? undefined,
          altitudeAccuracy: processedLocation.coords.altitudeAccuracy ?? undefined
        },
        timestamp: processedLocation.timestamp
      }));
      
      // Create the new point with correct typing
      const newPoint: RoutePoint = {
        latitude: processedLocation.coords.latitude,
        longitude: processedLocation.coords.longitude,
        timestamp: new Date(processedLocation.timestamp).getTime()
      };

      // Only update route on active tracking and sufficient movement
      if (trackingStatus === TrackingStatus.ACTIVE) {
        setRouteCoordinates((prev) => {
          // If no previous route or tracking is not active, start a new route
          if (prev.length === 0) {
            return [newPoint];
          }

          // Get the last point in the route
          const lastPoint = prev[prev.length - 1];
          
          // Skip point if it's too close to the last one (less than 5 meters)
          if (lastPoint && 
              calculateDistanceBetweenPoints(
                lastPoint.latitude, 
                lastPoint.longitude, 
                newPoint.latitude, 
                newPoint.longitude
              ) < 5) {
            return prev;
          }

          // Add the point to the route, enforcing a maximum size for memory efficiency
          const MAX_ROUTE_POINTS = 500;
          const newRoute = [...prev, newPoint];
          
          // If route is too long, trim it (keep the most recent points)
          if (newRoute.length > MAX_ROUTE_POINTS) {
            return newRoute.slice(-MAX_ROUTE_POINTS);
          }
          
          return newRoute;
        });

        // Update location history with rate limiting
        if (locationHistoryRef.current.length === 0 || 
            calculateDistanceBetweenPoints(
              locationHistoryRef.current[locationHistoryRef.current.length - 1].latitude,
              locationHistoryRef.current[locationHistoryRef.current.length - 1].longitude,
              processedLocation.coords.latitude,
              processedLocation.coords.longitude
            ) > 10) { // Only add if moved more than 10 meters
              
          locationHistoryRef.current.push({
            latitude: processedLocation.coords.latitude,
            longitude: processedLocation.coords.longitude,
          });

          // Enforce maximum size for memory efficiency
          if (locationHistoryRef.current.length > 500) {
            locationHistoryRef.current = locationHistoryRef.current.slice(-500);
          }
        }
      }
    } catch (error) {
      console.error("Error processing location update:", error);
    }
  }, [trackingStatus, isValidLocationCoordinate, calculateDistanceBetweenPoints, processLocationUpdate, setCurrentLocation, currentLocation]);

  // Add a route cleanup effect to ensure routes are reset when tracking changes
  useEffect(() => {
    if (trackingStatus === TrackingStatus.INACTIVE) {
      // Keep the final route displayed but don't add new points
    } else if (trackingStatus === TrackingStatus.ACTIVE && routeCoordinates.length === 0) {
      // Reset route and tracking location when starting a new session
      setRouteCoordinates([]);
      setInitialTrackingLocation(null);
      
      // If we have a current location, initialize the route with it
      if (currentLocation && 
          isValidLocationCoordinate(
            currentLocation.coords.latitude, 
            currentLocation.coords.longitude
          )) {
        setRouteCoordinates([{
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          timestamp: Date.now()
        }]);
      }
    }
  }, [trackingStatus, currentLocation, isValidLocationCoordinate]);

  // Update the useEffect to use the updated handleLocationUpdate function
  useEffect(() => {
    if (currentLocation && handleLocationUpdate) {
      // Create a standardized location object to ensure consistent handling
      const locationData = {
        coords: {
          latitude: getLatitude(currentLocation),
          longitude: getLongitude(currentLocation),
          accuracy: getAccuracy(currentLocation) ?? null,
          altitude: currentLocation.coords?.altitude ?? null,
          altitudeAccuracy: currentLocation.coords?.altitudeAccuracy ?? null,
          heading: currentLocation.coords?.heading ?? null,
          speed: currentLocation.coords?.speed ?? null
        },
        timestamp: currentLocation.timestamp || Date.now()
      };
      
      // Only process valid locations
      if (isLocationValid(locationData)) {
        handleLocationUpdate(locationData);
      }
    }
  }, [currentLocation, handleLocationUpdate]);

  // Update the immediate location updates effect with proper type handling for debounce
  useEffect(() => {
    // Only process location updates when there's a significant change and we're actively tracking
    const processLocation = () => {
      if (
        currentLocation &&
        socket &&
        trackingStatus === TrackingStatus.ACTIVE &&
        !isProcessingUpdate &&
        isMountedRef.current
      ) {
        // Validate location data before sending
        if (!validateLocationData(currentLocation)) {
          console.warn("Skipping location update due to invalid data");
          return;
        }
        
        // Check if update is too frequent - reduce from 3s to 2s for more frequent updates
        const now = Date.now();
        if (lastUpdateTimeRef.current && now - lastUpdateTimeRef.current < 2000) {
          return; // Skip if less than 2 seconds since last update (reduced from 3s)
        }
        
        lastUpdateTimeRef.current = now;
        
        // Attempt to restore socket connection if disconnected
        if (!socket.connected) {
          console.log("Socket disconnected, attempting to reconnect");
          socket.connect();
        }
        
        // Get fresh battery level for critical updates
        let currentBatteryLevel = batteryLevel;
        Battery.getBatteryLevelAsync().then(level => {
          if (typeof level === 'number' && !isNaN(level)) {
            currentBatteryLevel = Math.round(level * 100);
          }
          
          // After getting battery, emit the update
          emitLocationUpdate(currentBatteryLevel);
        }).catch(() => {
          // On battery error, still emit with existing level
          emitLocationUpdate(batteryLevel);
        });
        
        // Function to emit the update with current battery level
        function emitLocationUpdate(batteryLevel: number) {
          if (!socket || !socket.connected || !isMountedRef.current || !currentLocation) return;
          
          socket.emit("location:update", {
            latitude: currentLocation.coords?.latitude,
            longitude: currentLocation.coords?.longitude,
            accuracy: currentLocation.coords?.accuracy,
            timestamp: new Date().toISOString(),
            batteryLevel: batteryLevel,
            isMoving:
              currentLocation.coords?.speed !== null &&
              currentLocation.coords?.speed !== undefined &&
              (currentLocation.coords?.speed || 0) > 0.5,
            trackingStatus: trackingStatus,
            is_tracking_active: true,
            isActive: true,
            isInGeofence: isInGeofence,
            currentGeofenceId: currentGeofence?.id,
            userId: user?.id,
            employeeId: user?.id,
            sessionId: trackingSessionId,
          });
    
          console.log("Location update emitted via socket with status:", {
            isActive: true,
            batteryLevel: batteryLevel
          });
        }
      }
    };
    
    // Debounced version of processLocation - reduce from 3s to 2s for more frequent updates
    const debouncedProcessLocation = debounce(processLocation, 2000);
    
    // Call the debounced function when currentLocation changes
    if (trackingStatus === TrackingStatus.ACTIVE && currentLocation) {
      debouncedProcessLocation();
    }
    
    // Clean up debounce on unmount
    return () => {
      // @ts-ignore - TypeScript doesn't know about the internal timer
      if (debouncedProcessLocation.clear) {
        // @ts-ignore
        debouncedProcessLocation.clear();
      }
    };
  }, [
    currentLocation,
    trackingStatus,
    socket,
    batteryLevel,
    user?.id,
    trackingSessionId,
    isProcessingUpdate,
    isInGeofence,
    currentGeofence,
  ]);

  // Add a cleanup effect to ensure tracking stops when component unmounts
  useEffect(() => {
    // Set mount flag
    isMountedRef.current = true;
    
    // Define cleanup function
    const cleanup = () => {
      console.log('Tracking component unmounting, performing cleanup');
      isMountedRef.current = false;
      
      // Clear all intervals
      if (periodicUpdateIntervalRef.current) {
        clearInterval(periodicUpdateIntervalRef.current);
        periodicUpdateIntervalRef.current = null;
      }
      
      // Cancel location subscription
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      
      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Clear any other timeouts
      for (const key in timeouts) {
        if (timeouts[key]) {
          clearTimeout(timeouts[key]);
          timeouts[key] = null;
        }
      }
      
      // Reset queue
      updateQueueRef.current = [];
      setUpdateQueue([]);
      
      // Clean up any app state listeners
      if (appStateSubscription.current) {
        appStateSubscription.current.remove();
      }
      
      // Note: We don't stop background tracking here
      // That should persist even after component unmounts
    };
    
    // Store active timeouts for cleanup
    const timeouts: { [key: string]: NodeJS.Timeout | null } = {};
    
    return cleanup;
  }, []);

  // Move sendPeriodicUpdate outside the useEffect to make it accessible to the startForegroundTracking function
  const sendPeriodicUpdate = useCallback(async () => {
    if (
      trackingStatus === TrackingStatus.ACTIVE &&
      socket &&
      isMountedRef.current
    ) {
      try {
        // Reduce throttling from 10 seconds to 5 seconds for more frequent updates
        const now = Date.now();
        if (lastPeriodicUpdateRef.current && now - lastPeriodicUpdateRef.current < 5000) {
          return; // Skip update if too frequent, reduced from 10s to 5s
        }
        
        lastPeriodicUpdateRef.current = now;
        
        // Get fresh battery level for more accurate reporting
        let currentBatteryLevel = batteryLevel;
        try {
          const batteryResult = await Battery.getBatteryLevelAsync();
          if (typeof batteryResult === 'number' && !isNaN(batteryResult)) {
            currentBatteryLevel = Math.round(batteryResult * 100);
          }
        } catch (e) {
          console.log('Error getting battery:', e);
          // Continue with existing battery level
        }
        
        // Check socket connection and reconnect if needed
        if (!socket.connected) {
          console.log('Socket disconnected, attempting to reconnect before sending update');
          socket.connect();
          // Add a short delay to allow connection to establish
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Prepare data once to avoid recreating the same object
        const updateData = {
          latitude: currentLocation?.coords?.latitude,
          longitude: currentLocation?.coords?.longitude,
          accuracy: currentLocation?.coords?.accuracy,
          timestamp: new Date().toISOString(),
          batteryLevel: currentBatteryLevel,
          isMoving:
            currentLocation?.coords?.speed !== null &&
            currentLocation?.coords?.speed !== undefined &&
            currentLocation?.coords?.speed > 0.5,
          trackingStatus: TrackingStatus.ACTIVE,
          is_tracking_active: true,
          isActive: true,
          isInGeofence: isInGeofence,
          currentGeofenceId: currentGeofence?.id,
          userId: user?.id,
          employeeId: user?.id,
          sessionId: trackingSessionId,
        };
        
        // If location is valid, emit to socket
        if (updateData.latitude && updateData.longitude) {
          console.log('Emitting periodic location update with status:', 
            { isActive: true, batteryLevel: currentBatteryLevel });
          socket.emit("location:update", updateData);
        } else {
          console.log('Invalid location data, skipping periodic update');
        }
        
        // Update last location timestamp
        lastLocationUpdateRef.current = now;
      } catch (error) {
        console.error("Error in periodic update:", error);
      }
    }
  }, [
    trackingStatus,
    socket,
    currentLocation,
    batteryLevel,
    user?.id,
    trackingSessionId,
    isInGeofence,
    currentGeofence
  ]);

  // Use a more efficient periodic update with reduced frequency
  useEffect(() => {
    let updateInterval: NodeJS.Timeout | null = null;

    if (trackingStatus === TrackingStatus.ACTIVE && isMountedRef.current) {
      // Immediately clear any existing interval to prevent duplicates
      if (periodicUpdateIntervalRef.current) {
        clearInterval(periodicUpdateIntervalRef.current);
        periodicUpdateIntervalRef.current = null;
      }
      
      // Send initial update immediately when starting tracking
      sendPeriodicUpdate();
      
      // Send updates every 15 seconds - decreased from 20s for more frequent updates
      updateInterval = setInterval(() => {
        // Remove InteractionManager to ensure updates happen immediately
        // Only check if component is still mounted
        if (isMountedRef.current) {
          sendPeriodicUpdate();
        }
      }, 15000); // 15-second interval (reduced from 20s)
      
      // Store the interval in ref for cleanup
      periodicUpdateIntervalRef.current = updateInterval;
    }

    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
      
      // Always clean up the ref
      if (periodicUpdateIntervalRef.current) {
        clearInterval(periodicUpdateIntervalRef.current);
        periodicUpdateIntervalRef.current = null;
      }
    };
  }, [
    trackingStatus,
    sendPeriodicUpdate
  ]);

  // Update background tracking status periodically
  useEffect(() => {
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

    // Only update status when tracking status changes
    updateBackgroundStatus();

    // Reduce check frequency to every 30 seconds instead of 10
    const interval = setInterval(updateBackgroundStatus, 30000);

    return () => clearInterval(interval);
  }, [trackingStatus]);

  // Watch for AppState changes to sync background tracking status
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
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
      }
    );

    // Store subscription in ref for cleanup
    appStateSubscription.current = subscription;

    return () => {
      // Ensure we properly clean up the subscription
      if (appStateSubscription.current) {
        appStateSubscription.current.remove();
      }
    };
  }, [trackingStatus]);

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

  // Fix the tracking heartbeat
  const toggleTracking = async () => {
    if (isButtonDisabled) return;
    
    // Debounce button presses
    setIsButtonDisabled(true);
    
    try {
      // Handle state transitions based on current state
      switch(trackingStatus) {
        case TrackingStatus.INACTIVE:
        case TrackingStatus.ERROR:
          // Starting tracking
          console.log('Starting tracking');
          
          // Set state before starting location updates to avoid race conditions
          setTrackingStatus(TrackingStatus.ACTIVE);
          
          // Start foreground tracking
          await startForegroundTracking();
          
          // Start location updates with optimized settings
          await startLocationUpdates();
          
          // If background tracking is enabled, ensure it's running through the context
          if (backgroundTrackingEnabled && toggleBackgroundTracking) {
            await toggleBackgroundTracking(true).catch(err => {
              console.error('Failed to activate background tracking:', err);
            });
          }
          
          // Update global tracking state
          await AsyncStorage.setItem('trackingStatus', TrackingStatus.ACTIVE);
          
          // Immediately get current location for immediate feedback
          getCurrentLocation();
          
          // Emit an immediate status update to ensure real-time reflection
          if (socket) {
            // Get current battery level for accurate status update
            let currentBatteryLevel = batteryLevel;
            try {
              const level = await Battery.getBatteryLevelAsync();
              if (typeof level === 'number' && !isNaN(level)) {
                currentBatteryLevel = Math.round(level * 100);
              }
            } catch (e) {
              // Use existing battery level if there's an error
            }
            
            // First emit tracking status update
            socket.emit('tracking:status', {
              userId: user?.id,
              employeeId: user?.id,
              sessionId: trackingSessionId || `session_${Date.now()}`,
              status: TrackingStatus.ACTIVE,
              isActive: true,
              batteryLevel: currentBatteryLevel,
              timestamp: new Date().toISOString()
            });
            
            // Then emit a location update if we have current location
            if (currentLocation) {
              socket.emit('location:update', {
                latitude: currentLocation.coords?.latitude,
                longitude: currentLocation.coords?.longitude, 
                accuracy: currentLocation.coords?.accuracy,
                timestamp: new Date().toISOString(),
                batteryLevel: currentBatteryLevel,
                isMoving: false, // Initially not moving
                trackingStatus: TrackingStatus.ACTIVE,
                is_tracking_active: true,
                isActive: true,
                isInGeofence: isInGeofence,
                currentGeofenceId: currentGeofence?.id,
                userId: user?.id,
                employeeId: user?.id,
                sessionId: trackingSessionId || `session_${Date.now()}`
              });
            }
            
            console.log('Emitted tracking start status via socket');
          }
          break;
          
        case TrackingStatus.ACTIVE:
          // Pausing tracking
          console.log('Pausing tracking');
          setTrackingStatus(TrackingStatus.PAUSED);
          
          // Stop foreground updates but keep background running if enabled
          if (periodicUpdateIntervalRef.current) {
            clearInterval(periodicUpdateIntervalRef.current);
            periodicUpdateIntervalRef.current = null;
          }
          
          // Stop location updates subscription
          if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
          }
          
          // Update global tracking state
          await AsyncStorage.setItem('trackingStatus', TrackingStatus.PAUSED);
          
          // Emit paused status update
          if (socket) {
            // Emit tracking paused status
            socket.emit('tracking:status', {
              userId: user?.id,
              employeeId: user?.id,
              sessionId: trackingSessionId,
              status: TrackingStatus.PAUSED,
              isActive: false,
              batteryLevel: batteryLevel,
              timestamp: new Date().toISOString()
            });
            
            // Also emit location update with paused status
            if (currentLocation) {
              socket.emit('location:update', {
                latitude: currentLocation.coords?.latitude,
                longitude: currentLocation.coords?.longitude,
                accuracy: currentLocation.coords?.accuracy,
                timestamp: new Date().toISOString(),
                batteryLevel: batteryLevel,
                isMoving: false,
                trackingStatus: TrackingStatus.PAUSED,
                is_tracking_active: false,
                isActive: false,
                isInGeofence: isInGeofence,
                currentGeofenceId: currentGeofence?.id,
                userId: user?.id,
                employeeId: user?.id,
                sessionId: trackingSessionId
              });
            }
            
            console.log('Emitted tracking paused status via socket');
          }
          break;
          
        case TrackingStatus.PAUSED:
          // Resuming tracking
          console.log('Resuming tracking');
          setTrackingStatus(TrackingStatus.ACTIVE);
          
          // Resume foreground updates
          await startForegroundTracking();
          
          // Restart location updates
          await startLocationUpdates();
          
          // Update global tracking state
          await AsyncStorage.setItem('trackingStatus', TrackingStatus.ACTIVE);
          
          // Immediately get current location
          getCurrentLocation();
          
          // Emit resumed status update
          if (socket) {
            // Emit tracking resumed status
            socket.emit('tracking:status', {
              userId: user?.id,
              employeeId: user?.id,
              sessionId: trackingSessionId,
              status: TrackingStatus.ACTIVE,
              isActive: true,
              batteryLevel: batteryLevel,
              timestamp: new Date().toISOString()
            });
            
            // Get current location and emit update with resumed status
            if (currentLocation) {
              socket.emit('location:update', {
                latitude: currentLocation.coords?.latitude,
                longitude: currentLocation.coords?.longitude,
                accuracy: currentLocation.coords?.accuracy,
                timestamp: new Date().toISOString(),
                batteryLevel: batteryLevel,
                isMoving: false, // Initially not moving on resume
                trackingStatus: TrackingStatus.ACTIVE,
                is_tracking_active: true,
                isActive: true,
                isInGeofence: isInGeofence,
                currentGeofenceId: currentGeofence?.id,
                userId: user?.id,
                employeeId: user?.id,
                sessionId: trackingSessionId
              });
            }
            
            console.log('Emitted tracking resumed status via socket');
          }
          break;
      }
      
    } catch (error) {
      console.error('Error in toggleTracking:', error);
      setTrackingStatus(TrackingStatus.ERROR);
      setError(`Error toggling tracking: ${String(error)}`);
    } finally {
      // Re-enable button after slight delay to prevent double-taps
      setTimeout(() => setIsButtonDisabled(false), 800);
    }
  };

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

  // Update the handleBackgroundToggle function to use the context
  const handleBackgroundToggle = async (isEnabled: boolean) => {
    try {
      setIsLoading(true);

      // Use the context to toggle background tracking
      const success = await toggleBackgroundTracking(isEnabled);

      if (success) {
        setBackgroundTrackingEnabled(isEnabled);
        
        // Store the setting
        await AsyncStorage.setItem(
          "backgroundTrackingEnabled",
          JSON.stringify(isEnabled)
        );
        
        showToast(
          `Background tracking ${isEnabled ? "enabled" : "disabled"}`,
          "success"
        );
      } else {
        showToast(
          `Failed to ${isEnabled ? "enable" : "disable"} background tracking`,
          "error"
        );
      }
    } catch (error) {
      console.error("Error toggling background tracking:", error);
      showToast("Error updating background tracking", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Add a helper method for foreground tracking
  const UPDATE_INTERVAL_MS = 10000; // 10 seconds
  const startForegroundTracking = async () => {
    try {
      // Start or resume periodic updates
      if (periodicUpdateIntervalRef.current) {
        clearInterval(periodicUpdateIntervalRef.current);
      }
      
      // Immediately send one update
      await sendPeriodicUpdate();
      
      // Then set up the interval
      periodicUpdateIntervalRef.current = setInterval(
        sendPeriodicUpdate,
        UPDATE_INTERVAL_MS
      );
      
      console.log(`Foreground tracking started with interval: ${UPDATE_INTERVAL_MS}ms`);
      return true;
    } catch (error) {
      console.error("Error starting foreground tracking:", error);
      return false;
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
      updateBackgroundTrackingStatus();

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

  // Helper function to show permission modal
  const showPermissionAlert = (
    title: string,
    message: string,
    options: {
      confirmText?: string;
      cancelText?: string;
      confirmColor?: string;
      onConfirm?: () => void;
      onCancel?: () => void;
      showCancel?: boolean;
    } = {}
  ) => {
    setPermissionModalProps({
      title,
      message,
      confirmText: options.confirmText || 'OK',
      cancelText: options.cancelText || 'Cancel',
      confirmColor: options.confirmColor || '#3b82f6',
      onConfirm: options.onConfirm || (() => setShowPermissionModal(false)),
      showCancel: options.showCancel || false,
    });
    setShowPermissionModal(true);
  };

  // Refresh all permissions (location foreground, background, and notifications)
  const refreshPermissions = async () => {
    try {
      console.log('Refreshing all permissions...');
      
      // Check location services first
      const locationServicesEnabled = await checkLocationServicesStatus();
      setIsLocationEnabled(locationServicesEnabled);

      if (!locationServicesEnabled) {
        showPermissionAlert(
          "Location Services Required",
          "Please enable location services in your device settings to continue.",
          {
            confirmText: "Open Settings",
            cancelText: "Cancel",
            confirmColor: "#f59e0b",
            onConfirm: () => {
              setShowPermissionModal(false);
              PermissionsManager.openAppSettings();
            },
            onCancel: () => setShowPermissionModal(false),
            showCancel: true,
          }
        );
        return;
      }

      // Request foreground location permission
      const foregroundStatus = await PermissionsManager.requestLocationPermissions();
      
      if (foregroundStatus !== 'granted') {
        showPermissionAlert(
          "Location Permission Required",
          "Foreground location permission is required for tracking. Please allow location access in the next prompt or in settings.",
          {
            confirmText: "Open Settings",
            cancelText: "Cancel",
            confirmColor: "#ef4444",
            onConfirm: () => {
              setShowPermissionModal(false);
              PermissionsManager.openAppSettings();
            },
            onCancel: () => setShowPermissionModal(false),
            showCancel: true,
          }
        );
        return;
      }

      // Request background location permission (only if foreground is granted)
      const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
      setPermissionStatus(backgroundPermission.status);

      // Request notification permissions
      const notificationStatus = await PermissionsManager.requestNotificationPermissions();
      
      // Show success or partial success message
      if (foregroundStatus === 'granted' && backgroundPermission.granted && notificationStatus === 'granted') {
        showPermissionAlert(
          "Permissions Updated",
          "All permissions have been granted successfully!",
          {
            confirmText: "OK",
            confirmColor: "#10b981",
            onConfirm: () => setShowPermissionModal(false),
          }
        );
      } else if (foregroundStatus === 'granted') {
        const deniedPermissions = [];
        if (!backgroundPermission.granted) deniedPermissions.push('Background Location');
        if (notificationStatus !== 'granted') deniedPermissions.push('Notifications');
        
        showPermissionAlert(
          "Permissions Partially Updated",
          `Foreground location permission granted. ${deniedPermissions.length > 0 ? `Still missing: ${deniedPermissions.join(', ')}` : ''}`,
          {
            confirmText: deniedPermissions.length > 0 ? "Open Settings" : "OK",
            cancelText: "OK",
            confirmColor: deniedPermissions.length > 0 ? "#f59e0b" : "#10b981",
            onConfirm: () => {
              setShowPermissionModal(false);
              if (deniedPermissions.length > 0) {
                PermissionsManager.openAppSettings();
              }
            },
            onCancel: () => setShowPermissionModal(false),
            showCancel: deniedPermissions.length > 0,
          }
        );
      }
      
      // Re-check all permissions to update the UI
      await checkPermissions();
      
    } catch (error) {
      console.error('Error refreshing permissions:', error);
      showPermissionAlert(
        "Permission Error",
        "There was an error requesting permissions. Please try again or check your settings manually.",
        {
          confirmText: "Open Settings",
          cancelText: "OK",
          confirmColor: "#ef4444",
          onConfirm: () => {
            setShowPermissionModal(false);
            PermissionsManager.openAppSettings();
          },
          onCancel: () => setShowPermissionModal(false),
          showCancel: true,
        }
      );
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
    if (refreshing) return; // Prevent multiple simultaneous refreshes
    
    setRefreshing(true);
    
    try {
      // Use Promise.all to run independent operations in parallel
      const [locationResult, batteryResult] = await Promise.all([
        // Get current location using Expo Location
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // Use balanced accuracy to save battery
          mayShowUserSettingsDialog: false, // Don't show settings dialog
        }).catch(err => {
          console.warn('Error getting current position:', err);
          return null;
        }),
        
        // Update battery level
        Battery.getBatteryLevelAsync().catch(err => {
          console.warn('Error getting battery level:', err);
          return null;
        })
      ]);

      // Update battery level if available
      if (batteryResult !== null) {
        const batteryPercent = Math.round(batteryResult * 100);
        useLocationStore.setState({ batteryLevel: batteryPercent });
      }

      // Process location update if available
      if (locationResult) {
        // Process through the accuracy filter
        const processedLocation = await processLocationUpdate(locationResult);
        
        // Update store with new location
        useLocationStore.setState({
          currentLocation: createEnhancedLocation(processedLocation)
        });
        
        // Check geofence status with new location
        if (isLocationInAnyGeofence) {
          // Convert Expo Location object to our app's Location type format
          const appLocationObj: AppLocation = {
            latitude: processedLocation.coords.latitude,
            longitude: processedLocation.coords.longitude,
            accuracy: processedLocation.coords.accuracy,
            timestamp: processedLocation.timestamp,
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

        // If socket exists and connected, send a manual update
        if (socket?.connected) {
          socket.emit("location:update", {
            latitude: processedLocation.coords.latitude,
            longitude: processedLocation.coords.longitude,
            accuracy: processedLocation.coords.accuracy,
            timestamp: new Date().toISOString(),
            batteryLevel: batteryResult !== null ? Math.round(batteryResult * 100) : batteryLevel,
            isMoving: processedLocation.coords.speed !== null && processedLocation.coords.speed > 0.5,
            trackingStatus: trackingStatus,
            is_tracking_active: trackingStatus === TrackingStatus.ACTIVE,
            isActive: trackingStatus === TrackingStatus.ACTIVE,
            isInGeofence: isInGeofence,
            currentGeofenceId: currentGeofence?.id,
            userId: user?.id,
            employeeId: user?.id,
            sessionId: trackingSessionId,
            refreshed: true // Flag to indicate this is a manual refresh
          });
        }
      }
      
      // Check background tracking status
      await updateBackgroundTrackingStatus();
      
    } catch (error) {
      console.error("Error refreshing data:", error);
      setError("Failed to refresh tracking data. Pull down to try again.");
    } finally {
      setRefreshing(false);
    }
  }, [
    refreshing,
    isLocationInAnyGeofence,
    setIsInGeofence,
    getCurrentGeofence,
    socket,
    trackingStatus,
    batteryLevel,
    user?.id,
    trackingSessionId,
    isInGeofence,
    currentGeofence,
    processLocationUpdate,
    updateBackgroundTrackingStatus
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

  // Start location updates with throttling
  const startLocationUpdates = useCallback(async () => {
    if (locationSubscription.current) {
      console.log('Location subscription already active, removing first');
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }

    try {
      // Use a moderate frequency to balance accuracy and battery usage
      const updateInterval = 20000; // 20 seconds
      
      // Use balanced accuracy settings unless high accuracy was explicitly requested
      const accuracy = Location.Accuracy.Balanced;
      
      // Configure the subscription with throttling and distance filter
      const subscription = await Location.watchPositionAsync(
        {
          accuracy,
          timeInterval: updateInterval,
          distanceInterval: 15, // Only update if moved at least 15 meters
          mayShowUserSettingsDialog: false, // Avoid showing settings dialog automatically
        },
        (newLocation) => {
          // Avoid processing if component unmounted
          if (!isMountedRef.current) return;
          
          // Validate location before processing
          if (!isValidLocationCoordinate(
            newLocation.coords.latitude,
            newLocation.coords.longitude
          )) {
            console.log('Invalid location data received, skipping');
            return;
          }
          
          // Use the handler function which already implements throttling
          handleLocationUpdate(newLocation);
        }
      );

      locationSubscription.current = subscription;
      console.log('Started location updates with optimized settings');
    } catch (error) {
      console.error('Error starting location updates:', error);
      setError(`Location tracking error: ${String(error)}`);
    }
  }, [handleLocationUpdate, setError, isValidLocationCoordinate]);

  // Create a memoized map component
  const MemoizedMap = useMemo(() => {
    // Skip rendering map if we have no location data
    if (!currentLocation) return null;
    
    return (
      <View style={styles.mapContainer}>
        <LiveTrackingMap
          {...mapProps}
          containerStyle={styles.map}
          geofences={processedGeofences}
          currentGeofence={currentGeofence}
          routeCoordinates={routeCoordinates}
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
    );
  }, [
    currentLocation,
    mapProps,
    processedGeofences,
    currentGeofence,
    routeCoordinates,
    cardColor,
    getStatusColor,
    textColor,
    getStatusText,
    socketConnected,
    isBackgroundTracking,
    isInGeofence,
    currentGeofenceName
  ]);

  // Add a more robust socket connection handler
  useEffect(() => {
    // Only set up socket handling if we have a valid socket
    if (!socket) return;
    
    let reconnectTimeout: NodeJS.Timeout | null = null;
    
    // Track connection state
    let previouslyConnected = false;
    
    // Setup connection handlers
    const handleConnect = () => {
      console.log('Socket connected for location tracking:', socket.id);
      
      // Emit authentication event if user exists
      if (user?.id) {
        socket.emit('authenticate', { 
          userId: user.id, 
          role: user.role 
        });
        console.log('Sent authentication to socket');
      }
      
      // If previously connected and reconnected, try to restore tracking
      if (previouslyConnected && trackingStatus === TrackingStatus.ACTIVE) {
        console.log('Socket reconnected, resuming tracking data');
        if (currentLocation) {
          // Send current location with restored flag
          socket.emit('location:update', {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            accuracy: currentLocation.coords.accuracy,
            timestamp: new Date().toISOString(),
            batteryLevel,
            isActive: true,
            userId: user?.id,
            employeeId: user?.id,
            sessionId: trackingSessionId,
            restored: true
          });
        }
      }
      
      previouslyConnected = true;
      setError(null);
    };
    
    const handleDisconnect = (reason: string) => {
      console.log(`Socket disconnected: ${reason}`);
      
      // Schedule reconnect attempt if tracking is active
      if (trackingStatus === TrackingStatus.ACTIVE) {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        
        reconnectTimeout = setTimeout(() => {
          console.log('Attempting to reconnect socket...');
          if (socket && !socket.connected) {
            socket.connect();
          }
        }, 5000);
      }
      
      // Only show error if tracking is active
      if (trackingStatus === TrackingStatus.ACTIVE) {
        setError('Connection to server lost. Reconnecting...');
      }
    };
    
    const handleError = (err: Error) => {
      console.error('Socket error:', err);
      setError(`Connection error: ${err.message}`);
    };
    
    // Set up event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('error', handleError);
    
    // Clean up on component unmount
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('error', handleError);
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [socket, user, currentLocation, trackingStatus, trackingSessionId, batteryLevel]);

  // Add memoized status cards to reduce re-renders
  const MemoizedStatusCards = useMemo(() => (
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
              {formatCoordinate(currentLocation?.coords?.latitude)}
            </Text>
          </View>
          <View style={styles.locationDetail}>
            <Text style={[styles.locationLabel, { color: textColor }]}>
              Longitude:
            </Text>
            <Text style={[styles.locationValue, { color: textColor }]}>
              {formatCoordinate(currentLocation?.coords?.longitude)}
            </Text>
          </View>
          <View style={styles.locationDetail}>
            <Text style={[styles.locationLabel, { color: textColor }]}>
              Accuracy:
            </Text>
            <Text style={[styles.locationValue, { color: textColor }]}>
              {currentLocation?.coords?.accuracy
                ? `${Math.round(currentLocation.coords.accuracy)}m`
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
              {permissionStatus !== "granted" && (
                <TouchableOpacity
                  onPress={refreshPermissions}
                  style={{
                    marginLeft: 8,
                    padding: 4,
                    borderRadius: 12,
                    backgroundColor: colorScheme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                  }}
                >
                  <Ionicons 
                    name="refresh-outline" 
                    size={16} 
                    color={colorScheme === 'dark' ? '#60A5FA' : '#3B82F6'} 
                  />
                </TouchableOpacity>
              )}
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
  ), [
    cardColor, 
    textColor, 
    currentLocation, 
    trackingStatus, 
    batteryLevel,
    isInGeofence,
    currentGeofenceName,
    permissionStatus,
    backgroundTrackingEnabled,
    formatCoordinate
  ]);

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
        {MemoizedMap}

        <View className="px-4">
          {/* <View className="flex-row justify-between items-center">
            <BackgroundTrackingNotification
              onPress={goToShiftManagement}
              autoHide={false}
            />
          </View> */}

          {/* Status Cards */}
          {MemoizedStatusCards}

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

            {/* Test button to diagnose tracking issues - DEV ONLY */}
            {__DEV__ && (
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
            )}

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

          {/* Advanced Settings Toggle Button */}
          <TouchableOpacity
            style={[styles.advancedSettingsButton, { backgroundColor: backgroundColor }]}
            onPress={() => setShowAdvancedSettings(!showAdvancedSettings)}
          >
            <Ionicons 
              name={showAdvancedSettings ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={textColor} 
            />
            <Text style={[styles.advancedSettingsText, { color: textColor }]}>
              {showAdvancedSettings ? "Hide Advanced Settings" : "Show Advanced Settings"}
            </Text>
          </TouchableOpacity>

          {/* Advanced Settings Panel */}
          {showAdvancedSettings && (
            <View style={styles.advancedSettingsContainer}>
              <AdaptiveTrackingSettings 
                onSettingsChanged={() => {
                  // Optional: Do something when settings change
                  console.log('Adaptive tracking settings changed');
                }} 
              />
            </View>
          )}
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

      {/* Permission Modal */}
      <ConfirmationModal
        visible={showPermissionModal}
        title={permissionModalProps.title}
        message={permissionModalProps.message}
        onConfirm={permissionModalProps.onConfirm}
        onCancel={() => setShowPermissionModal(false)}
        confirmText={permissionModalProps.confirmText}
        cancelText={permissionModalProps.cancelText}
        confirmColor={permissionModalProps.confirmColor}
        showCancel={permissionModalProps.showCancel}
      />

      {/* Add modal for accuracy settings */}
      <Modal 
        visible={showAccuracySettings} 
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAccuracySettings(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <LocationAccuracySettings onClose={() => setShowAccuracySettings(false)} />
          </View>
        </View>
      </Modal>
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
  advancedSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderStyle: 'dashed',
  },
  advancedSettingsText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  advancedSettingsContainer: {
    marginTop: 16,
  },
  statusContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  settingsButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '90%',
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
  },
});