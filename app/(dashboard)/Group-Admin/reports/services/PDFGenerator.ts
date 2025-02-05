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

export class PDFGenerator {
  private static readonly APP_DOCUMENTS_DIR = 'PDFReports/';

  static async generateAndHandlePDF(section: ReportSection, action: 'open' | 'share'): Promise<void> {
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