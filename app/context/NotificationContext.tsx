import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import * as Notifications from "expo-notifications";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Notification {
  id: number;
  uniqueId?: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  data?: any;
  created_at: string;
  read: boolean;
}

interface NotificationContextType {
  unreadCount: number;
  notifications: Notification[];
  setNotifications: (notifications: Notification[]) => void;
  incrementUnreadCount: () => void;
  decrementUnreadCount: () => void;
  resetUnreadCount: () => void;
  setUnreadCount: (count: number) => void;
  updateUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  notifications: [],
  setNotifications: () => {},
  incrementUnreadCount: () => {},
  decrementUnreadCount: () => {},
  resetUnreadCount: () => {},
  setUnreadCount: () => {},
  updateUnreadCount: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unreadCount, setUnreadCountState] = useState(0);
  const [notifications, setNotificationsState] = useState<Notification[]>([]);
  const { user, token } = useAuth();

  const updateUnreadCount = async () => {
    try {
      if (!user?.id) return;
      
      // Fetch unread count from server or calculate locally
      const readStatusKey = `${user.id}_read_notifications`;
      const storedReadStatus = await AsyncStorage.getItem(readStatusKey);
      const readNotifications = storedReadStatus ? JSON.parse(storedReadStatus) : {};
      
      const allNotifications = notifications;
      const currentUnreadCount = allNotifications.filter(
        n => !readNotifications[n.uniqueId || n.id]
      ).length;
      
      setUnreadCountState(currentUnreadCount);
      
      // Save to AsyncStorage for persistence
      await AsyncStorage.setItem(`${user.id}_unread_count`, JSON.stringify(currentUnreadCount));
    } catch (error) {
      console.error("[NotificationContext] Error updating unread count:", error);
    }
  };

  const incrementUnreadCount = async () => {
    try {
      if (!user?.id) return;
      
      const newCount = unreadCount + 1;
      setUnreadCountState(newCount);
      
      // Save to AsyncStorage for persistence
      await AsyncStorage.setItem(`${user.id}_unread_count`, JSON.stringify(newCount));
    } catch (error) {
      console.error("[NotificationContext] Error incrementing unread count:", error);
    }
  };

  const decrementUnreadCount = async () => {
    try {
      if (!user?.id) return;
      
      // Ensure count doesn't go below 0
      const newCount = Math.max(0, unreadCount - 1);
      setUnreadCountState(newCount);
      
      // Save to AsyncStorage for persistence
      await AsyncStorage.setItem(`${user.id}_unread_count`, JSON.stringify(newCount));
    } catch (error) {
      console.error("[NotificationContext] Error decrementing unread count:", error);
    }
  };

  const resetUnreadCount = async () => {
    try {
      if (!user?.id) return;
      
      setUnreadCountState(0);
      
      // Save to AsyncStorage for persistence
      await AsyncStorage.setItem(`${user.id}_unread_count`, JSON.stringify(0));
    } catch (error) {
      console.error("[NotificationContext] Error resetting unread count:", error);
    }
  };

  const setUnreadCount = async (count: number) => {
    try {
      if (!user?.id) return;
      
      // Ensure count is not negative
      const validCount = Math.max(0, count);
      setUnreadCountState(validCount);
      
      // Save to AsyncStorage for persistence
      await AsyncStorage.setItem(`${user.id}_unread_count`, JSON.stringify(validCount));
    } catch (error) {
      console.error("[NotificationContext] Error setting unread count:", error);
    }
  };

  const setNotifications = (notifs: Notification[]) => {
    setNotificationsState(notifs);
    // Update unread count when notifications change
    if (notifs.length > 0) {
      updateUnreadCount();
    }
  };

  // Load the unread count from AsyncStorage when the user changes
  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        if (!user?.id) return;
        
        // Try to get from AsyncStorage first
        const storedCount = await AsyncStorage.getItem(`${user.id}_unread_count`);
        if (storedCount) {
          const parsedCount = JSON.parse(storedCount);
          setUnreadCountState(parsedCount);
          return;
        }
        
        // If not found, calculate from read status
        const readStatusKey = `${user.id}_read_notifications`;
        const storedReadStatus = await AsyncStorage.getItem(readStatusKey);
        const readNotifications = storedReadStatus ? JSON.parse(storedReadStatus) : {};
        
        // We may not have notifications yet, so we'll wait for them to be set
        // Just initialize with 0 if we don't have notifications loaded
        if (notifications.length === 0) {
          setUnreadCountState(0);
        } else {
          const count = notifications.filter(n => !readNotifications[n.uniqueId || n.id]).length;
          setUnreadCountState(count);
        }
      } catch (error) {
        console.error("[NotificationContext] Error loading unread count:", error);
        setUnreadCountState(0);
      }
    };

    loadUnreadCount();
  }, [user?.id, notifications]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        notifications,
        setNotifications,
        incrementUnreadCount,
        decrementUnreadCount,
        resetUnreadCount,
        setUnreadCount,
        updateUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
