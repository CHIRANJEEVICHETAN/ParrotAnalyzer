import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import axios from 'axios';

interface LeaveBalance {
  id: number;
  user_id: number;
  leave_type_id: number;
  leave_type_name: string;
  total_days: number;
  used_days: number;
  pending_days: number;
  year: number;
  is_paid: boolean;
}

export default function LeaveBalanceTracker() {
  const { theme } = ThemeContext.useTheme();
  const { token, user } = AuthContext.useAuth();
  const isDark = theme === 'dark';

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchBalances();
  }, [selectedYear]);

  const fetchBalances = async () => {
    try {
      if (!user?.id) {
        setError('User not authenticated');
        return;
      }

      setLoading(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/leave-balances/${user.id}?year=${selectedYear}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBalances(response.data);
      setError(null);
    } catch (error) {
      console.error('Error fetching balances:', error);
      setError('Failed to fetch balances');
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (used: number, total: number) => {
    const percentage = (used / total) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Header with Year Selection */}
      <View className="flex-row justify-between items-center mb-6">
        <Text className={`text-xl font-semibold ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>
          Leave Balances
        </Text>
        <View className="flex-row items-center space-x-4">
          <TouchableOpacity
            onPress={() => setSelectedYear(prev => prev - 1)}
            className={`p-2 rounded-full ${
              isDark ? 'bg-gray-800' : 'bg-gray-100'
            }`}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </TouchableOpacity>
          <Text className={`text-lg font-medium ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            {selectedYear}
          </Text>
          <TouchableOpacity
            onPress={() => setSelectedYear(prev => prev + 1)}
            className={`p-2 rounded-full ${
              isDark ? 'bg-gray-800' : 'bg-gray-100'
            }`}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Balances List */}
      <ScrollView className="flex-1">
        {balances.map((balance) => (
          <View
            key={balance.id}
            className={`mb-4 p-4 rounded-lg ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <View className="flex-row justify-between items-start mb-2">
              <View>
                <Text className={`text-lg font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {balance.leave_type_name}
                </Text>
                <Text className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {balance.is_paid ? 'Paid Leave' : 'Unpaid Leave'}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Text className={`text-lg font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {balance.total_days - balance.used_days - balance.pending_days}
                </Text>
                <Text className={`text-sm ml-1 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  days left
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View className={`h-2 rounded-full mt-2 ${
              isDark ? 'bg-gray-700' : 'bg-gray-200'
            }`}>
              <View
                className={`h-full rounded-full ${
                  getProgressColor(balance.used_days + balance.pending_days, balance.total_days)
                }`}
                style={{
                  width: `${Math.min(
                    ((balance.used_days + balance.pending_days) / balance.total_days) * 100,
                    100
                  )}%`
                }}
              />
            </View>

            {/* Details */}
            <View className="flex-row justify-between mt-4">
              <View>
                <Text className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Total
                </Text>
                <Text className={`text-base font-medium ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {balance.total_days} days
                </Text>
              </View>
              <View>
                <Text className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Used
                </Text>
                <Text className={`text-base font-medium ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {balance.used_days} days
                </Text>
              </View>
              <View>
                <Text className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Pending
                </Text>
                <Text className={`text-base font-medium ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {balance.pending_days} days
                </Text>
              </View>
              <View>
                <Text className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Available
                </Text>
                <Text className={`text-base font-medium ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {balance.total_days - balance.used_days - balance.pending_days} days
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
} 