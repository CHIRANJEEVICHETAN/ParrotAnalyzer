import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import axios from 'axios';
import CustomModal from '../../shared/components/customModal';

interface PasswordValidation {
  minLength: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  hasNoSpaces: boolean;
  matchesConfirm: boolean;
}

export default function ChangePassword() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changing, setChanging] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [validation, setValidation] = useState<PasswordValidation>({
    minLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
    hasNoSpaces: false,
    matchesConfirm: false,
  });

  // Modal states
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  const validatePassword = (password: string, confirmPassword: string) => {
    const newValidation: PasswordValidation = {
      minLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      hasNoSpaces: !/\s/.test(password),
      matchesConfirm: password === confirmPassword && password !== '',
    };
    setValidation(newValidation);
    return Object.values(newValidation).every(Boolean);
  };

  const handlePasswordChange = (field: string, value: string) => {
    const newPasswordData = {
      ...passwordData,
      [field]: value,
    };
    setPasswordData(newPasswordData);
    
    if (field === 'newPassword') {
      setShowSuggestions(true);
      validatePassword(value, newPasswordData.confirmPassword);
      
      // Check if new password matches current password
      if (value === passwordData.currentPassword && value !== '') {
        setModalMessage('This password is already in use. Please choose a different password.');
        setWarningModalVisible(true);
      }
    } else if (field === 'confirmPassword') {
      validatePassword(newPasswordData.newPassword, value);
    }
  };

  const handleChangePassword = async () => {
    if (!validatePassword(passwordData.newPassword, passwordData.confirmPassword)) {
      setModalMessage('Please ensure all password requirements are met');
      setErrorModalVisible(true);
      return;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      setModalMessage('New password must be different from current password');
      setErrorModalVisible(true);
      return;
    }

    try {
      setChanging(true);
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/users/change-password`,
        {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setModalMessage('Your password has been changed successfully');
      setSuccessModalVisible(true);
    } catch (error: any) {
      setModalMessage(error.response?.data?.message || 'Failed to change password');
      setErrorModalVisible(true);
    } finally {
      setChanging(false);
    }
  };

  const PasswordRequirements = () => (
    <View className="mb-8 p-4 rounded-lg" style={{ backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }}>
      <Text className={`text-base font-semibold mb-3 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
        Password Requirements:
      </Text>
      <View className="space-y-2">
        <View className="flex-row items-center">
          <View className={`w-2 h-2 rounded-full mr-2 ${validation.minLength ? 'bg-green-500' : 'bg-gray-400'}`} />
          <Text className={`text-sm ${validation.minLength ? 'text-green-500' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Minimum 8 characters long
          </Text>
        </View>
        <View className="flex-row items-center">
          <View className={`w-2 h-2 rounded-full mr-2 ${validation.hasUpperCase ? 'bg-green-500' : 'bg-gray-400'}`} />
          <Text className={`text-sm ${validation.hasUpperCase ? 'text-green-500' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            At least one uppercase letter
          </Text>
        </View>
        <View className="flex-row items-center">
          <View className={`w-2 h-2 rounded-full mr-2 ${validation.hasLowerCase ? 'bg-green-500' : 'bg-gray-400'}`} />
          <Text className={`text-sm ${validation.hasLowerCase ? 'text-green-500' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            At least one lowercase letter
          </Text>
        </View>
        <View className="flex-row items-center">
          <View className={`w-2 h-2 rounded-full mr-2 ${validation.hasNumber ? 'bg-green-500' : 'bg-gray-400'}`} />
          <Text className={`text-sm ${validation.hasNumber ? 'text-green-500' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            At least one number
          </Text>
        </View>
        <View className="flex-row items-center">
          <View className={`w-2 h-2 rounded-full mr-2 ${validation.hasSpecialChar ? 'bg-green-500' : 'bg-gray-400'}`} />
          <Text className={`text-sm ${validation.hasSpecialChar ? 'text-green-500' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            At least one special character (!@#$%^&*)
          </Text>
        </View>
        <View className="flex-row items-center">
          <View className={`w-2 h-2 rounded-full mr-2 ${validation.hasNoSpaces ? 'bg-green-500' : 'bg-gray-400'}`} />
          <Text className={`text-sm ${validation.hasNoSpaces ? 'text-green-500' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            No spaces allowed
          </Text>
        </View>
        <View className="flex-row items-center">
          <View className={`w-2 h-2 rounded-full mr-2 ${validation.matchesConfirm ? 'bg-green-500' : 'bg-gray-400'}`} />
          <Text className={`text-sm ${validation.matchesConfirm ? 'text-green-500' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Passwords must match
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: isDark ? "#111827" : "#F3F4F6" }}
    >
      <StatusBar
        backgroundColor={isDark ? "#1F2937" : "#FFFFFF"}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      {/* Header */}
      <View
        className={`${isDark ? "bg-gray-800" : "bg-white"}`}
        style={styles.header}
      >
        <View className="flex-row items-center justify-between px-4 pt-3 pb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className={`p-2 rounded-full ${
              isDark ? "bg-gray-700" : "bg-gray-100"
            }`}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? "#FFFFFF" : "#111827"}
            />
          </TouchableOpacity>
          <Text
            className={`text-xl font-semibold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Change Password
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1">
          <View className="p-4">
            <View
              className={`p-6 rounded-xl ${
                isDark ? "bg-gray-800" : "bg-white"
              }`}
              style={styles.card}
            >
              <PasswordRequirements />

              <View className="space-y-8">
                {/* Current Password */}
                <View>
                  <Text
                    className={`text-base font-medium ${
                      isDark ? "text-gray-200" : "text-gray-800"
                    }`}
                  >
                    Current Password
                  </Text>
                  <View className="relative">
                    <TextInput
                      className={`p-4 mb-3 rounded-lg border ${
                        isDark
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300 text-gray-900"
                      }`}
                      secureTextEntry={true}
                      value={passwordData.currentPassword}
                      onChangeText={(value) =>
                        handlePasswordChange("currentPassword", value)
                      }
                      placeholder="Enter current password"
                      placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
                    />
                  </View>
                </View>

                {/* New Password */}
                <View>
                  <Text
                    className={`text-base font-medium ${
                      isDark ? "text-gray-200" : "text-gray-800"
                    }`}
                  >
                    New Password
                  </Text>
                  <View className="relative">
                    <TextInput
                      className={`p-4 pr-12 mb-3 rounded-lg border ${
                        isDark
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300 text-gray-900"
                      }`}
                      secureTextEntry={!showNewPassword}
                      value={passwordData.newPassword}
                      onChangeText={(value) =>
                        handlePasswordChange("newPassword", value)
                      }
                      placeholder="Enter new password"
                      placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
                    />
                    <TouchableOpacity
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                      onPress={() => setShowNewPassword(!showNewPassword)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name={showNewPassword ? "eye-off" : "eye"}
                        size={20}
                        color={isDark ? "#9CA3AF" : "#6B7280"}
                      />
                    </TouchableOpacity>
                  </View>
                  {showSuggestions &&
                    passwordData.newPassword.length > 0 &&
                    (!validation.minLength ||
                      !validation.hasUpperCase ||
                      !validation.hasLowerCase ||
                      !validation.hasNumber ||
                      !validation.hasSpecialChar ||
                      !validation.hasNoSpaces) && (
                      <View className="mt-3">
                        <View
                          className={`p-3 rounded-lg ${
                            isDark ? "bg-gray-800" : "bg-white"
                          } shadow-lg border ${
                            isDark ? "border-red-900" : "border-red-200"
                          }`}
                          style={{
                            borderWidth: 1,
                          }}
                        >
                          <View className="flex-row items-center mb-2">
                            <Ionicons
                              name="alert-circle"
                              size={20}
                              color={isDark ? "#EF4444" : "#DC2626"}
                            />
                            <Text
                              className={`text-sm font-medium ml-2 ${
                                isDark ? "text-red-400" : "text-red-600"
                              }`}
                            >
                              Password Requirements
                            </Text>
                          </View>
                          <View className="space-y-2">
                            {!validation.hasUpperCase && (
                              <View className="flex-row items-center">
                                <View
                                  className={`w-2 h-2 rounded-full mr-2 ${
                                    isDark ? "bg-red-500" : "bg-red-400"
                                  }`}
                                />
                                <Text
                                  className={`text-sm ${
                                    isDark ? "text-red-300" : "text-red-600"
                                  }`}
                                >
                                  First letter should be uppercase
                                </Text>
                              </View>
                            )}
                            {!validation.hasSpecialChar && (
                              <View className="flex-row items-center">
                                <View
                                  className={`w-2 h-2 rounded-full mr-2 ${
                                    isDark ? "bg-red-500" : "bg-red-400"
                                  }`}
                                />
                                <Text
                                  className={`text-sm ${
                                    isDark ? "text-red-300" : "text-red-600"
                                  }`}
                                >
                                  Add a special character (!@#$%^&*)
                                </Text>
                              </View>
                            )}
                            {!validation.hasNumber && (
                              <View className="flex-row items-center">
                                <View
                                  className={`w-2 h-2 rounded-full mr-2 ${
                                    isDark ? "bg-red-500" : "bg-red-400"
                                  }`}
                                />
                                <Text
                                  className={`text-sm ${
                                    isDark ? "text-red-300" : "text-red-600"
                                  }`}
                                >
                                  Include at least one number
                                </Text>
                              </View>
                            )}
                            {!validation.minLength && (
                              <View className="flex-row items-center">
                                <View
                                  className={`w-2 h-2 rounded-full mr-2 ${
                                    isDark ? "bg-red-500" : "bg-red-400"
                                  }`}
                                />
                                <Text
                                  className={`text-sm ${
                                    isDark ? "text-red-300" : "text-red-600"
                                  }`}
                                >
                                  {8 - passwordData.newPassword.length} more
                                  characters needed
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    )}
                </View>

                {/* Confirm Password */}
                <View>
                  <Text
                    className={`text-base font-medium ${
                      isDark ? "text-gray-200" : "text-gray-800"
                    }`}
                  >
                    Confirm New Password
                  </Text>
                  <View className="relative">
                    <TextInput
                      className={`p-4 rounded-lg border ${
                        isDark
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300 text-gray-900"
                      }`}
                      secureTextEntry={true}
                      value={passwordData.confirmPassword}
                      onChangeText={(value) =>
                        handlePasswordChange("confirmPassword", value)
                      }
                      placeholder="Confirm new password"
                      placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
                    />
                  </View>
                  {passwordData.confirmPassword.length > 0 &&
                    !validation.matchesConfirm && (
                      <Text
                        className={`text-sm mt-2 ${
                          isDark ? "text-red-400" : "text-red-600"
                        }`}
                      >
                        Passwords do not match
                      </Text>
                    )}
                </View>

                <TouchableOpacity
                  className={`p-4 mt-4 rounded-lg items-center ${
                    isDark ? "bg-blue-600" : "bg-blue-500"
                  } ${changing ? "opacity-50" : ""}`}
                  onPress={handleChangePassword}
                  disabled={changing}
                  style={styles.submitButton}
                >
                  {changing ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-semibold text-base">
                      Change Password
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <CustomModal
        visible={successModalVisible}
        onClose={() => setSuccessModalVisible(false)}
        type="PASSWORD_CHANGE"
        message={modalMessage}
        onConfirm={() => {
          setSuccessModalVisible(false);
          router.back();
        }}
        confirmText="Continue"
        fullscreen={true}
        autoClose={3000}
      />

      {/* Error Modal */}
      <CustomModal
        visible={errorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        type="ERROR"
        title="Error"
        message={modalMessage}
        onConfirm={() => setErrorModalVisible(false)}
        confirmText="Try Again"
        fullscreen={true}
      />

      {/* Warning Modal */}
      <CustomModal
        visible={warningModalVisible}
        onClose={() => setWarningModalVisible(false)}
        type="WARNING"
        title="Warning"
        message={modalMessage}
        onConfirm={() => setWarningModalVisible(false)}
        confirmText="Understood"
        fullscreen={true}
      />
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
  submitButton: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  }
});
