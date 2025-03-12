import React, { createContext, useContext, useState, useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Alert } from 'react-native';
import PushNotificationService from "../utils/pushNotificationService";

type UserRole = "employee" | "group-admin" | "management" | "super-admin";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (
    identifier: string,
    password: string
  ) => Promise<{ error?: string; errorType?: string }>;
  logout: () => void;
  refreshToken: () => Promise<string | null>;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const updateUser = (userData: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...userData } : null));
  };

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem("auth_token"),
          AsyncStorage.getItem("user_data"),
        ]);

        if (storedToken && storedUser) {
          // Set the token in axios defaults
          axios.defaults.headers.common[
            "Authorization"
          ] = `Bearer ${storedToken}`;

          // Parse and set the stored user data
          const userData = JSON.parse(storedUser);
          setUser(userData);
          setToken(storedToken);

          // Verify token validity
          try {
            const response = await axios.get(`${API_URL}/auth/check-role`);

            // If successful, navigate to the appropriate dashboard
            switch (userData.role) {
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
              default:
                throw new Error("Invalid user role");
            }
          } catch (error) {
            // If token is invalid, clear storage
            await AsyncStorage.multiRemove(["auth_token", "user_data"]);
            setUser(null);
            setToken(null);
            delete axios.defaults.headers.common["Authorization"];
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        // Clear any potentially corrupted data
        await AsyncStorage.multiRemove(["auth_token", "user_data"]);
        setUser(null);
        setToken(null);
        delete axios.defaults.headers.common["Authorization"];
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (
    identifier: string,
    password: string
  ): Promise<{ error?: string; errorType?: string }> => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        identifier,
        password,
      });

      const { token: newToken, user: userData } = response.data;

      // Store both token and user data
      await Promise.all([
        AsyncStorage.setItem("auth_token", newToken),
        AsyncStorage.setItem("user_data", JSON.stringify(userData)),
      ]);

      // Set axios default header
      axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;

      setToken(newToken);
      setUser(userData);

      // Register device for push notifications
      try {
        const notificationResponse =
          await PushNotificationService.registerForPushNotifications();
        if (notificationResponse.success && notificationResponse.token) {
          await PushNotificationService.registerDeviceWithBackend(
            userData.id.toString(),
            notificationResponse.token,
            newToken,
            userData.role
          );
        }
      } catch (notificationError) {
        console.error(
          "Error registering for push notifications:",
          notificationError
        );
        // Don't block login if push notification registration fails
      }

      // Navigate based on user role
      switch (userData.role) {
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
        default:
          throw new Error("Invalid user role");
      }
      return {};
    } catch (error: any) {
      console.error("Login error:", error);

      if (error.response?.data?.code === "COMPANY_DISABLED") {
        return {
          error:
            "Your company account has been disabled. Please contact the administrator.",
          errorType: "COMPANY_DISABLED",
        };
      }

      if (error.response?.status === 401) {
        return {
          error:
            "Invalid credentials. Please check your email/phone and password.",
          errorType: "INVALID_CREDENTIALS",
        };
      }

      return {
        error: "An error occurred while logging in. Please try again.",
        errorType: "UNKNOWN",
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Get the current device token
      const deviceToken = await PushNotificationService.getCurrentToken();

      if (deviceToken) {
        // Deactivate the device token
        try {
          const baseUrl = process.env.EXPO_PUBLIC_API_URL;
          const endpoint = `${baseUrl}/api/${
            user?.role || "employee"
          }-notifications/unregister-device`;

          await axios.delete(endpoint, {
            data: { token: deviceToken },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (error) {
          console.error("Error deactivating device token:", error);
        }
      }

      // Clear all storage
      await Promise.all([
        AsyncStorage.removeItem("auth_token"),
        AsyncStorage.removeItem("user_data"),
      ]);

      delete axios.defaults.headers.common["Authorization"];
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Add a function to refresh token
  const refreshToken = async () => {
    try {
      const storedToken = await AsyncStorage.getItem("auth_token");
      if (!storedToken) {
        return null;
      }

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, null, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        const { token: newToken, user } = response.data;
        await AsyncStorage.setItem("auth_token", newToken);
        setToken(newToken);
        setUser(user);

        axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
        return newToken;
      } catch (error: any) {
        // Handle company disabled error during token refresh
        if (error.response?.data?.code === "COMPANY_DISABLED") {
          await logout(); // Force logout
          Alert.alert(
            "Access Denied",
            "Your company account has been disabled. Please contact the administrator."
          );
          return null;
        }

        if (axios.isAxiosError(error) && error.response?.status === 401) {
          await logout();
        }
        throw error;
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
      await logout();
      return null;
    }
  };

  // Add an axios interceptor to handle company disabled responses globally
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.data?.code === "COMPANY_DISABLED") {
          await logout();
          Alert.alert(
            "Access Denied",
            "Your company account has been disabled. Please contact the administrator."
          );
          return Promise.reject(error);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        refreshToken,
        isLoading,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default {
  AuthProvider,
  useAuth,
};