import { View, TouchableOpacity } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring,
  withTiming,
  interpolateColor
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { useSharedValue } from 'react-native-reanimated';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    rotation.value = withSpring(theme === 'dark' ? 180 : 0);
  }, [theme]);

  const iconStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${rotation.value}deg` },
        { scale: scale.value }
      ]
    };
  });

  const handlePress = () => {
    scale.value = withSpring(1.2, {}, () => {
      scale.value = withSpring(1);
    });
    onToggle();
  };

  return (
    <TouchableOpacity 
      onPress={handlePress}
      className="p-2 rounded-full"
    >
      <Animated.View style={iconStyle}>
        <Ionicons 
          name={theme === 'dark' ? 'sunny' : 'moon'} 
          size={24} 
          color={theme === 'dark' ? '#FFF' : '#000'}
        />
      </Animated.View>
    </TouchableOpacity>
  );
} 