import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, StatusBar, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Switch } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '../../../context/AuthContext';
import axios from 'axios';
import { TextInput } from 'react-native-gesture-handler';

type TrackingSettings = {
    id?: number;
    company_id?: number;
    default_tracking_precision: 'low' | 'medium' | 'high';
    update_interval_seconds: number;
    battery_saving_enabled: boolean;
    indoor_tracking_enabled: boolean;
    updated_at?: string;
};

type TrackingItem = {
    label: string;
    description: string;
    key: keyof TrackingSettings;
    icon: string;
    type: 'toggle' | 'select' | 'input';
    options?: string[];
};

export default function TrackingSettings() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();
    const { token } = useAuth();
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [trackingSettings, setTrackingSettings] = useState<TrackingSettings>({
        default_tracking_precision: 'medium',
        update_interval_seconds: 30,
        battery_saving_enabled: true,
        indoor_tracking_enabled: false
    });

    const [intervalInput, setIntervalInput] = useState('');

    useEffect(() => {
        fetchTrackingSettings();
    }, []);

    const fetchTrackingSettings = async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            const response = await axios.get(
                `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-tracking/tracking-settings`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            // If we have settings from the server, use them
            if (response.data) {
                setTrackingSettings(response.data);
                setIntervalInput(response.data.update_interval_seconds.toString());
            }
            
        } catch (error) {
            console.error('Error fetching tracking settings:', error);
            setError('Failed to load tracking settings. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const saveTrackingSettings = async () => {
        try {
            setIsSaving(true);
            setError(null);
            
            // Update the update_interval_seconds from the input
            const updatedSettings = {
                ...trackingSettings,
                update_interval_seconds: parseInt(intervalInput) || 30
            };
            
            await axios.put(
                `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-tracking/tracking-settings`,
                updatedSettings,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            setTrackingSettings(updatedSettings);
            Alert.alert('Success', 'Tracking settings updated successfully');
            
        } catch (error) {
            console.error('Error saving tracking settings:', error);
            setError('Failed to save tracking settings. Please try again.');
            Alert.alert('Error', 'Failed to save tracking settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSettingChange = async (key: keyof TrackingSettings, value: any) => {
        try {
            const newSettings = {
                ...trackingSettings,
                [key]: value
            };
            
            setTrackingSettings(newSettings);
            
            // For input field, we don't want to save on every change
            if (key === 'update_interval_seconds') {
                setIntervalInput(value.toString());
                return;
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to update setting. Please try again.');
        }
    };

    const handlePrecisionChange = (precision: 'low' | 'medium' | 'high') => {
        setTrackingSettings({
            ...trackingSettings,
            default_tracking_precision: precision
        });
    };

    const trackingSections = [
        {
            title: 'Tracking Precision',
            items: [
                {
                    label: 'Default Precision',
                    description: 'Set default tracking precision for all employees',
                    key: 'default_tracking_precision',
                    icon: 'locate',
                    type: 'select',
                    options: ['low', 'medium', 'high']
                }
            ]
        },
        {
            title: 'Update Frequency',
            items: [
                {
                    label: 'Update Interval',
                    description: 'How often location updates are sent (in seconds)',
                    key: 'update_interval_seconds',
                    icon: 'time',
                    type: 'input'
                }
            ]
        },
        {
            title: 'Tracking Configuration',
            items: [
                {
                    label: 'Battery Saving Mode',
                    description: 'Optimize battery usage by reducing updates when stationary',
                    key: 'battery_saving_enabled',
                    icon: 'battery-charging',
                    type: 'toggle'
                },
                {
                    label: 'Indoor Tracking Mode',
                    description: 'Enhance tracking accuracy in indoor environments',
                    key: 'indoor_tracking_enabled',
                    icon: 'home',
                    type: 'toggle'
                }
            ]
        }
    ];

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: theme === 'dark' ? '#1F2937' : '#F3F4F6', flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme === 'dark' ? '#60A5FA' : '#3B82F6'} />
                <Text style={{ marginTop: 10, color: theme === 'dark' ? '#E5E7EB' : '#374151' }}>
                    Loading tracking settings...
                </Text>
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.container}>
                <LinearGradient
                    colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
                    style={[styles.header, { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 10 }]}
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
                        <TouchableOpacity
                            onPress={saveTrackingSettings}
                            disabled={isSaving}
                            style={{ 
                                backgroundColor: theme === 'dark' ? '#3B82F6' : '#2563EB',
                                padding: 10,
                                borderRadius: 8
                            }}
                        >
                            {isSaving ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={{ color: '#FFFFFF', fontWeight: '500' }}>Save</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                <ScrollView 
                    className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                    showsVerticalScrollIndicator={false}
                >
                    {error && (
                        <View style={{ padding: 16, backgroundColor: theme === 'dark' ? '#EF4444' : '#FEE2E2', margin: 16, borderRadius: 8 }}>
                            <Text style={{ color: theme === 'dark' ? '#FFFFFF' : '#B91C1C' }}>{error}</Text>
                        </View>
                    )}
                    
                    <View className="mb-6">
                        <Text 
                            className={`px-6 py-2 text-sm font-medium ${
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}
                        >
                            Tracking Precision
                        </Text>
                        <View 
                            className={`mx-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                            style={styles.sectionContainer}
                        >
                            <View className="p-4">
                                <Text 
                                    className={`text-base font-medium mb-2 ${
                                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    }`}
                                >
                                    Default Precision
                                </Text>
                                <Text 
                                    className={`mt-0.5 mb-4 ${
                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                    }`}
                                >
                                    Set default tracking precision for all employees
                                </Text>
                                <View className="flex-row mt-2">
                                    {(['low', 'medium', 'high'] as const).map((precision) => (
                                        <TouchableOpacity
                                            key={precision}
                                            style={{
                                                flex: 1,
                                                marginHorizontal: 4,
                                                paddingVertical: 12,
                                                borderRadius: 8,
                                                alignItems: 'center',
                                                backgroundColor: 
                                                    trackingSettings.default_tracking_precision === precision
                                                        ? '#3B82F6'
                                                        : theme === 'dark' ? '#374151' : '#F3F4F6',
                                            }}
                                            onPress={() => handlePrecisionChange(precision)}
                                        >
                                            <Text
                                                style={{
                                                    color: 
                                                        trackingSettings.default_tracking_precision === precision
                                                            ? '#FFFFFF'
                                                            : theme === 'dark' ? '#E5E7EB' : '#374151',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                {precision.charAt(0).toUpperCase() + precision.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>
                    </View>

                    <View className="mb-6">
                        <Text 
                            className={`px-6 py-2 text-sm font-medium ${
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}
                        >
                            Update Frequency
                        </Text>
                        <View 
                            className={`mx-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                            style={styles.sectionContainer}
                        >
                            <View className="p-4">
                                <Text 
                                    className={`text-base font-medium mb-2 ${
                                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    }`}
                                >
                                    Update Interval
                                </Text>
                                <Text 
                                    className={`mt-0.5 mb-4 ${
                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                    }`}
                                >
                                    How often location updates are sent (in seconds)
                                </Text>
                                <View className="flex-row items-center mt-2">
                                    <TextInput
                                        style={{
                                            flex: 1,
                                            height: 48,
                                            backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6',
                                            borderRadius: 8,
                                            paddingHorizontal: 16,
                                            color: theme === 'dark' ? '#E5E7EB' : '#374151',
                                        }}
                                        value={intervalInput}
                                        onChangeText={setIntervalInput}
                                        keyboardType="numeric"
                                        placeholder="Enter seconds"
                                        placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                                    />
                                    <Text 
                                        className={`ml-2 ${
                                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                        }`}
                                    >
                                        seconds
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View className="mb-6">
                        <Text 
                            className={`px-6 py-2 text-sm font-medium ${
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}
                        >
                            Tracking Configuration
                        </Text>
                        <View 
                            className={`mx-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                            style={styles.sectionContainer}
                        >
                            {trackingSections[2].items.map((item, index) => (
                                <View 
                                    key={item.key}
                                    className={`p-4 ${
                                        index !== trackingSections[2].items.length - 1 
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
                                                    color={Boolean(trackingSettings[item.key as keyof TrackingSettings]) ? '#3B82F6' : (theme === 'dark' ? '#9CA3AF' : '#6B7280')}
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
                                                value={Boolean(trackingSettings[item.key as keyof TrackingSettings])}
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
