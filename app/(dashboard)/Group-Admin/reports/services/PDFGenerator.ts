import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
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
import axios from 'axios';
export class PDFGenerator {
  private static readonly APP_DOCUMENTS_DIR = 'PDFReports/';

  static async generateAndHandlePDF(section: ReportSection, action: 'open' | 'share'): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/pdf-reports/${section.type}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.status || response.status >= 400) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let processedData = response.data;
      
      // Check if we're getting metadata instead of actual data for leave reports
      if (section.type === 'leave' && processedData.hasLeaveTypes !== undefined) {
        console.log('Getting full leave analytics data...');
        try {
          // Get the full data rather than just metadata
          const fullDataResponse = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/reports/leave-analytics`, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (fullDataResponse.data) {
            // Prepare template data with proper structure and default values
            processedData = {
              leaveTypes: fullDataResponse.data.leaveTypes || [],
              employeeStats: fullDataResponse.data.employeeStats || [],
              balances: fullDataResponse.data.balances || {
                total_leave_balance: 0,
                total_leave_used: 0,
                total_leave_pending: 0,
                leave_types_balances: []
              },
              monthlyTrend: fullDataResponse.data.trend || [],
              metrics: fullDataResponse.data.metrics || {
                total_employees_on_leave: 0,
                total_requests: 0,
                approved_requests: 0,
                pending_requests: 0,
                approval_rate: 0,
                total_leave_days: 0
              },
              companyInfo: response.data.companyInfo || {},
              adminName: response.data.adminName || 'Group Admin'
            };
            
            console.log('Processed leave data structure:', {
              hasLeaveTypes: Array.isArray(processedData.leaveTypes),
              employeeStatsCount: processedData.employeeStats?.length || 0,
              hasBalances: !!processedData.balances,
              hasMetrics: !!processedData.metrics
            });
          }
        } catch (error) {
          console.error('Error fetching full leave analytics data:', error);
          throw new Error('Failed to fetch leave report data. Please try again.');
        }
      }

      const html = await this.generateHTMLContent(section, processedData);

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      if (action === 'share') {
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error('Sharing is not available on this platform');
        }
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${section.title}`,
          UTI: 'com.adobe.pdf'
        });
      } else {
        if (Platform.OS === 'ios') {
          // On iOS, use the native viewer
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            UTI: 'com.adobe.pdf',
            dialogTitle: section.title
          });
        } else {
          // On Android, use Intent to open with system PDF viewer
          try {
            const contentUri = await FileSystem.getContentUriAsync(uri);
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
              data: contentUri,
              flags: 1,
              type: 'application/pdf',
            });
          } catch (error) {
            console.error('Error opening PDF:', error);
            // Fallback to sharing if direct opening fails
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: section.title
            });
          }
        }
      }

      // Clean up after a delay
      setTimeout(async () => {
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        } catch (error) {
          console.log('Cleanup error:', error);
        }
      }, 60000);

    } catch (error) {
      console.error('Error handling PDF:', error);
      Alert.alert('Error', 'Unable to process the PDF file');
    }
  }

  private static async generateHTMLContent(section: ReportSection, data: any): Promise<string> {
    try {
      let content = '';
      
      switch (section.type) {
        case 'expense':
          content = generateExpenseReport(data, {
            theme: 'light',
            companyInfo: data.companyInfo,
            adminName: data.adminName
          });
          break;
        case 'attendance':
          content = generateAttendanceReport(data, {
            theme: 'light',
            companyInfo: data.companyInfo,
            adminName: data.adminName
          });
          break;
        case 'task':
          content = generateTaskReport(data, {
            theme: 'light',
            companyInfo: data.companyInfo,
            adminName: data.adminName
          });
          break;
        case 'travel':
          content = generateTravelReport(data, {
            theme: 'light',
            companyInfo: data.companyInfo,
            adminName: data.adminName
          });
          break;
        case 'performance':
          content = generatePerformanceReport(data, {
            theme: 'light',
            companyInfo: data.companyInfo,
            adminName: data.adminName
          });
          break;
        case 'leave':
          content = generateLeaveReport(data, {
            theme: 'light',
            companyInfo: data.companyInfo,
            adminName: data.adminName
          });
          break;
        default:
          throw new Error(`Unsupported report type: ${section.type}`);
      }

      if (!content.trim()) {
        throw new Error('Generated HTML content is empty');
      }

      return content;
    } catch (error) {
      console.error('Error generating HTML content:', error);
      throw error;
    }
  }
} 