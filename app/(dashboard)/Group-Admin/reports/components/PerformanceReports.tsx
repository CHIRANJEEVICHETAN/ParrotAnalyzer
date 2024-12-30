import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { ReportSection } from '../types';
import ReportCard from './ReportCard';
import GraphSelector from './GraphSelector';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PerformanceAnalytics {
  attendance: Array<{
    employee_id: number;
    employee_name: string;
    days_present: number;
    punctuality_rate: number;
    completion_rate: number;
  }>;
  tasks: Array<{
    employee_id: number;
    employee_name: string;
    total_tasks: number;
    completed_tasks: number;
    on_time_completion: number;
    avg_completion_time: number;
  }>;
  expenses: Array<{
    employee_id: number;
    employee_name: string;
    total_expenses: number;
    approved_expenses: number;
    avg_expense_amount: number;
    rejected_expenses: number;
  }>;
  metrics: {
    total_employees: number;
    avg_working_hours: number;
    task_completion_rate: number;
    expense_approval_rate: number;
  };
}

const pieChartColors = [
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
];

export default function PerformanceReports({ section, isDark }: { section: ReportSection; isDark: boolean }) {
  const [graphType, setGraphType] = useState('attendance');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<PerformanceAnalytics | null>(null);

  const graphOptions = [
    { type: 'attendance', icon: 'calendar', label: 'Attendance' },
    { type: 'tasks', icon: 'checkmark-circle', label: 'Tasks' },
    { type: 'expenses', icon: 'wallet', label: 'Expenses' },
  ];

  useEffect(() => {
    fetchPerformanceAnalytics();
  }, []);

  const fetchPerformanceAnalytics = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/reports/performance-analytics`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.data) {
        console.log('Performance analytics data:', response.data);
        setAnalytics(response.data);
      }
    } catch (error: any) {
      console.error('Error fetching performance analytics:', error);
      setError(error.response?.data?.error || 'Failed to fetch performance data');
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
      decimalPlaces: 1,
      color: (opacity = 1) => `rgba(236, 72, 153, ${opacity})`,
      labelColor: (opacity = 1) => isDark ? `rgba(156, 163, 175, ${opacity})` : `rgba(107, 114, 128, ${opacity})`,
      barPercentage: 0.7,
      propsForLabels: {
        fontSize: 10,
      }
    };

    switch (graphType) {
      case 'attendance':
        const attendanceData = {
          labels: analytics.attendance.slice(0, 5).map(a => a.employee_name.split(' ')[0]),
          datasets: [{
            data: analytics.attendance.slice(0, 5).map(a => Number(a.punctuality_rate) || 0)
          }]
        };

        return (
          <BarChart
            data={attendanceData}
            width={width}
            height={220}
            chartConfig={commonConfig}
            style={{
              borderRadius: 16,
              marginVertical: 8,
            }}
            showValuesOnTopOfBars
            yAxisSuffix="%"
            fromZero
            yAxisLabel=""
          />
        );

      case 'tasks':
        const taskData = {
          labels: analytics.tasks.slice(0, 5).map(t => t.employee_name.split(' ')[0]),
          datasets: [{
            data: analytics.tasks.slice(0, 5).map(t => {
              const completionRate = t.total_tasks > 0 
                ? (t.completed_tasks / t.total_tasks) * 100 
                : 0;
              return Number(completionRate.toFixed(1));
            })
          }]
        };

        return (
          <BarChart
            data={taskData}
            width={width}
            height={220}
            chartConfig={commonConfig}
            style={{
              borderRadius: 16,
              marginVertical: 8,
            }}
            showValuesOnTopOfBars
            yAxisSuffix="%"
            fromZero
            yAxisLabel=""
          />
        );

      case 'expenses':
        // Sort employees by approved expenses to show highest first
        const sortedExpenses = [...analytics.expenses]
          .sort((a, b) => b.approved_expenses - a.approved_expenses)
          .slice(0, 5);

        const expenseData = sortedExpenses.map((e, index) => {
          const approvalRate = e.total_expenses > 0 
            ? (e.approved_expenses / e.total_expenses) * 100 
            : 0;
          return {
            name: e.employee_name.split(' ')[0],
            population: e.approved_expenses, // Use approved_expenses for slice size
            value: e.approved_expenses,      // Use approved_expenses for slice size
            total: e.total_expenses,         // Keep total for display
            color: pieChartColors[index],
            legendFontColor: isDark ? '#9CA3AF' : '#4B5563',
            legendFontSize: 12,
            percentage: Number(approvalRate.toFixed(1))
          };
        }).filter(item => item.value > 0); // Only show employees with approved expenses

        return (
          <View>
            <PieChart
              data={expenseData}
              width={width}
              height={220}
              chartConfig={commonConfig}
              accessor="value"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
            <View className="flex-row flex-wrap justify-between mt-2">
              {sortedExpenses.map((item, index) => (
                <View key={index} className="w-1/2 mb-2 flex-row items-center">
                  <View 
                    style={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: 4, 
                      backgroundColor: pieChartColors[index],
                      marginRight: 4 
                    }} 
                  />
                  <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {item.employee_name.split(' ')[0]}: {item.approved_expenses}/{item.total_expenses} exp
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View className="h-[220px] justify-center items-center">
        <ActivityIndicator size="large" color="#EC4899" />
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
              {graphType === 'attendance' ? 'Employee Punctuality (%)' :
               graphType === 'tasks' ? 'Task Completion Rate (%)' :
               'Expense Approval Rate (%)'}
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
                Total Employees
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics.total_employees || 0}
              </Text>
            </View>
            <View className="w-[48%] mb-4">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Avg. Working Hours
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics.avg_working_hours || 0}h
              </Text>
            </View>
            <View className="w-[48%]">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Task Completion Rate
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics.task_completion_rate || 0}%
              </Text>
            </View>
            <View className="w-[48%]">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Expense Approval Rate
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics.expense_approval_rate || 0}%
              </Text>
            </View>
          </View>
        </View>
      </ReportCard>
    </View>
  );
} 