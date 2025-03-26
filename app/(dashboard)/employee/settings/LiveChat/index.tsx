import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import ChatMessage from './components/ChatMessage';
import axios from 'axios';
import Markdown from 'react-native-markdown-display';

const suggestedQueries = [
  "How do I track my work hours or how to i track my attendance?",
  "How do I submit an expense report?",
  "How do I request leave?",
  "How do I update my profile information?",
  "How do I reset my password?",
  "How do I contact support?",
  "How do I submit a travel expense?"
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

const ScrollIndicatorDot = ({ active, isDark }: { active: boolean; isDark: boolean }) => (
  <View
    style={{
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: active 
        ? isDark ? '#60A5FA' : '#3B82F6'
        : isDark ? '#374151' : '#E5E7EB',
      marginHorizontal: 2,
    }}
  />
);

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
  const [randomSuggestions, setRandomSuggestions] = useState<string[]>([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const CLEANUP_INTERVAL = 1000 * 60 * 5; // 5 minutes
  const INITIAL_CLEANUP_DELAY = 1000 * 30; // 30 seconds

  const cleanupOldMessages = useCallback(async () => {
    try {
      // Remove messages older than 30 minutes from the UI
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      setMessages(prevMessages => 
        prevMessages.filter(msg => 
          new Date(msg.created_at) > thirtyMinutesAgo
        )
      );

      // Only attempt server cleanup if we have messages to clean
      if (messages.length > 0) {
        await axios.delete(
          `${process.env.EXPO_PUBLIC_API_URL}/api/chat/cleanup-old-messages`,
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Silently handle 404 errors - no need to log these
        return;
      }
      console.error('Error cleaning up old messages:', error);
    }
  }, [token, messages.length]);

  useEffect(() => {
    // Delay the initial cleanup
    const initialCleanupTimeout = setTimeout(() => {
      cleanupOldMessages();
      
      // Set up interval for periodic cleanup after initial cleanup
      const intervalId = setInterval(cleanupOldMessages, CLEANUP_INTERVAL);
      
      // Cleanup both timeout and interval on unmount
      return () => {
        clearInterval(intervalId);
        clearTimeout(initialCleanupTimeout);
      };
    }, INITIAL_CLEANUP_DELAY);

    // Cleanup timeout if component unmounts before initial cleanup
    return () => clearTimeout(initialCleanupTimeout);
  }, [cleanupOldMessages]);

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

  const getRandomSuggestions = useCallback(() => {
    const shuffled = [...suggestedQueries].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 5);
  }, []);

  const sendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setMessage('');
    setIsLoading(true);
    setShowSuggestions(false);

    const newMessageId = Date.now().toString();
    
    // Add user message
    const userMessageObj: StreamingMessage = {
      id: `msg-${newMessageId}`,
      message: userMessage,
      isUser: true,
      created_at: new Date().toISOString()
    };
    
    // Add typing indicator
    const typingIndicator: StreamingMessage = {
      id: `typing-${newMessageId}`,
      message: '',
      isUser: false,
      created_at: new Date().toISOString(),
      isStreaming: true
    };
    
    setMessages(prev => [...prev, userMessageObj, typingIndicator]);

    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/chat/send-message`,
        { message: userMessage },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = response.data;
      
      if (!response.status || response.status >= 400) {
        throw new Error(data.error || 'Failed to send message');
      }

      // Replace typing indicator with final message
      setMessages(prev => prev.map(msg =>
        msg.id === `typing-${newMessageId}`
          ? {
              id: `response-${newMessageId}`,
              message: data.message,
              isUser: false,
              created_at: new Date().toISOString()
            }
          : msg
      ));

      // Generate new random suggestions after response
      setRandomSuggestions(getRandomSuggestions());
      setShowSuggestions(true);

    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to send message. Please try again.'
      );
      // Remove typing indicator on error
      setMessages(prev => prev.filter(msg => msg.id !== `typing-${newMessageId}`));
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

  const renderMessage = React.useCallback(({ item }: { item: StreamingMessage }) => (
    <ChatMessage
      message={item.message}
      isUser={item.isUser}
      timestamp={new Date(item.created_at)}
      isDark={isDark}
      isStreaming={item.isStreaming}
    />
  ), [isDark]);

  const handleScroll = (event: any) => {
    const position = event.nativeEvent.contentOffset.x;
    setScrollPosition(position);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <LinearGradient
          colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
          className="flex-1"
        >
          {/* Header */}
          <View className={`px-4 py-3 border-b ${
            isDark ? 'border-gray-800' : 'border-gray-200'
          }`}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center space-x-3 gap-4">
                <Pressable
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
                </Pressable>
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
              <Pressable
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
              </Pressable>
            </View>
          </View>

          {/* Chat Area */}
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
              <View className="flex-1">
                <FlatList
                  ref={flatListRef}
                  data={[...messages].reverse()}
                  keyExtractor={item => item.id}
                  renderItem={renderMessage}
                  className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
                  contentContainerStyle={{ 
                    paddingVertical: 16,
                    flexGrow: 1,
                  }}
                  removeClippedSubviews={true}
                  maxToRenderPerBatch={5}
                  windowSize={5}
                  initialNumToRender={10}
                  updateCellsBatchingPeriod={50}
                  onEndReachedThreshold={0.5}
                  inverted
                />
                {showSuggestions && messages.length > 0 && (
                  <View className={`border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                    <View style={{ position: 'relative' }}>
                      <ScrollView 
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="py-3 px-2"
                        contentContainerStyle={{
                          paddingHorizontal: 2,
                          paddingRight: 16
                        }}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
                        onContentSizeChange={(width) => setContentWidth(width)}
                      >
                        {randomSuggestions.map((query, index) => (
                          <TouchableOpacity
                            key={`suggestion-${index}`}
                            onPress={() => handleSuggestedQuery(query)}
                            className={`rounded-full px-4 py-2 mr-2 ${
                              isDark ? 'bg-gray-800' : 'bg-blue-50'
                            }`}
                            style={{
                              maxWidth: 200
                            }}
                          >
                            <Text 
                              className={isDark ? 'text-blue-400' : 'text-blue-600'}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {query}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {contentWidth > containerWidth && (
                        <LinearGradient
                          colors={[
                            isDark ? 'rgba(31, 41, 55, 0)' : 'rgba(255, 255, 255, 0)',
                            isDark ? '#1F2937' : '#FFFFFF'
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: 40,
                            zIndex: 1,
                            pointerEvents: 'none'
                          }}
                        />
                      )}
                    </View>

                    {contentWidth > containerWidth && (
                      <View 
                        style={{ 
                          flexDirection: 'row', 
                          justifyContent: 'center',
                          paddingBottom: 4,
                          paddingTop: 2
                        }}
                      >
                        {[0, 1, 2].map((dot) => (
                          <ScrollIndicatorDot
                            key={dot}
                            active={
                              dot === Math.floor((scrollPosition / (contentWidth - containerWidth)) * 3)
                            }
                            isDark={isDark}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Input Area */}
          <View 
            className={`p-4 ${isDark ? 'bg-gray-800/90' : 'bg-white/90'} border-t ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}
            style={{
              shadowColor: isDark ? '#000' : '#666',
              shadowOffset: { width: 0, height: -3 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 5
            }}
          >
            <View className="flex-row items-end space-x-2 gap-2">
              <View className={`flex-1 rounded-2xl ${
                isDark ? 'bg-gray-700' : 'bg-gray-100'
              }`}>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Type your message..."
                  placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                  className={`px-4 py-3 min-h-[44px] max-h-[120px] ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                  style={styles.input}
                  multiline
                  maxLength={500}
                />
              </View>
              <TouchableOpacity
                onPress={sendMessage}
                disabled={isLoading || !message.trim()}
                className={`p-2.5 rounded-full ${
                  message.trim() 
                    ? isDark ? 'bg-blue-600' : 'bg-blue-500'
                    : isDark ? 'bg-gray-700' : 'bg-gray-300'
                }`}
                style={styles.sendButton}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Ionicons 
                    name="send" 
                    size={22} 
                    color="white" 
                    style={{ marginLeft: 2 }} 
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </>
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