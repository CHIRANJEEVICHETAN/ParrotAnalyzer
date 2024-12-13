import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import ThemeContext from '../../context/ThemeContext';
import BottomNav from '../../components/BottomNav';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { NavItem } from '../../types/nav';

export default function GroupAdminDashboard() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();

    const navItems: NavItem[] = [
        { icon: 'home-outline', label: 'Home', href: '/(dashboard)/group-admin' },
        { icon: 'people-outline', label: 'Users', href: '/(dashboard)/group-admin/users' },
        { icon: 'map-outline', label: 'Track', href: '/(dashboard)/group-admin/tracking' },
        { icon: 'document-text-outline', label: 'Reports', href: '/(dashboard)/group-admin/reports' },
    ];

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[
                styles.header,
                { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }
            ]}>
                <View style={styles.headerContent}>
                    <View>
                        <Text style={[
                            styles.headerTitle,
                            { color: theme === 'dark' ? '#FFFFFF' : '#111827' }
                        ]}>
                            Group Admin
                        </Text>
                        <Text style={[
                            styles.headerSubtitle,
                            { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }
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
                            color={theme === 'dark' ? '#FFFFFF' : '#111827'}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={[
                styles.content,
                { backgroundColor: theme === 'dark' ? '#111827' : '#F3F4F6' }
            ]}>
                {/* User Management Section */}
                <View style={styles.section}>
                    <Text style={[
                        styles.sectionTitle,
                        { color: theme === 'dark' ? '#FFFFFF' : '#111827' }
                    ]}>
                        User Management
                    </Text>
                    <View style={styles.cardContainer}>
                        <TouchableOpacity 
                            style={[
                                styles.card,
                                { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }
                            ]}
                            onPress={() => router.push('/(dashboard)/group-admin/pending-approvals')}
                        >
                            <View style={styles.cardHeader}>
                                <Ionicons name="people-outline" size={24} color="#3B82F6" />
                                <Text style={[
                                    styles.cardCount,
                                    { color: theme === 'dark' ? '#FFFFFF' : '#111827' }
                                ]}>5</Text>
                            </View>
                            <Text style={[
                                styles.cardTitle,
                                { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }
                            ]}>Pending Approvals</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[
                                styles.card,
                                { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }
                            ]}
                            onPress={() => router.push('/(dashboard)/group-admin/manage-users')}
                        >
                            <View style={styles.cardHeader}>
                                <Ionicons name="person-add-outline" size={24} color="#3B82F6" />
                                <Text style={[
                                    styles.cardCount,
                                    { color: theme === 'dark' ? '#FFFFFF' : '#111827' }
                                ]}>12</Text>
                            </View>
                            <Text style={[
                                styles.cardTitle,
                                { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }
                            ]}>Active Users</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Live Tracking Section */}
                <TouchableOpacity 
                    style={[
                        styles.trackingCard,
                        { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }
                    ]}
                    onPress={() => router.push('/(dashboard)/group-admin/tracking')}
                >
                    <View style={styles.trackingHeader}>
                        <Ionicons name="map-outline" size={24} color="#3B82F6" />
                        <Text style={[
                            styles.trackingTitle,
                            { color: theme === 'dark' ? '#FFFFFF' : '#111827' }
                        ]}>Live Tracking</Text>
                    </View>
                    <Text style={[
                        styles.trackingSubtitle,
                        { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }
                    ]}>8 team members currently active</Text>
                </TouchableOpacity>

                {/* Reports Section */}
                <View style={styles.section}>
                    <Text style={[
                        styles.sectionTitle,
                        { color: theme === 'dark' ? '#FFFFFF' : '#111827' }
                    ]}>
                        Pending Approvals
                    </Text>
                    <View style={[
                        styles.reportsList,
                        { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }
                    ]}>
                        {[
                            { name: 'John Doe', type: 'Travel Expense', amount: '₹1,200' },
                            { name: 'Jane Smith', type: 'Daily Allowance', amount: '₹800' },
                            { name: 'Mike Johnson', type: 'Fuel Expense', amount: '₹500' },
                        ].map((report, index) => (
                            <TouchableOpacity 
                                key={index}
                                style={[
                                    styles.reportItem,
                                    index !== 2 && styles.borderBottom,
                                    { borderColor: theme === 'dark' ? '#374151' : '#E5E7EB' }
                                ]}
                                onPress={() => router.push('/(dashboard)/group-admin/report-details')}
                            >
                                <View>
                                    <Text style={[
                                        styles.reportName,
                                        { color: theme === 'dark' ? '#FFFFFF' : '#111827' }
                                    ]}>{report.name}</Text>
                                    <Text style={[
                                        styles.reportType,
                                        { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }
                                    ]}>{report.type}</Text>
                                </View>
                                <Text style={[
                                    styles.reportAmount,
                                    { color: theme === 'dark' ? '#FFFFFF' : '#111827' }
                                ]}>{report.amount}</Text>
                            </TouchableOpacity>
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
    cardContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    card: {
        width: '48%',
        padding: 16,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardCount: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    cardTitle: {
        fontSize: 14,
    },
    trackingCard: {
        margin: 16,
        padding: 16,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    trackingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    trackingTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 8,
    },
    trackingSubtitle: {
        fontSize: 14,
    },
    reportsList: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    reportItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    borderBottom: {
        borderBottomWidth: 1,
    },
    reportName: {
        fontSize: 16,
        fontWeight: '500',
    },
    reportType: {
        fontSize: 14,
    },
    reportAmount: {
        fontSize: 16,
        fontWeight: '500',
    },
}); 