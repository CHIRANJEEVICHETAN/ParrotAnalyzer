import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  timestamp: Date;
  isDark: boolean;
  isStreaming?: boolean;
}

export default function ChatMessage({ message, isUser, timestamp, isDark, isStreaming }: ChatMessageProps) {
  const markdownStyles = {
    body: {
      color: isDark ? '#FFFFFF' : '#1F2937',
    },
    heading1: {
      color: isDark ? '#FFFFFF' : '#1F2937',
      fontSize: 20,
      marginBottom: 8,
    },
    heading2: {
      color: isDark ? '#FFFFFF' : '#1F2937',
      fontSize: 18,
      marginBottom: 8,
    },
    paragraph: {
      color: isDark ? '#FFFFFF' : '#1F2937',
      fontSize: 16,
      lineHeight: 24,
    },
    link: {
      color: isDark ? '#60A5FA' : '#3B82F6',
    },
    list_item: {
      color: isDark ? '#FFFFFF' : '#1F2937',
    },
    code_inline: {
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
      color: isDark ? '#60A5FA' : '#3B82F6',
      padding: 4,
      borderRadius: 4,
    },
    code_block: {
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
      padding: 8,
      borderRadius: 8,
      marginVertical: 8,
    },
  };

  return (
    <View style={[
      styles.container,
      isUser ? styles.userContainer : styles.botContainer
    ]}>
      <View style={[
        styles.messageContainer,
        isUser ? styles.userMessage : styles.botMessage,
        isDark ? styles.darkMessage : styles.lightMessage
      ]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Ionicons name="logo-github" size={24} color={isDark ? '#60A5FA' : '#3B82F6'} />
          </View>
        )}
        <View style={styles.textContainer}>
          {isStreaming ? (
            <View style={styles.typingIndicator}>
              <ActivityIndicator size="small" color={isDark ? '#60A5FA' : '#3B82F6'} />
              <Text style={[
                styles.typingText,
                isDark ? styles.darkText : styles.lightText
              ]}>
                Typing...
              </Text>
            </View>
          ) : isUser ? (
            <Text style={[
              styles.messageText,
              isDark ? styles.darkText : styles.lightText
            ]}>
              {message}
            </Text>
          ) : (
            <Markdown style={markdownStyles} mergeStyle={true}>
              {message}
            </Markdown>
          )}
          <Text style={[
            styles.timestamp,
            isDark ? styles.darkTimestamp : styles.lightTimestamp
          ]}>
            {format(timestamp, 'HH:mm')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  botContainer: {
    alignItems: 'flex-start',
  },
  messageContainer: {
    flexDirection: 'row',
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
  },
  userMessage: {
    backgroundColor: '#3B82F6',
  },
  botMessage: {
    backgroundColor: '#F3F4F6',
  },
  darkMessage: {
    backgroundColor: '#374151',
  },
  lightMessage: {
    backgroundColor: '#F3F4F6',
  },
  avatar: {
    marginRight: 8,
    alignSelf: 'flex-start',
  },
  textContainer: {
    flex: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  darkText: {
    color: '#FFFFFF',
  },
  lightText: {
    color: '#1F2937',
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
  },
  darkTimestamp: {
    color: '#9CA3AF',
  },
  lightTimestamp: {
    color: '#6B7280',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  typingText: {
    marginLeft: 8,
    fontSize: 14,
  },
}); 