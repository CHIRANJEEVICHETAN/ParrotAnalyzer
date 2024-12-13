import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import { format } from 'date-fns';

export default function Profile() {
  const { theme } = ThemeContext.useTheme();
  const { user } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  // Mock data for stats and activities
  const stats = [
    { label: 'Total Hours', value: '180.5', icon: 'time-outline', color: '#10B981' },
    { label: 'Tasks Done', value: '45', icon: 'checkmark-circle-outline', color: '#3B82F6' },
    { label: 'Attendance', value: '96%', icon: 'calendar-outline', color: '#8B5CF6' },
    { label: 'Expenses', value: '12', icon: 'receipt-outline', color: '#F59E0B' },
  ];

  const recentActivity = [
    { 
      type: 'shift',
      title: 'Completed Shift',
      description: 'Morning Shift - 8 hours',
      time: '2 days ago',
      icon: 'time-outline',
      color: '#10B981'
    },
    {
      type: 'expense',
      title: 'Expense Submitted',
      description: 'Travel Expenses - ₹1,200',
      time: '3 days ago',
      icon: 'receipt-outline',
      color: '#F59E0B'
    },
    {
      type: 'leave',
      title: 'Leave Approved',
      description: 'Casual Leave - 2 days',
      time: '1 week ago',
      icon: 'calendar-outline',
      color: '#8B5CF6'
    }
  ];

  const achievements = [
    { title: 'Perfect Attendance', description: '30 days streak', icon: 'trophy-outline', color: '#F59E0B' },
    { title: 'Task Master', description: 'Completed 50 tasks', icon: 'ribbon-outline', color: '#3B82F6' },
    { title: 'Early Bird', description: '10 early check-ins', icon: 'sunny-outline', color: '#10B981' },
  ];

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* Header */}
      <View className={`p-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <View className="flex-row items-center justify-between">
          <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Profile
          </Text>
          <TouchableOpacity onPress={() => router.push('/(dashboard)/employee/employeeSettings')}>
            <Ionicons
              name="settings-outline"
              size={24}
              color={isDark ? '#FFFFFF' : '#111827'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1">
        {/* Stats Grid */}
        <View className="flex-row flex-wrap p-4">
          {stats.map((stat, index) => (
            <View key={index} className="w-1/2 p-2">
              <View className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                <View className="flex-row items-center mb-2">
                  <View className={`p-2 rounded-full opacity-20`} style={{ backgroundColor: stat.color }}>
                    <Ionicons name={stat.icon} size={20} color={stat.color} />
                  </View>
                  <Text className={`ml-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {stat.label}
                  </Text>
                </View>
                <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {stat.value}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Achievements */}
        <View className={`mx-4 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Achievements
          </Text>
          {achievements.map((achievement, index) => (
            <View key={index} className="flex-row items-center mb-4">
              <View className={`p-3 rounded-full opacity-20`} style={{ backgroundColor: achievement.color }}>
                <Ionicons name={achievement.icon} size={24} color={achievement.color} />
              </View>
              <View className="ml-3">
                <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {achievement.title}
                </Text>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {achievement.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Recent Activity */}
        <View className={`m-4 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Recent Activity
          </Text>
          {recentActivity.map((activity, index) => (
            <View key={index} className="mb-4 last:mb-0">
              <View className="flex-row items-start">
                <View className={`p-2 rounded-full opacity-20`} style={{ backgroundColor: activity.color }}>
                  <Ionicons name={activity.icon} size={20} color={activity.color} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {activity.title}
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {activity.description}
                  </Text>
                  <Text className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {activity.time}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
