import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Alert, Platform, AppState } from "react-native";
import PushNotificationService from "../utils/pushNotificationService";
import EventEmitter from '../utils/EventEmitter';
import * as SecureStore from 'expo-secure-store';
import useAdminLocationStore from "../store/adminLocationStore";
import * as Network from 'expo-network';
import { getTokenDebugInfo, repairTokenIssues, decodeToken, isTokenExpired } from '../utils/tokenDebugger';
import Constants from 'expo-constants';

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
  isOffline: boolean;
  login: (
    identifier: string,
    password: string
  ) => Promise<{ error?: string; errorType?: string }>;
  logout: () => void;
  refreshToken: () => Promise<string | null>;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

// Storage keys
const AUTH_TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_DATA_KEY = "user_data";
const LAST_ONLINE_LOGIN_KEY = "last_online_login";
const OFFLINE_MODE_KEY = "offline_mode_enabled";

// How many days a user can stay logged in offline before requiring online verification
const MAX_OFFLINE_DAYS = 30;

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
      error: "Invalid Credentials",
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
    // Try to store in SecureStore first (for better security)
    if (Platform.OS !== 'web') {
      try {
        await Promise.all([
          SecureStore.setItemAsync(AUTH_TOKEN_KEY, accessToken),
          SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
          SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(userData)),
        ]);
        console.log("Tokens stored in SecureStore");
      } catch (secureError) {
        console.error("Error storing in SecureStore:", secureError);
        // Continue to AsyncStorage if SecureStore fails
      }
    }

    // Always store in AsyncStorage for backward compatibility and web support
    await Promise.all([
      AsyncStorage.setItem(AUTH_TOKEN_KEY, accessToken),
      AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
      AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData)),
      // Store the timestamp of the last successful online login
      AsyncStorage.setItem(LAST_ONLINE_LOGIN_KEY, Date.now().toString()),
    ]);
    
    console.log("Tokens stored successfully");
    return true;
  } catch (error) {
    console.error("Error storing tokens and user data:", error);
    return false;
  }
};

// Helper function to clear tokens from both storage systems
const clearTokens = async () => {
  try {
    const promises = [
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
      AsyncStorage.removeItem(USER_DATA_KEY),
      AsyncStorage.removeItem(LAST_ONLINE_LOGIN_KEY),
      AsyncStorage.removeItem(OFFLINE_MODE_KEY),
    ];
    
    // Only use SecureStore on native platforms
    if (Platform.OS !== 'web') {
      promises.push(
        SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.deleteItemAsync(USER_DATA_KEY)
      );
    }

    await Promise.all(promises);
    console.log("Tokens cleared from storage");
    return true;
  } catch (error) {
    console.error("Error clearing tokens:", error);
    return false;
  }
};

// Helper function to validate a token locally without server communication
const validateTokenLocally = (token: string): boolean => {
  try {
    if (!token) return false;
    
    // Check if token is expired
    if (isTokenExpired(token)) {
      console.log('Token is expired according to local validation');
      return false;
    }
    
    // Decode the token to check its contents
    const decoded = decodeToken(token);
    if (!decoded || !decoded.id || !decoded.role) {
      console.log('Token is missing required claims');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating token locally:', error);
    return false;
  }
};

// Helper to check if offline login is still valid
const isOfflineLoginValid = async (): Promise<boolean> => {
  try {
    const lastLoginTimeStr = await AsyncStorage.getItem(LAST_ONLINE_LOGIN_KEY);
    if (!lastLoginTimeStr) return false;
    
    const lastLoginTime = parseInt(lastLoginTimeStr);
    const now = Date.now();
    const daysSinceLastOnlineLogin = (now - lastLoginTime) / (1000 * 60 * 60 * 24);
    
    console.log(`Days since last online login: ${daysSinceLastOnlineLogin.toFixed(1)}`);
    
    return daysSinceLastOnlineLogin <= MAX_OFFLINE_DAYS;
  } catch (error) {
    console.error('Error checking offline login validity:', error);
    return false;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSync, setPendingSync] = useState(false);
  
  // Reference to track network state
  const networkStateRef = useRef({
    isConnected: true,
    isInternetReachable: true,
  });
  
  const appStateRef = useRef(AppState.currentState);

  const fetchAdminLocation =
    useAdminLocationStore.getState().fetchAdminLocation;

  const updateUser = (userData: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...userData } : null));
  };

  // Check network connectivity
  const checkNetworkConnectivity = async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      const isConnected = networkState.isConnected === true;
      const isReachable = networkState.isInternetReachable === true;
      
      networkStateRef.current = {
        isConnected,
        isInternetReachable: isReachable,
      };
      
      const newOfflineState = !isConnected || !isReachable;
      if (isOffline !== newOfflineState) {
        setIsOffline(newOfflineState);
      }
      
      return { isConnected, isReachable };
    } catch (error) {
      console.error("Error checking network connectivity:", error);
      return { isConnected: false, isReachable: false };
    }
  };

  // Handle app state changes to check for network changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // When app comes to foreground
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground!');
        checkNetworkConnectivity().then(({ isConnected, isReachable }) => {
          // If we're coming back online and have pending sync
          if (isConnected && isReachable && pendingSync && user) {
            console.log('Network restored, syncing auth state...');
            refreshTokenSilently(token || '');
            setPendingSync(false);
          }
        });
      }
      
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [pendingSync, user, token]);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);

        // Check network connectivity first
        const { isConnected, isReachable } = await checkNetworkConnectivity();
        const hasNetwork = isConnected && isReachable;
        
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
          // Local validation first
          const isTokenValid = validateTokenLocally(accessToken);
          const isRefreshTokenValid = validateTokenLocally(refreshToken);
          
          // Parse and set the stored user data
          const userData = JSON.parse(storedUser);
          
          if (!isTokenValid && !isRefreshTokenValid) {
            console.log('Both access and refresh tokens are invalid locally');
            await clearAuthData();
            return;
          }
          
          // Set the token in axios defaults
          axios.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
          setUser(userData);
          setToken(accessToken);

          // If we're online, verify with server
          if (hasNetwork) {
            try {
              console.log("Online mode: verifying token with server");
              const response = await axios.get(`${API_URL}/auth/check-role`);
              
              // Update last online login time
              await AsyncStorage.setItem(LAST_ONLINE_LOGIN_KEY, Date.now().toString());
              
              // If validated online, navigate to appropriate dashboard
              routeUserToDashboard(userData.role);
            } catch (error) {
              console.log("Token verification failed, trying to refresh");
              
              // If token is invalid, try to refresh
              const newToken = await refreshTokenSilently(refreshToken);
              if (!newToken) {
                // If online refresh fails, check if offline mode is permitted
                const isOfflineValid = await isOfflineLoginValid();
                
                if (isOfflineValid && isRefreshTokenValid) {
                  console.log("Entering offline mode with cached credentials");
                  setIsOffline(true);
                  await AsyncStorage.setItem(OFFLINE_MODE_KEY, 'true');
                  setPendingSync(true);
                  
                  // Navigate based on cached user role
                  routeUserToDashboard(userData.role);
                } else {
                  console.log("Offline login expired or not allowed");
                  await clearAuthData();
                }
              }
            }
          } else {
            // We're offline, check if offline login is still valid
            console.log("Offline mode: checking locally stored tokens");
            const isOfflineValid = await isOfflineLoginValid();
            
            if (isOfflineValid && (isTokenValid || isRefreshTokenValid)) {
              console.log("Offline authentication successful");
              setIsOffline(true);
              await AsyncStorage.setItem(OFFLINE_MODE_KEY, 'true');
              setPendingSync(true);
              
              // Navigate based on cached user role
              routeUserToDashboard(userData.role);
            } else {
              console.log("Offline login expired or tokens invalid");
              await clearAuthData();
            }
          }
        } else {
          console.log("No stored credentials found");
          await clearAuthData();
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        await clearAuthData();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
    
    // Set up a network connectivity listener
    const networkCheckInterval = setInterval(() => {
      checkNetworkConnectivity();
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(networkCheckInterval);
  }, []);
  
  // Helper function to route user to correct dashboard
  const routeUserToDashboard = (role: UserRole) => {
    switch (role) {
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
        console.error("Invalid user role:", role);
        // Stay on current screen
    }
  };

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

        // If network is unavailable, mark the request for retry when back online
        if (!networkStateRef.current.isConnected || !networkStateRef.current.isInternetReachable) {
          console.log('Network unavailable, queuing request for later');
          setPendingSync(true);
          
          // For offline mode, provide a specific error code that UI can handle
          error.isOfflineError = true;
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
            // If refresh fails, check if we can operate in offline mode
            const isOfflineValid = await isOfflineLoginValid();
            
            if (isOfflineValid) {
              console.log('Token refresh failed but offline mode is active');
              setIsOffline(true);
              setPendingSync(true);
              
              // Mark this error as an offline error
              error.isOfflineError = true;
              return Promise.reject(error);
            } else {
              // If offline mode isn't valid, clear auth and redirect to login
              await clearAuthData();
              router.replace("/(auth)/signin");
              return Promise.reject(refreshError);
            }
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
      // Check network connectivity first
      const { isConnected, isReachable } = await checkNetworkConnectivity();
      if (!isConnected || !isReachable) {
        console.log('Network unavailable, cannot refresh token online');
        
        // In offline mode, just validate the token locally
        let storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        
        // If not found in AsyncStorage, try SecureStore
        if (!storedToken) {
          storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        }
        
        if (storedToken && validateTokenLocally(storedToken)) {
          // If token is still valid locally, use it
          console.log('Using locally validated token in offline mode');
          setIsOffline(true);
          setPendingSync(true);
          return storedToken;
        }
        
        // Check if refresh token is valid locally
        if (refreshToken && validateTokenLocally(refreshToken)) {
          console.log('Access token expired but refresh token valid - offline mode only');
          setIsOffline(true);
          setPendingSync(true);
          return refreshToken; // Use refresh token as temporary access token in offline mode
        }
        
        console.log('No valid token available offline');
        return null;
      }

      // We're online, proceed with normal refresh
      setIsOffline(false);
      
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
        AsyncStorage.setItem(LAST_ONLINE_LOGIN_KEY, Date.now().toString()),
        AsyncStorage.removeItem(OFFLINE_MODE_KEY),
        // SecureStore
        SecureStore.setItemAsync(AUTH_TOKEN_KEY, accessToken),
        SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(userData)),
      ]);

      // Update state
      setToken(accessToken);
      setUser(userData);
      setPendingSync(false);

      // Update axios default header with new access token
      axios.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

      return accessToken;
    } catch (error) {
      console.error("Silent refresh failed:", error);
      
      // Check if we can continue in offline mode
      const isOfflineValid = await isOfflineLoginValid();
      
      if (isOfflineValid) {
        console.log('Online refresh failed but offline mode is active');
        setIsOffline(true);
        setPendingSync(true);
        
        // Keep existing token for offline use
        return token;
      } else {
        // Clear storage and state if offline mode is not valid
        await clearTokens();
        setToken(null);
        setUser(null);
        return null;
      }
    }
  };

  const clearAuthData = async (): Promise<void> => {
    await clearTokens();
    delete axios.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
    setIsOffline(false);
    setPendingSync(false);
    return Promise.resolve();
  };

  const login = async (
    identifier: string,
    password: string
  ): Promise<{ error?: string; errorType?: string }> => {
    setIsLoading(true);
  
    try {
      // Check network connectivity first
      const networkState = await Network.getNetworkStateAsync();
      if (!networkState.isConnected || networkState.isInternetReachable === false) {
        return {
          error: "No internet connection. Please check your network settings and try again.",
          errorType: "NETWORK_ERROR",
        };
      }
    
      // Check for token storage inconsistencies before login
      try {
        const tokenInfo = await getTokenDebugInfo();
        if (tokenInfo && (
          tokenInfo.issues.accessTokenMismatch || 
          tokenInfo.issues.refreshTokenMismatch ||
          (tokenInfo.issues.asyncAccessMissing && !tokenInfo.issues.secureAccessMissing) ||
          (tokenInfo.issues.secureAccessMissing && !tokenInfo.issues.asyncAccessMissing)
        )) {
          console.log('Token storage inconsistencies detected, attempting repair before login...');
          await repairTokenIssues();
        }
      } catch (tokenError) {
        console.error('Error checking token storage health:', tokenError);
        // Continue with login attempt even if token check fails
      }

      // Attempt login with timeout handling
      const response = await axios.post(`${API_URL}/auth/login`, {
        identifier,
        password,
      }, {
        timeout: 15000, // 15 second timeout
      });

      const { accessToken, refreshToken, user: userData } = response.data;

      // Store tokens with error handling
      const storageSuccess = await storeTokens(accessToken, refreshToken, userData);
      if (!storageSuccess) {
        console.error("Failed to store authentication tokens");
        return {
          error: "Unable to store login information. Please try again.",
          errorType: "TOKEN_STORAGE_ISSUE",
        };
      }

      // Set axios default header
      axios.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

      setToken(accessToken);
      setUser(userData);
      setIsOffline(false);
      setPendingSync(false);

      // Register device for push notifications with error handling
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
          // Non-blocking error, continue with login
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
      routeUserToDashboard(userData.role);
      return {};
    } catch (error: any) {
      console.error("Login error:", error);

      // Handle network-related errors
      if (!error.response) {
        if (error.code === 'ECONNABORTED') {
          return {
            error: "Connection timed out. Server may be busy or experiencing issues.",
            errorType: "TIMEOUT_ERROR",
          };
        }
        return {
          error: "Network error. Please check your internet connection and try again.",
          errorType: "NETWORK_ERROR",
        };
      }

      // Handle API error responses
      if (error.response) {
        // Handle specific API error responses
        switch (error.response.status) {
          case 400:
            return {
              error: error.response.data?.error || "Invalid request. Please check your input.",
              errorType: "BAD_REQUEST",
            };
          case 401:
            return {
              error: "Invalid Credentials",
              errorType: "INVALID_CREDENTIALS",
            };
          case 403:
            if (error.response.data?.code === "COMPANY_DISABLED") {
              return {
                error: "Your company account has been disabled. Please contact the administrator.",
                errorType: "COMPANY_DISABLED",
              };
            }
            return {
              error: error.response.data?.error || "Access denied.",
              errorType: "ACCESS_DENIED",
            };
          case 404:
            return {
              error: "User not found. Please check your credentials.",
              errorType: "USER_NOT_FOUND",
            };
          case 429:
            return {
              error: "Too many login attempts. Please try again later.",
              errorType: "RATE_LIMIT",
            };
          case 500:
          case 502:
          case 503:
          case 504:
            return {
              error: "Server error. Please try again later or contact support.",
              errorType: "SERVER_ERROR",
            };
          default:
            if (error.response.data?.error) {
              return {
                error: error.response.data.error,
                errorType: "API_ERROR",
              };
            }
        }
      }

      // Platform specific issues
      if (error instanceof TypeError) {
        if (Platform.OS === 'web' && error.message.includes('localStorage')) {
          return {
            error: "Browser storage error. Please enable cookies and local storage.",
            errorType: "WEB_STORAGE_ERROR",
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
      // Check if we're online before unregistering the device
      const { isConnected, isReachable } = await checkNetworkConnectivity();
      
      if (isConnected && isReachable && user?.role !== "super-admin") {
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
      // Even if there's an error, still clear local auth data
      await clearAuthData();
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
        isOffline,
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
