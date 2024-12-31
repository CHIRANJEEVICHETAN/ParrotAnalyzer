import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, StatusBar as RNStatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import { StyleSheet } from 'react-native';

// Define notification types
interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === 'dark';

  // Sample notifications data
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'info',
      title: 'New Employee Added',
      description: 'A new employee has been added to your organization.',
      timestamp: '2 hours ago',
      isRead: false,
    },
    {
      id: '2',
      type: 'warning',
      title: 'System Maintenance',
      description: 'Scheduled maintenance in 24 hours. Please save your work.',
      timestamp: '5 hours ago',
      isRead: false,
    },
    {
      id: '3',
      type: 'success',
      title: 'Report Generated',
      description: 'Monthly expense report has been generated successfully.',
      timestamp: '1 day ago',
      isRead: true,
    },
    {
      id: '4',
      type: 'error',
      title: 'Failed Login Attempt',
      description: 'Multiple failed login attempts detected from unknown device.',
      timestamp: '2 days ago',
      isRead: true,
    },
  ]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'info':
        return 'info';
      case 'warning':
        return 'warning';
      case 'success':
        return 'check-circle';
      case 'error':
        return 'error';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'info':
        return '#3B82F6';
      case 'warning':
        return '#F59E0B';
      case 'success':
        return '#10B981';
      case 'error':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, isRead: true }))
    );
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, isRead: true } : notification
      )
    );
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#111827' : '#F3F4F6' }}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        style={[styles.header, { 
          paddingTop: Platform.OS === 'ios' ? RNStatusBar.currentHeight || 44 : RNStatusBar.currentHeight || 0 
        }]}
      >
        <View className="px-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => router.back()}
                className="mr-4 p-2 rounded-full"
                style={[styles.backButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}
              >
                <MaterialIcons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
              </TouchableOpacity>
              <View>
                <View className="flex-row items-center">
                  <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Notifications
                  </Text>
                  {notifications.some(n => !n.isRead) && (
                    <View className="ml-2 px-2 py-1 bg-blue-500 rounded-full">
                      <Text className="text-white text-xs font-medium">
                        {notifications.filter(n => !n.isRead).length}
                      </Text>
                    </View>
                  )}
                </View>
                <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  Stay updated with important alerts
                </Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Action Buttons */}
      <View className="px-4 py-3 flex-row justify-between">
        <TouchableOpacity
          onPress={markAllAsRead}
          className={`flex-1 flex-row items-center justify-center p-3 rounded-lg mr-2 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}
          style={styles.actionButton}
        >
          <MaterialIcons name="done-all" size={20} color="#3B82F6" />
          <Text className="ml-2 font-medium text-blue-500">
            Mark all as read
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={clearAll}
          className={`flex-1 flex-row items-center justify-center p-3 rounded-lg ml-2 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}
          style={styles.actionButton}
        >
          <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
          <Text className="ml-2 font-medium text-red-500">
            Clear all
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <ScrollView 
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
      >
        {notifications.map((notification) => (
          <TouchableOpacity
            key={notification.id}
            onPress={() => markAsRead(notification.id)}
            className={`mb-3 p-4 rounded-xl ${
              notification.isRead
                ? isDark ? 'bg-gray-800' : 'bg-white'
                : isDark ? 'bg-gray-700' : 'bg-blue-50'
            }`}
            style={styles.notificationCard}
          >
            <View className="flex-row items-start">
              <View
                style={{
                  backgroundColor: `${getNotificationColor(notification.type)}20`,
                  padding: 8,
                  borderRadius: 12,
                }}
              >
                <MaterialIcons
                  name={getNotificationIcon(notification.type)}
                  size={24}
                  color={getNotificationColor(notification.type)}
                />
              </View>
              <View className="flex-1 ml-3">
                <View className="flex-row items-center justify-between">
                  <Text className={`font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {notification.title}
                  </Text>
                </View>
                <Text className={`mt-1 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {notification.description}
                </Text>
                <Text className={`mt-2 text-sm ${
                  isDark ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  {notification.timestamp}
                </Text>
              </View>
              {!notification.isRead && (
                <View className="w-2 h-2 rounded-full bg-blue-500" />
              )}
            </View>
          </TouchableOpacity>
        ))}
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
    paddingBottom: 14,
  },
  backButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  markAllButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});
