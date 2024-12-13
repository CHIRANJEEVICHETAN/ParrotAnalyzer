import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../context/ThemeContext';

export default function ManagementProfile() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();

    const profileData = {
        name: 'Alex Johnson',
        role: 'Senior Management',
        email: 'alex.johnson@company.com',
        department: 'Operations',
        joinDate: 'Jan 2020',
        teamsManaged: 5,
        totalEmployees: 45,
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
                        <Text className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            Profile
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView 
                className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Header */}
                <View className={`p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`} style={styles.profileHeader}>
                    <View className="items-center">
                        <Image
                            source={{ uri: 'https://placekitten.com/200/200' }}
                            style={styles.profileImage}
                        />
                        <Text className={`text-xl font-bold mt-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {profileData.name}
                        </Text>
                        <Text className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            {profileData.role}
                        </Text>
                    </View>
                </View>

                {/* Profile Details */}
                <View className="p-6">
                    <View className={`rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`} style={styles.detailsCard}>
                        {[
                            { label: 'Email', value: profileData.email, icon: 'mail' },
                            { label: 'Department', value: profileData.department, icon: 'business' },
                            { label: 'Join Date', value: profileData.joinDate, icon: 'calendar' },
                            { label: 'Teams Managed', value: profileData.teamsManaged.toString(), icon: 'people' },
                            { label: 'Total Employees', value: profileData.totalEmployees.toString(), icon: 'person' },
                        ].map((detail, index) => (
                            <View
                                key={detail.label}
                                className={`flex-row items-center p-4 ${
                                    index !== 4 ? 'border-b' : ''
                                } ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}
                            >
                                <Ionicons name={detail.icon as any} size={24} color="#3B82F6" />
                                <View className="ml-4">
                                    <Text className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {detail.label}
                                    </Text>
                                    <Text className={`text-base font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                        {detail.value}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Quick Actions */}
                <View className="p-6">
                    <Text className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        Quick Actions
                    </Text>
                    <View className="space-y-3">
                        {[
                            { label: 'Edit Profile', icon: 'create' },
                            { label: 'Change Password', icon: 'key' },
                            { label: 'Notification Settings', icon: 'notifications' },
                        ].map((action) => (
                            <TouchableOpacity
                                key={action.label}
                                className={`flex-row items-center p-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                                style={styles.actionButton}
                            >
                                <Ionicons name={action.icon as any} size={24} color="#3B82F6" />
                                <Text className={`ml-4 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {action.label}
                                </Text>
                                <Ionicons
                                    name="chevron-forward"
                                    size={24}
                                    color={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                                    style={{ marginLeft: 'auto' }}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>
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
    profileHeader: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    profileImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
    },
    detailsCard: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    actionButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
});
