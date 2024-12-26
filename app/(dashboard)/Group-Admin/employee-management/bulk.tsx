import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, StatusBar } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import axios from 'axios';

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
  const isDark = theme === 'dark';

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
          `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/employees/bulk`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (response.data.success && response.data.success.length > 0) {
          const successMessage = `Successfully created ${response.data.success.length} employee${
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

          setError(`Failed to create employees:\n${errorDetails}`);
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
    <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#F3F4F6' }}>
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* Header */}
      <View 
        className={`${isDark ? 'bg-gray-800' : 'bg-white'}`}
        style={styles.header}
      >
        <View className="flex-row items-center justify-between px-4 pt-3 pb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
            style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}
          >
            <Ionicons 
              name="arrow-back" 
              size={24} 
              color={isDark ? '#FFFFFF' : '#111827'} 
            />
          </TouchableOpacity>
          <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
            <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Bulk Upload
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        <View className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={styles.card}>
          {/* CSV Format Guide */}
          <View className={`mb-8 p-6 rounded-lg ${
            isDark ? 'bg-blue-900/20' : 'bg-blue-50'
          }`}>
            <Text className={`text-lg font-semibold mb-4 ${
              isDark ? 'text-blue-400' : 'text-blue-700'
            }`}>
              CSV File Format
            </Text>
            <Text className={isDark ? 'text-blue-300' : 'text-blue-600'}>
              Required columns:
            </Text>
            <View className="ml-4 mt-2">
              {[
                'name - Full name of the employee',
                'employee_number - Unique employee ID',
                'email - Valid email address',
                'phone - Phone number (optional)',
                'password - Initial password',
                'department - Department name',
                'designation - Job designation (optional)',
                'can_submit_expenses_anytime - true/false (optional)'
              ].map((item, index) => (
                <Text 
                  key={index}
                  className={`mt-1 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}
                >
                  • {item}
                </Text>
              ))}
            </View>
            <Text className={`mt-4 font-mono text-sm ${
              isDark ? 'text-blue-300' : 'text-blue-600'
            }`}>
              Example:{'\n'}
              name,employee_number,email,phone,password,department,designation,can_submit_expenses_anytime{'\n'}
              John Doe,EMP001,john@example.com,+1234567890,Pass123!,IT,Developer,true
            </Text>
          </View>

          {selectedFile && (
            <View className={`mb-6 p-4 rounded-lg ${
              isDark ? 'bg-gray-700' : 'bg-gray-50'
            }`}>
              <Text className={`${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Selected file: {selectedFile}
              </Text>
            </View>
          )}

          {error && (
            <View className="mb-6 p-4 bg-red-100 border border-red-400 rounded-lg">
              <Text className="text-red-800 whitespace-pre-line">{error}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleBulkUpload}
            disabled={loading}
            className={`p-6 rounded-lg border-2 border-dashed ${
              isDark 
                ? 'border-gray-600 bg-gray-700/50' 
                : 'border-blue-300 bg-blue-50'
            } ${loading ? 'opacity-50' : ''}`}
            style={styles.uploadButton}
          >
            <View className="items-center">
              <Ionicons 
                name="cloud-upload-outline" 
                size={48} 
                color={isDark ? '#60A5FA' : '#3B82F6'} 
              />
              <Text className={`mt-4 text-lg font-semibold ${
                isDark ? 'text-gray-200' : 'text-gray-900'
              }`}>
                {loading ? 'Uploading...' : 'Select CSV File'}
              </Text>
              <Text className={`mt-2 text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Click to browse your files
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  uploadButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  }
}); 