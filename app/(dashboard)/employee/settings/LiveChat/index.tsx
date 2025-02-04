import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Text,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import ChatMessage from './components/ChatMessage';
import axios from 'axios';
import Markdown from 'react-native-markdown-display';

const suggestedQueries = [
  "How do I track my work hours?",
  "How to submit travel expenses?",
  "What is geofencing and how does it work?",
  "How to view my shift analytics?",
  "How to upload receipts for expenses?",
  "How to check my travel distance?"
];

interface ChatMessage {
  id: string;
  message: string;
  isUser: boolean;
  created_at: string;
}

interface StreamingMessage extends ChatMessage {
  isStreaming?: boolean;
}

export default function LiveChat() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';
  const flatListRef = useRef<FlatList>(null);

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [chatId, setChatId] = useState(Date.now().toString());
  const [streamingMessage, setStreamingMessage] = useState<string>('');

  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/chat/history`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      // Transform the history data to include IDs
      const historyWithIds = response.data.map((msg: any, index: number) => ({
        id: `history-${index}`,
        message: msg.message,
        isUser: true,
        created_at: msg.created_at,
      })).concat(response.data.map((msg: any, index: number) => ({
        id: `history-response-${index}`,
        message: msg.response,
        isUser: false,
        created_at: msg.created_at,
      })));
      setMessages(historyWithIds);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const appendToLastMessage = (text: string) => {
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && !lastMessage.isUser) {
        return [
          ...prev.slice(0, -1),
          { ...lastMessage, message: lastMessage.message + text }
        ];
      }
      return prev;
    });
  };

  const sendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setMessage('');
    setIsLoading(true);
    setShowSuggestions(false);

    const newMessageId = Date.now().toString();
    
    // Add user message immediately
    const userMessageObj: StreamingMessage = {
      id: `msg-${newMessageId}`,
      message: userMessage,
      isUser: true,
      created_at: new Date().toISOString()
    };
    
    // Add placeholder for AI response
    const aiPlaceholder: StreamingMessage = {
      id: `response-${newMessageId}`,
      message: '',
      isUser: false,
      created_at: new Date().toISOString(),
      isStreaming: true
    };
    
    setMessages(prev => [...prev, userMessageObj, aiPlaceholder]);

    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/chat/send-message`,
        { message: userMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update AI response
      setMessages(prev => prev.map(msg => 
        msg.id === `response-${newMessageId}`
          ? {
              ...msg,
              message: response.data.message,
              isStreaming: false,
              created_at: response.data.timestamp || msg.created_at
            }
          : msg
      ));

      flatListRef.current?.scrollToEnd();
    } catch (error: any) {
      console.error('Error sending message:', error.response?.data || error);
      Alert.alert(
        'Error',
        error.response?.data?.details || 'Failed to send message. Please try again.'
      );
      // Remove both messages if AI response fails
      setMessages(prev => prev.filter(msg => 
        msg.id !== `msg-${newMessageId}` && msg.id !== `response-${newMessageId}`
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuery = (query: string) => {
    setMessage(query);
    sendMessage();
  };

  const startNewChat = () => {
    setChatId(Date.now().toString());
    setMessages([]);
    setShowSuggestions(true);
  };

  const renderMessage = ({ item }: { item: StreamingMessage }) => (
    <ChatMessage
      message={item.message}
      isUser={item.isUser}
      timestamp={new Date(item.created_at)}
      isDark={isDark}
      isStreaming={item.isStreaming}
    />
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <LinearGradient
        colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        className="flex-1"
      >
        {/* Enhanced Header */}
        <View className={`px-4 py-3 border-b ${
          isDark ? 'border-gray-800' : 'border-gray-200'
        }`}>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center space-x-3">
              <TouchableOpacity
                onPress={() => router.back()}
                className={`p-2 rounded-full ${
                  isDark ? 'bg-gray-800' : 'bg-gray-100'
                }`}
              >
                <Ionicons 
                  name="arrow-back" 
                  size={24} 
                  color={isDark ? '#FFFFFF' : '#000000'} 
                />
              </TouchableOpacity>
              <View>
                <Text className={`text-lg font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  AI Support Assistant
                </Text>
                <Text className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {isLoading ? 'Typing...' : 'Online'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={startNewChat}
              className={`p-2 rounded-full ${
                isDark ? 'bg-gray-800' : 'bg-gray-100'
              }`}
            >
              <Ionicons 
                name="create-outline" 
                size={24} 
                color={isDark ? '#60A5FA' : '#3B82F6'} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Chat Messages */}
        <View className="flex-1">
          {messages.length === 0 && showSuggestions ? (
            <ScrollView 
              className="p-4"
              showsVerticalScrollIndicator={false}
            >
              <Text className={`text-lg font-semibold mb-4 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Suggested Questions
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {suggestedQueries.map((query, index) => (
                  <TouchableOpacity
                    key={`${chatId}-query-${index}`}
                    onPress={() => handleSuggestedQuery(query)}
                    className={`rounded-full px-4 py-2 mb-2 ${
                      isDark ? 'bg-gray-800' : 'bg-blue-50'
                    }`}
                  >
                    <Text className={isDark ? 'text-blue-400' : 'text-blue-600'}>
                      {query}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View className="items-center mt-6 p-4">
                <View className={`rounded-full p-4 ${
                  isDark ? 'bg-gray-800' : 'bg-blue-50'
                }`}>
                  <Ionicons 
                    name="chatbubble-ellipses" 
                    size={32} 
                    color={isDark ? '#60A5FA' : '#3B82F6'} 
                  />
                </View>
                <Text className={`text-center mt-4 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Ask me anything about Parrot Analyzer!
                </Text>
              </View>
            </ScrollView>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item.id}
              renderItem={renderMessage}
              className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
              contentContainerStyle={{ paddingVertical: 16 }}
            />
          )}
        </View>

        {/* Input Area */}
        <View 
          className={`p-4 ${isDark ? 'bg-gray-800' : 'bg-white'} border-t ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          <View className="flex-row items-center space-x-2">
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Type your message..."
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              className={`flex-1 px-4 py-2 rounded-full ${
                isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
              }`}
              style={styles.input}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={isLoading || !message.trim()}
              className={`p-3 rounded-full ${
                message.trim() ? 'bg-blue-500' : 'bg-gray-400'
              } ${styles.sendButton}`}
              style={styles.elevation}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Ionicons name="send" size={24} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: {
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  elevation: {
    elevation: 5,
  },
}); 