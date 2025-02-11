import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import axios from 'axios';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface LeaveAnalytics {
  statistics: {
    total_requests: number;
    approved_requests: number;
    pending_requests: number;
    rejected_requests: number;
  };
  typeDistribution: Array<{
    leave_type: string;
    request_count: number;
  }>;
  trend: Array<{
    date: string;
    request_count: number;
  }>;
}

export default function LeaveAnalytics() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === 'dark';
  const screenWidth = Dimensions.get('window').width - 32; // Accounting for padding

  const [analytics, setAnalytics] = useState<LeaveAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/analytics`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: dateRange
        }
      );

      if (response.data) {
        // Ensure all required properties exist
        const analyticsData = {
          statistics: {
            total_requests: response.data.statistics?.total_requests || 0,
            approved_requests: response.data.statistics?.approved_requests || 0,
            pending_requests: response.data.statistics?.pending_requests || 0,
            rejected_requests: response.data.statistics?.rejected_requests || 0
          },
          typeDistribution: response.data.typeDistribution || [],
          trend: response.data.trend || []
        };
        setAnalytics(analyticsData);
      } else {
        setAnalytics({
          statistics: {
            total_requests: 0,
            approved_requests: 0,
            pending_requests: 0,
            rejected_requests: 0
          },
          typeDistribution: [],
          trend: []
        });
      }
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      const errorMessage = error.response?.data?.details || 
                          error.response?.data?.error || 
                          'Failed to fetch analytics data';
      setError(errorMessage);
      
      // Set empty analytics state on error
      setAnalytics({
        statistics: {
          total_requests: 0,
          approved_requests: 0,
          pending_requests: 0,
          rejected_requests: 0
        },
        typeDistribution: [],
        trend: []
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!analytics) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          No data available
        </Text>
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
          Unable to Load Analytics
        </Text>
        <Text className={`text-sm text-center mb-6 ${
          isDark ? 'text-gray-400' : 'text-gray-600'
        }`}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={fetchAnalytics}
          className="bg-blue-500 px-6 py-3 rounded-lg flex-row items-center"
        >
          <Ionicons name="refresh" size={20} color="white" style={{ marginRight: 8 }} />
          <Text className="text-white font-medium">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const chartConfig = {
    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
    backgroundGradientFrom: isDark ? '#1F2937' : '#FFFFFF',
    backgroundGradientTo: isDark ? '#1F2937' : '#FFFFFF',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) => isDark ? `rgba(156, 163, 175, ${opacity})` : `rgba(107, 114, 128, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#3B82F6',
    },
    propsForLabels: {
      fontSize: 10,
    },
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    strokeWidth: 2,
  };

  return (
    <ScrollView className="flex-1">
      {/* Summary Cards */}
      <View className="flex-row flex-wrap justify-between mb-6">
        {[
          {
            label: 'Total Requests',
            value: analytics.statistics.total_requests,
            icon: 'document-text',
            color: 'blue',
          },
          {
            label: 'Approved',
            value: analytics.statistics.approved_requests,
            icon: 'checkmark-circle',
            color: 'green',
          },
          {
            label: 'Pending',
            value: analytics.statistics.pending_requests,
            icon: 'time',
            color: 'yellow',
          },
          {
            label: 'Rejected',
            value: analytics.statistics.rejected_requests,
            icon: 'close-circle',
            color: 'red',
          },
        ].map((item) => (
          <View
            key={item.label}
            className={`w-[48%] p-4 rounded-lg mb-4 ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <View className="flex-row justify-between items-center mb-2">
              <Ionicons
                name={item.icon as any}
                size={24}
                color={
                  item.color === 'blue'
                    ? '#3B82F6'
                    : item.color === 'green'
                    ? '#10B981'
                    : item.color === 'yellow'
                    ? '#F59E0B'
                    : '#EF4444'
                }
              />
              <Text className={`text-2xl font-bold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {item.value}
              </Text>
            </View>
            <Text className={`text-sm ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Leave Type Distribution */}
      <View className={`p-4 rounded-lg mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Leave Type Distribution
        </Text>
        {analytics.typeDistribution && analytics.typeDistribution.length > 0 ? (
          <BarChart
            data={{
              labels: analytics.typeDistribution.map(d => d.leave_type.substring(0, 10) + '...'),
              datasets: [{
                data: analytics.typeDistribution.map(d => Number(d.request_count))
              }]
            }}
            width={screenWidth - 32}
            height={220}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={{
              ...chartConfig,
              barPercentage: 0.7,
              formatYLabel: (yLabel) => Math.round(parseFloat(yLabel)).toString(),
              propsForLabels: {
                ...chartConfig.propsForLabels,
                rotation: -45
              }
            }}
            style={{
              marginVertical: 8,
              borderRadius: 16
            }}
            fromZero
            showValuesOnTopOfBars
            withInnerLines={false}
            segments={4}
          />
        ) : (
          <View className="h-[220px] flex items-center justify-center">
            <Ionicons
              name="bar-chart-outline"
              size={48}
              color={isDark ? '#4B5563' : '#9CA3AF'}
            />
            <Text className={`text-sm mt-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No leave type data available for the selected period
            </Text>
          </View>
        )}
      </View>

      {/* Monthly Trend */}
      <View className={`p-4 rounded-lg mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Leave Request Trend
        </Text>
        {analytics.trend && analytics.trend.length > 0 ? (
          <LineChart
            data={{
              labels: analytics.trend.map(t => format(new Date(t.date), 'dd/MM')),
              datasets: [{
                data: analytics.trend.map(t => Number(t.request_count) || 0),
                color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                strokeWidth: 2
              }]
            }}
            width={screenWidth - 32}
            height={220}
            chartConfig={{
              ...chartConfig,
              formatYLabel: (yLabel) => Math.round(parseFloat(yLabel)).toString(),
              propsForDots: {
                r: "4",
                strokeWidth: "2",
                stroke: "#3B82F6"
              }
            }}
            style={{
              marginVertical: 8,
              borderRadius: 16
            }}
            bezier
            withInnerLines={false}
            withVerticalLines={false}
            withHorizontalLines={true}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            segments={4}
          />
        ) : (
          <View className="h-[220px] flex items-center justify-center">
            <Ionicons
              name="trending-up-outline"
              size={48}
              color={isDark ? '#4B5563' : '#9CA3AF'}
            />
            <Text className={`text-sm mt-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No trend data available for the selected period
            </Text>
          </View>
        )}
      </View>

      {/* Status Distribution */}
      <View className={`p-4 rounded-lg mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Request Status Distribution
        </Text>
        {analytics.statistics && analytics.statistics.total_requests > 0 ? (
          <PieChart
            data={[
              {
                name: 'Approved',
                population: analytics.statistics.approved_requests,
                color: '#10B981',
                legendFontColor: isDark ? '#9CA3AF' : '#4B5563',
              },
              {
                name: 'Pending',
                population: analytics.statistics.pending_requests,
                color: '#F59E0B',
                legendFontColor: isDark ? '#9CA3AF' : '#4B5563',
              },
              {
                name: 'Rejected',
                population: analytics.statistics.rejected_requests,
                color: '#EF4444',
                legendFontColor: isDark ? '#9CA3AF' : '#4B5563',
              },
            ].filter(item => item.population > 0)}
            width={screenWidth - 32}
            height={220}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        ) : (
          <View className="h-[220px] flex items-center justify-center">
            <Ionicons
              name="pie-chart-outline"
              size={48}
              color={isDark ? '#4B5563' : '#9CA3AF'}
            />
            <Text className={`text-sm mt-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No status distribution data available
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
} 