import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { generateBaseTemplate } from '../components/pdf-templates/BaseTemplate';

export class PDFGenerator {
  private static async saveToDownloads(uri: string, filename: string): Promise<string> {
    const downloadsDir = FileSystem.documentDirectory + 'Downloads/';
    
    // Create Downloads directory if it doesn't exist
    const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true });
    }
    
    const destination = `${downloadsDir}${filename}`;
    await FileSystem.moveAsync({ from: uri, to: destination });
    
    return destination;
  }

  private static async showNotification(filename: string, uri: string) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Report Downloaded',
        body: `Your report ${filename} has been downloaded`,
        data: { uri },
      },
      trigger: null,
    });
  }

  static async generatePDF(
    title: string,
    content: string,
    type: string,
    theme: 'light' | 'dark' = 'light'
  ): Promise<void> {
    try {
      // Generate HTML
      const html = generateBaseTemplate({
        title,
        date: new Date().toLocaleDateString(),
        content,
        theme,
      });

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      // Generate filename
      const timestamp = new Date().getTime();
      const filename = `${type}_report_${timestamp}.pdf`;

      // Save to downloads
      const finalUri = await this.saveToDownloads(uri, filename);

      // Show notification
      await this.showNotification(filename, finalUri);

      // Share the PDF
      await Sharing.shareAsync(finalUri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }
} 