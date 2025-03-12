import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthContext from "../context/AuthContext";

export interface PushNotificationState {
  expoPushToken?: string;
  notification?: Notifications.Notification;
}

export interface NotificationResponse {
  success: boolean;
  message: string;
  token?: string;
  error?: any;
}

// Configure default notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class PushNotificationService {
  private static instance: PushNotificationService;
  private notificationListener?: Notifications.Subscription;
  private responseListener?: Notifications.Subscription;
  private currentToken: string | null = null;

  private constructor() {}

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  private isSimulator(): boolean {
    // For development builds, we'll assume it's not a simulator
    // since we're using EAS builds
    return false;
  }

  private async getExpoPushToken(): Promise<string> {
    try {
      console.log("[PushNotification] Getting Expo push token");

      // Get project ID from app.json if not in env
      const projectId =
        process.env.EXPO_PROJECT_ID ||
        Constants.expoConfig?.extra?.eas?.projectId;

      console.log("[PushNotification] Project ID:", projectId);

      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      console.log("[PushNotification] Token received:", token.data);
      this.currentToken = token.data; // Store the token
      return token.data;
    } catch (error) {
      console.error("[PushNotification] Error getting token:", error);
      throw error;
    }
  }

  public async getCurrentToken(): Promise<string | null> {
    return this.currentToken;
  }

  async registerDeviceWithBackend(
    userId: string,
    deviceToken: string,
    authToken?: string,
    userRole:
      | "employee"
      | "group-admin"
      | "management"
      | "super-admin" = "employee"
  ): Promise<void> {
    try {
      console.log("[PushNotification] Registering with backend");
      console.log("[PushNotification] User ID:", userId);
      console.log("[PushNotification] Device type:", Platform.OS);
      console.log("[PushNotification] User Role:", userRole);

      const baseUrl = process.env.EXPO_PUBLIC_API_URL;
      const deviceInfo = {
        token: deviceToken,
        deviceType: Platform.OS,
        deviceName: `${Platform.OS} Device`,
      };

      // Try to get auth token from parameter or AsyncStorage
      let finalAuthToken = authToken;
      if (!finalAuthToken) {
        console.log(
          "[PushNotification] No auth token provided, checking AsyncStorage"
        );
        try {
          const storedToken = await AsyncStorage.getItem("auth_token");
          if (storedToken) {
            finalAuthToken = storedToken;
            console.log("[PushNotification] Auth token found in AsyncStorage");
          } else {
            console.log("[PushNotification] No auth token in AsyncStorage");
          }
        } catch (storageError) {
          console.error(
            "[PushNotification] Error accessing AsyncStorage:",
            storageError
          );
        }
      }

      if (!finalAuthToken) {
        throw new Error(
          "No auth token available in parameters or AsyncStorage"
        );
      }

      // Determine the correct endpoint based on user role
      let endpoint;
      switch (userRole) {
        case "group-admin":
          endpoint = `${baseUrl}/api/group-admin-notifications/register-device`;
          break;
        case "management":
          endpoint = `${baseUrl}/api/management-notifications/register-device`;
          break;
        case "super-admin":
          endpoint = `${baseUrl}/api/management-notifications/register-device`; // Super admin uses management endpoint
          break;
        default:
          endpoint = `${baseUrl}/api/employee-notifications/register-device`;
      }

      console.log("[PushNotification] Sending request to:", endpoint);
      const response = await axios.post(endpoint, deviceInfo, {
        headers: {
          Authorization: `Bearer ${finalAuthToken}`,
          "Content-Type": "application/json",
        },
      });

      console.log(
        "[PushNotification] Backend registration response:",
        response.data
      );
    } catch (error) {
      console.error("[PushNotification] Backend registration error:", error);
      if (axios.isAxiosError(error)) {
        console.error(
          "[PushNotification] Response data:",
          error.response?.data
        );
      }
      throw error;
    }
  }

  public async registerForPushNotifications(): Promise<NotificationResponse> {
    try {
      console.log("[PushNotification] Starting registration process");

      // Simple simulator check
      if (this.isSimulator()) {
        console.warn(
          "[PushNotification] Running in simulator/emulator - limited functionality"
        );
      }

      // Check/request permissions
      console.log("[PushNotification] Checking permissions");
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        console.log("[PushNotification] Requesting permissions");
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.warn("[PushNotification] Permission denied:", finalStatus);
        return {
          success: false,
          message: "Permission to receive push notifications was denied",
        };
      }

      // Create Android notification channel
      if (Platform.OS === "android") {
        console.log("[PushNotification] Creating Android notification channel");
        await this.createDefaultNotificationChannel();
      }

      // Get Expo push token
      console.log("[PushNotification] Getting push token");
      const expoPushToken = await this.getExpoPushToken();

      return {
        success: true,
        message: "Successfully registered for push notifications",
        token: expoPushToken,
      };
    } catch (error) {
      console.error("[PushNotification] Registration error:", error);
      return {
        success: false,
        message: "Failed to register for push notifications",
        error,
      };
    }
  }

  private async createDefaultNotificationChannel() {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  public setupNotificationListeners(
    onNotification: (notification: Notifications.Notification) => void,
    onNotificationResponse: (
      response: Notifications.NotificationResponse
    ) => void
  ) {
    this.notificationListener =
      Notifications.addNotificationReceivedListener(onNotification);
    this.responseListener =
      Notifications.addNotificationResponseReceivedListener(
        onNotificationResponse
      );

    return () => {
      if (this.notificationListener) {
        Notifications.removeNotificationSubscription(this.notificationListener);
      }
      if (this.responseListener) {
        Notifications.removeNotificationSubscription(this.responseListener);
      }
    };
  }

  public async scheduleLocalNotification(
    content: Notifications.NotificationContentInput,
    trigger?: Notifications.NotificationTriggerInput
  ) {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content,
        trigger: trigger || {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1,
        },
      });
      return {
        success: true,
        message: "Notification scheduled successfully",
        notificationId,
      };
    } catch (error) {
      console.error("Error scheduling notification:", error);
      return {
        success: false,
        message: "Failed to schedule notification",
        error,
      };
    }
  }

  public async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  public async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  public async setBadgeCount(count: number) {
    await Notifications.setBadgeCountAsync(count);
  }
}

export default PushNotificationService.getInstance();
