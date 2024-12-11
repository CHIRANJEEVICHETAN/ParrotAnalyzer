import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import ThemeContext from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';
import { Ionicons } from '@expo/vector-icons';
import type { NavItem } from '../types/nav';

export default function ManagementDashboard() {
    const { theme, toggleTheme } = ThemeContext.useTheme();

    const navItems: NavItem[] = [
        { icon: 'home-outline', label: 'Home', href: '/(dashboard)/management' },
        { icon: 'analytics-outline', label: 'Analytics', href: '/(dashboard)/management/analytics' },
        { icon: 'checkmark-circle-outline', label: 'Approvals', href: '/(dashboard)/management/approvals' },
        { icon: 'person-outline', label: 'Profile', href: '/(dashboard)/management/profile' },
    ];

    return (
        <View className="flex-1">
            <ScrollView
                className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
            >
                {/* Header */}
                <View className="px-6 pt-12 pb-4 flex-row justify-between items-center">
                    <View>
                        <Text
                            className={`text-2xl font-bold 
              ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}
                        >
                            Management Portal
                        </Text>
                        <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                            Performance Overview
                        </Text>
                    </View>
                    <TouchableOpacity onPress={toggleTheme} className="p-2">
                        <Ionicons
                            name={theme === 'dark' ? 'sunny' : 'moon'}
                            size={24}
                            color={theme === 'dark' ? '#FFF' : '#000'}
                        />
                    </TouchableOpacity>
                </View>

                {/* Performance Metrics */}
                <View className="px-6 py-4">
                    <View className="flex-row flex-wrap justify-between">
                        {[
                            { label: 'Total Teams', value: '8', icon: 'people', trend: '+2' },
                            { label: 'Active Projects', value: '15', icon: 'briefcase', trend: '+3' },
                            { label: 'Completion Rate', value: '87%', icon: 'trending-up', trend: '+5%' },
                            { label: 'Pending Reviews', value: '12', icon: 'time', trend: '-3' },
                        ].map((metric) => (
                            <View
                                key={metric.label}
                                className={`w-[48%] p-4 rounded-xl mb-4
                ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                            >
                                <View className="flex-row justify-between items-center">
                                    <Ionicons
                                        name={metric.icon as keyof typeof Ionicons.glyphMap}
                                        size={24}
                                        color="#3B82F6"
                                    />
                                    <Text
                                        className={`text-sm ${metric.trend.startsWith('+') ? 'text-green-500' : 'text-red-500'
                                            }`}
                                    >
                                        {metric.trend}
                                    </Text>
                                </View>
                                <Text
                                    className={`text-2xl font-bold mt-2
                  ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}
                                >
                                    {metric.value}
                                </Text>
                                <Text
                                    className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}
                                >
                                    {metric.label}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Priority Tasks */}
                <View className="px-6 py-4">
                    <Text
                        className={`text-lg font-semibold mb-4
            ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}
                    >
                        Priority Tasks
                    </Text>
                    <View
                        className={`p-4 rounded-xl
            ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                    >
                        {[
                            { task: 'Review Q3 Performance Reports', deadline: 'Due Tomorrow', priority: 'high' },
                            { task: 'Approve Team Expenses', deadline: 'Due Today', priority: 'medium' },
                            { task: 'Schedule Leadership Meeting', deadline: 'Due in 3 days', priority: 'low' },
                        ].map((item, index) => (
                            <View
                                key={index}
                                className={`py-3 flex-row items-center justify-between
                ${index !== 2 ? 'border-b border-gray-700' : ''}`}
                            >
                                <View className="flex-1">
                                    <Text
                                        className={`font-medium mb-1
                    ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}
                                    >
                                        {item.task}
                                    </Text>
                                    <Text
                                        className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}
                                    >
                                        {item.deadline}
                                    </Text>
                                </View>
                                <View
                                    className={`px-3 py-1 rounded-full
                  ${item.priority === 'high' ? 'bg-red-500' :
                                            item.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`}
                                >
                                    <Text className="text-white text-xs capitalize">
                                        {item.priority}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Quick Actions */}
                <View className="px-6 py-4 mb-4">
                    <Text
                        className={`text-lg font-semibold mb-4
            ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}
                    >
                        Management Actions
                    </Text>
                    <View className="space-y-3">
                        {[
                            { label: 'Review Performance', icon: 'stats-chart' },
                            { label: 'Team Analytics', icon: 'pie-chart' },
                            { label: 'Resource Allocation', icon: 'grid' },
                            { label: 'Budget Overview', icon: 'cash' },
                        ].map((action) => (
                            <TouchableOpacity
                                key={action.label}
                                className={`flex-row items-center p-4 rounded-xl
                ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                            >
                                <Ionicons
                                    name={action.icon as keyof typeof Ionicons.glyphMap}
                                    size={24}
                                    color="#3B82F6"
                                />
                                <Text
                                    className={`ml-3 font-medium
                  ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}
                                >
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

            <BottomNav items={navItems} />
        </View>
    );
} 