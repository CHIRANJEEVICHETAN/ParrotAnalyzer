import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { ReportSection } from '../types';
import ReportCard from './ReportCard';
import GraphSelector from './GraphSelector';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

interface LeaveAnalytics {
  leaveTypes: Array<{
    leave_type: string;
    request_count: number;
    approved_count: number;
    rejected_count: number;
    pending_count: number;
    total_days: number;
    default_days: number;
    max_consecutive_days: number;
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
    total_available: number;
    total_used: number;
    total_pending: number;
    employee_count: number;
    leave_types_balances: Array<{
      leave_type: string;
      total_available: number;
      total_used: number;
      total_pending: number;
    }>;
  };
  trend: Array<{
    date: string;
    request_count: number;
    approved_count: number;
    total_days: number;
  }>;
  metrics: {
    total_employees_on_leave: number;
    total_requests: number;
    approved_requests: number;
    pending_requests: number;
    approval_rate: number;
    total_leave_days: number;
  };
  departments: string[];
  employees: Array<{ id: number; name: string }>;
}

interface FilterOptions {
  startDate: Date;
  endDate: Date;
  department?: string;
  employeeId?: number;
}

export default function LeaveReports({ section, isDark }: { section: ReportSection; isDark: boolean }) {
  const [graphType, setGraphType] = useState('requests');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<LeaveAnalytics | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filters, setFilters] = useState<FilterOptions>({
    startDate: startOfMonth(subMonths(new Date(), 1)),
    endDate: endOfMonth(new Date()),
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: number; name: string }>>([]);
  const screenWidth = Dimensions.get('window').width - 32;

  const graphOptions = [
    { type: 'requests', icon: 'document-text', label: 'Requests' },
    { type: 'trend', icon: 'trending-up', label: 'Trend' },
    { type: 'balances', icon: 'calendar', label: 'Balances' },
    { type: 'distribution', icon: 'pie-chart', label: 'Distribution' },
    { type: 'employees', icon: 'people', label: 'Employees' },
    { type: 'utilization', icon: 'analytics', label: 'Utilization' }
  ];

  useEffect(() => {
    fetchLeaveAnalytics();
  }, [filters]);

  const fetchLeaveAnalytics = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      console.log('Fetching leave analytics...');
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/reports/leave-analytics`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          params: {
            start_date: format(filters.startDate, 'yyyy-MM-dd'),
            end_date: format(filters.endDate, 'yyyy-MM-dd'),
            department: filters.department,
            employee_id: filters.employeeId
          }
        }
      );

      console.log('Leave analytics response status:', response.status);
      
      if (response.data) {
        setAnalytics(response.data);
        setDepartments(response.data.departments || []);
        setEmployees(response.data.employees || []);
      }
    } catch (error: any) {
      console.error('Error fetching leave analytics:', error);
      setError(error.response?.data?.error || 'Failed to fetch leave analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, selectedDate: Date | undefined, isStart: boolean) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
      setShowEndPicker(false);
    }

    if (selectedDate) {
      setFilters(prev => ({
        ...prev,
        [isStart ? 'startDate' : 'endDate']: selectedDate
      }));
    }
  };

  const renderMetricsCards = () => (
    <View className="flex-row flex-wrap justify-between mb-4">
      <View className={`w-[48%] p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Total Requests
        </Text>
        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {analytics?.metrics.total_requests || 0}
        </Text>
      </View>
      <View className={`w-[48%] p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Approval Rate
        </Text>
        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {analytics?.metrics.approval_rate || 0}%
        </Text>
      </View>
      <View className={`w-[48%] p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Total Days
        </Text>
        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {analytics?.metrics.total_leave_days || 0}
        </Text>
      </View>
      <View className={`w-[48%] p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Employees on Leave
        </Text>
        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {analytics?.metrics.total_employees_on_leave || 0}
        </Text>
      </View>
    </View>
  );

  const renderFilters = () => (
    <View className="mb-4">
      {/* Date Range */}
      <View className="flex-row justify-between mb-2">
        <TouchableOpacity
          onPress={() => setShowStartPicker(true)}
          className={`flex-1 mr-2 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
        >
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            From
          </Text>
          <Text className={isDark ? 'text-white' : 'text-gray-900'}>
            {format(filters.startDate, 'dd MMM yyyy')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowEndPicker(true)}
          className={`flex-1 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
        >
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            To
          </Text>
          <Text className={isDark ? 'text-white' : 'text-gray-900'}>
            {format(filters.endDate, 'dd MMM yyyy')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Department Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-2"
      >
        <TouchableOpacity
          onPress={() => setFilters(prev => ({ ...prev, department: undefined }))}
          className={`mr-2 px-4 py-2 rounded-full ${
            !filters.department
              ? 'bg-blue-500'
              : isDark ? 'bg-gray-700' : 'bg-gray-200'
          }`}
        >
          <Text className={
            !filters.department
              ? 'text-white'
              : isDark ? 'text-gray-300' : 'text-gray-700'
          }>
            All Departments
          </Text>
        </TouchableOpacity>
        {departments.map(dept => (
          <TouchableOpacity
            key={dept}
            onPress={() => setFilters(prev => ({ ...prev, department: dept }))}
            className={`mr-2 px-4 py-2 rounded-full ${
              filters.department === dept
                ? 'bg-blue-500'
                : isDark ? 'bg-gray-700' : 'bg-gray-200'
            }`}
          >
            <Text className={
              filters.department === dept
                ? 'text-white'
                : isDark ? 'text-gray-300' : 'text-gray-700'
            }>
              {dept}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Employee Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-2"
      >
        <TouchableOpacity
          onPress={() => setFilters(prev => ({ ...prev, employeeId: undefined }))}
          className={`mr-2 px-4 py-2 rounded-full ${
            !filters.employeeId
              ? 'bg-blue-500'
              : isDark ? 'bg-gray-700' : 'bg-gray-200'
          }`}
        >
          <Text className={
            !filters.employeeId
              ? 'text-white'
              : isDark ? 'text-gray-300' : 'text-gray-700'
          }>
            All Employees
          </Text>
        </TouchableOpacity>
        {employees.map(emp => (
          <TouchableOpacity
            key={emp.id}
            onPress={() => setFilters(prev => ({ ...prev, employeeId: emp.id }))}
            className={`mr-2 px-4 py-2 rounded-full ${
              filters.employeeId === emp.id
                ? 'bg-blue-500'
                : isDark ? 'bg-gray-700' : 'bg-gray-200'
            }`}
          >
            <Text className={
              filters.employeeId === emp.id
                ? 'text-white'
                : isDark ? 'text-gray-300' : 'text-gray-700'
            }>
              {emp.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderGraph = () => {
    if (!analytics) return null;

    switch (graphType) {
      case 'requests':
        return (
          <BarChart
            data={{
              labels: analytics.leaveTypes.map(lt => lt.leave_type.split(' ')[0]),
              datasets: [{
                data: analytics.leaveTypes.map(lt => lt.request_count)
              }]
            }}
            width={screenWidth}
            height={220}
            yAxisLabel=""
            chartConfig={{
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
              backgroundGradientFrom: isDark ? '#1F2937' : '#FFFFFF',
              backgroundGradientTo: isDark ? '#1F2937' : '#FFFFFF',
              decimalPlaces: 0,
              color: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
              labelColor: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
              style: {
                borderRadius: 16
              },
              propsForDots: {
                r: "6",
                strokeWidth: "2",
                stroke: isDark ? "#374151" : "#E5E7EB"
              }
            }}
            style={{
              marginVertical: 8,
              borderRadius: 16
            }}
          />
        );

      case 'trend':
        return (
          <LineChart
            data={{
              labels: analytics.trend.map(t => format(new Date(t.date), 'dd MMM')),
              datasets: [{
                data: analytics.trend.map(t => t.request_count)
              }]
            }}
            width={screenWidth}
            height={220}
            yAxisLabel=""
            chartConfig={{
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
              backgroundGradientFrom: isDark ? '#1F2937' : '#FFFFFF',
              backgroundGradientTo: isDark ? '#1F2937' : '#FFFFFF',
              decimalPlaces: 0,
              color: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
              labelColor: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
              style: {
                borderRadius: 16
              },
              propsForDots: {
                r: "6",
                strokeWidth: "2",
                stroke: isDark ? "#374151" : "#E5E7EB"
              }
            }}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16
            }}
          />
        );

      case 'balances':
        return (
          <View>
            <BarChart
              data={{
                labels: analytics.balances.leave_types_balances.map(b => b.leave_type.split(' ')[0]),
                datasets: [{
                  data: analytics.balances.leave_types_balances.map(b => b.total_available)
                }]
              }}
              width={screenWidth}
              height={220}
              yAxisLabel=""
              chartConfig={{
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                backgroundGradientFrom: isDark ? '#1F2937' : '#FFFFFF',
                backgroundGradientTo: isDark ? '#1F2937' : '#FFFFFF',
                decimalPlaces: 0,
                color: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
                labelColor: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
                style: {
                  borderRadius: 16
                },
                propsForDots: {
                  r: "6",
                  strokeWidth: "2",
                  stroke: isDark ? "#374151" : "#E5E7EB"
                }
              }}
              style={{
                marginVertical: 8,
                borderRadius: 16
              }}
            />
            <View className="mt-4">
              {analytics.balances.leave_types_balances.map((balance, index) => (
                <View
                  key={index}
                  className={`p-3 rounded-lg mb-2 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                >
                  <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {balance.leave_type}
                  </Text>
                  <View className="flex-row justify-between mt-2">
                    <View>
                      <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Available
                      </Text>
                      <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {balance.total_available}
                      </Text>
                    </View>
                    <View>
                      <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Used
                      </Text>
                      <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {balance.total_used}
                      </Text>
                    </View>
                    <View>
                      <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Pending
                      </Text>
                      <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {balance.total_pending}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        );

      case 'distribution':
        return (
          <PieChart
            data={analytics.leaveTypes.map((lt, index) => ({
              name: lt.leave_type,
              population: lt.request_count,
              color: [
                '#3B82F6',
                '#10B981',
                '#F59E0B',
                '#EF4444',
                '#8B5CF6',
                '#EC4899',
                '#6B7280'
              ][index % 7],
              legendFontColor: isDark ? '#FFFFFF' : '#000000'
            }))}
            width={screenWidth}
            height={220}
            chartConfig={{
              color: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`
            }}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        );

      case 'employees':
        return (
          <View>
            {analytics.employeeStats.map((emp, index) => (
              <View
                key={index}
                className={`p-3 rounded-lg mb-2 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              >
                <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {emp.employee_name}
                </Text>
                <View className="flex-row justify-between mt-2">
                  <View>
                    <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Total Requests
                    </Text>
                    <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {emp.total_requests}
                    </Text>
                  </View>
                  <View>
                    <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Approved
                    </Text>
                    <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {emp.approved_requests}
                    </Text>
                  </View>
                  <View>
                    <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Total Days
                    </Text>
                    <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {emp.total_leave_days}
                    </Text>
                  </View>
                </View>
                <Text className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Leave Types: {emp.leave_types}
                </Text>
              </View>
            ))}
          </View>
        );

      case 'utilization':
        return (
          <View>
            {analytics.leaveTypes.map((lt, index) => (
              <View
                key={index}
                className={`p-3 rounded-lg mb-2 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              >
                <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {lt.leave_type}
                </Text>
                <View className="flex-row justify-between mt-2">
                  <View>
                    <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Default Days
                    </Text>
                    <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {lt.default_days}
                    </Text>
                  </View>
                  <View>
                    <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Total Days Used
                    </Text>
                    <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {lt.total_days}
                    </Text>
                  </View>
                  <View>
                    <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Utilization
                    </Text>
                    <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {((lt.total_days / lt.default_days) * 100).toFixed(1)}%
                    </Text>
                  </View>
                </View>
                <View className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-blue-500"
                    style={{ width: `${Math.min((lt.total_days / lt.default_days) * 100, 100)}%` }}
                  />
                </View>
              </View>
            ))}
          </View>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text className={`text-center mb-4 ${isDark ? 'text-red-400' : 'text-red-500'}`}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={fetchLeaveAnalytics}
          className="bg-blue-500 px-4 py-2 rounded-full"
        >
          <Text className="text-white">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1">
      <View className="p-4">
        {renderFilters()}
        {renderMetricsCards()}
        <GraphSelector
          options={graphOptions}
          selected={graphType}
          onSelect={setGraphType}
          isDark={isDark}
        />
        {renderGraph()}
      </View>

      {/* Date Pickers */}
      {(showStartPicker || showEndPicker) && (
        <DateTimePicker
          value={showStartPicker ? filters.startDate : filters.endDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => 
            handleDateChange(event, date, showStartPicker)
          }
        />
      )}
    </ScrollView>
  );
} 