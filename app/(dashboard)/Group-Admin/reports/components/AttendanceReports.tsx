import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions, ActivityIndicator } from 'react-native';
import { BarChart, LineChart, ContributionGraph } from 'react-native-chart-kit';
import { ReportSection } from '../types';
import ReportCard from './ReportCard';
import GraphSelector from './GraphSelector';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

interface AttendanceAnalytics {
  daily: Array<{
    day: number;
    attendance_count: number;
    on_time_count: number;
  }>;
  weekly: Array<{
    week: string;
    attendance_count: number;
    avg_hours: number;
  }>;
  heatmap: Array<{
    date: string;
    count: number;
  }>;
  metrics: {
    total_employees: number;
    avg_hours: number;
    on_time_rate: number;
    total_distance: number;
    total_expenses: number;
  };
}

export default function AttendanceReports({ section, isDark }: { section: ReportSection; isDark: boolean }) {
  const [graphType, setGraphType] = useState('bar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AttendanceAnalytics | null>(null);

  const graphOptions = [
    { type: 'bar', icon: 'bar-chart', label: 'Daily' },
    { type: 'line', icon: 'trending-up', label: 'Trend' },
    { type: 'heatmap', icon: 'calendar', label: 'Calendar' },
  ];

  useEffect(() => {
    fetchAttendanceAnalytics();
  }, []);

  const fetchAttendanceAnalytics = async () => {
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
        `${process.env.EXPO_PUBLIC_API_URL}/api/reports/attendance-analytics`,
        { 
          headers: { 
            'Authorization': `Bearer ${token}`
          } 
        }
      );

      if (response.data) {
        console.log('Raw attendance data:', response.data);
        
        const processMetrics = (data: any) => {
          return {
            total_employees: Math.max(0, Number(data?.total_employees || 0)),
            avg_hours: Math.min(24, Math.max(0, Number(data?.avg_hours || 0))),
            on_time_rate: Math.min(100, Math.max(0, Number(data?.on_time_rate || 0))),
            total_distance: Math.max(0, Number(data?.total_distance || 0)),
            total_expenses: Math.max(0, Number(data?.total_expenses || 0))
          };
        };
        
        const processedData = {
          ...response.data,
          metrics: processMetrics(response.data.metrics)
        };
        
        console.log('Processed attendance data:', processedData);
        setAnalytics(processedData);
      }
    } catch (error: any) {
      console.error('Error fetching attendance analytics:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      setError(error.response?.data?.error || 'Failed to fetch attendance data');
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
      color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
      labelColor: (opacity = 1) => isDark ? `rgba(156, 163, 175, ${opacity})` : `rgba(107, 114, 128, ${opacity})`,
    };

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    switch (graphType) {
      case 'bar':
        // Find the maximum value for Y-axis scaling
        const maxAttendance = Math.max(...analytics.daily.map(d => Number(d.attendance_count || 0)));
        const yAxisMax = Math.ceil(maxAttendance / 5) * 5; // Round up to nearest multiple of 5
        
        const barData = {
          labels: analytics.daily.map(d => dayNames[d.day]),
          datasets: [{
            data: analytics.daily.map(d => Number(d.attendance_count || 0))
          }]
        };
        
        return (
          <BarChart
            data={barData}
            width={width}
            height={220}
            yAxisLabel=""
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
            yAxisSuffix=""
            withInnerLines={true}
          />
        );

      case 'line':
        const lineData = {
          labels: analytics.weekly.map(w => {
            const date = new Date(w.week);
            return format(date, 'MMM d');
          }),
          datasets: [{
            data: analytics.weekly.map(w => Number(w.attendance_count || 0))
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

      case 'heatmap':
        return (
          <ContributionGraph
            values={analytics.heatmap}
            endDate={new Date()}
            numDays={7}
            width={width}
            height={220}
            tooltipDataAttrs={() => ({
              fill: 'transparent'
            })}
            chartConfig={commonConfig}
            style={{
              borderRadius: 16,
              marginVertical: 8,
            }}
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
              {graphType === 'bar' ? 'Daily Attendance Rate' :
               graphType === 'line' ? 'Weekly Attendance Trend' :
               'Attendance Heatmap'}
            </Text>
            <GraphSelector
              options={graphOptions}
              selectedType={graphType}
              onSelect={setGraphType}
              isDark={isDark}
            />
          </View>

          {renderGraph()}

          {/* Additional Metrics */}
          <View className="flex-row flex-wrap justify-between mt-4">
            <View className="w-[48%] mb-4">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                On-Time Rate
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {Number(analytics?.metrics?.on_time_rate || 0).toFixed(1)}%
              </Text>
            </View>
            <View className="w-[48%] mb-4">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Avg. Working Hours
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {Number(analytics?.metrics?.avg_hours || 0).toFixed(1)}h
              </Text>
            </View>
            <View className="w-[48%]">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Total Distance
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {Number(analytics?.metrics?.total_distance || 0).toFixed(1)} km
              </Text>
            </View>
            <View className="w-[48%]">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Total Expenses
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ₹{Number(analytics?.metrics?.total_expenses || 0).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </ReportCard>
    </View>
  );
} 