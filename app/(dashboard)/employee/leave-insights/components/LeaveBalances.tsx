import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import axios from 'axios';

interface LeaveBalance {
  id: number;
  name: string;
  total_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
  is_paid: boolean;
  year: number;
}

export default function LeaveBalances() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === 'dark';
  
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBalances();
  }, [selectedYear]);

  const fetchBalances = async () => {
    try {
      setError(null);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave/balance?year=${selectedYear}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBalances(response.data);
    } catch (error) {
      console.error('Error fetching balances:', error);
      setError('Failed to fetch leave balances');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBalances();
    setRefreshing(false);
  };

  const calculateAvailableDays = (total: number, used: number, pending: number) => {
    return Math.max(0, total - used - pending);
  };

  const handleYearChange = (increment: boolean) => {
    const currentYear = new Date().getFullYear();
    const newYear = selectedYear + (increment ? 1 : -1);
    
    // Prevent selecting future years
    if (newYear > currentYear) {
      return;
    }
    
    setSelectedYear(newYear);
  };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={isDark ? '#EF4444' : '#DC2626'}
        />
        <Text className={`text-lg text-center mt-4 mb-2 ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={fetchBalances}
          className="bg-blue-500 px-6 py-3 rounded-lg flex-row items-center mt-4"
        >
          <Ionicons name="refresh" size={20} color="white" style={{ marginRight: 8 }} />
          <Text className="text-white font-medium">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Header with Year Selection */}
      <View className="flex-row justify-between items-center mb-6">
        <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Leave Balances
        </Text>
        <View className="flex-row items-center space-x-4">
          <TouchableOpacity
            onPress={() => handleYearChange(false)}
            className={`p-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={isDark ? '#D1D5DB' : '#4B5563'}
            />
          </TouchableOpacity>
          <Text className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {selectedYear}
          </Text>
          <TouchableOpacity
            onPress={() => handleYearChange(true)}
            disabled={selectedYear >= new Date().getFullYear()}
            className={`p-2 rounded-lg ${
              selectedYear >= new Date().getFullYear()
                ? isDark
                  ? 'bg-gray-700'
                  : 'bg-gray-200'
                : isDark
                ? 'bg-gray-800'
                : 'bg-gray-100'
            }`}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={
                selectedYear >= new Date().getFullYear()
                  ? isDark
                    ? '#6B7280'
                    : '#9CA3AF'
                  : isDark
                  ? '#D1D5DB'
                  : '#4B5563'
              }
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Balance Cards */}
      {balances.length === 0 ? (
        <View className={`p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            No leave balances found for {selectedYear}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="space-y-4"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3B82F6']}
              tintColor={isDark ? '#FFFFFF' : '#3B82F6'}
            />
          }
        >
          {balances.map((balance) => {
            const availableDays = calculateAvailableDays(
              balance.total_days || 0,
              balance.used_days || 0,
              balance.pending_days || 0
            );
            const usagePercentage = ((balance.used_days + balance.pending_days) / balance.total_days) * 100;
            
            return (
              <View
                key={balance.id}
                className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} mb-4`}
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View>
                    <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {balance.name}
                    </Text>
                    <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {balance.is_paid ? 'Paid Leave' : 'Unpaid Leave'}
                    </Text>
                  </View>
                  <View className={`px-3 py-1 rounded-full ${
                    availableDays > 0 ? 'bg-blue-100' : 'bg-red-100'
                  }`}>
                    <Text className={availableDays > 0 ? 'text-blue-800' : 'text-red-800'}>
                      {availableDays} days left
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View className="mt-2 mb-4">
                  <View className="h-2 rounded-full bg-gray-200">
                    <View
                      className="h-2 rounded-full bg-green-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, usagePercentage))}%`,
                      }}
                    />
                  </View>
                </View>

                {/* Days Details */}
                <View className="flex-row justify-between">
                  <View>
                    <Text className="text-sm text-gray-500">Total</Text>
                    <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {balance.total_days || 0} days
                    </Text>
                  </View>
                  <View>
                    <Text className="text-sm text-gray-500">Used</Text>
                    <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {balance.used_days || 0} days
                    </Text>
                  </View>
                  <View>
                    <Text className="text-sm text-gray-500">Pending</Text>
                    <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {balance.pending_days || 0} days
                    </Text>
                  </View>
                  <View>
                    <Text className="text-sm text-gray-500">Available</Text>
                    <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {availableDays} days
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
} 