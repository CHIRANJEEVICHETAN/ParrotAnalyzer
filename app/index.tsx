import React, { useEffect, useRef } from "react";
import "./../app/utils/backgroundLocationTask";
import {
  View,
  Text,
  Animated,
  Image,
  StatusBar,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import ThemeContext from "./context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import AuthContext from "./context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function SplashScreen() {
  const router = useRouter();
  const { theme } = ThemeContext.useTheme();
  const { isLoading, user } = AuthContext.useAuth();

  // Animation refs
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.3);
  const rotateAnim = new Animated.Value(0);
  const slideUpAnim = new Animated.Value(50);
  const textFadeAnim = new Animated.Value(0);

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
