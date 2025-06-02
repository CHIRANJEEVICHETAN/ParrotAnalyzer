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
}

interface FilterParams {
  startDate: Date;
  endDate: Date;
  employeeId?: number;
  department?: string;
  dateRangePreset: string;
}

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
    { type: 'line', icon: 'trending-up', label: 'Trend' },
    { type: 'heatmap', icon: 'calendar', label: 'Calendar' },
  ];
  
  // Date range presets
  const dateRangeOptions = [
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
            <View className="flex-row justify-between mt-4">
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
      <ReportCard 
        section={section} 
        isDark={isDark}
        filters={filters}
      >
        <View className="mt-4">
          {renderFiltersButton()}

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
            
            {/* Second row of metrics */}
            <View className="w-[48%] mt-4">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Active Shifts
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {Number(analytics?.metrics?.active_shifts || 0)}
              </Text>
            </View>
            <View className="w-[48%] mt-4">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Completed Shifts
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {Number(analytics?.metrics?.completed_shifts || 0)}
              </Text>
            </View>
          </View>
        </View>
      </ReportCard>

      {renderFiltersModal()}
      {renderEmployeeModal()}
      {renderDepartmentModal()}
    </View>
  );
} 