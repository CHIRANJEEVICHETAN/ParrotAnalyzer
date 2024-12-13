import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, StyleSheet, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

export default function GroupAdminSettings() {
    const { theme, toggleTheme } = ThemeContext.useTheme();
    const { logout } = AuthContext.useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
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
                    action: () => router.push('/(dashboard)/group-admin/profile'),
                    showArrow: true
                },
                {
                    icon: 'notifications-outline',
                    label: 'Notifications',
                    action: () => router.push('/(dashboard)/group-admin/notifications'),
                    showArrow: true
                },
                {
                    icon: 'shield-outline',
                    label: 'Privacy & Security',
                    action: () => router.push('/(dashboard)/group-admin/privacy'),
                    showArrow: true
                }
            ]
        },
        {
            title: 'Group Management',
            items: [
                {
                    icon: 'people-outline',
                    label: 'User Permissions',
                    action: () => router.push('/(dashboard)/group-admin/permissions'),
                    showArrow: true
                },
                {
                    icon: 'map-outline',
                    label: 'Tracking Settings',
                    action: () => router.push('/(dashboard)/group-admin/tracking-settings'),
                    showArrow: true
                },
                {
                    icon: 'receipt-outline',
                    label: 'Expense Approval Rules',
                    action: () => router.push('/(dashboard)/group-admin/expense-rules'),
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
                    action: toggleTheme,
                    isSwitch: true,
                    switchValue: theme === 'dark'
                }
            ]
        },
        {
            title: 'Support',
            items: [
                {
                    icon: 'help-circle-outline',
                    label: 'Help & Support',
                    action: () => router.push('/(dashboard)/group-admin/support'),
                    showArrow: true
                },
                {
                    icon: 'information-circle-outline',
                    label: 'About',
                    action: () => router.push('/(dashboard)/group-admin/about'),
                    showArrow: true
                }
            ]
        }
    ];

    return (
        <View className="flex-1" style={styles.container}>
            {/* Enhanced Header with Gradient */}
            <LinearGradient
                colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
                className={`pb-4`}
                style={[styles.header, { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 0 }]}
            >
                <View className="flex-row items-center justify-between px-6">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="mr-4 p-2 rounded-full"
                            style={[
                                styles.backButton,
                                { backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6' }
                            ]}
                        >
                            <Ionicons
                                name="arrow-back"
                                size={24}
                                color={theme === 'dark' ? '#FFFFFF' : '#000000'}
                            />
                        </TouchableOpacity>
                        <Text className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                              style={styles.headerTitle}>
                            Settings
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Settings Content with Enhanced Styling */}
            <ScrollView 
                className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                showsVerticalScrollIndicator={false}
                style={styles.scrollView}
            >
                {settingsSections.map((section, sectionIndex) => (
                    <View key={section.title} 
                          className={`mb-6 ${sectionIndex !== 0 ? 'mt-2' : ''}`}
                          style={styles.section}>
                        <Text className={`px-6 py-2 text-sm font-semibold ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`} style={styles.sectionTitle}>
                            {section.title}
                        </Text>
                        <View className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                              style={styles.sectionContent}>
                            {section.items.map((item, index) => (
                                <TouchableOpacity
                                    key={item.label}
                                    onPress={item.action}
                                    className={`flex-row items-center justify-between px-6 py-4`}
                                    style={[
                                        styles.settingItem,
                                        index !== section.items.length - 1 && styles.settingItemBorder,
                                        { borderColor: theme === 'dark' ? '#374151' : '#E5E7EB' }
                                    ]}
                                >
                                    <View className="flex-row items-center" style={styles.settingItemLeft}>
                                        <View style={[
                                            styles.iconContainer,
                                            { backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6' }
                                        ]}>
                                            <Ionicons
                                                name={item.icon as keyof typeof Ionicons.glyphMap}
                                                size={22}
                                                color={theme === 'dark' ? '#FFFFFF' : '#000000'}
                                            />
                                        </View>
                                        <Text className={`text-base ${
                                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                                        }`} style={styles.settingLabel}>
                                            {item.label}
                                        </Text>
                                    </View>
                                    {item.isSwitch ? (
                                        <Switch
                                            value={item.switchValue}
                                            onValueChange={item.action}
                                            trackColor={{ 
                                                false: theme === 'dark' ? '#4B5563' : '#D1D5DB',
                                                true: '#60A5FA'
                                            }}
                                            thumbColor={item.switchValue ? '#3B82F6' : '#F3F4F6'}
                                            style={styles.switch}
                                        />
                                    ) : item.showArrow && (
                                        <View style={styles.arrowContainer}>
                                            <Ionicons
                                                name="chevron-forward"
                                                size={20}
                                                color={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                                            />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}

                {/* Enhanced Logout Button with Gradient */}
                <TouchableOpacity
                    onPress={handleLogout}
                    style={styles.logoutButtonContainer}
                >
                    <LinearGradient
                        colors={['#DC2626', '#B91C1C']}
                        className="p-4 rounded-xl"
                        style={styles.logoutGradient}
                    >
                        <Text className="text-white font-semibold text-base" style={styles.logoutText}>
                            Logout
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Version Info with Enhanced Styling */}
                <View style={styles.versionContainer}>
                    <Text className={`text-center ${
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    }`} style={styles.versionText}>
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
    },
    headerTitle: {
        fontSize: 28,
        letterSpacing: 0.5,
    },
    backButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    scrollView: {
        bounces: true,
    },
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    sectionContent: {
        borderRadius: 16,
        marginHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    settingItem: {
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    settingItemBorder: {
        borderBottomWidth: 1,
    },
    settingItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '500',
        flex: 1,
    },
    switch: {
        transform: [{ scale: 0.9 }],
    },
    arrowContainer: {
        padding: 4,
    },
    logoutButtonContainer: {
        marginHorizontal: 16,
        marginVertical: 8,
    },
    logoutGradient: {
        borderRadius: 12,
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    logoutText: {
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    versionContainer: {
        marginTop: 8,
        marginBottom: 32,
        alignItems: 'center',
    },
    versionText: {
        fontSize: 14,
        opacity: 0.7,
    },
});
