import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, StatusBar, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

type AboutSection = {
    title: string;
    description: string;
    icon: string;
};

const aboutSections: AboutSection[] = [
    {
        title: 'Expense Management',
        description: 'Review, approve, or reject employee expense submissions. Ensure expenses comply with company policies and include necessary documentation.',
        icon: 'receipt'
    },
    {
        title: 'User and Role Management',
        description: 'Add, update, and manage employee accounts within the group. Assign roles and permissions based on the employee\'s responsibilities.',
        icon: 'people'
    },
    {
        title: 'Shift and Activity Monitoring',
        description: 'Track employee attendance and shift activities. Ensure employees adhere to their assigned schedules and tasks.',
        icon: 'time'
    },
    {
        title: 'Communication and Escalation',
        description: 'Act as a liaison between employees and higher management. Escalate unresolved issues or policy violations to appropriate authorities.',
        icon: 'chatbubbles'
    },
    {
        title: 'Performance Insights',
        description: 'Access real-time data and reports on employee performance, expenses, and group activities. Use insights to optimize operations.',
        icon: 'analytics'
    },
    {
        title: 'Expense Approval Dashboard',
        description: 'A centralized interface for reviewing and processing employee expenses.',
        icon: 'desktop'
    },
    {
        title: 'Employee Management Tools',
        description: 'Add or edit employees and configure roles within the group.',
        icon: 'construct'
    },
    {
        title: 'Real-Time Notifications',
        description: 'Get notified about critical activities, pending approvals, and escalations.',
        icon: 'notifications'
    },
    {
        title: 'Customizable Rules',
        description: 'Set and manage approval workflows and compliance rules for the group.',
        icon: 'settings'
    },
    {
        title: 'Reports and Analytics',
        description: 'Access detailed reports and insights into group activities and employee performance.',
        icon: 'bar-chart'
    }
];

export default function About() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={{ flex: 1, backgroundColor: theme === 'dark' ? '#111827' : '#F3F4F6' }}>
                <LinearGradient
                    colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
                    style={[styles.header, { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 0 }]}
                >
                    <View className="px-6">
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
                                    About
                                </Text>
                                <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                    Group Admin Features & Capabilities
                                </Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                <ScrollView 
                    className="flex-1 px-4 pt-3"
                    contentContainerStyle={{ paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                >
                    {aboutSections.map((section, index) => (
                        <View
                            key={index}
                            className={`mb-4 p-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                            style={styles.card}
                        >
                            <View className="flex-row items-start">
                                <View className={`p-3 rounded-lg mr-4 ${
                                    theme === 'dark' ? 'bg-gray-700' : 'bg-blue-50'
                                }`}>
                                    <Ionicons
                                        name={section.icon as any}
                                        size={24}
                                        color="#3B82F6"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className={`text-lg font-semibold mb-2 ${
                                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    }`}>
                                        {section.title}
                                    </Text>
                                    <Text className={`text-sm ${
                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                    }`}>
                                        {section.description}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    header: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        paddingBottom: 14,
    },
    backButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    }
});
