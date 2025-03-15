import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Platform, StatusBar, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../context/ThemeContext';
import { useState } from 'react';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

export default function CreateUser() {
    const { theme } = ThemeContext.useTheme();
    const { token } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'employee',
        department: '',
    });

    const API_URL = process.env.EXPO_PUBLIC_API_URL;

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.name) newErrors.name = 'Name is required';
        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }
        if (!formData.phone) {
            newErrors.phone = 'Phone is required';
        } else if (!/^\+?[1-9]\d{9,11}$/.test(formData.phone)) {
            newErrors.phone = 'Invalid phone format';
        }
        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        }
        if (!formData.department) newErrors.department = 'Department is required';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleCreate = async () => {
        if (!validateForm()) {
            Alert.alert('Validation Error', 'Please check all fields');
            return;
        }

        if (!token) {
            Alert.alert('Authentication Error', 'Please login again');
            router.replace('/(auth)/signin');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post(`${API_URL}/auth/register`, {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                password: formData.password,
                role: formData.role,
                department: formData.department
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            Alert.alert(
                'Success',
                `User created successfully!\nEmail: ${formData.email}\nPassword: ${formData.password}`,
                [
                    {
                        text: 'OK',
                        onPress: () => router.back()
                    }
                ]
            );
        } catch (error: any) {
            console.error('Create user error:', error);
            Alert.alert(
                'Error',
                error.response?.data?.error || 'Failed to create user. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
                style={[styles.header, { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 0 }]}
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
                                Create User
                            </Text>
                            <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                Add new employee account
                            </Text>
                        </View>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView 
                className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                showsVerticalScrollIndicator={false}
            >
                <View className="p-6">
                    {/* Form Fields */}
                    {[
                        { label: 'Full Name', key: 'name', icon: 'person-outline', placeholder: 'Enter full name' },
                        { label: 'Email', key: 'email', icon: 'mail-outline', placeholder: 'Enter work email', keyboardType: 'email-address' },
                        { label: 'Phone', key: 'phone', icon: 'call-outline', placeholder: '+91XXXXXXXXXX', keyboardType: 'phone-pad' },
                        { label: 'Password', key: 'password', icon: 'key-outline', placeholder: 'Set initial password', secure: true },
                        { label: 'Department', key: 'department', icon: 'business-outline', placeholder: 'Enter department' },
                    ].map((field) => (
                        <View key={field.key} className="mb-6">
                            <Text className={`text-base font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {field.label}
                            </Text>
                            <View 
                                className={`flex-row items-center rounded-xl px-4 ${
                                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                                } ${errors[field.key] ? 'border-2 border-red-500' : ''}`}
                                style={styles.inputContainer}
                            >
                                <Ionicons 
                                    name={field.icon as any} 
                                    size={20} 
                                    color={theme === 'dark' ? '#9CA3AF' : '#6B7280'} 
                                />
                                <TextInput
                                    value={formData[field.key as keyof typeof formData]}
                                    onChangeText={(text) => {
                                        setFormData({ ...formData, [field.key]: text });
                                        if (errors[field.key]) {
                                            setErrors({ ...errors, [field.key]: '' });
                                        }
                                    }}
                                    placeholder={field.placeholder}
                                    placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                                    className="flex-1 ml-3 py-4"
                                    style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
                                    secureTextEntry={field.secure}
                                    keyboardType={field.keyboardType as any}
                                    autoCapitalize={field.key === 'email' ? 'none' : 'words'}
                                />
                            </View>
                            {errors[field.key] && (
                                <Text className="text-red-500 mt-1 ml-1">
                                    {errors[field.key]}
                                </Text>
                            )}
                        </View>
                    ))}

                    {/* Role Selection */}
                    <View className="mb-6">
                        <Text className={`text-base font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            Role
                        </Text>
                        <View 
                            className={`rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                            style={styles.pickerContainer}
                        >
                            <Picker
                                selectedValue={formData.role}
                                onValueChange={(value) => setFormData({ ...formData, role: value })}
                                style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
                            >
                                <Picker.Item label="Employee" value="employee" />
                                <Picker.Item label="Group Admin" value="group-admin" />
                                <Picker.Item label="Management" value="management" />
                            </Picker>
                        </View>
                    </View>

                    {/* Create Button */}
                    <TouchableOpacity
                        onPress={handleCreate}
                        disabled={loading}
                        className={`rounded-xl py-4 mb-6 ${loading ? 'opacity-50' : ''}`}
                        style={[styles.createButton, { backgroundColor: '#3B82F6' }]}
                    >
                        <Text className="text-white text-center font-semibold text-lg">
                            {loading ? 'Creating...' : 'Create User'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
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
    backButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    pickerContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    inputContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    createButton: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 2,
    },
});
