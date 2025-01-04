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
import { LinearGradient } from 'expo-linear-gradient';

interface PasswordValidation {
  hasMinLength: boolean;
  hasMaxLength: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

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

    if (!isPasswordValid(passwordValidation)) {
      Alert.alert('Error', 'Password does not meet security requirements');
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
        { text: 'OK', onPress: () => router.replace('/(auth)/signin') }
      ]);
    } catch (error) {
      console.error('Error resetting password:', error);
      Alert.alert('Error', 'Failed to reset password. Please try again.');
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
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#111827' : '#F9FAFB'}
      />

      <LinearGradient
        colors={isDark ? ['#111827', '#1F2937'] : ['#F9FAFB', '#F3F4F6']}
        className="flex-1"
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