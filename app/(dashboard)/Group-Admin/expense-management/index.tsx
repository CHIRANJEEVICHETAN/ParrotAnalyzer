import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import axios from 'axios';
import { format } from 'date-fns';
import RejectModal from '../components/RejectModal';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface ExpenseDetail {
  id: number;
  employee_name: string;
  employee_number: string;
  department: string;
  date: string;
  total_amount: number | string;
  amount_payable: number | string;
  status: string;
  group_admin_approved: boolean | null;
  management_approved: boolean | null;
}

interface ExpenseStats {
  totalExpenses: number;
  averageExpense: number;
  pendingExpenses: number;
  approvedExpenses: number;
}

const formatAmount = (amount: string | number | undefined): string => {
  if (amount === undefined || amount === null) return '0.00';
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return numAmount.toFixed(2);
};

export default function ExpenseManagement() {
  const { theme } = ThemeContext.useTheme();
  const { token, user } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';
  const successScale = useRef(new Animated.Value(0)).current;
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [expenses, setExpenses] = useState<ExpenseDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<ExpenseStats>({
    totalExpenses: 0,
    averageExpense: 0,
    pendingExpenses: 0,
    approvedExpenses: 0,
  });
  const [approveLoading, setApproveLoading] = useState<number | null>(null);
  const [rejectLoading, setRejectLoading] = useState<number | null>(null);

  const checkUserRole = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/auth/check-role`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      console.log('User role check:', response.data);
    } catch (error) {
      console.error('Role check error:', error);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'group-admin') {
      Alert.alert(
        'Access Denied',
        'Only group admins can access this page',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(dashboard)/Group-Admin/group-admin')
          }
        ]
      );
      return;
    }
    
    checkUserRole();
    
    fetchExpenses();
  }, [user]);

  const calculateStats = (expenseData: ExpenseDetail[]) => {
    const approved = expenseData.filter(e => e.group_admin_approved === true);
    const pending = expenseData.filter(e => e.group_admin_approved === null);
    const total = expenseData.reduce((sum, expense) =>
      sum + (typeof expense.total_amount === 'string'
        ? parseFloat(expense.total_amount)
        : expense.total_amount), 0
    );

    setStats({
      totalExpenses: total,
      averageExpense: expenseData.length ? total / expenseData.length : 0,
      pendingExpenses: pending.length,
      approvedExpenses: approved.length,
    });
  };

  const fetchExpenses = async () => {
    try {
      console.log('Fetching expenses with token:', token?.substring(0, 20) + '...');
      
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/expenses/group-admin/expenses`,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Expenses response:', response.data);
      setExpenses(response.data);
      calculateStats(response.data);
    } catch (error) {
      console.error('Error fetching expenses:', {
        error,
        response: axios.isAxiosError(error) ? error.response?.data : null,
        status: axios.isAxiosError(error) ? error.response?.status : null
      });
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          Alert.alert(
            'Access Denied',
            error.response.data?.details || 'You do not have permission to view expenses.'
          );
        } else if (error.response?.status === 401) {
          Alert.alert(
            'Session Expired',
            'Your session has expired. Please log in again.',
            [
              {
                text: 'OK',
                onPress: () => router.replace('/(auth)/signin')
              }
            ]
          );
        } else {
          Alert.alert(
            'Error',
            error.response?.data?.details || 'Failed to fetch expenses.'
          );
        }
      } else {
        Alert.alert('Error', 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const showSuccessAnimation = (message: string) => {
    setSuccessMessage(message);
    setShowSuccess(true);
    Animated.sequence([
      Animated.spring(successScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
        stiffness: 200,
      }),
    ]).start();

    // Auto hide after 2 seconds
    setTimeout(() => {
      setShowSuccess(false);
      successScale.setValue(0);
      router.back();
    }, 2000);
  };

  const handleApprove = async (id: number) => {
    try {
      setApproveLoading(id);
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/expenses/group-admin/${id}/approve`,
        { approved: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setExpenses(prevExpenses => 
        prevExpenses.map(expense => 
          expense.id === id 
            ? { ...expense, status: 'approved', group_admin_approved: true }
            : expense
        )
      );
      
      showSuccessAnimation('Expense approved successfully');
    } catch (error) {
      console.error('Error approving expense:', error);
      if (axios.isAxiosError(error)) {
        Alert.alert(
          'Error',
          error.response?.data?.details || 'Failed to approve expense. Please try again.'
        );
      } else {
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setApproveLoading(null);
    }
  };

  const handleReject = async (id: number, reason: string) => {
    try {
      setRejectLoading(id);
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/expenses/group-admin/${id}/approve`,
        { 
          approved: false,
          comments: reason 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setExpenses(prevExpenses => 
        prevExpenses.map(expense => 
          expense.id === id 
            ? { ...expense, status: 'rejected', group_admin_approved: false }
            : expense
        )
      );
      
      showSuccessAnimation('Expense rejected successfully');
    } catch (error) {
      console.error('Error rejecting expense:', error);
      Alert.alert(
        'Error',
        axios.isAxiosError(error)
          ? error.response?.data?.details || 'Failed to reject expense'
          : 'Failed to reject expense'
      );
    } finally {
      setRejectLoading(null);
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = 
      expense.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.employee_number.toLowerCase().includes(searchQuery.toLowerCase());
    
    switch (activeTab) {
      case 'pending':
        return matchesSearch && expense.group_admin_approved === null;
      case 'approved':
        return matchesSearch && expense.group_admin_approved === true;
      case 'rejected':
        return matchesSearch && expense.group_admin_approved === false;
      default:
        return false;
    }
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchExpenses();
    } catch (error) {
      console.error('Error refreshing expenses:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

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
          <TouchableOpacity
            onPress={() => router.back()}
            className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
            style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}
          >
            <Ionicons 
              name="arrow-back" 
              size={24} 
              color={isDark ? '#FFFFFF' : '#111827'} 
            />
          </TouchableOpacity>
          <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
            <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Expense Management
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      {/* Search Bar - Move it closer to stats */}
      <View className="px-4 mt-2">
        <View 
          className={`flex-row items-center px-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'
          }`}
          style={styles.searchBar}
        >
          <Ionicons 
            name="search" 
            size={20} 
            color={isDark ? '#9CA3AF' : '#6B7280'} 
          />
          <TextInput
            placeholder="Search by employee name or number..."
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className={`flex-1 ml-2 py-3 ${isDark ? 'text-white' : 'text-gray-900'}`}
          />
        </View>
      </View>

      {/* Stats Section */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-4"
          contentContainerStyle={{ paddingRight: 20 }}
        >
          <View className="flex-row gap-4 pt-4 pb-2">
            {/* Total Expenses */}
            <View
              className={`p-3 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              style={[styles.statCard, { width: 150 }]}
            >
              <View className="flex-row items-center justify-between mb-1">
                <View
                  className={`p-2 rounded-full ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}
                >
                  <Ionicons
                    name="wallet-outline"
                    size={18}
                    color={isDark ? '#60A5FA' : '#3B82F6'}
                  />
                </View>
                <Text className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                  Total
                </Text>
              </View>
              <Text className={`text-xl font-bold mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'
                }`}>
                ₹{formatAmount(stats.totalExpenses)}
              </Text>
              <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                Total Expenses
              </Text>
            </View>

            {/* Average Expenses */}
            <View
              className={`p-3 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              style={[styles.statCard, { width: 150 }]}
            >
              <View className="flex-row items-center justify-between mb-1">
                <View
                  className={`p-2 rounded-full ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}
                >
                  <Ionicons
                    name="trending-up-outline"
                    size={18}
                    color={isDark ? '#34D399' : '#10B981'}
                  />
                </View>
                <Text className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                  Average
                </Text>
              </View>
              <Text className={`text-xl font-bold mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'
                }`}>
                ₹{formatAmount(stats.averageExpense)}
              </Text>
              <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                Average per Claim
              </Text>
            </View>

            {/* Pending Expenses */}
            <View
              className={`p-3 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              style={[styles.statCard, { width: 150 }]}
            >
              <View className="flex-row items-center justify-between mb-1">
                <View
                  className={`p-2 rounded-full ${isDark ? 'bg-yellow-500/20' : 'bg-yellow-100'}`}
                >
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={isDark ? '#FBBF24' : '#F59E0B'}
                  />
                </View>
                <Text className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                  Pending
                </Text>
              </View>
              <Text className={`text-xl font-bold mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'
                }`}>
                {stats.pendingExpenses}
              </Text>
              <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                Pending Claims
              </Text>
            </View>

            {/* Approved Expenses */}
            <View
              className={`p-3 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              style={[styles.statCard, { width: 150 }]}
            >
              <View className="flex-row items-center justify-between mb-1">
                <View
                  className={`p-2 rounded-full ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color={isDark ? '#A78BFA' : '#8B5CF6'}
                  />
                </View>
                <Text className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                  Approved
                </Text>
              </View>
              <Text className={`text-xl font-bold mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'
                }`}>
                {stats.approvedExpenses}
              </Text>
              <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                Approved Claims
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Tab Buttons - Adjust top margin */}
        <View className="flex-row px-4 mt-2 mb-2">
        {['pending', 'approved', 'rejected'].map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab as typeof activeTab)}
              className={`flex-1 py-2 px-4 rounded-lg mr-2 ${activeTab === tab
                ? isDark ? 'bg-blue-600' : 'bg-blue-500'
                : isDark ? 'bg-gray-800' : 'bg-white'
            }`}
            style={styles.tabButton}
          >
              <Text className={`text-center font-medium ${activeTab === tab ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
        </View>
      </View>

      {/* Expense List */}
      <ScrollView 
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[isDark ? '#60A5FA' : '#3B82F6']}
            tintColor={isDark ? '#60A5FA' : '#3B82F6'}
            progressBackgroundColor={isDark ? '#1F2937' : '#F3F4F6'}
          />
        }
      >
        {loading ? (
          <View className="flex-1 justify-center items-center p-4">
            <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
            <Text className={`mt-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Loading expenses...
            </Text>
          </View>
        ) : filteredExpenses.length === 0 ? (
          <View className={`p-8 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No {activeTab} expenses found
            </Text>
          </View>
        ) : (
          filteredExpenses.map((expense) => (
            <TouchableOpacity
              key={expense.id}
              onPress={() => router.push({
                pathname: "/(dashboard)/Group-Admin/expense-management/[id]",
                params: { id: expense.id }
              })}
              className={`mb-4 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              style={styles.expenseCard}
            >
              <View className="flex-row justify-between items-start">
                <View>
                  <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {expense.employee_name}
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {expense.employee_number}
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {format(new Date(expense.date), 'MMM dd, yyyy')}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ₹{formatAmount(expense.total_amount)}
                  </Text>
                  <Text className={`text-sm ${expense.status === 'approved'
                      ? 'text-green-500' 
                      : expense.status === 'rejected'
                        ? 'text-red-500'
                        : isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {expense.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {expense.status === 'pending' && (
                <View className="flex-row justify-end mt-4">
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleApprove(expense.id);
                    }}
                    disabled={approveLoading === expense.id || rejectLoading === expense.id}
                    className={`bg-green-500 px-4 py-2 rounded-lg mr-3 ${
                      (approveLoading === expense.id || rejectLoading === expense.id) ? 'opacity-50' : ''
                    }`}
                    style={styles.actionButton}
                  >
                    {approveLoading === expense.id ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text className="text-white font-medium text-center">Approve</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      setSelectedExpenseId(expense.id);
                      setRejectModalVisible(true);
                    }}
                    disabled={approveLoading === expense.id || rejectLoading === expense.id}
                    className={`bg-red-500 px-4 py-2 rounded-lg ${
                      (approveLoading === expense.id || rejectLoading === expense.id) ? 'opacity-50' : ''
                    }`}
                    style={styles.actionButton}
                  >
                    {rejectLoading === expense.id ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text className="text-white font-medium text-center">Reject</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <RejectModal
        visible={rejectModalVisible}
        onClose={() => {
          setRejectModalVisible(false);
          setSelectedExpenseId(null);
        }}
        onReject={(reason) => {
          if (selectedExpenseId) {
            handleReject(selectedExpenseId, reason);
          }
        }}
        isDark={isDark}
      />

      {/* Success Modal */}
      {showSuccess && (
        <Animated.View 
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 50,
            },
            {
              transform: [{ scale: successScale }],
            }
          ]}
        >
          <View style={{ alignItems: 'center', padding: 24 }}>
            <View style={{ 
              width: 80, 
              height: 80, 
              borderRadius: 40, 
              backgroundColor: isDark ? 'rgba(74, 222, 128, 0.2)' : 'rgba(74, 222, 128, 0.1)',
              justifyContent: 'center', 
              alignItems: 'center',
              marginBottom: 16
            }}>
              <MaterialCommunityIcons
                name="check-circle"
                size={40}
                color={isDark ? "#4ADE80" : "#22C55E"}
              />
            </View>
            <Text style={{ 
              fontSize: 24, 
              fontWeight: '600',
              marginBottom: 8,
              color: isDark ? '#FFFFFF' : '#111827'
            }}>
              Success!
            </Text>
            <Text style={{ 
              fontSize: 16,
              textAlign: 'center',
              color: isDark ? '#9CA3AF' : '#4B5563'
            }}>
              {successMessage}
            </Text>
          </View>
        </Animated.View>
      )}
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
  searchBar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    height: 45,
  },
  tabButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  expenseCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButton: {
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    height: 100,
  },
}); 