import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, StatusBar, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import { format } from 'date-fns';

interface Notification {
    id: number;
    title: string;
    message: string;
    type: 'expense' | 'shift' | 'compliance' | 'announcement';
    priority: 'high' | 'medium' | 'low';
    read: boolean;
    created_at: string;
    action_url?: string;
}

type NotificationType = 'all' | 'expense' | 'shift' | 'compliance' | 'announcement';

const mockNotifications: Notification[] = [
    {
        id: 1,
        title: 'New Expense Request',
        message: 'John Doe submitted a new expense for ₹5,000',
        type: 'expense',
        priority: 'high',
        read: false,
        created_at: new Date().toISOString(),
        action_url: '/expenses/123'
    },
    {
        id: 2,
        title: 'Shift Schedule Update',
        message: 'Sarah Smith updated their shift timing for tomorrow',
        type: 'shift',
        priority: 'medium',
        read: false,
        created_at: new Date(Date.now() - 3600000).toISOString(),
        action_url: '/shifts/456'
    },
    {
        id: 3,
        title: 'Policy Compliance Alert',
        message: 'Multiple employees have pending timesheet submissions',
        type: 'compliance',
        priority: 'high',
        read: true,
        created_at: new Date(Date.now() - 7200000).toISOString()
    },
    {
        id: 4,
        title: 'Company Announcement',
        message: 'New expense policy updates effective from next month',
        type: 'announcement',
        priority: 'medium',
        read: true,
        created_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
        id: 5,
        title: 'Late Check-in Alert',
        message: 'Employee Mike Johnson checked in 30 minutes late',
        type: 'shift',
        priority: 'low',
        read: false,
        created_at: new Date(Date.now() - 7200000).toISOString()
    },
    {
        id: 6,
        title: 'Expense Approval Required',
        message: 'Travel expense of ₹12,000 needs your approval',
        type: 'expense',
        priority: 'high',
        read: false,
        created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
        id: 7,
        title: 'Compliance Training Due',
        message: 'Annual compliance training deadline approaching',
        type: 'compliance',
        priority: 'medium',
        read: true,
        created_at: new Date(Date.now() - 172800000).toISOString()
    },
    {
        id: 8,
        title: 'Holiday Announcement',
        message: 'Office will be closed next Friday for annual maintenance',
        type: 'announcement',
        priority: 'low',
        read: true,
        created_at: new Date(Date.now() - 259200000).toISOString()
    }
];

export default function Notifications() {
    const { theme } = ThemeContext.useTheme();
    const { token } = AuthContext.useAuth();
    const router = useRouter();
    const isDark = theme === 'dark';

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<NotificationType>('all');
    const [selectedPriority, setSelectedPriority] = useState<string>('all');
    const [refreshing, setRefreshing] = useState(false);

    // Tabs configuration
    const tabs: { id: NotificationType; label: string; icon: string }[] = [
        { id: 'all', label: 'All', icon: 'notifications' },
        { id: 'expense', label: 'Expenses', icon: 'cash' },
        { id: 'shift', label: 'Shifts', icon: 'time' },
        { id: 'compliance', label: 'Compliance', icon: 'shield-checkmark' },
        { id: 'announcement', label: 'Announcements', icon: 'megaphone' }
    ];

    // Priority options
    const priorities = [
        { value: 'all', label: 'All Priorities' },
        { value: 'high', label: 'High Priority' },
        { value: 'medium', label: 'Medium Priority' },
        { value: 'low', label: 'Low Priority' }
    ];

    const getIconName = (type: string): keyof typeof Ionicons.glyphMap => {
        switch (type) {
            case 'expense': return 'cash';
            case 'shift': return 'time';
            case 'compliance': return 'shield-checkmark';
            case 'announcement': return 'megaphone';
            default: return 'notifications';
        }
    };

    const getPriorityColor = (priority: string): string => {
        switch (priority) {
            case 'high': return '#EF4444';
            case 'medium': return '#F59E0B';
            case 'low': return '#10B981';
            default: return '#6B7280';
        }
    };

    const filteredNotifications = notifications.filter(notification => {
        const typeMatch = activeTab === 'all' || notification.type === activeTab;
        const priorityMatch = selectedPriority === 'all' || notification.priority === selectedPriority;
        return typeMatch && priorityMatch;
    });

    useEffect(() => {
        // Simulate API call delay
        const loadData = async () => {
            try {
                await new Promise(resolve => setTimeout(resolve, 1000));
                setNotifications(mockNotifications);
                setLoading(false);
            } catch (error) {
                console.error('Error loading notifications:', error);
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        // Simulate API call
        const loadData = async () => {
            try {
                await new Promise(resolve => setTimeout(resolve, 1000));
                setNotifications(mockNotifications);
            } catch (error) {
                console.error('Error refreshing notifications:', error);
            } finally {
                setRefreshing(false);
            }
        };

        loadData();
    }, []);

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
        }
    });

    return (
        <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#FFFFFF' }}>
            <StatusBar
                barStyle={isDark ? 'light-content' : 'dark-content'}
                backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
            />

            {/* Header */}
            <View 
                className={`${isDark ? 'bg-gray-800' : 'bg-white'}`}
                style={styles.header}
            >
                <View className="flex-row items-center justify-between px-4 pt-3 pb-4">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
                    >
                        <Ionicons 
                            name="arrow-back" 
                            size={24} 
                            color={isDark ? '#FFFFFF' : '#111827'} 
                        />
                    </TouchableOpacity>
                    <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Notifications
                    </Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Tabs */}
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    className="px-4 pb-3"
                >
                    {tabs.map((tab) => (
                        <TouchableOpacity
                            key={tab.id}
                            onPress={() => setActiveTab(tab.id)}
                            className={`mr-2 px-4 py-2 rounded-full flex-row items-center ${
                                activeTab === tab.id
                                    ? isDark ? 'bg-blue-500' : 'bg-blue-100'
                                    : isDark ? 'bg-gray-700' : 'bg-gray-100'
                            }`}
                        >
                            <Ionicons
                                name={tab.icon as any}
                                size={16}
                                color={activeTab === tab.id
                                    ? isDark ? '#FFFFFF' : '#3B82F6'
                                    : isDark ? '#9CA3AF' : '#6B7280'
                                }
                            />
                            <Text className={`ml-2 ${
                                activeTab === tab.id
                                    ? isDark ? 'text-white' : 'text-blue-600'
                                    : isDark ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Priority Filter */}
            <View className="px-4 py-2">
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                >
                    {priorities.map((priority) => (
                        <TouchableOpacity
                            key={priority.value}
                            onPress={() => setSelectedPriority(priority.value)}
                            className={`mr-2 px-3 py-1 rounded-full ${
                                selectedPriority === priority.value
                                    ? isDark ? 'bg-gray-700' : 'bg-gray-200'
                                    : 'bg-transparent'
                            }`}
                        >
                            <Text className={
                                selectedPriority === priority.value
                                    ? isDark ? 'text-white' : 'text-gray-900'
                                    : isDark ? 'text-gray-400' : 'text-gray-600'
                            }>
                                {priority.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Notifications List */}
            <ScrollView 
                className="flex-1 px-4"
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={isDark ? '#60A5FA' : '#3B82F6'}
                        colors={['#3B82F6']} // Android
                        progressBackgroundColor={isDark ? '#374151' : '#F3F4F6'} // Android
                    />
                }
            >
                {loading ? (
                    <View className="flex-1 justify-center items-center py-8">
                        <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
                    </View>
                ) : filteredNotifications.length === 0 ? (
                    <View className="flex-1 justify-center items-center py-20">
                        <Ionicons
                            name="notifications-off-outline"
                            size={48}
                            color={isDark ? '#4B5563' : '#9CA3AF'}
                        />
                        <Text className={`mt-4 text-lg ${
                            isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                            No notifications found
                        </Text>
                    </View>
                ) : (
                    filteredNotifications.map((notification) => (
                        <TouchableOpacity
                            key={notification.id}
                            className={`mb-4 p-4 rounded-xl ${
                                isDark ? 'bg-gray-800' : 'bg-white'
                            } ${!notification.read && 'border-l-4'}`}
                            style={{
                                borderLeftColor: !notification.read ? getPriorityColor(notification.priority) : 'transparent'
                            }}
                        >
                            <View className="flex-row items-start">
                                <View className={`p-2 rounded-full ${
                                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                                }`}>
                                    <Ionicons
                                        name={getIconName(notification.type)}
                                        size={24}
                                        color={getPriorityColor(notification.priority)}
                                    />
                                </View>
                                <View className="flex-1 ml-3">
                                    <Text className={`font-semibold ${
                                        isDark ? 'text-white' : 'text-gray-900'
                                    }`}>
                                        {notification.title}
                                    </Text>
                                    <Text className={`mt-1 ${
                                        isDark ? 'text-gray-400' : 'text-gray-600'
                                    }`}>
                                        {notification.message}
                                    </Text>
                                    <Text className={`mt-2 text-sm ${
                                        isDark ? 'text-gray-500' : 'text-gray-400'
                                    }`}>
                                        {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                                    </Text>
                                </View>
                                {!notification.read && (
                                    <View className="h-3 w-3 rounded-full bg-blue-500" />
                                )}
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
}
