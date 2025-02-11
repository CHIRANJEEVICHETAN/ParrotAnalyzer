import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../../context/ThemeContext';
import LeaveBalanceTracker from './components/LeaveBalanceTracker';
import LeaveRequests from './components/LeaveRequests';

type TabType = 'requests' | 'tracker';

interface TabItem {
  id: TabType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export default function LeaveInsights() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<TabType>('requests');

  const tabs: TabItem[] = [
    {
      id: 'requests',
      label: 'Leave Requests',
      icon: 'document-text-outline',
      activeIcon: 'document-text',
      color: '#3B82F6'
    },
    {
      id: 'tracker',
      label: 'Balance Tracker',
      icon: 'hourglass-outline',
      activeIcon: 'hourglass',
      color: '#F59E0B'
    }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'requests':
        return <LeaveRequests />;
      case 'tracker':
        return <LeaveBalanceTracker />;
      default:
        return null;
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#F9FAFB' }}>
      <StatusBar 
        style={isDark ? 'light' : 'dark'} 
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'} 
        translucent 
      />

      {/* Header with proper status bar spacing */}
      <LinearGradient
        colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        className="shadow-sm"
        style={{
          paddingTop: Platform.OS === 'ios' ? RNStatusBar.currentHeight || 44 : RNStatusBar.currentHeight || 0,
        }}
      >
        <View className="flex-row items-center justify-between px-6 py-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className={`p-2 rounded-full ${isDark ? 'bg-gray-800/80' : 'bg-gray-100'}`}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 1.41,
              elevation: 2,
            }}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#E5E7EB' : '#374151'} />
          </TouchableOpacity>
          <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Leave Insights
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Enhanced Tabs */}
        <View className="flex-row px-4 pb-4">
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              className={`flex-1 flex-row items-center justify-center px-4 py-3 mx-2 rounded-xl ${
                activeTab === tab.id
                  ? isDark
                    ? 'bg-gray-800'
                    : 'bg-white'
                  : isDark
                  ? 'bg-gray-800/50'
                  : 'bg-gray-100'
              }`}
              style={{
                shadowColor: activeTab === tab.id ? tab.color : '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: activeTab === tab.id ? 0.3 : 0.1,
                shadowRadius: activeTab === tab.id ? 3.84 : 1,
                elevation: activeTab === tab.id ? 5 : 1,
              }}
            >
              <Ionicons
                name={activeTab === tab.id ? tab.activeIcon : tab.icon}
                size={20}
                color={activeTab === tab.id ? tab.color : isDark ? '#9CA3AF' : '#6B7280'}
                style={{ marginRight: 8 }}
              />
              <Text
                className={`font-medium ${
                  activeTab === tab.id
                    ? isDark
                      ? 'text-white'
                      : 'text-gray-900'
                    : isDark
                    ? 'text-gray-400'
                    : 'text-gray-600'
                }`}
                style={activeTab === tab.id ? { color: tab.color } : {}}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView 
        className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingVertical: 20,
        }}
      >
        {renderContent()}
      </ScrollView>
    </View>
  );
} 