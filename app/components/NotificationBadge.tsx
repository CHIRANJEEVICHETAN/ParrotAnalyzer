import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import ThemeContext from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";

interface NotificationBadgeProps {
  size?: "small" | "medium" | "large";
}

export default function NotificationBadge({
  size = "small",
}: NotificationBadgeProps) {
  const { theme } = ThemeContext.useTheme();
  const { user, token } = useAuth();
  const isDark = theme === "dark";
  const [count, setCount] = useState(0);

  // Size configurations
  const sizeConfig = {
    small: {
      container: "w-5 h-5",
      text: "text-xs",
      minWidth: "min-w-[20px]",
    },
    medium: {
      container: "w-6 h-6",
      text: "text-sm",
      minWidth: "min-w-[24px]",
    },
    large: {
      container: "w-7 h-7",
      text: "text-base",
      minWidth: "min-w-[28px]",
    },
  };

  // useEffect(() => {
  //   let isMounted = true;

  //   const fetchUnreadCount = async () => {
  //     try {
  //       if (!user?.id || !token) return;

  //       const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  //       let endpoint = "";

  //       // Determine endpoint based on user role
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
  //         setCount(data.count);
  //       }
  //     } catch (error) {
  //       console.error("Error fetching unread count:", error);
  //     }
  //   };

  //   fetchUnreadCount();
  //   // Set up polling interval
  //   const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30 seconds

  //   return () => {
  //     isMounted = false;
  //     clearInterval(interval);
  //   };
  // }, [user?.id, user?.role, token]);

  // if (count === 0) return null;

  return (
    <View
      className={`${sizeConfig[size].container} ${sizeConfig[size].minWidth} rounded-full bg-red-500 justify-center items-center absolute -top-1 -right-1`}
    >
      <Text className={`${sizeConfig[size].text} text-white font-bold`}>
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}
