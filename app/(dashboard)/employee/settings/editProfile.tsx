import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image,
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
  phone?: string;
}

export default function EditProfile() {
  const { theme } = ThemeContext.useTheme();
  const { user, token, updateUser } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [newImageSelected, setNewImageSelected] = useState(false);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  // Load profile image on mount
  React.useEffect(() => {
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
      
      // Only set the profile image if one exists
      if (response.data.image) {
        setProfileImage(response.data.image);
      }
      // Don't throw an error if no image exists
    } catch (error) {
      console.error('Error fetching profile image:', error);
      // Don't show error to user for missing profile image
    }
  };

  const validateForm = () => {
    const newErrors: ProfileErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (formData.phone && !/^\+?[1-9]\d{9,11}$/.test(formData.phone)) {
      newErrors.phone = 'Invalid phone number format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('name', formData.name);
      formDataObj.append('phone', formData.phone);

      if (newImageSelected && profileImage) {
        try {
          const response = await fetch(profileImage);
          const blob = await response.blob();
          
          formDataObj.append('profileImage', {
            uri: profileImage,
            type: 'image/jpeg',
            name: 'profile.jpg',
          } as any);
          
        } catch (error) {
          console.error('Error processing image:', error);
          Alert.alert('Error', 'Failed to process profile image. Please try again with a different image.');
          setIsLoading(false);
          return;
        }
      }

      const response = await axios.put(
        `${process.env.EXPO_PUBLIC_API_URL}/api/users/profile`,
        formDataObj,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Accept': 'application/json',
            Authorization: `Bearer ${token}`
          },
          transformRequest: (data, headers) => {
            return formDataObj;
          },
        }
      );

      if (response.data) {
        updateUser(response.data);

        Alert.alert(
          'Success',
          'Profile updated successfully',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        throw new Error('No data received from server');
      }
    } catch (error: any) {
      console.error('Profile update error:', error);
      const errorMessage = error.response?.data?.error 
        || error.message 
        || 'Failed to update profile. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        className="pb-4"
        style={[styles.header, { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 0 }]}
      >
        <View className="flex-row items-center justify-between px-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2 rounded-full"
            style={{ backgroundColor: isDark ? '#374151' : '#F3F4F6' }}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
          <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Edit Profile
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <View className={`flex-1 p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <View className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={styles.card}>
          {/* Profile Image */}
          <View className="items-center mb-6">
            <TouchableOpacity onPress={pickImage}>
              {profileImage ? (
                <Image
                  source={{ 
                    uri: newImageSelected 
                      ? profileImage 
                      : `data:image/jpeg;base64,${profileImage}`
                  }}
                  className="w-24 h-24 rounded-full"
                  style={styles.profileImage}
                />
              ) : (
                <View className="w-24 h-24 rounded-full bg-blue-500 items-center justify-center" style={styles.profileImage}>
                  <Text className="text-white text-3xl font-bold">
                    {formData.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View className="absolute bottom-0 right-0 bg-blue-500 p-2 rounded-full" style={styles.cameraButton}>
                <Ionicons name="camera" size={20} color="white" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Name Input */}
          <View className="mb-6">
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Full Name
            </Text>
            <TextInput
              value={formData.name}
              onChangeText={(text) => {
                setFormData(prev => ({ ...prev, name: text }));
                if (errors.name) {
                  setErrors(prev => ({ ...prev, name: undefined }));
                }
              }}
              className={`p-4 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'} 
                ${errors.name ? 'border-2 border-red-500' : 'border border-gray-200'}`}
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              placeholder="Enter your name"
            />
            {errors.name && (
              <Text className="mt-1 text-red-500 text-sm">{errors.name}</Text>
            )}
          </View>

          {/* Phone Input */}
          <View className="mb-8">
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Phone Number
            </Text>
            <TextInput
              value={formData.phone}
              onChangeText={(text) => {
                setFormData(prev => ({ ...prev, phone: text }));
                if (errors.phone) {
                  setErrors(prev => ({ ...prev, phone: undefined }));
                }
              }}
              className={`p-4 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'} 
                ${errors.phone ? 'border-2 border-red-500' : 'border border-gray-200'}`}
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
            />
            {errors.phone && (
              <Text className="mt-1 text-red-500 text-sm">{errors.phone}</Text>
            )}
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading}
            className={`py-4 rounded-lg bg-blue-500 ${isLoading ? 'opacity-50' : ''}`}
            style={styles.submitButton}
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
      </View>
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
  profileImage: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  submitButton: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  cameraButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'white',
  }
});
