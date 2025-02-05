import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Platform, StatusBar as RNStatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../context/ThemeContext';
import LeaveTypes from './components/LeaveTypes';
import LeavePolicies from './components/LeavePolicies';
import LeaveAnalytics from './components/LeaveAnalytics';
import { StyleSheet } from 'react-native';

type TabType = 'types' | 'policies' | 'analytics';

export default function LeaveManagement() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<TabType>('types');

  // Calculate status bar height for different platforms
  const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : RNStatusBar.currentHeight || 0;

  const tabs = [
    { id: 'types', label: 'Leave Types', icon: 'list' },
    { id: 'policies', label: 'Policies', icon: 'settings' },
    { id: 'analytics', label: 'Analytics', icon: 'analytics' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'types':
        return <LeaveTypes />;
      case 'policies':
        return <LeavePolicies />;
      case 'analytics':
        return <LeaveAnalytics />;
      default:
        return null;
    }
  };

  return (
    <View className="flex-1">
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
      />

      {/* Header with proper status bar spacing */}
      <View 
        className={`${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
        style={{ paddingTop: STATUSBAR_HEIGHT }}
      >
        <View className="flex-row items-center justify-between px-4 py-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
          >
            <Ionicons 
              name="arrow-back" 
              size={24} 
              color={isDark ? '#FFFFFF' : '#111827'} 
            />
          </TouchableOpacity>
          <Text 
            className={`text-xl font-semibold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Leave Management
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="px-4 pb-4"
          contentContainerStyle={{ paddingRight: 16 }}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id as TabType)}
              className={`flex-row items-center px-4 py-3 mr-4 rounded-lg ${
                activeTab === tab.id
                  ? isDark
                    ? 'bg-blue-500'
                    : 'bg-blue-500'
                  : isDark
                  ? 'bg-gray-700'
                  : 'bg-gray-100'
              }`}
              style={styles.tabButton}
            >
              <Ionicons
                name={tab.icon as any}
                size={20}
                color={activeTab === tab.id ? '#FFFFFF' : isDark ? '#9CA3AF' : '#4B5563'}
                style={{ marginRight: 8 }}
              />
              <Text
                className={`font-medium ${
                  activeTab === tab.id
                    ? 'text-white'
                    : isDark
                    ? 'text-gray-300'
                    : 'text-gray-600'
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView 
        className="flex-1 px-4 py-6"
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabButton: {
    marginRight: 16,
  }
}); 