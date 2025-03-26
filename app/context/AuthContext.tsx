import React, { createContext, useContext, useState, useEffect } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Alert } from "react-native";
import PushNotificationService from "../utils/pushNotificationService";
import EventEmitter from '../utils/EventEmitter';

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

// Storage keys
const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_DATA_KEY = 'user_data';

const handleLoginError = (error: any) => {
  if (error.response?.data?.code === "COMPANY_DISABLED") {
    return {
      error: "Your company account has been disabled. Please contact the administrator.",
      errorType: "COMPANY_DISABLED",
    };
  }

  if (error.response?.status === 401) {
    return {
      error: "Invalid credentials. Please check your email/phone and password.",
      errorType: "INVALID_CREDENTIALS",
    };
  }

  return {
    error: "An error occurred while logging in. Please try again.",
    errorType: "UNKNOWN",
  };
};

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
        const [accessToken, refreshToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
          AsyncStorage.getItem(REFRESH_TOKEN_KEY),
          AsyncStorage.getItem(USER_DATA_KEY),
        ]);

        if (accessToken && refreshToken && storedUser) {
          // Set the token in axios defaults
          axios.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

          // Parse and set the stored user data
          const userData = JSON.parse(storedUser);
          setUser(userData);
          setToken(accessToken);

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
            // If token is invalid, try to refresh
            const newToken = await refreshTokenSilently(refreshToken);
            if (!newToken) {
              // If refresh fails, clear storage and logout
              await clearAuthData();
            }
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        await clearAuthData();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    // Listen for token expiration events
    const unsubscribe = EventEmitter.on('AUTH_TOKEN_EXPIRED', async () => {
      Alert.alert(
        "Session Expired",
        "Your session has expired. Please login again to continue.",
        [
          {
            text: "OK",
            onPress: async () => {
              // Clear auth state
              setUser(null);
              setToken(null);
              setIsLoading(false);

              if (user?.role !== "super-admin") {
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
              }
              // Navigate to login
              router.replace("/(auth)/signin");
            }
          }
        ]
      );
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Add axios interceptor for token refresh
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If the error is 401 and we haven't tried to refresh yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
            if (!refreshToken) throw new Error("No refresh token available");

            const newToken = await refreshTokenSilently(refreshToken);
            if (!newToken) throw new Error("Token refresh failed");

            // Update the authorization header
            originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
            return axios(originalRequest);
          } catch (refreshError) {
            // If refresh fails, clear auth and redirect to login
            await clearAuthData();
            router.replace("/(auth)/signin");
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const refreshTokenSilently = async (refreshToken: string): Promise<string | null> => {
    try {
      // Remove any existing authorization header for refresh requests
      delete axios.defaults.headers.common["Authorization"];

      // Get the actual refresh token from storage since the parameter might be the access token
      const storedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      if (!storedRefreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await axios.post(`${API_URL}/auth/refresh`, {
        refreshToken: storedRefreshToken  // Use the stored refresh token instead
      });

      const { accessToken, user: userData } = response.data;

      // Update storage
      await Promise.all([
        AsyncStorage.setItem(AUTH_TOKEN_KEY, accessToken),
        AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData))
      ]);

      // Update state
      setToken(accessToken);
      setUser(userData);

      // Update axios default header with new access token
      axios.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

      return accessToken;
    } catch (error) {
      console.error("Silent refresh failed:", error);
      // Clear storage and state on refresh failure
      await Promise.all([
        AsyncStorage.removeItem(AUTH_TOKEN_KEY),
        AsyncStorage.removeItem(USER_DATA_KEY),
        AsyncStorage.removeItem(REFRESH_TOKEN_KEY)
      ]);
      setToken(null);
      setUser(null);
      return null;
    }
  };

  const clearAuthData = async () => {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
      AsyncStorage.removeItem(USER_DATA_KEY),
    ]);
    delete axios.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
  };

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

      const { accessToken, refreshToken, user: userData } = response.data;

      // Store tokens and user data
      await Promise.all([
        AsyncStorage.setItem(AUTH_TOKEN_KEY, accessToken),
        AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
        AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData)),
      ]);

      // Set axios default header
      axios.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

      setToken(accessToken);
      setUser(userData);

      // Register device for push notifications
      if (userData.role !== "super-admin") {
        try {
          const notificationResponse =
            await PushNotificationService.registerForPushNotifications();
          if (notificationResponse.success && notificationResponse.token) {
            await PushNotificationService.registerDeviceWithBackend(
              userData.id.toString(),
              notificationResponse.token,
              accessToken,
              userData.role
            );
          }
        } catch (notificationError) {
          console.error("Error registering for push notifications:", notificationError);
        }
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
      return handleLoginError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (user?.role !== "super-admin") {
        // Unregister device token
        const deviceToken = await PushNotificationService.getCurrentToken();
        if (deviceToken) {
          try {
            const endpoint = `${API_URL}/api/${user?.role || "employee"}-notifications/unregister-device`;
            await axios.delete(endpoint, {
              data: { token: deviceToken },
              headers: { Authorization: `Bearer ${token}` },
            });
          } catch (error) {
            console.error("Error unregistering device:", error);
          }
        }
      }
      await clearAuthData();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        refreshToken: () => refreshTokenSilently(token || ""),
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default {
  AuthProvider,
  useAuth,
};
