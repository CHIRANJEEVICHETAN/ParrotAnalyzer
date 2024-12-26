import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  StatusBar,
  ActivityIndicator 
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import axios from 'axios';
import { format } from 'date-fns';

type ReportType = 'expense' | 'attendance' | 'activity';
type IconName = keyof typeof Ionicons.glyphMap;

interface Report {
  id: number;
  type: ReportType;
  title: string;
  date: string;
  amount: number | null;
  status: string | null;
}

export default function GroupAdminReports() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);  // Clear any previous errors
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/reports`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setReports(response.data);
    } catch (error: any) {
      console.error('Error fetching reports:', error);
      setError(error.response?.data?.message || 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const getIconName = (type: ReportType): IconName => {
    switch (type) {
      case 'expense':
        return 'receipt-outline';
      case 'attendance':
        return 'calendar-outline';
      case 'activity':
        return 'bar-chart-outline';
      default:
        return 'document-text-outline';
    }
  };

  // Safe amount formatting function
  const formatAmount = (amount: number | null | undefined): string => {
    // If amount is null or undefined, return default
    if (amount == null) return '0.00';
    
    // Convert string to number if needed
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    // Check if it's a valid number
    if (isNaN(numAmount)) {
      console.warn('Invalid amount received:', amount);
      return '0.00';
    }
    
    try {
      return numAmount.toFixed(2);
    } catch (error) {
      console.error('Error formatting amount:', error, 'Amount:', amount);
      return '0.00';
    }
  };

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
              Reports
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
          </View>
        ) : error ? (
          <View className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-center text-red-500`}>
              {error}
            </Text>
            <TouchableOpacity 
              onPress={fetchReports}
              className="mt-4 bg-blue-500 p-3 rounded-lg"
            >
              <Text className="text-white text-center font-medium">
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : reports.length === 0 ? (
          <View className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No reports found
            </Text>
          </View>
        ) : (
          reports.map((report, index) => (
            <TouchableOpacity
              key={`${report.type}-${report.id || index}`}
              className={`mb-4 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              style={styles.reportCard}
              onPress={() => {/* Handle report press */}}
            >
              <View className="flex-row items-center">
                <View className={`w-12 h-12 rounded-full items-center justify-center bg-blue-100`}>
                  <Ionicons 
                    name={getIconName(report.type)}
                    size={24}
                    color="#3B82F6"
                  />
                </View>
                <View className="ml-4 flex-1">
                  <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {report.title}
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {format(new Date(report.date), 'MMM dd, yyyy')}
                  </Text>
                </View>
                {report.type === 'expense' && report.amount !== null && (
                  <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ₹{formatAmount(report.amount)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
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
  reportCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  }
});
