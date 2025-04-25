import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import ThemeContext from "../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import PushNotificationService from "../utils/pushNotificationService";
import { useRouter } from "expo-router";
import PermissionsManager from "../utils/permissionsManager";

interface PermissionsModalProps {
  visible: boolean;
  onClose: () => void;
  userId?: number | string;
  token?: string;
  userRole?: string;
}

// Configure notification behavior for foreground state
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

const PermissionsModal: React.FC<PermissionsModalProps> = ({
  visible,
  onClose,
  userId,
  token,
  userRole,
}) => {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const isDark = theme === "dark";
  
  const [step, setStep] = useState<"intro" | "notification" | "location" | "complete">("intro");
  const [loading, setLoading] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string | null>(null);
  const [locationPermission, setLocationPermission] = useState<string | null>(null);
  const [backgroundLocationPermission, setBackgroundLocationPermission] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSettingsPrompt, setShowSettingsPrompt] = useState<'notification' | 'location' | null>(null);

  // Set up notification listeners
  useEffect(() => {
    if (step !== "complete" || !userId || !notificationPermission || notificationPermission !== "granted") {
      return;
    }
    
    // Initialize notification service if permissions granted
    const initializeNotifications = async () => {
      try {
        // Mark permissions as requested so we don't show this modal again
        await PermissionsManager.markPermissionsAsRequested();
        
        // Create default notification channel for Android
        await PermissionsManager.setupNotificationChannel();
        
        // Register for push notifications
        const result = await PushNotificationService.registerForPushNotifications();
        
        if (result.success && result.token) {
          // Store token registration time
          await AsyncStorage.setItem('pushTokenLastRegistered', new Date().toISOString());
          
          // Register token with backend
          if (userId && userRole) {
            await PushNotificationService.registerDeviceWithBackend(
              userId.toString(),
              result.token,
              token,
              userRole as any
            );
          }
          
          // Set up notification listeners
          PushNotificationService.setupNotificationListeners(
            (notification) => {
              console.log("Received notification in foreground:", notification);
              // Handle foreground notification
            },
            (response) => {
              const data = response.notification.request.content.data;
              
              // Handle navigation when notification is tapped
              const validScreens = [
                "/(dashboard)/employee/notifications",
                "/(dashboard)/Group-Admin/notifications",
                "/(dashboard)/management/notifications",
              ];

              if (
                data?.screen &&
                typeof data.screen === "string" &&
                validScreens.includes(data.screen)
              ) {
                router.push(data.screen as any);
              }
            }
          );
        }
      } catch (error) {
        console.error("Error initializing notifications:", error);
      }
    };
    
    initializeNotifications();
  }, [step, userId, notificationPermission]);

  // Request notification permission
  const requestNotificationPermission = async () => {
    setLoading(true);
    setErrorMessage(null);
    
    try {
      // Check if we should redirect to settings instead
      const shouldUseSettings = await PermissionsManager.shouldRequestFromSettings('notification');
      if (shouldUseSettings) {
        setShowSettingsPrompt('notification');
        setLoading(false);
        return;
      }
      
      if (Platform.OS === "web") {
        if ("Notification" in window) {
          const permission = await window.Notification.requestPermission();
          setNotificationPermission(permission);
          setStep("location");
        }
        setLoading(false);
        return;
      }

      // Check existing permissions first
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
      // If already granted, move to next step
      if (existingStatus === "granted") {
        setNotificationPermission("granted");
        setLoading(false);
        setStep("location");
        return;
      }
      
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationPermission(status);
      setLoading(false);
      setStep("location");
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      setErrorMessage("Unable to request notification permissions. Please try again.");
      setLoading(false);
    }
  };

  // Request location permission
  const requestLocationPermission = async () => {
    setLoading(true);
    setErrorMessage(null);
    
    try {
      // First, request foreground location permission
      const foregroundResult = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(foregroundResult.status);
      
      // If foreground permission granted, request background permission
      if (foregroundResult.status === 'granted') {
        // Show information alert about the importance of background permission
        if (Platform.OS === 'ios') {
          Alert.alert(
            "Background Location Required",
            "Parrot Analyzer needs to track your location in the background for shift management. In the next prompt, please select 'Always Allow' to enable this feature.",
            [{ text: "OK", onPress: async () => {
              // Request background permission
              const backgroundResult = await Location.requestBackgroundPermissionsAsync();
              setBackgroundLocationPermission(backgroundResult.status);
              
              if (backgroundResult.status !== 'granted') {
                Alert.alert(
                  "Background Permission Required",
                  "Background location was not granted. Some features like background tracking will not work. Please go to Settings > Privacy > Location Services to allow 'Always' access.",
                  [
                    { text: "Later", style: "cancel" },
                    { text: "Settings", onPress: openSettings }
                  ]
                );
              }
              
              setLoading(false);
              setStep("complete");
            }}]
          );
        } else {
          // For Android, request background directly
          const backgroundResult = await Location.requestBackgroundPermissionsAsync();
          setBackgroundLocationPermission(backgroundResult.status);
          
          if (backgroundResult.status !== 'granted') {
            Alert.alert(
              "Background Permission Required",
              "Background location permission is needed for shift tracking. Please go to Settings > Apps > Parrot Analyzer > Permissions > Location and select 'Allow all the time'.",
              [
                { text: "Later", style: "cancel" },
                { text: "Settings", onPress: openSettings }
              ]
            );
          }
          
          setLoading(false);
          setStep("complete");
        }
      } else {
        setLoading(false);
        setErrorMessage("Location permission is required for tracking functionality");
        setShowSettingsPrompt('location');
      }
    } catch (error) {
      console.error("Error requesting location permission:", error);
      setLoading(false);
      setErrorMessage("Failed to request location permission");
    }
  };

  // Open device settings when user wants to grant permissions
  const openSettings = async () => {
    setLoading(true);
    try {
      await PermissionsManager.openAppSettings();
      setLoading(false);
      // Hide the settings prompt after trying to open settings
      setShowSettingsPrompt(null);
      
      // If we were on the notification step, move to location step
      if (showSettingsPrompt === 'notification') {
        setStep('location');
      } else if (showSettingsPrompt === 'location') {
        // If we were on the location step, move to complete step
        setStep('complete');
      }
    } catch (error) {
      console.error("Error opening settings:", error);
      setLoading(false);
      setErrorMessage("Unable to open settings. Please manually open your device settings.");
    }
  };

  // Handle when user wants to skip a permission
  const handleSkip = (currentStep: "notification" | "location") => {
    setShowSettingsPrompt(null); // Clear any settings prompt
    
    if (currentStep === "notification") {
      setNotificationPermission("denied");
      setStep("location");
    } else if (currentStep === "location") {
      setLocationPermission("denied");
      setStep("complete");
    }
  };

  // Finish and close modal
  const handleFinish = () => {
    // Save that permissions have been asked to prevent showing this again
    PermissionsManager.markPermissionsAsRequested().catch(console.error);
    onClose();
  };

  // Render settings prompt
  const renderSettingsPrompt = () => {
    const permissionType = showSettingsPrompt === 'notification' ? 'notification' : 'location';
    
    return (
      <View style={styles.content}>
        <Ionicons
          name={showSettingsPrompt === 'notification' ? "notifications-outline" : "location-outline"}
          size={64}
          color={isDark ? "#3B82F6" : "#6366F1"}
        />
        
        <Text style={[styles.title, { color: isDark ? "#ffffff" : "#1F2937" }]}>
          {showSettingsPrompt === 'notification' ? "Enable Notifications" : "Enable Location"}
        </Text>
        
        <Text style={[styles.description, { color: isDark ? "#D1D5DB" : "#4B5563" }]}>
          You've previously denied permission. Please enable {permissionType} access in your device settings.
        </Text>
        
        {errorMessage && (
          <Text style={styles.errorText}>{errorMessage}</Text>
        )}
        
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: isDark ? "#3B82F6" : "#6366F1" },
            loading && styles.disabledButton
          ]}
          onPress={openSettings}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Open Settings</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            if (showSettingsPrompt) {
              handleSkip(showSettingsPrompt);
            }
          }}
          disabled={loading}
        >
          <Text style={[styles.secondaryButtonText, { color: isDark ? "#D1D5DB" : "#4B5563" }]}>
            Skip for now
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render step content
  const renderStepContent = () => {
    // If we need to show settings prompt, render that instead
    if (showSettingsPrompt) {
      return renderSettingsPrompt();
    }
    
    // Otherwise render the normal steps
    switch (step) {
      case "intro":
        return (
          <View style={styles.content}>
            <Ionicons
              name="notifications-circle-outline"
              size={64}
              color={isDark ? "#3B82F6" : "#6366F1"}
            />
            
            <Text style={[styles.title, { color: isDark ? "#ffffff" : "#1F2937" }]}>
              Welcome to Parrot Analyzer
            </Text>
            
            <Text style={[styles.description, { color: isDark ? "#D1D5DB" : "#4B5563" }]}>
              To provide you with the best experience, we need to request a few permissions.
              We'll ask for notifications to keep you updated and location for tracking features.
            </Text>
            
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: isDark ? "#3B82F6" : "#6366F1" }
              ]}
              onPress={() => setStep("notification")}
            >
              <Text style={styles.buttonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        );
        
      case "notification":
        return (
          <View style={styles.content}>
            <Ionicons
              name="notifications-outline"
              size={64}
              color={isDark ? "#3B82F6" : "#6366F1"}
            />
            
            <Text style={[styles.title, { color: isDark ? "#ffffff" : "#1F2937" }]}>
              Enable Notifications
            </Text>
            
            <Text style={[styles.description, { color: isDark ? "#D1D5DB" : "#4B5563" }]}>
              Receive important updates, reminders and alerts from our app.
              Stay informed about new features and events.
            </Text>
            
            {errorMessage && (
              <Text style={styles.errorText}>{errorMessage}</Text>
            )}
            
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: isDark ? "#3B82F6" : "#6366F1" },
                loading && styles.disabledButton
              ]}
              onPress={requestNotificationPermission}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Allow Notifications</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleSkip("notification")}
              disabled={loading}
            >
              <Text style={[styles.secondaryButtonText, { color: isDark ? "#D1D5DB" : "#4B5563" }]}>
                Skip for now
              </Text>
            </TouchableOpacity>
          </View>
        );
        
      case "location":
        return (
          <View style={styles.content}>
            <Ionicons
              name="location-outline"
              size={64}
              color={isDark ? "#3B82F6" : "#6366F1"}
            />
            
            <Text style={[styles.title, { color: isDark ? "#ffffff" : "#1F2937" }]}>
              Enable Location
            </Text>
            
            <Text style={[styles.description, { color: isDark ? "#D1D5DB" : "#4B5563" }]}>
              Allow us to access your location to track employee activity,
              calculate distances, and provide accurate reporting.
              {Platform.OS === 'ios' && "\n\nYou'll also be asked for background location permission for tracking when the app is not active."}
            </Text>
            
            {errorMessage && (
              <Text style={styles.errorText}>{errorMessage}</Text>
            )}
            
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: isDark ? "#3B82F6" : "#6366F1" },
                loading && styles.disabledButton
              ]}
              onPress={requestLocationPermission}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Allow Location</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleSkip("location")}
              disabled={loading}
            >
              <Text style={[styles.secondaryButtonText, { color: isDark ? "#D1D5DB" : "#4B5563" }]}>
                Skip for now
              </Text>
            </TouchableOpacity>
          </View>
        );
        
      case "complete":
        return (
          <View style={styles.content}>
            <Ionicons
              name="checkmark-circle-outline"
              size={64}
              color={isDark ? "#3B82F6" : "#6366F1"}
            />
            
            <Text style={[styles.title, { color: isDark ? "#ffffff" : "#1F2937" }]}>
              All Set!
            </Text>
            
            <Text style={[styles.description, { color: isDark ? "#D1D5DB" : "#4B5563" }]}>
              Thanks for setting up your permissions. You can always change these later in your device settings.
            </Text>
            
            <View style={styles.permissionStatus}>
              <View style={styles.permissionRow}>
                <Ionicons
                  name="notifications-outline"
                  size={24}
                  color={notificationPermission === "granted" ? "#10B981" : "#F87171"}
                />
                <Text style={[
                  styles.permissionText,
                  { color: isDark ? "#D1D5DB" : "#4B5563" }
                ]}>
                  Notifications: {notificationPermission === "granted" ? "Allowed" : "Denied"}
                </Text>
              </View>
              
              <View style={styles.permissionRow}>
                <Ionicons
                  name="location-outline"
                  size={24}
                  color={locationPermission === "granted" ? "#10B981" : "#F87171"}
                />
                <Text style={[
                  styles.permissionText,
                  { color: isDark ? "#D1D5DB" : "#4B5563" }
                ]}>
                  Location: {locationPermission === "granted" ? "Allowed" : "Denied"}
                </Text>
              </View>
              
              <View style={styles.permissionRow}>
                <Ionicons
                  name="locate"
                  size={24}
                  color={backgroundLocationPermission === "granted" ? "#10B981" : "#F87171"}
                />
                <Text style={[
                  styles.permissionText,
                  { color: isDark ? "#D1D5DB" : "#4B5563" }
                ]}>
                  Background Location: {backgroundLocationPermission === "granted" ? "Allowed" : "Denied"}
                </Text>
              </View>
            </View>
            
            {(locationPermission === "granted" && backgroundLocationPermission !== "granted") && (
              <View style={styles.warningBox}>
                <Ionicons name="information-circle-outline" size={20} color="#F59E0B" />
                <Text style={styles.warningText}>
                  Background location is needed for tracking when the app is not active. You can enable this in settings later.
                </Text>
              </View>
            )}
            
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: isDark ? "#3B82F6" : "#6366F1" }
              ]}
              onPress={handleFinish}
            >
              <Text style={styles.buttonText}>Continue to App</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={() => {
        if (step === "intro") {
          onClose();
        } else if (step === "complete") {
          handleFinish();
        } else {
          Alert.alert(
            "Exit Permission Setup?",
            "Are you sure you want to exit? Some features may not work properly without granting permissions.",
            [
              { text: "Continue Setup", style: "cancel" },
              { text: "Exit", onPress: onClose }
            ]
          );
        }
      }}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
              borderColor: isDark ? "#3B82F6" : "#6366F1",
            },
          ]}
        >
          {renderStepContent()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 20,
  },
  modalContainer: {
    width: "90%",
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  content: {
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 24,
  },
  primaryButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  errorText: {
    color: "#F87171",
    marginBottom: 16,
    textAlign: "center",
  },
  permissionStatus: {
    width: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 16,
    marginLeft: 10,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "rgba(250, 204, 21, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(250, 204, 21, 0.3)",
  },
  warningText: {
    fontSize: 14,
    color: "#B45309", // Amber-700
    marginLeft: 10,
    flex: 1,
  },
});

export default PermissionsModal; 