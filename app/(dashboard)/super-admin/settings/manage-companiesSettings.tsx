import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, Platform, StatusBar, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../context/ThemeContext';
import axios from 'axios';

interface Company {
    id: string;
    name: string;
    status: 'active' | 'disabled';
    email: string;
    createdAt: string;
}

// Mock data for companies
const MOCK_COMPANIES: Company[] = [
    {
        id: '1',
        name: 'Tech Solutions Inc.',
        email: 'contact@techsolutions.com',
        status: 'active' as const,
        createdAt: '2024-01-15'
    },
    {
        id: '2',
        name: 'Global Innovations Ltd',
        email: 'info@globalinnovations.com',
        status: 'active' as const,
        createdAt: '2024-01-20'
    },
    {
        id: '3',
        name: 'Digital Systems Corp',
        email: 'support@digitalsystems.com',
        status: 'disabled' as const,
        createdAt: '2024-02-01'
    },
    {
        id: '4',
        name: 'Future Technologies',
        email: 'hello@futuretech.com',
        status: 'active' as const,
        createdAt: '2024-02-10'
    },
    {
        id: '5',
        name: 'Smart Solutions Group',
        email: 'info@smartsolutions.com',
        status: 'disabled' as const,
        createdAt: '2024-02-15'
    }
];

export default function ManageCompaniesSettings() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();
    const [companies, setCompanies] = useState<Company[]>(MOCK_COMPANIES);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const handleStatusToggle = async (companyId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
        const actionText = currentStatus === 'active' ? 'disable' : 'enable';

        Alert.alert(
            'Confirm Action',
            `Are you sure you want to ${actionText} this company?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    style: currentStatus === 'active' ? 'destructive' : 'default',
                    onPress: () => {
                        // Update local state instead of making API call
                        setCompanies(companies.map(company => 
                            company.id === companyId 
                                ? { ...company, status: newStatus }
                                : company
                        ));
                        Alert.alert('Success', `Company ${actionText}d successfully`);
                    }
                }
            ]
        );
    };

    const handleDisableAll = () => {
        Alert.alert(
            'Disable All Companies',
            'Are you sure you want to disable all active companies?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disable All',
                    style: 'destructive',
                    onPress: () => {
                        setCompanies(companies.map(company => ({
                            ...company,
                            status: 'disabled'
                        })));
                        Alert.alert('Success', 'All companies have been disabled');
                    }
                }
            ]
        );
    };

    const filteredCompanies = companies.filter(company =>
        company.name.toLowerCase().includes(searchQuery.toLowerCase())
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
                        Manage Companies
                    </Text>
                    <View style={{ width: 40 }} /> {/* Placeholder for layout balance */}
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
                            placeholder="Search companies..."
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

            {/* Companies List */}
            <ScrollView 
                className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                showsVerticalScrollIndicator={false}
            >
                <View className="p-4">
                    {/* Disable All Button */}
                    <TouchableOpacity
                        onPress={handleDisableAll}
                        className="bg-red-500 p-4 rounded-xl mb-4"
                    >
                        <Text className="text-white text-center font-semibold">
                            Disable All Companies
                        </Text>
                    </TouchableOpacity>

                    {/* Companies List */}
                    {loading ? (
                        <Text className={`text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            Loading companies...
                        </Text>
                    ) : filteredCompanies.length === 0 ? (
                        <Text className={`text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            No companies found
                        </Text>
                    ) : (
                        filteredCompanies.map((company) => (
                            <View 
                                key={company.id}
                                className={`mb-4 rounded-xl ${
                                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                                } ${
                                    company.status === 'disabled' ? 'opacity-75' : ''
                                }`}
                                style={styles.companyCard}
                            >
                                <View className="p-4">
                                    <View className="flex-row justify-between items-center">
                                        <Text className={`text-lg font-semibold ${
                                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                                        }`}>
                                            {company.name}
                                        </Text>
                                        <View className={`px-3 py-1 rounded-full ${
                                            company.status === 'active' 
                                                ? 'bg-green-100' 
                                                : 'bg-red-100'
                                        }`}>
                                            <Text className={`text-sm font-medium ${
                                                company.status === 'active'
                                                    ? 'text-green-800'
                                                    : 'text-red-800'
                                            }`}>
                                                {company.status.charAt(0).toUpperCase() + company.status.slice(1)}
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    <Text className={`mt-1 ${
                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                    }`}>
                                        {company.email}
                                    </Text>
                                    
                                    <View className="flex-row justify-between items-center mt-4">
                                        <Text className={`text-sm ${
                                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                        }`}>
                                            Created: {new Date(company.createdAt).toLocaleDateString()}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => handleStatusToggle(company.id, company.status)}
                                            className={`px-4 py-2 rounded-lg ${
                                                company.status === 'active'
                                                    ? 'bg-red-500'
                                                    : 'bg-green-500'
                                            }`}
                                        >
                                            <Text className="text-white font-medium">
                                                {company.status === 'active' ? 'Disable' : 'Enable'}
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
    companyCard: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    }
});
