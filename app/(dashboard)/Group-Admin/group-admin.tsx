import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import ThemeContext from '../../context/ThemeContext';
import BottomNav from '../../components/BottomNav';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { NavItem } from '../../types/nav';

export default function GroupAdminDashboard() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();
    const isDark = theme === 'dark';

    const navItems: NavItem[] = [
        { icon: 'home-outline', label: 'Home', href: '/(dashboard)/Group-Admin/group-admin' },
        { icon: 'people-outline', label: 'Employees', href: '/(dashboard)/Group-Admin/employee-management' },
        { icon: 'list-outline', label: 'Tasks', href: '/(dashboard)/Group-Admin/task-management' },
        { icon: 'document-text-outline', label: 'Reports', href: '/(dashboard)/Group-Admin/reports' },
        { icon: 'settings-outline', label: 'Settings', href: '/(dashboard)/Group-Admin/settings' },
    ];

    // Quick action cards data
    const quickActions = [
        {
            title: 'Add Employee',
            icon: 'person-add-outline',
            color: '#3B82F6',
            route: '/(dashboard)/Group-Admin/employee-management/individual',
            description: 'Create new employee account'
        },
        {
            title: 'Expense Management',
            icon: 'receipt-outline',
            color: '#10B981',
            route: '/(dashboard)/Group-Admin/expense-management',
            description: 'Manage employee expenses'
        },
        {
            title: 'Task Management',
            icon: 'list-outline',
            color: '#8B5CF6',
            route: '/(dashboard)/Group-Admin/task-management',
            description: 'Manage employee tasks'
        },
        {
            title: 'View Reports',
            icon: 'bar-chart-outline',
            color: '#F59E0B',
            route: '/(dashboard)/Group-Admin/reports',
            description: 'Access employee reports'
        }
    ];

    // Add new section for Leave Management
    const leaveManagementActions = [
        {
            title: 'Leave Requests',
            icon: 'calendar-outline',
            color: '#EC4899', // Pink color for distinction
            route: '/(dashboard)/Group-Admin/leave-management',
            description: 'Manage employee leave requests'
        },
        {
            title: 'Leave Balance',
            icon: 'time-outline',
            color: '#6366F1', // Indigo color
            route: '/(dashboard)/Group-Admin/leave-management/balance',
            description: 'Configure leave balance settings'
        }
    ];

    return (
        <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#F3F4F6' }}>
            <StatusBar
                backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
                barStyle={isDark ? 'light-content' : 'dark-content'}
            />

            {/* Header */}
            <View 
                className={`${isDark ? 'bg-gray-800' : 'bg-white'}`}
                style={styles.header}
            >
                <View className="flex-row items-center justify-between px-4 pt-3 pb-4">
                    <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Group Admin
                    </Text>
                    <TouchableOpacity 
                        onPress={() => router.push('/(dashboard)/Group-Admin/settings')}
                        className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
                    >
                        <Ionicons
                            name="settings-outline"
                            size={24}
                            color={isDark ? '#FFFFFF' : '#111827'}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView 
                style={[
                    styles.content,
                    { backgroundColor: isDark ? '#111827' : '#F3F4F6' }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Quick Actions Grid */}
                <View style={styles.section}>
                    <Text style={[
                        styles.sectionTitle,
                        { color: isDark ? '#FFFFFF' : '#111827' }
                    ]}>
                        Quick Actions
                    </Text>
                    <View style={styles.quickActionsGrid}>
                        {quickActions.map((action, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.quickActionCard,
                                    { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }
                                ]}
                                onPress={() => router.push(action.route as any)}
                            >
                                <View style={[
                                    styles.iconCircle,
                                    { backgroundColor: `${action.color}20` }
                                ]}>
                                    <Ionicons
                                        name={action.icon as keyof typeof Ionicons.glyphMap}
                                        size={24}
                                        color={action.color}
                                    />
                                </View>
                                <Text style={[
                                    styles.cardTitle,
                                    { color: isDark ? '#FFFFFF' : '#111827' }
                                ]}>
                                    {action.title}
                                </Text>
                                <Text style={[
                                    styles.cardDescription,
                                    { color: isDark ? '#9CA3AF' : '#6B7280' }
                                ]}>
                                    {action.description}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* New Leave Management Section */}
                <View style={styles.section}>
                    <Text style={[
                        styles.sectionTitle,
                        { color: isDark ? '#FFFFFF' : '#111827' }
                    ]}>
                        Leave Management
                    </Text>
                    <View style={styles.quickActionsGrid}>
                        {leaveManagementActions.map((action, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.quickActionCard,
                                    { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }
                                ]}
                                onPress={() => router.push(action.route as any)}
                            >
                                <View style={[
                                    styles.iconCircle,
                                    { backgroundColor: `${action.color}20` }
                                ]}>
                                    <Ionicons 
                                        name={action.icon as keyof typeof Ionicons.glyphMap} 
                                        size={24} 
                                        color={action.color} 
                                    />
                                </View>
                                <Text style={[
                                    styles.cardTitle,
                                    { color: isDark ? '#FFFFFF' : '#111827' }
                                ]}>
                                    {action.title}
                                </Text>
                                <Text style={[
                                    styles.cardDescription,
                                    { color: isDark ? '#9CA3AF' : '#6B7280' }
                                ]}>
                                    {action.description}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Recent Activity Section */}
                <View style={styles.section}>
                    <Text style={[
                        styles.sectionTitle,
                        { color: isDark ? '#FFFFFF' : '#111827' }
                    ]}>
                        Recent Activity
                    </Text>
                    <View style={[
                        styles.activityList,
                        { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }
                    ]}>
                        {[
                            { type: 'New Employee', name: 'John Doe', time: '2 hours ago' },
                            { type: 'Access Updated', name: 'Jane Smith', time: '4 hours ago' },
                            { type: 'Bulk Upload', name: '5 employees added', time: 'Yesterday' },
                        ].map((activity, index) => (
                            <View 
                                key={index}
                                style={[
                                    styles.activityItem,
                                    index !== 2 && styles.borderBottom,
                                    { borderColor: isDark ? '#374151' : '#E5E7EB' }
                                ]}
                            >
                                <View style={styles.activityContent}>
                                    <Text style={[
                                        styles.activityType,
                                        { color: isDark ? '#60A5FA' : '#3B82F6' }
                                    ]}>
                                        {activity.type}
                                    </Text>
                                    <Text style={[
                                        styles.activityName,
                                        { color: isDark ? '#FFFFFF' : '#111827' }
                                    ]}>
                                        {activity.name}
                                    </Text>
                                </View>
                                <Text style={[
                                    styles.activityTime,
                                    { color: isDark ? '#9CA3AF' : '#6B7280' }
                                ]}>
                                    {activity.time}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>

            <BottomNav items={navItems} />
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
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        fontSize: 14,
    },
    settingsButton: {
        padding: 8,
    },
    content: {
        flex: 1,
    },
    section: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
    },
    quickActionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    quickActionCard: {
        width: '48%',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    cardDescription: {
        fontSize: 12,
    },
    activityList: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    activityItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    borderBottom: {
        borderBottomWidth: 1,
    },
    activityContent: {
        flex: 1,
    },
    activityType: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 4,
    },
    activityName: {
        fontSize: 16,
        fontWeight: '500',
    },
    activityTime: {
        fontSize: 12,
    },
}); 