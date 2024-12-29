import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, StyleSheet, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

interface SettingItem {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    action: () => void;
    showArrow?: boolean;
    isSwitch?: boolean;
    switchValue?: boolean;
}

interface SettingSection {
    title: string;
    items: SettingItem[];
}

export default function ManagementSettings() {
    const { theme, toggleTheme } = ThemeContext.useTheme();
    const { logout } = AuthContext.useAuth();
    const router = useRouter();
    const isDark = theme === 'dark';

    const handleLogout = async () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await AsyncStorage.removeItem('userToken');
                        logout();
                        router.replace('/(auth)/signin');
                    }
                }
            ]
        );
    };

    const settingsSections: SettingSection[] = [
        {
            title: 'Account',
            items: [
                {
                    icon: 'person-outline',
                    label: 'Profile Settings',
                    action: () => router.push('/(dashboard)/management/settings/profile'),
                    showArrow: true
                },
                {
                    icon: 'shield-outline',
                    label: 'Privacy & Security',
                    action: () => router.push('/(dashboard)/management/settings/privacy'),
                    showArrow: true
                }
            ]
        },
        {
            title: 'Notifications',
            items: [
                {
                    icon: 'notifications-outline',
                    label: 'Notifications',
                    action: () => router.push('/(dashboard)/management/settings/notifications'),
                    showArrow: true
                }
            ]
        },
        {
            title: 'Management Tools',
            items: [
                {
                    icon: 'bar-chart-outline',
                    label: 'Report Settings',
                    action: () => router.push('/(dashboard)/management/settings/reports'),
                    showArrow: true
                },
                {
                    icon: 'people-outline',
                    label: 'Team Management',
                    action: () => router.push('/(dashboard)/management/settings/team'),
                    showArrow: true
                }
            ]
        },
        {
            title: 'Support',
            items: [
                {
                    icon: 'help-circle-outline',
                    label: 'Help & Support',
                    action: () => router.push('/(dashboard)/management/settings/help'),
                    showArrow: true
                },
                {
                    icon: 'information-circle-outline',
                    label: 'About',
                    action: () => router.push('/(dashboard)/management/settings/about'),
                    showArrow: true
                }
            ]
        },
        {
            title: 'Appearance',
            items: [
                {
                    icon: theme === 'dark' ? 'moon' : 'sunny',
                    label: 'Dark Mode',
                    isSwitch: true,
                    switchValue: theme === 'dark',
                    action: toggleTheme
                }
            ]
        }
    ];

    return (
        <View className="flex-1 bg-[#F9FAFB]">
            <StatusBar
                backgroundColor="#F9FAFB"
                barStyle="dark-content"
            />

            <View className="bg-[#F9FAFB]">
                <View className="flex-row items-center px-5 pt-4 pb-5">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-11 h-11 rounded-full bg-white items-center justify-center shadow-sm"
                    >
                        <Ionicons 
                            name="arrow-back" 
                            size={26} 
                            color="#000000"
                            style={{ marginLeft: -1 }}
                        />
                    </TouchableOpacity>
                    <Text className="text-[26px] font-bold text-[#111827] ml-4">
                        Settings
                    </Text>
                </View>
            </View>

            <ScrollView 
                className="flex-1 bg-[#F9FAFB]"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
                style={styles.scrollView}
            >
                {settingsSections.map((section, sectionIndex) => (
                    <View key={section.title} className="mb-7">
                        <Text className="px-5 py-2.5 text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide">
                            {section.title}
                        </Text>
                        <View className="mx-5 rounded-2xl bg-white border border-[#F3F4F6]">
                            {section.items.map((item, index) => (
                                <TouchableOpacity
                                    key={item.label}
                                    onPress={item.action}
                                    className={`flex-row items-center justify-between py-4 px-5 ${
                                        index !== section.items.length - 1 ? 'border-b border-[#F3F4F6]' : ''
                                    }`}
                                >
                                    <View className="flex-row items-center flex-1">
                                        <View className="w-[42px] h-[42px] rounded-full bg-[#F9FAFB] items-center justify-center">
                                            <Ionicons
                                                name={item.icon}
                                                size={24}
                                                color="#000000"
                                                style={{ opacity: 0.9 }}
                                            />
                                        </View>
                                        <Text className="ml-4 text-[16px] font-semibold text-[#111827]">
                                            {item.label}
                                        </Text>
                                    </View>
                                    {item.isSwitch ? (
                                        <Switch
                                            value={item.switchValue}
                                            onValueChange={item.action}
                                            trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
                                            thumbColor="#FFFFFF"
                                            style={{ transform: [{ scale: 0.85 }] }}
                                        />
                                    ) : item.showArrow && (
                                        <Ionicons
                                            name="chevron-forward"
                                            size={22}
                                            color="#9CA3AF"
                                        />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}

                <View className="h-6" />

                <TouchableOpacity
                    onPress={handleLogout}
                    className="mx-5 mb-5 bg-red-600 rounded-3xl"
                >
                    <Text className="text-white font-bold text-[17px] text-center py-4">
                        Logout
                    </Text>
                </TouchableOpacity>

                <View className="mb-10 items-center">
                    <Text className="text-[13px] font-medium text-gray-400">
                        Version 1.0.0
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    }
});
