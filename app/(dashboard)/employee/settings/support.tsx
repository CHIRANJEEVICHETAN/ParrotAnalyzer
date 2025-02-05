import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import axios from 'axios';

interface SupportOption {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  action: () => void;
}

export default function Support() {
  const { theme } = ThemeContext.useTheme();
  const { user, token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supportOptions: SupportOption[] = [
    {
      title: 'Email Support',
      description: 'Send us an email and we\'ll respond within 24 hours',
      icon: 'mail-outline',
      action: () => {
        const emailSubject = encodeURIComponent(subject || 'Support Request');
        const emailBody = encodeURIComponent(message || '');
        Linking.openURL(
          `mailto:parrotanalyzer@gmail.com?subject=${emailSubject}&body=${emailBody}`
        );
      }
    },
    {
      title: 'Live Chat',
      description: 'Chat with our AI support assistant',
      icon: 'chatbubbles-outline',
      action: () => router.push('/employee/settings/LiveChat')
    },
    {
      title: 'Help Center',
      description: 'Browse our help articles and FAQs',
      icon: 'help-circle-outline',
      action: () => router.push('/employee/settings/help')
    },
    {
      title: 'Phone Support',
      description: 'Call us at +1-800-PARROT1',
      icon: 'call-outline',
      action: () => {
        Linking.openURL('tel:+18007277681');
      }
    },
  ];

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Error', 'Please fill in both subject and message');
      return;
    }

    setIsSubmitting(true);
    try {
      // Send to backend
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/users/support-message`,
        {
          subject: subject.trim(),
          message: message.trim()
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      Alert.alert(
        'Success',
        'Your support request has been submitted. We\'ll get back to you soon!',
        [
          {
            text: 'OK',
            onPress: () => {
              setSubject('');
              setMessage('');
            },
          },
        ]
      );
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to submit support request';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
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
            Contact Support
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView 
        className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
        showsVerticalScrollIndicator={false}
      >
        {/* Support Options */}
        <View className="p-4">
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            How can we help you?
          </Text>
          <View className="flex-row flex-wrap">
            {supportOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                onPress={option.action}
                className={`w-1/2 p-2`}
              >
                <View 
                  className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                  style={styles.optionCard}
                >
                  <View 
                    className={`w-12 h-12 rounded-full items-center justify-center mb-3 ${
                      isDark ? 'bg-blue-900/50' : 'bg-blue-100'
                    }`}
                  >
                    <Ionicons
                      name={option.icon}
                      size={24}
                      color={isDark ? '#60A5FA' : '#3B82F6'}
                    />
                  </View>
                  <Text className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {option.title}
                  </Text>
                  <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {option.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Contact Form */}
        <View className={`m-4 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={styles.formCard}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Send us a message
          </Text>
          
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Subject
            </Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="What's your issue about?"
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              className={`p-4 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'}`}
              style={styles.input}
            />
          </View>

          <View className="mb-6">
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Message
            </Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Describe your issue..."
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              multiline
              numberOfLines={4}
              className={`p-4 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'}`}
              style={[styles.input, styles.textArea]}
            />
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            className={`p-4 rounded-lg bg-blue-500 ${isSubmitting ? 'opacity-50' : ''}`}
            style={styles.submitButton}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-lg">
                Submit Request
              </Text>
            )}
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
  optionCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    height: 160,
  },
  formCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  submitButton: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});
