// Import environment variables directly
import 'dotenv/config';
import { ExpoConfig } from '@expo/config-types';

// Define the configuration as a function that returns the ExpoConfig
export default (): ExpoConfig => ({
  name: "Parrot Analyzer",
  slug: "parraotanalyzer",
  version: "1.1.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "myapp",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.loginware.parrotanalyzer",
    googleServicesFile: "./constants/GoogleService-Info.plist",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "This app needs access to location to track users in real-time.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "This app needs access to location to track users in real-time, even when the app is in the background.",
      NSLocationAlwaysUsageDescription:
        "This app needs access to location to track users in real-time, even when the app is in the background.",
      UIBackgroundModes: ["location", "fetch"],
    },
    config: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.loginware.parrotanalyzer",
    googleServicesFile: "./constants/google-services.json",
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "WAKE_LOCK",
    ],
    // @ts-ignore: Expo prebuild supports `foregroundServices`
    foregroundServices: [
      {
        tag: "background-location-tracking",
        notificationTitle: "Parrot Analyzer is tracking your location",
        notificationBody:
          "To stop tracking, open the app and turn off tracking",
        importance: "high",
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/icon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/SplashScreen.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
    [
      "expo-media-library",
      {
        photosPermission: "Allow $(PRODUCT_NAME) to access your photos.",
        savePhotosPermission: "Allow $(PRODUCT_NAME) to save photos.",
        isAccessMediaLocationEnabled: true,
      },
    ],
    "expo-secure-store",
    [
      "expo-image-picker",
      {
        photosPermission:
          "The app needs access to your photos to let you set a profile picture.",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/icon.png",
        color: "#ffffff",
        sound: "default",
      },
    ],
    "expo-font",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Allow ParrotAnalyzer to use your location for real-time tracking.",
        locationAlwaysPermission:
          "Allow ParrotAnalyzer to use your location in the background for real-time tracking.",
        locationWhenInUsePermission:
          "Allow ParrotAnalyzer to use your location.",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    "expo-task-manager",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId:
        process.env.EXPO_PROJECT_ID || "593351fc-6ce3-4e49-8d3e-f0d33c486168",
    },
    // Make environment variables available in the app via Constants.expoConfig.extra
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  },
  owner: "loginware",
});