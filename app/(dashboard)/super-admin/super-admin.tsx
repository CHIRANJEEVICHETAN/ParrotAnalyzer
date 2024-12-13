import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import ThemeContext from '../../context/ThemeContext';
import BottomNav from '../../components/BottomNav';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NavItem } from '../../types/nav';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

export default function SuperAdminDashboard() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();

    const navItems: NavItem[] = [
        { icon: 'home-outline', label: 'Home', href: '/(dashboard)/super-admin' },
        { icon: 'people-outline', label: 'Users', href: '/(dashboard)/super-admin/create-user' },
        { icon: 'settings-outline', label: 'Config', href: '/(dashboard)/super-admin/system-config' },
        { icon: 'document-outline', label: 'Reports', href: '/(dashboard)/super-admin/reports' },
        { icon: 'shield-outline', label: 'Security', href: '/(dashboard)/super-admin/security' },
    ];

    // Quick action items
    const quickActions = [
        { label: 'Create User', icon: 'person-add', action: () => router.push('/(dashboard)/super-admin/create-user') },
        { label: 'System Config', icon: 'settings', action: () => router.push('/(dashboard)/super-admin/system-config') },
        { label: 'Reports', icon: 'bar-chart', action: () => router.push('/(dashboard)/super-admin/reports') },
        { label: 'Security', icon: 'shield', action: () => router.push('/(dashboard)/super-admin/security') },
    ];

    return (
        <View className="flex-1" style={styles.container}>
            {/* Enhanced Header with Gradient */}
            <LinearGradient
                colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
                style={[styles.header, { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 0 }]}
            >
                <View className="flex-row items-center justify-between px-6">
                    <View>
                        <Text className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                              style={styles.headerTitle}>
                            Super Admin
                        </Text>
                        <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                            System Overview
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.push('/(dashboard)/super-admin/settings')}
                        className="p-2 rounded-full"
                        style={[styles.settingsButton, { backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6' }]}
                    >
                        <Ionicons
                            name="settings-outline"
                            size={24}
                            color={theme === 'dark' ? '#FFFFFF' : '#000000'}
                        />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView
                className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                showsVerticalScrollIndicator={false}
                style={styles.scrollView}
            >
                {/* Quick Actions */}
                <View className="px-6 py-4">
                    <Text className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                        Quick Actions
                    </Text>
                    <View className="flex-row flex-wrap justify-between">
                        {quickActions.map((action, index) => (
                            <TouchableOpacity
                                key={index}
                                onPress={action.action}
                                className={`w-[48%] p-4 rounded-xl mb-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                                style={styles.actionCard}
                            >
                                <View className={`p-2 rounded-lg mb-2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-blue-50'}`}>
                                    <Ionicons name={action.icon as any} size={24} color="#3B82F6" />
                                </View>
                                <Text className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                    {action.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* System Stats */}
                <View className="px-6 py-4">
                    <Text className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                        System Statistics
                    </Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="space-x-4"
                    >
                        {[
                            { label: 'Active Users', value: '1,234', trend: '+12%' },
                            { label: 'System Load', value: '45%', trend: '-5%' },
                            { label: 'Storage', value: '67%', trend: '+8%' },
                            { label: 'Response Time', value: '120ms', trend: '-15%' },
                        ].map((stat, index) => (
                            <View
                                key={index}
                                className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                                style={styles.statCard}
                            >
                                <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                    {stat.label}
                                </Text>
                                <Text className={`text-2xl font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {stat.value}
                                </Text>
                                <Text className={`${stat.trend.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                                    {stat.trend}
                                </Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* Recent Activities */}
                <View className="px-6 py-4 mb-20">
                    <Text className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                        Recent Activities
                    </Text>
                    <View className={`rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`} style={styles.activityCard}>
                        {[
                            { type: 'New user created', time: '2 mins ago', icon: 'person-add' },
                            { type: 'System update completed', time: '1 hour ago', icon: 'refresh' },
                            { type: 'Backup completed', time: '3 hours ago', icon: 'save' },
                        ].map((activity, index) => (
                            <View
                                key={index}
                                className={`p-4 flex-row items-center ${
                                    index !== 2 ? 'border-b border-gray-700' : ''
                                }`}
                            >
                                <View className={`p-2 rounded-full ${theme === 'dark' ? 'bg-gray-700' : 'bg-blue-50'}`}>
                                    <Ionicons name={activity.icon as any} size={20} color="#3B82F6" />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                        {activity.type}
                                    </Text>
                                    <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                        {activity.time}
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={20}
                                    color={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                                />
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>

            <BottomNav items={navItems} />
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
    headerTitle: {
        fontSize: 28,
        letterSpacing: 0.5,
    },
    settingsButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    scrollView: {
        bounces: true,
    },
    actionCard: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    statCard: {
        minWidth: 140,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    activityCard: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
}); 