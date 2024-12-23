import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import axios from 'axios';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

export default function Notifications() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      console.log('Fetching notifications...');
      const url = `${process.env.EXPO_PUBLIC_API_URL}/api/notifications`;
      console.log('Request URL:', url);
      
      const config = {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };
      console.log('Request config:', config);

      const response = await axios.get(url, config);
      console.log('Response:', response.data);
      
      setNotifications(response.data);
    } catch (error) {
      console.error('Full error:', error);
      
      if (axios.isAxiosError(error)) {
        console.error('Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          headers: error.response?.headers
        });
        
        Alert.alert(
          'Error',
          error.response?.data?.details || 'Failed to fetch notifications'
        );
      } else {
        console.error('Non-Axios error:', error);
        Alert.alert(
          'Error',
          'Failed to fetch notifications'
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/notifications/${id}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === id ? { ...notif, read: true } : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const getIconName = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'approval':
        return 'checkmark-circle';
      case 'rejection':
        return 'close-circle';
      default:
        return 'notifications';
    }
  };

  const getIconColor = (type: string): string => {
    switch (type) {
      case 'approval':
        return '#10B981';
      case 'rejection':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#FFFFFF' }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
      />

      <LinearGradient
        colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        className="pb-4"
        style={[styles.header, { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 0 }]}
      >
        <View className="flex-row items-center justify-between px-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2 rounded-full"
            style={{ backgroundColor: isDark ? '#374151' : '#F3F4F6' }}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
          <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Notifications
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={isDark ? '#60A5FA' : '#3B82F6'}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {loading ? (
          <View className="flex-1 justify-center items-center py-8">
            <ActivityIndicator 
              size="large" 
              color={isDark ? '#60A5FA' : '#3B82F6'} 
            />
            <Text 
              className={`mt-4 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Loading notifications...
            </Text>
          </View>
        ) : notifications.length === 0 ? (
          <View className="flex-1 justify-center items-center py-20">
            <Ionicons
              name="notifications-off-outline"
              size={48}
              color={isDark ? '#4B5563' : '#9CA3AF'}
            />
            <Text 
              className={`mt-4 text-lg ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              No notifications yet
            </Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <TouchableOpacity
              key={notification.id}
              onPress={() => markAsRead(notification.id)}
              className={`mx-4 mt-4 rounded-lg ${
                isDark ? 'bg-gray-800' : 'bg-white'
              } ${!notification.read ? 'opacity-100' : 'opacity-80'}`}
              style={styles.notificationCard}
            >
              <View className="flex-row items-start p-4">
                <View 
                  className={`mr-3 p-2 rounded-full ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}
                >
                  <Ionicons
                    name={getIconName(notification.type)}
                    size={24}
                    color={getIconColor(notification.type)}
                  />
                </View>
                <View className="flex-1">
                  <Text 
                    className={`font-semibold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {notification.title}
                  </Text>
                  <Text 
                    className={`mt-1 ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    {notification.message}
                  </Text>
                  <Text 
                    className={`mt-2 text-sm ${
                      isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                  </Text>
                </View>
                {!notification.read && (
                  <View className="h-3 w-3 rounded-full bg-blue-500" />
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
        <View className="h-4" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  scrollContent: {
    flexGrow: 1,
  },
  notificationCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backButton: {
    paddingTop: 44,
  },
});
