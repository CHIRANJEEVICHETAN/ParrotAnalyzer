import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../context/ThemeContext';
import { format } from 'date-fns';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  timestamp: Date;
  isRead: boolean;
}

export default function Notifications() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';

  // Mock notifications data
  const [notifications] = React.useState<Notification[]>([
    {
      id: 1,
      title: 'Shift Started',
      message: 'Your shift has started successfully at 9:00 AM',
      type: 'success',
      timestamp: new Date(),
      isRead: false,
    },
    {
      id: 2,
      title: 'Expense Report',
      message: 'Your expense report has been approved',
      type: 'info',
      timestamp: new Date(Date.now() - 3600000),
      isRead: true,
    },
    // Add more mock notifications
  ]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'warning':
        return 'warning';
      default:
        return 'information-circle';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-500';
      case 'warning':
        return 'text-yellow-500';
      default:
        return 'text-blue-500';
    }
  };

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* Header */}
      <View className={`flex-row items-center justify-between p-4 ${
        isDark ? 'bg-gray-800' : 'bg-white'
      }`}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDark ? '#FFFFFF' : '#111827'}
          />
        </TouchableOpacity>
        <Text className={`text-lg font-semibold ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>
          Notifications
        </Text>
        <TouchableOpacity>
          <Ionicons
            name="checkmark-done"
            size={24}
            color={isDark ? '#FFFFFF' : '#111827'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 p-4">
        {notifications.map((notification) => (
          <TouchableOpacity
            key={notification.id}
            className={`mb-4 p-4 rounded-lg ${
              isDark 
                ? (notification.isRead ? 'bg-gray-800' : 'bg-gray-800/90') 
                : (notification.isRead ? 'bg-white' : 'bg-white/90')
            }`}
          >
            <View className="flex-row items-start">
              <View className={`p-2 rounded-full ${
                notification.type === 'success' 
                  ? 'bg-green-100' 
                  : notification.type === 'warning'
                    ? 'bg-yellow-100'
                    : 'bg-blue-100'
              }`}>
                <Ionicons
                  name={getNotificationIcon(notification.type)}
                  size={24}
                  color={
                    notification.type === 'success'
                      ? '#10B981'
                      : notification.type === 'warning'
                        ? '#F59E0B'
                        : '#3B82F6'
                  }
                />
              </View>
              <View className="flex-1 ml-3">
                <Text className={`font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {notification.title}
                </Text>
                <Text className={`mt-1 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {notification.message}
                </Text>
                <Text className={`mt-2 text-sm ${
                  isDark ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  {format(notification.timestamp, 'h:mm a')}
                </Text>
              </View>
              {!notification.isRead && (
                <View className="h-2 w-2 rounded-full bg-blue-500" />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
