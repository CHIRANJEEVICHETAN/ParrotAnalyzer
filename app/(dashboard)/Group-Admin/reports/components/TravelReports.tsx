import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions, ActivityIndicator } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { ReportSection } from '../types';
import ReportCard from './ReportCard';
import GraphSelector from './GraphSelector';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TravelAnalytics {
  expenses: Array<{
    category: string;
    total_amount: number;
    percentage: number;
    color: string;
  }>;
  locations: Array<{
    location: string;
    trip_count: number;
    total_amount: number;
  }>;
  transport: Array<{
    vehicle_type: string;
    trip_count: number;
    total_distance: number;
    total_amount: number;
  }>;
  metrics: {
    total_travelers: number;
    total_trips: number;
    total_distance: number;
    total_expenses: number;
    avg_trip_cost: number;
  };
}

export default function TravelReports({ section, isDark }: { section: ReportSection; isDark: boolean }) {
  const [graphType, setGraphType] = useState('expense');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<TravelAnalytics | null>(null);

  const graphOptions = [
    { type: 'expense', icon: 'pie-chart', label: 'Expenses' },
    { type: 'location', icon: 'map', label: 'Locations' },
    { type: 'transport', icon: 'car', label: 'Transport' },
  ];

  useEffect(() => {
    fetchTravelAnalytics();
  }, []);

  const fetchTravelAnalytics = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/reports/travel-analytics`,
        { 
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.data) {
        console.log('Travel analytics data:', response.data);
        setAnalytics(response.data);
      }
    } catch (error: any) {
      console.error('Error fetching travel analytics:', error);
      setError(error.response?.data?.error || 'Failed to fetch travel data');
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

    switch (graphType) {
      case 'expense':
        const pieData = analytics.expenses.map(item => ({
          name: item.category,
          population: Number(item.total_amount),
          color: item.color,
          legendFontColor: isDark ? '#9CA3AF' : '#4B5563',
          legendFontSize: 12,
          percentage: item.percentage
        }));

        return (
          <PieChart
            data={pieData}
            width={width}
            height={220}
            chartConfig={commonConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        );

      case 'location':
        const locationData = {
          labels: analytics.locations.map(l => l.location.substring(0, 8) + '...'),
          datasets: [{
            data: analytics.locations.map(l => Number(l.total_amount))
          }]
        };

        return (
          <BarChart
            data={locationData}
            width={width}
            height={220}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={{
              ...commonConfig,
              barPercentage: 0.7,
            }}
            style={{
              borderRadius: 16,
              marginVertical: 8,
            }}
            showValuesOnTopOfBars
            fromZero
          />
        );

      case 'transport':
        const transportData = {
          labels: analytics.transport.map(t => t.vehicle_type),
          datasets: [{
            data: analytics.transport.map(t => Number(t.trip_count))
          }]
        };

        return (
          <BarChart
            data={transportData}
            width={width}
            height={220}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={{
              ...commonConfig,
              barPercentage: 0.7,
            }}
            style={{
              borderRadius: 16,
              marginVertical: 8,
            }}
            showValuesOnTopOfBars
            fromZero
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
              {graphType === 'expense' ? 'Expense Distribution' :
               graphType === 'location' ? 'Top Locations by Expense' :
               'Transport Type Distribution'}
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
                Total Trips
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics.total_trips || 0}
              </Text>
            </View>
            <View className="w-[48%] mb-4">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Total Distance
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.metrics.total_distance || 0} km
              </Text>
            </View>
            <View className="w-[48%]">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Total Expenses
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ₹{Number(analytics?.metrics.total_expenses || 0).toLocaleString()}
              </Text>
            </View>
            <View className="w-[48%]">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Avg. Trip Cost
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ₹{Number(analytics?.metrics.avg_trip_cost || 0).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </ReportCard>
    </View>
  );
} 