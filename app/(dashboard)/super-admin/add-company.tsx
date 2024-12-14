import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import axios from 'axios';

interface CompanyFormData {
  companyName: string;
  companyEmail: string;
  companyAddress: string;
  managementName: string;
  managementEmail: string;
  managementPhone: string;
  managementPassword: string;
}

export default function AddCompany() {
  const { theme } = ThemeContext.useTheme();
  const { user, token } = AuthContext.useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CompanyFormData>({
    companyName: '',
    companyEmail: '',
    companyAddress: '',
    managementName: '',
    managementEmail: '',
    managementPhone: '',
    managementPassword: '',
  });

  const [errors, setErrors] = useState<Partial<CompanyFormData>>({});

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Current token:', token);
        console.log('Current user:', user);
        
        if (!token) {
          console.log('No token found, redirecting to signin');
          router.replace('/(auth)/signin');
          return;
        }

        // Set default axios header
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        console.log('Axios headers set:', axios.defaults.headers.common['Authorization']);

        if (!user || user.role !== 'super-admin') {
          console.log('User not authorized:', user);
          Alert.alert('Access Denied', 'Only super admins can access this page');
          router.replace('/');
          return;
        }
      } catch (error) {
        console.error('Auth check error:', error);
        router.replace('/(auth)/signin');
      }
    };

    checkAuth();
  }, [user, token]);

  const validateForm = () => {
    const newErrors: Partial<CompanyFormData> = {};
    
    if (!formData.companyName) newErrors.companyName = 'Company name is required';
    if (!formData.companyEmail || !/\S+@\S+\.\S+/.test(formData.companyEmail)) {
      newErrors.companyEmail = 'Valid company email is required';
    }
    if (!formData.companyAddress) newErrors.companyAddress = 'Company address is required';
    if (!formData.managementName) newErrors.managementName = 'Management name is required';
    if (!formData.managementEmail || !/\S+@\S+\.\S+/.test(formData.managementEmail)) {
      newErrors.managementEmail = 'Valid management email is required';
    }
    if (!formData.managementPhone || !/^\+?[1-9]\d{9,11}$/.test(formData.managementPhone)) {
      newErrors.managementPhone = 'Valid phone number is required';
    }
    if (!formData.managementPassword || formData.managementPassword.length < 8) {
      newErrors.managementPassword = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!token) {
      Alert.alert('Authentication Required', 'Please login again');
      router.replace('/(auth)/signin');
      return;
    }

    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please check all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/companies`, 
        formData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      Alert.alert(
        'Success',
        'Company added successfully',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Error creating company:', error.response?.data || error);
      
      let errorMessage = 'Failed to add company. Please try again.';
      if (error.response?.data?.details?.includes('users_phone_key')) {
        errorMessage = 'This phone number is already registered. Please use a different phone number.';
        setErrors(prev => ({
          ...prev,
          managementPhone: 'Phone number already exists'
        }));
      } else if (error.response?.data?.details?.includes('users_email_key')) {
        errorMessage = 'This email is already registered. Please use a different email.';
        setErrors(prev => ({
          ...prev,
          managementEmail: 'Email already exists'
        }));
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        className="pb-4"
        style={[styles.header, { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 0 }]}
      >
        <View className="flex-row items-center justify-between px-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2 rounded-full"
            style={{ backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6' }}
          >
            <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
          <Text className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Add Company
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView 
        className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
        showsVerticalScrollIndicator={false}
      >
        <View className="p-6">
          {/* Company Details Section */}
          <View className="mb-8">
            <Text className={`text-xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Company Details
            </Text>
            
            {/* Form fields for company */}
            <View className="space-y-4">
              {[
                { label: 'Company Name', key: 'companyName' },
                { label: 'Company Email', key: 'companyEmail', keyboardType: 'email-address' },
                { label: 'Company Address', key: 'companyAddress', multiline: true }
              ].map((field) => (
                <View key={field.key}>
                  <Text className={`mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    {field.label}
                  </Text>
                  <TextInput
                    value={formData[field.key as keyof CompanyFormData]}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, [field.key]: text }))}
                    className={`p-4 rounded-lg mb-2 ${
                      theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
                    } ${errors[field.key as keyof CompanyFormData] ? 'border-2 border-red-500' : 'border border-gray-200'}`}
                    style={styles.inputContainer}
                    placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                    multiline={field.multiline}
                    numberOfLines={field.multiline ? 3 : 1}
                    keyboardType={field.keyboardType as any}
                  />
                  {errors[field.key as keyof CompanyFormData] && (
                    <Text className="text-red-500 mt-1">
                      {errors[field.key as keyof CompanyFormData]}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Management Details Section */}
          <View className="mb-8">
            <Text className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Management Account Details
            </Text>
            
            {/* Form fields for management */}
            <View className="space-y-4">
              {[
                { label: 'Full Name', key: 'managementName' },
                { label: 'Email', key: 'managementEmail', keyboardType: 'email-address' },
                { label: 'Phone', key: 'managementPhone', keyboardType: 'phone-pad' },
                { label: 'Password', key: 'managementPassword', secure: true }
              ].map((field) => (
                <View key={field.key}>
                  <Text className={`mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    {field.label}
                  </Text>
                  <TextInput
                    value={formData[field.key as keyof CompanyFormData]}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, [field.key]: text }))}
                    className={`p-4 rounded-lg mb-2 ${
                      theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
                    } ${errors[field.key as keyof CompanyFormData] ? 'border-2 border-red-500' : 'border border-gray-200'}`}
                    style={styles.inputContainer}
                    placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                    secureTextEntry={field.secure}
                    keyboardType={field.keyboardType as any}
                  />
                  {errors[field.key as keyof CompanyFormData] && (
                    <Text className="text-red-500 mt-1">
                      {errors[field.key as keyof CompanyFormData]}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className={`py-4 rounded-lg bg-blue-500 ${loading ? 'opacity-50' : ''} active:bg-blue-600`}
            style={styles.submitButton}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {loading ? 'Adding Company...' : 'Add Company'}
            </Text>
          </TouchableOpacity>
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
  inputContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  submitButton: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  }
}); 