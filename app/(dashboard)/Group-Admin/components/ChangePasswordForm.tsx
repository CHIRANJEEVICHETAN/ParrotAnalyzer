import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import axios from 'axios';
import AuthContext from '../../../context/AuthContext';
import ThemeContext from '../../../context/ThemeContext';

interface ChangePasswordFormProps {
  onSuccess?: () => void;
}

export default function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps) {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === 'dark';

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changing, setChanging] = useState(false);

  const PasswordRequirements = () => (
    <View className="mb-6">
      <Text className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        Password Requirements:
      </Text>
      <View className="space-y-1">
        <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          • Minimum 8 characters long
        </Text>
        <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          • At least one uppercase letter
        </Text>
        <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          • At least one number
        </Text>
        <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          • At least one special character
        </Text>
      </View>
    </View>
  );

  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return minLength && hasUpperCase && hasNumber && hasSpecialChar;
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (!validatePassword(passwordData.newPassword)) {
      Alert.alert('Error', 'Password does not meet requirements');
      return;
    }

    try {
      setChanging(true);
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/change-password`,
        {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Password changed successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      onSuccess?.();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to change password');
    } finally {
      setChanging(false);
    }
  };

  return (
    <View className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
      <PasswordRequirements />
      
      <TextInput
        secureTextEntry
        placeholder="Current Password"
        value={passwordData.currentPassword}
        onChangeText={(text) => setPasswordData(prev => ({
          ...prev,
          currentPassword: text
        }))}
        className={`p-3 rounded-lg mb-4 ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'}`}
        placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
        autoCapitalize="none"
      />

      <TextInput
        secureTextEntry
        placeholder="New Password"
        value={passwordData.newPassword}
        onChangeText={(text) => setPasswordData(prev => ({
          ...prev,
          newPassword: text
        }))}
        className={`p-3 rounded-lg mb-4 ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'}`}
        placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
        autoCapitalize="none"
      />

      <TextInput
        secureTextEntry
        placeholder="Confirm New Password"
        value={passwordData.confirmPassword}
        onChangeText={(text) => setPasswordData(prev => ({
          ...prev,
          confirmPassword: text
        }))}
        className={`p-3 rounded-lg mb-6 ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'}`}
        placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
        autoCapitalize="none"
      />

      <TouchableOpacity
        onPress={handleChangePassword}
        disabled={changing}
        className={`p-4 rounded-lg bg-blue-500 ${changing ? 'opacity-50' : ''}`}
      >
        {changing ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Text className="text-white text-center font-semibold">
            Change Password
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
} 