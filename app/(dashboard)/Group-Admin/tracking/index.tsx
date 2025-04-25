import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useAuth } from "../../../context/AuthContext";
import { useColorScheme, useThemeColor } from "../../../hooks/useColorScheme";
import { useGeofencing } from "../../../hooks/useGeofencing";
import { useSocket } from "../../../hooks/useSocket";
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

import LiveTrackingMap from "../../shared/components/map/LiveTrackingMap";
import TrackedUsersList from "../../shared/components/map/TrackedUsersList";
import { showTokenDebugAlert } from "../../../utils/tokenDebugger";

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

  // Effect to subscribe to employee updates when tracked users change
  useEffect(() => {
    if (socketConnected && socket && trackedUsers?.length > 0) {
      const employeeIds = trackedUsers.map((user) => parseInt(user.id));

      console.log(
        "Group Admin tracking: Attempting to subscribe to employees:",
        {
          adminId: user?.id,
          employeeCount: trackedUsers.length,
          employeeIds: employeeIds,
          socketId: socket?.id,
          socketConnected,
        }
      );

      // Subscribe to location updates for these employees
      socket.emit("admin:subscribe_employees", { employeeIds });

      // Add specific event listeners for subscription responses
      socket.on("admin:subscription_success", (data) => {
        console.log("Successfully subscribed to employee updates:", data);
      });

      socket.on("admin:subscription_error", (error) => {
        console.error("Failed to subscribe to employee updates:", error);
        setError("Failed to subscribe to employee updates: " + error.message);
      });

      // Set up custom event handler for employee location updates
      socket.on("employee:location_update", (data: EmployeeLocationData) => {
        console.log("Employee location update received:", data);

        // Validate data first
        if (!validateEmployeeLocation(data)) {
          console.warn(
            "Received invalid employee location data - ignoring update"
          );
          return;
        }

        // Normalize employee ID (could be in employeeId or userId)
        const employeeId = data.employeeId || data.userId;

        // Only process if we have an employeeId
        if (!employeeId) return;

        // Find the employee in tracked users and update their location
        const updatedUsers = trackedUsers.map((user: TrackingUser) => {
          if (user.id === employeeId.toString()) {
            console.log(
              `Updating position for employee ${employeeId} (${
                data.name || user.name
              })`
            );

            // Determine active status from either isActive or is_tracking_active fields
            const isActive =
              data.isActive !== undefined
                ? data.isActive
                : data.is_tracking_active || data.trackingStatus === "active";

            return {
              ...user,
              location: {
                latitude: data.location.latitude,
                longitude: data.location.longitude,
                accuracy: data.location.accuracy || user.location.accuracy,
                timestamp: data.location.timestamp || Date.now(),
                batteryLevel:
                  data.location.batteryLevel || user.location.batteryLevel,
                isMoving:
                  data.location.isMoving !== undefined
                    ? data.location.isMoving
                    : user.location.isMoving,
              },
              lastUpdated: Date.now(),
              batteryLevel: data.batteryLevel || user.batteryLevel,
              isActive: isActive,
              isInGeofence:
                data.isInGeofence !== undefined
                  ? data.isInGeofence
                  : user.isInGeofence,
            };
          }
          return user;
        });

        // Update the store with the new array
        setTrackedUsers(updatedUsers);
      });

      // Clean up subscription when component unmounts or users change
      return () => {
        socket.off("employee:location_update");
        socket.off("admin:subscription_success");
        socket.off("admin:subscription_error");
        socket.emit("admin:unsubscribe_employees", { employeeIds });
        console.log("Unsubscribed from updates for employees:", employeeIds);
      };
    } else if (
      socketConnected &&
      socket &&
      (!trackedUsers || trackedUsers.length === 0)
    ) {
      console.log("Group Admin tracking: No employees to track", {
        adminId: user?.id,
        socketId: socket?.id,
        trackedUsersLength: trackedUsers?.length || 0,
      });
    } else if (!socketConnected) {
      console.log("Group Admin tracking: Socket not connected", {
        adminId: user?.id,
        hasSocket: !!socket,
      });
    }
  }, [socket, socketConnected, trackedUsers, user?.id]);

  // Add periodic refresh of employee locations
  useEffect(() => {
    // Only set up interval if we're not already refreshing and if we have socket connectivity
    if (!refreshing && !isLoading) {
      const refreshInterval = setInterval(() => {
        console.log("Periodic refresh of employee locations");
        fetchEmployeeLocations();
      }, 60000); // Refresh every minute

      return () => clearInterval(refreshInterval);
    }
  }, [refreshing, isLoading]);

  // Get the map store hooks
  const {
    setUserLocation,
    currentRegion: mapRegion,
    setCurrentRegion: setMapRegion,
    userLocation,
  } = useMapStore();

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

  // Update the onRefresh function to use fetchGeofences directly from store
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchEmployeeLocations(),
        fetchGeofences(), // This uses the implementation from useGeofenceStore
        getCurrentLocation(),
      ]);
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchGeofences]);

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

        {/* Map Overlay Controls */}
        <View style={styles.mapControls}>
          <View style={styles.controlWithLabel}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: cardColor }]}
              onPress={toggleGeofences}
            >
              <Ionicons
                name="map"
                size={20}
                color={showGeofences ? "#3b82f6" : textColor}
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
                name="trail-sign"
                size={20}
                color={showUserPaths ? "#3b82f6" : textColor}
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
        </View>
      </View>

      {/* Employee List Section */}
      <View
        style={[
          styles.trackedEmployeesContainer,
          { backgroundColor: cardColor },
        ]}
      >
        <View style={styles.employeeListHeader}>
          <View
            style={[
              styles.headerRow,
              {
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 8,
              },
            ]}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: textColor,
                    fontSize: 16,
                    fontWeight: "700",
                    flexShrink: 1,
                    marginRight: 5,
                  },
                ]}
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
                  {
                    backgroundColor: useThemeColor("#f8fafc", "#1e293b"),
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                    borderRadius: 8,
                    width: 80,
                  },
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
                    {
                      color: filterActive ? "#3b82f6" : textColor,
                      fontSize: 12,
                    },
                  ]}
                >
                  Active
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.headerButton,
                  {
                    backgroundColor: "#7c3aed",
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                    borderRadius: 8,
                    shadowColor: "#000",
                    shadowOffset: {
                      width: 0,
                      height: 2,
                    },
                    shadowOpacity: 0.15,
                    shadowRadius: 3,
                    elevation: 3,
                    width: 80,
                  },
                ]}
                onPress={goToAnalytics}
              >
                <Ionicons
                  name="analytics"
                  size={14}
                  color="#ffffff"
                  style={{ marginRight: 2 }}
                />
                <Text style={[styles.headerButtonTextWhite, { fontSize: 12 }]}>
                  Analytics
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View
            style={[
              styles.searchContainer,
              { backgroundColor: useThemeColor("#f1f5f9", "#1e293b") },
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

        <ScrollView
          style={styles.employeeList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={textColor}
            />
          }
        >
          {filteredUsers.map((user) => (
            <Pressable
              key={user.id}
              style={[
                styles.employeeCard,
                selectedUserId === user.id && styles.selectedEmployeeCard,
                { backgroundColor: cardColor },
              ]}
              onPress={() => handleUserSelect(user)}
            >
              <View style={styles.employeeMainInfo}>
                <View style={styles.employeeHeader}>
                  <View style={styles.nameSection}>
                    <Text style={[styles.employeeName, { color: textColor }]}>
                      {user.name}
                    </Text>
                    {user.employeeNumber && (
                      <Text
                        style={[styles.employeeNumber, { color: textColor }]}
                      >
                        #{user.employeeNumber}
                      </Text>
                    )}
                  </View>
                  <View style={styles.statusContainer}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: user.isActive
                            ? "#10b981"
                            : "#ef4444",
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: user.isActive ? "#10b981" : "#ef4444" },
                      ]}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>

                <View style={styles.employeeDetails}>
                  <Text style={[styles.deviceInfo, { color: textColor }]}>
                    {user.deviceInfo || "Unknown device"}
                  </Text>

                  <View style={styles.detailRow}>
                    <View style={styles.batteryContainer}>
                      <Fontisto
                        name={getBatteryIconName(user.batteryLevel) as any}
                        size={16}
                        color={getBatteryColor(user.batteryLevel)}
                      />
                      <Text
                        style={[
                          styles.batteryText,
                          {
                            color: getBatteryTextColor(
                              user.batteryLevel,
                              textColor
                            ),
                          },
                        ]}
                      >
                        {user.batteryLevel}%
                      </Text>
                    </View>

                    {user.location.latitude && user.location.longitude ? (
                      <View className="flex justify-end">
                        <Text style={[styles.lastUpdate, { color: textColor }]}>
                          {formatLastUpdated(user.lastUpdated)}
                        </Text>
                        <LocationName
                          latitude={user.location.latitude}
                          longitude={user.location.longitude}
                          style={[styles.locationText, { color: textColor }]}
                        />
                      </View>
                    ) : (
                      <Text style={[styles.noLocation, { color: textColor }]}>
                        No location data available
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>

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
    fontSize: 18,
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
  employeeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
  },
  employeeDetails: {
    gap: 8,
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
    width: 6,
    height: 6,
    borderRadius: 3,
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
}); 