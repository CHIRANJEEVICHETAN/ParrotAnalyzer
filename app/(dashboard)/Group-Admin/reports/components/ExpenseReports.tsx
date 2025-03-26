import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Dimensions, ActivityIndicator, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, FlatList } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { ReportSection } from '../types';
import ReportCard from './ReportCard';
import GraphSelector from './GraphSelector';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  const graphOptions = [
    { type: 'line', icon: 'trending-up', label: 'Line' },
    { type: 'bar', icon: 'bar-chart', label: 'Bar' },
    { type: 'pie', icon: 'pie-chart', label: 'Pie' },
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

      const url = `${process.env.EXPO_PUBLIC_API_URL}/api/reports/expenses/employee-stats${
        employeeId ? `?employeeId=${employeeId}` : ''
      }`;
      
      console.log('Fetching employee stats from:', url);
      const response = await axios.get(url);
      
      setEmployees(response.data.employees);
      const stats = response.data.expenseStats;
      setEmployeeStats(stats);

      if (stats && Array.isArray(stats)) {
        console.log('Processing stats:', stats);
        
        if (employeeId && employeeId !== 'all') {
          // Group by month and sum amounts
          const monthlyTotals = stats.reduce((acc: { [key: string]: number }, curr) => {
            const month = curr.month || 'Unknown';
            acc[month] = (acc[month] || 0) + parseFloat(curr.total_amount || 0);
            return acc;
          }, {});

          const monthlyData = Object.entries(monthlyTotals).map(([month, amount]) => ({
            month,
            amount
          }));

          // Group expenses by category and calculate totals
          const categoryTotals = stats.reduce((acc: { [key: string]: number }, curr) => {
            const category = curr.category || 'Other';
            acc[category] = (acc[category] || 0) + parseFloat(curr.total_amount || 0);
            return acc;
          }, {});

          // Transform category data to match the required format
          const categoryData = Object.entries(categoryTotals)
            .filter(([_, amount]) => amount > 0)
            .map(([category, amount]) => ({
              name: category,
              population: amount,
              color: getCategoryColor(category),
              legendFontColor: isDark ? '#9CA3AF' : '#4B5563',
              legendFontSize: 12
            }));

          console.log('Processed category data:', categoryData);

          const total = Object.values(monthlyTotals).reduce((acc, curr) => acc + curr, 0);
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
      } else {
        console.log('No stats data available');
        setEmployeeData(null);
      }
    } catch (err) {
      console.error('Error fetching employee stats:', err);
      if (axios.isAxiosError(err)) {
        console.error('Response data:', err.response?.data);
      }
      setEmployeeData(null);
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
  }, []);

  const fetchExpenseData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/reports/expenses/overview`);
      
      console.log('Expense overview response:', response.data);
      
      const monthlyData = response.data.monthlyData || [];
      const categoryData = response.data.categoryData || [];
      
      const processedCategoryData = categoryData.map((item: CategoryDataItem) => ({
        name: item.name,
        population: item.population,
        color: getCategoryColor(item.name),
        legendFontColor: isDark ? '#9CA3AF' : '#4B5563',
        legendFontSize: 12
      }));

      setOverallData({
        monthlyData,
        categoryData: processedCategoryData,
        summary: {
          total_amount: response.data.summary.total_amount,
          average_expense: response.data.summary.average_expense
        }
      });
    } catch (err) {
      setError('Failed to fetch expense data');
      console.error('Error fetching expense data:', err);
    } finally {
      setLoading(false);
    }
  };

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
        // Ensure data is properly formatted for LineChart
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
        // Calculate total for percentage
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

        {/* Overall Metrics */}
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
      <ReportCard section={section} isDark={isDark}>
        <View className="mt-4">
          {/* Overall Analytics Section */}
          {renderOverallGraphs()}

          {/* Employee Selector and Stats Section */}
          <View className="mt-8 pt-4 border-t border-gray-200">
            {renderEmployeeSelector()}
            {renderEmployeeStatsGraph()}
          </View>
        </View>
      </ReportCard>
    </View>
  );
} 