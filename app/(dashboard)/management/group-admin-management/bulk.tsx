import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import * as FileSystem from 'expo-file-system';

interface UploadResponse {
  success: Array<{
    id: number;
    name: string;
    email: string;
  }>;
  errors: Array<{
    row: number;
    error: string;
    email?: string;
  }>;
}

export default function BulkUpload() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const handleBulkUpload = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values'],
        multiple: false,
      });

      if (!result || result.canceled || !result.assets || result.assets.length === 0) {
        setLoading(false);
        return;
      }

      const file = result.assets[0];
      setSelectedFile(file.name);

      // Verify file exists and is readable
      const fileInfo = await FileSystem.getInfoAsync(file.uri);
      if (!fileInfo.exists) {
        setError('Selected file does not exist');
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: 'text/csv',
        name: file.name || 'upload.csv',
      } as any);

      try {
        const response = await axios.post<UploadResponse>(
          `${process.env.EXPO_PUBLIC_API_URL}/api/group-admins/bulk`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (response.data.success && response.data.success.length > 0) {
          const successMessage = `Successfully created ${response.data.success.length} group admin${
            response.data.success.length > 1 ? 's' : ''
          }`;

          if (response.data.errors && response.data.errors.length > 0) {
            const errorDetails = response.data.errors
              .map(err => `Row ${err.row}: ${err.error}`)
              .join('\n');

            Alert.alert(
              'Partial Success',
              `${successMessage}\n\nErrors encountered:\n${errorDetails}`,
              [{ 
                text: 'OK',
                onPress: () => router.back()
              }]
            );
          } else {
            Alert.alert(
              'Success',
              successMessage,
              [{ 
                text: 'OK',
                onPress: () => router.back()
              }]
            );
          }
        } else if (response.data.errors && response.data.errors.length > 0) {
          const errorDetails = response.data.errors
            .map(err => `Row ${err.row}: ${err.error}`)
            .join('\n');

          setError(`Failed to create group admins:\n${errorDetails}`);
        }
      } catch (uploadError: any) {
        console.error('Upload error:', uploadError.response?.data || uploadError);
        setError(uploadError.response?.data?.error || 'Failed to upload CSV file');
      }
    } catch (error: any) {
      console.error('Document picker error:', error);
      setError('Failed to select file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme === 'dark' ? '#111827' : '#F3F4F6' }]}>
      <View style={[styles.card, { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }]}>
        <Text style={[styles.title, { color: theme === 'dark' ? '#F9FAFB' : '#111827' }]}>
          Bulk Upload Group Admins
        </Text>

        <View style={[styles.infoCard, { backgroundColor: theme === 'dark' ? '#374151' : '#EFF6FF' }]}>
          <Text style={[styles.infoTitle, { color: theme === 'dark' ? '#93C5FD' : '#1D4ED8' }]}>
            CSV File Format
          </Text>
          <Text style={[styles.infoText, { color: theme === 'dark' ? '#BFDBFE' : '#1E40AF' }]}>
            Required columns: name, email, phone, password
          </Text>
          <Text style={[styles.infoExample, { color: theme === 'dark' ? '#93C5FD' : '#1D4ED8' }]}>
            Example: John Doe,john@example.com,+1234567890,password123
          </Text>
        </View>

        {selectedFile && (
          <View style={styles.selectedFileContainer}>
            <Text style={[styles.selectedFileText, { color: theme === 'dark' ? '#D1D5DB' : '#4B5563' }]}>
              Selected file: {selectedFile}
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.uploadButton, { opacity: loading ? 0.7 : 1 }]}
          onPress={handleBulkUpload}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={24} color="#FFFFFF" />
              <Text style={styles.buttonText}>Select CSV File</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.helpText, { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
          Click to select a CSV file from your device
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  infoCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 8,
  },
  infoExample: {
    fontSize: 14,
    fontFamily: 'monospace',
  },
  selectedFileContainer: {
    marginBottom: 16,
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  selectedFileText: {
    fontSize: 14,
  },
  uploadButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
  },
});
