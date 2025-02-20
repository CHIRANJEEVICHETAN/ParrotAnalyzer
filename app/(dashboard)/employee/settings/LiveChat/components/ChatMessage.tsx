import React, { memo } from 'react';
import { View, Text, ActivityIndicator, useWindowDimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  timestamp: Date;
  isDark: boolean;
  isStreaming?: boolean;
}

const ChatMessage = memo(({ message, isUser, timestamp, isDark, isStreaming }: ChatMessageProps) => {
  const { width } = useWindowDimensions();
  const timeString = timestamp.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const markdownStyles = StyleSheet.create({
    body: {
      color: isUser ? '#FFFFFF' : isDark ? '#E5E7EB' : '#4B5563',
      fontSize: 15,
      lineHeight: 22,
      width: '100%',
    },
    strong: {
      color: isUser ? '#FFFFFF' : isDark ? '#FFFFFF' : '#1F2937',
      fontSize: 16,
      fontWeight: '700',
      marginTop: 8,
      marginBottom: 4,
      width: '100%',
    },
    bullet_list: {
      marginLeft: 8,
      marginBottom: 8,
      width: '100%',
    },
    bullet_list_item: {
      marginBottom: 4,
      flexDirection: 'row',
      width: '100%',
    },
    bullet_list_icon: {
      marginRight: 8,
    },
    paragraph: {
      marginBottom: 8,
      fontSize: 15,
      lineHeight: 22,
      width: '100%',
      flexShrink: 1,
    },
    ordered_list: {
      marginLeft: 8,
      marginBottom: 8,
      width: '100%',
    },
    ordered_list_item: {
      marginBottom: 4,
      flexDirection: 'row',
      width: '100%',
    },
  });

  return (
    <View className={`px-4 py-2 ${isUser ? 'items-end' : 'items-start'}`}>
      <View className={`flex-row items-end gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
        {!isUser && (
          <View className={`rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'} p-2.5`}>
            <Ionicons 
              name="chatbubble-ellipses" 
              size={20} 
              color={isDark ? '#60A5FA' : '#3B82F6'} 
            />
          </View>
        )}
        <View 
          className={`rounded-2xl px-4 py-3 ${
            isUser 
              ? 'bg-blue-500'
              : isDark ? 'bg-gray-800' : 'bg-white'
          } shadow-sm`}
          style={{ 
            maxWidth: Math.min(width * (isUser ? 0.65 : 0.70), isUser ? 350 : 400),
            minWidth: 50,
            width: 'auto',
            flex: 1,
            borderWidth: !isDark && !isUser ? 1 : 0,
            borderColor: '#E5E7EB',
            position: 'relative',
          }}
        >
          {isStreaming ? (
            <View className="flex-row items-center gap-2 py-2">
              <View className="flex-row gap-1.5 px-2">
                <TypingDot delay={0} isDark={isDark} />
                <TypingDot delay={300} isDark={isDark} />
                <TypingDot delay={600} isDark={isDark} />
              </View>
            </View>
          ) : (
            <>
              <View style={{ 
                paddingVertical: 2, 
                paddingRight: 48,
                width: '100%',
                flex: 1,
              }}>
                <Markdown 
                  style={markdownStyles}
                  mergeStyle={true}
                >{message}</Markdown>
              </View>
              <Text 
                style={{ 
                  position: 'absolute',
                  bottom: 8,
                  right: 12,
                  fontSize: 11,
                  color: isUser 
                    ? 'rgba(255, 255, 255, 0.7)'
                    : isDark ? '#9CA3AF' : '#6B7280',
                }}
              >
                {timeString}
              </Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
});

// Enhanced typing indicator dot with smoother animation
const TypingDot = ({ delay, isDark }: { delay: number; isDark: boolean }) => {
  const [opacity, setOpacity] = React.useState(0.3);

  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const animate = () => {
      timeoutId = setTimeout(() => {
        setOpacity(prev => prev === 0.3 ? 1 : 0.3);
        animate();
      }, 500);
    };

    setTimeout(() => animate(), delay);
    return () => clearTimeout(timeoutId);
  }, [delay]);

  return (
    <View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: isDark ? '#60A5FA' : '#3B82F6',
        opacity,
        transform: [{ scale: opacity === 1 ? 1.2 : 1 }],
      }}
    />
  );
};

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage; 