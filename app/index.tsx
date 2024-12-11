import { useEffect } from 'react';
import { View, Text, Animated, Image } from 'react-native';
import { useRouter } from 'expo-router';
import ThemeContext from './context/ThemeContext';

export default function SplashScreen() {
  const router = useRouter();
  const { theme } = ThemeContext.useTheme();
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.95);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      router.replace('/welcome');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View className={`flex-1 items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }}
        className="items-center"
      >
        {/* Replace with your actual logo */}
        <View className="w-32 h-32 bg-blue-500 rounded-full items-center justify-center mb-4">
          <Text className="text-white text-4xl">🦜</Text>
        </View>
        <Text className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
          Parrot Analyzer
        </Text>
      </Animated.View>

      <View className="absolute bottom-10 items-center">
        <Text className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          Powered by Loginware.ai
        </Text>
      </View>
    </View>
  );
} 