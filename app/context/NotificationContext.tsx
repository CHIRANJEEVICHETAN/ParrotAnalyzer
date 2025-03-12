import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import * as Notifications from "expo-notifications";
import axios from "axios";

interface NotificationContextType {
  unreadCount: number;
  updateUnreadCount: (count: number) => void;
  incrementUnreadCount: () => void;
  decrementUnreadCount: () => void;
  resetUnreadCount: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  updateUnreadCount: () => {},
  incrementUnreadCount: () => {},
  decrementUnreadCount: () => {},
  resetUnreadCount: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, token } = useAuth();

  const updateUnreadCount = (count: number) => {
    setUnreadCount(count);
    // Update app badge count
    Notifications.setBadgeCountAsync(count);
  };

  const incrementUnreadCount = () => {
    setUnreadCount((prev) => {
      const newCount = prev + 1;
      Notifications.setBadgeCountAsync(newCount);
      return newCount;
    });
  };

  const decrementUnreadCount = () => {
    setUnreadCount((prev) => {
      const newCount = Math.max(0, prev - 1);
      Notifications.setBadgeCountAsync(newCount);
      return newCount;
    });
  };

  const resetUnreadCount = () => {
    setUnreadCount(0);
    Notifications.setBadgeCountAsync(0);
  };

  // // Only fetch unread count once when user logs in
  // useEffect(() => {
  //   let isMounted = true;

  //   const fetchUnreadCount = async () => {
  //     try {
  //       if (!user?.id || !token) {
  //         resetUnreadCount();
  //         return;
  //       }

  //       const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  //       let endpoint = "";

  //       switch (user.role) {
  //         case "employee":
  //           endpoint = `${baseUrl}/api/employee-notifications/unread-count`;
  //           break;
  //         case "group-admin":
  //           endpoint = `${baseUrl}/api/group-admin-notifications/unread-count`;
  //           break;
  //         case "management":
  //           endpoint = `${baseUrl}/api/management-notifications/unread-count`;
  //           break;
  //         default:
  //           return;
  //       }

  //       const { data } = await axios.get(endpoint, {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //         },
  //       });

  //       if (isMounted) {
  //         updateUnreadCount(data.count);
  //       }
  //     } catch (error) {
  //       console.error("Error fetching unread count:", error);
  //     }
  //   };

  //   fetchUnreadCount();

  //   return () => {
  //     isMounted = false;
  //   };
  // }, [user?.id, user?.role, token]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        updateUnreadCount,
        incrementUnreadCount,
        decrementUnreadCount,
        resetUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
