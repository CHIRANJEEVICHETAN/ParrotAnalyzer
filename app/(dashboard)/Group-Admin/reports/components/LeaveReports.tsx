import React, { useState } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { StackedBarChart, LineChart, ContributionGraph } from 'react-native-chart-kit';
import { ReportSection } from '../types';
import ReportCard from './ReportCard';
import GraphSelector from './GraphSelector';

export default function LeaveReports({ section, isDark }: { section: ReportSection; isDark: boolean }) {
  const [graphType, setGraphType] = useState('stacked');

  const graphOptions = [
    { type: 'stacked', icon: 'bar-chart', label: 'Types' },
    { type: 'line', icon: 'trending-up', label: 'Trend' },
    { type: 'calendar', icon: 'calendar', label: 'Calendar' },
  ];

  const stackedData = {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    legend: ['Casual', 'Sick', 'Annual'],
    data: [
      [3, 2, 5],  // Q1: Casual, Sick, Annual
      [2, 4, 3],  // Q2
      [4, 3, 2],  // Q3
      [5, 2, 4],  // Q4
    ],
    barColors: ['#6366F1', '#8B5CF6', '#EC4899']
  };

  const lineData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      data: [5, 8, 6, 9, 4, 7],
    }]
  };

  const calendarData = [
    { date: '2024-03-01', count: 1 },
    { date: '2024-03-05', count: 2 },
    { date: '2024-03-08', count: 1 },
    { date: '2024-03-15', count: 3 },
    { date: '2024-03-20', count: 1 },
    { date: '2024-03-25', count: 2 },
    { date: '2024-03-28', count: 1 },
  ];

  const renderGraph = () => {
    const width = Dimensions.get('window').width - 64;
    const commonConfig = {
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      backgroundGradientFrom: isDark ? '#1F2937' : '#FFFFFF',
      backgroundGradientTo: isDark ? '#1F2937' : '#FFFFFF',
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
      labelColor: (opacity = 1) => isDark ? `rgba(156, 163, 175, ${opacity})` : `rgba(107, 114, 128, ${opacity})`,
    };

    switch (graphType) {
      case 'stacked':
        return (
          <StackedBarChart
            data={stackedData}
            width={width}
            height={220}
            chartConfig={commonConfig}
            style={{
              borderRadius: 16,
              marginVertical: 8,
            }}
            hideLegend={false}
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
      case 'calendar':
        return (
          <ContributionGraph
            values={calendarData}
            endDate={new Date()}
            numDays={30}
            width={width}
            height={220}
            chartConfig={{
              ...commonConfig,
              color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
            }}
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
              {graphType === 'stacked' ? 'Leave Distribution by Type' :
               graphType === 'line' ? 'Monthly Leave Pattern' :
               'Leave Calendar View'}
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
                Approval Rate
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                92%
              </Text>
            </View>
            <View>
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Leave Balance
              </Text>
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                15 days
              </Text>
            </View>
          </View>

          {/* Leave Type Summary */}
          <View className="mt-4 flex-row justify-between">
            {[
              { type: 'Casual', used: 5, total: 12, color: '#6366F1' },
              { type: 'Sick', used: 3, total: 10, color: '#8B5CF6' },
              { type: 'Annual', used: 8, total: 15, color: '#EC4899' },
            ].map((leave) => (
              <View key={leave.type} className="items-center">
                <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {leave.type}
                </Text>
                <Text className="text-sm font-semibold" style={{ color: leave.color }}>
                  {leave.used}/{leave.total}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ReportCard>
    </View>
  );
} 