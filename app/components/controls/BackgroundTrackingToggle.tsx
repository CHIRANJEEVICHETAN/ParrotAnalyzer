import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Linking,
  Switch,
  Platform,
  ActivityIndicator,
  AppState,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import useLocationStore from "../../store/locationStore";
import { useColorScheme, useThemeColor } from "../../hooks/useColorScheme";
import {
  isBackgroundLocationTrackingActive,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
} from "../../utils/backgroundLocationTask";
import BatteryOptimizationHelper from "../../utils/batteryOptimizationHelper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTracking } from "../../context/TrackingContext";

// Map location accuracy levels to Expo accuracy constants
const accuracyMap = {
  high: Location.Accuracy.High,
  balanced: Location.Accuracy.Balanced,
  low: Location.Accuracy.Low,
  passive: Location.Accuracy.Lowest,
};

interface BackgroundTrackingToggleProps {
  onToggle?: (enabled: boolean) => void;
  showIcon?: boolean;
  iconOnly?: boolean;
  size?: "small" | "medium" | "large";
}

// Add debounce function at the top level
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

const BackgroundTrackingToggle: React.FC<BackgroundTrackingToggleProps> = ({
  onToggle,
  showIcon = true,
  iconOnly = false,
  size = "medium",
}) => {
  const colorScheme = useColorScheme();
  const textColor = useThemeColor("#334155", "#e2e8f0");
  const backgroundColor = useThemeColor("#ffffff", "#1e293b");
  const accentColor = useThemeColor("#3b82f6", "#60a5fa");

  // Get background tracking enabled state from the location store
  const {
    backgroundTrackingEnabled,
    setBackgroundTrackingEnabled,
    locationAccuracy,
    updateIntervalSeconds,
  } = useLocationStore();

  // Add the tracking context
  const { 
    toggleBackgroundTracking: contextToggleBackgroundTracking,
    checkTrackingStatus
  } = useTracking();

  // Local state for switch state and loading state
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check the current status of background tracking when component mounts
  useEffect(() => {
    // Initial check
    checkBackgroundTrackingStatus();
  }, []); // Empty dependency array ensures this runs only on mount

  // Check if background tracking is currently active
  const checkBackgroundTrackingStatus = async () => {
    if (isLoading) return; // Skip if we're already in a loading state

    try {
      console.log("Checking background tracking status...");

      // Use the context method instead of direct function call
      const isActive = await checkTrackingStatus();
      console.log(`Background tracking task registered: ${isActive}`);

      // Only update UI if there's a mismatch to avoid unnecessary re-renders
      if (isEnabled !== isActive) {
        console.log(`Updating UI state: ${isEnabled} → ${isActive}`);
        setIsEnabled(isActive);
      }

      // Only update the store if there's a mismatch to avoid loops
      if (backgroundTrackingEnabled !== isActive) {
        console.log(
          `Updating store state: ${backgroundTrackingEnabled} → ${isActive}`
        );
        setBackgroundTrackingEnabled(isActive);

        // Also update AsyncStorage to keep everything in sync
        try {
          await AsyncStorage.setItem(
            "backgroundTrackingEnabled",
            JSON.stringify(isActive)
          );
        } catch (storageError) {
          console.error(
            "Failed to update background tracking setting in storage:",
            storageError
          );
        }
      }

      return isActive;
    } catch (error) {
      console.error("Error checking background tracking status:", error);

      // If we can't determine the status, assume it's inactive for safety
      if (isEnabled) {
        console.log("Setting UI state to inactive due to error");
        setIsEnabled(false);
      }

      if (backgroundTrackingEnabled) {
        console.log("Setting store state to inactive due to error");
        setBackgroundTrackingEnabled(false);

        try {
          await AsyncStorage.setItem("backgroundTrackingEnabled", "false");
        } catch (storageError) {
          console.error(
            "Failed to update background tracking setting in storage:",
            storageError
          );
        }
      }

      return false;
    }
  };

  // Modified to use the TrackingContext for toggling
  const toggleBackgroundTracking = async () => {
    // Capture app state at the moment of the toggle attempt
    const currentAppState = AppState.currentState;
    console.log(
      `Toggling background tracking in app state: ${currentAppState}`
    );

    // Check if app is truly in foreground when trying to enable
    if (currentAppState !== "active" && !isEnabled) {
      console.error(
        "Cannot toggle background tracking when app is not in foreground"
      );
      Alert.alert(
        "Not Available",
        "Background tracking can only be enabled when the app is active and in the foreground.",
        [{ text: "OK" }]
      );
      return;
    }

    // Prevent multiple rapid toggles
    if (isLoading) {
      console.log("Toggle operation already in progress, ignoring request");
      return;
    }

    // Get the real current status before toggling to avoid toggle confusion
    const actualCurrentStatus = await checkBackgroundTrackingStatus();
    console.log(
      `Current tracking status before toggle: ${actualCurrentStatus}`
    );

    // Determine the target state (opposite of actual current state)
    const targetState = !actualCurrentStatus;
    console.log(`Attempting to set tracking state to: ${targetState}`);

    // Update loading state
    setIsLoading(true);

    try {
      // Check permissions (only if enabling background tracking)
      if (targetState) {
        const foregroundPermission =
          await Location.getForegroundPermissionsAsync();
        const backgroundPermission =
          await Location.getBackgroundPermissionsAsync();

        // Check foreground permission first
        if (foregroundPermission.status !== "granted") {
          // Show alert but don't revert UI state yet to avoid flickering
          Alert.alert(
            "Location Permission Required",
            "Please enable location services to use background tracking.",
            [
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => {
                  setIsLoading(false);
                },
              },
              {
                text: "Settings",
                onPress: () => {
                  Linking.openSettings();
                  setIsLoading(false);
                },
              },
            ]
          );
          return;
        }

        // Check background permission next
        if (backgroundPermission.status !== "granted") {
          // Platform-specific instructions
          if (Platform.OS === "ios") {
            Alert.alert(
              "Background Location Required",
              "To enable background tracking, you need to grant 'Always Allow' permission. Would you like to open settings to change this?",
              [
                {
                  text: "Cancel",
                  style: "cancel",
                  onPress: () => {
                    setIsLoading(false);
                  },
                },
                {
                  text: "Open Settings",
                  onPress: () => {
                    Linking.openURL("app-settings:");
                    setIsLoading(false);
                  },
                },
              ]
            );
            return;
          } else {
            Alert.alert(
              "Background Location Required",
              "To enable background tracking, you need to grant 'Allow all the time' permission. Would you like to update your permissions now?",
              [
                {
                  text: "Cancel",
                  style: "cancel",
                  onPress: () => {
                    setIsLoading(false);
                  },
                },
                {
                  text: "Update Permission",
                  onPress: async () => {
                    try {
                      const result =
                        await Location.requestBackgroundPermissionsAsync();
                      if (result.status !== "granted") {
                        Alert.alert(
                          "Permission Required",
                          "Please go to Settings > Apps > Parrot Analyzer > Permissions > Location and select 'Allow all the time'",
                          [
                            {
                              text: "Later",
                              style: "cancel",
                              onPress: () => {
                                setIsLoading(false);
                              },
                            },
                            {
                              text: "Open Settings",
                              onPress: () => {
                                Linking.openSettings();
                                setIsLoading(false);
                              },
                            },
                          ]
                        );
                      } else {
                        // Permission granted, proceed with background tracking
                        await processBackgroundTracking(targetState);
                      }
                    } catch (error) {
                      console.error(
                        "Error requesting background permission:",
                        error
                      );
                      Alert.alert(
                        "Error",
                        "Failed to request permission. Please try again."
                      );
                      setIsLoading(false);
                    }
                  },
                },
              ]
            );
            return;
          }
        }
      }

      // Double-check app state again before proceeding (in case it changed during permission prompts)
      if (targetState && AppState.currentState !== "active") {
        console.error(
          "App state changed to background during permission checks"
        );
        Alert.alert(
          "Not Available",
          "The app is no longer in the foreground. Please try again when the app is active.",
          [{ text: "OK" }]
        );
        setIsLoading(false);
        return;
      }

      // All permissions are granted or we're disabling, proceed with operation
      await processBackgroundTracking(targetState);
    } catch (error) {
      console.error("Error in toggleBackgroundTracking:", error);

      // Show error to user
      Alert.alert(
        "Background Tracking Error",
        `Failed to ${
          targetState ? "enable" : "disable"
        } background tracking. Please try again.`
      );
      setIsLoading(false);
    }
  };

  // Updated to use the TrackingContext
  const processBackgroundTracking = async (isEnabled: boolean) => {
    try {
      // For Android, check battery optimization
      if (isEnabled && Platform.OS === "android") {
        await BatteryOptimizationHelper.promptForBatteryOptimizationDisable();
      }

      // Use the context method instead of direct function calls
      const operationSuccess = await contextToggleBackgroundTracking(isEnabled);

      // After attempting the operation, always check the real status
      const finalActualStatus = await checkTrackingStatus();
      console.log(
        `Operation attempted: ${
          isEnabled ? "start" : "stop"
        }. Success: ${operationSuccess}. Final actual status: ${finalActualStatus}`
      );

      // Update UI and Store ONLY based on the final *actual* status
      setIsEnabled(finalActualStatus);
      setBackgroundTrackingEnabled(finalActualStatus);
      await AsyncStorage.setItem(
        "backgroundTrackingEnabled",
        JSON.stringify(finalActualStatus)
      );

      // If the operation succeeded but the final state doesn't match the intended state, log a warning
      if (operationSuccess && finalActualStatus !== isEnabled) {
        console.warn(
          `Background tracking state mismatch after successful operation. Target: ${isEnabled}, Actual: ${finalActualStatus}`
        );
        Alert.alert(
          "Status Issue",
          `Background tracking status might be inconsistent. Current state: ${
            finalActualStatus ? "Enabled" : "Disabled"
          }`
        );
      }
      // If the operation failed, inform the user
      else if (!operationSuccess) {
        console.error(
          `Failed to ${isEnabled ? "enable" : "disable"} background tracking`
        );
        Alert.alert(
          "Operation Failed",
          `Could not ${
            isEnabled ? "enable" : "disable"
          } background tracking. Current status: ${
            finalActualStatus ? "Enabled" : "Disabled"
          }`
        );
      }
      // If successful and state matches, notify parent
      else if (onToggle) {
        onToggle(finalActualStatus);
      }
    } catch (error) {
      console.error("Error in processBackgroundTracking:", error);

      // On error, ensure UI reflects the actual state
      try {
        const actualStateOnError = await checkTrackingStatus();
        setIsEnabled(actualStateOnError);
        setBackgroundTrackingEnabled(actualStateOnError);
        await AsyncStorage.setItem(
          "backgroundTrackingEnabled",
          JSON.stringify(actualStateOnError)
        );
      } catch (statusError) {
        console.error(
          "Failed to check background tracking status after error:",
          statusError
        );
        // Fallback to disabled state if checking fails
        setIsEnabled(false);
        setBackgroundTrackingEnabled(false);
        await AsyncStorage.setItem("backgroundTrackingEnabled", "false");
      }

      // Re-throw or handle the error as appropriate
      Alert.alert(
        "Error",
        "An unexpected error occurred while managing background tracking."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Get appropriate icon size based on the size prop
  const getIconSize = () => {
    switch (size) {
      case "small":
        return 16;
      case "large":
        return 24;
      default:
        return 20;
    }
  };

  // Get appropriate text size based on the size prop
  const getTextSize = () => {
    switch (size) {
      case "small":
        return 12;
      case "large":
        return 16;
      default:
        return 14;
    }
  };

  // Debounce the toggle to prevent rapid clicks
  const debouncedToggle = useRef(
    debounce(toggleBackgroundTracking, 300)
  ).current;

  // If iconOnly is true, just render the switch with an icon
  if (iconOnly) {
    return (
      <View style={styles.iconContainer}>
        {showIcon && (
          <Ionicons
            name={isEnabled ? "location" : "location-outline"}
            size={getIconSize()}
            color={isEnabled ? accentColor : textColor}
          />
        )}
        {isLoading ? (
          <ActivityIndicator size="small" color={accentColor} />
        ) : (
          <Switch
            value={isEnabled}
            onValueChange={debouncedToggle}
            trackColor={{ false: "#767577", true: `${accentColor}80` }}
            thumbColor={isEnabled ? accentColor : "#f4f3f4"}
            ios_backgroundColor="#3e3e3e"
          />
        )}
      </View>
    );
  }

  // Otherwise render the full component with text
  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.textContainer}>
        {showIcon && (
          <Ionicons
            name={isEnabled ? "location" : "location-outline"}
            size={getIconSize()}
            color={isEnabled ? accentColor : textColor}
            style={styles.icon}
          />
        )}
        <View>
          <Text
            style={[
              styles.title,
              { color: textColor, fontSize: getTextSize() },
            ]}
          >
            Background Tracking
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: `${textColor}99`, fontSize: getTextSize() - 2 },
            ]}
          >
            {isEnabled
              ? "Tracking location in background"
              : "Background tracking disabled"}
          </Text>
        </View>
      </View>
      {isLoading ? (
        <ActivityIndicator size="small" color={accentColor} />
      ) : (
        <Switch
          value={isEnabled}
          onValueChange={debouncedToggle}
          trackColor={{ false: "#767577", true: `${accentColor}80` }}
          thumbColor={isEnabled ? accentColor : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  textContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontWeight: "600",
  },
  subtitle: {
    marginTop: 2,
  },
  icon: {
    marginRight: 12,
  },
});

export default BackgroundTrackingToggle;
