import React, { useState, useRef } from 'react';
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
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../context/ThemeContext';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

interface PasswordValidation {
  hasMinLength: boolean;
  hasMaxLength: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

const API_URL = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

const validatePassword = (password: string): PasswordValidation => {
  return {
    hasMinLength: password.length >= 8,
    hasMaxLength: password.length <= 16,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
};

const ErrorMessage: React.FC<{ message: string; isDark: boolean }> = ({ message, isDark }) => {
  if (!message) return null;
  
  return (
    <View className="mt-2 mb-4 p-4 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
      <View className="flex-row items-center">
        <Ionicons
          name="alert-circle"
          size={20}
          color={isDark ? '#FCA5A5' : '#DC2626'}
          style={{ marginRight: 8 }}
        />
        <Text className={`flex-1 ${isDark ? 'text-red-200' : 'text-red-700'}`}>
          {message}
        </Text>
      </View>
    </View>
  );
};

export default function ForgotPassword() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';
  const scrollViewRef = useRef<ScrollView>(null);

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'otp' | 'newPassword'>('email');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation>({
    hasMinLength: false,
    hasMaxLength: true,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  const isPasswordValid = (validation: PasswordValidation): boolean => {
    return Object.values(validation).every(value => value === true);
  };

  const handleSendOTP = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/auth/forgot-password`, {
        email,
      });

      setStep('otp');
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          setError(`No account found with this email address` + `\n` + 'Please contact administrator');
        } else if (error.response?.data?.error) {
          setError(error.response.data.error);
        } else if (!error.response) {
          setError('Network error. Please check your internet connection');
        } else {
          setError('An unexpected error occurred. Please try again');
        }
      } else {
        setError('Failed to send verification code. Please try again');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      setError('Please enter the verification code');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/auth/verify-otp`, {
        email,
        otp,
      });

      setStep('newPassword');
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.response?.data?.error) {
          setError(error.response.data.error);
        } else if (!error.response) {
          setError('Network error. Please check your internet connection');
        } else {
          setError('Invalid or expired verification code');
        }
      } else {
        setError('Failed to verify code. Please try again');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all password fields');
      return;
    }

    if (!isPasswordValid(passwordValidation)) {
      setError('Password does not meet the security requirements');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/auth/reset-password`, {
        email,
        otp,
        newPassword,
      });

      router.replace('/(auth)/signin');
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.response?.data?.error) {
          setError(error.response.data.error);
        } else if (!error.response) {
          setError('Network error. Please check your internet connection');
        } else {
          setError('Failed to reset password. Please try again');
        }
      } else {
        setError('An unexpected error occurred. Please try again');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const PasswordRequirements = () => (
    <View className="mt-2 mb-4">
      {Object.entries(passwordValidation).map(([key, isValid]) => (
        <View key={key} className="flex-row items-center mb-1">
          <Ionicons
            name={isValid ? 'checkmark-circle' : 'close-circle'}
            size={16}
            color={isValid ? '#10B981' : '#EF4444'}
            style={{ marginRight: 8 }}
          />
          <Text className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {key === 'hasMinLength' && 'Minimum 8 characters'}
            {key === 'hasMaxLength' && 'Maximum 16 characters'}
            {key === 'hasUpperCase' && 'At least one uppercase letter'}
            {key === 'hasLowerCase' && 'At least one lowercase letter'}
            {key === 'hasNumber' && 'At least one number'}
            {key === 'hasSpecialChar' && 'At least one special character'}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 80}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#111827' : '#F9FAFB'}
      />

      <LinearGradient
        colors={isDark ? ['#111827', '#1F2937'] : ['#F9FAFB', '#F3F4F6']}
        className="flex-1"
      >
        <ScrollView 
          ref={scrollViewRef}
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View className="flex-1 p-6">
            {/* Header */}
            <View className="mb-8">
              <TouchableOpacity
                onPress={() => router.back()}
                className="w-12 h-12 items-center justify-center rounded-full"
                style={[styles.backButton, { backgroundColor: isDark ? 'rgba(55, 65, 81, 0.8)' : 'rgba(243, 244, 246, 0.8)' }]}
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={isDark ? '#FFFFFF' : '#111827'}
                />
              </TouchableOpacity>

              <Text
                className={`text-3xl font-bold mt-6 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Reset Password
              </Text>
              <Text
                className={`mt-3 text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
              >
                {step === 'email'
                  ? 'Enter your email to receive a password reset code'
                  : step === 'otp'
                  ? 'Enter the verification code sent to your email'
                  : 'Create a new password for your account'}
              </Text>
            </View>

            {/* Error Message */}
            <ErrorMessage message={error} isDark={isDark} />

            {/* Form */}
            <View className="space-y-8">
              {step === 'email' && (
                <View style={styles.inputContainer}>
                  <Text
                    className={`text-sm font-medium mb-2 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Email Address
                  </Text>
                  <View style={[
                    styles.inputWrapper,
                    { backgroundColor: isDark ? 'rgba(55, 65, 81, 0.8)' : 'rgba(255, 255, 255, 0.8)' }
                  ]}>
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={isDark ? '#9CA3AF' : '#6B7280'}
                      style={{ marginRight: 10 }}
                    />
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="Enter your email"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      className={`flex-1 ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}
                      placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                    />
                  </View>
                </View>
              )}

              {step === 'otp' && (
                <View style={styles.inputContainer}>
                  <Text
                    className={`text-sm font-medium mb-2 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Verification Code
                  </Text>
                  <View style={[
                    styles.inputWrapper,
                    { backgroundColor: isDark ? 'rgba(55, 65, 81, 0.8)' : 'rgba(255, 255, 255, 0.8)' }
                  ]}>
                    <Ionicons
                      name="key-outline"
                      size={20}
                      color={isDark ? '#9CA3AF' : '#6B7280'}
                      style={{ marginRight: 10 }}
                    />
                    <TextInput
                      value={otp}
                      onChangeText={setOtp}
                      placeholder="Enter OTP"
                      keyboardType="number-pad"
                      className={`flex-1 ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}
                      placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                    />
                  </View>
                </View>
              )}

              {step === 'newPassword' && (
                <>
                  <View style={styles.inputContainer}>
                    <Text
                      className={`text-sm font-medium mb-2 ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      New Password
                    </Text>
                    <View style={[
                      styles.inputWrapper,
                      { backgroundColor: isDark ? 'rgba(55, 65, 81, 0.8)' : 'rgba(255, 255, 255, 0.8)' }
                    ]}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color={isDark ? '#9CA3AF' : '#6B7280'}
                        style={{ marginRight: 10 }}
                      />
                      <TextInput
                        value={newPassword}
                        onChangeText={(text) => {
                          setNewPassword(text);
                          setPasswordValidation(validatePassword(text));
                        }}
                        placeholder="Enter new password"
                        secureTextEntry
                        maxLength={16}
                        className={`flex-1 ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                        placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                      />
                    </View>
                    <PasswordRequirements />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text
                      className={`text-sm font-medium mb-2 ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      Confirm Password
                    </Text>
                    <View style={[
                      styles.inputWrapper,
                      { backgroundColor: isDark ? 'rgba(55, 65, 81, 0.8)' : 'rgba(255, 255, 255, 0.8)' }
                    ]}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color={isDark ? '#9CA3AF' : '#6B7280'}
                        style={{ marginRight: 10 }}
                      />
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirm new password"
                        secureTextEntry
                        className={`flex-1 ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                        placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                        onFocus={() => {
                          setTimeout(() => {
                            scrollViewRef.current?.scrollToEnd({ animated: true });
                          }, 100);
                        }}
                      />
                    </View>
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
                className={`py-4 rounded-xl mt-8 ${
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
          
          {/* Add extra padding at the bottom for keyboard */}
          <View style={{ paddingBottom: 120 }} />
        </ScrollView>
      </LinearGradient>
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
    backdropFilter: 'blur(10px)',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  button: {
    elevation: 4,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
});