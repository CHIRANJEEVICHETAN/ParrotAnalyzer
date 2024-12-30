import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

interface ProfileErrors {
  name?: string;
  email?: string;
  phone?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  company_name?: string;
}

interface Theme {
  theme: 'light' | 'dark';
  useTheme: () => { theme: 'light' | 'dark' };
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  const handleSave = async () => {
    try {
      setIsLoading(true);

      const form = new FormData();
      form.append('name', formData.name);
      form.append('phone', formData.phone);
      form.append('timeZone', formData.timeZone);

      if (newImageSelected && profileImage) {
        const response = await fetch(profileImage);
        const blob = await response.blob();
        form.append('profileImage', blob, 'profile.jpg');
      }

      await axios.put(
        `${process.env.EXPO_PUBLIC_API_URL}/api/users/profile`,
        form,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      Alert.alert('Success', 'Profile updated successfully');
      router.back();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
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

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <LinearGradient
        colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        style={[styles.header, { 
          paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0 
        }]}
      >
        <View className="flex-row items-center justify-between px-5">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-4 p-2 rounded-full"
              style={{ backgroundColor: isDark ? '#374151' : '#F3F4F6' }}
            >
              <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
            <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Profile Settings
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Profile Image Section - Updated styling */}
        <View className="items-center py-8 bg-white rounded-b-3xl shadow-sm">
          <TouchableOpacity 
            onPress={pickImage}
            className="relative"
          >
            {profileImage ? (
              <Image
                source={{ uri: newImageSelected ? profileImage : `data:image/jpeg;base64,${profileImage}` }}
                className="w-[100px] h-[100px] rounded-full"
                style={styles.profileImage}
              />
            ) : (
              <View className="w-[100px] h-[100px] rounded-full bg-blue-500 items-center justify-center">
                <Text className="text-white text-3xl font-bold">
                  {formData.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View className="absolute bottom-0 right-0 bg-blue-500 p-2.5 rounded-full shadow-lg" style={styles.cameraButton}>
              <Ionicons name="camera" size={22} color="white" />
            </View>
          </TouchableOpacity>
          
          <Text className="mt-4 text-lg font-semibold text-gray-900">
            {formData.name}
          </Text>
          <Text className="text-sm text-gray-500">
            {formData.email}
          </Text>
        </View>

        {/* Form Sections - Updated styling */}
        <View className="px-5 mt-6 space-y-6">
          {/* Personal Information */}
          <View className="bg-white p-5 rounded-2xl shadow-sm">
            <Text className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide mb-4">
              Personal Information
            </Text>
            
            <View className="space-y-4">
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </Text>
                <TextInput
                  value={formData.name}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                  className="p-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </Text>
                <TextInput
                  value={formData.email}
                  editable={false}
                  className="p-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] opacity-70"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </Text>
                <TextInput
                  value={formData.phone}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                  className="p-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>

          {/* Security Settings */}
          <View className="bg-white p-5 rounded-2xl shadow-sm">
            <Text className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide mb-4">
              Security Settings
            </Text>
            
            <TouchableOpacity
              onPress={handleChangePassword}
              className="flex-row items-center justify-between py-3"
            >
              <View className="flex-row items-center">
                <View className="w-[42px] h-[42px] rounded-full bg-[#F9FAFB] items-center justify-center">
                  <Ionicons name="lock-closed-outline" size={24} color="#000000" style={{ opacity: 0.9 }} />
                </View>
                <Text className="ml-4 text-[16px] font-semibold text-[#111827]">
                  Change Password
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Company Information */}
          <View className="bg-white p-5 rounded-2xl shadow-sm">
            <Text className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide mb-4">
              Company Information
            </Text>
            
            <View className="space-y-3">
              <View className="flex-row justify-between items-center">
                <Text className="text-gray-500">Company Name</Text>
                <Text className="font-medium text-gray-900">{user?.company_name || 'N/A'}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-gray-500">Role</Text>
                <Text className="font-medium text-gray-900">Management Personnel</Text>
              </View>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isLoading}
            className={`bg-blue-600 rounded-2xl py-4 shadow-lg ${isLoading ? 'opacity-70' : ''}`}
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
  },
  saveButton: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  }
});
