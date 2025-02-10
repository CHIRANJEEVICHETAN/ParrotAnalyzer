import React, { memo } from 'react';
import { View, Text, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

  const formatMessage = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      // Handle numbered steps (e.g., "1. Step")
      if (/^\*\*\d+\./i.test(line)) {
        return (
          <Text 
            key={index} 
            style={{ 
              marginBottom: 12,
              marginTop: 4,
              fontFamily: 'System',
              fontSize: 16,
              fontWeight: '700',
              color: isUser ? '#FFFFFF' : isDark ? '#FFFFFF' : '#1F2937',
            }}
          >
            {line.replace(/\*\*/g, '')}
          </Text>
        );
      }
      // Handle bullet points - convert to clean text with bullet
      else if (line.trim().startsWith('-')) {
        const cleanText = line.trim().substring(1).trim(); // Remove the dash and trim spaces
        return (
          <Text 
            key={index} 
            style={{ 
              marginLeft: 16, 
              marginBottom: 8,
              fontSize: 15,
              lineHeight: 22,
              color: isUser ? '#FFFFFF' : isDark ? '#E5E7EB' : '#4B5563',
            }}
          >
            <Text style={{ marginRight: 8 }}>•</Text> {cleanText}
          </Text>
        );
      }
      // Handle emphasized text (remove ** but keep bold style)
      else if (line.includes('**')) {
        const cleanText = line.replace(/\*\*/g, '');
        return (
          <Text 
            key={index} 
            style={{ 
              marginBottom: 8,
              fontSize: 15,
              lineHeight: 22,
              fontWeight: '600',
              color: isUser ? '#FFFFFF' : isDark ? '#FFFFFF' : '#1F2937',
            }}
          >
            {cleanText}
          </Text>
        );
      }
      // Regular text
      return line ? (
        <Text 
          key={index} 
          style={{ 
            marginBottom: 8,
            fontSize: 15,
            lineHeight: 22,
            color: isUser ? '#FFFFFF' : isDark ? '#E5E7EB' : '#4B5563',
          }}
        >
          {line}
        </Text>
      ) : null;
    });
  };

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
            maxWidth: Math.min(width * 0.75, 400),
            minWidth: 50,
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
              <View style={{ paddingVertical: 2, paddingRight: 48 }}>
                {formatMessage(message)}
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