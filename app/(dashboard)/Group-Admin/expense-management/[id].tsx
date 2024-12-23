import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import axios from 'axios';
import { format } from 'date-fns';
import DocumentViewer from '../components/DocumentViewer';
import RejectModal from '../components/RejectModal';

interface ExpenseDetail {
  id: number;
  employee_name: string;
  employee_number: string;
  department: string;
  designation: string;
  location: string;
  date: string;
  vehicle_type: string;
  vehicle_number: string;
  total_kilometers: number;
  start_time: string;
  end_time: string;
  route_taken: string;
  lodging_expenses: number;
  daily_allowance: number;
  diesel: number;
  toll_charges: number;
  other_expenses: number;
  advance_taken: number;
  total_amount: number | string;
  amount_payable: number | string;
  status: string;
  documents?: Array<{
    id: number;
    file_name: string;
    file_type: string;
    file_size: number;
    file_data: string;
    created_at: string;
  }>;
}

const formatAmount = (amount: string | number | undefined): string => {
  if (amount === undefined || amount === null) return '0.00';
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return numAmount.toFixed(2);
};

export default function ExpenseDetailView() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isDark = theme === 'dark';

  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);

  useEffect(() => {
    fetchExpenseDetail();
    fetchDocuments();
  }, [id]);

  const fetchExpenseDetail = async () => {
    try {
      console.log('Fetching expense details for ID:', id);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/expenses/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      console.log('Expense details received:', response.data);
      setExpense(response.data);
    } catch (error) {
      console.error('Error fetching expense detail:', error);
      if (axios.isAxiosError(error)) {
        Alert.alert(
          'Error',
          error.response?.data?.details || 'Failed to fetch expense details'
        );
      } else {
        Alert.alert('Error', 'Failed to fetch expense details');
      }
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/expenses/${id}/documents`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setExpense(prev => prev ? { ...prev, documents: response.data } : null);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleApprove = async () => {
    try {
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/expenses/group-admin/${id}/approve`,
        { approved: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Expense approved successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error approving expense:', error);
      Alert.alert('Error', 'Failed to approve expense');
    }
  };

  const handleReject = async (reason: string) => {
    try {
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/expenses/group-admin/${id}/approve`,
        { 
          approved: false,
          comments: reason 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Expense rejected successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error rejecting expense:', error);
      Alert.alert(
        'Error',
        axios.isAxiosError(error)
          ? error.response?.data?.details || 'Failed to reject expense'
          : 'Failed to reject expense'
      );
    }
  };

  const formatDateTime = (dateString: string | undefined, formatStr: string): string => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), formatStr);
    } catch (error) {
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
      </View>
    );
  }

  if (!expense) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className={isDark ? 'text-white' : 'text-gray-900'}>
          Expense not found
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#F3F4F6' }}>
      {/* Header */}
      <View className={`p-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={styles.header}>
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="p-2">
            <Ionicons 
              name="arrow-back" 
              size={24} 
              color={isDark ? '#FFFFFF' : '#000000'} 
            />
          </TouchableOpacity>
          <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Expense Details
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Employee Info */}
        <View 
          className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          style={styles.card}
        >
          <Text className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Employee Information
          </Text>
          <DetailRow label="Name" value={expense.employee_name} isDark={isDark} />
          <DetailRow label="Employee ID" value={expense.employee_number} isDark={isDark} />
          <DetailRow label="Department" value={expense.department} isDark={isDark} />
          <DetailRow label="Designation" value={expense.designation} isDark={isDark} />
        </View>

        {/* Travel Details */}
        <View 
          className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          style={styles.card}
        >
          <Text className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Travel Details
          </Text>
          <DetailRow 
            label="Date" 
            value={formatDateTime(expense.date, 'MMM dd, yyyy')} 
            isDark={isDark} 
          />
          <DetailRow label="Vehicle Type" value={expense.vehicle_type} isDark={isDark} />
          <DetailRow label="Vehicle Number" value={expense.vehicle_number} isDark={isDark} />
          <DetailRow 
            label="Total Kilometers" 
            value={`${expense.total_kilometers} km`} 
            isDark={isDark} 
          />
          <DetailRow 
            label="Start Time" 
            value={formatDateTime(expense.start_time, 'hh:mm a')} 
            isDark={isDark} 
          />
          <DetailRow 
            label="End Time" 
            value={formatDateTime(expense.end_time, 'hh:mm a')} 
            isDark={isDark} 
          />
          <DetailRow label="Route" value={expense.route_taken} isDark={isDark} />
        </View>

        {/* Expense Details */}
        <View 
          className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          style={styles.card}
        >
          <Text className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Expense Breakdown
          </Text>
          <DetailRow 
            label="Lodging Expenses" 
            value={`₹${formatAmount(expense.lodging_expenses)}`} 
            isDark={isDark} 
          />
          <DetailRow 
            label="Daily Allowance" 
            value={`₹${formatAmount(expense.daily_allowance)}`} 
            isDark={isDark} 
          />
          <DetailRow 
            label="Diesel" 
            value={`₹${formatAmount(expense.diesel)}`} 
            isDark={isDark} 
          />
          <DetailRow 
            label="Toll Charges" 
            value={`₹${formatAmount(expense.toll_charges)}`} 
            isDark={isDark} 
          />
          <DetailRow 
            label="Other Expenses" 
            value={`₹${formatAmount(expense.other_expenses)}`} 
            isDark={isDark} 
          />
          <View className="border-t border-gray-200 my-2" />
          <DetailRow 
            label="Total Amount" 
            value={`₹${formatAmount(expense.total_amount)}`} 
            isDark={isDark} 
            isHighlighted 
          />
          <DetailRow 
            label="Advance Taken" 
            value={`₹${formatAmount(expense.advance_taken)}`} 
            isDark={isDark} 
          />
          <DetailRow 
            label="Amount Payable" 
            value={`₹${formatAmount(expense.amount_payable)}`} 
            isDark={isDark} 
            isHighlighted 
          />
        </View>

        {/* Attached Documents */}
        {expense.documents && expense.documents.length > 0 && (
          <View 
            className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            style={styles.card}
          >
            <Text className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Attached Documents
            </Text>
            {expense.documents.map(doc => (
              <DocumentViewer
                key={doc.id}
                document={doc}
                isDark={isDark}
              />
            ))}
          </View>
        )}

        {/* Action Buttons */}
        {expense.status === 'pending' && (
          <View className="flex-row justify-end mt-4 mb-8">
            <TouchableOpacity
              onPress={handleApprove}
              className="bg-green-500 px-6 py-3 rounded-lg mr-4"
              style={styles.actionButton}
            >
              <Text className="text-white font-medium text-center">Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setRejectModalVisible(true)}
              className="bg-red-500 px-6 py-3 rounded-lg"
              style={styles.actionButton}
            >
              <Text className="text-white font-medium text-center">Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <RejectModal
        visible={rejectModalVisible}
        onClose={() => setRejectModalVisible(false)}
        onReject={handleReject}
        isDark={isDark}
      />
    </View>
  );
}

const DetailRow = ({ 
  label, 
  value, 
  isDark, 
  isHighlighted = false,
  prefix = ''
}: { 
  label: string; 
  value: string | undefined; 
  isDark: boolean;
  isHighlighted?: boolean;
  prefix?: string;
}) => (
  <View className="flex-row justify-between items-center py-1">
    <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
      {label}
    </Text>
    <Text className={`${
      isHighlighted
        ? 'font-semibold ' + (isDark ? 'text-white' : 'text-gray-900')
        : isDark ? 'text-gray-300' : 'text-gray-800'
    }`}>
      {value ? `${prefix}${value}` : 'N/A'}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButton: {
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
}); 