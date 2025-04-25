import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  StatusBar as RNStatusBar,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext, { User } from "../../../context/AuthContext";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";

interface ProfileErrors {
  name?: string;
  email?: string;
  phone?: string;
}

interface Theme {
  theme: "light" | "dark";
  useTheme: () => { theme: "light" | "dark" };
}

interface Auth {
  user: User | null;
  token: string | null;
  updateUser: (user: User) => void;
  useAuth: () => { 
    user: User | null;
    token: string | null;
    updateUser: (user: User) => void;
  };
}

export default function ManagementProfileSettings() {
  const { theme } = ThemeContext.useTheme();
  const { user, token, updateUser } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [newImageSelected, setNewImageSelected] = useState(false);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  // Load profile image on mount
  useEffect(() => {
    if (user?.id) {
      fetchProfileImage();
    }
  }, [user?.id]);

  const fetchProfileImage = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/users/profile-image/${user?.id}`,
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
        quality: 0.8,
      });

      if (!result.canceled) {
        setProfileImage(result.assets[0].uri);
        setNewImageSelected(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);

      const form = new FormData();
      form.append('name', formData.name);
      form.append('phone', formData.phone);

      if (newImageSelected && profileImage) {
        if (profileImage.startsWith('data:image')) {
          const response = await fetch(profileImage);
          const blob = await response.blob();
          form.append('profileImage', blob, 'profile.jpg');
        } else {
          const filename = profileImage.split('/').pop() || 'profile.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          
          form.append('profileImage', {
            uri: profileImage,
            name: filename,
            type,
          } as any);
        }
      }

      const config = {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
        transformRequest: (data: any) => data,
      };

      const response = await axios.put(
        `${process.env.EXPO_PUBLIC_API_URL}/api/management/profile`,
        form,
        config
      );

      if (response.data) {
        updateUser(response.data);
        Alert.alert('Success', 'Profile updated successfully');
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to update profile. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = () => {
    router.push('/(dashboard)/management/settings/change-password');
  };

  const toggle2FA = () => {
    setIs2FAEnabled(!is2FAEnabled);
    // Implement 2FA toggle logic here
  };

  // Add useEffect to fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/management/profile`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (response.data) {
          setFormData({
            name: response.data.name || '',
            email: response.data.email || '',
            phone: response.data.phone || '',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          });

          if (response.data.profile_image) {
            setProfileImage(response.data.profile_image);
          }

          // Update user context if needed
          updateUser(response.data);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        Alert.alert('Error', 'Failed to fetch profile data');
      }
    };

    fetchProfile();
  }, []);

  return (
    <View className="flex-1" style={{ 
      backgroundColor: isDark ? '#111827' : '#F3F4F6',
    }}>
      <RNStatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
      />
      <View 
        className={`${isDark ? 'bg-gray-800' : 'bg-white'}`}
        style={[
          styles.header,
          { marginTop: Platform.OS === 'ios' ? 44 : RNStatusBar.currentHeight }
        ]}
      >
        <View className="flex-row items-center justify-between px-4 pt-3 pb-4" 
        >
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
        {/* Profile Image Section - Updated styling */}
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
                    {formData.name.charAt(0).toUpperCase()}
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
              {formData.name}
            </Text>
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {formData.email}
            </Text>
          </View>
        </View>

        {/* Personal Information - Updated styling */}
        <View 
          className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          style={styles.formCard}
        >
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Personal Information
          </Text>

          <View className="mb-4">
            <Text className={`mb-2 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Full Name
            </Text>
            <TextInput
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
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
              value={formData.email}
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
              value={formData.phone}
              onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
              keyboardType="phone-pad"
              className={`p-3 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'}`}
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              style={styles.input}
            />
          </View>
        </View>

        {/* Add Security Settings Section before Company Information */}
        <View 
          className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          style={styles.formCard}
        >
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Security Settings
          </Text>
          
          <TouchableOpacity
            onPress={handleChangePassword}
            className="flex-row items-center justify-between py-3"
          >
            <View className="flex-row items-center">
              <View className={`w-10 h-10 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'} items-center justify-center`}>
                <Ionicons 
                  name="lock-closed-outline" 
                  size={20} 
                  color={isDark ? '#FFFFFF' : '#111827'} 
                />
              </View>
              <Text className={`ml-3 text-base font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Change Password
              </Text>
            </View>
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={isDark ? '#9CA3AF' : '#6B7280'} 
            />
          </TouchableOpacity>
        </View>

        {/* Company Information - New section */}
        <View 
          className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          style={styles.formCard}
        >
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Company Information
          </Text>

          <View className="mb-4">
            <Text className={`mb-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Company Name
            </Text>
            <Text className={`text-base font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {user?.company_name || 'N/A'}
            </Text>
          </View>

          <View>
            <Text className={`mb-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Role
            </Text>
            <Text className={`text-base font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {user?.role || 'Management Personnel'}
            </Text>
          </View>
        </View>

        {/* Save Button - Updated styling */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isLoading}
          className={`p-4 rounded-lg bg-blue-500 mb-6 ${isLoading ? 'opacity-50' : ''}`}
          style={styles.saveButton}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-semibold text-lg">
              Save Changes
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// Update the styles
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
