import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthContext from "../context/AuthContext";
import EventEmitter from "../utils/EventEmitter";

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
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
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
      console.log("[PushService] Registering device with backend");
      console.log("[PushService] Device token:", deviceToken);

      // Validate token before sending to backend
      if (!deviceToken || !deviceToken.startsWith("ExponentPushToken[")) {
        console.error(
          "[PushService] Invalid token format, aborting registration"
        );
        return;
      }

      const device = {
        deviceType: Platform.OS,
        deviceName: Platform.OS + "-" + Platform.Version,
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

      const apiUrl = `${process.env.EXPO_PUBLIC_API_URL}/api/${userRole}-notifications/register-device`;

      console.log("[PushService] Sending registration to:", apiUrl);

      const response = await axios.post(
        apiUrl,
        {
          token: deviceToken,
          deviceType: device.deviceType,
          deviceName: device.deviceName,
        },
        {
          headers: {
            Authorization: `Bearer ${finalAuthToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(
        "[PushService] Backend registration successful:",
        response.data
      );

      if (response.status === 200) {
        console.log(
          "[PushService] Backend registration successful:",
          response.data
        );

        // Save the token locally for reuse
        this.currentToken = deviceToken;
        await AsyncStorage.setItem("expoPushToken", deviceToken);

        // Record successful registration time
        await AsyncStorage.setItem(
          "pushTokenLastRegistered",
          new Date().toISOString()
        );
      }
    } catch (error) {
      console.error("[PushService] Backend registration error:", error);

      // If axios error, log more details
      if (axios.isAxiosError(error)) {
        console.error("[PushService] Status:", error.response?.status);
        console.error("[PushService] Response data:", error.response?.data);

        // Handle token expiration
        if (
          error.response?.status === 401 &&
          error.response?.data?.error === "Token expired"
        ) {
          // Notify the app about token expiration
          this.handleTokenExpiration();
          throw new Error("AUTH_TOKEN_EXPIRED");
        }
      }

      throw error;
    }
  }

  private handleTokenExpiration() {
    // Emit an event that the app can listen to
    EventEmitter.emit("AUTH_TOKEN_EXPIRED");

    // Clear stored tokens
    AsyncStorage.removeItem("auth_token");
    AsyncStorage.removeItem("expoPushToken");

    // Clear current token
    this.currentToken = null;
  }

  public async checkTokenValidity(): Promise<boolean> {
    try {
      const lastRegistered = await AsyncStorage.getItem(
        "pushTokenLastRegistered"
      );
      if (!lastRegistered) return false;

      const lastRegisteredDate = new Date(lastRegistered);
      const now = new Date();
      const daysSinceRegistration =
        (now.getTime() - lastRegisteredDate.getTime()) / (1000 * 60 * 60 * 24);

      // If token is older than 25 days, consider it invalid
      if (daysSinceRegistration > 25) {
        console.log("[PushService] Token is old, needs refresh");
        return false;
      }

      return true;
    } catch (error) {
      console.error("[PushService] Error checking token validity:", error);
      return false;
    }
  }

  public async registerForPushNotifications(): Promise<NotificationResponse> {
    try {
      console.log("[PushService] Starting push notification registration");

      // Check if simulation environment
      if (this.isSimulator()) {
        console.log(
          "[PushService] Running in simulator, skipping push registration"
        );
        return {
          success: false,
          message: "Push notifications are not supported in simulators",
        };
      }

      // Request permission to send notifications
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      console.log(
        "[PushService] Current notification permission status:",
        existingStatus
      );

      if (existingStatus !== "granted") {
        console.log("[PushService] Requesting notification permissions");

        // For iOS, request critical alerts permission if possible
        if (Platform.OS === "ios") {
          const { status } = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
              provideAppNotificationSettings: true, // Show app notification settings if available
            },
          });
          finalStatus = status;
        } else {
          // Basic permission request for Android
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
      }

      if (finalStatus !== "granted") {
        console.log("[PushService] Permission not granted for notifications");
        return {
          success: false,
          message: "Permission not granted for notifications",
        };
      }

      // Create notification channel for Android
      await this.createDefaultNotificationChannel();

      // Get Expo push token with retry
      let pushToken = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (!pushToken && attempts < maxAttempts) {
        try {
          attempts++;
          console.log(
            `[PushService] Getting push token (attempt ${attempts}/${maxAttempts})`
          );
          pushToken = await this.getExpoPushToken();

          // Validate token
          if (!pushToken || !pushToken.startsWith("ExponentPushToken[")) {
            console.log(`[PushService] Invalid token format: ${pushToken}`);
            pushToken = null;

            if (attempts < maxAttempts) {
              console.log(`[PushService] Waiting before retry...`);
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }
        } catch (error) {
          console.error(
            `[PushService] Error getting token (attempt ${attempts})`,
            error
          );

          if (attempts < maxAttempts) {
            console.log(`[PushService] Waiting before retry...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      if (!pushToken) {
        console.log(
          "[PushService] Failed to get valid push token after multiple attempts"
        );
        return {
          success: false,
          message: "Failed to get push notification token",
        };
      }

      console.log("[PushService] Successfully got Expo push token:", pushToken);
      this.currentToken = pushToken;

      return {
        success: true,
        message: "Push notification registered successfully",
        token: pushToken,
      };
    } catch (error) {
      console.error(
        "[PushService] Error registering for push notifications:",
        error
      );
      return {
        success: false,
        message: "Error registering for push notifications",
        error,
      };
    }
  }

  private async createDefaultNotificationChannel() {
    if (Platform.OS === "android") {
      // Create default notification channel
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
        sound: "default", // Explicitly set the sound to default
        enableVibrate: true,
        showBadge: true,
      });

      // Create a high priority channel for urgent notifications
      await Notifications.setNotificationChannelAsync("high_priority", {
        name: "Urgent Notifications",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250, 250, 250],
        lightColor: "#FF231F7C",
        sound: "default", // Explicitly set the sound to default
        enableVibrate: true,
        showBadge: true,
      });
    }
  }

  public setupNotificationListeners(
    onNotification: (notification: Notifications.Notification) => void,
    onNotificationResponse: (
      response: Notifications.NotificationResponse
    ) => void
  ) {
    console.log("[PushService] Setting up notification listeners");

    // Remove any existing listeners first to prevent duplicates
    this.removeNotificationListeners();

    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("[PushService] NOTIFICATION RECEIVED:", {
          title: notification.request.content.title,
          body: notification.request.content.body,
          data: notification.request.content.data,
        });
        onNotification(notification);
      }
    );

    this.responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("[PushService] NOTIFICATION TAPPED:", {
          title: response.notification.request.content.title,
          body: response.notification.request.content.body,
          data: response.notification.request.content.data,
        });
        onNotificationResponse(response);
      });

    return () => this.removeNotificationListeners();
  }

  private removeNotificationListeners() {
    if (this.notificationListener) {
      console.log("[PushService] Removing existing notification listener");
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = undefined;
    }
    if (this.responseListener) {
      console.log("[PushService] Removing existing response listener");
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = undefined;
    }
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

  // Utility function to test notifications
  public async sendTestNotification(
    title: string = "Test Notification",
    body: string = "This is a test notification"
  ): Promise<boolean> {
    try {
      console.log("[PushService] Sending test local notification");

      // Schedule a local notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { test: true, time: new Date().toISOString() },
          badge: 1,
          sound: "default",
          priority: "high",
          autoDismiss: true,
        },
        trigger: null, // Show immediately
      });

      console.log("[PushService] Test notification sent successfully");
      return true;
    } catch (error) {
      console.error("[PushService] Error sending test notification:", error);
      return false;
    }
  }

  // Check for missed notifications using receipt API
  public async checkForMissedNotifications(
    receiptIds: string[]
  ): Promise<void> {
    if (!receiptIds.length) return;

    try {
      console.log(
        "[PushService] Checking for missed notifications:",
        receiptIds
      );

      const response = await axios.post(
        "https://exp.host/--/api/v2/push/getReceipts",
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          data: { ids: receiptIds },
        }
      );

      const data = response.data;
      console.log("[PushService] Receipt check response:", data);

      // If we have any successful receipts, but didn't get the notification,
      // create a local notification to mimic it
      if (data.data && Object.keys(data.data).length) {
        for (const [id, receipt] of Object.entries(data.data)) {
          const receiptData = receipt as any;
          if (receiptData.status === "ok") {
            console.log(
              "[PushService] Receipt was delivered but notification may have been missed:",
              id
            );
            // Create a local notification to ensure the user sees it
            await this.sendTestNotification(
              "Recovered Notification",
              "This notification was sent earlier but may not have been displayed"
            );
          }
        }
      }
    } catch (error) {
      console.error("[PushService] Error checking receipts:", error);
    }
  }

  // Starts a periodic check for notification delivery
  public startMonitoringNotifications(): () => void {
    console.log("[PushService] Starting notification monitoring");

    // Store recently received receipts
    const receiptIds: string[] = [];

    // Check for missed notifications periodically
    const checkMissedNotifications = async () => {
      try {
        if (receiptIds.length > 0) {
          await this.checkForMissedNotifications(receiptIds);
          // Clear checked receipts
          receiptIds.length = 0;
        }
      } catch (error) {
        console.error(
          "[PushService] Error checking missed notifications:",
          error
        );
      }
    };

    // Set up periodic checks
    const intervalId = setInterval(checkMissedNotifications, 5 * 60 * 1000); // Check every 5 minutes

    // Return cleanup function
    return () => clearInterval(intervalId);
  }
}

export default PushNotificationService.getInstance();
