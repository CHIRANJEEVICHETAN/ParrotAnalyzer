import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

interface Document {
  id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  file_data: string;
  created_at: string;
}

interface Props {
  document: Document;
  isDark: boolean;
}

export default function DocumentViewer({ document, isDark }: Props) {
  const createTempFile = async () => {
    const fileUri = `${FileSystem.cacheDirectory}${document.file_name}`;
    await FileSystem.writeAsStringAsync(fileUri, document.file_data, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return fileUri;
  };

  const openDocument = async () => {
    try {
      const fileUri = await createTempFile();

      if (Platform.OS === 'ios') {
        await WebBrowser.openBrowserAsync(`file://${fileUri}`);
      } else {
        const contentUri = await FileSystem.getContentUriAsync(fileUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: document.file_type,
        });
      }
    } catch (error) {
      console.error('Error opening document:', error);
      Alert.alert(
        'Error',
        'Unable to open the document. Please try again.'
      );
    }
  };

  const shareDocument = async () => {
    try {
      const fileUri = await createTempFile();
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert(
          'Error',
          'Sharing is not available on this device'
        );
      }
    } catch (error) {
      console.error('Error sharing document:', error);
      Alert.alert(
        'Error',
        'Unable to share the document. Please try again.'
      );
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getIconName = (): keyof typeof Ionicons.glyphMap => {
    if (document.file_type.includes('pdf')) return 'document-text';
    if (document.file_type.includes('image')) return 'image';
    return 'document';
  };

  const iconButtonStyle = {
    ...styles.iconButtonBase,
    backgroundColor: isDark ? '#374151' : '#F3F4F6',
  };

  return (
    <View
      className={`flex-row items-center p-4 rounded-lg mb-2 ${
        isDark ? 'bg-gray-700' : 'bg-white'
      }`}
      style={styles.documentCard}
    >
      <View className="mr-4">
        <Ionicons
          name={getIconName()}
          size={24}
          color={isDark ? '#60A5FA' : '#3B82F6'}
        />
      </View>
      <View className="flex-1">
        <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {document.file_name}
        </Text>
        <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
          {formatFileSize(document.file_size)}
        </Text>
      </View>
      <View className="flex-row">
        <TouchableOpacity 
          onPress={openDocument}
          className="mr-4"
          style={iconButtonStyle}
        >
          <Ionicons
            name="eye-outline"
            size={20}
            color={isDark ? '#9CA3AF' : '#6B7280'}
          />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={shareDocument}
          style={iconButtonStyle}
        >
          <Ionicons
            name="share-social-outline"
            size={20}
            color={isDark ? '#9CA3AF' : '#6B7280'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  documentCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconButtonBase: {
    padding: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
}); 