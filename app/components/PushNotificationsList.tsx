import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Pressable,
  FlatList,
  Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import ThemeContext from "../context/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import { router } from "expo-router";
import { useNotifications } from "../context/NotificationContext";
import axios from "axios";
import type {
  ExternalPathString,
  RelativePathString,
} from "expo-router/build/types";

interface Notification {
  id: number;
  uniqueId?: string;
  source?: "push" | "inapp";
  title: string;
  message: string;
  type: string;
  priority: string;
  data?: any;
  created_at: string;
  read: boolean;
}

interface PushNotificationsListProps {
  onSendNotification?: () => void; // For Group Admin and Management
  showSendButton?: boolean;
  filterType?: string;
}

export default function PushNotificationsList({
  onSendNotification,
  showSendButton = false,
  filterType,
}: PushNotificationsListProps) {
  const { user, token } = useAuth();
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === "dark";

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { decrementUnreadCount, incrementUnreadCount } = useNotifications();

  const getNotificationsEndpoint = useCallback(() => {
    const baseUrl = process.env.EXPO_PUBLIC_API_URL;
    switch (user?.role) {
      case "employee":
        return `${baseUrl}/api/employee-notifications`;
      case "group-admin":
        return `${baseUrl}/api/group-admin-notifications`;
      case "management":
        return `${baseUrl}/api/management-notifications`;
      default:
        throw new Error("Invalid user role");
    }
  }, [user?.role]);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await axios.get(getNotificationsEndpoint(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Create a Map to store unique notifications
      const notificationsMap = new Map();

      // Add push notifications with a prefix
      (data.push || []).forEach((notification: Notification) => {
        notificationsMap.set(`push_${notification.id}`, {
          ...notification,
          uniqueId: `push_${notification.id}`,
          source: "push",
        });
      });

      // Add in-app notifications with a prefix
      (data.inApp || []).forEach((notification: Notification) => {
        notificationsMap.set(`inapp_${notification.id}`, {
          ...notification,
          uniqueId: `inapp_${notification.id}`,
          source: "inapp",
        });
      });

      // Convert Map values back to array
      const allNotifications = Array.from(notificationsMap.values());

      // Apply filtering if filterType is specified
      const filteredData = filterType
        ? allNotifications.filter((n: Notification) => n.type === filterType)
        : allNotifications;

      // Sort by created_at date, most recent first
      const sortedData = filteredData.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(sortedData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterType, getNotificationsEndpoint, token]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: number) => {
    try {
      if (!user?.id || !token) {
        throw new Error("User not authenticated");
      }

      console.log("[Notification] Marking as read:", {
        notificationId,
        userId: user.id,
        userRole: user.role,
        source: notifications.find((n) => n.id === notificationId)?.source,
      });

      // Optimistically update the UI
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      decrementUnreadCount();

      const baseUrl = process.env.EXPO_PUBLIC_API_URL;
      let endpoint = "";

      // Use role-specific endpoints
      switch (user.role) {
        case "employee":
          endpoint = `${baseUrl}/api/employee-notifications/${notificationId}/read`;
          break;
        case "group-admin":
          endpoint = `${baseUrl}/api/group-admin-notifications/${notificationId}/read`;
          break;
        case "management":
          endpoint = `${baseUrl}/api/management-notifications/${notificationId}/read`;
          break;
        default:
          throw new Error("Invalid user role");
      }

      console.log("[Notification] Using endpoint:", endpoint);

      const response = await axios.put<{ id: number; read: boolean }>(
        endpoint,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("[Notification] Response:", response.data);

      // Verify the response
      if (!response.data || typeof response.data.read !== "boolean") {
        throw new Error("Invalid response from server");
      }

      // Update the notification in state with the server response
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, ...response.data } : n
        )
      );
    } catch (err) {
      console.error("[Notification] Error marking as read:", err);

      // Revert optimistic update on error
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: false } : n))
      );
      incrementUnreadCount();

      let errorMessage = "Failed to mark notification as read";
      let errorDetails = "";
      let shouldRefresh = false;

      if (axios.isAxiosError(err)) {
        console.error("[Notification] Response data:", err.response?.data);
        console.error("[Notification] Status:", err.response?.status);

        switch (err.response?.status) {
          case 400:
            errorMessage = "Invalid notification";
            errorDetails =
              err.response.data?.details || "The notification ID is invalid";
            break;
          case 401:
            errorMessage = "Authentication required";
            errorDetails = "Please log in again";
            shouldRefresh = true;
            break;
          case 403:
            errorMessage = "Permission denied";
            errorDetails =
              err.response.data?.details ||
              "You don't have permission to mark this notification as read";
            // Refresh to ensure we have the correct notifications list
            shouldRefresh = true;
            break;
          case 404:
            errorMessage = "Notification not found";
            errorDetails =
              err.response.data?.details ||
              "The notification could not be found";
            // Remove the notification from the list
            setNotifications((prev) =>
              prev.filter((n) => n.id !== notificationId)
            );
            break;
          case 500:
            errorMessage = "Server error";
            errorDetails =
              err.response.data?.details ||
              "An error occurred while processing your request";
            break;
          default:
            errorMessage = err.response?.data?.error || err.message;
            errorDetails = err.response?.data?.details || "";
        }
      }

      Alert.alert(
        errorMessage,
        errorDetails,
        [
          {
            text: "OK",
            onPress: () => {
              if (shouldRefresh) {
                fetchNotifications();
              }
            },
          },
        ],
        { cancelable: false }
      );
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    try {
      // Mark as read if not already read
      if (!notification.read) {
        await markAsRead(notification.id);
      }

      // // Handle navigation based on notification type and data
      // if (notification.data?.screen) {
      //   const screen = notification.data.screen as string;

      //   // Ensure the screen path starts with a slash and validate it
      //   const normalizedScreen = screen.startsWith("/") ? screen : `/${screen}`;

      //   console.log("[Navigation] Navigating to screen:", normalizedScreen);

      //   try {
      //     // Cast to RelativePathString since we know it's a valid internal path
      //     router.push(normalizedScreen as RelativePathString);
      //   } catch (navError) {
      //     console.error("[Navigation] Error:", navError);
      //     Alert.alert(
      //       "Navigation Error",
      //       "Could not navigate to the specified screen. The screen may not exist."
      //     );
      //   }
      // }
    } catch (error) {
      console.error("[Notification] Error handling notification press:", error);
      Alert.alert("Error", "Failed to process notification. Please try again.");
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <Pressable
      onPress={() => handleNotificationPress(item)}
      className={`mx-4 mb-3 rounded-xl overflow-hidden ${
        isDark ? "bg-gray-800" : "bg-white"
      }`}
      style={[
        Platform.select({
          ios: {
            shadowColor: isDark ? "#000" : "#2563EB",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
          },
          android: {
            elevation: 3,
          },
        }),
      ]}
    >
      {/* Priority Indicator Bar */}
      <View className="flex-row">
        <View
          className={`w-1.5 h-full absolute left-0 ${
            item.priority === "high"
              ? "bg-red-500"
              : item.priority === "medium"
              ? "bg-yellow-500"
              : "bg-blue-500"
          }`}
        />

        <View className="flex-1 pl-4 pr-3 py-4">
          {/* Header Section */}
          <View className="flex-row justify-between items-start mb-2">
            <View className="flex-row items-center flex-1">
              <View
                className={`p-2 rounded-full ${
                  item.priority === "high"
                    ? isDark
                      ? "bg-red-900/30"
                      : "bg-red-100"
                    : item.priority === "medium"
                    ? isDark
                      ? "bg-yellow-900/30"
                      : "bg-yellow-100"
                    : isDark
                    ? "bg-blue-900/30"
                    : "bg-blue-100"
                }`}
              >
                <MaterialCommunityIcons
                  name={getNotificationIcon(item.type)}
                  size={20}
                  color={
                    isDark
                      ? item.priority === "high"
                        ? "#FCA5A5"
                        : item.priority === "medium"
                        ? "#FCD34D"
                        : "#93C5FD"
                      : item.priority === "high"
                      ? "#DC2626"
                      : item.priority === "medium"
                      ? "#D97706"
                      : "#2563EB"
                  }
                />
              </View>
              <View className="flex-1 ml-3">
                <Text
                  className={`font-semibold text-base ${
                    isDark ? "text-white" : "text-gray-900"
                  } ${!item.read ? "font-bold" : ""}`}
                >
                  {item.title}
                </Text>
                <Text
                  className={`text-xs mt-1 ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {format(new Date(item.created_at), "MMM d, yyyy • h:mm a")}
                </Text>
              </View>
            </View>

            {/* Read/Unread Indicator */}
            {!item.read && (
              <View
                className={`px-2 py-1 rounded-full ${
                  isDark ? "bg-blue-900/30" : "bg-blue-100"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    isDark ? "text-blue-400" : "text-blue-600"
                  }`}
                >
                  New
                </Text>
              </View>
            )}
          </View>

          {/* Message Content */}
          <Text
            className={`text-sm pl-2 ${
              isDark ? "text-gray-300" : "text-gray-600"
            } ${!item.read ? "font-medium" : ""}`}
          >
            {item.message}
          </Text>
        </View>
      </View>
    </Pressable>
  );

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "task":
        return "clipboard-check-outline";
      case "reminder":
        return "clock-outline";
      case "general":
        return "information-outline";
      default:
        return "bell-outline";
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator
          size="large"
          color={isDark ? "#60A5FA" : "#2563EB"}
        />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text
          className={`text-base mb-4 text-center ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          {error}
        </Text>
        <Pressable
          onPress={fetchNotifications}
          className={`px-4 py-2 rounded-lg ${
            isDark ? "bg-blue-600" : "bg-blue-500"
          }`}
        >
          <Text className="text-white font-medium">Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {showSendButton && onSendNotification && (
        <Pressable
          onPress={onSendNotification}
          className={`m-4 p-4 rounded-lg flex-row justify-center items-center ${
            isDark ? "bg-blue-600" : "bg-blue-500"
          }`}
        >
          <MaterialCommunityIcons
            name="send"
            size={20}
            color="white"
            style={{ marginRight: 8 }}
          />
          <Text className="text-white font-medium">Send New Notification</Text>
        </Pressable>
      )}

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.uniqueId || item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[isDark ? "#60A5FA" : "#2563EB"]}
            tintColor={isDark ? "#60A5FA" : "#2563EB"}
          />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-8">
            <MaterialCommunityIcons
              name="bell-off-outline"
              size={48}
              color={isDark ? "#6B7280" : "#9CA3AF"}
            />
            <Text
              className={`text-base mt-4 text-center ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              No notifications yet
            </Text>
          </View>
        }
      />
    </View>
  );
}
