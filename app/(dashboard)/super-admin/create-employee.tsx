import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeInDown, 
  FadeInRight,
  Layout,
  SlideInRight
} from 'react-native-reanimated';
import ThemeContext from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IconName } from '@/types/common';

interface FormData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
}

interface FormField {
  label: string;
  key: keyof FormData;
  icon: IconName;
  secure?: boolean;
}

export default function CreateEmployee() {
  const { theme } = ThemeContext.useTheme();
  const { user } = useAuth(); // Get the authenticated user to send token
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  // Validation functions
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string) => {
    const phoneRegex = /^\+?[1-9]\d{9,11}$/;
    return phoneRegex.test(phone);
  };

  const validatePassword = (password: string) => {
    return password.length >= 8;
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!validateEmail(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Invalid phone number';
    }

    if (!validatePassword(formData.password)) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await AsyncStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          ...formData,
          role: 'employee',
        }),
      });

      if (response.ok) {
        router.back();
        // Show success toast
      } else {
        const data = await response.json();
        setErrors({ email: data.error }); // Show server error
      }
    } catch (error) {
      console.error(error);
      setErrors({ email: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const fields: FormField[] = [
    { label: 'Full Name', key: 'name', icon: 'person-outline' },
    { label: 'Email Address', key: 'email', icon: 'mail-outline' },
    { label: 'Phone Number', key: 'phone', icon: 'call-outline' },
    { label: 'Password', key: 'password', icon: 'lock-closed-outline', secure: true },
  ];

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <View className="flex-1 bg-gray-50 dark:bg-gray-900">
        <ScrollView 
          className="flex-1 p-6"
          keyboardShouldPersistTaps="handled" // This fixes the keyboard dismissal issue
        >
          <Animated.View 
            entering={FadeInDown.delay(200)}
            className="mb-8"
          >
            <TouchableOpacity 
              onPress={() => router.back()}
              className="mb-4"
            >
              <Ionicons 
                name="arrow-back" 
                size={24} 
                color={theme === 'dark' ? '#FFF' : '#000'} 
              />
            </TouchableOpacity>
            <Text className="text-3xl font-bold text-gray-800 dark:text-white">
              Create New Employee
            </Text>
            <Text className="text-gray-600 dark:text-gray-400 mt-2">
              Add a new employee to the system
            </Text>
          </Animated.View>

          <Animated.View 
            entering={SlideInRight.delay(400)}
            className="space-y-6"
          >
            {fields.map((field) => (
              <Animated.View
                key={field.key}
                layout={Layout.springify()}
                className="space-y-2"
              >
                <Text className="text-gray-700 dark:text-gray-300 font-medium">
                  {field.label}
                </Text>
                <View className="space-y-1">
                  <View className="flex-row items-center space-x-2">
                    <Ionicons 
                      name={field.icon}
                      size={20} 
                      color={theme === 'dark' ? '#9CA3AF' : '#6B7280'} 
                    />
                    <TextInput
                      value={formData[field.key]}
                      onChangeText={(text) => {
                        setFormData(prev => ({ ...prev, [field.key]: text }));
                        if (errors[field.key]) {
                          setErrors(prev => ({ ...prev, [field.key]: undefined }));
                        }
                      }}
                      secureTextEntry={field.secure}
                      className="flex-1 p-4 rounded-lg bg-white dark:bg-gray-800
                        text-gray-800 dark:text-white border border-gray-200 dark:border-gray-700"
                      placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  </View>
                  {errors[field.key] && (
                    <Animated.Text 
                      entering={FadeInRight}
                      className="text-red-500 text-sm ml-8"
                    >
                      {errors[field.key]}
                    </Animated.Text>
                  )}
                </View>
              </Animated.View>
            ))}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              className={`mt-8 p-4 rounded-lg ${
                loading ? 'bg-blue-400' : 'bg-blue-500'
              } shadow-lg`}
              style={{
                elevation: 2,
              }}
            >
              <Animated.View 
                className="flex-row justify-center items-center"
                entering={FadeInRight}
              >
                {loading && (
                  <ActivityIndicator color="white" className="mr-2" />
                )}
                <Text className="text-white text-center font-medium">
                  {loading ? 'Creating...' : 'Create Employee'}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
} 