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
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<string | null>;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const updateUser = (userData: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...userData } : null);
  };

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem('auth_token'),
          AsyncStorage.getItem('user_data')
        ]);
        
        if (storedToken && storedUser) {
          // Set the token in axios defaults
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          // Parse and set the stored user data
          const userData = JSON.parse(storedUser);
          setUser(userData);
          setToken(storedToken);
          
          // Verify token validity
          try {
            const response = await axios.get(`${API_URL}/auth/check-role`);
            
            // If successful, navigate to the appropriate dashboard
            switch (userData.role) {
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
                throw new Error('Invalid user role');
            }
          } catch (error) {
            // If token is invalid, clear storage
            await AsyncStorage.multiRemove(['auth_token', 'user_data']);
            setUser(null);
            setToken(null);
            delete axios.defaults.headers.common['Authorization'];
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Clear any potentially corrupted data
        await AsyncStorage.multiRemove(['auth_token', 'user_data']);
        setUser(null);
        setToken(null);
        delete axios.defaults.headers.common['Authorization'];
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        identifier,
        password
      });

      const { token: newToken, user: userData } = response.data;

      // Store both token and user data
      await Promise.all([
        AsyncStorage.setItem('auth_token', newToken),
        AsyncStorage.setItem('user_data', JSON.stringify(userData))
      ]);

      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

      setToken(newToken);
      setUser(userData);

      // Navigate based on user role
      switch (userData.role) {
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
          throw new Error('Invalid user role');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem('auth_token'),
        AsyncStorage.removeItem('user_data')
      ]);
      
      delete axios.defaults.headers.common['Authorization'];
      setToken(null);
      setUser(null);
      router.replace('/(auth)/signin');
    } catch (error) {
      console.error('Logout error:', error);
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
        updateUser
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