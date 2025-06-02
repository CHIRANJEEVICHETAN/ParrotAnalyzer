import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Dimensions, ActivityIndicator, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, FlatList } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { ReportSection } from '../types';
import ReportCard from './ReportCard';
import GraphSelector from './GraphSelector';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Employee {
  id: number;
  name: string;
  employee_number: string;
  department: string;
}

interface EmployeeStats {
  employee_id: number;
  employee_name: string;
  employee_number: string;
  month: string;
  expense_count: number;
  total_amount: number;
  approved_count: number;
  rejected_count: number;
}

interface ExpenseData {
  monthlyData: Array<{
    month: string;
    amount: number;
  }>;
  categoryData: any[];
  summary: {
    total_amount: number;
    average_expense: number;
  };
}

interface OverallExpenseData {
  monthlyData: Array<{
    month: string;
    amount: number;
  }>;
  categoryData: Array<{
    name: string;
    population: number;
    color: string;
    legendFontColor: string;
    legendFontSize: number;
  }>;
  summary: {
    total_amount: number;
    average_expense: number;
  };
}

interface CategoryDataItem {
  name: string;
  population: number;
}

interface MonthlyDataItem {
  month: string;
  amount: number;
}

interface FilterParams {
  startDate: Date;
  endDate: Date;
  employeeId?: number;
  department?: string;
  dateRangePreset: string;
}

interface ExpenseStat {
  month: string;
  category: string;
  total_amount: string;
}

export default function ExpenseReports({ section, isDark }: { section: ReportSection; isDark: boolean }) {
  const [graphType, setGraphType] = useState('line');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | string | null>(null);
  const [overallData, setOverallData] = useState<OverallExpenseData | null>(null);
  const [employeeData, setEmployeeData] = useState<ExpenseData | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);
  const [employeeStatsLoading, setEmployeeStatsLoading] = useState(false);
  const lastFetchRef = useRef<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [filters, setFilters] = useState<FilterParams>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
    dateRangePreset: 'last30Days'
  });
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  const graphOptions = [
    { type: 'line', icon: 'trending-up', label: 'Line' },
    { type: 'bar', icon: 'bar-chart', label: 'Bar' },
    { type: 'pie', icon: 'pie-chart', label: 'Pie' },
  ];

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

  const commonConfig = {
    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
    backgroundGradientFrom: isDark ? '#1F2937' : '#FFFFFF',
    backgroundGradientTo: isDark ? '#1F2937' : '#FFFFFF',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) => isDark ? `rgba(156, 163, 175, ${opacity})` : `rgba(107, 114, 128, ${opacity})`,
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.employee_number.includes(searchQuery)
  );

  const fetchEmployeeStats = async (employeeId?: string) => {
    try {
      if (employeeStatsLoading) return;
      setEmployeeStatsLoading(true);

      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        console.error('No token found');
        return;
      }

      // Format dates for API
      const startDateStr = format(filters.startDate, 'yyyy-MM-dd');
      const endDateStr = format(filters.endDate, 'yyyy-MM-dd');
      
      // Build query params for filters
      let queryParams = `startDate=${startDateStr}&endDate=${endDateStr}`;
      if (employeeId && employeeId !== 'all') queryParams += `&employeeId=${employeeId}`;
      if (filters.department) queryParams += `&department=${encodeURIComponent(filters.department)}`;

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/reports/expenses/employee-stats?${queryParams}`,
        { 
          headers: { 
            'Authorization': `Bearer ${token}`
          } 
        }
      );

      if (response.data) {
        console.log('Processing stats:', response.data);
        setEmployees(response.data.employees);
        setEmployeeStats(response.data.expenseStats);

        if (response.data.expenseStats && Array.isArray(response.data.expenseStats)) {
          const stats = response.data.expenseStats as ExpenseStat[];
          
          if (employeeId && employeeId !== 'all') {
            const monthlyTotals = stats.reduce((acc: { [key: string]: number }, curr: ExpenseStat) => {
              const month = curr.month || 'Unknown';
              acc[month] = (acc[month] || 0) + parseFloat(curr.total_amount || '0');
              return acc;
            }, {});

            const monthlyData = Object.entries(monthlyTotals).map(([month, amount]) => ({
              month,
              amount: Number(amount)
            }));

            const categoryTotals = stats.reduce((acc: { [key: string]: number }, curr: ExpenseStat) => {
              const category = curr.category || 'Other';
              acc[category] = (acc[category] || 0) + parseFloat(curr.total_amount || '0');
              return acc;
            }, {});

            const categoryData = Object.entries(categoryTotals)
              .filter(([_, amount]) => amount > 0)
              .map(([category, amount]) => ({
                name: category,
                population: Number(amount),
                color: getCategoryColor(category),
                legendFontColor: isDark ? '#9CA3AF' : '#4B5563',
                legendFontSize: 12
              }));

            const total = Object.values(monthlyTotals).reduce((acc: number, curr: number) => acc + curr, 0);
            const average = monthlyData.length > 0 ? total / monthlyData.length : 0;

            setEmployeeData({
              monthlyData,
              categoryData,
              summary: {
                total_amount: total,
                average_expense: average
              }
            });
          } else {
            await fetchExpenseData();
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching employee stats:', error);
      setError(error.response?.data?.error || 'Failed to fetch employee stats');
    } finally {
      setEmployeeStatsLoading(false);
    }
  };

  useEffect(() => {
    const initData = async () => {
      await fetchExpenseData();
      await fetchEmployeeStats();
    };
    initData();
  }, [filters.startDate, filters.endDate]);

  const fetchExpenseData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        console.error('No token found');
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
        `${process.env.EXPO_PUBLIC_API_URL}/api/reports/expenses/overview?${queryParams}`,
        { 
          headers: { 
            'Authorization': `Bearer ${token}`
          } 
        }
      );

      if (response.data) {
        console.log('Expense overview response:', response.data);
        
        const processedCategoryData = response.data.categoryData.map((item: CategoryDataItem) => ({
          ...item,
          color: getCategoryColor(item.name),
          legendFontColor: isDark ? '#9CA3AF' : '#4B5563',
          legendFontSize: 12
        }));

        setOverallData({
          monthlyData: response.data.monthlyData,
          categoryData: processedCategoryData,
          summary: response.data.summary
        });
      }
    } catch (error: any) {
      console.error('Error fetching expense data:', error);
      setError(error.response?.data?.error || 'Failed to fetch expense data');
    } finally {
      setLoading(false);
    }
  };

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
        {selectedEmployee !== 'all' ? ' • Filtered by Employee' : ''}
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
                      ? (isDark ? 'bg-blue-900/30' : 'bg-blue-100')
                      : (isDark ? 'bg-gray-700' : 'bg-gray-100')
                    }`}
                >
                  <Text className={isDark ? 'text-white' : 'text-gray-800'}>
                    {option.label}
                  </Text>
                  {filters.dateRangePreset === option.id && (
                    <Ionicons name="checkmark" size={20} color="#3B82F6" />
                  )}
                </TouchableOpacity>
              ))}

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
                className="flex-1 py-3 ml-2 rounded-lg bg-blue-600"
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

  const getCategoryColor = (category: string): string => {
    const colors: { [key: string]: string } = {
      'Lodging': '#3B82F6',      // Blue
      'Daily Allowance': '#10B981', // Green
      'Fuel': '#F59E0B',         // Amber
      'Toll': '#8B5CF6',         // Purple
      'Other': '#6B7280'         // Gray
    };
    return colors[category] || colors['Other'];
  };

  const renderGraph = (data: any) => {
    if (!data || employeeStatsLoading) {
      return (
        <View className="h-[220px] justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {employeeStatsLoading ? 'Updating graph...' : 'Loading data...'}
          </Text>
        </View>
      );
    }

    if (!data.monthlyData || data.monthlyData.length === 0) {
      return (
        <View className="h-[220px] justify-center items-center">
          <Text className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            No expense data available for {
              selectedEmployee === 'all' 
                ? 'any employee' 
                : employees.find(emp => emp.id.toString() === selectedEmployee)?.name || 'selected employee'
            }
          </Text>
        </View>
      );
    }

    const width = Dimensions.get('window').width - 64;

    switch (graphType) {
      case 'line':
        const chartData = {
          labels: data.monthlyData.map((item: MonthlyDataItem) => item.month),
          datasets: [{
            data: data.monthlyData.map((item: MonthlyDataItem) => Number(item.amount) || 0)
          }]
        };

        console.log('Line chart data:', chartData);

        return (
          <LineChart
            data={chartData}
            width={width}
            height={220}
            chartConfig={{
              ...commonConfig,
              formatYLabel: (value) => `₹${parseInt(value).toLocaleString()}`
            }}
            bezier
            style={{
              borderRadius: 16,
              marginVertical: 8,
            }}
          />
        );

      case 'bar':
        console.log('Bar chart data:', data.categoryData);
        if (!data.categoryData?.length) {
          return (
            <View className="h-[220px] justify-center items-center">
              <Text className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                No category data available
              </Text>
            </View>
          );
        }
        return (
          <View>
            <BarChart
              data={{
                labels: data.categoryData.map((item: CategoryDataItem) => item.name),
                datasets: [{
                  data: data.categoryData.map((item: CategoryDataItem) => Number(item.population) || 0)
                }]
              }}
              width={width}
              height={220}
              yAxisLabel="₹"
              yAxisSuffix=""
              chartConfig={{
                ...commonConfig,
                formatYLabel: (value) => `₹${parseInt(value).toLocaleString()}`
              }}
              verticalLabelRotation={30}
              showValuesOnTopOfBars
              style={{
                borderRadius: 16,
                marginVertical: 8,
              }}
            />
            <View className="mt-4">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Total Amount by Expense Category
              </Text>
            </View>
          </View>
        );

      case 'pie':
        console.log('Pie chart data:', data.categoryData);
        if (!data.categoryData?.length) {
          return (
            <View className="h-[220px] justify-center items-center">
              <Text className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                No category data available
              </Text>
            </View>
          );
        }
        const total = data.categoryData.reduce((sum: number, item: CategoryDataItem) => sum + Number(item.population), 0);
        
        const pieChartData = data.categoryData
          .filter((item: CategoryDataItem) => Number(item.population) > 0)
          .map((item: CategoryDataItem) => ({
            name: `${item.name} (${((Number(item.population) / total) * 100).toFixed(0)}%)`,
            population: Number(item.population),
            color: getCategoryColor(item.name),
            legendFontColor: isDark ? '#9CA3AF' : '#4B5563',
            legendFontSize: 10
          }));

        return (
          <View>
            <PieChart
              data={pieChartData}
              width={width}
              height={220}
              chartConfig={commonConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="0"
              absolute
              hasLegend
              center={[width / 50, 0]}
              avoidFalseZero
            />
            <View className="mt-4">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Distribution of Expenses by Category
              </Text>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const renderEmployeeSelector = () => (
    <View className="mb-4">
      <Text className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        Selected Employee
      </Text>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        className={`flex-row items-center justify-between p-3 rounded-lg ${
          isDark ? 'bg-gray-700' : 'bg-gray-100'
        }`}
      >
        <View className="flex-row items-center">
          <Ionicons 
            name={selectedEmployee === 'all' ? 'people' : 'person'} 
            size={20} 
            color="#4B5563"
            style={{ marginRight: 8 }}
          />
          <Text className={isDark ? 'text-gray-300' : 'text-gray-700'}>
            {selectedEmployee === 'all' 
              ? 'All Employees' 
              : employees.find(emp => emp.id.toString() === selectedEmployee)?.name || 'Select Employee'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={20} color="#4B5563" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/50">
          <View className={`flex-1 mt-24 rounded-t-3xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <View className="p-4 border-b border-gray-200">
              <View className="flex-row items-center justify-between mb-4">
                <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Select Employee
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={isDark ? '#FFF' : '#000'} />
                </TouchableOpacity>
              </View>
              <TextInput
                placeholder="Search by name or employee ID"
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
                { id: 'all', name: 'All Employees', employee_number: '' },
                ...filteredEmployees
              ]}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    const employeeId = item.id === 'all' ? 'all' : item.id.toString();
                    setSelectedEmployee(employeeId);
                    fetchEmployeeStats(employeeId === 'all' ? undefined : employeeId);
                    setModalVisible(false);
                    setSearchQuery('');
                  }}
                  className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} ${
                    selectedEmployee === item.id.toString() ? 
                      (isDark ? 'bg-blue-900/20' : 'bg-blue-50') : ''
                  }`}
                >
                  <View className="flex-row items-center">
                    <Ionicons 
                      name={item.id === 'all' ? 'people' : 'person'} 
                      size={20} 
                      color={isDark ? '#FFF' : '#4B5563'}
                      style={{ marginRight: 8 }}
                    />
                    <View>
                      <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {item.name}
                      </Text>
                      {item.id !== 'all' && (
                        <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          ID: {item.employee_number}
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );

  const renderEmployeeStatsGraph = () => {
    if (employeeStatsLoading) {
      return (
        <View className="h-[220px] justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      );
    }

    if (!employeeStats.length) return null;

    const width = Dimensions.get('window').width - 64;
    const data = {
      labels: [...new Set(employeeStats.map(stat => stat.month))],
      datasets: [{
        data: employeeStats.map(stat => stat.total_amount)
      }]
    };

    return (
      <View className="mt-4">
        <Text className={`text-base font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Employee Expense Trends
        </Text>
        <LineChart
          data={data}
          width={width}
          height={220}
          chartConfig={{
            ...commonConfig,
            color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`
          }}
          bezier
          style={{
            borderRadius: 16,
            marginVertical: 8,
          }}
        />
        <View className="flex-row justify-between mt-2">
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Total Claims: {employeeStats.reduce((acc, curr) => acc + Number(curr.expense_count), 0)}
          </Text>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Approval Rate: {
              Math.round(
                (employeeStats.reduce((acc, curr) => acc + Number(curr.approved_count), 0) /
                employeeStats.reduce((acc, curr) => acc + Number(curr.expense_count), 0)) * 100
              )}%
          </Text>
        </View>
      </View>
    );
  };

  const renderOverallGraphs = () => {
    if (!overallData) return null;

    return (
      <>
        <View className="mb-4">
          <Text className={`text-base font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {graphType === 'line' ? 'Overall Monthly Expense Trend' :
             graphType === 'bar' ? 'Overall Expense Categories' :
             'Overall Expense Distribution'}
          </Text>
          <GraphSelector
            options={graphOptions}
            selectedType={graphType}
            onSelect={setGraphType}
            isDark={isDark}
          />
        </View>

        {renderGraph(overallData)}

        <View className="flex-row justify-between mt-4">
          <View>
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Total Expenses
            </Text>
            <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              ₹{overallData.summary.total_amount.toLocaleString() || 0}
            </Text>
          </View>
          <View>
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Average Monthly
            </Text>
            <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              ₹{overallData.summary.average_expense.toLocaleString() || 0}
            </Text>
          </View>
        </View>
      </>
    );
  };

  useEffect(() => {
    let mounted = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const token = await AsyncStorage.getItem('auth_token');

        const response = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/pdf-reports/expense`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.status || response.status >= 400) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = response.data;
        
        if (mounted) {
          setOverallData(data.overall);
          setEmployeeData(data.employee);
          setEmployees(data.employees || []);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: 'red' }}>
          Error: {error instanceof Error ? error.message : error}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ padding: 16 }}>
        <ActivityIndicator size="large" color="#3B82F6" />
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
          
          {renderOverallGraphs()}

          <View className="mt-8 pt-4 border-t border-gray-200">
            {renderEmployeeSelector()}
            {renderEmployeeStatsGraph()}
          </View>
        </View>
      </ReportCard>
      
      {renderFiltersModal()}
    </View>
  );
} 