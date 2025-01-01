import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as WebBrowser from 'expo-web-browser';
import * as IntentLauncher from 'expo-intent-launcher';
import { Alert, Platform } from 'react-native';
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
  private static isIntentInProgress = false;
  private static intentCooldown = 1000;

  private static async ensureDirectoryExists() {
    const dirPath = FileSystem.documentDirectory + this.APP_DOCUMENTS_DIR;
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }
    return dirPath;
  }

  static async generatePDF(section: ReportSection): Promise<{ filePath: string; fileName: string }> {
    try {
      // Get the auth token
      const token = await AsyncStorage.getItem('auth_token');

      // Fetch report data from API
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/pdf-reports/${section.type}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Generate HTML content based on section type and data
      const html = await this.generateHTMLContent(section, data);
      
      // Generate PDF
      const { uri } = await Print.printToFileAsync({ html });
      const fileName = `${section.type}_report_${Date.now()}.pdf`;
      const docsDir = await this.ensureDirectoryExists();
      const filePath = `${docsDir}${fileName}`;
      
      await FileSystem.copyAsync({
        from: uri,
        to: filePath
      });

      return { filePath, fileName };
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  static async openPDF(filePath: string) {
    try {
      if (Platform.OS === 'ios') {
        await WebBrowser.openBrowserAsync(`file://${filePath}`);
      } else {
        const contentUri = await FileSystem.getContentUriAsync(filePath);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: 'application/pdf',
        });
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
      Alert.alert('Error', 'Unable to open the PDF file');
    }
  }

  static async sharePDF(filePath: string) {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this platform');
      }

      await Sharing.shareAsync(filePath, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share PDF Report'
      });
    } catch (error) {
      console.error('Error sharing PDF:', error);
      Alert.alert('Error', 'Unable to share the PDF file');
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