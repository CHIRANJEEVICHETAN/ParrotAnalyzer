import React, { useState } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { LineChart, BarChart, ProgressChart } from 'react-native-chart-kit';
import { ReportSection } from '../types';
import ReportCard from './ReportCard';
import GraphSelector from './GraphSelector';

export default function PerformanceReports({ section, isDark }: { section: ReportSection; isDark: boolean }) {
  const [graphType, setGraphType] = useState('line');

  const graphOptions = [
    { type: 'line', icon: 'trending-up', label: 'Trend' },
    { type: 'bar', icon: 'bar-chart', label: 'Skills' },
    { type: 'progress', icon: 'pie-chart', label: 'Goals' },
  ];

  const lineData = {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: [{
      data: [85, 88, 92, 95],
    }]
  };

  const barData = {
    labels: ['Technical', 'Communication', 'Leadership', 'Teamwork', 'Innovation'],
    datasets: [{
      data: [90, 85, 78, 88, 82],
    }]
  };

  const progressData = {
    labels: ['Projects', 'Learning', 'Mentoring'], // optional
    data: [0.8, 0.6, 0.9]
  };

  const renderGraph = () => {
    const width = Dimensions.get('window').width - 64;
    const commonConfig = {
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      backgroundGradientFrom: isDark ? '#1F2937' : '#FFFFFF',
      backgroundGradientTo: isDark ? '#1F2937' : '#FFFFFF',
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(236, 72, 153, ${opacity})`,
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
      case 'progress':
        return (
          <ProgressChart
            data={progressData}
            width={width}
            height={220}
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

  return (
    <View className="mb-4">
      <ReportCard section={section} isDark={isDark}>
        <View className="mt-4">
          <View className="mb-4">
            <Text className={`text-base font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {graphType === 'line' ? 'Performance Trend' :
               graphType === 'bar' ? 'Skill Assessment' :
               'Goals Progress'}
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
                Overall Rating
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                4.5/5.0
              </Text>
            </View>
            <View>
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Growth Rate
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                +15%
              </Text>
            </View>
          </View>
        </View>
      </ReportCard>
    </View>
  );
} 