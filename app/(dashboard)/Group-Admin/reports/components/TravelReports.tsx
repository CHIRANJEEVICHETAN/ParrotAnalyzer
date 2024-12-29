import React, { useState } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { ReportSection } from '../types';
import ReportCard from './ReportCard';
import GraphSelector from './GraphSelector';

export default function TravelReports({ section, isDark }: { section: ReportSection; isDark: boolean }) {
  const [graphType, setGraphType] = useState('line');

  const graphOptions = [
    { type: 'line', icon: 'trending-up', label: 'Expenses' },
    { type: 'bar', icon: 'bar-chart', label: 'Locations' },
    { type: 'pie', icon: 'pie-chart', label: 'Transport' },
  ];

  const lineData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      data: [12000, 8000, 15000, 10000, 18000, 14000],
    }]
  };

  const barData = {
    labels: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata'],
    datasets: [{
      data: [32, 28, 25, 20, 15],
    }]
  };

  const pieData = [
    {
      name: 'Flight',
      population: 45,
      color: '#3B82F6',
      legendFontColor: isDark ? '#9CA3AF' : '#6B7280',
    },
    {
      name: 'Train',
      population: 30,
      color: '#10B981',
      legendFontColor: isDark ? '#9CA3AF' : '#6B7280',
    },
    {
      name: 'Car',
      population: 25,
      color: '#F59E0B',
      legendFontColor: isDark ? '#9CA3AF' : '#6B7280',
    },
  ];

  const renderGraph = () => {
    const width = Dimensions.get('window').width - 64;
    const commonConfig = {
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      backgroundGradientFrom: isDark ? '#1F2937' : '#FFFFFF',
      backgroundGradientTo: isDark ? '#1F2937' : '#FFFFFF',
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`,
      labelColor: (opacity = 1) => isDark ? `rgba(156, 163, 175, ${opacity})` : `rgba(107, 114, 128, ${opacity})`,
    };

    switch (graphType) {
      case 'line':
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
        return (
          <BarChart
            data={barData}
            width={width}
            height={220}
            chartConfig={commonConfig}
            style={{
              borderRadius: 16,
              marginVertical: 8,
            }}
            showValuesOnTopOfBars
          />
        );
      case 'pie':
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
      default:
        return null;
    }
  };

  return (
    <View className="mb-4">
      <ReportCard section={section} isDark={isDark}>
        <View className="mt-4">
          <View className="mb-4">
            <Text className={`text-base font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {graphType === 'line' ? 'Monthly Travel Expenses' :
               graphType === 'bar' ? 'Popular Destinations' :
               'Transport Distribution'}
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
          <View className="flex-row justify-between mt-4">
            <View>
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Total Distance
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                2,450 km
              </Text>
            </View>
            <View>
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Avg. Trip Cost
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ₹12,800
              </Text>
            </View>
          </View>
        </View>
      </ReportCard>
    </View>
  );
} 