import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../context/ThemeContext';

type ReportType = 'expense' | 'attendance' | 'activity';

interface ReportSummary {
    title: string;
    count: number;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
}

export default function GroupAdminReports() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();
    const isDark = theme === 'dark';

    const [selectedType, setSelectedType] = useState<ReportType>('expense');

    const reportSummaries: ReportSummary[] = [
        { title: 'Pending Approvals', count: 8, icon: 'time-outline', color: '#EF4444' },
        { title: 'Approved Today', count: 12, icon: 'checkmark-circle-outline', color: '#10B981' },
        { title: 'Total Employees', count: 45, icon: 'people-outline', color: '#6366F1' },
        { title: 'Active Now', count: 32, icon: 'radio-outline', color: '#F59E0B' },
    ];

    const reportTypes: { type: ReportType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
        { type: 'expense', label: 'Expense Reports', icon: 'cash-outline' },
        { type: 'attendance', label: 'Attendance', icon: 'calendar-outline' },
        { type: 'activity', label: 'Activity Logs', icon: 'analytics-outline' },
    ];

    return (
        <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#F3F4F6' }}>
            {/* Header */}
            <View className={`p-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={styles.header}>
                <View className="flex-row items-center justify-between">
                    <Link href="/(dashboard)/Group-Admin/group-admin" asChild>
                        <TouchableOpacity className="p-2">
                            <Ionicons 
                                name="arrow-back" 
                                size={24} 
                                color={isDark ? '#FFFFFF' : '#000000'} 
                            />
                        </TouchableOpacity>
                    </Link>
                    <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Reports & Analytics
                    </Text>
                    <View style={{ width: 40 }} />
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Summary Cards */}
                <View className="flex-row flex-wrap p-4 gap-4">
                    {reportSummaries.map((summary, index) => (
                        <View 
                            key={index}
                            className={`w-[47%] p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                            style={styles.summaryCard}
                        >
                            <View style={[styles.iconCircle, { backgroundColor: `${summary.color}20` }]}>
                                <Ionicons name={summary.icon} size={24} color={summary.color} />
                            </View>
                            <Text className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {summary.count}
                            </Text>
                            <Text className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {summary.title}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Report Type Selector */}
                <View className="px-4 mb-4">
                    <View className="flex-row bg-gray-200 p-1 rounded-xl">
                        {reportTypes.map((type) => (
                            <TouchableOpacity
                                key={type.type}
                                onPress={() => setSelectedType(type.type)}
                                className={`flex-1 flex-row items-center justify-center p-3 rounded-lg ${
                                    selectedType === type.type 
                                        ? 'bg-blue-500' 
                                        : 'bg-transparent'
                                }`}
                            >
                                <Ionicons 
                                    name={type.icon} 
                                    size={20} 
                                    color={selectedType === type.type ? '#FFFFFF' : '#6B7280'} 
                                />
                                <Text className={`ml-2 font-medium ${
                                    selectedType === type.type 
                                        ? 'text-white' 
                                        : 'text-gray-600'
                                }`}>
                                    {type.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Report Content */}
                <View className="px-4">
                    <View className={`rounded-xl p-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={styles.reportCard}>
                        {selectedType === 'expense' && (
                            <View>
                                {[
                                    { employee: 'John Doe', amount: '₹1,200', status: 'pending', date: 'Today' },
                                    { employee: 'Jane Smith', amount: '₹800', status: 'approved', date: 'Yesterday' },
                                    { employee: 'Mike Johnson', amount: '₹2,500', status: 'pending', date: 'Today' },
                                ].map((report, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        className={`flex-row items-center justify-between py-4 ${
                                            index !== 2 ? 'border-b' : ''
                                        } ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
                                    >
                                        <View className="flex-1">
                                            <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {report.employee}
                                            </Text>
                                            <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                {report.date}
                                            </Text>
                                        </View>
                                        <View className="items-end">
                                            <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {report.amount}
                                            </Text>
                                            <Text className={`text-sm ${
                                                report.status === 'approved' 
                                                    ? 'text-green-500' 
                                                    : 'text-yellow-500'
                                            }`}>
                                                {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {selectedType === 'attendance' && (
                            <View>
                                {[
                                    { employee: 'John Doe', status: 'present', time: '9:00 AM', duration: '8h 30m' },
                                    { employee: 'Jane Smith', status: 'late', time: '10:15 AM', duration: '7h 45m' },
                                    { employee: 'Mike Johnson', status: 'absent', time: '-', duration: '-' },
                                ].map((record, index) => (
                                    <View
                                        key={index}
                                        className={`flex-row items-center justify-between py-4 ${
                                            index !== 2 ? 'border-b' : ''
                                        } ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
                                    >
                                        <View className="flex-1">
                                            <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {record.employee}
                                            </Text>
                                            <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                {record.time}
                                            </Text>
                                        </View>
                                        <View className="items-end">
                                            <Text className={`font-medium ${
                                                record.status === 'present' ? 'text-green-500' :
                                                record.status === 'late' ? 'text-yellow-500' : 'text-red-500'
                                            }`}>
                                                {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                                            </Text>
                                            <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                {record.duration}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}

                        {selectedType === 'activity' && (
                            <View>
                                {[
                                    { action: 'Expense Submitted', user: 'John Doe', time: '2 hours ago' },
                                    { action: 'Shift Started', user: 'Jane Smith', time: '4 hours ago' },
                                    { action: 'Leave Request', user: 'Mike Johnson', time: '1 day ago' },
                                ].map((activity, index) => (
                                    <View
                                        key={index}
                                        className={`py-4 ${
                                            index !== 2 ? 'border-b' : ''
                                        } ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
                                    >
                                        <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {activity.action}
                                        </Text>
                                        <View className="flex-row justify-between mt-1">
                                            <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                {activity.user}
                                            </Text>
                                            <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                {activity.time}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    summaryCard: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    reportCard: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
});
