import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReportSection } from '../types';
import { PDFGenerator } from '../services/PDFGenerator';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { generateExpenseReport } from './pdf-templates/ExpenseTemplate';
import { generateAttendanceReport } from './pdf-templates/AttendanceTemplate';
import { generateTaskReport } from './pdf-templates/TaskTemplate';
import { generateTravelReport } from './pdf-templates/TravelTemplate';
import { generatePerformanceReport } from './pdf-templates/PerformanceTemplate';
import { generateLeaveReport } from './pdf-templates/LeaveTemplate';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ReportCardProps {
  section: ReportSection;
  isDark: boolean;
  children?: React.ReactNode;
}

export default function ReportCard({ section, isDark, children }: ReportCardProps) {
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      await PDFGenerator.generateAndSharePDF(section);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      Alert.alert('Error', 'Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={[styles.card, {
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      borderRadius: 8,
      padding: 16,
      marginBottom: 16,
    }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ 
            fontSize: 18, 
            fontWeight: '600',
            color: isDark ? '#FFFFFF' : '#111827',
            marginBottom: 4
          }}>
            {section.title}
          </Text>
          <Text style={{ 
            fontSize: 14,
            color: isDark ? '#9CA3AF' : '#6B7280'
          }}>
            {section.description}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleExportPDF}
          disabled={isExporting}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#3B82F6',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 6,
            opacity: isExporting ? 0.5 : 1
          }}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="share-outline" size={18} color="#FFFFFF" />
              <Text style={{ 
                color: '#FFFFFF', 
                marginLeft: 6,
                fontSize: 14,
                fontWeight: '500'
              }}>
                Share PDF
              </Text>
            </>
          )}
        </TouchableOpacity>
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