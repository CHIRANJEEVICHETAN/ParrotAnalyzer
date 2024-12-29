import React, { useState } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { BarChart, LineChart, ContributionGraph } from 'react-native-chart-kit';
import { ReportSection } from '../types';
import ReportCard from './ReportCard';
import GraphSelector from './GraphSelector';

export default function AttendanceReports({ section, isDark }: { section: ReportSection; isDark: boolean }) {
  const [graphType, setGraphType] = useState('bar');

  const graphOptions = [
    { type: 'bar', icon: 'bar-chart', label: 'Daily' },
    { type: 'line', icon: 'trending-up', label: 'Trend' },
    { type: 'heatmap', icon: 'calendar', label: 'Calendar' },
  ];

  const barData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    datasets: [{
      data: [85, 92, 88, 95, 90],
    }]
  };

  const lineData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [{
      data: [92, 88, 95, 91],
    }]
  };

  const heatmapData = [
    { date: '2024-03-01', count: 5 },
    { date: '2024-03-02', count: 3 },
    { date: '2024-03-03', count: 4 },
    { date: '2024-03-04', count: 8 },
    { date: '2024-03-05', count: 7 },
    { date: '2024-03-06', count: 6 },
    { date: '2024-03-07', count: 5 },
  ];

  const renderGraph = () => {
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
      case 'heatmap':
        return (
          <ContributionGraph
            values={heatmapData}
            endDate={new Date()}
            numDays={7}
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
          <View className="flex-row justify-between mt-4">
            <View>
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                On-Time Rate
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                95%
              </Text>
            </View>
            <View>
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Avg. Working Hours
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                8.5h
              </Text>
            </View>
          </View>
        </View>
      </ReportCard>
    </View>
  );
} 