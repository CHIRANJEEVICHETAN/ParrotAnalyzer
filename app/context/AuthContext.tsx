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
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
// const API_URL = 'http://192.168.0.105:3000';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          // Set axios default header
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Fetch user profile
          const response = await axios.get(`${API_URL}/user/profile`);
          setUser(response.data);
        }
      } catch (error) {
        await AsyncStorage.removeItem('auth_token');
        axios.defaults.headers.common['Authorization'] = '';
      } finally {
        setIsInitialized(true);
      }
    };

    initAuth();
  }, []);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      console.log('Attempting login with:', { identifier, url: API_URL });
      
      // Create axios instance with timeout
      const axiosInstance = axios.create({
        baseURL: API_URL,
        timeout: 10000, // 10 seconds timeout
      });

      const response = await axiosInstance.post('/auth/login', {
        identifier,
        password
      });

      console.log('Login response:', response.data);

      const { token, user } = response.data;

      // Store token
      await AsyncStorage.setItem('auth_token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Update state
      setUser(user);

      // Navigate based on role
      switch (user.role) {
        case 'employee':
          router.replace('/(dashboard)/employee');
          break;
        case 'group-admin':
          router.replace('/(dashboard)/group-admin');
          break;
        case 'management':
          router.replace('/(dashboard)/management');
          break;
        case 'super-admin':
          router.replace('/(dashboard)/super-admin');
          break;
        default:
          router.replace('/(dashboard)/employee');
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
        // Server responded with an error
        errorMessage = error.response.data?.error || 'Server error: ' + error.response.status;
      } else if (error.request) {
        // Request was made but no response
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        // Error in request setup
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
      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        login, 
        logout, 
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