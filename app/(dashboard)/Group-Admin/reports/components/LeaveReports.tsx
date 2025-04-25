import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { ReportSection } from '../types';
import ReportCard from './ReportCard';
import GraphSelector from './GraphSelector';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

interface LeaveAnalytics {
  leaveTypes: Array<{
    leave_type: string;
    request_count: number;
    approved_count: number;
    rejected_count: number;
    pending_count: number;
    total_days: number;
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
}

// Helper to get color for leave types
const getLeaveTypeColor = (leaveType: string): string => {
  const type = leaveType.toLowerCase();
  if (type.includes('casual') || type.includes('cl')) return '#3B82F6'; // Blue
  if (type.includes('sick') || type.includes('sl')) return '#EF4444'; // Red
  if (type.includes('annual') || type.includes('privilege') || type.includes('pl') || type.includes('el')) return '#10B981'; // Green
  if (type.includes('maternity') || type.includes('paternity') || type.includes('adoption')) return '#EC4899'; // Pink
  if (type.includes('marriage')) return '#8B5CF6'; // Purple
  if (type.includes('bereavement')) return '#6B7280'; // Gray
  if (type.includes('public') || type.includes('holiday')) return '#F59E0B'; // Amber
  if (type.includes('compensatory') || type.includes('comp')) return '#14B8A6'; // Teal
  if (type.includes('special') || type.includes('scl')) return '#6366F1'; // Indigo
  if (type.includes('sabbatical')) return '#7C3AED'; // Violet
  if (type.includes('without') || type.includes('lwp')) return '#9CA3AF'; // Gray
  if (type.includes('birthday')) return '#F97316'; // Orange
  
  // Default or unknown types
  return '#6B7280'; // Gray
};

export default function LeaveReports({ section, isDark }: { section: ReportSection; isDark: boolean }) {
  const [graphType, setGraphType] = useState('requests');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<LeaveAnalytics | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const graphOptions = [
    { type: 'requests', icon: 'document-text', label: 'Requests' },
    { type: 'trend', icon: 'trending-up', label: 'Trend' },
    { type: 'balances', icon: 'calendar', label: 'Balances' },
    { type: 'distribution', icon: 'pie-chart', label: 'Distribution' }
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

      console.log('Fetching leave analytics...');
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/reports/leave-analytics`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      console.log('Leave analytics response status:', response.status);
      
      if (response.data) {
        // Debug the response structure
        console.log('Leave analytics data structure:', JSON.stringify({
          hasLeaveTypes: !!response.data.leaveTypes,
          hasEmployeeStats: !!response.data.employeeStats,
          hasBalances: !!response.data.balances,
          hasTrend: !!response.data.trend,
          hasMetrics: !!response.data.metrics
        }));
        
        // Set default values for any missing properties
        const processedData: LeaveAnalytics = {
          leaveTypes: response.data.leaveTypes || [],
          employeeStats: response.data.employeeStats || [],
          balances: response.data.balances || {
            casual_leave: 0,
            sick_leave: 0,
            annual_leave: 0,
            total_available: 0,
            total_used: 0,
            total_pending: 0,
            employee_count: 0
          },
          trend: response.data.trend || [],
          metrics: response.data.metrics || {
            total_employees_on_leave: 0,
            total_requests: 0,
            approved_requests: 0,
            pending_requests: 0,
            approval_rate: 0,
            total_leave_days: 0
          }
        };
        
        setAnalytics(processedData);
      }
    } catch (error: any) {
      console.error('Error fetching leave analytics:', error);
      // Log more detailed error information
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
        setError(`Server error: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`);
      } else if (error.request) {
        console.error('Error request:', error.request);
        setError('No response received from server');
      } else {
        console.error('Error message:', error.message);
        setError(`Failed to fetch leave data: ${error.message}`);
      }
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
        // Check if we have leave types data
        if (!analytics.leaveTypes || analytics.leaveTypes.length === 0) {
          return (
            <View className="h-[220px] justify-center items-center">
              <Text className={isDark ? "text-gray-300" : "text-gray-600"}>
                No leave type data available
              </Text>
            </View>
          );
        }
        
        // Sort leave types by count
        const sortedLeaveTypes = [...analytics.leaveTypes]
          .sort((a, b) => b.request_count - a.request_count)
          .slice(0, 6); // Show top 6 for better visualization
        
        const requestData = {
          labels: sortedLeaveTypes.map(lt => {
            // Shorten long leave type names
            const name = lt.leave_type || 'Unknown';
            return name.length > 8 ? name.substring(0, 8) + '...' : name;
          }),
          datasets: [{
            data: sortedLeaveTypes.map(lt => lt.request_count || 0),
            colors: sortedLeaveTypes.map(lt => 
              (opacity = 1) => getLeaveTypeColor(lt.leave_type)
            )
          }]
        };

        return (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View>
                <BarChart
                  data={requestData}
                  width={Math.max(width, sortedLeaveTypes.length * 70)} // Make sure the chart is wide enough for all bars
                  height={220}
                  chartConfig={{
                    ...commonConfig,
                    barPercentage: 0.6,
                    useShadowColorFromDataset: false,
                    color: (opacity = 1, index) => {
                      // Use index to get the color from the dataset
                      if (index !== undefined && requestData.datasets[0].colors?.[index]) {
                        return requestData.datasets[0].colors[index](opacity);
                      }
                      return `rgba(59, 130, 246, ${opacity})`;
                    },
                    // Add settings for labels
                    propsForLabels: {
                      fontSize: 10,
                    }
                  }}
                  style={{
                    borderRadius: 16,
                    marginVertical: 8,
                  }}
                  fromZero={true}
                  showValuesOnTopOfBars
                  yAxisLabel=""
                  yAxisSuffix=""
                  verticalLabelRotation={45} // Rotate the labels by 45 degrees
                />
              </View>
            </ScrollView>
            
            {/* Leave categories legend */}
            <View className="flex-row flex-wrap justify-center mt-2">
              {sortedLeaveTypes.map((lt, index) => (
                <View key={index} className="flex-row items-center mr-3 mb-2">
                  <View 
                    style={{ 
                      width: 8, 
                      height: 8, 
                      backgroundColor: getLeaveTypeColor(lt.leave_type),
                      borderRadius: 4, 
                      marginRight: 4 
                    }} 
                  />
                  <Text className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {lt.leave_type}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );

      case 'trend':
        // Check if we have trend data
        if (!analytics.trend || analytics.trend.length === 0) {
          return (
            <View className="h-[220px] justify-center items-center">
              <Text className={isDark ? "text-gray-300" : "text-gray-600"}>
                No trend data available
              </Text>
            </View>
          );
        }
        
        const trendData = {
          labels: analytics.trend.map(t => {
            try {
              return format(new Date(t.date), 'dd/MM');
            } catch (e) {
              return 'N/A';
            }
          }).slice(0, 7),
          datasets: [{
            data: analytics.trend.map(t => t.request_count || 0).slice(0, 7),
            color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
            strokeWidth: 2
          },
          {
            data: analytics.trend.map(t => t.approved_count || 0).slice(0, 7),
            color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
            strokeWidth: 2
          }]
        };

        return (
          <View>
            <LineChart
              data={trendData}
              width={width}
              height={220}
              chartConfig={{
                ...commonConfig,
                strokeWidth: 2,
                propsForDots: {
                  r: "4",
                  strokeWidth: "2",
                }
              }}
              style={{
                borderRadius: 16,
                marginVertical: 8,
              }}
              bezier
            />
            <View className="flex-row justify-center items-center mt-2">
              <View className="flex-row items-center mr-4">
                <View style={{ width: 10, height: 10, backgroundColor: 'rgba(59, 130, 246, 1)', borderRadius: 5, marginRight: 5 }} />
                <Text className={isDark ? "text-gray-300" : "text-gray-600"}>Requests</Text>
              </View>
              <View className="flex-row items-center">
                <View style={{ width: 10, height: 10, backgroundColor: 'rgba(16, 185, 129, 1)', borderRadius: 5, marginRight: 5 }} />
                <Text className={isDark ? "text-gray-300" : "text-gray-600"}>Approved</Text>
              </View>
            </View>
          </View>
        );

      case 'balances':
        // Ensure we have balances data
        if (!analytics.balances) {
          return (
            <View className="h-[220px] justify-center items-center">
              <Text className={isDark ? "text-gray-300" : "text-gray-600"}>
                No leave balance data available
              </Text>
            </View>
          );
        }
        
        // Categorize leave types
        const leaveTypesByCategory: {
          [key: string]: typeof analytics.leaveTypes
        } = {
          'Common': [],
          'Special': [],
          'Other': []
        };
        
        // Categorize leave types
        analytics.leaveTypes.forEach(lt => {
          const type = lt.leave_type.toLowerCase();
          if (type.includes('casual') || type.includes('sick') || type.includes('annual') || 
              type.includes('privilege') || type.includes('pl') || type.includes('el')) {
            leaveTypesByCategory['Common'].push(lt);
          } else if (type.includes('maternity') || type.includes('paternity') || 
                    type.includes('marriage') || type.includes('bereavement') || 
                    type.includes('compensatory') || type.includes('sabbatical')) {
            leaveTypesByCategory['Special'].push(lt);
          } else {
            leaveTypesByCategory['Other'].push(lt);
          }
        });
        
        // If a category is selected, filter leave types
        const displayLeaveTypes = selectedCategory === 'all' 
          ? analytics.leaveTypes.slice(0, 6)
          : leaveTypesByCategory[selectedCategory as keyof typeof leaveTypesByCategory].slice(0, 6);
        
        const balanceData = {
          labels: displayLeaveTypes.map(lt => {
            const name = lt.leave_type || 'Unknown';
            return name.length > 8 ? name.substring(0, 8) + '...' : name;
          }),
          datasets: [{
            data: displayLeaveTypes.map(lt => lt.total_days || 0),
            colors: displayLeaveTypes.map(lt => 
              (opacity = 1) => getLeaveTypeColor(lt.leave_type)
            )
          }]
        };

        // If no leave types in the selected category
        if (displayLeaveTypes.length === 0) {
          return (
            <View className="h-[180px] justify-center items-center">
              <Text className={isDark ? "text-gray-300" : "text-gray-600"}>
                No leave types in this category
              </Text>
            </View>
          );
        }

        return (
          <View>
            {/* Category tabs */}
            <View className="flex-row mb-3">
              {['all', 'Common', 'Special', 'Other'].map(category => (
                <TouchableOpacity
                  key={category}
                  onPress={() => setSelectedCategory(category)}
                  className={`mr-2 px-3 py-1 rounded-full ${
                    selectedCategory === category
                      ? 'bg-blue-500'
                      : isDark ? 'bg-gray-700' : 'bg-gray-200'
                  }`}
                >
                  <Text className={selectedCategory === category ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-700'}>
                    {category === 'all' ? 'All' : category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <BarChart
              data={balanceData}
              width={width}
              height={180}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={{
                ...commonConfig,
                barPercentage: 0.6,
                color: (opacity = 1, index) => {
                  if (index !== undefined && balanceData.datasets[0].colors?.[index]) {
                    return balanceData.datasets[0].colors[index](opacity);
                  }
                  return `rgba(16, 185, 129, ${opacity})`;
                }
              }}
              style={{
                borderRadius: 16,
                marginVertical: 8,
              }}
              showValuesOnTopOfBars
            />
            
            <View className="flex-row justify-between items-center mt-4 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
              <View className="items-center">
                <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Available
                </Text>
                <Text className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {analytics.balances.total_available || 0}
                </Text>
              </View>
              <View className="items-center">
                <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Used
                </Text>
                <Text className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {analytics.balances.total_used || 0}
                </Text>
              </View>
              <View className="items-center">
                <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Pending
                </Text>
                <Text className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {analytics.balances.total_pending || 0}
                </Text>
              </View>
              <View className="items-center">
                <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Employees
                </Text>
                <Text className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {analytics.balances.employee_count || 0}
                </Text>
              </View>
            </View>
          </View>
        );

      case 'distribution':
        if (!analytics.leaveTypes || analytics.leaveTypes.length === 0) {
          return (
            <View className="h-[220px] justify-center items-center">
              <Text className={isDark ? "text-gray-300" : "text-gray-600"}>
                No leave type data available
              </Text>
            </View>
          );
        }

        // Prepare data for pie chart - status distribution
        const statusData = [
          {
            name: 'Approved',
            count: analytics.metrics.approved_requests,
            color: '#10B981',
            legendFontColor: isDark ? '#E5E7EB' : '#1F2937',
            legendFontSize: 12
          },
          {
            name: 'Pending',
            count: analytics.metrics.pending_requests,
            color: '#F59E0B',
            legendFontColor: isDark ? '#E5E7EB' : '#1F2937',
            legendFontSize: 12
          },
          {
            name: 'Rejected',
            count: analytics.metrics.total_requests - analytics.metrics.approved_requests - analytics.metrics.pending_requests,
            color: '#EF4444',
            legendFontColor: isDark ? '#E5E7EB' : '#1F2937',
            legendFontSize: 12
          }
        ].filter(item => item.count > 0);

        // Create leave types distribution for pie chart - top 5 types
        const leaveTypesData = analytics.leaveTypes
          .sort((a, b) => b.request_count - a.request_count)
          .slice(0, 5)
          .map(lt => ({
            name: lt.leave_type,
            count: lt.request_count,
            color: getLeaveTypeColor(lt.leave_type),
            legendFontColor: isDark ? '#E5E7EB' : '#1F2937',
            legendFontSize: 12
          }))
          .filter(item => item.count > 0);

        // If there's no data, show message
        if ((statusData.length === 0 || statusData.every(item => item.count === 0)) && 
            (leaveTypesData.length === 0 || leaveTypesData.every(item => item.count === 0))) {
          return (
            <View className="h-[220px] justify-center items-center">
              <Text className={isDark ? "text-gray-300" : "text-gray-600"}>
                No distribution data available
              </Text>
            </View>
          );
        }

        return (
          <View>
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Leave Status Distribution
            </Text>
            <PieChart
              data={statusData}
              width={width}
              height={180}
              chartConfig={commonConfig}
              accessor="count"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
            
            {leaveTypesData.length > 0 && (
              <>
                <Text className={`text-sm font-medium mt-4 mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Top Leave Types
                </Text>
                <PieChart
                  data={leaveTypesData}
                  width={width}
                  height={180}
                  chartConfig={commonConfig}
                  accessor="count"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
              </>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  const renderEmployeeStats = () => {
    if (!analytics || !analytics.employeeStats || analytics.employeeStats.length === 0) {
      return (
        <View className="mt-4">
          <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Employee Leave Stats
          </Text>
          <Text className={isDark ? "text-gray-300" : "text-gray-600"}>
            No employee leave data available
          </Text>
        </View>
      );
    }

    return (
      <View className="mt-4">
        <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Top Leave Requesters
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {analytics.employeeStats.map((emp, index) => (
            <View 
              key={index} 
              className={`mr-3 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
              style={{ width: 140 }}
            >
              <Text className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`} numberOfLines={1}>
                {emp.employee_name}
              </Text>
              <View className="flex-row items-center mb-1">
                <Ionicons 
                  name="document-text-outline" 
                  size={14} 
                  color={isDark ? '#9CA3AF' : '#6B7280'} 
                />
                <Text className={`text-xs ml-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {emp.total_requests} requests
                </Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons 
                  name="calendar-outline" 
                  size={14} 
                  color={isDark ? '#9CA3AF' : '#6B7280'} 
                />
                <Text className={`text-xs ml-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {emp.total_leave_days} days
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
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
        <TouchableOpacity 
          className="mt-3 px-4 py-2 bg-blue-500 rounded-full"
          onPress={fetchLeaveAnalytics}
        >
          <Text className="text-white font-medium">Retry</Text>
        </TouchableOpacity>
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
               graphType === 'balances' ? 'Leave Balance Distribution' :
               'Leave Status Distribution'}
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
          <View className="flex-row flex-wrap justify-between mt-6">
            <View className="w-[48%] mb-4">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Total Requests
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics?.total_requests || 0}
              </Text>
            </View>
            <View className="w-[48%] mb-4">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Pending Requests
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics?.pending_requests || 0}
              </Text>
            </View>
            <View className="w-[48%]">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Approval Rate
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics?.approval_rate || 0}%
              </Text>
            </View>
            <View className="w-[48%]">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Total Leave Days
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics?.total_leave_days || 0}
              </Text>
            </View>
          </View>

          {/* Employee Stats Section */}
          {renderEmployeeStats()}
        </View>
      </ReportCard>
    </View>
  );
} 