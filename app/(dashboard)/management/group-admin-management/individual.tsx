import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import axios from 'axios';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';

interface GroupAdminFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  gender: string;
}

interface ValidationErrors {
  [key: string]: string;
}

interface ApiResponse {
  id: number;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

export default function IndividualUpload() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState<GroupAdminFormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    gender: '',
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const validatePhoneNumber = (phone: string) => {
    // Remove any non-digit characters and the +91 prefix
    const cleanPhone = phone.replace(/^\+91/, '').replace(/\D/g, '');
    
    // Check if it's exactly 10 digits and starts with 6-9
    if (!cleanPhone) return true; // Allow empty phone as it's optional
    if (cleanPhone.length !== 10) return false;
    return /^[6-9]\d{9}$/.test(cleanPhone);
  };

  const formatPhoneNumber = (phone: string) => {
    // Remove any existing +91 prefix and any non-digit characters
    const cleanPhone = phone.replace(/^\+91/, '').replace(/\D/g, '');
    // Add the +91 prefix back if there are digits
    return cleanPhone ? `+91${cleanPhone}` : '';
  };

  const handlePhoneChange = (text: string) => {
    // Remove any non-digit characters except the +91 prefix
    const formattedPhone = formatPhoneNumber(text);
    setFormData(prev => ({ ...prev, phone: formattedPhone }));
    
    // Clear phone error if the field is empty or valid
    if (!text || validatePhoneNumber(formattedPhone)) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.phone;
        return newErrors;
      });
    }
  };

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

    // Phone validation (if provided)
    if (formData.phone && !validatePhoneNumber(formData.phone)) {
      errors.phone = 'Please enter a valid 10-digit Indian mobile number';
    }

    return errors;
  };

  const handleCreateGroupAdmin = async () => {
    try {
      setIsSubmitting(true);
      setValidationErrors({});
      setApiError(null);

      // Validate form
      const errors = validateForm();
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }

      // Make API call
      const response = await axios.post<ApiResponse>(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admins`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (response.data) {
        Alert.alert(
          'Success',
          'Group admin created successfully',
          [{
            text: 'OK',
            onPress: () => {
              // Clear form and navigate back
              setFormData({ name: '', email: '', phone: '', password: '', gender: '' });
              router.back();
            }
          }]
        );
      }
    } catch (error: any) {
      console.error('Error creating group admin:', error.response?.data || error.message);
      
      if (error.response?.status === 409) {
        setValidationErrors({ email: 'Email already exists' });
      } else if (error.response?.status === 400) {
        // Handle validation errors from server
        const serverErrors = error.response.data.errors;
        if (serverErrors) {
          setValidationErrors(serverErrors);
        } else if (error.response.data.error === 'User limit reached') {
          const details = error.response.data.details;
          Alert.alert(
            'User Limit Reached',
            `${details.message}\n\nCurrent Users: ${details.currentCount}\nUser Limit: ${details.limit}\n\nPlease contact your super admin to increase the user limit.`,
            [{ text: 'OK' }]
          );
        } else {
          setApiError(error.response.data.error || 'Invalid input data');
        }
      } else if (error.response?.data?.error) {
        setApiError(error.response.data.error);
      } else {
        setApiError('Failed to create group admin. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme === 'dark' ? '#111827' : '#F3F4F6' }]}>
      <View style={[styles.card, { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }]}>
        <Text style={[styles.title, { color: theme === 'dark' ? '#F9FAFB' : '#111827' }]}>
          Create New Group Admin
        </Text>

        {apiError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{apiError}</Text>
          </View>
        )}

        {[
          { label: 'Full Name', key: 'name', placeholder: 'Enter full name' },
          { label: 'Email Address', key: 'email', placeholder: 'Enter email address', keyboardType: 'email-address' },
          { 
            label: 'Phone Number', 
            key: 'phone', 
            placeholder: 'Enter 10-digit number',
            keyboardType: 'phone-pad',
            prefix: '+91'
          },
          { 
            label: 'Gender', 
            key: 'gender', 
            placeholder: 'Select gender',
            isDropdown: true,
            options: [
              { label: 'Select Gender', value: '' },
              { label: 'Male', value: 'male' },
              { label: 'Female', value: 'female' },
              { label: 'Other', value: 'other' }
            ]
          },
          { label: 'Password', key: 'password', placeholder: 'Enter password', secure: true }
        ].map((field) => (
          <View key={field.key} style={styles.fieldContainer}>
            <Text style={[styles.label, { color: theme === 'dark' ? '#D1D5DB' : '#374151' }]}>
              {field.label}
            </Text>
            {field.isDropdown ? (
              <View style={[
                styles.input,
                { 
                  backgroundColor: theme === 'dark' ? '#374151' : '#F9FAFB',
                  borderColor: validationErrors[field.key] ? '#EF4444' : (theme === 'dark' ? '#4B5563' : '#D1D5DB'),
                  padding: 0,
                  overflow: 'hidden',
                  height: 56
                }
              ]}>
                <Picker
                  selectedValue={formData[field.key as keyof GroupAdminFormData]}
                  onValueChange={(value: string) => setFormData(prev => ({ ...prev, [field.key]: value }))}
                  style={[
                    { 
                      color: theme === 'dark' ? '#FFFFFF' : '#000000',
                      backgroundColor: theme === 'dark' ? '#374151' : '#FFFFFF',
                      height: 56,
                    }
                  ]}
                  dropdownIconColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                  mode="dropdown"
                >
                  {field.options?.map(option => (
                    <Picker.Item 
                      key={option.value} 
                      label={option.label} 
                      value={option.value}
                      color={theme === 'dark' ? '#FFFFFF' : '#000000'}
                      style={{
                        backgroundColor: theme === 'dark' ? '#374151' : '#FFFFFF',
                        fontSize: 16,
                      }}
                    />
                  ))}
                </Picker>
              </View>
            ) : field.key === 'phone' ? (
              <View style={[
                styles.input,
                styles.phoneInputContainer,
                { 
                  backgroundColor: theme === 'dark' ? '#374151' : '#F9FAFB',
                  borderColor: validationErrors[field.key] ? '#EF4444' : (theme === 'dark' ? '#4B5563' : '#D1D5DB'),
                  padding: 0,
                  paddingLeft: 16
                }
              ]}>
                <Text style={[
                  styles.phonePrefix,
                  { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }
                ]}>
                  +91
                </Text>
                <TextInput
                  style={[
                    styles.phoneInput,
                    { 
                      color: theme === 'dark' ? '#F9FAFB' : '#111827',
                      backgroundColor: 'transparent',
                      borderWidth: 0,
                    }
                  ]}
                  placeholder="Enter 10-digit number"
                  placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                  value={formData[field.key].replace(/^\+91/, '')}
                  onChangeText={(text) => handlePhoneChange(text)}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            ) : (
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: theme === 'dark' ? '#374151' : '#F9FAFB',
                    color: theme === 'dark' ? '#F9FAFB' : '#111827',
                    borderColor: validationErrors[field.key] ? '#EF4444' : (theme === 'dark' ? '#4B5563' : '#D1D5DB')
                  }
                ]}
                placeholder={field.placeholder}
                placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                value={formData[field.key as keyof GroupAdminFormData]}
                onChangeText={(text) => setFormData(prev => ({ ...prev, [field.key]: text }))}
                secureTextEntry={field.secure}
                keyboardType={field.keyboardType as any || 'default'}
                autoCapitalize={field.key === 'email' ? 'none' : 'words'}
                autoComplete="off"
              />
            )}
            {validationErrors[field.key] && (
              <Text style={styles.errorText}>{validationErrors[field.key]}</Text>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={[styles.button, { opacity: isSubmitting ? 0.7 : 1 }]}
          onPress={handleCreateGroupAdmin}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Create Group Admin</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phonePrefix: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    paddingLeft: 0,
  },
  button: {
    backgroundColor: '#3B82F6',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 4,
  },
});