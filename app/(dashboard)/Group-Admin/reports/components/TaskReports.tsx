import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions, ActivityIndicator } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { ReportSection } from '../types';
import ReportCard from './ReportCard';
import GraphSelector from './GraphSelector';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

interface TaskAnalytics {
  status: Array<{
    status: string;
    count: number;
  }>;
  trend: Array<{
    date: string;
    task_count: number;
  }>;
  priority: Array<{
    priority: string;
    count: number;
  }>;
  metrics: {
    total_tasks: number;
    assigned_employees: number;
    completion_rate: number;
    overdue_tasks: number;
    avg_completion_time: number;
  };
}

export default function TaskReports({ section, isDark }: { section: ReportSection; isDark: boolean }) {
  const [graphType, setGraphType] = useState('pie');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<TaskAnalytics | null>(null);

  const graphOptions = [
    { type: 'pie', icon: 'pie-chart', label: 'Status' },
    { type: 'line', icon: 'trending-up', label: 'Trend' },
    { type: 'bar', icon: 'bar-chart', label: 'Priority' },
  ];

  useEffect(() => {
    fetchTaskAnalytics();
  }, []);

  const fetchTaskAnalytics = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      const userData = await AsyncStorage.getItem('user_data');
      
      if (!token || !userData) {
        console.error('No token or user data found');
        setError('Authentication required');
        return;
      }

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/reports/task-analytics`,
        { 
          headers: { 
            'Authorization': `Bearer ${token}`
          } 
        }
      );

      if (response.data) {
        console.log('Raw task data:', response.data);
        setAnalytics(response.data);
      }
    } catch (error: any) {
      console.error('Error fetching task analytics:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      setError(error.response?.data?.error || 'Failed to fetch task data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'completed': '#10B981', // Green
      'in_progress': '#3B82F6', // Blue
      'pending': '#F59E0B', // Yellow
      'overdue': '#EF4444', // Red
      'cancelled': '#6B7280', // Gray
    };
    return colors[status] || colors['pending'];
  };

  const getPriorityColor = (priority: string) => {
    const colors: { [key: string]: string } = {
      'high': '#EF4444', // Red
      'medium': '#F59E0B', // Yellow
      'low': '#10B981', // Green
    };
    return colors[priority] || '#6B7280';
  };

  const renderGraph = () => {
    if (!analytics) return null;

    const width = Dimensions.get('window').width - 64;
    const commonConfig = {
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      backgroundGradientFrom: isDark ? '#1F2937' : '#FFFFFF',
      backgroundGradientTo: isDark ? '#1F2937' : '#FFFFFF',
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
      labelColor: (opacity = 1) => isDark ? `rgba(156, 163, 175, ${opacity})` : `rgba(107, 114, 128, ${opacity})`,
    };

    switch (graphType) {
      case 'pie':
        const pieData = analytics.status.map(item => ({
          name: item.status.replace('_', ' ').toUpperCase(),
          count: Number(item.count),
          color: getStatusColor(item.status),
          legendFontColor: isDark ? '#9CA3AF' : '#4B5563',
          legendFontSize: 12
        }));

        return (
          <PieChart
            data={pieData}
            width={width}
            height={220}
            chartConfig={commonConfig}
            accessor="count"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        );

      case 'line':
        const lineData = {
          labels: analytics.trend.map(item => format(new Date(item.date), 'dd/MM')),
          datasets: [{
            data: analytics.trend.map(item => Number(item.task_count))
          }]
        };

        return (
          <LineChart
            data={lineData}
            width={width}
            height={220}
            chartConfig={commonConfig}
            bezier
            style={{
              borderRadius: 16,
              marginVertical: 8,
            }}
          />
        );

      case 'bar':
        const maxCount = Math.max(...analytics.priority.map(p => Number(p.count)));
        const yAxisMax = Math.ceil(maxCount / 5) * 5;

        const barData = {
          labels: analytics.priority.map(p => p.priority.toUpperCase()),
          datasets: [{
            data: analytics.priority.map(p => Number(p.count))
          }]
        };

        return (
          <BarChart
            data={barData}
            width={width}
            height={220}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={{
              ...commonConfig,
              count: 6,
              formatYLabel: (value) => Math.round(Number(value)).toString(),
              propsForLabels: {
                fontSize: 12
              }
            }}
            style={{
              borderRadius: 16,
              marginVertical: 8,
            }}
            showValuesOnTopOfBars
            fromZero={true}
            segments={5}
          />
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View className="h-[220px] justify-center items-center">
        <ActivityIndicator size="large" color="#8B5CF6" />
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
              {graphType === 'pie' ? 'Task Status Distribution' :
               graphType === 'line' ? 'Daily Task Creation Trend' :
               'Task Priority Distribution'}
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
                Total Tasks
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics.total_tasks || 0}
              </Text>
            </View>
            <View className="w-[48%] mb-4">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Completion Rate
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics.completion_rate || 0}%
              </Text>
            </View>
            <View className="w-[48%]">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Overdue Tasks
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics.overdue_tasks || 0}
              </Text>
            </View>
            <View className="w-[48%]">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Avg. Tasks/Day
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {Number(analytics?.metrics.avg_completion_time || 0).toFixed(1)}
              </Text>
            </View>
          </View>
        </View>
      </ReportCard>
    </View>
  );
} 