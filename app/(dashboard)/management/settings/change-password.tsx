import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import axios from 'axios';
import { getHeaderPaddingTop } from '@/utils/statusBarHeight';

export default function ChangePassword() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      // Validate password fields
      if (!passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword) {
        Alert.alert('Error', 'All fields are required');
        return;
      }

      if (passwords.newPassword.length < 8) {
        Alert.alert('Error', 'New password must be at least 8 characters long');
        return;
      }

      if (passwords.newPassword !== passwords.confirmPassword) {
        Alert.alert('Error', 'New passwords do not match');
        return;
      }

      setIsLoading(true);
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/users/change-password`,
        {
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert('Success', 'Password changed successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Error changing password:', error);
      Alert.alert(
        'Error', 
        error.response?.data?.error || 'Failed to change password. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        className="pb-4"
        style={{ paddingTop: getHeaderPaddingTop() }}
      >
        <View className="flex-row items-center justify-between px-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2 rounded-full"
            style={{ backgroundColor: isDark ? '#374151' : '#F3F4F6' }}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
          <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Change Password
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <View className={`flex-1 px-6 pt-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <View className="space-y-4">
          <View className="space-y-2">
            <Text className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Current Password
            </Text>
            <TextInput
              value={passwords.currentPassword}
              onChangeText={(text) => setPasswords(prev => ({ ...prev, currentPassword: text }))}
              secureTextEntry
              placeholder="Enter current password"
              className={`p-4 rounded-lg ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} border border-gray-200`}
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </View>

          <View className="space-y-2">
            <Text className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              New Password
            </Text>
            <TextInput
              value={passwords.newPassword}
              onChangeText={(text) => setPasswords(prev => ({ ...prev, newPassword: text }))}
              secureTextEntry
              placeholder="Enter new password"
              className={`p-4 rounded-lg ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} border border-gray-200`}
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </View>

          <View className="space-y-2">
            <Text className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Confirm New Password
            </Text>
            <TextInput
              value={passwords.confirmPassword}
              onChangeText={(text) => setPasswords(prev => ({ ...prev, confirmPassword: text }))}
              secureTextEntry
              placeholder="Confirm new password"
              className={`p-4 rounded-lg ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} border border-gray-200`}
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading}
            className={`bg-blue-600 rounded-xl py-4 mt-6 ${isLoading ? 'opacity-70' : ''}`}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-lg">
                Change Password
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
} 