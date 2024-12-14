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
    const initAuth = async () => {
      try {
        console.log('Initializing auth...');
        const storedToken = await AsyncStorage.getItem('auth_token');
        console.log('Stored token:', storedToken);
        
        if (storedToken) {
          setToken(storedToken);
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          console.log('Axios headers set:', axios.defaults.headers.common['Authorization']);
          
          const response = await axios.get(`${API_URL}/user/profile`);
          console.log('Profile response:', response.data);
          setUser(response.data);
        }
      } catch (error) {
        console.error('Init auth error:', error);
        await AsyncStorage.removeItem('auth_token');
        setToken(null);
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

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        token,
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