import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';

interface Section {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  content: {
    heading: string;
    text: string;
  }[];
}

export default function Terms() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';

  const sections: Section[] = [
    {
      title: 'Terms of Service',
      icon: 'document-text-outline',
      content: [
        {
          heading: 'Acceptance of Terms',
          text: 'By accessing and using Parrot Analyzer, you agree to be bound by these terms and conditions. If you disagree with any part of these terms, you may not access the service.',
        },
        {
          heading: 'User Accounts',
          text: 'You are responsible for safeguarding your account credentials and for any activities or actions under your account. You must immediately notify us of any unauthorized uses of your account.',
        },
        {
          heading: 'Service Usage',
          text: 'Our service must be used in accordance with applicable laws and regulations. Any misuse or unauthorized access may result in immediate termination of your account.',
        },
        {
          heading: 'Modifications to Service',
          text: 'We reserve the right to modify or discontinue, temporarily or permanently, the service with or without notice. We shall not be liable for any modification, suspension, or discontinuance of the service.',
        },
      ],
    },
    {
      title: 'Privacy Policy',
      icon: 'shield-checkmark-outline',
      content: [
        {
          heading: 'Data Collection',
          text: 'We collect information that you provide directly to us, including but not limited to your name, email address, phone number, and any other information you choose to provide.',
        },
        {
          heading: 'Data Usage',
          text: 'Your data is used to provide and improve our services, communicate with you, and comply with legal obligations. We do not sell your personal information to third parties.',
        },
        {
          heading: 'Data Security',
          text: 'We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.',
        },
        {
          heading: 'Data Retention',
          text: 'We retain your information for as long as your account is active or as needed to provide you services. You can request deletion of your data at any time.',
        },
      ],
    },
    {
      title: 'Cookie Policy',
      icon: 'information-circle-outline',
      content: [
        {
          heading: 'What Are Cookies',
          text: 'Cookies are small text files stored on your device that help us provide and improve our services. They help us understand how you use our application.',
        },
        {
          heading: 'Types of Cookies',
          text: 'We use essential cookies necessary for the application to function, and analytical cookies to understand how you use our service.',
        },
      ],
    },
  ];

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
            Terms & Privacy
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView 
        className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
        showsVerticalScrollIndicator={false}
      >
        <View className="p-4">
          {sections.map((section, sectionIndex) => (
            <View 
              key={sectionIndex} 
              className={`mb-6 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              style={styles.sectionCard}
            >
              <View className="flex-row items-center mb-4">
                <View 
                  className={`w-10 h-10 rounded-full items-center justify-center ${
                    isDark ? 'bg-blue-900/50' : 'bg-blue-100'
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

              {section.content.map((item, itemIndex) => (
                <View 
                  key={itemIndex} 
                  className={`mb-4 ${
                    itemIndex === section.content.length - 1 ? 'mb-0' : ''
                  }`}
                >
                  <Text 
                    className={`text-base font-semibold mb-2 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    {item.heading}
                  </Text>
                  <Text 
                    className={`text-sm leading-6 ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    {item.text}
                  </Text>
                </View>
              ))}
            </View>
          ))}

          {/* Contact Section */}
          <View 
            className={`mb-6 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            style={styles.sectionCard}
          >
            <Text 
              className={`text-base font-semibold mb-4 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Need More Information?
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/employee/settings/support')}
              className={`flex-row items-center justify-center p-4 rounded-lg ${
                isDark ? 'bg-blue-900' : 'bg-blue-500'
              }`}
              style={styles.contactButton}
            >
              <Ionicons name="mail-outline" size={24} color="white" />
              <Text className="ml-2 text-white font-semibold">
                Contact Support
              </Text>
            </TouchableOpacity>
          </View>

          {/* Last Updated */}
          <Text 
            className={`text-center text-sm mb-6 ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            Last updated: December 27, 2024
          </Text>
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
  sectionCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  contactButton: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});
