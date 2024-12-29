import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReportSection } from '../types';

interface ReportCardProps {
  section: ReportSection;
  isDark: boolean;
  children?: React.ReactNode;
}

export default function ReportCard({ section, isDark, children }: ReportCardProps) {
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExportPDF = async () => {
    // Export logic here
  };

  return (
    <View className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={styles.card}>
      <View className="flex-row items-center justify-between mb-4">
        <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {section.title} Analytics
        </Text>
        <TouchableOpacity
          onPress={handleExportPDF}
          disabled={isExporting}
          className={`flex-row items-center py-2 px-3 rounded-lg bg-blue-500 ${isExporting ? 'opacity-70' : ''}`}
        >
          {isExporting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text className="text-white font-medium">Export PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Standard Analytics - Now with 2 columns */}
      <View className="flex-row justify-between mb-4">
        {[
          { label: 'Total', value: section.analytics.total },
          { label: 'Average', value: section.analytics.average },
        ].map((stat, index) => (
          <View key={index} className="w-[48%]">
            <View className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {stat.label}
              </Text>
              <Text className={`text-lg font-semibold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stat.value}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  }
}); 