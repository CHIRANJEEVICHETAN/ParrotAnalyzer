import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions, ActivityIndicator, TouchableOpacity, Modal, FlatList, TextInput, ScrollView } from 'react-native';
import { BarChart, LineChart, ContributionGraph } from 'react-native-chart-kit';
import { ReportSection } from '../types';
import ReportCard from './ReportCard';
import GraphSelector from './GraphSelector';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

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
  monthly: Array<{
    month_name: string;
    month_date: string;
    present_count: number;
    working_days: number;
    avg_hours: number;
  }>;
  yearly: Array<{
    year: number;
    total_employees: number;
    working_days: number;
    avg_hours: number;
    total_distance: number;
    total_expenses: number;
  }>;
  metrics: {
    total_employees: number;
    avg_hours: number;
    on_time_rate: number;
    total_distance: number;
    total_expenses: number;
    active_shifts: number;
    completed_shifts: number;
  };
  employees?: Array<{
    id: number;
    name: string;
    employee_number: string;
    department: string;
  }>;
  departments?: string[];
  leave?: Array<{
    employeeId: number;
    employeeName: string;
    employeeNumber: string;
    department: string;
    startDate: string;
    endDate: string;
    daysCount: number;
    leaveType: string;
    isPaid: boolean;
  }>;
}

interface FilterParams {
  startDate: Date;
  endDate: Date;
  employeeId?: number;
  department?: string;
  dateRangePreset: string;
}

// MetricCard component for displaying metrics
const MetricCard = ({ title, value, icon, color, isDark }: { 
  title: string; 
  value: string; 
  icon: any; // Using any for icon name to avoid type issues
  color: string; 
  isDark: boolean;
}) => {
  return (
    <View className={`w-[48%] p-3 mb-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
      <View className="flex-row items-center mb-2">
        <View style={{ backgroundColor: `${color}20`, padding: 4, borderRadius: 8 }}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Text className={`ml-2 text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          {title}
        </Text>
      </View>
      <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {value}
      </Text>
    </View>
  );
};

export default function AttendanceReports({ section, isDark }: { section: ReportSection; isDark: boolean }) {
  const [graphType, setGraphType] = useState('bar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AttendanceAnalytics | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<FilterParams>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
    dateRangePreset: 'last30Days'
  });
  
  // Filter UI state
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const graphOptions = [
    { type: 'bar', icon: 'bar-chart', label: 'Daily' },
    { type: 'line', icon: 'trending-up', label: 'Weekly' },
    { type: 'monthly', icon: 'calendar-outline', label: 'Monthly' },
    { type: 'yearly', icon: 'stats-chart', label: 'Yearly' },
  ];
  
  // Date range presets
  const dateRangeOptions = [
    { id: 'daily', label: 'Daily', 
      getValue: () => ({ startDate: new Date(), endDate: new Date() })},
    { id: 'weekly', label: 'Weekly',
      getValue: () => ({ startDate: subDays(new Date(), 6), endDate: new Date() })},
    { id: 'monthly', label: 'Monthly',
      getValue: () => ({ startDate: startOfMonth(new Date()), endDate: new Date() })},
    { id: 'yearly', label: 'Yearly',
      getValue: () => {
        const startOfYear = new Date(new Date().getFullYear(), 0, 1);
        return { startDate: startOfYear, endDate: new Date() };
      }},
    { id: 'last7Days', label: 'Last 7 Days', 
      getValue: () => ({ startDate: subDays(new Date(), 7), endDate: new Date() })},
    { id: 'last30Days', label: 'Last 30 Days',
      getValue: () => ({ startDate: subDays(new Date(), 30), endDate: new Date() })},
    { id: 'thisMonth', label: 'This Month',
      getValue: () => ({ startDate: startOfMonth(new Date()), endDate: new Date() })},
    { id: 'lastMonth', label: 'Last Month',
      getValue: () => {
        const lastMonth = subMonths(new Date(), 1);
        return { 
          startDate: startOfMonth(lastMonth), 
          endDate: endOfMonth(lastMonth)
        };
      }},
    { id: 'custom', label: 'Custom Range', getValue: () => filters },
  ];

  useEffect(() => {
    fetchAttendanceAnalytics();
  }, [filters.startDate, filters.endDate, filters.employeeId, filters.department]);

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

      // Format dates for API
      const startDateStr = format(filters.startDate, 'yyyy-MM-dd');
      const endDateStr = format(filters.endDate, 'yyyy-MM-dd');
      
      // Build query params for filters
      let queryParams = `startDate=${startDateStr}&endDate=${endDateStr}`;
      if (filters.employeeId) queryParams += `&employeeId=${filters.employeeId}`;
      if (filters.department) queryParams += `&department=${encodeURIComponent(filters.department)}`;

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/reports/attendance-analytics?${queryParams}`,
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
            total_expenses: Math.max(0, Number(data?.total_expenses || 0)),
            active_shifts: Math.max(0, Number(data?.active_shifts || 0)),
            completed_shifts: Math.max(0, Number(data?.completed_shifts || 0))
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

  // Handle date range preset selection
  const handleDateRangeChange = (presetId: string) => {
    const preset = dateRangeOptions.find(option => option.id === presetId);
    if (preset) {
      const { startDate, endDate } = preset.getValue();
      setFilters(prev => ({
        ...prev,
        startDate,
        endDate,
        dateRangePreset: presetId
      }));
    }
  };

  // Handle date picker changes
  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setFilters(prev => ({
        ...prev,
        [datePickerMode === 'start' ? 'startDate' : 'endDate']: selectedDate,
        dateRangePreset: 'custom'
      }));
    }
    setShowDateRangePicker(false);
  };

  // Handle employee selection
  const handleEmployeeSelect = (employeeId?: number) => {
    setFilters(prev => ({
      ...prev,
      employeeId
    }));
    setShowEmployeeModal(false);
  };

  // Handle department selection
  const handleDepartmentSelect = (department?: string) => {
    setFilters(prev => ({
      ...prev,
      department
    }));
    setShowDepartmentModal(false);
  };

  // Reset all filters
  const resetFilters = () => {
    const defaultRange = dateRangeOptions.find(option => option.id === 'last30Days');
    if (defaultRange) {
      const { startDate, endDate } = defaultRange.getValue();
      setFilters({
        startDate,
        endDate,
        dateRangePreset: 'last30Days'
      });
    }
    setShowFiltersModal(false);
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

      case 'monthly':
        if (!analytics.monthly || analytics.monthly.length === 0) {
          return (
            <View className="items-center justify-center h-56">
              <Text className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                No monthly data available
              </Text>
            </View>
          );
        }
        
        const monthlyData = {
          labels: analytics.monthly.map(m => m.month_name),
          datasets: [{
            data: analytics.monthly.map(m => Number(m.present_count || 0))
          }]
        };
        
        return (
          <BarChart
            data={monthlyData}
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
        
      case 'yearly':
        if (!analytics.yearly || analytics.yearly.length === 0) {
          return (
            <View className="items-center justify-center h-56">
              <Text className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                No yearly data available
              </Text>
            </View>
          );
        }
        
        const yearlyData = {
          labels: analytics.yearly.map(y => y.year.toString()),
          datasets: [{
            data: analytics.yearly.map(y => Number(y.total_employees || 0))
          }]
        };
        
        return (
          <BarChart
            data={yearlyData}
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

      default:
        return null;
    }
  };

  const renderFiltersButton = () => (
    <TouchableOpacity 
      onPress={() => setShowFiltersModal(true)}
      className={`flex-row items-center justify-center px-3 py-2 rounded-lg mb-4 ${
        isDark ? 'bg-gray-700' : 'bg-gray-200'
      }`}
    >
      <Ionicons name="options-outline" size={18} color={isDark ? '#E5E7EB' : '#4B5563'} />
      <Text className={`ml-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
        {format(filters.startDate, 'MMM dd, yyyy')} - {format(filters.endDate, 'MMM dd, yyyy')}
        {filters.employeeId || filters.department ? ' • Filtered' : ''}
      </Text>
    </TouchableOpacity>
  );

  const renderFiltersModal = () => (
    <Modal
      visible={showFiltersModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFiltersModal(false)}
    >
      <View className="flex-1 bg-black/50">
        <View className={`flex-1 mt-24 rounded-t-3xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <View className="p-4 border-b border-gray-200">
            <View className="flex-row items-center justify-between mb-4">
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Filter Analytics
              </Text>
              <TouchableOpacity onPress={() => setShowFiltersModal(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#FFF' : '#000'} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView className="p-4">
            {/* Date Range Section */}
            <View className="mb-6">
              <Text className={`text-base font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Date Range
              </Text>
              {dateRangeOptions.map(option => (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => handleDateRangeChange(option.id)}
                  className={`flex-row items-center justify-between py-3 px-4 mb-2 rounded-lg
                    ${filters.dateRangePreset === option.id
                      ? (isDark ? 'bg-indigo-900/30' : 'bg-indigo-100')
                      : (isDark ? 'bg-gray-700' : 'bg-gray-100')
                    }`}
                >
                  <Text className={isDark ? 'text-white' : 'text-gray-800'}>
                    {option.label}
                  </Text>
                  {filters.dateRangePreset === option.id && (
                    <Ionicons name="checkmark" size={20} color="#8B5CF6" />
                  )}
                </TouchableOpacity>
              ))}

              {/* Custom Date Range */}
              {filters.dateRangePreset === 'custom' && (
                <View className={`mt-2 p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <View className="flex-row justify-between mb-2">
                    <TouchableOpacity
                      onPress={() => {
                        setDatePickerMode('start');
                        setShowDateRangePicker(true);
                      }}
                      className="flex-1 mr-2"
                    >
                      <Text className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Start Date
                      </Text>
                      <View className={`mt-1 p-2 rounded-lg ${isDark ? 'bg-gray-600' : 'bg-white'}`}>
                        <Text className={isDark ? 'text-white' : 'text-gray-800'}>
                          {format(filters.startDate, 'MMM dd, yyyy')}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setDatePickerMode('end');
                        setShowDateRangePicker(true);
                      }}
                      className="flex-1 ml-2"
                    >
                      <Text className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        End Date
                      </Text>
                      <View className={`mt-1 p-2 rounded-lg ${isDark ? 'bg-gray-600' : 'bg-white'}`}>
                        <Text className={isDark ? 'text-white' : 'text-gray-800'}>
                          {format(filters.endDate, 'MMM dd, yyyy')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Employee Filter */}
            <View className="mb-6">
              <Text className={`text-base font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Employee
              </Text>
              <TouchableOpacity
                onPress={() => setShowEmployeeModal(true)}
                className={`flex-row items-center justify-between py-3 px-4 rounded-lg
                  ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
              >
                <Text className={isDark ? 'text-white' : 'text-gray-800'}>
                  {filters.employeeId 
                    ? analytics?.employees?.find(e => e.id === filters.employeeId)?.name || 'Selected Employee' 
                    : 'All Employees'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={isDark ? '#FFF' : '#000'} />
              </TouchableOpacity>
            </View>

            {/* Department Filter */}
            <View className="mb-6">
              <Text className={`text-base font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Department
              </Text>
              <TouchableOpacity
                onPress={() => setShowDepartmentModal(true)}
                className={`flex-row items-center justify-between py-3 px-4 rounded-lg
                  ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
              >
                <Text className={isDark ? 'text-white' : 'text-gray-800'}>
                  {filters.department || 'All Departments'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={isDark ? '#FFF' : '#000'} />
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View className="flex-row justify-between mt-4 mb-10">
              <TouchableOpacity
                onPress={resetFilters}
                className={`flex-1 py-3 mr-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
              >
                <Text className={`text-center font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>
                  Reset
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowFiltersModal(false)}
                className="flex-1 py-3 ml-2 rounded-lg bg-purple-600"
              >
                <Text className="text-center font-medium text-white">
                  Apply
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>

      {showDateRangePicker && (
        <DateTimePicker
          value={datePickerMode === 'start' ? filters.startDate : filters.endDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}
    </Modal>
  );

  const renderEmployeeModal = () => (
    <Modal
      visible={showEmployeeModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowEmployeeModal(false)}
    >
      <View className="flex-1 bg-black/50">
        <View className={`flex-1 mt-24 rounded-t-3xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <View className="p-4 border-b border-gray-200">
            <View className="flex-row items-center justify-between mb-4">
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Select Employee
              </Text>
              <TouchableOpacity onPress={() => setShowEmployeeModal(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#FFF' : '#000'} />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Search employees..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              className={`p-2 rounded-lg mb-2 ${
                isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
              }`}
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </View>

          <FlatList
            data={[
              { id: 0, name: 'All Employees', employee_number: '', department: '' },
              ...(analytics?.employees || []).filter(emp => 
                emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                emp.employee_number.includes(searchQuery)
              )
            ]}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleEmployeeSelect(item.id === 0 ? undefined : item.id)}
                className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} ${
                  (item.id === 0 && !filters.employeeId) || item.id === filters.employeeId
                    ? (isDark ? 'bg-indigo-900/30' : 'bg-indigo-100')
                    : ''
                }`}
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name={item.id === 0 ? 'people' : 'person'}
                    size={20}
                    color={isDark ? '#FFF' : '#4B5563'}
                    style={{ marginRight: 8 }}
                  />
                  <View>
                    <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {item.name}
                    </Text>
                    {item.id !== 0 && (
                      <>
                        <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          ID: {item.employee_number}
                        </Text>
                        {item.department && (
                          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Dept: {item.department}
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  const renderDepartmentModal = () => (
    <Modal
      visible={showDepartmentModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowDepartmentModal(false)}
    >
      <View className="flex-1 bg-black/50">
        <View className={`flex-1 mt-24 rounded-t-3xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <View className="p-4 border-b border-gray-200">
            <View className="flex-row items-center justify-between mb-4">
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Select Department
              </Text>
              <TouchableOpacity onPress={() => setShowDepartmentModal(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#FFF' : '#000'} />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Search departments..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              className={`p-2 rounded-lg mb-2 ${
                isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
              }`}
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </View>

          <FlatList
            data={[
              { id: 'all', name: 'All Departments' },
              ...(analytics?.departments || [])
                .filter(dept => dept.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(dept => ({ id: dept, name: dept }))
            ]}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleDepartmentSelect(item.id === 'all' ? undefined : item.id)}
                className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} ${
                  (item.id === 'all' && !filters.department) || item.id === filters.department
                    ? (isDark ? 'bg-indigo-900/30' : 'bg-indigo-100')
                    : ''
                }`}
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name={item.id === 'all' ? 'grid' : 'folder'}
                    size={20}
                    color={isDark ? '#FFF' : '#4B5563'}
                    style={{ marginRight: 8 }}
                  />
                  <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {item.name}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  // Function to render leave information
  const renderLeaveInfo = () => {
    if (!analytics?.leave || analytics.leave.length === 0) {
      return null;
    }

    return (
      <View className="mb-6">
        <Text className={`text-base font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Leave Information
        </Text>
        <View className={`rounded-lg overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View className={`flex-row py-2 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <Text className={`w-32 px-3 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Employee</Text>
                <Text className={`w-28 px-3 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Leave Type</Text>
                <Text className={`w-24 px-3 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Start Date</Text>
                <Text className={`w-24 px-3 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>End Date</Text>
                <Text className={`w-16 px-3 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Days</Text>
                <Text className={`w-20 px-3 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Status</Text>
              </View>
              
              {analytics.leave.map((leave, index) => (
                <View 
                  key={`${leave.employeeId}-${index}`}
                  className={`flex-row py-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
                >
                  <Text className={`w-32 px-3 ${isDark ? 'text-white' : 'text-gray-800'}`} numberOfLines={1}>
                    {leave.employeeName}
                  </Text>
                  <Text className={`w-28 px-3 ${isDark ? 'text-white' : 'text-gray-800'}`} numberOfLines={1}>
                    {leave.leaveType}
                  </Text>
                  <Text className={`w-24 px-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    {new Date(leave.startDate).toLocaleDateString()}
                  </Text>
                  <Text className={`w-24 px-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    {new Date(leave.endDate).toLocaleDateString()}
                  </Text>
                  <Text className={`w-16 px-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    {leave.daysCount}
                  </Text>
                  <Text className={`w-20 px-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    {leave.isPaid ? 'Paid' : 'Unpaid'}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    );
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
    <View className="flex-1">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text className={`mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Loading attendance data...
          </Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-4">
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text className={`mt-2 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            {error}
          </Text>
          <TouchableOpacity 
            onPress={fetchAttendanceAnalytics} 
            className="mt-4 py-2 px-4 bg-purple-600 rounded-lg"
          >
            <Text className="text-white font-medium">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView className="flex-1 p-4">
          <ReportCard 
            section={section} 
            isDark={isDark}
            filters={filters}
          >
            <View className="mt-4">
              {renderFiltersButton()}
              
              <GraphSelector 
                options={graphOptions} 
                selectedType={graphType} 
                onSelect={setGraphType} 
                isDark={isDark} 
              />
              
              <View className="mb-6">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className={`text-base font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {graphType === 'bar' ? 'Daily Attendance Rate' :
                     graphType === 'line' ? 'Weekly Attendance Trend' :
                     graphType === 'monthly' ? 'Monthly Attendance' :
                     graphType === 'yearly' ? 'Yearly Attendance' :
                     'Attendance Heatmap'}
                  </Text>
                </View>
                {renderGraph()}
              </View>
              
              <View className="mb-6">
                <Text className={`text-base font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Attendance Metrics
                </Text>
                <View className="flex-row flex-wrap justify-between">
                  <MetricCard 
                    title="Total Employees"
                    value={analytics?.metrics?.total_employees?.toString() || '0'}
                    icon="people"
                    color="#3B82F6"
                    isDark={isDark}
                  />
                  <MetricCard 
                    title="Avg. Working Hours"
                    value={`${analytics?.metrics?.avg_hours?.toFixed(1) || '0'} h`}
                    icon="time"
                    color="#10B981"
                    isDark={isDark}
                  />
                  <MetricCard 
                    title="On-Time Rate"
                    value={`${analytics?.metrics?.on_time_rate?.toFixed(1) || '0'}%`}
                    icon="checkmark-circle"
                    color="#F59E0B"
                    isDark={isDark}
                  />
                  <MetricCard 
                    title="Total Distance"
                    value={`${analytics?.metrics?.total_distance?.toFixed(1) || '0'} km`}
                    icon="map"
                    color="#8B5CF6"
                    isDark={isDark}
                  />
                  <MetricCard 
                    title="Total Expenses"
                    value={`₹${Number(analytics?.metrics?.total_expenses || 0).toLocaleString()}`}
                    icon="cash"
                    color="#EC4899"
                    isDark={isDark}
                  />
                  <MetricCard 
                    title="Completed Shifts"
                    value={analytics?.metrics?.completed_shifts?.toString() || '0'}
                    icon="checkmark-done-circle"
                    color="#6366F1"
                    isDark={isDark}
                  />
                </View>
              </View>
              
              {renderLeaveInfo()}
            </View>
          </ReportCard>
          
          {showDateRangePicker && (
            <DateTimePicker
              value={datePickerMode === 'start' ? filters.startDate : filters.endDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          )}
        </ScrollView>
      )}
      
      {renderFiltersModal()}
      {renderEmployeeModal()}
      {renderDepartmentModal()}
    </View>
  );
} 