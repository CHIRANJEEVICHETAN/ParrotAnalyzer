import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, Platform, StatusBar, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../context/ThemeContext';

interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user';
    company: string;
    status: 'active' | 'disabled';
}

const MOCK_USERS: User[] = [
    {
        id: '1',
        name: 'John Doe',
        email: 'john@techsolutions.com',
        role: 'admin',
        company: 'Tech Solutions Inc.',
        status: 'active' as const
    },
    {
        id: '2',
        name: 'Jane Smith',
        email: 'jane@globalinnovations.com',
        role: 'user',
        company: 'Global Innovations Ltd',
        status: 'active' as const
    },
    {
        id: '3',
        name: 'Mike Johnson',
        email: 'mike@digitalsystems.com',
        role: 'admin',
        company: 'Digital Systems Corp',
        status: 'disabled' as const
    }
];

export default function UsersSettings() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();
    const [users, setUsers] = useState<User[]>(MOCK_USERS);
    const [searchQuery, setSearchQuery] = useState('');

    const handleStatusToggle = (userId: string, currentStatus: string) => {
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
                    onPress: () => {
                        setUsers(users.map(user => 
                            user.id === userId 
                                ? { ...user, status: newStatus as 'active' | 'disabled' }
                                : user
                        ));
                        Alert.alert('Success', `User ${actionText}d successfully`);
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
            <ScrollView 
                className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                showsVerticalScrollIndicator={false}
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
                                    <View className="flex-row justify-between items-center">
                                        <View>
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
                                        <View className="flex-row items-center">
                                            <View className={`px-2 py-1 rounded-md ${
                                                user.role === 'admin' ? 'bg-blue-100' : 'bg-gray-100'
                                            }`}>
                                                <Text className={
                                                    user.role === 'admin' ? 'text-blue-800' : 'text-gray-800'
                                                }>
                                                    {user.role.toUpperCase()}
                                                </Text>
                                            </View>
                                            <Text className={`ml-2 ${
                                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                            }`}>
                                                {user.company}
                                            </Text>
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
