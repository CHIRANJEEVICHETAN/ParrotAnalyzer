import React, { createContext, useContext, useState, useEffect } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Alert } from "react-native";
import PushNotificationService from "../utils/pushNotificationService";
import EventEmitter from '../utils/EventEmitter';
import * as SecureStore from 'expo-secure-store';
import useAdminLocationStore from "../store/adminLocationStore";

type UserRole = "employee" | "group-admin" | "management" | "super-admin";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  company_name?: string;
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
const AUTH_TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_DATA_KEY = "user_data";

const handleLoginError = (error: any) => {
  if (error.response?.data?.code === "COMPANY_DISABLED") {
    return {
      error:
        "Your company account has been disabled. Please contact the administrator.",
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

// Helper function to store tokens in both storage systems
const storeTokens = async (
  accessToken: string,
  refreshToken: string,
  userData: User
) => {
  try {
    // Store in AsyncStorage (for backward compatibility)
    await Promise.all([
      AsyncStorage.setItem(AUTH_TOKEN_KEY, accessToken),
      AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
      AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData)),
    ]);

    // Also store in SecureStore (for better security)
    await Promise.all([
      SecureStore.setItemAsync(AUTH_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
      SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(userData)),
    ]);

    console.log("Tokens and user data stored in both AsyncStorage and SecureStore");
    return true;
  } catch (error) {
    console.error("Error storing tokens and user data:", error);
    return false;
  }
};

// Helper function to clear tokens from both storage systems
const clearTokens = async () => {
  try {
    // Clear from AsyncStorage
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
      AsyncStorage.removeItem(USER_DATA_KEY),
    ]);

    // Clear from SecureStore
    await Promise.all([
      SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_DATA_KEY),
    ]);

    console.log("Tokens cleared from both AsyncStorage and SecureStore");
    return true;
  } catch (error) {
    console.error("Error clearing tokens:", error);
    return false;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAdminLocation =
    useAdminLocationStore.getState().fetchAdminLocation;

  const updateUser = (userData: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...userData } : null));
  };

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);

        // Try to get tokens from AsyncStorage first
        let accessToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        let refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
        let storedUser = await AsyncStorage.getItem(USER_DATA_KEY);

        // If not found in AsyncStorage, try SecureStore
        if (!accessToken || !refreshToken || !storedUser) {
          console.log("Tokens not found in AsyncStorage, trying SecureStore");
          accessToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
          refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
          storedUser = await SecureStore.getItemAsync(USER_DATA_KEY);

          // If found in SecureStore but not AsyncStorage, migrate to AsyncStorage for compatibility
          if (accessToken && refreshToken && storedUser) {
            console.log(
              "Tokens found in SecureStore, migrating to AsyncStorage"
            );
            await Promise.all([
              AsyncStorage.setItem(AUTH_TOKEN_KEY, accessToken),
              AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
              AsyncStorage.setItem(USER_DATA_KEY, storedUser),
            ]);
          }
        }

        if (accessToken && refreshToken && storedUser) {
          // Set the token in axios defaults
          axios.defaults.headers.common[
            "Authorization"
          ] = `Bearer ${accessToken}`;

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
    const handler = async () => {
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
                const deviceToken =
                  await PushNotificationService.getCurrentToken();

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
            },
          },
        ]
      );
    };

    EventEmitter.on("AUTH_TOKEN_EXPIRED", handler);

    return () => {
      // Remove the listener correctly
      EventEmitter.removeListener("AUTH_TOKEN_EXPIRED", handler);
    };
  }, []);

  // Update the axios interceptor to skip token refresh for login/auth endpoints
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Skip token refresh for auth-related endpoints
        const isAuthRequest =
          originalRequest.url?.includes("/auth/login") ||
          originalRequest.url?.includes("/auth/forgot-password") ||
          originalRequest.url?.includes("/auth/verify-otp") ||
          originalRequest.url?.includes("/auth/reset-password");

        // If the error is 403, don't try to refresh the token
        if (error.response?.status === 403) {
          return Promise.reject(error);
        }

        // If the error is 401 and we haven't tried to refresh yet and it's not an auth request
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !isAuthRequest
        ) {
          originalRequest._retry = true;

          try {
            // Try SecureStore first
            let refreshToken = await SecureStore.getItemAsync(
              REFRESH_TOKEN_KEY
            );

            // If not found in SecureStore, try AsyncStorage
            if (!refreshToken) {
              refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
            }

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

  const refreshTokenSilently = async (
    refreshToken: string
  ): Promise<string | null> => {
    try {
      // Remove any existing authorization header for refresh requests
      delete axios.defaults.headers.common["Authorization"];

      // Get the actual refresh token from storage since the parameter might be the access token
      let storedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);

      // If not found in AsyncStorage, try SecureStore
      if (!storedRefreshToken) {
        console.log(
          "Refresh token not found in AsyncStorage, trying SecureStore"
        );
        storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      }

      if (!storedRefreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await axios.post(`${API_URL}/auth/refresh`, {
        refreshToken: storedRefreshToken, // Use the stored refresh token instead
      });

      const { accessToken, user: userData } = response.data;

      // Update storage in both AsyncStorage and SecureStore
      await Promise.all([
        // AsyncStorage
        AsyncStorage.setItem(AUTH_TOKEN_KEY, accessToken),
        AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData)),
        // SecureStore
        SecureStore.setItemAsync(AUTH_TOKEN_KEY, accessToken),
        SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(userData)),
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
      await clearTokens();
      setToken(null);
      setUser(null);
      return null;
    }
  };

  const clearAuthData = async (): Promise<void> => {
    await clearTokens();
    delete axios.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
    return Promise.resolve();
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

      // Store tokens in both AsyncStorage and SecureStore
      await storeTokens(accessToken, refreshToken, userData);

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
          console.error(
            "Error registering for push notifications:",
            notificationError
          );
        }
      }

      // If the user is a group-admin, fetch their location immediately
      if (userData.role === "group-admin") {
        console.log("Group admin logged in, fetching location...");
        // Fetch admin location in the background (don't await to not block login flow)
        fetchAdminLocation().catch((error) => {
          console.error("Error fetching admin location during login:", error);
          // Non-blocking, so we don't need to handle this error specifically
        });
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
      console.error("Login error:", error.message);

      // Direct error handling for login, avoiding axios interceptor
      if (error.response) {
        // Handle specific API error responses
        if (error.response.data?.code === "COMPANY_DISABLED") {
          return {
            error:
              "Your company account has been disabled. Please contact the administrator.",
            errorType: "COMPANY_DISABLED",
          };
        }

        if (error.response.status === 401) {
          return {
            error:
              "Invalid credentials. Please check your email/phone and password.",
            errorType: "INVALID_CREDENTIALS",
          };
        }

        if (error.response.data?.error) {
          return {
            error: error.response.data.error,
            errorType: "API_ERROR",
          };
        }
      }

      // Generic error
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
      if (user?.role !== "super-admin") {
        // Unregister device token
        const deviceToken = await PushNotificationService.getCurrentToken();
        if (deviceToken) {
          try {
            const endpoint = `${API_URL}/api/${
              user?.role || "employee"
            }-notifications/unregister-device`;
            await axios.delete(endpoint, {
              data: { token: deviceToken },
              headers: { Authorization: `Bearer ${token}` },
            });
            console.log("Device unregistered successfully");
          } catch (error) {
            console.error("Error unregistering device:", error);
          }
        }
      }
      return await clearAuthData();
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
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
