import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReportSection } from '../types';
import { generateExpenseReport } from '../components/pdf-templates/ExpenseTemplate';
import { generateAttendanceReport } from '../components/pdf-templates/AttendanceTemplate';
import { generateTaskReport } from '../components/pdf-templates/TaskTemplate';
import { generateTravelReport } from '../components/pdf-templates/TravelTemplate';
import { generatePerformanceReport } from '../components/pdf-templates/PerformanceTemplate';
import { generateLeaveReport } from '../components/pdf-templates/LeaveTemplate';

export class PDFGenerator {
  private static readonly APP_DOCUMENTS_DIR = 'PDFReports/';

  static async generateAndSharePDF(section: ReportSection): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/pdf-reports/${section.type}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const html = await this.generateHTMLContent(section, data);
      const { uri } = await Print.printToFileAsync({ html });

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this platform');
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${section.title}`
      });
    } catch (error) {
      console.error('Error generating/sharing PDF:', error);
      Alert.alert('Error', 'Unable to generate or share the PDF file');
    }
  }

  private static async generateHTMLContent(section: ReportSection, data: any): Promise<string> {
    switch (section.type) {
      case 'expense':
        return generateExpenseReport(data, 'light');
      case 'attendance':
        return generateAttendanceReport(data, 'light');
      case 'task':
        return generateTaskReport(data, 'light');
      case 'travel':
        return generateTravelReport(data, 'light');
      case 'performance':
        return generatePerformanceReport(data, 'light');
      case 'leave':
        return generateLeaveReport(data, 'light');
      default:
        throw new Error(`Unsupported report type: ${section.type}`);
    }
  }
} 