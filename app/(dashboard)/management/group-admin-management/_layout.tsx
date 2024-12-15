import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../context/ThemeContext';

export default function GroupAdminsLayout() {
  const { theme } = ThemeContext.useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,  // Hide the tab screen headers
        tabBarStyle: {
          backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: theme === 'dark' ? '#374151' : '#E5E7EB',
        },
        tabBarActiveTintColor: theme === 'dark' ? '#60A5FA' : '#3B82F6',
        tabBarInactiveTintColor: theme === 'dark' ? '#9CA3AF' : '#6B7280',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Group Admins',
          tabBarIcon: ({ color }) => <Ionicons name="people" size={24} color={color} />,
          tabBarLabel: 'List',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="individual"
        options={{
          title: 'Add Individual',
          tabBarIcon: ({ color }) => <Ionicons name="person-add" size={24} color={color} />,
          tabBarLabel: 'Add',
        }}
      />
      <Tabs.Screen
        name="bulk"
        options={{
          title: 'Bulk Upload',
          tabBarIcon: ({ color }) => <Ionicons name="cloud-upload" size={24} color={color} />,
          tabBarLabel: 'Bulk',
        }}
      />
    </Tabs>
  );
}
