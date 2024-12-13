import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../context/ThemeContext';
import { useState } from 'react';

export default function ManagementApprovals() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();
    const [selectedFilter, setSelectedFilter] = useState('all');

    const approvalItems = [
        {
            id: 1,
            type: 'Expense Report',
            amount: '₹1,250.00',
            submittedBy: 'John Doe',
            date: '2024-01-15',
            status: 'pending',
            department: 'Sales',
            category: 'expense',
            priority: 'high',
            description: 'Q4 Marketing Campaign Expenses'
        },
        {
            id: 2,
            type: 'Travel Request',
            amount: '₹800.00',
            submittedBy: 'Jane Smith',
            date: '2024-01-14',
            status: 'pending',
            department: 'Marketing',
            category: 'travel',
            priority: 'medium',
            description: 'Client Meeting in Mumbai'
        },
        {
            id: 3,
            type: 'Purchase Order',
            amount: '₹2,500.00',
            submittedBy: 'Mike Johnson',
            date: '2024-01-13',
            status: 'pending',
            department: 'Operations',
            category: 'purchase',
            priority: 'low',
            description: 'Office Equipment Purchase'
        },
    ];

    const filterOptions = [
        { label: 'All', value: 'all', icon: 'apps-outline' },
        { label: 'Expenses', value: 'expense', icon: 'cash-outline' },
        { label: 'Travel', value: 'travel', icon: 'airplane-outline' },
        { label: 'Purchase', value: 'purchase', icon: 'cart-outline' },
    ];

    const handleApprove = (id: number) => {
        console.log(`Approved item ${id}`);
    };

    const handleReject = (id: number) => {
        console.log(`Rejected item ${id}`);
    };

    const filteredItems = selectedFilter === 'all' 
        ? approvalItems 
        : approvalItems.filter(item => item.category === selectedFilter);

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
                        <View>
                            <Text className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                Approvals
                            </Text>
                            <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                {filteredItems.length} pending requests
                            </Text>
                        </View>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView 
                className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                showsVerticalScrollIndicator={false}
            >
                {/* Filter Section */}
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterContainer}
                >
                    {filterOptions.map((filter) => (
                        <TouchableOpacity
                            key={filter.value}
                            onPress={() => setSelectedFilter(filter.value)}
                            style={[
                                styles.filterButton,
                                { 
                                    backgroundColor: selectedFilter === filter.value
                                        ? (theme === 'dark' ? '#3B82F6' : '#2563EB')
                                        : (theme === 'dark' ? '#374151' : '#F3F4F6')
                                }
                            ]}
                        >
                            <Ionicons 
                                name={filter.icon as any} 
                                size={20} 
                                color={selectedFilter === filter.value ? '#FFFFFF' : (theme === 'dark' ? '#9CA3AF' : '#6B7280')}
                            />
                            <Text 
                                className={`ml-2 font-medium ${
                                    selectedFilter === filter.value 
                                        ? 'text-white' 
                                        : (theme === 'dark' ? 'text-gray-300' : 'text-gray-600')
                                }`}
                            >
                                {filter.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Approval Cards */}
                <View className="p-4">
                    {filteredItems.map((item) => (
                        <View
                            key={item.id}
                            className={`mb-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                            style={styles.approvalCard}
                        >
                            <View className="p-4">
                                <View className="flex-row justify-between items-start mb-3">
                                    <View className="flex-1">
                                        <View className="flex-row items-center mb-2">
                                            <View className={`p-2 rounded-lg mr-3 ${
                                                theme === 'dark' ? 'bg-gray-700' : 'bg-blue-50'
                                            }`}>
                                                <Ionicons 
                                                    name={
                                                        item.category === 'expense' ? 'cash-outline' :
                                                        item.category === 'travel' ? 'airplane-outline' : 'cart-outline'
                                                    }
                                                    size={24}
                                                    color="#3B82F6"
                                                />
                                            </View>
                                            <View>
                                                <Text className={`font-bold text-lg ${
                                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                                }`}>
                                                    {item.type}
                                                </Text>
                                                <Text className={`${
                                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                                }`}>
                                                    {item.description}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View className={`px-3 py-1 rounded-full ${
                                        item.priority === 'high' ? 'bg-red-500' :
                                        item.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                                    }`}>
                                        <Text className="text-white text-xs capitalize">
                                            {item.priority}
                                        </Text>
                                    </View>
                                </View>

                                <View className="flex-row justify-between items-center p-3 mb-3 rounded-lg bg-opacity-50"
                                    style={[styles.detailsContainer, { 
                                        backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.5)' : 'rgba(243, 244, 246, 0.7)'
                                    }]}
                                >
                                    <View className="flex-row items-center">
                                        <Ionicons 
                                            name="person-outline" 
                                            size={16} 
                                            color={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                                        />
                                        <Text className={`ml-2 ${
                                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                        }`}>
                                            {item.submittedBy}
                                        </Text>
                                    </View>
                                    <View className="flex-row items-center">
                                        <Ionicons 
                                            name="business-outline" 
                                            size={16} 
                                            color={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                                        />
                                        <Text className={`ml-2 ${
                                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                        }`}>
                                            {item.department}
                                        </Text>
                                    </View>
                                </View>

                                <View className="flex-row justify-between items-center mb-4">
                                    <View className="flex-row items-center">
                                        <Ionicons 
                                            name="calendar-outline" 
                                            size={16} 
                                            color={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                                        />
                                        <Text className={`ml-2 ${
                                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                        }`}>
                                            {item.date}
                                        </Text>
                                    </View>
                                    <Text className="text-blue-500 font-bold text-lg">
                                        {item.amount}
                                    </Text>
                                </View>

                                <View className="flex-row justify-end space-x-3">
                                    <TouchableOpacity
                                        onPress={() => handleReject(item.id)}
                                        className="flex-row items-center px-4 py-2 rounded-lg bg-red-500"
                                        style={styles.actionButton}
                                    >
                                        <Ionicons name="close-circle-outline" size={20} color="#FFFFFF" />
                                        <Text className="text-white font-medium ml-2">Reject</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleApprove(item.id)}
                                        className="flex-row items-center px-4 py-2 rounded-lg bg-green-500"
                                        style={styles.actionButton}
                                    >
                                        <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                                        <Text className="text-white font-medium ml-2">Approve</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    ))}
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
    filterContainer: {
        padding: 16,
        flexDirection: 'row',
        gap: 8,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
    },
    approvalCard: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    detailsContainer: {
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    actionButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
        marginHorizontal: 5,
    },
});
