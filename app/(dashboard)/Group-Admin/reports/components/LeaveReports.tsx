import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions, ActivityIndicator } from 'react-native';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { ReportSection } from '../types';
import ReportCard from './ReportCard';
import GraphSelector from './GraphSelector';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

interface LeaveAnalytics {
  leaveTypes: Array<{
    leave_type: string;
    request_count: number;
    approved_count: number;
    rejected_count: number;
    pending_count: number;
  }>;
  employeeStats: Array<{
    employee_id: number;
    employee_name: string;
    total_requests: number;
    approved_requests: number;
    total_leave_days: number;
    leave_types: string;
  }>;
  balances: {
    casual_leave: number;
    sick_leave: number;
    annual_leave: number;
  };
  trend: Array<{
    date: string;
    request_count: number;
    approved_count: number;
  }>;
  metrics: {
    total_employees_on_leave: number;
    total_requests: number;
    approved_requests: number;
    pending_requests: number;
    approval_rate: number;
    total_leave_days: number;
  };
}

export default function LeaveReports({ section, isDark }: { section: ReportSection; isDark: boolean }) {
  const [graphType, setGraphType] = useState('requests');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<LeaveAnalytics | null>(null);

  const graphOptions = [
    { type: 'requests', icon: 'document-text', label: 'Requests' },
    { type: 'trend', icon: 'trending-up', label: 'Trend' },
    { type: 'balances', icon: 'calendar', label: 'Balances' }
  ];

  useEffect(() => {
    fetchLeaveAnalytics();
  }, []);

  const fetchLeaveAnalytics = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/reports/leave-analytics`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.data) {
        setAnalytics(response.data);
      }
    } catch (error: any) {
      console.error('Error fetching leave analytics:', error);
      setError(error.response?.data?.error || 'Failed to fetch leave data');
    } finally {
      setLoading(false);
    }
  };

  const renderGraph = () => {
    if (!analytics) return null;

    const width = Dimensions.get('window').width - 64;
    const commonConfig = {
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      backgroundGradientFrom: isDark ? '#1F2937' : '#FFFFFF',
      backgroundGradientTo: isDark ? '#1F2937' : '#FFFFFF',
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
      labelColor: (opacity = 1) => isDark ? `rgba(156, 163, 175, ${opacity})` : `rgba(107, 114, 128, ${opacity})`,
      barPercentage: 0.7,
    };

    switch (graphType) {
      case 'requests':
        const requestData = {
          labels: analytics.leaveTypes.map(lt => lt.leave_type),
          datasets: [{
            data: analytics.leaveTypes.map(lt => lt.request_count)
          }]
        };

        return (
          <BarChart
            data={requestData}
            width={width}
            height={220}
            chartConfig={commonConfig}
            style={{
              borderRadius: 16,
              marginVertical: 8,
            }}
            showValuesOnTopOfBars
          />
        );

      case 'trend':
        const trendData = {
          labels: analytics.trend.map(t => format(new Date(t.date), 'dd/MM')),
          datasets: [{
            data: analytics.trend.map(t => t.request_count)
          }]
        };

        return (
          <LineChart
            data={trendData}
            width={width}
            height={220}
            chartConfig={commonConfig}
            style={{
              borderRadius: 16,
              marginVertical: 8,
            }}
            bezier
          />
        );

      case 'balances':
        const balanceData = {
          labels: ['Casual', 'Sick', 'Annual'],
          datasets: [{
            data: [
              analytics.balances.casual_leave,
              analytics.balances.sick_leave,
              analytics.balances.annual_leave
            ]
          }]
        };

        return (
          <BarChart
            data={balanceData}
            width={width}
            height={220}
            chartConfig={{
              ...commonConfig,
              color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
            }}
            style={{
              borderRadius: 16,
              marginVertical: 8,
            }}
            showValuesOnTopOfBars
          />
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View className="h-[220px] justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="h-[220px] justify-center items-center">
        <Text className="text-red-500">{error}</Text>
      </View>
    );
  }

  return (
    <View className="mb-4">
      <ReportCard section={section} isDark={isDark}>
        <View className="mt-4">
          <View className="mb-4">
            <Text className={`text-base font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {graphType === 'requests' ? 'Leave Requests by Type' :
               graphType === 'trend' ? 'Leave Request Trend' :
               'Leave Balance Distribution'}
            </Text>
            <GraphSelector
              options={graphOptions}
              selectedType={graphType}
              onSelect={setGraphType}
              isDark={isDark}
            />
          </View>

          {renderGraph()}

          {/* Metrics Display */}
          <View className="flex-row flex-wrap justify-between mt-4">
            <View className="w-[48%] mb-4">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Total Requests
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics.total_requests || 0}
              </Text>
            </View>
            <View className="w-[48%] mb-4">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Pending Requests
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics.pending_requests || 0}
              </Text>
            </View>
            <View className="w-[48%]">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Approval Rate
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics.approval_rate || 0}%
              </Text>
            </View>
            <View className="w-[48%]">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Total Leave Days
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics.total_leave_days || 0}
              </Text>
            </View>
          </View>
        </View>
      </ReportCard>
    </View>
  );
} 