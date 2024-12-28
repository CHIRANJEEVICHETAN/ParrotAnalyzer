import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, StatusBar, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Switch } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SecuritySettings = {
    passwordExpiry: boolean;
    loginNotifications: boolean;
    employeeDataVisibility: boolean;
    activityTracking: boolean;
    securityAlerts: boolean;
};

type SecurityItem = {
    label: string;
    description: string;
    key: keyof SecuritySettings;
    icon: string;
};

export default function PrivacySecurity() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();
    
    const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
        // Account Security
        passwordExpiry: true,
        loginNotifications: true,
        
        // Privacy Settings
        employeeDataVisibility: true,
        activityTracking: true,
        
        // Notifications
        securityAlerts: true
    });

    // Load saved settings when component mounts
    useEffect(() => {
        loadSavedSettings();
    }, []);

    const loadSavedSettings = async () => {
        try {
            const savedSettings = await AsyncStorage.getItem('securitySettings');
            if (savedSettings) {
                setSecuritySettings(JSON.parse(savedSettings));
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    // Recent security events - Simplified
    const securityEvents = [
        {
            type: 'success',
            message: 'Password updated',
            details: 'Account security enhanced',
            time: '1 hour ago'
        },
        {
            type: 'info',
            message: 'Privacy settings changed',
            details: 'Employee data visibility updated',
            time: '2 hours ago'
        }
    ];

    const securitySections: {title: string; items: SecurityItem[]}[] = [
        {
            title: 'Account Security',
            items: [
                {
                    label: 'Password Expiry',
                    description: 'Require password change every 90 days',
                    key: 'passwordExpiry',
                    icon: 'key-outline'
                },
                {
                    label: 'Login Notifications',
                    description: 'Get notified of new login attempts',
                    key: 'loginNotifications',
                    icon: 'notifications-outline'
                }
            ]
        },
        {
            title: 'Privacy Settings',
            items: [
                {
                    label: 'Employee Data Visibility',
                    description: 'Control who can view employee details',
                    key: 'employeeDataVisibility',
                    icon: 'eye-outline'
                },
                {
                    label: 'Activity Tracking',
                    description: 'Track employee app usage and actions',
                    key: 'activityTracking',
                    icon: 'footsteps-outline'
                }
            ]
        },
        {
            title: 'Notifications',
            items: [
                {
                    label: 'Security Alerts',
                    description: 'Get notified of suspicious activities',
                    key: 'securityAlerts',
                    icon: 'warning-outline'
                }
            ]
        }
    ];

    const handleSettingChange = async (key: keyof SecuritySettings, value: boolean) => {
        try {
            const newSettings = {
                ...securitySettings,
                [key]: value
            };
            
            // Update state immediately for responsive UI
            setSecuritySettings(newSettings);
            
            // Save to AsyncStorage
            await AsyncStorage.setItem('securitySettings', JSON.stringify(newSettings));

            // API call would go here
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
            // Revert if save fails
            setSecuritySettings(securitySettings);
            Alert.alert('Error', 'Failed to update setting. Please try again.');
        }
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.container}>
                <LinearGradient
                    colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
                    style={[styles.header, { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 0 }]}
                >
                    <View className="flex-row items-center justify-between px-6">
                        <View className="flex-row items-center">
                            <TouchableOpacity
                                onPress={() => router.back()}
                                className="mr-4 p-2 rounded-full"
                                style={[styles.backButton, { backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6' }]}
                            >
                                <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFFFFF' : '#000000'} />
                            </TouchableOpacity>
                            <View>
                                <Text className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    Privacy & Security
                                </Text>
                                <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                    Manage your privacy and security settings
                                </Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                <ScrollView 
                    className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Security Settings */}
                    {securitySections.map((section) => (
                        <View key={section.title} className="mb-6">
                            <Text 
                                className={`px-6 py-2 text-sm font-medium ${
                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                }`}
                            >
                                {section.title}
                            </Text>
                            <View 
                                className={`mx-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                                style={styles.sectionContainer}
                            >
                                {section.items.map((item, index) => (
                                    <View 
                                        key={item.key}
                                        className={`p-4 ${
                                            index !== section.items.length - 1 
                                                ? `border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}` 
                                                : ''
                                        }`}
                                    >
                                        <View className="flex-row items-center justify-between">
                                            <View className="flex-row items-center flex-1">
                                                <View 
                                                    className={`w-10 h-10 rounded-full items-center justify-center ${
                                                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                                    }`}
                                                >
                                                    <Ionicons 
                                                        name={item.icon as any} 
                                                        size={22} 
                                                        color={securitySettings[item.key] ? '#3B82F6' : (theme === 'dark' ? '#9CA3AF' : '#6B7280')}
                                                    />
                                                </View>
                                                <View className="ml-4 flex-1">
                                                    <Text 
                                                        className={`text-base font-medium ${
                                                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                                                        }`}
                                                    >
                                                        {item.label}
                                                    </Text>
                                                    <Text 
                                                        className={`mt-0.5 ${
                                                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                                        }`}
                                                    >
                                                        {item.description}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Switch
                                                value={securitySettings[item.key]}
                                                onValueChange={(value) => handleSettingChange(item.key, value)}
                                                trackColor={{ false: '#767577', true: '#3B82F6' }}
                                                thumbColor={theme === 'dark' ? '#FFFFFF' : '#F3F4F6'}
                                            />
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))}

                    {/* Recent Security Events */}
                    <View className="px-6 mb-8">
                        <Text className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            Recent Events
                        </Text>
                        <View 
                            className={`rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                            style={styles.eventsContainer}
                        >
                            {securityEvents.map((event, index) => (
                                <View 
                                    key={index}
                                    className={`p-4 ${
                                        index !== securityEvents.length - 1 
                                            ? `border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}` 
                                            : ''
                                    }`}
                                >
                                    <View className="flex-row items-center mb-2">
                                        <View 
                                            className={`w-2.5 h-2.5 rounded-full mr-3 ${
                                                event.type === 'warning' ? 'bg-yellow-500' :
                                                event.type === 'error' ? 'bg-red-500' : 'bg-green-500'
                                            }`}
                                        />
                                        <Text className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                            {event.message}
                                        </Text>
                                    </View>
                                    <Text className={`ml-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {event.details}
                                    </Text>
                                    <Text className={`ml-5 text-sm mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {event.time}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </View>
        </GestureHandlerRootView>
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
    sectionContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    eventsContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
});
