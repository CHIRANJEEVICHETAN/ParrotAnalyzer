import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, Platform, StatusBar, TextInput, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ThemeContext from '../../../context/ThemeContext';
import axios from 'axios';

interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user' | 'management' | 'group-admin' | 'employee';
    company: string;
    status: 'active' | 'disabled';
}

const getRoleColor = (role: string) => {
    const colors: { [key: string]: string } = {
        'management': '#3B82F6',    // Blue
        'group-admin': '#10B981',   // Green
        'employee': '#6366F1',      // Indigo
        'user': '#8B5CF6',         // Purple
        'admin': '#EC4899'         // Pink
    };
    return colors[role] || '#6B7280'; // Default gray
};

export default function UsersSettings() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const token = await AsyncStorage.getItem('auth_token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const response = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/super-admin/users`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.status || response.status >= 400) {
                throw new Error('Failed to fetch users');
            }

            const data = response.data;
            setUsers(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch users');
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusToggle = async (userId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
        const actionText = currentStatus === 'active' ? 'disable' : 'enable';

        Alert.alert(
            'Confirm Action',
            `Are you sure you want to ${actionText} this user?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    style: currentStatus === 'active' ? 'destructive' : 'default',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('auth_token');
                            if (!token) {
                                throw new Error('No authentication token found');
                            }

                            const response = await axios.patch(
                                `${process.env.EXPO_PUBLIC_API_URL}/api/super-admin/users/${userId}/toggle-status`,
                                {},
                                {
                                    headers: {
                                        'Authorization': `Bearer ${token}`
                                    }
                                }
                            );

                            if (!response.status || response.status >= 400) {
                                throw new Error('Failed to update user status');
                            }

                            setUsers(users.map(user => 
                                user.id === userId 
                                    ? { ...user, status: newStatus as 'active' | 'disabled' }
                                    : user
                            ));
                            Alert.alert('Success', `User ${actionText}d successfully`);
                        } catch (err) {
                            console.error('Error updating user status:', err);
                            Alert.alert('Error', 'Failed to update user status');
                        }
                    }
                }
            ]
        );
    };

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.company.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            await fetchUsers();
        } finally {
            setRefreshing(false);
        }
    }, []);

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
                        Manage Users
                    </Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Search Bar */}
                <View className="px-4 pb-4">
                    <View className={`flex-row items-center px-4 rounded-xl ${
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    }`}>
                        <Ionicons 
                            name="search" 
                            size={20} 
                            color={theme === 'dark' ? '#9CA3AF' : '#6B7280'} 
                        />
                        <TextInput
                            placeholder="Search users..."
                            placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            className={`flex-1 py-2 px-2 ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}
                        />
                    </View>
                </View>
            </View>

            {/* Users List */}
            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator 
                        size="large" 
                        color={theme === 'dark' ? '#FFFFFF' : '#111827'} 
                    />
                    <Text className={`mt-4 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                        Loading users...
                    </Text>
                </View>
            ) : error ? (
                <View className="flex-1 justify-center items-center p-4">
                    <Text className={`text-center mb-4 ${
                        theme === 'dark' ? 'text-red-400' : 'text-red-600'
                    }`}>
                        {error}
                    </Text>
                    <TouchableOpacity
                        onPress={fetchUsers}
                        className={`px-4 py-2 rounded-lg ${
                            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        }`}
                    >
                        <Text className={
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }>
                            Retry
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView 
                    className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[theme === 'dark' ? '#FFFFFF' : '#111827']}
                            tintColor={theme === 'dark' ? '#FFFFFF' : '#111827'}
                        />
                    }
                >
                    <View className="p-4">
                        {filteredUsers.length === 0 ? (
                            <Text className={`text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                No users found
                            </Text>
                        ) : (
                            filteredUsers.map((user) => (
                                <View 
                                    key={user.id}
                                    className={`mb-4 rounded-xl ${
                                        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                                    } ${
                                        user.status === 'disabled' ? 'opacity-75' : ''
                                    }`}
                                    style={styles.userCard}
                                >
                                    <View className="p-4">
                                        <View className="flex-row justify-between items-start">
                                            <View style={{ flex: 1 }}>
                                                <Text className={`text-lg font-semibold ${
                                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                                }`}>
                                                    {user.name}
                                                </Text>
                                                <Text className={`text-sm ${
                                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                                }`}>
                                                    {user.email}
                                                </Text>
                                            </View>
                                            <View className={`px-3 py-1 rounded-full ${
                                                user.status === 'active' 
                                                    ? 'bg-green-100' 
                                                    : 'bg-red-100'
                                            }`}>
                                                <Text className={`text-sm font-medium ${
                                                    user.status === 'active'
                                                        ? 'text-green-800'
                                                        : 'text-red-800'
                                                }`}>
                                                    {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                                                </Text>
                                            </View>
                                        </View>
                                        
                                        <View className="flex-row justify-between items-center mt-4">
                                            <View className="flex-row items-start flex-1 mr-2">
                                                <View className="flex-row items-center">
                                                    <View style={{
                                                        backgroundColor: getRoleColor(user.role),
                                                        paddingHorizontal: 8,
                                                        paddingVertical: 4,
                                                        borderRadius: 6,
                                                    }}>
                                                        <Text className="text-white font-medium text-sm">
                                                            {user.role.toUpperCase()}
                                                        </Text>
                                                    </View>
                                                    <Text className={`ml-2 flex-shrink ${
                                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                                    }`} numberOfLines={2} style={{ flex: 1 }}>
                                                        {user.company}
                                                    </Text>
                                                </View>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => handleStatusToggle(user.id, user.status)}
                                                className={`px-4 py-2 rounded-lg ${
                                                    user.status === 'active'
                                                        ? 'bg-red-500'
                                                        : 'bg-green-500'
                                                }`}
                                            >
                                                <Text className="text-white font-medium">
                                                    {user.status === 'active' ? 'Disable' : 'Enable'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>
            )}
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
    },
    userCard: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    }
});
