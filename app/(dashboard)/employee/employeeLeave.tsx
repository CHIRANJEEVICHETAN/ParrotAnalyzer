import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../context/ThemeContext';
import LeaveRequests from './leave-insights/components/LeaveRequests';
import LeaveApprovals from './leave-insights/components/LeaveApprovals';
import LeavePolicies from './leave-insights/components/LeavePolicies';

type Tab = 'requests' | 'approvals' | 'policies';

export default function EmployeeLeave() {
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const router = useRouter();

  const tabs = [
    { id: 'requests', label: 'Leave Requests', icon: 'document-text' },
    { id: 'approvals', label: 'Approvals', icon: 'checkmark-circle' },
    { id: 'policies', label: 'Leave Policies', icon: 'information-circle' },
  ] as const;

  return (
    <View className="flex-1">
      {/* Status Bar */}
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Header */}
      <View 
        className={`pt-12 px-4 pb-4 ${isDark ? 'bg-gray-900' : 'bg-white'}`}
        style={styles.header}
      >
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className={`p-2 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
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
          <View style={{ width: 40 }} /> {/* Spacer for alignment */}
        </View>
      </View>

      {/* Tabs */}
      <View 
        className={`flex-row justify-between px-4 py-2 ${
          isDark ? 'bg-gray-900' : 'bg-white'
        }`}
      >
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            className={`flex-row items-center py-2 px-4 rounded-lg ${
              activeTab === tab.id
                ? isDark
                  ? 'bg-gray-800'
                  : 'bg-gray-100'
                : 'bg-transparent'
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
              className={`ml-2 font-medium ${
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
      <View className="flex-1 px-4 py-2">
        {activeTab === 'requests' ? (
          <LeaveRequests />
        ) : activeTab === 'approvals' ? (
          <LeaveApprovals />
        ) : (
          <LeavePolicies />
        )}
      </View>
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
  }
});
