import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, Platform, StatusBar, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../context/ThemeContext';

interface Subscription {
    id: string;
    name: string;
    price: number;
    duration: string;
    features: string[];
    status: 'active' | 'disabled';
}

const MOCK_SUBSCRIPTIONS: Subscription[] = [
    {
        id: '1',
        name: 'Basic Plan',
        price: 2499,
        duration: 'Monthly',
        features: ['Up to 10 users', 'Basic reporting', 'Email support'],
        status: 'active' as const
    },
    {
        id: '2',
        name: 'Professional Plan',
        price: 7999,
        duration: 'Monthly',
        features: ['Up to 50 users', 'Advanced reporting', '24/7 support', 'API access'],
        status: 'active' as const
    },
    {
        id: '3',
        name: 'Enterprise Plan',
        price: 24999,
        duration: 'Monthly',
        features: ['Unlimited users', 'Custom features', 'Dedicated support', 'White labeling'],
        status: 'disabled' as const
    }
];

const formatIndianPrice = (price: number) => {
    return price.toLocaleString('en-IN', {
        maximumFractionDigits: 0,
        style: 'currency',
        currency: 'INR'
    });
};

export default function SubscriptionsSettings() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();
    const [subscriptions, setSubscriptions] = useState<Subscription[]>(MOCK_SUBSCRIPTIONS);
    const [searchQuery, setSearchQuery] = useState('');

    const handleStatusToggle = (subscriptionId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
        const actionText = currentStatus === 'active' ? 'disable' : 'enable';

        Alert.alert(
            'Confirm Action',
            `Are you sure you want to ${actionText} this subscription plan?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    style: currentStatus === 'active' ? 'destructive' : 'default',
                    onPress: () => {
                        setSubscriptions(subscriptions.map(sub => 
                            sub.id === subscriptionId 
                                ? { ...sub, status: newStatus as 'active' | 'disabled' }
                                : sub
                        ));
                        Alert.alert('Success', `Subscription plan ${actionText}d successfully`);
                    }
                }
            ]
        );
    };

    const filteredSubscriptions = subscriptions.filter(sub =>
        sub.name.toLowerCase().includes(searchQuery.toLowerCase())
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
                        Subscription Plans
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
                            placeholder="Search plans..."
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

            {/* Subscriptions List */}
            <ScrollView 
                className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                showsVerticalScrollIndicator={false}
            >
                <View className="p-4">
                    {filteredSubscriptions.length === 0 ? (
                        <Text className={`text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            No subscription plans found
                        </Text>
                    ) : (
                        filteredSubscriptions.map((subscription) => (
                            <View 
                                key={subscription.id}
                                className={`mb-4 rounded-xl ${
                                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                                } ${
                                    subscription.status === 'disabled' ? 'opacity-75' : ''
                                }`}
                                style={styles.subscriptionCard}
                            >
                                <View className="p-4">
                                    <View className="flex-row justify-between items-center">
                                        <View>
                                            <Text className={`text-lg font-semibold ${
                                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                                            }`}>
                                                {subscription.name}
                                            </Text>
                                            <Text className={`text-xl font-bold mt-1 ${
                                                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                                            }`}>
                                                {formatIndianPrice(subscription.price)}/{subscription.duration.toLowerCase()}
                                            </Text>
                                        </View>
                                        <View className={`px-3 py-1 rounded-full ${
                                            subscription.status === 'active' 
                                                ? 'bg-green-100' 
                                                : 'bg-red-100'
                                        }`}>
                                            <Text className={`text-sm font-medium ${
                                                subscription.status === 'active'
                                                    ? 'text-green-800'
                                                    : 'text-red-800'
                                            }`}>
                                                {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View className="mt-3">
                                        {subscription.features.map((feature, index) => (
                                            <View key={index} className="flex-row items-center mt-2">
                                                <Ionicons 
                                                    name="checkmark-circle" 
                                                    size={20} 
                                                    color={theme === 'dark' ? '#60A5FA' : '#2563EB'} 
                                                />
                                                <Text className={`ml-2 ${
                                                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                                }`}>
                                                    {feature}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                    
                                    <View className="flex-row justify-end mt-4">
                                        <TouchableOpacity
                                            onPress={() => handleStatusToggle(subscription.id, subscription.status)}
                                            className={`px-4 py-2 rounded-lg ${
                                                subscription.status === 'active'
                                                    ? 'bg-red-500'
                                                    : 'bg-green-500'
                                            }`}
                                        >
                                            <Text className="text-white font-medium">
                                                {subscription.status === 'active' ? 'Disable' : 'Enable'}
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
    subscriptionCard: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    }
});
