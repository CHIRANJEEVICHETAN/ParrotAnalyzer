import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import BottomNav from '../../components/BottomNav';
import { employeeNavItems } from './utils/navigationItems';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { IconProps } from '@expo/vector-icons/build/createIconSet';
type IconName = keyof typeof Ionicons.glyphMap;

interface StatItem {
  label: string;
  value: string;
  icon: IconName;
  color: string;
  description: string;
}

interface ActivityItem {
  type: string;
  title: string;
  description: string;
  time: string;
  icon: IconName;
  color: string;
}

interface ProgressBarProps {
  value: number;
  maxValue: number;
  color: string;
  isDark: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, maxValue, color, isDark }) => {
  const percentage = Math.min((value / maxValue) * 100, 100);
  
  return (
    <View className="relative h-2.5 w-full rounded-full overflow-hidden" 
          style={{ 
            backgroundColor: isDark ? '#374151' : '#E5E7EB',
            shadowColor: color,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 1,
            elevation: 1,
          }}>
      <View 
        className="h-full rounded-full"
        style={{ 
          width: `${percentage}%`,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 3,
          elevation: 2,
        }}
      />
      {percentage > 85 && (
        <View 
          style={{ 
            position: 'absolute',
            right: 2,
            top: '50%',
            transform: [{ translateY: -4 }],
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: 'white',
            shadowColor: color,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.5,
            shadowRadius: 2,
            elevation: 3,
          }} 
        />
      )}
    </View>
  );
};

const CACHE_KEYS = {
  PROFILE_STATS: 'profile_stats',
  PROFILE_ACTIVITIES: 'profile_activities',
  PROFILE_IMAGE: 'profile_image',
  LAST_FETCH: 'profile_last_fetch',
};

const CACHE_DURATION = 5 * 60 * 1000;

export default function Profile() {
  const { theme } = ThemeContext.useTheme();
  const { user, token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalHours: '0',
    expenseCount: '0',
    attendanceRate: '0%',
    completedTasks: '0',
    groupAdminName: null as string | null
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const WORK_HOURS_PER_DAY = 8;
  const WORK_DAYS_PER_MONTH = 22; // Average working days in a month
  const MAX_HOURS_PER_MONTH = WORK_HOURS_PER_DAY * WORK_DAYS_PER_MONTH;
  const MAX_EXPENSES_PER_MONTH = 50;
  const MAX_TASKS_PER_MONTH = 50;

  useEffect(() => {
    if (user?.id) {
      fetchProfileImage();
    }
  }, [user?.id]);

  const fetchProfileImage = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        const cachedImage = await AsyncStorage.getItem(CACHE_KEYS.PROFILE_IMAGE);
        if (cachedImage) {
          setProfileImage(cachedImage);
          return;
        }
      }

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/users/profile-image/${user?.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.image) {
        setProfileImage(response.data.image);
        await AsyncStorage.setItem(CACHE_KEYS.PROFILE_IMAGE, response.data.image);
      }
    } catch (error) {
      console.error('Error fetching profile image:', error);
    }
  };

  const fetchProfileStats = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        const lastFetch = await AsyncStorage.getItem(CACHE_KEYS.LAST_FETCH);
        const cachedStats = await AsyncStorage.getItem(CACHE_KEYS.PROFILE_STATS);
        const cachedActivities = await AsyncStorage.getItem(CACHE_KEYS.PROFILE_ACTIVITIES);

        if (lastFetch && cachedStats && cachedActivities) {
          const timeSinceLastFetch = Date.now() - parseInt(lastFetch);
          if (timeSinceLastFetch < CACHE_DURATION) {
            setStats(JSON.parse(cachedStats));
            setActivities(JSON.parse(cachedActivities));
            setIsLoading(false);
            return;
          }
        }
      }

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/employee/profile-stats`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const formattedStats = response.data.stats;
      const formattedActivities = response.data.recentActivities.map((activity: any) => ({
        type: activity.type,
        title: activity.title,
        description: activity.description,
        time: format(new Date(activity.time), 'MMM dd, yyyy'),
        icon: getActivityIcon(activity.type),
        color: getActivityColor(activity.type)
      }));

      setStats(formattedStats);
      setActivities(formattedActivities);

      await Promise.all([
        AsyncStorage.setItem(CACHE_KEYS.PROFILE_STATS, JSON.stringify(formattedStats)),
        AsyncStorage.setItem(CACHE_KEYS.PROFILE_ACTIVITIES, JSON.stringify(formattedActivities)),
        AsyncStorage.setItem(CACHE_KEYS.LAST_FETCH, Date.now().toString())
      ]);
    } catch (error) {
      console.error('Error fetching profile stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileStats();
  }, []);

  const getActivityIcon = (type: string): IconName => {
    switch (type) {
      case 'shift': return 'time-outline';
      case 'expense': return 'receipt-outline';
      case 'task': return 'checkmark-circle-outline';
      default: return 'ellipse-outline';
    }
  };

  const getActivityColor = (type: string): string => {
    switch (type) {
      case 'shift': return '#10B981';
      case 'expense': return '#F59E0B';
      case 'task': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const statItems: StatItem[] = [
    { 
      label: 'Total Hours', 
      value: stats.totalHours, 
      icon: 'time-outline' as IconName, 
      color: '#10B981',
      description: 'Hours worked this month'
    },
    { 
      label: 'Expenses', 
      value: stats.expenseCount, 
      icon: 'receipt-outline' as IconName, 
      color: '#F59E0B',
      description: 'Expense claims submitted'
    },
    { 
      label: 'Attendance', 
      value: stats.attendanceRate, 
      icon: 'calendar-outline' as IconName, 
      color: '#8B5CF6',
      description: 'Monthly attendance rate'
    },
    { 
      label: 'Tasks', 
      value: stats.completedTasks, 
      icon: 'checkmark-circle-outline' as IconName, 
      color: '#3B82F6',
      description: 'Tasks completed'
    },
  ];

  const formatRoleName = (role?: string) => {
    if (!role) return '';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchProfileImage(true),
        fetchProfileStats(true)
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <View className="flex-1">
      {/* Header */}
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
            Profile
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView 
        className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[isDark ? '#60A5FA' : '#3B82F6']}
            tintColor={isDark ? '#60A5FA' : '#3B82F6'}
            progressBackgroundColor={isDark ? '#374151' : '#F3F4F6'}
          />
        }
      >
        {/* Profile Info */}
        <View className={`m-4 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={styles.card}>
          <View className="items-center mb-4">
            {profileImage ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${profileImage}` }}
                className="w-24 h-24 rounded-full mb-3"
                style={styles.profileImage}
              />
            ) : (
              <View className="w-24 h-24 rounded-full bg-blue-500 items-center justify-center mb-3" style={styles.profileImage}>
                <Text className="text-white text-3xl font-bold">
                  {user?.name?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {user?.name}
            </Text>
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {user?.email}
            </Text>
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {user?.phone}
            </Text>
            <View className="flex-col items-center mt-2">
              <View className={`px-3 py-1 rounded-full mb-2 ${isDark ? 'bg-blue-900' : 'bg-blue-100'}`}>
                <Text className={isDark ? 'text-blue-300' : 'text-blue-800'}>
                  {formatRoleName(user?.role)}
                </Text>
              </View>
              {stats.groupAdminName && (
                <View className={`px-3 py-1 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <Text className={isDark ? 'text-gray-300' : 'text-gray-800'}>
                    Reports to: {stats.groupAdminName}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="flex-row flex-wrap px-2">
          {statItems.map((stat, index) => (
            <View key={index} className="w-1/2 p-2">
              <View 
                className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                style={styles.card}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className={`p-2 rounded-full opacity-20`} style={{ backgroundColor: stat.color }}>
                    <Ionicons name={stat.icon} size={20} color={stat.color} />
                  </View>
                  <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {stat.value}
                  </Text>
                </View>
                <Text className={`font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {stat.label}
                </Text>
                <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {stat.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* My Expenses Section */}
        <View className="mx-4 mt-3">
          <TouchableOpacity
            onPress={() => router.push('/(dashboard)/employee/myExpenses')}
            style={[styles.card]}
            className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          >
            <View className="flex-row items-center">
              <View 
                style={[
                  styles.iconContainer,
                  { backgroundColor: isDark ? '#374151' : '#F3F4F6' }
                ]}
                className="rounded-full items-center justify-center"
              >
                <Ionicons
                  name="receipt-outline"
                  size={24}
                  color={isDark ? '#60A5FA' : '#3B82F6'}
                />
              </View>
              <View className="ml-3 flex-1">
                <Text
                  className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}
                >
                  My Expenses
                </Text>
                <Text
                  className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                >
                  Track your expense claims
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={24}
                color={isDark ? '#6B7280' : '#9CA3AF'}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Progress Bars Section */}
        <View className={`mx-4 mt-4 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={styles.card}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Monthly Progress
          </Text>
          
          <View className="space-y-4">
            {/* Hours Progress */}
            <View>
              <View className="flex-row justify-between mb-2">
                <Text className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Working Hours
                </Text>
                <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {stats.totalHours}/{MAX_HOURS_PER_MONTH}h
                </Text>
              </View>
              <ProgressBar 
                value={Number(stats.totalHours)} 
                maxValue={MAX_HOURS_PER_MONTH}
                color="#10B981"
                isDark={isDark}
              />
            </View>

            {/* Expenses Progress */}
            <View>
              <View className="flex-row justify-between mb-2">
                <Text className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Expenses Claims
                </Text>
                <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {stats.expenseCount}/{MAX_EXPENSES_PER_MONTH}
                </Text>
              </View>
              <ProgressBar 
                value={Number(stats.expenseCount)} 
                maxValue={MAX_EXPENSES_PER_MONTH}
                color="#F59E0B"
                isDark={isDark}
              />
            </View>

            {/* Attendance Progress */}
            <View>
              <View className="flex-row justify-between mb-2">
                <Text className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Attendance Rate
                </Text>
                <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {stats.attendanceRate}
                </Text>
              </View>
              <ProgressBar 
                value={Number(stats.attendanceRate.replace('%', ''))} 
                maxValue={100}
                color="#8B5CF6"
                isDark={isDark}
              />
            </View>

            {/* Tasks Progress */}
            <View>
              <View className="flex-row justify-between mb-2">
                <Text className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Completed Tasks
                </Text>
                <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {stats.completedTasks}/{MAX_TASKS_PER_MONTH}
                </Text>
              </View>
              <ProgressBar 
                value={Number(stats.completedTasks)} 
                maxValue={MAX_TASKS_PER_MONTH}
                color="#3B82F6"
                isDark={isDark}
              />
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View className={`m-4 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={styles.card}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Recent Activity
          </Text>
          {isLoading ? (
            <ActivityIndicator color={isDark ? '#60A5FA' : '#3B82F6'} />
          ) : activities.length === 0 ? (
            <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No recent activities
            </Text>
          ) : (
            activities.map((activity, index) => (
              <View key={index} className="mb-4 last:mb-0">
                <View className="flex-row items-start">
                  <View 
                    className={`p-2 rounded-full`} 
                    style={{ backgroundColor: `${activity.color}20` }}
                  >
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
            ))
          )}
        </View>
      </ScrollView>

      <BottomNav items={employeeNavItems} />
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
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  profileImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export const clearProfileCache = async () => {
  try {
    const keys = Object.values(CACHE_KEYS);
    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    console.error('Error clearing profile cache:', error);
  }
};
