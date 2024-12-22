import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

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

export default function Profile() {
  const { theme } = ThemeContext.useTheme();
  const { user, token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchProfileImage();
    }
  }, [user?.id]);

  const fetchProfileImage = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/users/profile-image/${user?.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.image) {
        setProfileImage(response.data.image);
      }
    } catch (error) {
      console.error('Error fetching profile image:', error);
    }
  };

  const stats: StatItem[] = [
    { 
      label: 'Total Hours', 
      value: '180.5', 
      icon: 'time-outline', 
      color: '#10B981',
      description: 'Hours worked this month'
    },
    { 
      label: 'Expenses', 
      value: '12', 
      icon: 'receipt-outline', 
      color: '#F59E0B',
      description: 'Expense claims submitted'
    },
    { 
      label: 'Attendance', 
      value: '96%', 
      icon: 'calendar-outline', 
      color: '#8B5CF6',
      description: 'Monthly attendance rate'
    },
    { 
      label: 'Tasks', 
      value: '45', 
      icon: 'checkmark-circle-outline', 
      color: '#3B82F6',
      description: 'Tasks completed'
    },
  ];

  const recentActivity: ActivityItem[] = [
    { 
      type: 'shift',
      title: 'Shift Completed',
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
      type: 'attendance',
      title: 'Early Check-in',
      description: 'Checked in at 8:45 AM',
      time: '4 days ago',
      icon: 'enter-outline',
      color: '#8B5CF6'
    }
  ];

  const formatRoleName = (role?: string) => {
    if (!role) return '';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

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
            <View className="flex-row items-center mt-2">
              <View className={`px-3 py-1 rounded-full ${isDark ? 'bg-blue-900' : 'bg-blue-100'}`}>
                <Text className={isDark ? 'text-blue-300' : 'text-blue-800'}>
                  {formatRoleName(user?.role)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="flex-row flex-wrap px-2">
          {stats.map((stat, index) => (
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

        {/* Recent Activity */}
        <View className={`m-4 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={styles.card}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Recent Activity
          </Text>
          {recentActivity.map((activity, index) => (
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
          ))}
        </View>
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
  }
});
