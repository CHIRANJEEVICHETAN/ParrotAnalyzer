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

  const generateSectionContent = async (section: ReportSection) => {
    try {
      // Get the auth token from wherever you store it (AsyncStorage, context, etc.)
      const token = await AsyncStorage.getItem('auth_token');

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/pdf-reports/${section.type}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response not OK:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received data:', data); // Debug log

      // Generate content based on section type
      switch (section.type) {
        case 'expense':
          return generateExpenseReport(data, isDark ? 'dark' : 'light');
        case 'attendance':
          return generateAttendanceReport(data, isDark ? 'dark' : 'light');
        case 'task':
          return generateTaskReport(data, isDark ? 'dark' : 'light');
        case 'travel':
          return generateTravelReport(data, isDark ? 'dark' : 'light');
        case 'performance':
          return generatePerformanceReport(data, isDark ? 'dark' : 'light');
        case 'leave':
          return generateLeaveReport(data, isDark ? 'dark' : 'light');
        default:
          throw new Error(`Unsupported report type: ${section.type}`);
      }
    } catch (error) {
      console.error('Error generating content:', error);
      throw error;
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const { filePath, fileName } = await PDFGenerator.generatePDF(section);
      
      // Show action sheet with only Open and Share options
      Alert.alert(
        'Export PDF',
        'Choose an action',
        [
          {
            text: 'Open',
            onPress: () => PDFGenerator.openPDF(filePath)
          },
          {
            text: 'Share',
            onPress: () => PDFGenerator.sharePDF(filePath)
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('Error exporting PDF:', error);
      Alert.alert('Error', 'Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
      }
    ]}>
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
          }}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
              <Text style={{ 
                color: '#FFFFFF', 
                marginLeft: 6,
                fontSize: 14,
                fontWeight: '500'
              }}>
                Export PDF
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