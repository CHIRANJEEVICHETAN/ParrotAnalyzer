import { useEffect, useRef, useState } from "react";
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

// Configure notification behavior for foreground state
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // Show alert when app is in foreground
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function SplashScreen() {
  const router = useRouter();
  const { theme } = ThemeContext.useTheme();
  const { isLoading, user } = AuthContext.useAuth();
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

    const initializePushNotifications = async () => {
      try {
        const result =
          await PushNotificationService.registerForPushNotifications();

        if (result.success && result.token) {
          // Set up notification handlers
          const cleanup = PushNotificationService.setupNotificationListeners(
            (notification) => {
              console.log("Received notification:", notification);
              // Handle foreground notification
            },
            (response) => {
              console.log("Notification response:", response);
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
        }
      } catch (error) {
        console.error("Error initializing push notifications:", error);
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
        Notifications.removeNotificationSubscription(responseListener.current);
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
