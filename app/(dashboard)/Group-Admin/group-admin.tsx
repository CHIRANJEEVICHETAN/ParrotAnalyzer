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
            title: 'Bulk Upload',
            icon: 'cloud-upload-outline',
            color: '#10B981',
            route: '/(dashboard)/Group-Admin/employee-management/bulk',
            description: 'Upload multiple employees via CSV'
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

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[
                styles.header,
                { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }
            ]}>
                <View style={styles.headerContent}>
                    <View>
                        <Text style={[
                            styles.headerTitle,
                            { color: isDark ? '#FFFFFF' : '#111827' }
                        ]}>
                            Group Admin
                        </Text>
                        <Text style={[
                            styles.headerSubtitle,
                            { color: isDark ? '#9CA3AF' : '#6B7280' }
                        ]}>
                            Dashboard
                        </Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => router.push('/(dashboard)/Group-Admin/settings')}
                        style={styles.settingsButton}
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
                                        name={action.icon as any}
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
        paddingTop: StatusBar.currentHeight || 48,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
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