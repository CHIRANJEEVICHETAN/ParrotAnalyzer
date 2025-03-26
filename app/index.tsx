import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Animated,
  Image,
  StatusBar,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import ThemeContext from "./context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import AuthContext from "./context/AuthContext";
import * as Notifications from "expo-notifications";
import PushNotificationService from "./utils/pushNotificationService";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Configure notification behavior for foreground state
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // Show alert when app is in foreground
    shouldPlaySound: true,
    shouldSetBadge: true, // Changed from false to true for consistency
  }),
});

export default function SplashScreen() {
  const router = useRouter();
  const { theme } = ThemeContext.useTheme();
  const { isLoading, user, token } = AuthContext.useAuth();
  const [notificationPermission, setNotificationPermission] = useState<
    string | null
  >(null);

  // Animation refs
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.3);
  const rotateAnim = new Animated.Value(0);
  const slideUpAnim = new Animated.Value(50);
  const textFadeAnim = new Animated.Value(0);

  // Notification refs
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  // Handle notification permissions
  useEffect(() => {
    async function requestNotificationPermissions() {
      try {
        if (Platform.OS === "web") {
          // Web notification permissions
          if ("Notification" in window) {
            const permission = await window.Notification.requestPermission();
            setNotificationPermission(permission);
          }
          return;
        }

        // Check existing permissions first
        const { status: existingStatus } =
          await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        // Only ask if permissions haven't been determined
        if (existingStatus !== "granted") {
          // Show custom alert on iOS (more user-friendly)
          if (Platform.OS === "ios") {
            Alert.alert(
              "Enable Notifications",
              "Parrot Analyzer would like to send you notifications for important updates and reminders.",
              [
                {
                  text: "Don't Allow",
                  style: "cancel",
                  onPress: () => setNotificationPermission("denied"),
                },
                {
                  text: "Allow",
                  onPress: async () => {
                    const { status } =
                      await Notifications.requestPermissionsAsync();
                    setNotificationPermission(status);
                  },
                },
              ]
            );
          } else {
            // Direct request for Android
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
            setNotificationPermission(finalStatus);
          }
        } else {
          setNotificationPermission(finalStatus);
        }

        // Create default notification channel for Android
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF231F7C",
          });
        }
      } catch (error) {
        console.error("Error requesting notification permissions:", error);
        setNotificationPermission("error");
      }
    }

    requestNotificationPermissions();
  }, []);

  // Initialize push notifications and set up listeners
  useEffect(() => {
    if (!user || !notificationPermission) return;

    let cleanupMonitoring: (() => void) | undefined;

    const initializePushNotifications = async () => {
      try {
        console.log(`[SplashScreen] Initializing push notifications for user: ${user.id} on ${Platform.OS} (version ${Platform.Version})`);
        console.log(`[SplashScreen] Notification permission status: ${notificationPermission}`);
        
        // Check platform-specific notification settings
        if (Platform.OS === 'ios') {
          const settings = await Notifications.getPermissionsAsync();
          console.log('[SplashScreen] iOS notification settings:', settings);
        } else if (Platform.OS === 'android') {
          // Check Android notification channels
          const channels = await Notifications.getNotificationChannelsAsync();
          console.log('[SplashScreen] Android channels:', channels.length ? channels.map(c => c.name) : 'None');
        }
        
        // Check if we need to reset the Expo Push Token
        await checkAndRefreshExpoToken();
        
        const result =
          await PushNotificationService.registerForPushNotifications();

        if (result.success && result.token) {
          console.log("[SplashScreen] Successfully registered with token:", result.token);
          
          // Register token with backend
          try {
            await PushNotificationService.registerDeviceWithBackend(
              user.id.toString(),
              result.token,
              token || undefined,
              user.role as any
            );
            console.log("[SplashScreen] Successfully registered token with backend");
            
            // Start notification monitoring
            cleanupMonitoring = PushNotificationService.startMonitoringNotifications();
            console.log("[SplashScreen] Notification monitoring started");
            
            // // Try sending a local test notification to verify functionality
            // setTimeout(() => {
            //   PushNotificationService.sendTestNotification(
            //     "Diagnostic Test", 
            //     "This notification confirms your device can receive notifications"
            //   )
            //     .then(() => console.log("[SplashScreen] Diagnostic test sent"))
            //     .catch((error: Error) => console.error("[SplashScreen] Diagnostic error:", error));
            // }, 5000); // Give some time after initialization
          } catch (registerError) {
            console.error("[SplashScreen] Failed to register token with backend:", registerError);
          }
          
          // Set up notification handlers
          const cleanup = PushNotificationService.setupNotificationListeners(
            (notification) => {
              console.log("[SplashScreen] Received notification in foreground:", notification);
              // Handle foreground notification
            },
            (response) => {
              console.log("[SplashScreen] Notification response (tapped):", response);
              const data = response.notification.request.content.data;

              // Handle notification response (e.g., when user taps notification)
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

          return cleanup;
        } else {
          console.warn("[SplashScreen] Push notification registration failed:", result.message);
        }
      } catch (error) {
        console.error("[SplashScreen] Error initializing push notifications:", error);
      }
    };

    initializePushNotifications();

    // Cleanup function
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(
          notificationListener.current
        );
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(
          responseListener.current
        );
      }
      if (cleanupMonitoring) {
        cleanupMonitoring();
      }
    };
  }, [user, notificationPermission]);

  // Animation and navigation logic
  useEffect(() => {
    if (!isLoading) {
      // Logo animation sequence
      Animated.sequence([
        // First: Scale and fade in the logo
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
        ]),
        // Then: Rotate the logo
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        // Finally: Slide up and fade in the text
        Animated.parallel([
          Animated.timing(slideUpAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(textFadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Navigate based on auth state
      const timer = setTimeout(() => {
        if (user) {
          // User is already logged in, navigate to their dashboard
          switch (user.role) {
            case "employee":
              router.replace("/(dashboard)/employee/employee");
              break;
            case "group-admin":
              router.replace("/(dashboard)/Group-Admin/group-admin");
              break;
            case "management":
              router.replace("/(dashboard)/management/management");
              break;
            case "super-admin":
              router.replace("/(dashboard)/super-admin/super-admin");
              break;
          }
        } else {
          // No user logged in, go to welcome screen
          router.replace("/welcome");
        }
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [isLoading, user]);

  const isDark = theme === "dark";
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Function to check and refresh Expo Push Token if needed
  const checkAndRefreshExpoToken = async () => {
    try {
      console.log('[Token Check] Verifying Expo push token validity');
      
      // Step 1: Check when the token was last successfully registered
      const lastRegistered = await AsyncStorage.getItem('pushTokenLastRegistered');
      const currentToken = await AsyncStorage.getItem('expoPushToken');
      
      // If we have both a token and registration timestamp
      if (currentToken && lastRegistered) {
        const lastRegDate = new Date(lastRegistered);
        const now = new Date();
        const daysSinceRegistration = (now.getTime() - lastRegDate.getTime()) / (1000 * 60 * 60 * 24);
        
        console.log(`[Token Check] Current token: ${currentToken}`);
        console.log(`[Token Check] Last registered: ${daysSinceRegistration.toFixed(1)} days ago`);
        
        // If token was registered within last 7 days, no need to refresh
        if (daysSinceRegistration < 7) {
          console.log('[Token Check] Token is recent, no refresh needed');
          return;
        }
        
        console.log('[Token Check] Token is older than 7 days, will refresh');
      } else {
        console.log('[Token Check] No token or registration timestamp found');
      }
      
      // Step 2: Clear the existing token
      await AsyncStorage.removeItem('expoPushToken');
      await AsyncStorage.removeItem('pushTokenLastRegistered');
      
      // Step 3: Let regular registration process handle getting a new token
      console.log('[Token Check] Cleared token cache, new token will be requested');
      
    } catch (error) {
      console.error('[Token Check] Error checking token validity:', error);
    }
  };

  return (
    <>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? "#1E293B" : "#EEF2FF"}
      />
      <LinearGradient
        colors={isDark ? ["#1E293B", "#0F172A"] : ["#EEF2FF", "#E0E7FF"]}
        style={{ flex: 1 }}
      >
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.4,
            backgroundColor: "transparent",
            borderStyle: "solid",
            borderWidth: 1.5,
            borderColor: isDark ? "#3B82F6" : "#6366F1",
            borderRadius: 20,
            transform: [{ scale: 1.5 }, { rotate: "45deg" }],
          }}
        />

        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { rotate: spin }],
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 240,
                height: 240,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
                padding: 3, // Added padding for border effect
                borderRadius: 120,
                backgroundColor: isDark
                  ? "rgba(59, 130, 246, 0.1)"
                  : "rgba(99, 102, 241, 0.1)",
                borderWidth: 2,
                borderColor: isDark
                  ? "rgba(59, 130, 246, 0.3)"
                  : "rgba(99, 102, 241, 0.3)",
                shadowColor: isDark ? "#3B82F6" : "#6366F1",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 120,
                  overflow: "hidden",
                  backgroundColor: isDark
                    ? "rgba(59, 130, 246, 0.05)"
                    : "rgba(99, 102, 241, 0.05)",
                }}
              >
                <Image
                  source={require("../assets/images/icon.png")}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                  resizeMode="cover"
                />
              </View>
            </View>
            <Animated.Text
              style={{
                fontSize: 40,
                fontWeight: "bold",
                color: isDark ? "#ffffff" : "#1F2937",
                textShadowColor: "rgba(0, 0, 0, 0.1)",
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 4,
                opacity: textFadeAnim,
                transform: [{ translateY: slideUpAnim }],
              }}
            >
              Parrot Analyzer
            </Animated.Text>
          </Animated.View>

          <Animated.View
            style={{
              position: "absolute",
              bottom: 40,
              opacity: textFadeAnim,
              transform: [{ translateY: slideUpAnim }],
            }}
          >
            <Text
              style={{
                fontSize: 16,
                color: isDark ? "#D1D5DB" : "#4B5563",
                letterSpacing: 0.5,
              }}
            >
              Powered by Loginware.ai
            </Text>
          </Animated.View>
        </View>
      </LinearGradient>
    </>
  );
}
