import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, StatusBar, Animated } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import axios from 'axios';

interface EmployeeFormData {
  name: string;
  employeeNumber: string;
  email: string;
  phone: string;
  password: string;
  department: string;
  designation: string;
  can_submit_expenses_anytime: boolean;
  gender: string;
}

interface ValidationErrors {
  [key: string]: string;
}

interface Field {
  key: keyof EmployeeFormData;
  label: string;
  placeholder: string;
  keyboardType?: string;
  prefix?: string;
  secure?: boolean;
  isDropdown?: boolean;
  options?: { label: string; value: string }[];
}

export default function CreateEmployee() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';
  const successScale = useRef(new Animated.Value(0)).current;
  const [showSuccess, setShowSuccess] = useState(false);

  const [formData, setFormData] = useState<EmployeeFormData>({
    name: '',
    employeeNumber: '',
    email: '',
    phone: '',
    password: '',
    department: '',
    designation: '',
    can_submit_expenses_anytime: false,
    gender: '',
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const validateForm = () => {
    const errors: ValidationErrors = {};
    
    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Password must contain uppercase, lowercase and numbers';
    }

    // Gender validation
    if (!formData.gender) {
      errors.gender = 'Please select a gender';
    }

    // Phone validation
    if (formData.phone) {
      if (!/^\+91\d{10}$/.test(formData.phone)) {
        errors.phone = 'Please enter a valid 10-digit number';
      }
    }

    return errors;
  };

  const showSuccessAnimation = () => {
    setShowSuccess(true);
    Animated.sequence([
      Animated.spring(successScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
        stiffness: 200,
      }),
    ]).start();

    // Auto hide after 2 seconds and navigate back
    setTimeout(() => {
      setShowSuccess(false);
      successScale.setValue(0);
      router.back();
    }, 2000);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setValidationErrors({});
      setApiError(null);

      const errors = validateForm();
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }

      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/employees`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (response.data) {
        showSuccessAnimation();
      }
    } catch (error: any) {
      setIsSubmitting(false);
      if (error.response?.status === 409) {
        Alert.alert(
          'Error',
          'An employee with this email or employee number already exists.'
        );
      } else if (error.response?.status === 400) {
        if (error.response.data.error === 'User limit reached') {
          const details = error.response.data.details;
          Alert.alert(
            'User Limit Reached',
            `Unable to create employee. Your company has reached its user limit.\n\nCurrent Users: ${details.currentCount}\nUser Limit: ${details.userLimit}\n\nPlease contact your management to increase the user limit.`,
            [{ text: 'OK' }]
          );
        } else {
          // Handle other validation errors
          const errors = error.response.data.errors;
          setValidationErrors(errors || {});
        }
      } else {
        Alert.alert(
          'Error',
          'An error occurred while creating the employee. Please try again.'
        );
      }
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#F3F4F6' }}>
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* Header */}
      <View 
        className={`${isDark ? 'bg-gray-800' : 'bg-white'}`}
        style={styles.header}
      >
        <View className="flex-row items-center justify-between px-4 pt-3 pb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
            style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}
          >
            <Ionicons 
              name="arrow-back" 
              size={24} 
              color={isDark ? '#FFFFFF' : '#111827'} 
            />
          </TouchableOpacity>
          <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
            <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Add Employee
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {apiError && (
          <View className="mb-4 p-4 bg-red-100 border border-red-400 rounded-lg">
            <Text className="text-red-800">{apiError}</Text>
          </View>
        )}

        <View className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={styles.formCard}>
          {[
            { key: 'name', label: 'Full Name', placeholder: 'Enter full name' },
            { key: 'employeeNumber', label: 'Employee Number', placeholder: 'Enter employee number' },
            { key: 'email', label: 'Email Address', placeholder: 'Enter email address', keyboardType: 'email-address' },
            { 
              key: 'phone', 
              label: 'Phone Number', 
              placeholder: 'Enter 10 digit number', 
              keyboardType: 'phone-pad',
              prefix: '+91'
            },
            { key: 'department', label: 'Department', placeholder: 'Enter department' },
            { key: 'designation', label: 'Designation', placeholder: 'Enter designation' },
            { 
              key: 'gender', 
              label: 'Gender', 
              placeholder: 'Select gender',
              isDropdown: true,
              options: [
                { label: 'Select Gender', value: '' },
                { label: 'Male', value: 'male' },
                { label: 'Female', value: 'female' },
                { label: 'Other', value: 'other' }
              ]
            },
            { key: 'password', label: 'Password', placeholder: 'Enter password', secure: true }
          ].map((field) => (
            <View key={field.key} className="mb-4">
              <Text className={`mb-2 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {field.label}
              </Text>
              {field.prefix ? (
                <View className={`flex-row items-center rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}
                  style={[
                    styles.input,
                    validationErrors[field.key] ? styles.inputError : null
                  ]}>
                  <Text className={`pl-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {field.prefix}
                  </Text>
                  <TextInput
                    value={typeof formData[field.key as keyof EmployeeFormData] === 'string' 
                      ? (formData[field.key as keyof EmployeeFormData] as string).replace(/^\+91/, '') 
                      : ''}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/\D/g, '').slice(0, 10);
                      const formattedNumber = cleaned ? `+91${cleaned}` : '';
                      setFormData(prev => ({ ...prev, [field.key]: formattedNumber }));
                      if (validationErrors[field.key]) {
                        setValidationErrors(prev => ({ ...prev, [field.key]: '' }));
                      }
                    }}
                    placeholder={field.placeholder}
                    placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                    className={`flex-1 p-4 ${isDark ? 'text-white' : 'text-gray-900'}`}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              ) : field.isDropdown ? (
                <View style={[
                  styles.input,
                  { 
                    backgroundColor: isDark ? '#374151' : '#F9FAFB',
                    padding: 0,
                    overflow: 'hidden',
                    borderRadius: 8,
                    height: 56,
                    borderColor: validationErrors[field.key] ? '#EF4444' : (isDark ? '#4B5563' : '#D1D5DB'),
                    borderWidth: 1
                  }
                ]}>
                  <Picker
                    selectedValue={formData[field.key as keyof EmployeeFormData]}
                    onValueChange={(value) => {
                      setFormData(prev => ({ ...prev, [field.key]: value }));
                      if (validationErrors[field.key]) {
                        setValidationErrors(prev => ({ ...prev, [field.key]: '' }));
                      }
                    }}
                    style={[
                      { 
                        color: isDark ? '#FFFFFF' : '#000000',
                        backgroundColor: isDark ? '#374151' : '#FFFFFF',
                        height: 56,
                      }
                    ]}
                    dropdownIconColor={isDark ? '#9CA3AF' : '#6B7280'}
                    mode="dropdown"
                  >
                    {field.options?.map(option => (
                      <Picker.Item 
                        key={option.value} 
                        label={option.label} 
                        value={option.value}
                        color={isDark ? '#FFFFFF' : '#000000'}
                        style={{
                          backgroundColor: isDark ? '#374151' : '#FFFFFF',
                          fontSize: 16
                        }}
                      />
                    ))}
                  </Picker>
                </View>
              ) : (
                <TextInput
                  value={typeof formData[field.key as keyof EmployeeFormData] === 'string' 
                    ? (formData[field.key as keyof EmployeeFormData] as string)
                    : ''}
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, [field.key]: text }));
                    if (validationErrors[field.key]) {
                      setValidationErrors(prev => ({ ...prev, [field.key]: '' }));
                    }
                  }}
                  placeholder={field.placeholder}
                  placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                  className={`p-4 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'}`}
                  style={[
                    styles.input,
                    validationErrors[field.key] ? styles.inputError : null
                  ]}
                  secureTextEntry={field.secure}
                  keyboardType={field.keyboardType as any || 'default'}
                  autoCapitalize={field.key === 'email' ? 'none' : 'words'}
                />
              )}
              {validationErrors[field.key] && (
                <Text className="mt-1 text-red-500 text-sm">
                  {validationErrors[field.key]}
                </Text>
              )}
            </View>
          ))}

          <TouchableOpacity
            onPress={() => setFormData(prev => ({
              ...prev,
              can_submit_expenses_anytime: !prev.can_submit_expenses_anytime
            }))}
            className={`flex-row items-center p-4 mb-6 rounded-lg ${
              isDark ? 'bg-gray-700' : 'bg-gray-50'
            }`}
          >
            <View className={`w-6 h-6 rounded-md mr-3 items-center justify-center ${
              formData.can_submit_expenses_anytime
                ? 'bg-green-500'
                : isDark ? 'bg-gray-600' : 'bg-gray-300'
            }`}>
              {formData.can_submit_expenses_anytime && (
                <Ionicons name="checkmark" size={18} color="white" />
              )}
            </View>
            <Text className={isDark ? 'text-white' : 'text-gray-900'}>
              Allow expense submission anytime
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            className={`p-4 rounded-lg bg-blue-500 ${isSubmitting ? 'opacity-50' : ''}`}
            style={styles.submitButton}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {isSubmitting ? 'Creating...' : 'Create Employee'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Success Modal */}
      {showSuccess && (
        <Animated.View 
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 50,
            },
            {
              transform: [{ scale: successScale }],
            }
          ]}
        >
          <View style={{ alignItems: 'center', padding: 24 }}>
            <View style={{ 
              width: 80, 
              height: 80, 
              borderRadius: 40, 
              backgroundColor: isDark ? 'rgba(74, 222, 128, 0.2)' : 'rgba(74, 222, 128, 0.1)',
              justifyContent: 'center', 
              alignItems: 'center',
              marginBottom: 16
            }}>
              <MaterialCommunityIcons
                name="check-circle"
                size={40}
                color={isDark ? "#4ADE80" : "#22C55E"}
              />
            </View>
            <Text style={{ 
              fontSize: 24, 
              fontWeight: '600',
              marginBottom: 8,
              color: isDark ? '#FFFFFF' : '#111827'
            }}>
              Success!
            </Text>
            <Text style={{ 
              fontSize: 16,
              textAlign: 'center',
              color: isDark ? '#9CA3AF' : '#4B5563'
            }}>
              Employee has been created successfully
            </Text>
          </View>
        </Animated.View>
      )}
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
  formCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  submitButton: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  }
}); 