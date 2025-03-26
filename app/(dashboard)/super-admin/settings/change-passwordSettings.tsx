import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar, TextInput, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ThemeContext from '../../../context/ThemeContext';
import axios from 'axios';
interface PasswordRequirement {
    label: string;
    check: (password: string) => boolean;
    met: boolean;
}

export default function ChangePasswordSettings() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);

    // Password requirements with validation functions
    const [requirements] = useState<PasswordRequirement[]>([
        {
            label: 'At least 8 characters long',
            check: (pwd) => pwd.length >= 8,
            met: false
        },
        {
            label: 'Contains at least one uppercase letter',
            check: (pwd) => /[A-Z]/.test(pwd),
            met: false
        },
        {
            label: 'Contains at least one lowercase letter',
            check: (pwd) => /[a-z]/.test(pwd),
            met: false
        },
        {
            label: 'Contains at least one number',
            check: (pwd) => /\d/.test(pwd),
            met: false
        },
        {
            label: 'Contains at least one special character',
            check: (pwd) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
            met: false
        }
    ]);

    // Update requirements check when password changes
    const checkRequirements = (password: string) => {
        return requirements.map(req => ({
            ...req,
            met: req.check(password)
        }));
    };

    const [currentRequirements, setCurrentRequirements] = useState(requirements);

    const handlePasswordChange = async () => {
        try {
            // Validate all requirements are met
            const unmetRequirements = currentRequirements.filter(req => !req.met);
            if (unmetRequirements.length > 0) {
                Alert.alert('Invalid Password', 'Please meet all password requirements');
                return;
            }

            // Validate passwords match
            if (newPassword !== confirmPassword) {
                Alert.alert('Error', 'New passwords do not match');
                return;
            }

            setLoading(true);

            const token = await AsyncStorage.getItem('auth_token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const response = await axios.post(
                `${process.env.EXPO_PUBLIC_API_URL}/api/super-admin/change-password`,
                {  // request body
                    currentPassword,
                    newPassword
                },
                {  // config object
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const data = response.data;

            if (!response.status || response.status >= 400) {
                throw new Error(data.error || 'Failed to change password');
            }

            Alert.alert('Success', 'Password changed successfully', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: theme === 'dark' ? '#111827' : '#F3F4F6' }}>
            <StatusBar
                backgroundColor={theme === 'dark' ? '#1F2937' : '#FFFFFF'}
                barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
            />

            {/* Header */}
            <View 
                className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                style={styles.header}
            >
                <View className="flex-row items-center justify-between px-4 pt-3 pb-4">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className={`p-2 rounded-full ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
                        style={styles.backButton}
                    >
                        <Ionicons 
                            name="arrow-back" 
                            size={24} 
                            color={theme === 'dark' ? '#FFFFFF' : '#111827'} 
                        />
                    </TouchableOpacity>
                    <Text className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        Change Password
                    </Text>
                    <View style={{ width: 40 }} />
                </View>
            </View>

            <ScrollView 
                className="flex-1 px-4 py-6"
                showsVerticalScrollIndicator={false}
            >
                {/* Current Password */}
                <View className="mb-6">
                    <Text className={`text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                        Current Password
                    </Text>
                    <View className="flex-row items-center">
                        <TextInput
                            className={`flex-1 px-4 py-3 rounded-lg ${
                                theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'
                            }`}
                            secureTextEntry={!showCurrent}
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            placeholder="Enter current password"
                            placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                        />
                        <TouchableOpacity 
                            onPress={() => setShowCurrent(!showCurrent)}
                            className="absolute right-4"
                        >
                            <Ionicons 
                                name={showCurrent ? 'eye-off' : 'eye'} 
                                size={24} 
                                color={theme === 'dark' ? '#9CA3AF' : '#6B7280'} 
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* New Password */}
                <View className="mb-6">
                    <Text className={`text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                        New Password
                    </Text>
                    <View className="flex-row items-center">
                        <TextInput
                            className={`flex-1 px-4 py-3 rounded-lg ${
                                theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'
                            }`}
                            secureTextEntry={!showNew}
                            value={newPassword}
                            onChangeText={(text) => {
                                setNewPassword(text);
                                setCurrentRequirements(checkRequirements(text));
                            }}
                            placeholder="Enter new password"
                            placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                        />
                        <TouchableOpacity 
                            onPress={() => setShowNew(!showNew)}
                            className="absolute right-4"
                        >
                            <Ionicons 
                                name={showNew ? 'eye-off' : 'eye'} 
                                size={24} 
                                color={theme === 'dark' ? '#9CA3AF' : '#6B7280'} 
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Confirm Password */}
                <View className="mb-6">
                    <Text className={`text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                        Confirm New Password
                    </Text>
                    <View className="flex-row items-center">
                        <TextInput
                            className={`flex-1 px-4 py-3 rounded-lg ${
                                theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'
                            }`}
                            secureTextEntry={!showConfirm}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Confirm new password"
                            placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                        />
                        <TouchableOpacity 
                            onPress={() => setShowConfirm(!showConfirm)}
                            className="absolute right-4"
                        >
                            <Ionicons 
                                name={showConfirm ? 'eye-off' : 'eye'} 
                                size={24} 
                                color={theme === 'dark' ? '#9CA3AF' : '#6B7280'} 
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Password Requirements */}
                <View className="mb-6">
                    <Text className={`text-sm font-medium mb-3 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                        Password Requirements:
                    </Text>
                    {currentRequirements.map((req, index) => (
                        <View key={index} className="flex-row items-center mb-2">
                            <Ionicons 
                                name={req.met ? 'checkmark-circle' : 'close-circle'} 
                                size={20} 
                                color={req.met ? '#10B981' : '#EF4444'}
                            />
                            <Text className={`ml-2 ${
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                                {req.label}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    onPress={handlePasswordChange}
                    disabled={loading}
                    className={`py-3 px-4 rounded-lg ${
                        loading 
                            ? 'bg-gray-400' 
                            : theme === 'dark' 
                                ? 'bg-blue-500' 
                                : 'bg-blue-600'
                    }`}
                >
                    <Text className="text-white text-center font-semibold">
                        {loading ? 'Changing Password...' : 'Change Password'}
                    </Text>
                </TouchableOpacity>

                {/* Security Note */}
                <View className="mt-6 p-4 rounded-lg bg-yellow-50">
                    <Text className="text-yellow-800 text-sm">
                        Security Note: As a super admin, your password is crucial for system security. 
                        Make sure to use a strong, unique password and never share it with anyone. 
                        Consider using a password manager for secure storage.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    }
});
