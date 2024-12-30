import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../context/ThemeContext';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export default function ManagementProfile() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();
    const [profileData, setProfileData] = useState({
        name: '',
        email: '',
        phone: '',
        role: '',
        company_name: '',
        profile_image: '',
    });

    useEffect(() => {
        const checkStorage = async () => {
            try {
                const keys = await AsyncStorage.getAllKeys();
                console.log('All AsyncStorage keys:', keys);
                
                // Log all items
                for (let key of keys) {
                    const value = await AsyncStorage.getItem(key);
                    console.log(`${key}:`, value);
                }
            } catch (error) {
                console.error('Error checking storage:', error);
            }
        };
        
        checkStorage();
        fetchProfileData();
    }, []);

    const fetchProfileData = async () => {
        try {
            const token = await AsyncStorage.getItem('auth_token');
            
            if (!token) {
                console.log('No token found in storage');
                return; // Don't redirect immediately for debugging
            }

            console.log('Found token:', token);

            // Fetch profile data
            const response = await axios.get(
                `${process.env.EXPO_PUBLIC_API_URL}/api/management/profile`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            if (response.data) {
                setProfileData({
                    name: response.data.name || '',
                    email: response.data.email || '',
                    phone: response.data.phone || '',
                    role: response.data.role || '',
                    company_name: response.data.company_name || '',
                    profile_image: response.data.profile_image || '',
                });

                // If profile image is not included in the main response, fetch it separately
                if (!response.data.profile_image) {
                    const imageResponse = await axios.get(
                        `${process.env.EXPO_PUBLIC_API_URL}/api/users/profile-image/${response.data.id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (imageResponse.data.image) {
                        setProfileData(prev => ({
                            ...prev,
                            profile_image: imageResponse.data.image
                        }));
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            if (axios.isAxiosError(error)) {
                console.log('Error response:', error.response?.data);
                if (error.response?.status === 401) {
                    await AsyncStorage.removeItem('auth_token');
                    router.replace('/(auth)/signin');
                }
            }
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
                style={[styles.header, { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 0 }]}
            >
                <View className="flex-row items-center px-6 relative">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="p-2 rounded-full absolute left-4"
                        style={[styles.backButton, { backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6' }]}
                    >
                        <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFFFFF' : '#000000'} />
                    </TouchableOpacity>
                    <View className="flex-1 items-center">
                        <Text className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            Profile
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView 
                className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                showsVerticalScrollIndicator={false}
            >
                {/* Enhanced Profile Header */}
                <View className={`p-8 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`} style={styles.profileHeader}>
                    <View className="items-center">
                        <View style={styles.imageContainer}>
                            {profileData.profile_image ? (
                                <Image
                                    source={{ uri: `data:image/jpeg;base64,${profileData.profile_image}` }}
                                    style={styles.profileImage}
                                />
                            ) : (
                                <View style={[styles.profileImage, styles.defaultAvatar]}>
                                    <Text style={styles.avatarText}>
                                        {profileData.name
                                            ? profileData.name
                                                  .split(' ')
                                                  .map(name => name[0])
                                                  .slice(0, 2)
                                                  .join('')
                                                  .toUpperCase()
                                            : 'U'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text className={`text-2xl font-bold mt-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {profileData.name}
                        </Text>
                        <Text className={`text-lg ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            {profileData.role}
                        </Text>
                        <Text className={`mt-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                            {profileData.company_name}
                        </Text>
                    </View>
                </View>

                {/* Enhanced Profile Details */}
                <View className="p-6">
                    <View className={`rounded-2xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`} style={styles.detailsCard}>
                        {[
                            { label: 'Email', value: profileData.email, icon: 'mail' },
                            { label: 'Phone', value: profileData.phone, icon: 'call' },
                            { label: 'Company', value: profileData.company_name, icon: 'business' },
                        ].map((detail, index) => (
                            <View
                                key={detail.label}
                                className={`flex-row items-center p-5 ${
                                    index !== 2 ? 'border-b' : ''
                                } ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}
                            >
                                <View style={styles.iconContainer}>
                                    <Ionicons name={detail.icon as any} size={24} color="#3B82F6" />
                                </View>
                                <View className="ml-4 flex-1">
                                    <Text className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {detail.label}
                                    </Text>
                                    <Text className={`text-base font-medium mt-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                        {detail.value}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        paddingBottom: 16,
    },
    backButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    profileHeader: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    imageContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#F3F4F6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    profileImage: {
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 4,
        borderColor: '#FFFFFF',
    },
    detailsCard: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#EBF5FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    defaultAvatar: {
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: '#FFFFFF',
    },
    avatarText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
});
