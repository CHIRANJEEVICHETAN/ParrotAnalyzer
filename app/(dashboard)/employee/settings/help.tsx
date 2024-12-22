import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Linking,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';

interface HelpSection {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: {
    question: string;
    answer: string;
  }[];
}

export default function Help() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');

  const helpSections: HelpSection[] = [
    {
      title: 'Getting Started',
      icon: 'rocket-outline',
      items: [
        {
          question: 'How do I submit an expense claim?',
          answer: 'Navigate to the Expenses tab, click on "New Expense", fill in the required details including receipts, and submit for approval.',
        },
        {
          question: 'How do I view my schedule?',
          answer: 'Access your schedule from the Schedule tab. You can view daily, weekly, or monthly schedules and manage your appointments.',
        },
        {
          question: 'How do I navigate the dashboard?',
          answer: 'The dashboard shows your key metrics, recent activities, and quick access to common tasks. Use the bottom navigation to switch between different sections.',
        },
      ],
    },
    {
      title: 'Expense Management',
      icon: 'cash-outline',
      items: [
        {
          question: 'What expenses can I claim?',
          answer: 'You can claim travel expenses, lodging, daily allowances, diesel costs, toll charges, and other business-related expenses approved by your organization.',
        },
        {
          question: 'How do I attach receipts?',
          answer: 'When creating an expense claim, tap the "Add Receipt" button to upload images of your receipts. You can take a photo or choose from your gallery.',
        },
        {
          question: 'How long does expense approval take?',
          answer: 'Typically, expenses are reviewed within 2-3 business days. You can track the status of your claims in the Expenses section.',
        },
      ],
    },
    {
      title: 'Schedule & Planning',
      icon: 'calendar-outline',
      items: [
        {
          question: 'How do I add a new schedule entry?',
          answer: 'Go to the Schedule tab, tap the "+" button, and fill in the event details including title, location, date, and time.',
        },
        {
          question: 'Can I set reminders for scheduled events?',
          answer: 'Yes, when creating or editing a schedule entry, you can enable notifications and set reminder times.',
        },
        {
          question: 'How do I share my schedule?',
          answer: 'Select the schedule entry and use the share button to send it to team members or export it to your calendar.',
        },
      ],
    },
    {
      title: 'Account Management',
      icon: 'person-circle-outline',
      items: [
        {
          question: 'How do I update my profile?',
          answer: 'Go to Settings, select "Edit Profile" to update your personal information and profile picture.',
        },
        {
          question: 'How do I change my password?',
          answer: 'In Settings, choose "Change Password". Enter your current password and set a new one following the security guidelines.',
        },
        {
          question: 'What are the password requirements?',
          answer: 'Passwords must be at least 8 characters long and include uppercase, lowercase, numbers, and special characters.',
        },
      ],
    },
    {
      title: 'Technical Support',
      icon: 'construct-outline',
      items: [
        {
          question: 'What should I do if the app is not working?',
          answer: 'Try closing and reopening the app. If the issue persists, clear the app cache or contact technical support.',
        },
        {
          question: 'How do I report a bug?',
          answer: 'Use the "Contact Support" option in Settings to report any issues. Include screenshots and steps to reproduce the problem.',
        },
        {
          question: 'How do I update the app?',
          answer: 'The app updates automatically through your device\'s app store. Ensure you have automatic updates enabled for the best experience.',
        },
      ],
    },
    {
      title: 'Data & Privacy',
      icon: 'shield-checkmark-outline',
      items: [
        {
          question: 'How is my data protected?',
          answer: 'We use industry-standard encryption and security measures to protect your data. All information is stored securely on our servers.',
        },
        {
          question: 'Can I download my data?',
          answer: 'Yes, you can request a download of your data from the Settings menu under Privacy options.',
        },
        {
          question: 'Who can see my information?',
          answer: 'Your information is only visible to authorized personnel within your organization based on their access levels.',
        },
      ],
    },
  ];

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return helpSections;

    const query = searchQuery.toLowerCase().trim();
    return helpSections.map(section => ({
      ...section,
      items: section.items.filter(item =>
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query)
      ),
    })).filter(section => section.items.length > 0);
  }, [searchQuery, helpSections]);

  const contactSupport = () => {
    Linking.openURL('mailto:support@parrotanalyzer.com?subject=Help%20Request');
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        className="pb-4"
        style={[styles.header, { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 0 }]}
      >
        <View className="flex-row items-center justify-between px-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2 rounded-full"
            style={{ backgroundColor: isDark ? '#374151' : '#F3F4F6' }}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
          <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Help Center
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView 
        className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
        showsVerticalScrollIndicator={false}
      >
        <View className="p-4">
          <View 
            className={`flex-row items-center p-3 rounded-xl mb-4 ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
            style={styles.searchBar}
          >
            <Ionicons 
              name="search-outline" 
              size={20} 
              color={isDark ? '#9CA3AF' : '#6B7280'} 
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search help articles..."
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              className={`flex-1 ml-2 ${isDark ? 'text-white' : 'text-gray-900'}`}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons 
                  name="close-circle" 
                  size={20} 
                  color={isDark ? '#9CA3AF' : '#6B7280'} 
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {filteredSections.map((section, index) => (
          <View key={index} className="px-4 mb-6">
            <View className="flex-row items-center mb-4">
              <View 
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  isDark ? 'bg-blue-900' : 'bg-blue-100'
                }`}
              >
                <Ionicons 
                  name={section.icon} 
                  size={24} 
                  color={isDark ? '#60A5FA' : '#3B82F6'} 
                />
              </View>
              <Text 
                className={`ml-3 text-lg font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                {section.title}
              </Text>
            </View>

            {section.items.map((item, itemIndex) => (
              <TouchableOpacity
                key={itemIndex}
                className={`mb-4 p-4 rounded-xl ${
                  isDark ? 'bg-gray-800' : 'bg-white'
                }`}
                style={styles.card}
              >
                <Text 
                  className={`text-base font-semibold mb-2 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {item.question}
                </Text>
                <Text 
                  className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  {item.answer}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {filteredSections.length === 0 && (
          <View className="p-8 items-center">
            <Ionicons 
              name="search-outline" 
              size={48} 
              color={isDark ? '#4B5563' : '#9CA3AF'} 
            />
            <Text 
              className={`mt-4 text-center text-lg ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              No results found for "{searchQuery}"
            </Text>
            <TouchableOpacity 
              onPress={() => setSearchQuery('')}
              className="mt-2"
            >
              <Text className="text-blue-500">
                Clear search
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View className="p-4 mb-6">
          <TouchableOpacity
            onPress={contactSupport}
            className={`flex-row items-center justify-center p-4 rounded-xl ${
              isDark ? 'bg-blue-900' : 'bg-blue-500'
            }`}
            style={styles.supportButton}
          >
            <Ionicons name="mail-outline" size={24} color="white" />
            <Text className="ml-2 text-white font-semibold text-lg">
              Contact Support
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
  },
  searchBar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  supportButton: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});
