import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar, TextInput, Alert, ScrollView, KeyboardAvoidingView } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../context/ThemeContext';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface PasswordForm {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

interface PasswordStrength {
    score: number;
    hasMinLength: boolean;
    hasUpperCase: boolean;
    hasLowerCase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
}

export default function ChangePasswordSettings() {
    const { theme } = ThemeContext.useTheme();
    const [loading, setLoading] = useState(false);
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });
    const [formData, setFormData] = useState<PasswordForm>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
        score: 0,
        hasMinLength: false,
        hasUpperCase: false,
        hasLowerCase: false,
        hasNumber: false,
        hasSpecialChar: false
    });

    const checkPasswordStrength = (password: string) => {
        const strength = {
            score: 0,
            hasMinLength: password.length >= 12,
            hasUpperCase: /[A-Z]/.test(password),
            hasLowerCase: /[a-z]/.test(password),
            hasNumber: /[0-9]/.test(password),
            hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };

        if (strength.hasMinLength) strength.score++;
        if (strength.hasUpperCase) strength.score++;
        if (strength.hasLowerCase) strength.score++;
        if (strength.hasNumber) strength.score++;
        if (strength.hasSpecialChar) strength.score++;

        setPasswordStrength(strength);
    };

    useEffect(() => {
        checkPasswordStrength(formData.newPassword);
    }, [formData.newPassword]);

    const getStrengthColor = () => {
        switch (passwordStrength.score) {
            case 0:
            case 1:
                return '#EF4444'; // red
            case 2:
            case 3:
                return '#F59E0B'; // yellow
            case 4:
                return '#10B981'; // green
            case 5:
                return '#059669'; // dark green
            default:
                return '#D1D5DB';
        }
    };

    const getStrengthText = () => {
        switch (passwordStrength.score) {
            case 0:
            case 1:
                return 'Very Weak';
            case 2:
            case 3:
                return 'Moderate';
            case 4:
                return 'Strong';
            case 5:
                return 'Very Strong';
            default:
                return 'Too Weak';
        }
    };

    const handleSubmit = async () => {
        // Enhanced validation
        if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
            Alert.alert('Error', 'All fields are required');
            return;
        }

        if (passwordStrength.score < 4) {
            Alert.alert('Error', 'Password is not strong enough. Please meet all requirements.');
            return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            Alert.alert('Error', 'New passwords do not match');
            return;
        }

        if (formData.newPassword === formData.currentPassword) {
            Alert.alert('Error', 'New password must be different from current password');
            return;
        }

        setLoading(true);
        try {
            await axios.post('/api/change-password', {
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword
            });

            Alert.alert('Success', 'Password changed successfully');
            setLoading(false);
        } catch (error) {
            Alert.alert('Error', 'Failed to change password. Please verify your current password.');
            setLoading(false);
        }
    };

    // Add animation states for eye press
    const handleEyePress = (field: 'current' | 'new' | 'confirm') => {
        if (Platform.OS === 'ios') {
            Haptics.selectionAsync();
        }
        setShowPasswords(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    // Add keyboard handling
    useEffect(() => {
        if (Platform.OS === 'ios') {
            // No keyboard manager setup needed
        }
    }, []);

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-white"
        >
            <StatusBar
                backgroundColor="transparent"
                barStyle="dark-content"
                translucent
            />

            {/* Header */}
            <View 
                className="bg-white"
                style={[styles.header]}
            >
                <View className="flex-row items-center px-4 pb-4">
                    <Link href="/super-admin/settings" asChild>
                        <TouchableOpacity
                            className="bg-gray-50 rounded-full p-4"
                        >
                            <Ionicons 
                                name="arrow-back" 
                                size={24} 
                                color="#111827"
                            />
                        </TouchableOpacity>
                    </Link>
                    <Text className="text-2xl font-bold text-gray-900 ml-4">
                        Security Settings
                    </Text>
                </View>
            </View>

            <ScrollView 
                className="flex-1 bg-gray-50" 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                <View className="px-4 py-4 space-y-6">
                    {/* Security Notice */}
                    <View className="bg-blue-50 rounded-2xl p-5 border border-blue-100 shadow-sm mt-2">
                        <View className="flex-row items-start space-x-3">
                            <Ionicons 
                                name="shield-checkmark" 
                                size={24} 
                                color="#2563EB"
                                style={{ marginTop: 2 }}
                            />
                            <View className="flex-1 space-y-1">
                                <Text className="text-blue-900 font-bold text-[17px]">
                                    Super Admin Security
                                </Text>
                                <Text className="text-blue-800 font-medium text-[15px] leading-[22px]">
                                    As a Super Admin, you have access to critical system settings. Please ensure your password meets high security standards.
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Change Password Section */}
                    <View className="space-y-2">
                        <Text className="text-[22px] font-bold text-gray-900">
                            Change Password
                        </Text>
                        <Text className="text-gray-600 text-[15px] leading-[22px]">
                            Create a strong password that includes a mix of letters, numbers, and symbols
                        </Text>
                    </View>

                    {/* Password Form Card */}
                    <View className="bg-white rounded-3xl shadow-md p-5 space-y-5">
                        {[
                            { 
                                label: 'Current Password', 
                                field: 'currentPassword',
                                show: 'current' 
                            },
                            { 
                                label: 'New Password', 
                                field: 'newPassword',
                                show: 'new' 
                            },
                            { 
                                label: 'Confirm New Password', 
                                field: 'confirmPassword',
                                show: 'confirm' 
                            }
                        ].map((input) => (
                            <View key={input.field} className="space-y-2">
                                <Text className="text-[15px] font-semibold text-gray-700 mb-1">
                                    {input.label}
                                </Text>
                                <View className="relative">
                                    <TextInput
                                        value={formData[input.field as keyof PasswordForm]}
                                        onChangeText={(text) => setFormData({ 
                                            ...formData, 
                                            [input.field]: text 
                                        })}
                                        secureTextEntry={!showPasswords[input.show as keyof typeof showPasswords]}
                                        placeholder={`Enter ${input.label.toLowerCase()}`}
                                        placeholderTextColor="#9CA3AF"
                                        className="bg-gray-50 px-4 h-[50px] rounded-xl text-gray-700 w-full border border-gray-200 text-[16px]"
                                    />
                                    <TouchableOpacity 
                                        onPress={() => handleEyePress(input.show as 'current' | 'new' | 'confirm')}
                                        className="absolute right-4 h-full justify-center"
                                    >
                                        <Ionicons
                                            name={showPasswords[input.show as keyof typeof showPasswords] 
                                                ? 'eye-outline' 
                                                : 'eye-off-outline'
                                            }
                                            size={22}
                                            color="#6B7280"
                                        />
                                    </TouchableOpacity>
                                </View>
                                {input.field === 'newPassword' && (
                                    <View className="mt-3 space-y-3">
                                        <View className="flex-row items-center justify-between">
                                            <Text className="text-[14px] font-medium text-gray-600">
                                                Password Strength:
                                            </Text>
                                            <Text className="text-[14px] font-semibold" style={{ color: getStrengthColor() }}>
                                                {getStrengthText()}
                                            </Text>
                                        </View>
                                        <View className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <View 
                                                className="h-full rounded-full" 
                                                style={{ 
                                                    width: `${(passwordStrength.score / 5) * 100}%`,
                                                    backgroundColor: getStrengthColor()
                                                }} 
                                            />
                                        </View>
                                        <View className="space-y-2 mt-2">
                                            {[
                                                { check: passwordStrength.hasMinLength, text: 'At least 12 characters' },
                                                { check: passwordStrength.hasUpperCase, text: 'Contains uppercase letter' },
                                                { check: passwordStrength.hasLowerCase, text: 'Contains lowercase letter' },
                                                { check: passwordStrength.hasNumber, text: 'Contains number' },
                                                { check: passwordStrength.hasSpecialChar, text: 'Contains special character' }
                                            ].map((requirement, index) => (
                                                <View key={index} className="flex-row items-center">
                                                    <Ionicons
                                                        name={requirement.check ? 'checkmark-circle' : 'close-circle'}
                                                        size={16}
                                                        color={requirement.check ? '#059669' : '#DC2626'}
                                                    />
                                                    <Text className={`ml-2 text-[13px] ${requirement.check ? 'text-green-700' : 'text-red-600'}`}>
                                                        {requirement.text}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </View>
                        ))}

                        {/* Update Password Button */}
                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={loading}
                            className={`h-[52px] rounded-xl w-full mt-4 flex items-center justify-center ${
                                loading ? 'bg-blue-400' : 'bg-blue-600'
                            }`}
                            style={{ 
                                shadowColor: '#2563EB',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.2,
                                shadowRadius: 8,
                                elevation: 4
                            }}
                        >
                            <Text className="text-white font-bold text-[17px]">
                                {loading ? 'Updating...' : 'Update Password'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight! + 10,
        paddingBottom: 10
    }
});
