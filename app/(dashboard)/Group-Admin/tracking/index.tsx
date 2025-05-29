import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  TextInput,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons, Fontisto } from "@expo/vector-icons";
import * as Location from "expo-location";
import axios from "axios";
import { RFValue } from "react-native-responsive-fontsize";
import { useAuth } from "../../../context/AuthContext";
import { useColorScheme, useThemeColor } from "../../../hooks/useColorScheme";
import { useGeofencing } from "../../../hooks/useGeofencing";
import { useSocket } from "../../../hooks/useSocket";
import { useTracking } from "../../../context/TrackingContext";
import useLocationStore, {
  useLocationTrackingStore,
} from "../../../store/locationStore";
import useGeofenceStore from "../../../store/geofenceStore";
import {
  TrackingUser,
  TrackingStatus,
  GeofenceRegion,
  EmployeeLocationData,
} from "../../../types/liveTracking";
import useMapStore from "../../../store/useMapStore";
import useAdminLocationStore from "../../../store/adminLocationStore";
import { Point, cleanRoute, getRouteStats, formatDistance } from "../../../utils/routeUtils";

import LiveTrackingMap from "../../shared/components/map/LiveTrackingMap";
import { showTokenDebugAlert } from "../../../utils/tokenDebugger";
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';

// Add the MAX_ROUTE_POINTS constant to limit memory usage
const MAX_ROUTE_POINTS = 500;

// Add a helper function to calculate distance between two coordinates
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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
};

// Add validation function for coordinates
const isValidCoordinate = (latitude: number, longitude: number): boolean => {
  return (
    typeof latitude === 'number' && 
    typeof longitude === 'number' && 
    !isNaN(latitude) && 
    !isNaN(longitude) && 
    latitude !== 0 && 
    longitude !== 0
  );
};

// Create a custom socket hook that handles employee location updates
const useAdminSocket = () => {
  const { socket: socketInstance, isConnected } = useSocket({
    onConnect: () => {
      console.log("Socket connected for group admin tracking");
    },
    onDisconnect: () => {
      console.log("Socket disconnected for group admin tracking");
    },
    // We're not using the default location handler
    onLocationUpdate: () => {},
    onError: (error) => {
      console.error("Socket error:", error);
    },
  });

  // Return the socket instance and connection status
  return { socket: socketInstance, isConnected };
};

export default function GroupAdminTrackingDashboard() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { user, token } = useAuth();
  const backgroundColor = useThemeColor("#f8fafc", "#0f172a");
  const textColor = useThemeColor("#334155", "#e2e8f0");
  const cardColor = useThemeColor("#ffffff", "#1e293b");
  const primaryColor = "#3b82f6"; // Primary blue color for buttons/accents

  // Use the TrackingContext to ensure tracking persists
  const { isInitialized, checkTrackingStatus, restartBackgroundTracking } = useTracking();

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(
    undefined
  );
  const [filterActive, setFilterActive] = useState(false);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showUserPaths, setShowUserPaths] = useState(true);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Add state for tracking user routes
  const [userRoutes, setUserRoutes] = useState<Record<string, Point[]>>({});
  const [routeStats, setRouteStats] = useState<Record<string, {
    distance: number;
    formattedDistance: string;
    duration: number;
  }>>({});

  // Add state to track initial region setup
  const [initialRegionSet, setInitialRegionSet] = useState<boolean>(false);

  // Get admin location from our new store
  const {
    adminLocation,
    mapInitialRegion,
    isLoading: isLocationLoading,
    fetchAdminLocation,
    error: locationError,
  } = useAdminLocationStore();

  // Store state
  const { currentLocation, trackedUsers, setTrackingStatus, setTrackedUsers } =
    useLocationTrackingStore();

  // Geofence store
  const {
    geofences,
    fetchGeofences,
    error: geofenceError,
  } = useGeofenceStore();

  // In the component
  const { socket, isConnected: socketConnected } = useAdminSocket();

  // Add search state
  const [searchQuery, setSearchQuery] = useState("");

  // Add this near other state declarations
  const [locationCache, setLocationCache] = useState<{ [key: string]: string }>(
    {}
  );

  // Get the map store hooks
  const {
    setUserLocation,
    currentRegion: mapRegion,
    setCurrentRegion: setMapRegion,
    userLocation,
  } = useMapStore();

  // Add bottom sheet ref and snap points
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['25%', '50%', '85%'], []);

  // Add state to track bottom sheet index
  const [bottomSheetIndex, setBottomSheetIndex] = useState(1); // Default to middle position (index 1)

  // Add callback for sheet changes
  const handleSheetChanges = useCallback((index: number) => {
    console.log('handleSheetChanges', index);
    setBottomSheetIndex(index);
  }, []);

  // Handle navigating to a specific employee
  const handleGoToEmployee = useCallback((employee: TrackingUser) => {
    if (employee && employee.location) {
      // Set selected user
      setSelectedUserId(employee.id);
      
      // Update map region to focus on this employee
      const newRegion = {
        latitude: employee.location.latitude,
        longitude: employee.location.longitude,
        latitudeDelta: 0.005,  // Zoomed in for employee view
        longitudeDelta: 0.005,
      };
      
      // Update map region
      setMapRegion(newRegion);
    }
  }, [setMapRegion]);

  // Add renderItem function for FlatList
  const renderItem = useCallback(({ item: user }: { item: TrackingUser }) => {
    const isSelected = selectedUserId === user.id;
    const routeDistance = routeStats[user.id]?.formattedDistance || '0 m';
    const routeDuration = routeStats[user.id]?.duration || 0;
    
    let formattedDuration = '0 min';
    if (routeDuration >= 3600) {
      const hours = Math.floor(routeDuration / 3600);
      const minutes = Math.floor((routeDuration % 3600) / 60);
      formattedDuration = `${hours}h ${minutes}m`;
    } else if (routeDuration >= 60) {
      formattedDuration = `${Math.floor(routeDuration / 60)}m`;
    } else {
      formattedDuration = `${Math.round(routeDuration)}s`;
    }

    return (
      <TouchableOpacity
        key={user.id}
        style={[
          styles.employeeItem,
          isSelected && styles.selectedEmployeeItem,
          { backgroundColor: cardColor }
        ]}
        onPress={() => handleGoToEmployee(user)}
      >
        {/* Status Badge */}
        <View 
          style={[
            styles.statusBadge, 
            { 
              position: 'absolute',
              top: 10, 
              right: 10,
              backgroundColor: user.isActive 
                ? 'rgba(16, 185, 129, 0.15)' 
                : 'rgba(239, 68, 68, 0.15)',
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 6
            }
          ]}
        >
          <Text style={{
            fontSize: 12,
            fontWeight: '600',
            color: user.isActive ? '#065f46' : '#b91c1c',
          }}>
            {user.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>

        {/* Left Side Content */}
        <View style={styles.employeeInfo}>
          {/* Employee Name and ID row */}
          <View style={styles.employeeHeader}>
            <View style={[styles.statusDot, { backgroundColor: user.isActive ? "#10b981" : "#ef4444" }]} />
            <Text 
              style={[styles.employeeName, { color: textColor }]} 
              numberOfLines={1}
            >
              {user.name || 'Employee'}
            </Text>
            {user.employeeNumber && (
              <Text style={[styles.employeeNumber, { color: textColor }]}>
                #{user.employeeNumber}
              </Text>
            )}
          </View>
          
          {/* Device Info */}
          <View className='mb-1' style={styles.detailRow}>
            <View style={styles.iconTextRow}>
              <Ionicons 
                name="phone-portrait-outline" 
                size={16} 
                color={primaryColor} 
                style={styles.detailIcon} 
              />
              <Text 
                style={[styles.detailText, { color: textColor }]} 
                numberOfLines={1}
              >
                {user.deviceInfo || 'Unknown Device'}
              </Text>
            </View>
          </View>

          {/* Location */}
          <View className='mb-1' style={styles.detailRow}>
            <View style={styles.iconTextRow}>
              <Ionicons 
                name="location-outline" 
                size={16} 
                color={primaryColor} 
                style={styles.detailIcon} 
              />
              <LocationName 
                latitude={user.location.latitude}
                longitude={user.location.longitude}
                style={[styles.detailText, { color: textColor }]}
              />
            </View>
          </View>
            
          {/* Last Updated */}
          <View className='mb-1' style={styles.detailRow}>
            <View style={styles.iconTextRow}>
              <Ionicons 
                name="time-outline" 
                size={16} 
                color={primaryColor} 
                style={styles.detailIcon} 
              />
              <Text 
                style={[styles.detailText, { color: textColor }]} 
                numberOfLines={1}
              >
                {formatLastUpdated(user.lastUpdated)}
              </Text>
            </View>
          </View>
            
          {/* Battery Level */}
          <View className='mb-1' style={styles.detailRow}>
            <View style={styles.iconTextRow}>
              <Ionicons 
                name={getBatteryIconName(user.batteryLevel) as any} 
                size={16} 
                color={getBatteryColor(user.batteryLevel)} 
                style={styles.detailIcon} 
              />
              <Text 
                style={[styles.detailText, { color: getBatteryTextColor(user.batteryLevel, textColor) }]}
                numberOfLines={1}
              >
                {user.batteryLevel !== undefined ? `${Math.round(user.batteryLevel)}%` : 'Unknown'}
              </Text>
            </View>
          </View>
            
          {/* User Path (optional) */}
          {showUserPaths && (
            <View className='mb-1' style={styles.detailRow}>
              <View style={styles.iconTextRow}>
                <Ionicons 
                  name="footsteps-outline" 
                  size={16} 
                  color={primaryColor} 
                  style={styles.detailIcon} 
                />
                <Text 
                  style={[styles.detailText, { color: textColor }]} 
                  numberOfLines={1}
                >
                  {routeDistance} ({formattedDuration})
                </Text>
              </View>
            </View>
          )}
        </View>
        
        {/* Right side - Locate button */}
        <View style={styles.employeeActions}>
          <TouchableOpacity
            style={[styles.locateButton, { backgroundColor: primaryColor }]}
            onPress={() => handleGoToEmployee(user)}
          >
            <Ionicons name="locate-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [selectedUserId, cardColor, textColor, primaryColor, showUserPaths, routeStats, handleGoToEmployee]);

  // Add a useEffect to check tracking status when the component mounts
  useEffect(() => {
    if (isInitialized) {
      // When tracking context is initialized, check if tracking should be active
      const verifyTrackingState = async () => {
        try {
          console.log("Verifying group admin tracking state...");
          const isActive = await checkTrackingStatus();
          console.log(`Background tracking active status: ${isActive}`);
          
          // If tracking is active, ensure we have the latest employee locations
          if (isActive) {
            fetchEmployeeLocations();
          }
        } catch (error) {
          console.error("Error verifying tracking state:", error);
        }
      };
      
      verifyTrackingState();
    }
  }, [isInitialized]);
  
  // Update the socket event handling to maintain socket connections even when navigating away
  useEffect(() => {
    if (socket && socketConnected) {
      console.log("Setting up employee location subscriptions via socket");
      
      // Listen for employee location updates
      socket.on("employee:location_update", (data: any) => {
        if (validateEmployeeLocation(data)) {
          // Log only basic info to prevent console flooding
          console.log(`Received location update for employee: ${data.employeeId || data.userId}`);
          
          // Update the employee's route
          updateEmployeeRoute(data.employeeId || data.userId, {
            latitude: data.location.latitude,
            longitude: data.location.longitude,
            timestamp: typeof data.location.timestamp === 'string' 
              ? parseInt(data.location.timestamp) 
              : (data.location.timestamp || Date.now())
          });
        }
      });
      
      // Return cleanup function that DOESN'T disconnect the socket
      return () => {
        // Just remove event listeners, but don't disconnect socket
        if (socket) {
          socket.off("employee:location_update");
        }
      };
    }
  }, [socket, socketConnected]);
  
  // Optimize the admin location fetching to be less frequent
  useEffect(() => {
    // Only fetch admin location once when component mounts
    // This prevents excessive location requests
    if (!adminLocation) {
      getCurrentLocation();
    }
    
    // Fetch employee locations right away
    fetchEmployeeLocations();
    
    // Then fetch every 30 seconds
    const interval = setInterval(() => {
      fetchEmployeeLocations();
    }, 30000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  // Add validation function for admin side
  const validateEmployeeLocation = (data: any): boolean => {
    // Basic validation
    if (!data || typeof data !== "object") return false;

    // Required employee ID
    if (!data.employeeId && !data.userId) {
      console.warn("Missing employee identifier in location data:", data);
      return false;
    }

    // Must have a valid location object
    if (!data.location || typeof data.location !== "object") {
      console.warn("Missing or invalid location object:", data);
      return false;
    }

    // Location must have valid coordinates
    const { latitude, longitude } = data.location;
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      isNaN(latitude) ||
      isNaN(longitude) ||
      latitude === 0 ||
      longitude === 0
    ) {
      console.warn("Invalid location coordinates:", data.location);
      return false;
    }

    return true;
  };

  // Add function to update route for an employee
  const updateEmployeeRoute = useCallback((employeeId: string, location: { latitude: number, longitude: number, timestamp?: number }) => {
    // Validate coordinates before adding to prevent invalid points
    if (!isValidCoordinate(location.latitude, location.longitude)) {
      console.warn('Invalid coordinates for employee route update:', location);
      return;
    }
    
    setUserRoutes(prevRoutes => {
      try {
        // Get existing route or create new one
        const existingRoute = prevRoutes[employeeId] || [];
        
        // Create new point with timestamp
        const newPoint: Point & { timestamp?: number } = {
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: location.timestamp || Date.now()
        };
        
        // Skip duplicate points (same location within 5 meters)
        const lastPoint = existingRoute[existingRoute.length - 1];
        if (lastPoint) {
          const distance = calculateDistance(
            lastPoint.latitude, 
            lastPoint.longitude, 
            newPoint.latitude, 
            newPoint.longitude
          );
          
          if (distance < 5) {
            // Skip this update, it's too close to the last point
            return prevRoutes;
          }
        }
        
        // Add to route, ensuring we don't exceed max points
        const newRoute = [...existingRoute, newPoint];
        if (newRoute.length > MAX_ROUTE_POINTS) {
          // Keep most recent points if we exceed max
          newRoute.splice(0, newRoute.length - MAX_ROUTE_POINTS);
        }
        
        // Clean route to remove invalid points
        const cleanedRoute = cleanRoute(newRoute as Point[]);
        
        // Get route stats
        if (cleanedRoute.length > 1) {
          const stats = getRouteStats(cleanedRoute as Array<Point & { timestamp?: number }>);
          
          // Batch update the route stats to prevent excessive re-renders
          setRouteStats(prev => ({
            ...prev,
            [employeeId]: {
              distance: stats.distance,
              formattedDistance: stats.formattedDistance,
              duration: stats.duration
            }
          }));
        }
        
        return {
          ...prevRoutes,
          [employeeId]: cleanedRoute
        };
      } catch (error) {
        console.error('Error updating employee route:', error);
        // Return previous state on error
        return prevRoutes;
      }
    });
  }, []);

  // Add a new function to clean up old routes for memory optimization
  const cleanupOldRoutes = useCallback(() => {
    // Remove routes for employees that haven't been tracked for a while
    setUserRoutes(prevRoutes => {
      const currentTime = Date.now();
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      const updatedRoutes = { ...prevRoutes };
      
      // For each employee route
      Object.keys(updatedRoutes).forEach(employeeId => {
        const route = updatedRoutes[employeeId];
        if (route && route.length > 0) {
          // Get the timestamp of the most recent point
          const lastPoint = route[route.length - 1] as Point & { timestamp?: number };
          const lastTimestamp = lastPoint.timestamp || 0;
          
          // If the last update was more than 2 hours ago, remove this route
          if (currentTime - lastTimestamp > TWO_HOURS) {
            delete updatedRoutes[employeeId];
          }
        }
      });
      
      return updatedRoutes;
    });
  }, []);

  // Add cleanup effect for routes to prevent memory leaks
  useEffect(() => {
    // Set up interval to clean up old routes
    const cleanupInterval = setInterval(cleanupOldRoutes, 30 * 60 * 1000); // 30 minutes
    
    return () => {
      clearInterval(cleanupInterval);
    };
  }, [cleanupOldRoutes]);

  // Load initial data
  useEffect(() => {
    console.log("[GroupAdmin] Component mounted, checking admin location...");

    // If admin location is not available, fetch it immediately
    if (!adminLocation) {
      console.log("[GroupAdmin] No admin location available, fetching now...");
      fetchAdminLocation()
        .then(() => {
          console.log(
            "[GroupAdmin] Admin location fetched on component mount:",
            useAdminLocationStore.getState().adminLocation
          );
        })
        .catch((error) => {
          console.error(
            "[GroupAdmin] Error fetching admin location on mount:",
            error
          );
        });
    } else {
      console.log(
        "[GroupAdmin] Admin location already available:",
        adminLocation
      );
    }

    // Always fetch employees and geofences
    fetchEmployeeLocations();
    fetchGeofences();
  }, []);

  // Update the getCurrentLocation function to use our admin location store
  const getCurrentLocation = async () => {
    console.log("[GroupAdmin] Getting current location...");
    setIsLoadingLocation(true);

    try {
      // This will update the admin location store
      await fetchAdminLocation();

      const updatedAdminLocation =
        useAdminLocationStore.getState().adminLocation;
      console.log(
        "[GroupAdmin] Admin location after fetch:",
        updatedAdminLocation
      );

      // Also update the map store (for fallback in map component)
      if (updatedAdminLocation) {
        console.log(
          "[GroupAdmin] Setting user location in MapStore:",
          updatedAdminLocation
        );
        setUserLocation({
          latitude: updatedAdminLocation.latitude,
          longitude: updatedAdminLocation.longitude,
          accuracy: updatedAdminLocation.accuracy,
        });

        // Set the region in the map store
        const newRegion = {
          latitude: updatedAdminLocation.latitude,
          longitude: updatedAdminLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        console.log("[GroupAdmin] Setting map region:", newRegion);
        setMapRegion(newRegion);

        setInitialRegionSet(true);
        console.log(
          "[GroupAdmin] Location set successfully:",
          updatedAdminLocation
        );
      } else {
        console.warn("[GroupAdmin] Admin location not available after fetch");
        throw new Error("Failed to get location");
      }

      return updatedAdminLocation;
    } catch (error) {
      console.error("[GroupAdmin] Error getting location:", error);
      setError(
        "Failed to get location: " +
          (error instanceof Error ? error.message : String(error))
      );
      return null;
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // If location error appears in the admin location store, show it
  useEffect(() => {
    if (locationError) {
      setError(locationError);
    }
  }, [locationError]);

  // React to location changes
  useEffect(() => {
    if (mapRegion) {
      console.log("[GroupAdmin] Map region updated:", mapRegion);

      // Check if this update looks like San Francisco coordinates
      const isSanFrancisco =
        Math.abs(mapRegion.latitude - 37.78) < 0.1 &&
        Math.abs(mapRegion.longitude + 122.42) < 0.1;

      if (isSanFrancisco) {
        console.warn(
          "[GroupAdmin] Detected San Francisco coordinates - this is likely an unwanted update"
        );
      }

      // If we have admin location but the map region doesn't match it, log a warning
      if (
        adminLocation &&
        Math.abs(mapRegion.latitude - adminLocation.latitude) > 0.1 &&
        Math.abs(mapRegion.longitude - adminLocation.longitude) > 0.1
      ) {
        console.warn("[GroupAdmin] Map region doesn't match admin location:", {
          mapRegion,
          adminLocation,
        });
      }
    }
  }, [mapRegion, adminLocation]);

  // Fetch employee locations from API
  const fetchEmployeeLocations = async () => {
    setIsLoading(true);
    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || "";
      const response = await axios.get(
        `${API_URL}/api/group-admin-tracking/active-locations`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      console.log("Employee locations API response:", response.data);

      if (response.data && response.data.length > 0) {
        // Transform API response to match our expected format
        const transformedUsers = response.data.map((emp: any) => {
          // Extract battery level, preferring the top-level value if it exists
          const batteryLevel =
            typeof emp.batteryLevel === "number"
              ? emp.batteryLevel
              : typeof emp.battery_level === "number"
              ? emp.battery_level
              : 0;

          // Check for the new format with employee object
          if (emp.employee) {
            const employee = emp.employee;
            const displayName = employee.name || "Employee";
            const employeeLabel = employee.employeeNumber
              ? `${displayName} (${employee.employeeNumber})`
              : displayName;

            return {
              id: employee.id.toString(),
              name: displayName,
              employeeNumber: employee.employeeNumber,
              deviceInfo: employee.deviceInfo || "Unknown device",
              location: {
                latitude: parseFloat(emp.latitude),
                longitude: parseFloat(emp.longitude),
                accuracy: emp.accuracy || 10,
                timestamp: emp.timestamp || Date.now(),
                batteryLevel: batteryLevel,
                isMoving: emp.isMoving || false,
              },
              lastUpdated: emp.timestamp
                ? new Date(emp.timestamp).getTime()
                : emp.lastUpdated
                ? new Date(emp.lastUpdated).getTime()
                : Date.now(),
              isActive: emp.is_tracking_active || false, // Consider user active if they have a recent location
              batteryLevel: batteryLevel,
              department: employee.department,
              designation: employee.designation,
              source: emp.source || "api",
              employeeLabel, // For display in marker and list
            };
          }
          // Handle legacy format - for backward compatibility
          else {
            const name = emp.user_name || "Employee";
            const employeeNumber = emp.employee_number || "";
            const employeeLabel = employeeNumber
              ? `${name} (${employeeNumber})`
              : name;

            return {
              id: emp.employeeId?.toString() || emp.id?.toString() || "unknown",
              name: name,
              employeeNumber: employeeNumber,
              deviceInfo: emp.deviceInfo || "Unknown device",
              location: {
                latitude: parseFloat(emp.latitude),
                longitude: parseFloat(emp.longitude),
                accuracy: emp.accuracy || 10,
                timestamp: emp.timestamp || Date.now(),
                batteryLevel: batteryLevel,
                isMoving: emp.is_moving || emp.isMoving || false,
              },
              lastUpdated: emp.timestamp
                ? new Date(emp.timestamp).getTime()
                : emp.lastUpdated
                ? new Date(emp.lastUpdated).getTime()
                : Date.now(),
              isActive: emp.is_tracking_active || false,
              batteryLevel: batteryLevel,
              department: emp.department || "",
              designation: emp.designation || "",
              employeeLabel,
            };
          }
        });

        console.log("Transformed employee data:", transformedUsers);
        setTrackedUsers(transformedUsers);
      } else {
        // If no active employees, set empty array
        console.log("No tracked users found in API response");
        setTrackedUsers([]);
      }

      setTrackingStatus(TrackingStatus.ACTIVE);
    } catch (error) {
      console.error("Error fetching employee locations:", error);
      Alert.alert("Error", "Failed to fetch employee locations");
      setTrackingStatus(TrackingStatus.ERROR);

      // If we're in development mode, use mock data as fallback
      if (__DEV__) {
        console.warn("Using mock data as fallback in development mode");
        // Don't set mock data here anymore - empty state is better for testing
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Add a utility function to validate user location data
  const validateUserLocation = (user: TrackingUser): boolean => {
    if (!user || !user.location) return false;
    
    const { latitude, longitude } = user.location;
    return (
      typeof latitude === 'number' && 
      typeof longitude === 'number' && 
      !isNaN(latitude) && 
      !isNaN(longitude) && 
      !(latitude === 0 && longitude === 0)
    );
  };

  // Add state to force refresh markers when needed
  const [markerRefreshToggle, setMarkerRefreshToggle] = useState<boolean>(false);
  
  // Function to force refresh markers
  const refreshMarkers = () => {
    setMarkerRefreshToggle(prev => !prev);
  };

  // Extend the onRefresh function to refresh markers
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchEmployeeLocations(),
        fetchGeofences(),
        getCurrentLocation(),
      ]);
      // Force refresh markers
      refreshMarkers();
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchGeofences]);

  // Add marker visibility debugging action
  const debugMarkerVisibility = useCallback(() => {
    console.log("Debugging marker visibility...");
    console.log(`Number of tracked users: ${trackedUsers.length}`);
    
    // Log validation status for each user
    trackedUsers.forEach(user => {
      const isValid = validateUserLocation(user);
      console.log(`User ${user.id} (${user.name}): Location valid: ${isValid ? 'YES' : 'NO'}`);
      if (!isValid && user.location) {
        console.log(`Invalid coords: ${user.location.latitude}, ${user.location.longitude}`);
      }
    });
    
    // Refresh the markers
    refreshMarkers();
    
    // The debug message provides instructions to the user
    Alert.alert(
      "Marker Debug",
      `Refreshed ${trackedUsers.length} markers. If markers are still not visible, try pulling down to refresh the list.`
    );
  }, [trackedUsers, refreshMarkers]);

  // Handle user selection
  const handleUserSelect = useCallback(
    (user: TrackingUser) => {
      setSelectedUserId(selectedUserId === user.id ? undefined : user.id);
    },
    [selectedUserId]
  );

  // Navigate to geofence management
  const goToGeofenceManagement = () => {
    router.push("/Group-Admin/tracking/geofence-management");
  };

  // Navigate to analytics
  const goToAnalytics = () => {
    // router.push("/Group-Admin/tracking/analytics");
    Alert.alert("Coming soon", "This feature is coming soon");
  };

  // Filtered users based on active filter and search query
  const filteredUsers = useMemo(() => {
    if (!trackedUsers) return [];

    return trackedUsers.filter((user) => {
      // First apply the active filter if it's enabled
      if (filterActive && !user.isActive) {
        return false;
      }

      // Then apply the search filter if there's a query
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const nameMatch = user.name.toLowerCase().includes(searchLower);
        const numberMatch = user.employeeNumber
          ?.toLowerCase()
          .includes(searchLower);
        return nameMatch || numberMatch;
      }

      return true;
    });
  }, [trackedUsers, searchQuery, filterActive]);

  // Selected user
  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return trackedUsers.find((user) => user.id === selectedUserId) || null;
  }, [selectedUserId, trackedUsers]);

  // Toggle handlers with console logging for debugging
  const toggleGeofences = () => {
    const newValue = !showGeofences;
    setShowGeofences(newValue);
    console.log("Toggled showGeofences to:", newValue);
  };

  const toggleUserPaths = () => {
    const newValue = !showUserPaths;
    setShowUserPaths(newValue);
    console.log("Toggled showUserPaths to:", newValue);
  };

  // Use the admin location store for the map's initial region
  const computedMapRegion = useMemo(() => {
    console.log("[GroupAdmin] Computing map region from index.tsx", {
      adminLocation: adminLocation
        ? {
            latitude: adminLocation.latitude,
            longitude: adminLocation.longitude,
            timestamp: adminLocation.timestamp,
          }
        : null,
      mapInitialRegion,
      initialRegionSet,
    });

    // First priority: use the admin location from our specialized store if it's valid
    if (
      adminLocation &&
      adminLocation.latitude !== 0 &&
      adminLocation.longitude !== 0
    ) {
      const region = {
        latitude: adminLocation.latitude,
        longitude: adminLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      console.log(
        "[GroupAdmin] Using admin location for map initialRegion:",
        region
      );
      return region;
    }

    // Second priority: use the initial region from our admin location store
    console.log(
      "[GroupAdmin] Falling back to mapInitialRegion:",
      mapInitialRegion
    );
    return mapInitialRegion;
  }, [adminLocation, mapInitialRegion, initialRegionSet]);

  // Add this function before the return statement
  const getPlaceName = async (latitude: number, longitude: number) => {
    const cacheKey = `${latitude},${longitude}`;

    // Check cache first
    if (locationCache[cacheKey]) {
      return locationCache[cacheKey];
    }

    try {
      const result = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (result && result[0]) {
        const place = result[0];
        const placeName = [place.street, place.city, place.region]
          .filter(Boolean)
          .join(", ");

        // Cache the result
        setLocationCache((prev) => ({
          ...prev,
          [cacheKey]: placeName,
        }));

        return placeName;
      }
      return "Unknown location";
    } catch (error) {
      console.error("Error getting place name:", error);
      return "Location unavailable";
    }
  };

  // Add LocationName component before using it
  const LocationName = React.memo(
    ({
      latitude,
      longitude,
      style,
    }: {
      latitude: number;
      longitude: number;
      style: any;
    }) => {
      const [placeName, setPlaceName] = useState<string>("Loading...");

      useEffect(() => {
        let isMounted = true;

        const fetchPlaceName = async () => {
          const name = await getPlaceName(latitude, longitude);
          if (isMounted) {
            setPlaceName(name);
          }
        };

        fetchPlaceName();
        return () => {
          isMounted = false;
        };
      }, [latitude, longitude]);

      return <Text style={style}>{placeName}</Text>;
    }
  );

  // Add a new function to refresh employee data
  const handleRefreshEmployees = useCallback(() => {
    setIsLoading(true);
    Promise.all([
      fetchEmployeeLocations(),
      getCurrentLocation()
    ]).then(() => {
      refreshMarkers();
    }).catch(error => {
      console.error("Error refreshing employee data:", error);
      Alert.alert("Error", "Failed to refresh employee locations");
    }).finally(() => {
      setIsLoading(false);
    });
  }, [fetchEmployeeLocations, getCurrentLocation, refreshMarkers]);

  // Get the bottom position based on the sheet index
  const getControlsBottomPosition = useCallback(() => {
    if (bottomSheetIndex === 2) { // Fully expanded
      return 250; // Higher position when sheet is expanded
    } else if (bottomSheetIndex === 1) { // Middle position
      if (__DEV__) {
        return 420; // Middle position
      } else {
        return 380; // Default/collapsed position
      }
    }
    return __DEV__ ? 220 : 160; // Default/collapsed position
  }, [bottomSheetIndex]);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen
        options={{
          title: "Live Tracking",
          headerStyle: {
            backgroundColor: cardColor,
          },
          headerTintColor: textColor,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity onPress={goToGeofenceManagement}>
                <Ionicons name="map" size={24} color={textColor} />
              </TouchableOpacity>
              <TouchableOpacity onPress={goToAnalytics}>
                <Ionicons name="analytics" size={24} color={textColor} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />

      {/* Map View */}
      <View style={styles.mapContainer}>
        {(() => {
          try {
            console.log(
              "[GroupAdmin] Rendering map with region:",
              computedMapRegion
            );

            return (
              <LiveTrackingMap
                showsUserLocation={true}
                followsUserLocation={false}
                initialRegion={computedMapRegion}
                onMarkerPress={handleUserSelect}
                showGeofences={showGeofences}
                showUserPaths={showUserPaths}
                geofences={geofences}
                containerStyle={styles.map}
                selectedUserId={selectedUserId}
                userRoutes={userRoutes}
                markerRefreshToggle={markerRefreshToggle}
              />
            );
          } catch (error) {
            console.error("[GroupAdmin] Error rendering map:", error);
            return (
              <View
                style={[styles.errorContainer, { backgroundColor: cardColor }]}
              >
                <Text style={[styles.errorText, { color: textColor }]}>
                  Error rendering map: {String(error)}
                </Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={getCurrentLocation}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            );
          }
        })()}

        {/* Map Overlay Controls - With dynamic bottom position */}
        <View 
          style={[
            styles.mapControls, 
            { bottom: getControlsBottomPosition() }
          ]}
        >
          <View style={styles.controlWithLabel}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: cardColor }]}
              onPress={toggleGeofences}
            >
              <Ionicons
                name={showGeofences ? "locate" : "locate-outline"}
                size={20}
                color={showGeofences ? primaryColor : textColor}
              />
            </TouchableOpacity>
            <Text style={[styles.controlLabelText, { color: textColor }]}>
              Geofences
            </Text>
          </View>

          <View style={styles.controlWithLabel}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: cardColor }]}
              onPress={toggleUserPaths}
            >
              <Ionicons
                name={showUserPaths ? "footsteps" : "footsteps-outline"}
                size={20}
                color={showUserPaths ? primaryColor : textColor}
              />
            </TouchableOpacity>
            <Text style={[styles.controlLabelText, { color: textColor }]}>
              Paths
            </Text>
          </View>

          <View style={styles.controlWithLabel}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: cardColor }]}
              onPress={goToGeofenceManagement}
            >
              <Ionicons name="create" size={20} color={textColor} />
            </TouchableOpacity>
            <Text style={[styles.controlLabelText, { color: textColor }]}>
              Create
            </Text>
          </View>

          {/* Add Refresh button */}
          <View style={styles.controlWithLabel}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: cardColor }]}
              onPress={handleRefreshEmployees}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <Ionicons name="refresh" size={20} color={textColor} />
              )}
            </TouchableOpacity>
            <Text style={[styles.controlLabelText, { color: textColor }]}>
              Refresh
            </Text>
          </View>

          {/* Debug button for marker visibility */}
          <View style={styles.controlWithLabel}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: cardColor }]}
              onPress={debugMarkerVisibility}
            >
              <Ionicons name="bug" size={20} color={textColor} />
            </TouchableOpacity>
            <Text style={[styles.controlLabelText, { color: textColor }]}>
              Debug
            </Text>
          </View>
        </View>
      </View>

      {/* Replace the trackedEmployeesContainer with BottomSheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        style={styles.bottomSheet}
        handleIndicatorStyle={styles.bottomSheetIndicator}
        backgroundStyle={[{ backgroundColor: cardColor }]}
      >
        <View style={styles.employeeListHeader}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <Text
                style={[styles.sectionTitle, { color: textColor }]}
                numberOfLines={1}
              >
                Tracked Employees ({filteredUsers.length})
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={[
                  styles.headerButton,
                  filterActive && styles.headerButtonActive,
                  { backgroundColor: useThemeColor("#f8fafc", "#1e293b") }
                ]}
                onPress={() => setFilterActive(!filterActive)}
              >
                <Ionicons
                  name="filter"
                  size={14}
                  color={filterActive ? "#3b82f6" : textColor}
                  style={{ marginRight: 2 }}
                />
                <Text
                  style={[
                    styles.headerButtonText,
                    { color: filterActive ? "#3b82f6" : textColor }
                  ]}
                >
                  Active
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerButton, { backgroundColor: "#7c3aed" }]}
                onPress={goToAnalytics}
              >
                <Ionicons
                  name="analytics"
                  size={14}
                  color="#ffffff"
                  style={{ marginRight: 2 }}
                />
                <Text style={styles.headerButtonTextWhite}>Analytics</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={[
              styles.searchContainer,
              { backgroundColor: useThemeColor("#f1f5f9", "#1e293b") }
            ]}
          >
            <Ionicons name="search" size={20} color={textColor} />
            <TextInput
              style={[styles.searchInput, { color: textColor }]}
              placeholder="Search by name or employee number..."
              placeholderTextColor={useThemeColor("#94a3b8", "#475569")}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color={textColor} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <BottomSheetFlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.employeeListContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={textColor}
            />
          }
        />
      </BottomSheet>

      {/* Selected Employee Detail Card */}
      {selectedUser && (
        <View style={[styles.detailCard, { backgroundColor: cardColor }]}>
          <View style={styles.detailHeader}>
            <Text style={[styles.detailName, { color: textColor }]}>
              {selectedUser.name}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedUserId(undefined)}
            >
              <Ionicons name="close" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: textColor }]}>
                Status
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: selectedUser.isActive
                      ? "#dcfce7"
                      : "#f3f4f6",
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: selectedUser.isActive
                        ? "#10b981"
                        : "#6b7280",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      color: selectedUser.isActive ? "#065f46" : "#374151",
                    },
                  ]}
                >
                  {selectedUser.isActive ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: textColor }]}>
                Battery
              </Text>
              <View style={styles.batteryContainer}>
                <Fontisto
                  name={getBatteryIconName(selectedUser.batteryLevel) as any}
                  size={16}
                  color={getBatteryColor(selectedUser.batteryLevel)}
                />
                <Text
                  style={[
                    styles.batteryText,
                    {
                      color: getBatteryTextColor(
                        selectedUser.batteryLevel,
                        textColor
                      ),
                    },
                  ]}
                >
                  {selectedUser.batteryLevel}%
                </Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: textColor }]}>
                Last Updated
              </Text>
              <Text style={[styles.detailValue, { color: textColor }]}>
                {formatLastUpdated(selectedUser.lastUpdated)}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: textColor }]}>
                Moving
              </Text>
              <Text style={[styles.detailValue, { color: textColor }]}>
                {selectedUser.location.isMoving ? "Yes" : "No"}
              </Text>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.messageButton]}
              onPress={() => {
                Alert.alert(
                  "Message",
                  `Send message to ${selectedUser.name}, This feature is coming soon`
                );
              }}
            >
              <Ionicons name="chatbubble" size={16} color="#ffffff" />
              <Text style={styles.actionButtonText}>Message</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.historyButton]}
              onPress={() => {
                Alert.alert("Coming soon", "This feature is coming soon");
              }}
            >
              <Ionicons name="time" size={16} color="#ffffff" />
              <Text style={styles.actionButtonText}>History</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// Helper functions
const formatLastUpdated = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return "Just now";
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)} min ago`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)} hr ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
};

const getBatteryIconName = (level: number | undefined): string => {
  const batteryLevel = level ?? 0;
  if (batteryLevel <= 10) {
    return "battery-empty";
  } else if (batteryLevel <= 30) {
    return "battery-quarter";
  } else if (batteryLevel <= 70) {
    return "battery-half";
  } else {
    return "battery-full";
  }
};

const getBatteryColor = (level: number | undefined): string => {
  const batteryLevel = level ?? 0;
  if (batteryLevel <= 15) {
    return "#ef4444"; // Red
  } else if (batteryLevel <= 30) {
    return "#f59e0b"; // Orange
  } else {
    return "#10b981"; // Green
  }
};

const getBatteryTextColor = (
  level: number | undefined,
  defaultColor: string
): string => {
  const batteryLevel = level ?? 0;
  if (batteryLevel <= 15) {
    return "#ef4444"; // Red
  } else if (batteryLevel <= 30) {
    return "#f59e0b"; // Orange
  } else {
    return defaultColor;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapControls: {
    position: "absolute",
    bottom: 30,
    left: 10,
    gap: 12,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  trackedEmployeesContainer: {
    height: "40%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    overflow: "hidden",
    paddingTop: 8,
  },
  employeeListHeader: {
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerButtons: {
    flexDirection: "row",
    gap: 8,
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerButtonActive: {
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  headerButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  headerButtonTextWhite: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  sectionTitle: {
    fontSize: RFValue(15),
    fontWeight: "700",
    flexShrink: 1,
    marginRight: 5,
  },
  nameSection: {
    flex: 1,
    flexDirection: "column",
    gap: 4,
  },
  employeeList: {
    flex: 1,
  },
  employeeCard: {
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  employeeMainInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  employeeNumber: {
    fontSize: 14,
    opacity: 0.7,
  },
  deviceInfo: {
    fontSize: 13,
    opacity: 0.7,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    flexShrink: 0,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  batteryContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    flexShrink: 0,
    minWidth: 65,
  },
  batteryText: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
    flexShrink: 0,
  },
  lastUpdate: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: "right",
    justifyContent: "flex-end",
    marginBottom: 5,
  },
  noLocation: {
    fontSize: 12,
    opacity: 0.6,
    fontStyle: "italic",
  },
  detailCard: {
    position: "absolute",
    bottom: "40%",
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    marginBottom: 8,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  detailName: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  detailItem: {
    width: "50%",
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 6,
  },
  messageButton: {
    backgroundColor: "#3b82f6",
  },
  historyButton: {
    backgroundColor: "#8b5cf6",
  },
  actionButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    marginLeft: 6,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "500",
  },
  retryButton: {
    padding: 12,
    borderRadius: 6,
    backgroundColor: "#3b82f6",
  },
  retryText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  controlWithLabel: {
    alignItems: "center",
  },
  controlLabelText: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  locationLoadingIndicator: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  locationLoadingText: {
    color: "#ffffff",
    fontSize: 12,
    marginLeft: 6,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  selectedEmployeeCard: {
    borderWidth: 2,
    borderColor: "#3b82f6",
  },
  locationText: {
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2,
    fontStyle: "italic",
  },
  employeeItem: {
    padding: 16,
    marginHorizontal: 10,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 150,
    width: '95%',
  },
  employeeInfo: {
    flex: 1,
    paddingRight: 16,
  },
  employeeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  employeeDetails: {
    gap: 12,
  },
  iconTextRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailIcon: {
    marginRight: 8,
    width: 18,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
  },
  employeeActions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 8,
  },
  locateButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  selectedEmployeeItem: {
    borderWidth: 2,
    borderColor: "#3b82f6",
  },
  bottomSheet: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  bottomSheetIndicator: {
    backgroundColor: '#CBD5E1',
    width: 32,
  },
  employeeListContent: {
    paddingBottom: 32,
  },
}); 