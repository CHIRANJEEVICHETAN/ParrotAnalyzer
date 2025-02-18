import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../context/ThemeContext';
import LeaveRequests from './components/LeaveRequests';
import LeavePolicies from './components/LeavePolicies';
import LeaveBalances from './components/LeaveBalances';
import { useRouter } from 'expo-router';

type Tab = 'requests' | 'balances' | 'policies';

export default function EmployeeLeaveInsights() {
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const router = useRouter();
  const screenWidth = Dimensions.get('window').width;
  const tabWidth = 150; // Fixed width for each tab

  const tabs = [
    { id: 'requests', label: 'Leave Requests', icon: 'document-text' },
    { id: 'balances', label: 'Leave Balances', icon: 'calendar' },
    { id: 'policies', label: 'Leave Policies', icon: 'information-circle' },
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
      <View className={`mb-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ 
            padding: 4,
          }}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              className={`flex-row items-center justify-center p-3 rounded-lg mr-2 ${
                activeTab === tab.id
                  ? isDark
                    ? 'bg-gray-700'
                    : 'bg-white'
                  : ''
              }`}
              style={{ width: tabWidth }}
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
                style={{ marginRight: 8 }}
              />
              <Text
                className={`font-medium text-sm ${
                  activeTab === tab.id
                    ? isDark
                      ? 'text-white'
                      : 'text-gray-900'
                    : isDark
                    ? 'text-gray-400'
                    : 'text-gray-600'
                }`}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <View className="flex-1">
        {activeTab === 'requests' ? (
          <LeaveRequests />
        ) : activeTab === 'balances' ? (
          <LeaveBalances />
        ) : (
          <LeavePolicies />
        )}
      </View>
    </View>
  );
} 