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
    // Implementation of updateUnreadCount
  };

  const incrementUnreadCount = async () => {
    // Implementation of incrementUnreadCount
  };

  const decrementUnreadCount = async () => {
    // Implementation of decrementUnreadCount
  };

  const resetUnreadCount = async () => {
    // Implementation of resetUnreadCount
  };

  const setUnreadCount = async (count: number) => {
    // Implementation of setUnreadCount
  };

  const setNotifications = (notifications: Notification[]) => {
    // Implementation of setNotifications
  };

  // Load the unread count from AsyncStorage when the user changes
  useEffect(() => {
    const loadUnreadCount = async () => {
      // Implementation of loadUnreadCount
    };

    loadUnreadCount();
  }, [user?.id]);

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
