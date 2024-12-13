import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, StyleSheet, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

export default function SuperAdminSettings() {
    const { theme, toggleTheme } = ThemeContext.useTheme();
    const { logout } = AuthContext.useAuth();
    const router = useRouter();

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

    const settingsSections = [
        {
            title: 'Account',
            items: [
                {
                    icon: 'person-outline',
                    label: 'Profile Settings',
                    action: () => router.push('/(dashboard)/super-admin/profile'),
                    showArrow: true
                },
                {
                    icon: 'notifications-outline',
                    label: 'Notifications',
                    action: () => router.push('/(dashboard)/super-admin/notifications'),
                    showArrow: true
                },
                {
                    icon: 'shield-outline',
                    label: 'Security',
                    action: () => router.push('/(dashboard)/super-admin/security'),
                    showArrow: true
                }
            ]
        },
        {
            title: 'System',
            items: [
                {
                    icon: 'server-outline',
                    label: 'Database Management',
                    action: () => router.push('/(dashboard)/super-admin/database'),
                    showArrow: true
                },
                {
                    icon: 'code-working-outline',
                    label: 'API Configuration',
                    action: () => router.push('/(dashboard)/super-admin/api-config'),
                    showArrow: true
                },
                {
                    icon: 'moon-outline',
                    label: 'Dark Mode',
                    action: toggleTheme,
                    isSwitch: true,
                    value: theme === 'dark'
                }
            ]
        },
        {
            title: 'Support',
            items: [
                {
                    icon: 'help-circle-outline',
                    label: 'Help Center',
                    action: () => router.push('/(dashboard)/super-admin/help'),
                    showArrow: true
                },
                {
                    icon: 'document-text-outline',
                    label: 'Documentation',
                    action: () => router.push('/(dashboard)/super-admin/docs'),
                    showArrow: true
                },
                {
                    icon: 'information-circle-outline',
                    label: 'About',
                    action: () => router.push('/(dashboard)/super-admin/about'),
                    showArrow: true
                }
            ]
        }
    ];

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
                        <Text className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            Settings
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView
                className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                showsVerticalScrollIndicator={false}
            >
                {settingsSections.map((section, sectionIndex) => (
                    <View key={section.title} className="mb-6">
                        <Text
                            className={`px-6 py-2 text-sm font-medium ${
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}
                        >
                            {section.title}
                        </Text>
                        <View
                            className={`mx-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                            style={styles.settingSection}
                        >
                            {section.items.map((item, index) => (
                                <TouchableOpacity
                                    key={item.label}
                                    onPress={item.action}
                                    className={`p-4 flex-row items-center justify-between ${
                                        index !== section.items.length - 1
                                            ? 'border-b border-gray-200'
                                            : ''
                                    }`}
                                >
                                    <View className="flex-row items-center flex-1">
                                        <View
                                            className={`w-8 h-8 rounded-full items-center justify-center ${
                                                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                            }`}
                                        >
                                            <Ionicons
                                                name={item.icon as any}
                                                size={20}
                                                color={theme === 'dark' ? '#FFFFFF' : '#000000'}
                                            />
                                        </View>
                                        <Text
                                            className={`ml-3 text-base ${
                                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                                            }`}
                                        >
                                            {item.label}
                                        </Text>
                                    </View>
                                    {item.isSwitch ? (
                                        <Switch
                                            value={item.value}
                                            onValueChange={item.action}
                                            trackColor={{ false: '#767577', true: '#3B82F6' }}
                                            thumbColor={theme === 'dark' ? '#FFFFFF' : '#F3F4F6'}
                                        />
                                    ) : item.showArrow ? (
                                        <Ionicons
                                            name="chevron-forward"
                                            size={20}
                                            color={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                                        />
                                    ) : null}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}

                {/* Logout Button */}
                <View className="px-4 mb-8">
                    <TouchableOpacity
                        onPress={handleLogout}
                        className="w-full p-4 rounded-xl bg-red-500"
                        style={styles.logoutButton}
                    >
                        <Text className="text-white text-center font-semibold">
                            Logout
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Version Info */}
                <View className="items-center mb-8">
                    <Text className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>
                        Version 1.0.0
                    </Text>
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
    settingSection: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    logoutButton: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 2,
    },
});
