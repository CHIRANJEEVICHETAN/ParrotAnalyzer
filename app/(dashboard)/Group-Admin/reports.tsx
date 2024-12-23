import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import axios from 'axios';
import { format } from 'date-fns';

type ReportType = 'expense' | 'attendance' | 'activity';

type IconName = keyof typeof Ionicons.glyphMap;

interface ExpenseSummary {
  totalAmount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

interface EmployeeExpense {
  employee_name: string;
  total_expenses: number;
  approved_count: number;
  rejected_count: number;
}

interface ReportSummary {
  title: string;
  count: number;
  icon: IconName;
  color: string;
  format?: (value: number) => string;
}

export default function GroupAdminReports() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [selectedType, setSelectedType] = useState<ReportType>('expense');
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary>({
    totalAmount: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0
  });
  const [employeeExpenses, setEmployeeExpenses] = useState<EmployeeExpense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExpenseReports();
  }, []);

  const fetchExpenseReports = async () => {
    try {
      const [summaryRes, employeeRes] = await Promise.all([
        axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/expenses/group-admin/reports/expenses/summary`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/expenses/group-admin/reports/expenses/by-employee`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      ]);

      setExpenseSummary(summaryRes.data);
      setEmployeeExpenses(employeeRes.data);
    } catch (error) {
      console.error('Error fetching expense reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const reportSummaries: ReportSummary[] = [
    { 
      title: 'Total Expenses', 
      count: expenseSummary.totalAmount, 
      icon: 'cash-outline' as IconName,
      color: '#10B981',
      format: (value: number) => `₹${value.toFixed(2)}`
    },
    { 
      title: 'Pending Approvals', 
      count: expenseSummary.pendingCount, 
      icon: 'time-outline' as IconName,
      color: '#EF4444'
    },
    { 
      title: 'Approved', 
      count: expenseSummary.approvedCount, 
      icon: 'checkmark-circle-outline' as IconName,
      color: '#10B981'
    },
    { 
      title: 'Rejected', 
      count: expenseSummary.rejectedCount, 
      icon: 'close-circle-outline' as IconName,
      color: '#F59E0B'
    }
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
                {summary.format ? summary.format(summary.count) : summary.count}
              </Text>
              <Text className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {summary.title}
              </Text>
            </View>
          ))}
        </View>

        {/* Employee-wise Expense Report */}
        <View className={`mx-4 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={styles.reportCard}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Employee Expense Report
          </Text>
          {employeeExpenses.map((employee, index) => (
            <View 
              key={index} 
              className={`py-4 ${
                index !== employeeExpenses.length - 1 ? 'border-b' : ''
              } ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
            >
              <View className="flex-row justify-between items-start">
                <View>
                  <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {employee.employee_name}
                  </Text>
                  <Text className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Total Expenses: ₹{employee.total_expenses.toFixed(2)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-green-500">
                    {employee.approved_count} Approved
                  </Text>
                  <Text className="text-red-500">
                    {employee.rejected_count} Rejected
                  </Text>
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
    marginBottom: 16,
  },
});
