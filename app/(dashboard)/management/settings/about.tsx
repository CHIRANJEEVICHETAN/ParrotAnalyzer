import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, StatusBar as RNStatusBar } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function AboutScreen() {
  const router = useRouter();
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === 'dark';

  const features = [
    {
      id: '1',
      title: 'Team Management',
      description: 'View and manage your team members, assign roles, and track their activities.',
      icon: 'group',
    },
    {
      id: '2',
      title: 'Notifications',
      description: 'Stay informed with real-time updates on team progress, approvals, and other important alerts.',
      icon: 'notifications',
    },
    {
      id: '3',
      title: 'Report Settings',
      description: 'Customize report preferences to generate insightful data tailored to your needs.',
      icon: 'description',
    },
    {
      id: '4',
      title: 'Privacy Settings',
      description: 'Control the level of data visibility and sharing within the organization.',
      icon: 'security',
    },
    {
      id: '5',
      title: 'Analytics',
      description: 'Access detailed analytics and performance reports to monitor trends and make informed decisions.',
      icon: 'analytics',
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#111827' : '#F3F4F6' }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Header */}
      <View style={[
        styles.header,
        {
          backgroundColor: isDark ? '#111827' : '#FFFFFF',
          borderBottomColor: isDark ? '#374151' : '#E5E7EB',
          marginTop: Platform.OS === 'ios' ? 35 : 25,
        }
      ]}>
        <View className="flex-row items-center px-4" style={{ paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
          >
            <MaterialIcons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
          <Text className={`text-2xl font-semibold ml-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            About
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {/* Introduction Card */}
        <View 
          style={[styles.card, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}
          className="p-4 rounded-xl mb-6"
        >
          <Text className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            About the Management Personal Page
          </Text>
          <Text className={`text-base leading-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            The Management Personal Page in Parrot Analyzer is designed to empower individuals with oversight and control over team operations. This page provides access to key management features, enabling efficient tracking, team management, and report generation.
          </Text>
        </View>

        {/* Key Features Section */}
        <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Key Features
        </Text>

        {features.map((feature) => (
          <View
            key={feature.id}
            style={[styles.card, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}
            className="mb-4 p-4 rounded-xl"
          >
            <View className="flex-row items-center mb-3">
              <View className={`w-12 h-12 rounded-full items-center justify-center ${
                isDark ? 'bg-gray-800' : 'bg-blue-50'
              }`}>
                <MaterialIcons name={feature.icon as any} size={24} color="#3B82F6" />
              </View>
              <Text className={`text-lg font-semibold ml-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {feature.title}
              </Text>
            </View>
            <Text className={`${isDark ? 'text-gray-300' : 'text-gray-600'} text-base leading-6`}>
              {feature.description}
            </Text>
          </View>
        ))}

        {/* Bottom Text */}
        <View 
          style={[styles.card, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}
          className="p-4 rounded-xl mb-6"
        >
          <Text className={`text-base leading-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            This page is built to provide management personnel with a seamless experience to oversee and optimize team functions, ensuring smooth workflow and data-driven decision-making.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === 'ios' ? 44 : RNStatusBar.currentHeight || 20,
    borderBottomWidth: 1,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});
