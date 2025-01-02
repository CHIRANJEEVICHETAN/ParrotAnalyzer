import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, StatusBar, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Switch } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getHeaderPaddingTop } from '@/utils/statusBarHeight';

type TrackingSettings = {
    enableTracking: boolean;
    realTimeTracking: boolean;
    geofencingOnly: boolean;
    shiftBasedTracking: boolean;
    employeeViewHistory: boolean;
    geofenceNotifications: boolean;
};

type TrackingItem = {
    label: string;
    description: string;
    key: keyof TrackingSettings;
    icon: keyof typeof Ionicons.glyphMap;
    type: 'toggle';
};

export default function TrackingSettings() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();
    
    const [trackingSettings, setTrackingSettings] = useState<TrackingSettings>({
        enableTracking: true,
        realTimeTracking: false,
        geofencingOnly: true,
        shiftBasedTracking: true,
        employeeViewHistory: false,
        geofenceNotifications: true
    });

    useEffect(() => {
        loadSavedSettings();
    }, []);

    const loadSavedSettings = async () => {
        try {
            const savedSettings = await AsyncStorage.getItem('trackingSettings');
            if (savedSettings) {
                setTrackingSettings(JSON.parse(savedSettings));
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    const handleSettingChange = async (key: keyof TrackingSettings, value: boolean) => {
        try {
            const newSettings = {
                ...trackingSettings,
                [key]: value
            };
            
            setTrackingSettings(newSettings);
            
            await AsyncStorage.setItem('trackingSettings', JSON.stringify(newSettings));

            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
            setTrackingSettings(trackingSettings);
            Alert.alert('Error', 'Failed to update setting. Please try again.');
        }
    };

    const trackingSections = [
        {
            title: 'General Tracking',
            items: [
                {
                    label: 'Enable Tracking',
                    description: 'Turn on location tracking for all employees',
                    key: 'enableTracking',
                    icon: 'location',
                    type: 'toggle'
                },
                {
                    label: 'Real-Time Tracking',
                    description: 'Enable live location updates',
                    key: 'realTimeTracking',
                    icon: 'navigate',
                    type: 'toggle'
                }
            ]
        },
        {
            title: 'Tracking Configuration',
            items: [
                {
                    label: 'Geofencing Only',
                    description: 'Track only within defined boundaries',
                    key: 'geofencingOnly',
                    icon: 'map',
                    type: 'toggle'
                },
                {
                    label: 'Shift-Based Tracking',
                    description: 'Track only during work hours',
                    key: 'shiftBasedTracking',
                    icon: 'time',
                    type: 'toggle'
                },
                {
                    label: 'Geofence Notifications',
                    description: 'Alert on entry/exit from zones',
                    key: 'geofenceNotifications',
                    icon: 'notifications',
                    type: 'toggle'
                }
            ]
        },
        {
            title: 'Privacy Settings',
            items: [
                {
                    label: 'Employee History Access',
                    description: 'Allow employees to view their location history',
                    key: 'employeeViewHistory',
                    icon: 'eye',
                    type: 'toggle'
                }
            ]
        }
    ];

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.container}>
                <LinearGradient
                    colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
                    style={[styles.header, { paddingTop: getHeaderPaddingTop() }]}
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
                                    Tracking Settings
                                </Text>
                                <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                    Manage location tracking preferences
                                </Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                <ScrollView 
                    className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                    showsVerticalScrollIndicator={false}
                >
                    {trackingSections.map((section) => (
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
                                                        color={item.type === 'toggle' 
                                                            ? trackingSettings[item.key as keyof TrackingSettings] ? '#3B82F6' : (theme === 'dark' ? '#9CA3AF' : '#6B7280')
                                                            : '#3B82F6'
                                                        }
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
                                                <Switch
                                                    value={trackingSettings[item.key as keyof TrackingSettings]}
                                                    onValueChange={(value) => handleSettingChange(item.key as keyof TrackingSettings, value)}
                                                    trackColor={{ 
                                                        false: theme === 'dark' ? '#4B5563' : '#D1D5DB',
                                                        true: '#3B82F6'
                                                    }}
                                                    thumbColor={theme === 'dark' ? '#E5E7EB' : '#FFFFFF'}
                                                />
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))}
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
    }
});
