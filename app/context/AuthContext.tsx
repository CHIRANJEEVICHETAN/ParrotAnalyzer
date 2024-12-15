import React, { createContext, useContext, useState, useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

type UserRole = 'employee' | 'group-admin' | 'management' | 'super-admin';

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
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  isLoading: boolean;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        const storedToken = await AsyncStorage.getItem('auth_token');
        
        if (storedToken) {
          console.log('Found stored token, attempting refresh');
          const newToken = await refreshToken();
          if (!newToken) {
            console.log('Token refresh failed during initialization');
            router.replace('/(auth)/signin');
          } else {
            console.log('Token refresh successful during initialization');
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsInitialized(true);
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      console.log('Login attempt:', { identifier, url: API_URL });
      
      // Create axios instance with full URL
      const response = await axios.post(`${API_URL}/auth/login`, {
        identifier,
        password
      });

      console.log('Login response:', response.data);
      const { token: newToken, user } = response.data;

      await AsyncStorage.setItem('auth_token', newToken);
      setToken(newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      setUser(user);

      console.log('Auth state updated:', { user, token: newToken });

      // Navigate based on role
      switch (user.role) {
        case 'employee':
          router.replace('/(dashboard)/employee/employee');
          break;
        case 'group-admin':
          router.replace('/(dashboard)/Group-Admin/group-admin');
          break;
        case 'management':
          router.replace('/(dashboard)/management/management');
          break;
        case 'super-admin':
          router.replace('/(dashboard)/super-admin/super-admin');
          break;
        default:
          router.replace('/(dashboard)/employee/employee');
      }
    } catch (error: any) {
      console.error('Login error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: API_URL
      });

      let errorMessage = 'An error occurred during login';
      
      if (error.response) {
        errorMessage = error.response.data?.error || 'Server error: ' + error.response.status;
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        errorMessage = error.message || 'Error setting up the request';
      }

      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await AsyncStorage.removeItem('auth_token');
      axios.defaults.headers.common['Authorization'] = '';
      setUser(null);
      setToken(null);
      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a function to refresh token
  const refreshToken = async () => {
    try {
      console.log('=== Starting token refresh ===');
      const storedToken = await AsyncStorage.getItem('auth_token');
      if (!storedToken) {
        console.log('No stored token found');
        return null;
      }
      console.log('Found stored token:', storedToken.substring(0, 20) + '...');

      try {
        console.log('Making refresh token request...');
        const response = await axios.post(`${API_URL}/auth/refresh`, null, {
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        });

        const { token: newToken, user } = response.data;
        console.log('Refresh successful. New token:', newToken.substring(0, 20) + '...');
        console.log('User data:', { id: user.id, role: user.role });

        await AsyncStorage.setItem('auth_token', newToken);
        setToken(newToken);
        setUser(user);

        // Set the token in axios defaults
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        console.log('Updated axios default headers');

        return newToken;
      } catch (error) {
        console.error('Token refresh request failed:', error);
        if (axios.isAxiosError(error)) {
          console.error('Response status:', error.response?.status);
          console.error('Response data:', error.response?.data);
        }
        throw error;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log('Clearing auth state due to 401');
        await AsyncStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
      }
      return null;
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        token,
        login, 
        logout,
        refreshToken,
        isLoading,
        isInitialized
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