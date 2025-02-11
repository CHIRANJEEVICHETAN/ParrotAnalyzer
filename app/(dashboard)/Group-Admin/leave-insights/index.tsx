import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../context/ThemeContext';
import LeaveRequests from './components/LeaveRequests';
import LeaveBalance from './components/LeaveBalance';
import { useRouter } from 'expo-router';

type Tab = 'requests' | 'balance';

export default function GroupAdminLeaveInsights() {
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const router = useRouter();

  const tabs = [
    { id: 'requests', label: 'Leave Requests', icon: 'document-text' },
    { id: 'balance', label: 'Leave Balance', icon: 'calendar' },
  ] as const;

  return (
    <View className="flex-1 p-6">
      {/* Header */}
      <View className="flex-row items-center mb-6 gap-4">
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
        <View>
          <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Leave Insights
          </Text>
          <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            Insights on leave requests and balances
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View className={`flex-row rounded-lg mb-6 p-1 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            className={`flex-1 flex-row items-center justify-center p-3 space-x-2 rounded-lg ${
              activeTab === tab.id
                ? isDark
                  ? 'bg-gray-700'
                  : 'bg-white'
                : ''
            }`}
          >
            <Ionicons
              name={tab.icon as any}
              size={20}
              color={
                activeTab === tab.id
                  ? isDark
                    ? '#FFFFFF'
                    : '#111827'
                  : isDark
                  ? '#9CA3AF'
                  : '#6B7280'
              }
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
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View className="flex-1">
        {activeTab === 'requests' ? (
          <LeaveRequests />
        ) : (
          <LeaveBalance />
        )}
      </View>
    </View>
  );
} 