import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import axios from 'axios';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Expense {
  id: number;
  date: string;
  total_amount: number;
  amount_payable: number;
  status: string;
  rejection_reason?: string;
  created_at: string;
  vehicle_type?: string;
  vehicle_number?: string;
  total_kilometers?: number;
  route_taken?: string;
  lodging_expenses?: number;
  daily_allowance?: number;
  diesel?: number;
  toll_charges?: number;
  other_expenses?: number;
  advance_taken?: number;
}

const formatAmount = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null) return '0.00';
  return Number(amount).toFixed(2);
};

const calculateTotalAmount = (expenses: Expense[]): number => {
  return expenses.reduce((sum, expense) => sum + (expense.total_amount || 0), 0);
};

const calculateApprovedAmount = (expenses: Expense[]): number => {
  return expenses
    .filter(expense => expense.status === 'approved')
    .reduce((sum, expense) => sum + (expense.amount_payable || 0), 0);
};

export default function MyExpenses() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'approved' | 'rejected'>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      console.log('Fetching expenses from:', `${process.env.EXPO_PUBLIC_API_URL}/api/expenses/employee/my-expenses`);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/expenses/employee/my-expenses`,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Validate and transform the data
      const validExpenses = response.data.map((expense: any) => ({
        ...expense,
        total_amount: expense.total_amount ? Number(expense.total_amount) : 0,
        amount_payable: expense.amount_payable ? Number(expense.amount_payable) : 0,
        date: expense.date || new Date().toISOString(),
        status: expense.status || 'pending'
      }));
      
      setExpenses(validExpenses);
    } catch (error: any) {
      console.error('Error fetching expenses:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, selected?: Date) => {
    setShowDatePicker(false);
    if (selected) {
      setSelectedDate(selected);
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    let matchesTab = true;
    if (activeTab === 'approved') matchesTab = expense.status === 'approved';
    if (activeTab === 'rejected') matchesTab = expense.status === 'rejected';

    let matchesDate = true;
    if (selectedDate) {
      const expenseDate = new Date(expense.date);
      matchesDate = (
        expenseDate.getDate() === selectedDate.getDate() &&
        expenseDate.getMonth() === selectedDate.getMonth() &&
        expenseDate.getFullYear() === selectedDate.getFullYear()
      );
    }

    return matchesTab && matchesDate;
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return isDark ? '#34D399' : '#059669';
      case 'rejected':
        return isDark ? '#EF4444' : '#DC2626';
      default:
        return isDark ? '#F59E0B' : '#D97706';
    }
  };

  return (
    <View style={[
      styles.container,
      { backgroundColor: isDark ? '#111827' : '#F3F4F6' }
    ]}>
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 0
          }
        ]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backButton,
              { backgroundColor: isDark ? '#374151' : '#F3F4F6' }
            ]}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? '#FFFFFF' : '#000000'}
            />
          </TouchableOpacity>
          <Text 
            style={[
              styles.headerTitle,
              { color: isDark ? '#FFFFFF' : '#111827' }
            ]}
          >
            My Expenses
          </Text>
          <View style={styles.backButton}>
            <Text> </Text>
          </View>
        </View>

        <View style={[
          styles.summaryContainer,
          { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }
        ]}>
          <View style={styles.summaryItem}>
            <Text style={[
              styles.summaryLabel,
              { color: isDark ? '#9CA3AF' : '#6B7280' }
            ]}>
              Total Claimed
            </Text>
            <Text style={[
              styles.summaryValue,
              { color: isDark ? '#FFFFFF' : '#111827' }
            ]}>
              ₹ {formatAmount(calculateTotalAmount(expenses))}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[
              styles.summaryLabel,
              { color: isDark ? '#9CA3AF' : '#6B7280' }
            ]}>
              Total Approved
            </Text>
            <Text style={[
              styles.summaryValue,
              { color: isDark ? '#34D399' : '#059669' }
            ]}>
              ₹ {formatAmount(calculateApprovedAmount(expenses))}
            </Text>
          </View>
        </View>

        {/* Tab Buttons */}
        <View style={styles.tabContainer}>
          {['all', 'approved', 'rejected'].map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab as typeof activeTab)}
              style={[
                styles.tabButton,
                activeTab === tab && styles.activeTab,
                {
                  backgroundColor: activeTab === tab
                    ? (isDark ? '#374151' : '#3B82F6')
                    : 'transparent'
                }
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: activeTab === tab
                      ? '#FFFFFF'
                      : isDark ? '#9CA3AF' : '#6B7280'
                  }
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Add Date Filter after tab buttons */}
        <View style={styles.dateFilterContainer}>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={[
              styles.dateButton,
              { backgroundColor: isDark ? '#374151' : '#FFFFFF' }
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={isDark ? '#60A5FA' : '#3B82F6'}
              style={{ marginRight: 8 }}
            />
            <Text style={{ 
              color: isDark ? '#FFFFFF' : '#111827',
              fontSize: 14,
            }}>
              {selectedDate 
                ? format(selectedDate, 'MMM dd, yyyy')
                : 'Filter by Date'
              }
            </Text>
            {selectedDate && (
              <TouchableOpacity
                onPress={() => setSelectedDate(null)}
                style={{ marginLeft: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={isDark ? '#9CA3AF' : '#6B7280'}
                />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate || new Date()}
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={new Date()}
            minimumDate={new Date(2023, 0, 1)}
          />
        )}
      </View>

      {/* Expense List */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 0 }}
      >
        {loading ? (
          <ActivityIndicator 
            size="large" 
            color={isDark ? '#60A5FA' : '#3B82F6'} 
            style={styles.loader}
          />
        ) : filteredExpenses.length === 0 ? (
          <View style={[
            styles.emptyState,
            { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }
          ]}>
            <Text style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
              No expenses found
            </Text>
          </View>
        ) : (
          filteredExpenses.map((expense, index) => (
            <View
            key={expense.id}
              style={[
                styles.expenseCard,
                { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' },
                index === filteredExpenses.length - 1 && { marginBottom: 80 }
              ]}
            >
              <View style={styles.expenseHeader}>
                <Text style={[
                  styles.expenseDate,
                  { color: isDark ? '#FFFFFF' : '#111827' }
                ]}>
                  {format(new Date(expense.date), 'MMM dd, yyyy')}
                </Text>
                <Text style={[
                  styles.expenseStatus,
                  { color: getStatusColor(expense.status) }
                ]}>
                  {expense.status.toUpperCase()}
                </Text>
              </View>
              
              <View style={styles.amountContainer}>
                <Text
                  style={[
                    styles.amountLabel,
                    { color: isDark ? '#9CA3AF' : '#6B7280' }
                  ]}
                >
                  Total Amount
                </Text>
                <Text
                  style={[
                    styles.amount,
                    { color: isDark ? '#FFFFFF' : '#111827' }
                  ]}
                >
                  ₹ {formatAmount(expense.total_amount)}
                </Text>
                
                <Text
                  style={[
                    styles.amountLabel,
                    { color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 8 }
                  ]}
                >
                  Amount Payable
                </Text>
                <Text
                  style={[
                    styles.amount,
                    { color: isDark ? '#FFFFFF' : '#111827' }
                  ]}
                >
                  ₹ {formatAmount(expense.amount_payable)}
                </Text>
              </View>

              {expense.status === 'rejected' && expense.rejection_reason && (
                <Text style={[
                  styles.rejectionReason,
                  { color: isDark ? '#EF4444' : '#DC2626' }
                ]}>
                  Reason: {expense.rejection_reason}
                </Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: 'transparent',
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeTab: {
    backgroundColor: '#3B82F6',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loader: {
    marginTop: 20,
  },
  emptyState: {
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  expenseCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseDate: {
    fontSize: 16,
    fontWeight: '500',
  },
  expenseStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  amountContainer: {
    marginTop: 8,
  },
  amountLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  amount: {
    fontSize: 18,
    fontWeight: '600',
  },
  rejectionReason: {
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
  summaryContainer: {
    flexDirection: 'row',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  summaryLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '600',
  },
  dateFilterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
}); 