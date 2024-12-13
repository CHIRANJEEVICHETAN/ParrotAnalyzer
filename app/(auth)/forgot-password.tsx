import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../context/ThemeContext';
import axios from 'axios';

export default function ForgotPassword() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'otp' | 'newPassword'>('email');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSendOTP = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/auth/forgot-password`, {
        email,
      });

      Alert.alert('Success', 'OTP has been sent to your email');
      setStep('otp');
    } catch (error) {
      console.error('Error sending OTP:', error);
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      Alert.alert('Error', 'Please enter the OTP');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/auth/verify-otp`, {
        email,
        otp,
      });

      setStep('newPassword');
    } catch (error) {
      console.error('Error verifying OTP:', error);
      Alert.alert('Error', 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/auth/reset-password`, {
        email,
        otp,
        newPassword,
      });

      Alert.alert('Success', 'Password has been reset successfully', [
        { text: 'OK', onPress: () => router.replace('/login') }
      ]);
    } catch (error) {
      console.error('Error resetting password:', error);
      Alert.alert('Error', 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#111827' : '#F9FAFB'}
      />

      <View className="flex-1 p-6">
        {/* Header */}
        <View className="mb-8">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full"
            style={[styles.backButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? '#FFFFFF' : '#111827'}
            />
          </TouchableOpacity>

          <Text
            className={`text-2xl font-bold mt-6 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Reset Password
          </Text>
          <Text
            className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
          >
            {step === 'email'
              ? 'Enter your email to receive a password reset code'
              : step === 'otp'
              ? 'Enter the verification code sent to your email'
              : 'Create a new password'}
          </Text>
        </View>

        {/* Form */}
        <View className="space-y-6">
          {step === 'email' && (
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                Email Address
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                className={`p-4 rounded-lg ${
                  isDark
                    ? 'bg-gray-800 text-white'
                    : 'bg-white text-gray-900'
                }`}
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                style={styles.input}
              />
            </View>
          )}

          {step === 'otp' && (
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                Verification Code
              </Text>
              <TextInput
                value={otp}
                onChangeText={setOtp}
                placeholder="Enter OTP"
                keyboardType="number-pad"
                className={`p-4 rounded-lg ${
                  isDark
                    ? 'bg-gray-800 text-white'
                    : 'bg-white text-gray-900'
                }`}
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                style={styles.input}
              />
            </View>
          )}

          {step === 'newPassword' && (
            <>
              <View>
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  New Password
                </Text>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  secureTextEntry
                  className={`p-4 rounded-lg ${
                    isDark
                      ? 'bg-gray-800 text-white'
                      : 'bg-white text-gray-900'
                  }`}
                  placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                  style={styles.input}
                />
              </View>

              <View>
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Confirm Password
                </Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  secureTextEntry
                  className={`p-4 rounded-lg ${
                    isDark
                      ? 'bg-gray-800 text-white'
                      : 'bg-white text-gray-900'
                  }`}
                  placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                  style={styles.input}
                />
              </View>
            </>
          )}

          <TouchableOpacity
            onPress={() => {
              if (step === 'email') handleSendOTP();
              else if (step === 'otp') handleVerifyOTP();
              else handleResetPassword();
            }}
            disabled={isLoading}
            className={`py-4 rounded-lg ${
              isLoading ? 'opacity-50' : ''
            }`}
            style={[styles.button, { backgroundColor: '#3B82F6' }]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white text-center font-semibold text-lg">
                {step === 'email'
                  ? 'Send Code'
                  : step === 'otp'
                  ? 'Verify Code'
                  : 'Reset Password'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  input: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  button: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});