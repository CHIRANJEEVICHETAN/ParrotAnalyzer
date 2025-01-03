import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Platform, StatusBar as RNStatusBar, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import { StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ReportSettings {
  reportTitle: string;
  reportFormat: 'PDF' | 'Excel' | 'CSV';
  includeExpenseDetails: boolean;
  showLocationHistory: boolean;
  includeAttachments: boolean;
  footerNotes: string;
}

const defaultSettings: ReportSettings = {
  reportTitle: 'Expense Report',
  reportFormat: 'PDF',
  includeExpenseDetails: true,
  showLocationHistory: false,
  includeAttachments: true,
  footerNotes: '',
};

export default function ReportSettingsScreen() {
  const router = useRouter();
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === 'dark';

  const [settings, setSettings] = useState<ReportSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('reportSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      RNStatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
    } else {
      RNStatusBar.setBackgroundColor(isDark ? '#1F2937' : '#FFFFFF');
      RNStatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
    }
  }, [isDark]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // API call would go here
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert('Success', 'Report settings saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset',
          onPress: () => setSettings(defaultSettings),
          style: 'destructive'
        }
      ]
    );
  };

  const toggleSetting = async (key: keyof ReportSettings) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key]
    };
    setSettings(newSettings);
    try {
      await AsyncStorage.setItem('reportSettings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#111827' : '#F3F4F6' }}>
      <RNStatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
      />
      {/* Header */}
      <LinearGradient
        colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        style={[
          styles.header,
          { paddingTop: Platform.OS === 'ios' ? 60 : (RNStatusBar.currentHeight || 0) + 10 }
        ]}
      >
        <View className="flex-row items-center px-4" style={{ paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
          >
            <MaterialIcons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
          <Text className={`text-2xl font-semibold ml-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Report Settings
          </Text>
        </View>
      </LinearGradient>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Basic Settings */}
        <View style={[styles.section, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Basic Settings
          </Text>
          
          <View className="mb-4">
            <Text className={`mb-2 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Report Title
            </Text>
            <TextInput
              value={settings.reportTitle}
              onChangeText={(text) => setSettings(prev => ({ ...prev, reportTitle: text }))}
              className={`p-3 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'}`}
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              style={styles.input}
            />
          </View>

          <View className="mb-4">
            <Text className={`mb-2 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Report Format
            </Text>
            <View className={`rounded-lg overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <Picker
                selectedValue={settings.reportFormat}
                onValueChange={(value) => setSettings(prev => ({ ...prev, reportFormat: value }))}
                style={{ color: isDark ? '#FFFFFF' : '#111827' }}
              >
                <Picker.Item label="PDF" value="PDF" />
                <Picker.Item label="Excel" value="Excel" />
                <Picker.Item label="CSV" value="CSV" />
              </Picker>
            </View>
          </View>
        </View>

        {/* Content Settings */}
        <View style={[styles.section, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Content Settings
          </Text>

          {[
            { key: 'includeExpenseDetails', label: 'Include Expense Details', icon: 'description' as const },
            { key: 'showLocationHistory', label: 'Show Location History', icon: 'place' as const },
            { key: 'includeAttachments', label: 'Include Attachments', icon: 'attachment' as const },
          ].map(({ key, label, icon }) => (
            <TouchableOpacity
              key={key}
              onPress={() => toggleSetting(key as keyof ReportSettings)}
              className="flex-row items-center justify-between py-3"
            >
              <View className="flex-row items-center">
                <View className={`w-10 h-10 rounded-full items-center justify-center ${
                  isDark ? 'bg-gray-700' : 'bg-gray-100'
                }`}>
                  <MaterialIcons name={icon} size={20} color="#3B82F6" />
                </View>
                <Text className={`ml-3 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {label}
                </Text>
              </View>
              <View style={[
                styles.toggle,
                { backgroundColor: settings[key as keyof ReportSettings] ? '#3B82F6' : isDark ? '#374151' : '#E5E7EB' }
              ]}>
                <View style={[
                  styles.toggleButton,
                  { 
                    transform: [{ translateX: settings[key as keyof ReportSettings] ? 24 : 2 }],
                    backgroundColor: settings[key as keyof ReportSettings] ? '#FFFFFF' : isDark ? '#9CA3AF' : '#FFFFFF'
                  }
                ]} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer Notes */}
        <View style={[styles.section, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Additional Settings
          </Text>
          
          <View className="mb-4">
            <Text className={`mb-2 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Footer Notes
            </Text>
            <TextInput
              value={settings.footerNotes}
              onChangeText={(text) => setSettings(prev => ({ ...prev, footerNotes: text }))}
              multiline
              numberOfLines={4}
              className={`p-3 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'}`}
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View className="flex-row justify-between mb-6 mt-4">
          <TouchableOpacity
            onPress={handleReset}
            className={`flex-1 p-4 rounded-lg mr-2 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            style={styles.button}
          >
            <Text className="text-center font-semibold text-gray-500">
              Reset to Default
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            className="flex-1 p-4 rounded-lg ml-2 bg-blue-500"
            style={styles.button}
          >
            <Text className="text-center font-semibold text-white">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Text>
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
    paddingBottom: 16,
  },
  backButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  section: {
    borderRadius: 12,
    marginTop: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toggle: {
    width: 48,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  toggleButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
    elevation: 1,
  },
  button: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});
