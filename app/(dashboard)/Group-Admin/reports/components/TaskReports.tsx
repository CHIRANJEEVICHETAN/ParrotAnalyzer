import React, { useState } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { PieChart, LineChart, BarChart } from 'react-native-chart-kit';
import { ReportSection } from '../types';
import ReportCard from './ReportCard';
import GraphSelector from './GraphSelector';

export default function TaskReports({ section, isDark }: { section: ReportSection; isDark: boolean }) {
  const [graphType, setGraphType] = useState('pie');

  const graphOptions = [
    { type: 'pie', icon: 'pie-chart', label: 'Status' },
    { type: 'line', icon: 'trending-up', label: 'Trend' },
    { type: 'bar', icon: 'bar-chart', label: 'Priority' },
  ];

  const pieData = [
    {
      name: 'Completed',
      population: 65,
      color: '#10B981',
      legendFontColor: isDark ? '#9CA3AF' : '#6B7280',
    },
    {
      name: 'In Progress',
      population: 25,
      color: '#F59E0B',
      legendFontColor: isDark ? '#9CA3AF' : '#6B7280',
    },
    {
      name: 'Pending',
      population: 10,
      color: '#EF4444',
      legendFontColor: isDark ? '#9CA3AF' : '#6B7280',
    },
  ];

  const lineData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    datasets: [{
      data: [12, 18, 15, 22, 20],
    }]
  };

  const barData = {
    labels: ['High', 'Medium', 'Low'],
    datasets: [{
      data: [28, 45, 27],
    }]
  };

  const renderGraph = () => {
    const width = Dimensions.get('window').width - 64;
    const commonConfig = {
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      backgroundGradientFrom: isDark ? '#1F2937' : '#FFFFFF',
      backgroundGradientTo: isDark ? '#1F2937' : '#FFFFFF',
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
      labelColor: (opacity = 1) => isDark ? `rgba(156, 163, 175, ${opacity})` : `rgba(107, 114, 128, ${opacity})`,
    };

    switch (graphType) {
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
              {graphType === 'pie' ? 'Task Status Distribution' :
               graphType === 'line' ? 'Daily Task Completion' :
               'Tasks by Priority'}
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
                Completion Rate
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                85%
              </Text>
            </View>
            <View>
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Avg. Completion Time
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                2.5 days
              </Text>
            </View>
          </View>
        </View>
      </ReportCard>
    </View>
  );
} 