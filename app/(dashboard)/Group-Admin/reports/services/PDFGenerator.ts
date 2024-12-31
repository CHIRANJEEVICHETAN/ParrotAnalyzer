import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import * as IntentLauncher from 'expo-intent-launcher';
import { generateBaseTemplate } from '../components/pdf-templates/BaseTemplate';
import { Alert } from 'react-native';
import { Platform } from 'react-native';

export class PDFGenerator {
  private static readonly APP_DOCUMENTS_DIR = 'PDFReports/';
  private static isIntentInProgress = false;
  private static intentCooldown = 1000; // 1 second cooldown

  private static async ensureDirectoryExists() {
    const dirPath = FileSystem.documentDirectory + this.APP_DOCUMENTS_DIR;
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }
    return dirPath;
  }

  private static async saveToAppDirectory(uri: string, filename: string): Promise<string> {
    const docsDir = await this.ensureDirectoryExists();
    const destination = `${docsDir}${filename}`;
    
    // If source and destination are different, copy the file
    if (uri !== destination) {
      await FileSystem.copyAsync({
        from: uri,
        to: destination
      });
    }
    
    return destination;
  }

  private static async showNotification(filename: string, uri: string) {
    // Request notification permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Schedule the notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'PDF Saved Successfully',
        body: `Tap to open ${filename}`,
        data: { uri },
      },
      trigger: null,
    });
  }

  static async generatePDF(
    title: string,
    content: string,
    type: string,
    theme: 'light' | 'dark'
  ): Promise<{ filePath: string; fileName: string }> {
    try {
      const fileName = `${type}_report_${Date.now()}.pdf`;
      
      // Generate HTML
      const html = generateBaseTemplate({
        title,
        date: new Date().toLocaleDateString(),
        content,
        theme,
      });

      // Generate PDF and get temporary URI
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      // Save to app directory and get final path
      const finalUri = await this.saveToAppDirectory(uri, fileName);

      // Delete the temporary file if it's different from the final location
      if (uri !== finalUri) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }

      return { filePath: finalUri, fileName };
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  static async openPDF(filePath: string): Promise<void> {
    try {
      // Check if an intent is already in progress
      if (this.isIntentInProgress) {
        console.log('Intent already in progress, please wait...');
        return;
      }

      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error('PDF file not found');
      }

      if (Platform.OS === 'android') {
        try {
          this.isIntentInProgress = true;
          const contentUri = await FileSystem.getContentUriAsync(filePath);
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: 1,
            type: 'application/pdf'
          });
        } finally {
          // Reset the flag after a cooldown period
          setTimeout(() => {
            this.isIntentInProgress = false;
          }, this.intentCooldown);
        }
      } else {
        // For iOS, use WebBrowser
        await WebBrowser.openBrowserAsync(`file://${filePath}`);
      }
    } catch (error) {
      this.isIntentInProgress = false;
      console.error('Error opening PDF:', error);
      throw error;
    }
  }

  static async sharePDF(filePath: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error('PDF file not found');
      }

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this platform');
      }

      await Sharing.shareAsync(filePath, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share PDF Report'
      });
    } catch (error) {
      console.error('Error sharing PDF:', error);
      throw error;
    }
  }

  static async savePDF(filePath: string, fileName: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error('PDF file not found');
      }

      // For saving, we'll use the same file but show a notification
      await this.showNotification(fileName, filePath);

      Alert.alert(
        'Success',
        'PDF saved successfully. Check your notification to open the file.'
      );

    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  }

  // Update notification tap handler
  static async setupNotificationHandler() {
    Notifications.addNotificationResponseReceivedListener(async (response) => {
      try {
        const uri = response.notification.request.content.data.uri;
        if (uri && !this.isIntentInProgress) {
          await this.openPDF(uri);
        }
      } catch (error) {
        console.error('Error handling notification tap:', error);
        Alert.alert('Error', 'Could not open the PDF file');
      }
    });
  }
} 