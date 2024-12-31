import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar, TextInput, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../context/ThemeContext';
import axios from 'axios';

interface CompanyForm {
    name: string;
    email: string;
    phone: string;
    address: string;
}

export default function AddCompany() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<CompanyForm>({
        name: '',
        email: '',
        phone: '',
        address: ''
    });

    const handleSubmit = async () => {
        if (!formData.name || !formData.email) {
            Alert.alert('Error', 'Company name and email are required');
            return;
        }

        setLoading(true);
        try {
            await axios.post('/api/companies', formData);
            Alert.alert('Success', 'Company added successfully', [
                {
                    text: 'OK',
                    onPress: () => router.back()
                }
            ]);
        } catch (error) {
            console.error('Error adding company:', error);
            Alert.alert('Error', 'Failed to add company');
        } finally {
            setLoading(false);
        }
    };

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
                        Add New Company
                    </Text>
                    <View style={{ width: 40 }} />
                </View>
            </View>

            <ScrollView 
                className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                showsVerticalScrollIndicator={false}
            >
                <View className="p-4">
                    <View className={`rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`} style={styles.formCard}>
                        <View className="p-4 space-y-4">
                            {/* Company Name */}
                            <View>
                                <Text className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                    Company Name *
                                </Text>
                                <TextInput
                                    value={formData.name}
                                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                                    placeholder="Enter company name"
                                    placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                                    className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}
                                />
                            </View>

                            {/* Email */}
                            <View>
                                <Text className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                    Email Address *
                                </Text>
                                <TextInput
                                    value={formData.email}
                                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                                    placeholder="Enter company email"
                                    placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}
                                />
                            </View>

                            {/* Phone */}
                            <View>
                                <Text className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                    Phone Number
                                </Text>
                                <TextInput
                                    value={formData.phone}
                                    onChangeText={(text) => setFormData({ ...formData, phone: text })}
                                    placeholder="Enter phone number"
                                    placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                                    keyboardType="phone-pad"
                                    className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}
                                />
                            </View>

                            {/* Address */}
                            <View>
                                <Text className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                    Address
                                </Text>
                                <TextInput
                                    value={formData.address}
                                    onChangeText={(text) => setFormData({ ...formData, address: text })}
                                    placeholder="Enter company address"
                                    placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                                    multiline
                                    numberOfLines={3}
                                    className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}
                                    style={{ textAlignVertical: 'top' }}
                                />
                            </View>

                            {/* Submit Button */}
                            <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={loading}
                                className={`mt-6 p-4 rounded-lg ${loading ? 'opacity-50' : ''} bg-blue-500`}
                            >
                                <Text className="text-white text-center font-semibold">
                                    {loading ? 'Adding Company...' : 'Add Company'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
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
    formCard: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    }
}); 