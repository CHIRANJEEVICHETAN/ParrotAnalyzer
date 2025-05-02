import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Modal,
  Animated,
  Easing,
  Alert,
  InteractionManager,
  Platform,
  StyleSheet,
  TextInput,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import ThemeContext from "../../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, differenceInSeconds } from "date-fns";
import axios from "axios";
import AuthContext from "../../context/AuthContext";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { useLocationTracking } from "../../hooks/useLocationTracking";
import { useGeofencing } from "../../hooks/useGeofencing";
import useLocationStore from "../../store/locationStore";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import { Location as AppLocation } from "../../types/liveTracking";

interface ShiftData {
  date: string;
  startTime: string;
  endTime: string | null;
  duration: string | null;
}

interface ShiftStatus {
  isActive: boolean;
  startTime: string | null;
}

interface RecentShift {
  id: number;
  start_time: string;
  end_time: string | null;
  duration: string;
  date: string;
}

interface WarningMessage {
  title: string;
  message: string;
}

// Add notification-related constants
const SHIFT_WARNING_TIME = 7 * 60 * 60 + 55 * 60 * 1000; // 7 hours 55 minutes in milliseconds
const SHIFT_LIMIT_TIME = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

const NOTIFICATION_CHANNELS = {
  ACTIVE_SHIFT: "active-shift",
  SHIFT_WARNING: "shift-warning",
  SHIFT_LIMIT: "shift-limit",
} as const;

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Add these warning messages array before the component
const warningMessages: WarningMessage[] = [
  {
    title: "Important Shift Notice",
    message:
      "Please start and end your shifts properly on time. Never forget to end your shift before leaving.",
  },
  {
    title: "Warning",
    message:
      "Do not logout or uninstall the app without ending your active shift first.",
  },
];

// Update the combined warning message format to include titles
const combinedWarningMessage = {
  title: "Important Notices",
  notices: warningMessages.map((msg) => ({
    title: msg.title,
    message: msg.message,
  })),
};

// Update the TimerPicker component with manual time selection
const TimerPicker = ({
  visible,
  onClose,
  onSelectHours,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectHours: (hours: number) => void;
  isDark: boolean;
}) => {
  const [manualHours, setManualHours] = useState("");
  const [manualMinutes, setManualMinutes] = useState("");

  const handleManualSubmit = () => {
    const hours = parseFloat(manualHours) || 0;
    const minutes = parseFloat(manualMinutes) || 0;
    const totalHours = hours + minutes / 60;

    if (totalHours <= 0) {
      Alert.alert("Invalid Time", "Please enter a valid duration");
      return;
    }

    if (totalHours > 24) {
      Alert.alert("Invalid Duration", "Duration cannot exceed 24 hours");
      return;
    }

    onSelectHours(totalHours);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-center items-center bg-black/50">
        <View
          className={`m-5 p-6 rounded-xl ${
            isDark ? "bg-gray-800" : "bg-white"
          } w-5/6`}
        >
          <Text
            className={`text-xl font-bold mb-4 ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Set Shift Duration
          </Text>

          {/* Preset durations */}
          <Text
            className={`text-sm font-medium mb-2 ${
              isDark ? "text-gray-300" : "text-gray-600"
            }`}
          >
            Preset Durations
          </Text>
          <View className="flex-row flex-wrap justify-between gap-2 mb-4">
            {[4, 6, 8, 9, 10, 12].map((hours) => (
              <TouchableOpacity
                key={hours}
                onPress={() => onSelectHours(hours)}
                className={`p-4 rounded-lg mb-2 w-[48%] ${
                  isDark ? "bg-gray-700" : "bg-gray-100"
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  {hours} Hours
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Manual time selection */}
          <View className="mt-4">
            <Text
              className={`text-sm font-medium mb-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Custom Duration
            </Text>
            <View className="flex-row justify-between items-center gap-2">
              <View className="flex-1">
                <Text
                  className={`text-xs mb-1 ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Hours
                </Text>
                <TextInput
                  value={manualHours}
                  onChangeText={(text) =>
                    setManualHours(text.replace(/[^0-9]/g, ""))
                  }
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="0"
                  className={`p-3 rounded-lg ${
                    isDark
                      ? "bg-gray-700 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                />
              </View>
              <View className="flex-1">
                <Text
                  className={`text-xs mb-1 ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Minutes
                </Text>
                <TextInput
                  value={manualMinutes}
                  onChangeText={(text) => {
                    const num = parseInt(text);
                    if (!text || (num >= 0 && num < 60)) {
                      setManualMinutes(text.replace(/[^0-9]/g, ""));
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="0"
                  className={`p-3 rounded-lg ${
                    isDark
                      ? "bg-gray-700 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                />
              </View>
              <TouchableOpacity
                onPress={handleManualSubmit}
                className="bg-blue-500 p-3 rounded-lg mt-4"
              >
                <Text className="text-white font-semibold">Set</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={onClose}
            className="mt-6 p-4 rounded-lg bg-gray-500"
          >
            <Text className="text-white text-center font-semibold">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Add this helper function at the top level
const getApiEndpoint = (role: string) => {
  switch (role) {
    case "employee":
      return "/api/employee";
    case "group-admin":
      return "/api/group-admin";
    case "management":
      return "/api/management";
    default:
      return "/api/employee";
  }
};

// Add this helper function for role-specific titles
const getRoleSpecificTitle = (role: string) => {
  switch (role) {
    case "employee":
      return "Employee Shift Tracker";
    case "group-admin":
      return "Group Admin Shift Tracker";
    case "management":
      return "Management Shift Tracker";
    default:
      return "Shift Tracker";
  }
};

// Add this function to format coordinates for display
const formatCoordinates = (latitude?: number, longitude?: number) => {
  if (latitude === undefined || longitude === undefined) return "Unknown";
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
};

// Add a new function to get address from coordinates
const getLocationAddress = async (latitude: number, longitude: number): Promise<string> => {
  try {
    const results = await Location.reverseGeocodeAsync({
      latitude,
      longitude
    });
    
    if (results && results.length > 0) {
      const location = results[0];
      // Format the address based on available data
      const addressParts = [];
      
      if (location.name) addressParts.push(location.name);
      if (location.street) addressParts.push(location.street);
      if (location.district) addressParts.push(location.district);
      if (location.city) addressParts.push(location.city);
      if (location.region) addressParts.push(location.region);
      
      // Return first 2 parts for a concise display
      if (addressParts.length > 0) {
        return addressParts.slice(0, 2).join(', ');
      }
    }
    
    // Fallback to coordinates if geocoding fails
    return formatCoordinates(latitude, longitude);
  } catch (error) {
    console.error('Error getting address:', error);
    return formatCoordinates(latitude, longitude);
  }
};

const getNotificationEndpoint = (role: string) => {
  switch (role) {
    case "employee":
      return "/api/employee-notifications/notify-admin";
    case "group-admin":
      return "/api/group-admin-notifications/notify-admin";
    default:
      return "/api/employee-notifications/notify-admin";
  }
};

// Add a custom InAppNotification component
const InAppNotification = ({
  visible,
  message,
  type = "info",
  duration = 5000,
  onDismiss,
}: {
  visible: boolean;
  message: string;
  type?: "info" | "warning" | "error" | "success";
  duration?: number;
  onDismiss: () => void;
}) => {
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === "dark";
  const [opacity] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onDismiss();
        });
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration, opacity, onDismiss]);

  if (!visible) return null;

  const getBackgroundColor = () => {
    switch (type) {
      case "success":
        return isDark ? "#065f46" : "#10b981";
      case "warning":
        return isDark ? "#92400e" : "#f59e0b";
      case "error":
        return isDark ? "#991b1b" : "#ef4444";
      default:
        return isDark ? "#1e40af" : "#3b82f6";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return "checkmark-circle";
      case "warning":
        return "warning";
      case "error":
        return "alert-circle";
      default:
        return "information-circle";
    }
  };

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: Platform.OS === "ios" ? 50 : 20,
          left: 16,
          right: 16,
          backgroundColor: getBackgroundColor(),
          borderRadius: 12,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 4,
          zIndex: 9999,
          opacity,
        },
      ]}
    >
      <Ionicons name={getIcon()} size={24} color="#fff" />
      <Text
        style={{
          color: "#fff",
          marginLeft: 10,
          flex: 1,
          fontSize: 14,
          fontWeight: "500",
        }}
      >
        {message}
      </Text>
      <TouchableOpacity onPress={onDismiss}>
        <Ionicons name="close" size={20} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
};

// Add this function to safely access battery level
const getBatteryLevel = (location: any): number | undefined => {
  if (!location) return undefined;

  // Check if batteryLevel exists directly on the location object
  if (typeof location.batteryLevel === "number") {
    return location.batteryLevel;
  }

  // Check if battery exists directly on the location object (some implementations use this)
  if (typeof location.battery === "number") {
    return location.battery;
  }

  return undefined;
};

// Create a helper function to convert EnhancedLocation to Location
// Add this after the formatCoordinates function (around line 90)
const convertToLocation = (enhancedLocation: any): AppLocation | null => {
  if (!enhancedLocation) return null;
  
  // If it already has the format of our Location type
  if (typeof enhancedLocation.latitude === 'number') {
    return enhancedLocation as AppLocation;
  }
  
  // If it has coords structure (EnhancedLocation), extract needed properties
  if (enhancedLocation.coords) {
    return {
      latitude: enhancedLocation.coords.latitude,
      longitude: enhancedLocation.coords.longitude,
      accuracy: enhancedLocation.coords.accuracy || null,
      altitude: enhancedLocation.coords.altitude || null,
      altitudeAccuracy: enhancedLocation.coords.altitudeAccuracy || null,
      heading: enhancedLocation.coords.heading || null,
      speed: enhancedLocation.coords.speed || null,
      timestamp: enhancedLocation.timestamp || Date.now(),
      batteryLevel: enhancedLocation.batteryLevel,
      isMoving: enhancedLocation.isMoving
    };
  }
  
  return null;
};

export default function EmployeeShiftTracker() {
  const { theme } = ThemeContext.useTheme();
  const { token, user } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === "dark";

  // Animated values
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const spinValue = React.useRef(new Animated.Value(0)).current;

  // State
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [shiftStart, setShiftStart] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [shiftHistory, setShiftHistory] = useState<ShiftData[]>([]);
  // Add state for currentAddress
  const [currentAddress, setCurrentAddress] = useState<string>("Acquiring location...");
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<{
    title: string;
    message: string;
    type: "success" | "info";
    showCancel?: boolean;
  }>({
    title: "",
    message: "",
    type: "info",
    showCancel: false,
  });
  const [recentShifts, setRecentShifts] = useState<RecentShift[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [timerDuration, setTimerDuration] = useState<number | null>(null);
  const [timerEndTime, setTimerEndTime] = useState<Date | null>(null);
  const [currentWarningIndex, setCurrentWarningIndex] = useState(-1);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [notificationId, setNotificationId] = useState<string | null>(null);
  // Add geofence validation state
  const [locationValidated, setLocationValidated] = useState(false);
  const [showLocationError, setShowLocationError] = useState(false);
  const [locationErrorMessage, setLocationErrorMessage] = useState("");
  const [isLocationServiceEnabled, setIsLocationServiceEnabled] =
    useState(true);
  const [locationWatchId, setLocationWatchId] = useState<string | null>(null);
  const [locationOffTimer, setLocationOffTimer] =
    useState<NodeJS.Timeout | null>(null);
  const [inAppNotification, setInAppNotification] = useState<{
    visible: boolean;
    message: string;
    type: "info" | "warning" | "error" | "success";
  }>({
    visible: false,
    message: "",
    type: "info",
  });
  const [locationCheckInterval, setLocationCheckInterval] =
    useState<NodeJS.Timeout | null>(null);

  // Get the API endpoint based on user role
  const apiEndpoint = getApiEndpoint(user?.role || "employee");

  // Initialize location tracking hooks
  const {
    currentLocation,
    isInGeofence,
    batteryLevel,
    setIsInGeofence,
    setBatteryLevel,
  } = useLocationStore();

  const { getCurrentLocation } = useLocationTracking({
    onError: (error) => {
      console.error("Location tracking error:", error);
      setLocationErrorMessage(error);
      setShowLocationError(true);
    },
  });

  const { isLocationInAnyGeofence } = useGeofencing();

  // Check if the user can override geofence restrictions
  const [canOverrideGeofence, setCanOverrideGeofence] = useState(false);

  // Add this function before the useEffect
  const fetchAndUpdateGeofencePermissions = async () => {
    // Only check permissions for employee role
    if (user?.role !== "employee" || !user?.id || !token) {
      return;
    }

    try {
      console.log("Fetching fresh geofence permissions");

      // Always fetch fresh permissions from API first
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/employee/permissions`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data && Array.isArray(response.data.permissions)) {
        // Update state with fresh permissions
        setCanOverrideGeofence(
          response.data.permissions.includes("can_override_geofence")
        );

        // Cache fresh permissions in AsyncStorage
        await AsyncStorage.setItem(
          `user-${user.id}-permissions`,
          JSON.stringify(response.data.permissions)
        );

        console.log("Updated geofence permissions cache");
      }
    } catch (error) {
      console.error("Error fetching fresh permissions:", error);

      // If API call fails, try to use cached permissions as fallback
      try {
        const cachedPermissions = await AsyncStorage.getItem(
          `user-${user.id}-permissions`
        );
        if (cachedPermissions) {
          const permissions = JSON.parse(cachedPermissions);
          setCanOverrideGeofence(permissions.includes("can_override_geofence"));
          console.log("Using cached permissions as fallback");
        }
      } catch (storageError) {
        console.error("Error reading cached permissions:", storageError);
      }
    }
  };

  // Add this near other useEffect hooks
  useFocusEffect(
    useCallback(() => {
      console.log("ShiftTracker screen focused - fetching fresh permissions");
      fetchAndUpdateGeofencePermissions();
    }, [user, token])
  );

  // Add a new useEffect to fetch permissions on mount
  useEffect(() => {
    console.log("ShiftTracker mounted - fetching initial permissions");
    fetchAndUpdateGeofencePermissions();
  }, []);

  // Load persistent state
  useEffect(() => {
    loadShiftStatus();
    loadShiftHistoryFromBackend();
  }, []);

  // Animation effects
  useEffect(() => {
    if (isShiftActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [isShiftActive]);

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (isShiftActive && shiftStart) {
        setElapsedTime(differenceInSeconds(new Date(), shiftStart));
        updateEmployeeDashboard();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isShiftActive, shiftStart]);

  const loadShiftStatus = async () => {
    try {
      const status = await AsyncStorage.getItem(`${user?.role}-shiftStatus`);
      if (status) {
        const { isActive, startTime } = JSON.parse(status);
        setIsShiftActive(isActive);
        if (isActive && startTime) {
          setShiftStart(new Date(startTime));
        }
      }
    } catch (error) {
      console.error("Error loading shift status:", error);
    }
  };

  const loadShiftHistoryFromBackend = async () => {
    try {
      const currentMonth = format(new Date(), "yyyy-MM");
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}${apiEndpoint}/attendance/${currentMonth}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const convertedHistory: ShiftData[] = response.data
        .map((shift: any) => {
          try {
            const startTime = new Date(shift.shifts[0]?.shift_start);
            const endTime = shift.shifts[0]?.shift_end
              ? new Date(shift.shifts[0].shift_end)
              : null;

            return {
              date: format(startTime, "yyyy-MM-dd"),
              startTime: format(startTime, "HH:mm:ss"),
              endTime: endTime ? format(endTime, "HH:mm:ss") : null,
              duration: shift.total_hours
                ? formatElapsedTime(
                    parseFloat(shift.total_hours.toString()) * 3600
                  )
                : null,
            };
          } catch (err) {
            console.error("Error parsing shift data:", err, shift);
            return null;
          }
        })
        .filter(Boolean);

      console.log("Converted history:", convertedHistory);
      setShiftHistory(convertedHistory);
    } catch (error) {
      console.error("Error loading shift history:", error);
    }
  };

  const updateEmployeeDashboard = async () => {
    try {
      const dashboardData = {
        shiftStatus: isShiftActive ? "Active Shift" : "No Active Shift",
        attendanceStatus: isShiftActive ? "Present" : "Not Marked",
        currentShiftDuration: formatElapsedTime(elapsedTime),
      };
      await AsyncStorage.setItem(
        `${user?.role}-dashboardStatus`,
        JSON.stringify(dashboardData)
      );
    } catch (error) {
      console.error("Error updating dashboard:", error);
    }
  };

  // Format elapsed time
  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Optimize animations with useCallback
  const startAnimations = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [pulseAnim, rotateAnim]);

  // Add this helper function at the top
  const formatDateForBackend = (date: Date) => {
    // Format date in local timezone without any conversion
    return format(date, "yyyy-MM-dd'T'HH:mm:ss.SSS");
  };

  // Modify the notification scheduling code
  const schedulePersistentNotification = async () => {
    try {
      // Cancel any existing notifications
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      }

      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Notifications are required to track your shift status."
        );
        return;
      }

      // Set up notification channels for Android
      if (Platform.OS === "android") {
        // Active shift channel
        await Notifications.setNotificationChannelAsync(
          NOTIFICATION_CHANNELS.ACTIVE_SHIFT,
          {
            name: "Active Shift",
            importance: Notifications.AndroidImportance.HIGH,
            lockscreenVisibility:
              Notifications.AndroidNotificationVisibility.PUBLIC,
            sound: "default",
            enableVibrate: true,
            vibrationPattern: [0, 250, 250, 250],
            showBadge: true,
          }
        );

        // Shift warning channel
        await Notifications.setNotificationChannelAsync(
          NOTIFICATION_CHANNELS.SHIFT_WARNING,
          {
            name: "Shift Warnings",
            importance: Notifications.AndroidImportance.MAX,
            lockscreenVisibility:
              Notifications.AndroidNotificationVisibility.PUBLIC,
            sound: "default",
            enableVibrate: true,
            vibrationPattern: [0, 500, 250, 500],
            showBadge: true,
          }
        );

        // Shift limit channel
        await Notifications.setNotificationChannelAsync(
          NOTIFICATION_CHANNELS.SHIFT_LIMIT,
          {
            name: "Shift Limit Alert",
            importance: Notifications.AndroidImportance.MAX,
            lockscreenVisibility:
              Notifications.AndroidNotificationVisibility.PUBLIC,
            sound: "default",
            enableVibrate: true,
            vibrationPattern: [0, 1000, 500, 1000],
            showBadge: true,
          }
        );
      }

      // Schedule the persistent notification
      const activeShiftId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "🟢 Active Shift Running ⏰",
          body:
            "⚡ Live: Your shift is in progress!\n🔔 Remember to end your shift before leaving\n⏱️ Started at: " +
            format(shiftStart || new Date(), "hh:mm a"),
          priority: "max",
          sticky: false,
          color: "#3B82F6",
          badge: 1,
          vibrate: [0, 250, 250, 250],
          ...(Platform.OS === "android" && {
            channelId: NOTIFICATION_CHANNELS.ACTIVE_SHIFT,
            actions: [
              {
                identifier: "dismiss",
                title: "Dismiss",
                icon: "ic_close",
              },
            ],
          }),
          ...(Platform.OS === "ios" && {
            interruptionLevel: "timeSensitive",
          }),
          data: {
            type: "active-shift",
            startTime: shiftStart?.toISOString() || new Date().toISOString(),
            notificationId: "activeShift",
          },
        },
        trigger: null,
      });

      // Store the notification ID for later cancellation
      await AsyncStorage.setItem(
        `${user?.role}-activeShiftNotificationId`,
        activeShiftId
      );

      // Schedule warning notification (7 hours 55 minutes)
      const warningId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "⚠️ Shift Duration Warning",
          body: "Your shift will reach 8 hours in 5 minutes. Please prepare to end your shift.",
          priority: "max",
          sound: true,
          vibrate: [0, 500, 250, 500],
          ...(Platform.OS === "android" && {
            channelId: NOTIFICATION_CHANNELS.SHIFT_WARNING,
          }),
          ...(Platform.OS === "ios" && {
            interruptionLevel: "timeSensitive",
          }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          repeats: false,
          seconds: SHIFT_WARNING_TIME / 1000,
        },
      });

      // Schedule limit notification (8 hours)
      const limitId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "⛔ Shift Duration Limit Reached",
          body: "You have completed 8 hours of work. Please end your shift now.",
          priority: "max",
          sound: true,
          vibrate: [0, 1000, 500, 1000],
          ...(Platform.OS === "android" && {
            channelId: NOTIFICATION_CHANNELS.SHIFT_LIMIT,
          }),
          ...(Platform.OS === "ios" && {
            interruptionLevel: "critical",
          }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          repeats: false,
          seconds: SHIFT_LIMIT_TIME / 1000,
        },
      });

      // Store all notification IDs
      await AsyncStorage.setItem(
        `${user?.role}-shiftNotifications`,
        JSON.stringify({
          activeShiftId,
          warningId,
          limitId,
        })
      );
    } catch (error) {
      console.error("Error scheduling notifications:", error);
    }
  };

  // Add function to cancel all shift-related notifications
  const cancelShiftNotifications = async () => {
    try {
      const notificationIdsString = await AsyncStorage.getItem(
        `${user?.role}-shiftNotifications`
      );
      if (notificationIdsString) {
        const { activeShiftId, warningId, limitId } = JSON.parse(
          notificationIdsString
        );

        // Cancel all notifications
        await Promise.all([
          Notifications.cancelScheduledNotificationAsync(activeShiftId),
          Notifications.cancelScheduledNotificationAsync(warningId),
          Notifications.cancelScheduledNotificationAsync(limitId),
        ]);

        // Clear stored notification IDs
        await AsyncStorage.removeItem(`${user?.role}-shiftNotifications`);
        setNotificationId(null);
      }
    } catch (error) {
      console.error("Error canceling notifications:", error);
    }
  };

  // Add a function to show in-app notifications
  const showInAppNotification = (
    message: string,
    type: "info" | "warning" | "error" | "success" = "info"
  ) => {
    // First dismiss any existing notification
    setInAppNotification({
      visible: false,
      message: "",
      type: "info",
    });

    // Then show new notification after a small delay
    setTimeout(() => {
      setInAppNotification({
        visible: true,
        message,
        type,
      });
    }, 300);
  };

  // Initialize location on component mount
  useEffect(() => {
    const initializeLocation = async () => {
      try {
        // Only initialize location for employee and group-admin roles
        if (user?.role === 'management') {
          return;
        }
        
        // Check if location services are enabled
        const locationEnabled = await Location.hasServicesEnabledAsync();
        setIsLocationServiceEnabled(locationEnabled);

        if (!locationEnabled) {
          setLocationErrorMessage(
            "Location services are required for tracking. Please enable location services to continue."
          );
          setShowLocationError(true);
          return;
        }

        // Get current location
        const location = await getCurrentLocation();

        if (!location) {
          setLocationErrorMessage(
            "Unable to determine your current location. Please ensure you have granted location permissions."
          );
          setShowLocationError(true);
        }
      } catch (error: any) {
        console.error("Error initializing location:", error);
        setLocationErrorMessage(
          error.message || "Failed to initialize location services"
        );
        setShowLocationError(true);
      }
    };

    initializeLocation();
  }, [user?.role]);

  // Fix the useEffect that updates battery level
  useEffect(() => {
    if (currentLocation) {
      // Update geofence status in the store - this was missing
      const isInside = isLocationInAnyGeofence(currentLocation);
      setIsInGeofence(isInside);
      console.log("Updated geofence status:", { isInside, currentLocation });

      // Update battery level if available
      const battery = getBatteryLevel(currentLocation);
      if (battery !== undefined) {
        setBatteryLevel(battery);
      }
    }
  }, [
    currentLocation,
    isLocationInAnyGeofence,
    setIsInGeofence,
    setBatteryLevel,
  ]);

  // Monitor location services status during active shift
  useEffect(() => {
    // Only monitor location services for employee role
    if (!isShiftActive || user?.role !== 'employee') {
      return;
    }
    
    // Setup interval to check location services status
    const intervalId = setInterval(async () => {
      try {
        // Check if location services are enabled
        const locationEnabled = await Location.hasServicesEnabledAsync();

        // Only take action if the state has changed
        if (locationEnabled !== isLocationServiceEnabled) {
          setIsLocationServiceEnabled(locationEnabled);

          if (!locationEnabled) {
            // Location services disabled - show notification and start countdown
            showInAppNotification(
              "Location services are turned off. Please enable location services immediately to continue your shift, or it will end automatically in 5 minutes.",
              "warning"
            );

            // Cancel any existing timer before creating a new one
            if (locationOffTimer) {
              clearTimeout(locationOffTimer);
              setLocationOffTimer(null);
            }

            // Start new countdown timer to end shift
            const timer = setTimeout(() => {
              if (isShiftActive) {
                // Show a confirmation dialog instead of auto-ending
                setModalData({
                  title: "Location Services Disabled",
                  message:
                    "Your shift needs to be ended because location services have been disabled for over 5 minutes. Would you like to enable location services now or end your shift?",
                  type: "info",
                  showCancel: true,
                });

                // Store the original modal action
                const originalConfirmEndShift = confirmEndShift;

                // Temporarily override confirmEndShift to handle this special case
                (confirmEndShift as any) = async () => {
                  // Restore original function
                  (confirmEndShift as any) = originalConfirmEndShift;

                  // End shift without location validation
                  const now = new Date();
                  if (!shiftStart) return;

                  // Immediately update UI state
                  setShowModal(false);
                  setIsShiftActive(false);
                  setShiftStart(null);
                  pulseAnim.setValue(1);
                  rotateAnim.setValue(0);

                  // Clear monitoring resources
                  if (locationOffTimer) {
                    clearTimeout(locationOffTimer);
                    setLocationOffTimer(null);
                  }

                  if (locationCheckInterval) {
                    clearInterval(locationCheckInterval);
                    setLocationCheckInterval(null);
                  }

                  if (locationWatchId) {
                    clearInterval(locationWatchId as any);
                    setLocationWatchId(null);
                  }

                  // Calculate duration
                  const duration = formatElapsedTime(
                    differenceInSeconds(now, shiftStart)
                  );

                  // Show completion modal
                  setModalData({
                    title: "Shift Completed",
                    message: `Total Duration: ${duration}\nStart: ${format(
                      shiftStart,
                      "hh:mm a"
                    )}\nEnd: ${format(now, "hh:mm a")}`,
                    type: "success",
                    showCancel: false,
                  });
                  setShowModal(true);

                  // Process in background
                  InteractionManager.runAfterInteractions(async () => {
                    try {
                      await cancelShiftNotifications();

                      // Create shift data for API
                      const newShiftData: ShiftData = {
                        date: format(shiftStart, "yyyy-MM-dd"),
                        startTime: format(shiftStart, "HH:mm:ss"),
                        endTime: format(now, "HH:mm:ss"),
                        duration,
                      };

                      // End shift API calls
                      await Promise.all([
                        axios.post(
                          `${process.env.EXPO_PUBLIC_API_URL}${apiEndpoint}/shift/end`,
                          {
                            endTime: formatDateForBackend(now),
                            locationServicesDisabled: true, // Add flag to indicate why shift ended
                          },
                          {
                            headers: { Authorization: `Bearer ${token}` },
                          }
                        ),
                        AsyncStorage.removeItem(`${user?.role}-shiftStatus`),
                        AsyncStorage.setItem(
                          `${user?.role}-shiftHistory`,
                          JSON.stringify([newShiftData, ...shiftHistory])
                        ),
                      ]);

                      // Refresh data
                      await Promise.all([
                        loadShiftHistoryFromBackend(),
                        fetchRecentShifts(),
                      ]);
                      setLocationValidated(false);
                    } catch (error: any) {
                      console.error("Error ending shift:", error);
                      showInAppNotification(
                        error.response?.data?.error ||
                          "Failed to end shift. Please try again.",
                        "error"
                      );
                    }
                  });
                };

                // Override the cancel action
                const setShowModalOriginal = setShowModal;
                (setShowModal as any) = (value: boolean) => {
                  // If canceling, try to enable location
                  if (!value) {
                    // Restore functions
                    (confirmEndShift as any) = originalConfirmEndShift;
                    (setShowModal as any) = setShowModalOriginal;

                    // Reset the timer
                    if (locationOffTimer) {
                      clearTimeout(locationOffTimer);
                    }

                    // Try to enable location
                    Location.requestForegroundPermissionsAsync().then(
                      ({ status }) => {
                        if (status === "granted") {
                          Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced,
                            mayShowUserSettingsDialog: true,
                          }).catch(() => {
                            // Start a new timer if enabling location failed
                            const newTimer = setTimeout(() => {
                              if (isShiftActive) {
                                showInAppNotification(
                                  "Your shift will end soon if location services remain disabled.",
                                  "warning"
                                );
                              }
                            }, 4 * 60 * 1000); // Give another 4 minutes
                            setLocationOffTimer(newTimer);
                          });
                        }
                      }
                    );
                  }

                  // Call original function
                  setShowModalOriginal(value);
                };

                setShowModal(true);
              }
            }, 5 * 60 * 1000); // 5 minutes

            setLocationOffTimer(timer);
          } else {
            // Location services turned back on - show notification and cancel timer
            showInAppNotification(
              "Location services have been re-enabled. Your shift will continue normally.",
              "success"
            );

            // Cancel countdown timer if it exists
            if (locationOffTimer) {
              clearTimeout(locationOffTimer);
              setLocationOffTimer(null);
            }
          }
        }
      } catch (error) {
        console.error("Error checking location services:", error);
      }
    }, 5000); // Check every 5 seconds

    setLocationCheckInterval(intervalId);

    return () => {
      // Clean up interval on unmount or when shift becomes inactive
      if (locationCheckInterval) {
        clearInterval(locationCheckInterval);
      }

      // Clear any existing timer
      if (locationOffTimer) {
        clearTimeout(locationOffTimer);
        setLocationOffTimer(null);
      }
    };
  }, [isShiftActive, isLocationServiceEnabled, user?.role]);

  // Replace the sequential warnings function with a single modal
  const showWarningMessages = useCallback(() => {
    setShowWarningModal(true);
  }, []);

  // Add this helper function to safely get location
  const safeGetCurrentLocation = async (): Promise<AppLocation | null> => {
    try {
      // Get the location from the hook
      const locationResult = await getCurrentLocation();
      
      // Convert it to our app location format
      return locationResult ? convertToLocation(locationResult) : null;
    } catch (error) {
      console.error("Error getting current location:", error);
      return null;
    }
  };

  // Update the validateLocationForShift function to use safeGetCurrentLocation
  const validateLocationForShift = async (): Promise<boolean> => {
    // Management and group-admin roles don't need location validation
    if (user?.role === 'management' || user?.role === 'group-admin') {
      setLocationValidated(true);
      return true;
    }
    
    try {
      // First check if location services are enabled
      const locationEnabled = await Location.hasServicesEnabledAsync();
      if (!locationEnabled) {
        setLocationErrorMessage(
          "Location services are turned off. Please enable location services to start or end your shift."
        );
        setShowLocationError(true);
        return false;
      }

      // Try to use cached location first if it's recent enough (last 30 seconds)
      let appLocation = currentLocation;
      if (
        !appLocation ||
        !appLocation.timestamp ||
        new Date().getTime() - new Date(appLocation.timestamp).getTime() > 30000
      ) {
        // Get fresh location if cached one is old or missing
        const appLocation = await safeGetCurrentLocation();
      }

      if (!appLocation) {
        throw new Error("Unable to determine your current location");
      }

      // Check if location is within a geofence
      const isInside = isLocationInAnyGeofence(appLocation);

      // Implementation of new permission logic:
      // 1. If user is inside geofence: Allow regardless of permission
      if (isInside) {
        setLocationValidated(true);
        return true;
      }

      // 2. If user is outside geofence but has override permission: Allow
      if (canOverrideGeofence) {
        // Show a notification that they're using override permission
        showInAppNotification(
          "You are outside designated work areas but using your override permission to continue.",
          "warning"
        );
        setLocationValidated(true);
        return true;
      }

      // 3. If user is outside geofence and doesn't have override permission: Show error
      setLocationErrorMessage(
        "You don't have permission to start or end your shift outside designated work areas. Please move to a work area or contact your administrator for override permission."
      );
      setShowLocationError(true);
      return false;
    } catch (error: any) {
      setLocationErrorMessage(error.message || "Location validation failed");
      setShowLocationError(true);
      return false;
    }
  };

  // Make handleStartShift more responsive by updating UI more quickly
  const handleStartShift = async () => {
    try {
      // Update UI immediately to show we're processing
      Animated.timing(pulseAnim, {
        toValue: 1.05,
        duration: 150,
        useNativeDriver: true,
      }).start();

      // Only validate location for employee role
      let isLocationValid = true;
      if (user?.role === 'employee') {
        isLocationValid = await validateLocationForShift();

        if (!isLocationValid) {
          // Reset animation if validation fails
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }).start();
          return;
        }
      }

      const now = new Date();

      // Update UI immediately
      setShiftStart(now);
      setIsShiftActive(true);
      setElapsedTime(0);
      startAnimations();

      // Show feedback immediately
      setModalData({
        title: "Starting Shift",
        message: `Your shift is starting at ${format(now, "hh:mm a")}...`,
        type: "success",
        showCancel: false,
      });
      setShowModal(true);

      // Perform API call and storage updates in background
      InteractionManager.runAfterInteractions(async () => {
        try {
          // Include location data in the API call for employee role only
          const locationData = user?.role === 'employee' && currentLocation
            ? {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                accuracy: currentLocation.accuracy || 0,
              }
            : undefined;

          // Start shift API call using role-specific endpoint
          await axios.post(
            `${process.env.EXPO_PUBLIC_API_URL}${apiEndpoint}/shift/start`,
            {
              startTime: formatDateForBackend(now),
              location: locationData, // Include location data only for employees
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          // Send notification to appropriate recipients based on role
          if (user?.role !== "management") {
            await axios.post(
              `${process.env.EXPO_PUBLIC_API_URL}${getNotificationEndpoint(
                user?.role || "employee"
              )}`,
              {
                title: `🟢 Shift Started, by ${user?.name}`,
                message: `👤 ${user?.name} has started their shift at ${format(
                  now,
                  "hh:mm a"
                )} \n⏰ expected duration: ${
                  timerDuration ? `${timerDuration} hours` : `8 hours`
                }`,
                type: "shift-start",
              },
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
          }

          await AsyncStorage.setItem(
            `${user?.role}-shiftStatus`,
            JSON.stringify({
              isActive: true,
              startTime: now.toISOString(),
            })
          );

          // Schedule persistent notification
          await schedulePersistentNotification();

          // Update modal with success message
          setModalData({
            title: "Shift Started",
            message: `Your shift has started at ${format(
              now,
              "hh:mm a"
            )}. The timer will continue running even if you close the app.`,
            type: "success",
            showCancel: false,
          });

          // Show warning messages after shift start confirmation with new combined modal
          setTimeout(() => {
            showWarningMessages();
          }, 1500);
        } catch (error: any) {
          // Revert UI state on error
          setShiftStart(null);
          setIsShiftActive(false);
          setElapsedTime(0);
          pulseAnim.setValue(1);
          rotateAnim.setValue(0);

          showInAppNotification(
            error.response?.data?.error ||
              "Failed to start shift. Please try again.",
            "error"
          );
        }
      });
    } catch (error: any) {
      // Handle any unexpected errors
      console.error("Error starting shift:", error);
      showInAppNotification(
        error.message ||
          "An unexpected error occurred while starting your shift",
        "error"
      );

      // Reset UI
      setShiftStart(null);
      setIsShiftActive(false);
      setElapsedTime(0);
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  };

  // Make handleEndShift more responsive too
  const handleEndShift = () => {
    // Update UI immediately
    Animated.timing(pulseAnim, {
      toValue: 1.05,
      duration: 150,
      useNativeDriver: true,
    }).start();

    setModalData({
      title: "End Shift?",
      message: `Are you sure you want to end your current shift?`,
      type: "info",
      showCancel: true,
    });
    setShowModal(true);
  };

  // Restore confirmEndShift function with improved cleanup
  const confirmEndShift = async () => {
    // Only validate location for employee role and for non-timer initiated end shift
    if (user?.role === 'employee' && !timerEndTime) {
      const isLocationValid = await validateLocationForShift();

      if (!isLocationValid) {
        return;
      }
    }

    const now = new Date();
    if (!shiftStart) return;

    // Immediately update UI state
    setShowModal(false);
    setIsShiftActive(false);
    setShiftStart(null);
    pulseAnim.setValue(1);
    rotateAnim.setValue(0);

    // Clear any location monitoring resources
    if (locationOffTimer) {
      clearTimeout(locationOffTimer);
      setLocationOffTimer(null);
    }

    if (locationCheckInterval) {
      clearInterval(locationCheckInterval);
      setLocationCheckInterval(null);
    }

    if (locationWatchId) {
      clearInterval(locationWatchId as any);
      setLocationWatchId(null);
    }

    // Calculate duration for immediate feedback
    const duration = formatElapsedTime(differenceInSeconds(now, shiftStart));

    // Show completion modal immediately
    setModalData({
      title: "Shift Completed",
      message: `Total Duration: ${duration}\nStart: ${format(
        shiftStart,
        "hh:mm a"
      )}\nEnd: ${format(now, "hh:mm a")}`,
      type: "success",
      showCancel: false,
    });
    setShowModal(true);

    // Create new shift data
    const newShiftData: ShiftData = {
      date: format(shiftStart, "yyyy-MM-dd"),
      startTime: format(shiftStart, "HH:mm:ss"),
      endTime: format(now, "HH:mm:ss"),
      duration,
    };

    // Perform API call and storage updates in background
    InteractionManager.runAfterInteractions(async () => {
      try {
        // Cancel the active shift notification
        const activeShiftId = await AsyncStorage.getItem(
          `${user?.role}-activeShiftNotificationId`
        );
        if (activeShiftId) {
          await Notifications.cancelScheduledNotificationAsync(activeShiftId);
          await AsyncStorage.removeItem(
            `${user?.role}-activeShiftNotificationId`
          );
        }

        // Cancel all shift-related notifications
        await cancelShiftNotifications();

        // Include location data in the API call for employee role only
        const locationData = user?.role === 'employee' && currentLocation
          ? {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              accuracy: currentLocation.accuracy || 0,
            }
          : undefined;

        // Send notification based on role
        if (user?.role !== "management") {
          await axios.post(
            `${process.env.EXPO_PUBLIC_API_URL}${getNotificationEndpoint(
              user?.role || "employee"
            )}`,
            {
              title: `🔴 Shift Ended, by ${user?.name}`,
              message: `👤 ${
                user?.name
              } has completed their shift\n⏱️ Duration: ${duration}\n🕒 Start: ${format(
                shiftStart,
                "hh:mm a"
              )}\n🕕 End: ${format(now, "hh:mm a")}`,
              type: "shift-end",
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
        }

        await Promise.all([
          // API call using role-specific endpoint with location data
          axios.post(
            `${process.env.EXPO_PUBLIC_API_URL}${apiEndpoint}/shift/end`,
            {
              endTime: formatDateForBackend(now),
              location: locationData, // Include location data only for employees
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          ),
          // Storage updates
          AsyncStorage.removeItem(`${user?.role}-shiftStatus`),
          AsyncStorage.setItem(
            `${user?.role}-shiftHistory`,
            JSON.stringify([newShiftData, ...shiftHistory])
          ),
        ]);

        // Refresh data in background
        await Promise.all([loadShiftHistoryFromBackend(), fetchRecentShifts()]);

        // Reset location validation state
        setLocationValidated(false);
      } catch (error: any) {
        console.error("Error ending shift:", error);

        // Show notification instead of alert
        showInAppNotification(
          error.response?.data?.error ||
            "Failed to end shift. Please try again.",
          "error"
        );

        // Revert UI state
        setIsShiftActive(true);
        setShiftStart(shiftStart);
        startAnimations();
      }
    });
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const fetchRecentShifts = async () => {
    try {
      setIsRefreshing(true);
      const response = await axios.get<RecentShift[]>(
        `${process.env.EXPO_PUBLIC_API_URL}${apiEndpoint}/shifts/recent`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Process and set the recent shifts
      const formattedShifts = response.data.map((shift: RecentShift) => {
        // Since timestamps are already in IST from backend, just create Date objects
        const startDate = new Date(shift.start_time);
        const endDate = shift.end_time ? new Date(shift.end_time) : null;

        return {
          ...shift,
          date: format(startDate, "yyyy-MM-dd"),
          // Format times in 12-hour format
          start_time: format(startDate, "hh:mm a"),
          end_time: endDate ? format(endDate, "hh:mm a") : "Ongoing",
          duration: shift.duration
            ? parseFloat(shift.duration).toFixed(1)
            : "0.0",
        };
      });

      setRecentShifts(formattedShifts);
    } catch (error) {
      console.error("Error fetching recent shifts:", error);
      Alert.alert("Error", "Failed to fetch recent shifts");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecentShifts();
  }, []);

  // Add this effect to handle the refresh animation
  React.useEffect(() => {
    if (isRefreshing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [isRefreshing]);

  // Add this with other interpolations
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Update the handleSetTimer function
  const handleSetTimer = (hours: number) => {
    const endTime = new Date(Date.now() + hours * 60 * 60 * 1000);
    setTimerDuration(hours);
    setTimerEndTime(endTime);
    setShowTimerPicker(false);

    // Show confirmation modal
    setModalData({
      title: "Timer Set",
      message: `Your shift will automatically end at ${format(
        endTime,
        "hh:mm a"
      )}`,
      type: "success",
      showCancel: false,
    });
    setShowModal(true);

    // Set timeout to end shift
    const timeoutId = setTimeout(() => {
      if (isShiftActive) {
        confirmEndShift();
      }
    }, hours * 60 * 60 * 1000);

    // Clear timeout if shift is ended manually
    return () => clearTimeout(timeoutId);
  };

  // Add this near other useEffect hooks
  useEffect(() => {
    // Handle notification dismissal attempts
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === "active-shift" && isShiftActive) {
          // Reschedule the notification if it was dismissed and shift is still active
          schedulePersistentNotification();
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [isShiftActive]);

  // Add this near your other useEffect hooks
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const { type, notificationId } =
          response.notification.request.content.data || {};

        if (
          type === "active-shift" &&
          response.actionIdentifier === "dismiss"
        ) {
          // Cancel the notification when dismiss is pressed
          Notifications.dismissNotificationAsync(
            response.notification.request.identifier
          );
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // Create a function to handle refresh
  const onRefresh = useCallback(async () => {
    console.log("Refreshing data and permissions");
    setIsRefreshing(true);

    try {
      // Run these operations in parallel
      await Promise.all([
        fetchAndUpdateGeofencePermissions(),
        loadShiftHistoryFromBackend(),
        fetchRecentShifts(),
      ]);

      // Show success notification
      showInAppNotification("Data refreshed successfully", "success");
    } catch (error) {
      console.error("Error during refresh:", error);
      showInAppNotification("Failed to refresh some data", "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [user, token]);

  // Add useEffect to update address when location changes
  useEffect(() => {
    const updateAddress = async () => {
      if (currentLocation?.latitude && currentLocation?.longitude) {
        const address = await getLocationAddress(
          currentLocation.latitude,
          currentLocation.longitude
        );
        setCurrentAddress(address);
      }
    };
    
    updateAddress();
  }, [currentLocation]);

  return (
    <View className={`flex-1 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
      <StatusBar
        backgroundColor={isDark ? "#1F2937" : "#FFFFFF"}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      <LinearGradient
        colors={isDark ? ["#1F2937", "#111827"] : ["#FFFFFF", "#F3F4F6"]}
        className="pb-4"
        style={[
          styles.header,
          {
            paddingTop:
              Platform.OS === "ios"
                ? StatusBar.currentHeight || 44
                : StatusBar.currentHeight || 0,
          },
        ]}
      >
        <View className="flex-row items-center justify-between px-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2 rounded-full"
            style={{ backgroundColor: isDark ? "#374151" : "#F3F4F6" }}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? "#FFFFFF" : "#000000"}
            />
          </TouchableOpacity>
          <Text
            className={`text-2xl font-bold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            {getRoleSpecificTitle(user?.role || "employee")}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView
        className="flex-1 p-4"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={["#3B82F6", "#10B981"]}
            tintColor={isDark ? "#60A5FA" : "#3B82F6"}
            title="Refreshing permissions and data..."
            titleColor={isDark ? "#D1D5DB" : "#6B7280"}
          />
        }
      >
        {(user?.role === "employee" || user?.role === "group-admin") && (
          <View
            className={`rounded-lg p-4 mb-4 ${
              isDark ? "bg-gray-800" : "bg-white"
            }`}
          >
            <View className="flex-row justify-between items-center mb-2">
              <Text
                className={`font-semibold ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Location Status
              </Text>
              <View
                className={`px-2 py-1 rounded-full ${
                  isInGeofence ? "bg-green-100" : "bg-yellow-100"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    isInGeofence ? "text-green-800" : "text-yellow-800"
                  }`}
                >
                  {isInGeofence ? "In Work Area" : "Outside Work Area"}
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between items-center">
              <View>
                <Text
                  className={`text-xs ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Current Position
                </Text>
                <Text className={`${isDark ? "text-white" : "text-gray-800"}`}>
                  {currentAddress}
                </Text>
              </View>

              <View>
                <Text
                  className={`text-xs text-right ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Battery
                </Text>
                <View className="flex-row items-center justify-end">
                  <Ionicons
                    name={
                      batteryLevel > 75
                        ? "battery-full"
                        : batteryLevel > 45
                        ? "battery-half"
                        : batteryLevel > 15
                        ? "battery-half"
                        : "battery-dead"
                    }
                    size={16}
                    color={
                      batteryLevel > 20
                        ? isDark
                          ? "#10B981"
                          : "#059669"
                        : "#EF4444"
                    }
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    className={`${
                      batteryLevel > 20
                        ? isDark
                          ? "text-green-400"
                          : "text-green-600"
                        : "text-red-500"
                    }`}
                  >
                    {batteryLevel}%
                  </Text>
                </View>
              </View>
            </View>

            {/* Add geofence override indicator */}
            {canOverrideGeofence && (
              <View className="mt-2 px-3 py-1 bg-blue-100 self-start rounded-full">
                <Text className="text-xs text-blue-800 font-medium">
                  Geofence Override Enabled
                </Text>
              </View>
            )}
          </View>
        )}

        <View
          className={`rounded-lg p-6 mb-6 ${
            isDark ? "bg-gray-800" : "bg-white"
          }`}
        >
          <Text
            className={`text-center text-4xl font-bold mb-4 ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            {format(currentTime, "HH:mm:ss")}
          </Text>
          <Text
            className={`text-center text-lg ${
              isDark ? "text-gray-400" : "text-gray-500"
            }`}
          >
            {format(currentTime, "EEEE, MMMM do, yyyy")}
          </Text>
        </View>

        <View className="items-center mb-6">
          <Animated.View
            style={{
              transform: [{ scale: pulseAnim }],
            }}
          >
            <TouchableOpacity
              onPress={isShiftActive ? handleEndShift : handleStartShift}
              className={`w-40 h-40 rounded-full items-center justify-center ${
                isShiftActive ? "bg-red-500" : "bg-green-500"
              }`}
            >
              <Animated.View style={{ transform: [{ rotate }] }}>
                <Ionicons
                  name={isShiftActive ? "power" : "power-outline"}
                  size={60}
                  color="white"
                />
              </Animated.View>
              <Text className="text-white text-xl font-bold mt-2">
                {isShiftActive ? "End Shift" : "Start Shift"}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {isShiftActive && !timerEndTime && (
            <View className="mt-6">
              <TouchableOpacity
                onPress={() => setShowTimerPicker(true)}
                className={`px-6 py-3 rounded-lg flex-row items-center justify-center ${
                  isDark ? "bg-blue-600" : "bg-blue-500"
                }`}
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  elevation: 2,
                }}
              >
                <Ionicons name="timer-outline" size={24} color="white" />
                <Text className="text-white font-semibold ml-2">
                  Set Auto-End Timer
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {timerEndTime && (
            <View className="mt-4 items-center">
              <Text
                className={`text-sm ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Shift will end in
              </Text>
              <View className="flex-row items-center">
                <Ionicons
                  name="timer-outline"
                  size={20}
                  color={isDark ? "#60A5FA" : "#3B82F6"}
                />
                <Text
                  className={`ml-2 font-semibold ${
                    isDark ? "text-blue-400" : "text-blue-600"
                  }`}
                >
                  {format(timerEndTime, "hh:mm a")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setTimerDuration(null);
                  setTimerEndTime(null);
                }}
                className="mt-2 px-4 py-2 rounded-lg bg-red-500"
              >
                <Text className="text-white font-semibold">Cancel Timer</Text>
              </TouchableOpacity>
            </View>
          )}

          {isShiftActive && (
            <View className="mt-6">
              <Text
                className={`text-center text-lg ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Current Shift Duration
              </Text>
              <Text
                className={`text-center text-3xl font-bold ${
                  isDark ? "text-blue-400" : "text-blue-500"
                }`}
              >
                {formatElapsedTime(elapsedTime)}
              </Text>
            </View>
          )}
        </View>

        <View className="mt-4">
          <View className="flex-row justify-between items-center mb-4">
            <Text
              className={`text-lg font-semibold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Recent Shifts
            </Text>
            <TouchableOpacity
              onPress={fetchRecentShifts}
              disabled={isRefreshing}
              className={`p-2 rounded-full ${
                isDark ? "bg-gray-800" : "bg-gray-100"
              }`}
            >
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons
                  name="refresh-outline"
                  size={20}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>

          {recentShifts.length > 0 ? (
            recentShifts.map((shift: RecentShift, index: number) => (
              <View
                key={index}
                className={`mb-3 p-4 rounded-lg ${
                  isDark ? "bg-gray-800" : "bg-white"
                }`}
                style={[
                  styles.shiftCard,
                  { borderLeftWidth: 4, borderLeftColor: "#3B82F6" },
                ]}
              >
                <View>
                  <Text
                    className={`text-sm mb-2 ${
                      isDark ? "text-blue-400" : "text-blue-600"
                    }`}
                  >
                    {format(new Date(shift.date), "EEEE, MMMM do, yyyy")}
                  </Text>
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text
                        className={`text-sm ${
                          isDark ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Shift Time
                      </Text>
                      <View className="flex-row items-center">
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color={isDark ? "#9CA3AF" : "#6B7280"}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          className={`text-base font-semibold ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {shift.start_time} - {shift.end_time}
                        </Text>
                      </View>
                    </View>
                    <View>
                      <Text
                        className={`text-sm text-right ${
                          isDark ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Duration
                      </Text>
                      <View className="flex-row items-center">
                        <Ionicons
                          name="hourglass-outline"
                          size={16}
                          color={isDark ? "#9CA3AF" : "#6B7280"}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          className={`text-base font-semibold ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {shift.duration} hrs
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View
              className={`p-8 rounded-lg ${
                isDark ? "bg-gray-800" : "bg-white"
              }`}
            >
              <View className="items-center">
                <Ionicons
                  name="calendar-outline"
                  size={40}
                  color={isDark ? "#4B5563" : "#9CA3AF"}
                />
                <Text
                  className={`text-center mt-2 ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  No recent shifts found
                </Text>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={() =>
            router.push("/(dashboard)/shared/attendanceManagement")
          }
          className={`mx-4 my-6 p-4 rounded-xl flex-row items-center justify-center ${
            isDark ? "bg-blue-900" : "bg-blue-500"
          }`}
          style={styles.attendanceButton}
        >
          <Ionicons name="calendar-outline" size={24} color="white" />
          <Text className="text-white font-semibold text-lg ml-2">
            Attendance Management
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/50">
          <View
            className={`m-5 p-6 rounded-xl ${
              isDark ? "bg-gray-800" : "bg-white"
            } w-5/6`}
          >
            <Text
              className={`text-xl font-bold mb-4 ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {modalData.title}
            </Text>
            <Text
              className={`text-base mb-6 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {modalData.message}
            </Text>
            <View className={`flex-row justify-between gap-4`}>
              {modalData.showCancel && (
                <TouchableOpacity
                  onPress={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-lg bg-gray-500"
                >
                  <Text className="text-white text-center font-semibold">
                    Cancel
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  if (modalData.showCancel) {
                    confirmEndShift();
                  }
                  setShowModal(false);
                }}
                className={`flex-1 py-3 rounded-lg ${
                  modalData.type === "success" ? "bg-green-500" : "bg-blue-500"
                }`}
              >
                <Text className="text-white text-center font-semibold">
                  {modalData.showCancel ? "Confirm" : "OK"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TimerPicker
        visible={showTimerPicker}
        onClose={() => setShowTimerPicker(false)}
        onSelectHours={handleSetTimer}
        isDark={isDark}
      />

      {/* Warning Modal */}
      <Modal visible={showWarningModal} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/50">
          <View
            className={`m-5 p-6 rounded-xl ${
              isDark ? "bg-gray-800" : "bg-white"
            } w-5/6`}
          >
            <View className="flex-row items-center mb-4">
              <Ionicons name="warning-outline" size={24} color="#EF4444" />
              <Text className={`ml-2 text-xl font-bold text-red-500`}>
                {combinedWarningMessage.title}
              </Text>
            </View>

            {combinedWarningMessage.notices.map((notice, index) => (
              <View key={index} className="mb-4">
                <Text className={`text-lg font-semibold text-red-500 mb-2`}>
                  {notice.title}
                </Text>
                <Text
                  className={`text-base ${
                    isDark ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  {notice.message}
                </Text>
                {index === 0 && <View className="h-px bg-gray-300 my-4" />}
              </View>
            ))}

            <TouchableOpacity
              onPress={() => setShowWarningModal(false)}
              className="mt-2 py-3 rounded-lg bg-blue-500"
            >
              <Text className="text-white text-center font-semibold">
                I Understand
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add InAppNotification component */}
      <InAppNotification
        visible={inAppNotification.visible}
        message={inAppNotification.message}
        type={inAppNotification.type}
        onDismiss={() =>
          setInAppNotification({ ...inAppNotification, visible: false })
        }
      />

      {/* Enhanced Location error modal */}
      <Modal visible={showLocationError} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/50">
          <View
            className={`m-5 p-6 rounded-xl ${
              isDark ? "bg-gray-800" : "bg-white"
            } w-5/6`}
          >
            <View className="flex-row items-center mb-4">
              <Ionicons name="location-outline" size={24} color="#EF4444" />
              <Text className={`ml-2 text-xl font-bold text-red-500`}>
                Location Error
              </Text>
            </View>
            <Text
              className={`text-base mb-6 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {locationErrorMessage}
            </Text>
            <View className="flex-row justify-between gap-4">
              <TouchableOpacity
                onPress={() => setShowLocationError(false)}
                className="flex-1 py-3 rounded-lg bg-gray-500"
              >
                <Text className="text-white text-center font-semibold">
                  Later
                </Text>
              </TouchableOpacity>
              {canOverrideGeofence && (
                <TouchableOpacity
                  onPress={async () => {
                    setShowLocationError(false);

                    try {
                      // This will trigger the system location prompt if location is disabled
                      const { status: foregroundStatus } =
                        await Location.requestForegroundPermissionsAsync();

                      if (foregroundStatus === "granted") {
                        // If permissions are granted, try to get location which will prompt location services
                        try {
                          await Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.High,
                            // This is important - it forces the location prompt even when location services are off
                            mayShowUserSettingsDialog: true,
                          });

                          // If we get here, location services should be enabled
                          showInAppNotification(
                            "Location services enabled successfully.",
                            "success"
                          );

                          // Reinitialize location
                          const location = await getCurrentLocation();
                          if (location) {
                            // Update geofence status
                            const locationForGeofenceCheck = convertToLocation(location) as AppLocation | null;
                            const isInside = locationForGeofenceCheck !== null ? isLocationInAnyGeofence(locationForGeofenceCheck) : false;
                            console.log(
                              "Location enabled, updated geofence status:",
                              { isInside, location }
                            );
                          }
                        } catch (locationError) {
                          console.error(
                            "Error requesting location:",
                            locationError
                          );
                          // The user likely denied the location services prompt
                          showInAppNotification(
                            "Please enable location services to use all app features.",
                            "warning"
                          );
                        }
                      } else {
                        // Permission denied
                        showInAppNotification(
                          "Location permission is required for shift tracking.",
                          "warning"
                        );
                      }
                    } catch (error) {
                      console.error(
                        "Error requesting location permission:",
                        error
                      );
                      showInAppNotification(
                        "Unable to request location access. Please enable location from your device settings.",
                        "error"
                      );
                    }
                  }}
                  className="flex-1 py-3 rounded-lg bg-blue-500"
                >
                  <Text className="text-white text-center font-semibold">
                    Enable Location
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  attendanceButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  shiftCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
});
