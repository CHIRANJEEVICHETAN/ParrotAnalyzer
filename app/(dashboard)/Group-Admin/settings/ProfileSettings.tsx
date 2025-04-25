import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';

interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone: string;
  company_name: string;
  total_employees: number;
  active_employees: number;
  profile_image?: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfileSettings() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [profileData, setProfileData] = useState<ProfileData>({
    id: '',
    name: '',
    email: '',
    phone: '',
    company_name: '',
    total_employees: 0,
    active_employees: 0,
  });
  
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [newImageSelected, setNewImageSelected] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  useEffect(() => {
    if (profileData.email) {
      fetchProfileImage();
    }
  }, [profileData.email]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/profile`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfileData(response.data);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      setError(error.response?.data?.message || 'Failed to fetch profile data');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfileImage = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/users/profile-image/${profileData.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.image) {
        setProfileImage(response.data.image);
      }
    } catch (error) {
      console.error('Error fetching profile image:', error);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        if (blob.size > 5 * 1024 * 1024) {
          Alert.alert('Error', 'Image size should be less than 5MB');
          return;
        }

        setProfileImage(asset.uri);
        setNewImageSelected(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const validatePhoneNumber = (phone: string) => {
    // Basic phone validation - can be adjusted based on your requirements
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    return phoneRegex.test(phone);
  };

  const handleSave = async () => {
    try {
      if (profileData.phone && !validatePhoneNumber(profileData.phone)) {
        Alert.alert('Error', 'Please enter a valid phone number');
        return;
      }

      setSaving(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('name', profileData.name);
      formData.append('phone', profileData.phone);

      if (newImageSelected && profileImage) {
        const response = await fetch(profileImage);
        const blob = await response.blob();
        
        formData.append('profileImage', {
          uri: profileImage,
          type: 'image/jpeg',
          name: 'profile.jpg',
        } as any);
      }

      const response = await axios.put(
        `${process.env.EXPO_PUBLIC_API_URL}/api/users/profile`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.profile_image) {
        setProfileImage(response.data.profile_image);
        setNewImageSelected(false);
      }

      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.response?.data?.message || 'Failed to update profile');
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    try {
      setChangingPassword(true);
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/change-password`,
        {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Password changed successfully');
      setShowPasswordModal(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
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
          >
            <Ionicons 
              name="arrow-back" 
              size={24} 
              color={isDark ? '#FFFFFF' : '#111827'} 
            />
          </TouchableOpacity>
          <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Profile Settings
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {loading ? (
          <View className="flex-1 justify-center items-center p-4">
            <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
          </View>
        ) : (
          <>
            {/* Profile Image Section - Moved to top */}
            <View 
              className={`p-6 rounded-xl mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              style={styles.formCard}
            >
              <View className="items-center">
                <TouchableOpacity onPress={pickImage}>
                  {profileImage ? (
                    <Image
                      source={{ 
                        uri: newImageSelected 
                          ? profileImage 
                          : `data:image/jpeg;base64,${profileImage}`
                      }}
                      className="w-32 h-32 rounded-full"
                      style={styles.profileImage}
                    />
                  ) : (
                    <View 
                      className="w-32 h-32 rounded-full bg-blue-500 items-center justify-center"
                      style={styles.profileImage}
                    >
                      <Text className="text-white text-4xl font-bold">
                        {profileData.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View 
                    className="absolute bottom-2 right-2 bg-blue-500 p-3 rounded-full"
                    style={styles.cameraButton}
                  >
                    <Ionicons name="camera" size={24} color="white" />
                  </View>
                </TouchableOpacity>
                <Text className={`mt-4 text-base font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {profileData.name}
                </Text>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {profileData.email}
                </Text>
              </View>
            </View>

            <View 
              className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              style={styles.formCard}
            >
              {error && (
                <View className="mb-4 p-4 bg-red-100 rounded-lg">
                  <Text className="text-red-800">{error}</Text>
                </View>
              )}

              <View className="mb-4">
                <Text className={`mb-2 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Full Name
                </Text>
                <TextInput
                  value={profileData.name}
                  onChangeText={(text) => setProfileData(prev => ({ ...prev, name: text }))}
                  className={`p-3 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'}`}
                  placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                  style={styles.input}
                />
              </View>

              <View className="mb-4">
                <Text className={`mb-2 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Email
                </Text>
                <TextInput
                  value={profileData.email}
                  editable={false}
                  className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-100 text-gray-600'}`}
                  style={styles.input}
                />
              </View>

              <View className="mb-4">
                <Text className={`mb-2 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Phone Number
                </Text>
                <TextInput
                  value={profileData.phone}
                  onChangeText={(text) => setProfileData(prev => ({ ...prev, phone: text }))}
                  keyboardType="phone-pad"
                  className={`p-3 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'}`}
                  placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                  style={styles.input}
                />
              </View>

              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                className={`p-4 rounded-lg bg-blue-500 ${saving ? 'opacity-50' : ''}`}
                style={styles.saveButton}
              >
                <Text className="text-white text-center font-semibold text-lg">
                  {saving ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Group Information Card */}
            <View 
              className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              style={styles.formCard}
            >
              <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Group Information
              </Text>

              <View className="mb-4">
                <Text className={`mb-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Company Name
                </Text>
                <Text className={`text-base font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {profileData.company_name}
                </Text>
              </View>

              <View className="mb-4">
                <Text className={`mb-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Total Employees
                </Text>
                <Text className={`text-base font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {profileData.total_employees}
                </Text>
              </View>

              <View>
                <Text className={`mb-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Active Employees
                </Text>
                <Text className={`text-base font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {profileData.active_employees}
                </Text>
              </View>
            </View>

            {/* Password Change Button - Added pb-6 for bottom padding */}
            <TouchableOpacity
              onPress={() => router.push('/(dashboard)/Group-Admin/settings/ChangePassword')}
              className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              style={[styles.formCard, { marginBottom: 24 }]}  // Added extra bottom margin
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Change Password
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Update your login password
                  </Text>
                </View>
                <Ionicons 
                  name="chevron-forward" 
                  size={24} 
                  color={isDark ? '#9CA3AF' : '#6B7280'} 
                />
              </View>
            </TouchableOpacity>
          </>
        )}
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
  formCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  saveButton: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  profileImage: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
  },
  cameraButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 3,
    borderColor: 'white',
  }
});

