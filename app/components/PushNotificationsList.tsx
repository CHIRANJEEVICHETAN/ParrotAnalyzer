import React, { useCallback, useEffect, useState, forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import {
  View,
  Text,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Pressable,
  FlatList,
  Alert,
  StyleSheet,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import ThemeContext from "../context/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import { router } from "expo-router";
import { useNotifications } from "../context/NotificationContext";
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  onMarkAllAsRead?: () => void;
  unreadCount?: number;
  onEndReached?: () => void; // New prop for pagination
  onAllDataLoaded?: () => void; // New prop for when all data is loaded
}

// Constants for pagination
const PAGE_SIZE = 15;

const PushNotificationsList = forwardRef(({
  onSendNotification,
  showSendButton = false,
  filterType,
  onMarkAllAsRead,
  unreadCount,
  onEndReached,
  onAllDataLoaded,
}: PushNotificationsListProps, ref) => {
  const { user, token } = useAuth();
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === "dark";

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  
  // Cache using useRef
  const pageRef = useRef(0);
  const notificationCacheRef = useRef<Map<string, Notification[]>>(new Map());
  const filterKeyRef = useRef<string>(filterType || 'all');
  
  const { decrementUnreadCount, incrementUnreadCount, setUnreadCount } = useNotifications();

  // Reset pagination when filter changes
  useEffect(() => {
    if (filterKeyRef.current !== (filterType || 'all')) {
      filterKeyRef.current = filterType || 'all';
      pageRef.current = 0;
      setNotifications([]);
      setHasMoreData(true);
    }
  }, [filterType]);

  // Initial load of unread counts from AsyncStorage
  useEffect(() => {
    const loadInitialUnreadCount = async () => {
      try {
        if (!user?.id) return;
        
        const readStatusKey = `${user.id}_read_notifications`;
        const storedReadStatus = await AsyncStorage.getItem(readStatusKey);
        const readNotifications = storedReadStatus ? JSON.parse(storedReadStatus) : {};
        
        // Get cached notifications if available
        const cachedKey = `${filterType || 'all'}_0`;
        const cachedData = notificationCacheRef.current.get(cachedKey);
        
        if (cachedData) {
          // Calculate unread count from cache
          const currentUnreadCount = cachedData.filter(n => !readNotifications[n.uniqueId || n.id]).length;
          setUnreadCount(currentUnreadCount);
        }
      } catch (error) {
        console.error('[Notifications] Error loading initial unread count:', error);
      }
    };
    
    loadInitialUnreadCount();
  }, [user?.id, filterType, setUnreadCount]);

  // Expose markAllAsRead to parent components
  useImperativeHandle(ref, () => ({
    markAllAsRead
  }));

  const loadReadStatus = useCallback(async (notifs: Notification[]) => {
    try {
      if (!user?.id) return notifs;
      
      const readStatusKey = `${user.id}_read_notifications`;
      const storedReadStatus = await AsyncStorage.getItem(readStatusKey);
      const readNotifications = storedReadStatus ? JSON.parse(storedReadStatus) : {};

      // Update unread count based on stored read status
      const unreadNotifications = notifs.filter(n => !readNotifications[n.uniqueId || n.id]);
      const currentUnreadCount = unreadNotifications.length;
      
      // Don't update if count is 0 and there are no notifications (prevents flickering)
      if (notifs.length > 0 || currentUnreadCount > 0) {
        setUnreadCount(currentUnreadCount);
      }

      return notifs.map(notification => ({
        ...notification,
        read: readNotifications[notification.uniqueId || notification.id] || false
      }));
    } catch (error) {
      console.error('Error loading read status:', error);
      return notifs;
    }
  }, [user?.id, setUnreadCount]);

  const saveReadStatus = useCallback(async (notification: Notification) => {
    try {
      const readStatusKey = `${user?.id}_read_notifications`;
      const storedReadStatus = await AsyncStorage.getItem(readStatusKey);
      const readNotifications = storedReadStatus ? JSON.parse(storedReadStatus) : {};
      
      // Use uniqueId if available, otherwise use id
      const notificationId = notification.uniqueId || notification.id;
      readNotifications[notificationId] = true;
      
      await AsyncStorage.setItem(readStatusKey, JSON.stringify(readNotifications));
    } catch (error) {
      console.error('Error saving read status:', error);
    }
  }, [user?.id]);

  const saveReadStatusBulk = useCallback(async (notifications: Notification[]) => {
    try {
      const readStatusKey = `${user?.id}_read_notifications`;
      const storedReadStatus = await AsyncStorage.getItem(readStatusKey);
      const readNotifications = storedReadStatus ? JSON.parse(storedReadStatus) : {};
      
      notifications.forEach(notification => {
        const notificationId = notification.uniqueId || notification.id;
        readNotifications[notificationId] = true;
      });
      
      await AsyncStorage.setItem(readStatusKey, JSON.stringify(readNotifications));
    } catch (error) {
      console.error('Error saving read status:', error);
    }
  }, [user?.id]);

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

  const fetchNotifications = useCallback(async (page = 0, append = false) => {
    try {
      // Use cached data if available and not refreshing
      const cacheKey = `${filterType || 'all'}_${page}`;
      const cachedData = notificationCacheRef.current.get(cacheKey);
      
      if (cachedData && !refreshing && !append) {
        console.log(`[Notifications] Using cached data for ${cacheKey}`);
        setNotifications(cachedData);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      if (page === 0) {
        if (!append) setLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      // Calculate limit and offset for pagination
      const limit = PAGE_SIZE;
      const offset = page * PAGE_SIZE;

      const { data } = await axios.get(getNotificationsEndpoint(), {
        params: { limit, offset },
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

      // Ensure created_at is a valid date
      const validFilteredData = filteredData.map(notification => ({
        ...notification,
        created_at: new Date(notification.created_at).toString() === 'Invalid Date' 
          ? new Date().toISOString() 
          : notification.created_at
      }));

      // Sort by created_at date, most recent first
      const sortedData = validFilteredData.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Load read status from AsyncStorage and update notifications
      const notificationsWithReadStatus = await loadReadStatus(sortedData);
      
      // Update the cache
      notificationCacheRef.current.set(cacheKey, notificationsWithReadStatus);
      
      // Check if we've reached the end of available data
      if (notificationsWithReadStatus.length < PAGE_SIZE) {
        setHasMoreData(false);
        onAllDataLoaded?.(); // Call the parent's onAllDataLoaded callback
      } else {
        // Ensure hasMoreData is true if we received a full page of data
        setHasMoreData(true);
      }

      // Update state based on whether we're appending or replacing
      if (append) {
        setNotifications(prevNotifications => {
          // Create a new set to avoid duplicates based on uniqueId or id
          const existingIds = new Set(prevNotifications.map(n => n.uniqueId || n.id.toString()));
          const newNotifications = notificationsWithReadStatus.filter(
            n => !existingIds.has(n.uniqueId || n.id.toString())
          );
          
          // Combine and re-sort all notifications to ensure correct date order
          const combined = [...prevNotifications, ...newNotifications];
          return combined.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
      } else {
        setNotifications(notificationsWithReadStatus);
      }

      setError(null);
    } catch (err) {
      console.error("[Notifications] Error fetching:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setHasMoreData(false); // Ensure we stop loading more on error
      onAllDataLoaded?.(); // Also call onAllDataLoaded on error to prevent infinite loading
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [filterType, getNotificationsEndpoint, token, loadReadStatus, refreshing, onAllDataLoaded]);

  // Load initial data
  useEffect(() => {
    fetchNotifications(0, false);
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    // Reset pagination on refresh
    pageRef.current = 0;
    setRefreshing(true);
    setHasMoreData(true);
    fetchNotifications(0, false);
  }, [fetchNotifications]);

  const loadMoreNotifications = useCallback(() => {
    if (isLoadingMore || !hasMoreData || loading || refreshing) return;
    
    const nextPage = pageRef.current + 1;
    pageRef.current = nextPage;
    
    onEndReached?.(); // Call the parent's onEndReached callback
    fetchNotifications(nextPage, true);
  }, [fetchNotifications, isLoadingMore, hasMoreData, loading, refreshing, onEndReached]);

  const markAsRead = async (notification: Notification) => {
    try {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      // Optimistically update the UI
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      decrementUnreadCount();

      // Save read status to AsyncStorage
      await saveReadStatus(notification);
    } catch (err) {
      console.error("[Notification] Error marking as read:", err);

      // Revert optimistic update on error
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: false } : n))
      );
      incrementUnreadCount();

      Alert.alert(
        "Error",
        "Failed to mark notification as read. Please try again."
      );
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    try {
      // Mark as read if not already read
      if (!notification.read) {
        await markAsRead(notification);
      }

      // Only navigate if there's a screen to navigate to
      if (notification.data?.screen) {
        const screen = notification.data.screen as string;
        const normalizedScreen = screen.startsWith("/") ? screen : `/${screen}`;
        router.push(normalizedScreen as RelativePathString);
      }
      // Don't do anything if there's no screen to navigate to
    } catch (error) {
      console.error("[Notification] Error handling notification press:", error);
      Alert.alert("Error", "Failed to process notification. Please try again.");
    }
  };

  const markAllAsRead = async () => {
    try {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      const unreadNotifications = notifications.filter(n => !n.read);
      if (unreadNotifications.length === 0) return;

      // Optimistically update the UI
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);

      // Save read status to AsyncStorage
      await saveReadStatusBulk(unreadNotifications);

      // Clear cache since read status changed
      notificationCacheRef.current.clear();

      // Call the parent's onMarkAllAsRead if provided
      onMarkAllAsRead?.();
    } catch (err) {
      console.error("[Notification] Error marking all as read:", err);

      // Revert optimistic update on error
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: false }))
      );
      
      Alert.alert(
        "Error",
        "Failed to mark all notifications as read. Please try again."
      );
    }
  };

  // Memoize the notification renderer for better performance
  const renderNotification = useCallback(({ item }: { item: Notification }) => (
    <View style={localStyles.notificationCard}>
      <Pressable
        onPress={() => handleNotificationPress(item)}
        className={`rounded-xl overflow-hidden ${
          isDark ? "bg-gray-800/90" : "bg-white"
        }`}
        style={[
          localStyles.notificationContent,
          Platform.select({
            ios: {
              shadowColor: isDark ? "#000" : "#2563EB",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 3,
            },
            android: {
              elevation: 2,
              backgroundColor: isDark ? 'rgba(31, 41, 55, 0.9)' : '#FFFFFF',
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

          <View className="flex-1 pl-4 pr-3 py-5">
            {/* Header Section */}
            <View className="flex-row justify-between items-start mb-3">
              <View className="flex-row items-center flex-1">
                <View
                  className={`p-2.5 rounded-full ${
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
                    size={22}
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
                <View className="flex-1 ml-3.5">
                  <Text
                    className={`font-semibold text-base leading-5 ${
                      isDark ? "text-white" : "text-gray-900"
                    } ${!item.read ? "font-bold" : ""}`}
                  >
                    {item.title}
                  </Text>
                  <Text
                    className={`text-xs mt-1.5 ${
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
                  className={`px-2.5 py-1.5 rounded-full ${
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
              className={`text-sm pl-2 leading-5 ${
                isDark ? "text-gray-300" : "text-gray-600"
              } ${!item.read ? "font-medium" : ""}`}
            >
              {item.message}
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  ), [isDark, handleNotificationPress]);

  // Memoize notification icon getter
  const getNotificationIcon = useCallback((type: string) => {
    switch (type.toLowerCase()) {
      // Employee notification icons
      case 'task-assignment':
        return 'clipboard-list-outline';
      case 'leave-status':
        return 'calendar-clock';
      case 'expense-status':
        return 'receipt';
      
      // Group Admin notification icons
      case 'group':
        return 'account-group-outline';
      case 'announcement':
        return 'bullhorn-outline';
      
      // Management notification icons
      case 'role':
        return 'shield-account-outline';
      case 'user':
        return 'account-outline';
      
      // Common notification icons
      case 'general':
        return 'information-outline';
      default:
        return 'bell-outline';
    }
  }, []);

  // Memoize empty list component
  const ListEmptyComponent = useMemo(() => (
    <View className="items-center px-4 flex-1 justify-center">
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
  ), [isDark]);

  // Memoize footer loader
  const ListFooterComponent = useMemo(() => (
    isLoadingMore ? (
      <View className="py-4 flex justify-center items-center">
        <ActivityIndicator
          size="small"
          color={isDark ? "#60A5FA" : "#2563EB"}
        />
        <Text className={`text-sm mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          Loading more...
        </Text>
      </View>
    ) : hasMoreData ? (
      <View style={{ height: 20 }} />
    ) : notifications.length > 10 ? (
      <View className="py-4 flex justify-center items-center">
        <Text className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          No more notifications
        </Text>
      </View>
    ) : null
  ), [isLoadingMore, hasMoreData, notifications.length, isDark]);

  // Extract key extractor to a memoized function
  const keyExtractor = useCallback((item: Notification) => 
    `${item.uniqueId || item.id.toString()}_${new Date(item.created_at).getTime()}`, 
  []);

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
          onPress={() => fetchNotifications(0, false)}
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
    <View className="flex-1" style={localStyles.container}>
      {showSendButton && onSendNotification && (
        <View className="flex-row justify-between items-center mx-4 mb-4">
          <Pressable
            onPress={onSendNotification}
            className={`flex-1 p-4 rounded-lg flex-row justify-center items-center ${
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
        </View>
      )}

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ 
          flexGrow: 1,
          paddingBottom: 16,
          ...(notifications.length === 0 && {
            justifyContent: 'center',
          })
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[isDark ? "#60A5FA" : "#2563EB"]}
            tintColor={isDark ? "#60A5FA" : "#2563EB"}
          />
        }
        onEndReached={loadMoreNotifications}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        removeClippedSubviews={Platform.OS === 'android'} // Optimize memory usage on Android
        maxToRenderPerBatch={10} // Optimize rendering performance
        initialNumToRender={10} // Initial render count
        windowSize={10} // Render window size
      />
    </View>
  );
});

// Local styles for fixing alignment issues
const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  notificationCard: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  notificationContent: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  }
});

export default PushNotificationsList;
