import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import ThemeContext from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';
import { Ionicons } from '@expo/vector-icons';
import type { NavItem } from '../types/nav';

export default function GroupAdminDashboard() {
    const { theme, toggleTheme } = ThemeContext.useTheme();

    const navItems: NavItem[] = [
        { icon: 'home-outline', label: 'Home', href: '/(dashboard)/group-admin' },
        { icon: 'people-outline', label: 'Groups', href: '/(dashboard)/group-admin/groups' },
        { icon: 'document-text-outline', label: 'Reports', href: '/(dashboard)/group-admin/reports' },
        { icon: 'person-outline', label: 'Profile', href: '/(dashboard)/group-admin/profile' },
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
                            Group Dashboard
                        </Text>
                        <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                            Team Alpha
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

                {/* Stats Overview */}
                <View className="px-6 py-4">
                    <View className="flex-row flex-wrap justify-between">
                        {[
                            { label: 'Active Members', value: '12', icon: 'people' },
                            { label: 'Pending Reports', value: '5', icon: 'document-text' },
                            { label: 'On Leave', value: '3', icon: 'calendar' },
                            { label: 'Tasks Due', value: '8', icon: 'checkmark-circle' },
                        ].map((stat) => (
                            <View
                                key={stat.label}
                                className={`w-[48%] p-4 rounded-xl mb-4
                ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                            >
                                <Ionicons
                                    name={stat.icon as keyof typeof Ionicons.glyphMap}
                                    size={24}
                                    color="#3B82F6"
                                />
                                <Text
                                    className={`text-2xl font-bold mt-2
                  ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}
                                >
                                    {stat.value}
                                </Text>
                                <Text
                                    className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}
                                >
                                    {stat.label}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Recent Activity */}
                <View className="px-6 py-4">
                    <Text
                        className={`text-lg font-semibold mb-4
            ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}
                    >
                        Recent Activity
                    </Text>
                    <View
                        className={`p-4 rounded-xl
            ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                    >
                        {[
                            'John submitted a new report',
                            'Sarah requested leave',
                            'Team meeting scheduled for tomorrow',
                            'New task assigned to Mike',
                        ].map((activity, index) => (
                            <View
                                key={index}
                                className={`py-3 ${index !== 3 ? 'border-b border-gray-700' : ''
                                    }`}
                            >
                                <Text
                                    className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}
                                >
                                    {activity}
                                </Text>
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
                        Quick Actions
                    </Text>
                    <View className="space-y-3">
                        {[
                            { label: 'Approve Reports', icon: 'checkmark-circle' },
                            { label: 'Schedule Meeting', icon: 'calendar' },
                            { label: 'View Team Location', icon: 'location' },
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