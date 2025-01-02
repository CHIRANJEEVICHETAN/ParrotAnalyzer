import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import axios from 'axios';
import { getHeaderPaddingTop } from '@/utils/statusBarHeight';

interface GroupAdmin {
  id: number;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

interface GroupAdminFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface ValidationErrors {
  [key: string]: string;
}

export default function ManageGroupAdmins() {
  const { theme } = ThemeContext.useTheme();
  const { user, token } = AuthContext.useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'individual' | 'bulk'>('individual');
  const [groupAdmins, setGroupAdmins] = useState<GroupAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<GroupAdminFormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    fetchGroupAdmins();
  }, []);

  const fetchGroupAdmins = async () => {
    try {
      setLoading(true);
      setApiError(null);
      const response = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/group-admins`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroupAdmins(response.data);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Unable to fetch group admins';
      setApiError(errorMessage);
      console.error('Error fetching group admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroupAdmin = async () => {
    try {
      setIsSubmitting(true);
      setValidationErrors({});
      setApiError(null);

      // Validate form
      const errors: ValidationErrors = {};
      if (!formData.name) errors.name = 'Name is required';
      if (!formData.email) errors.email = 'Email is required';
      if (!formData.email.includes('@')) errors.email = 'Invalid email format';
      if (!formData.password) errors.password = 'Password is required';
      if (formData.password && formData.password.length < 8) {
        errors.password = 'Password must be at least 8 characters';
      }
      if (formData.phone && !/^\+?[1-9]\d{9,11}$/.test(formData.phone)) {
        errors.phone = 'Invalid phone number format';
      }

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }

      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admins`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      Alert.alert(
        'Success',
        'Group admin created successfully',
        [{ text: 'OK', onPress: () => {
          setFormData({ name: '', email: '', phone: '', password: '' });
          fetchGroupAdmins();
        }}]
      );
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to create group admin';
      if (error.response?.status === 409) {
        setValidationErrors({ email: 'Email already exists' });
      } else {
        setApiError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true
      });

      if (!result) {
        return;
      }

      if (result.assets?.[0]) {
        setLoading(true);
        const formDataObj = new FormData();
        formDataObj.append('file', {
          uri: result.assets[0].uri,
          name: result.assets[0].name,
          type: 'text/csv'
        } as any);

        try {
          const response = await axios.post(
            `${process.env.EXPO_PUBLIC_API_URL}/api/group-admins/bulk`,
            formDataObj,
            {
              headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': `Bearer ${token}`
              }
            }
          );

          if (response.data.success) {
            Alert.alert(
              'Success',
              `Successfully uploaded ${response.data.success.length} group admins`,
              [{ 
                text: 'OK',
                onPress: () => {
                  fetchGroupAdmins();
                  setActiveTab('individual');
                }
              }]
            );
          }

          if (response.data.errors && response.data.errors.length > 0) {
            const errorMessage = response.data.errors
              .map((err: any) => `Row ${err.row}: ${err.error}`)
              .join('\n');

            Alert.alert(
              'Some Entries Had Errors',
              `Successfully added ${response.data.success.length} admins.\n\nErrors:\n${errorMessage}`,
              [{ text: 'OK' }]
            );
          }
        } catch (uploadError: any) {
          console.error('Upload error:', uploadError.response?.data || uploadError);
          Alert.alert(
            'Upload Failed',
            uploadError.response?.data?.error || 'Failed to upload CSV file'
          );
        }
      }
    } catch (error: any) {
      console.error('Document picker error:', error);
      Alert.alert(
        'Error',
        'Failed to select file. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // const handleDeleteGroupAdmin = async (id: number) => {
  //   Alert.alert(
  //     'Delete Group Admin',
  //     'Are you sure you want to delete this group admin?',
  //     [
  //       { text: 'Cancel', style: 'cancel' },
  //       {
  //         text: 'Delete',
  //         style: 'destructive',
  //         onPress: async () => {
  //           try {
  //             await axios.delete(
  //               `${process.env.EXPO_PUBLIC_API_URL}/api/group-admins/${id}`,
  //               { headers: { Authorization: `Bearer ${token}` } }
  //             );
  //             fetchGroupAdmins();
  //           } catch (error) {
  //             Alert.alert('Error', 'Failed to delete group admin');
  //           }
  //         }
  //       }
  //     ]
  //   );
  // };

  const filteredAdmins = groupAdmins.filter(admin => 
    admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <LinearGradient
        colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#F9FAFB', '#F3F4F6']}
        className="w-full"
        style={styles.header}
      >
        <View className="flex-row items-center justify-between px-6">
          <Link href="../" asChild>
            <TouchableOpacity
              className="mr-4 p-2 rounded-full"
              style={[styles.backButton, { backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6' }]}
            >
              <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </Link>
          <Text 
            className="flex-1 text-xl font-semibold"
            style={{ color: theme === 'dark' ? '#F9FAFB' : '#111827' }}
          >
            Manage Group Admins
          </Text>
        </View>
      </LinearGradient>

      <ScrollView 
        className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
        showsVerticalScrollIndicator={false}
      >
        <View className="p-6">
          {apiError && (
            <View className="mb-4 p-4 bg-red-100 border border-red-400 rounded-lg">
              <Text className="text-red-800 font-medium">{apiError}</Text>
            </View>
          )}

          <View className="flex-row mb-6 bg-gray-200 p-1 rounded-xl">
            {['individual', 'bulk'].map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab as 'individual' | 'bulk')}
                className={`flex-1 py-3 px-4 rounded-lg ${
                  activeTab === tab 
                    ? 'bg-blue-500 shadow-sm' 
                    : 'bg-transparent'
                }`}
                style={activeTab === tab ? styles.activeTab : null}
              >
                <Text className={`text-center font-medium ${
                  activeTab === tab ? 'text-white' : theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {tab === 'individual' ? 'Add Individually' : 'Bulk Upload'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'individual' && (
            <View className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <Text className={`text-lg font-semibold mb-4 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Create New Group Admin
              </Text>
              
              {[
                { label: 'Full Name', key: 'name' },
                { label: 'Email Address', key: 'email', keyboardType: 'email-address' },
                { label: 'Phone Number', key: 'phone', keyboardType: 'phone-pad' },
                { label: 'Password', key: 'password', secure: true }
              ].map((field) => (
                <View key={field.key}>
                  <Text className={`mb-2 font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {field.label}
                  </Text>
                  <TextInput
                    value={formData[field.key as keyof GroupAdminFormData]}
                    onChangeText={(text) => {
                      setFormData(prev => ({ ...prev, [field.key]: text }));
                      if (validationErrors[field.key]) {
                        setValidationErrors(prev => ({ ...prev, [field.key]: '' }));
                      }
                    }}
                    className={`p-4 rounded-lg mb-1 ${
                      theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'
                    } ${validationErrors[field.key] ? 'border-2 border-red-500' : 'border border-gray-200'}`}
                    style={styles.input}
                    placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                    secureTextEntry={field.secure}
                    keyboardType={field.keyboardType as any}
                  />
                  {validationErrors[field.key] && (
                    <Text className="text-red-500 text-sm ml-1">
                      {validationErrors[field.key]}
                    </Text>
                  )}
                </View>
              ))}

              <TouchableOpacity
                onPress={handleCreateGroupAdmin}
                disabled={isSubmitting}
                className={`mt-6 py-4 rounded-lg bg-blue-500 ${isSubmitting ? 'opacity-50' : ''}`}
                style={styles.submitButton}
              >
                {isSubmitting ? (
                  <View className="flex-row items-center justify-center">
                    <ActivityIndicator color="white" size="small" />
                    <Text className="text-white font-semibold ml-2">Creating...</Text>
                  </View>
                ) : (
                  <Text className="text-white text-center font-semibold text-lg">
                    Create Group Admin
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'bulk' && (
            <View className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <View className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg mb-6">
                <Text className={`font-medium mb-2 ${
                  theme === 'dark' ? 'text-blue-200' : 'text-blue-800'
                }`}>
                  CSV File Format
                </Text>
                <Text className={theme === 'dark' ? 'text-blue-200/80' : 'text-blue-700'}>
                  Required columns: name, email, phone, password
                </Text>
                <Text className={`mt-2 ${theme === 'dark' ? 'text-blue-200/70' : 'text-blue-600'}`}>
                  Example: John Doe,john@example.com,+1234567890,password123
                </Text>
              </View>
              
              <View className="items-center">
                <TouchableOpacity
                  onPress={handleBulkUpload}
                  disabled={loading}
                  className={`w-full py-6 rounded-lg border-2 border-dashed 
                             ${loading ? 'opacity-50' : ''} 
                             border-blue-300 dark:border-blue-500 
                             flex-row justify-center items-center 
                             bg-blue-50/50 dark:bg-blue-900/20`}
                >
                  {loading ? (
                    <View className="flex-row items-center">
                      <ActivityIndicator color={theme === 'dark' ? '#60A5FA' : '#3B82F6'} />
                      <Text className={`ml-3 font-medium ${
                        theme === 'dark' ? 'text-blue-200' : 'text-blue-700'
                      }`}>
                        Uploading...
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Ionicons 
                        name="cloud-upload-outline" 
                        size={30} 
                        color={theme === 'dark' ? '#60A5FA' : '#3B82F6'} 
                      />
                      <Text className={`ml-3 font-medium ${
                        theme === 'dark' ? 'text-blue-200' : 'text-blue-700'
                      }`}>
                        Select CSV File
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                
                <Text className={`mt-4 text-sm ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Click to select a CSV file from your device
                </Text>
              </View>
            </View>
          )}

          <View className="mt-8">
            <View className="flex-row justify-between items-center mb-4">
              <Text className={`text-xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Group Admins
              </Text>
              <Text className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {groupAdmins.length} total
              </Text>
            </View>

            <View className="relative mb-6">
              <Ionicons
                name="search-outline"
                size={20}
                color={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                style={{ position: 'absolute', left: 16, top: 14 }}
              />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search group admins..."
                className={`pl-12 pr-4 py-4 rounded-lg ${
                  theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
                }`}
                placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                style={styles.searchInput}
              />
            </View>

            {loading ? (
              <View className="py-20">
                <ActivityIndicator size="large" color={theme === 'dark' ? '#60A5FA' : '#3B82F6'} />
              </View>
            ) : groupAdmins.length === 0 ? (
              <View className="py-20 items-center">
                <Ionicons
                  name="people-outline"
                  size={48}
                  color={theme === 'dark' ? '#4B5563' : '#9CA3AF'}
                />
                <Text className={`mt-4 text-center ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  No group admins found
                </Text>
              </View>
            ) : (
              filteredAdmins.map((admin) => (
                <View
                  key={admin.id}
                  className={`mb-4 p-4 rounded-xl ${
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  }`}
                  style={styles.adminCard}
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text className={`text-lg font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {admin.name}
                      </Text>
                      <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        {admin.email}
                      </Text>
                      <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        {admin.phone}
                      </Text>
                      <Text className={`mt-2 text-sm ${
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      }`}>
                        Added {new Date(admin.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    
                    {/* <TouchableOpacity
                      onPress={() => handleDeleteGroupAdmin(admin.id)}
                      className="p-2 rounded-full bg-red-100 dark:bg-red-900/30"
                    >
                      <Ionicons 
                        name="trash-outline" 
                        size={20} 
                        color={theme === 'dark' ? '#FCA5A5' : '#DC2626'} 
                      />
                    </TouchableOpacity> */}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: getHeaderPaddingTop(),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  backButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activeTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  input: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  submitButton: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  searchInput: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  adminCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  }
});