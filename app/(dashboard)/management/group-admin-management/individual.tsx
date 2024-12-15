import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';

interface GroupAdminFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
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

    // Phone validation (optional)
    if (formData.phone && !/^\+?[1-9]\d{9,11}$/.test(formData.phone)) {
      errors.phone = 'Invalid phone number format';
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
              setFormData({ name: '', email: '', phone: '', password: '' });
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
          { label: 'Phone Number', key: 'phone', placeholder: 'Enter phone number', keyboardType: 'phone-pad' },
          { label: 'Password', key: 'password', placeholder: 'Enter password', secure: true }
        ].map((field) => (
          <View key={field.key} style={styles.fieldContainer}>
            <Text style={[styles.label, { color: theme === 'dark' ? '#D1D5DB' : '#374151' }]}>
              {field.label}
            </Text>
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