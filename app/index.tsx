import { useEffect } from 'react';
import { View, Text, Animated, Image, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import ThemeContext from './context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import AuthContext from './context/AuthContext';
import { PDFGenerator } from './(dashboard)/Group-Admin/reports/services/PDFGenerator';
import * as Notifications from 'expo-notifications';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function SplashScreen() {
  const router = useRouter();
  const { theme } = ThemeContext.useTheme();
  const { isLoading, user } = AuthContext.useAuth();
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.3);
  const rotateAnim = new Animated.Value(0);
  const slideUpAnim = new Animated.Value(50);
  const textFadeAnim = new Animated.Value(0);

  useEffect(() => {
    // Request notification permissions on app start
    const requestNotificationPermissions = async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          console.log('Notification permission not granted');
          return;
        }
      } catch (error) {
        console.error('Error requesting notification permissions:', error);
      }
    };

    // Initialize notifications and PDF handler
    const initializeApp = async () => {
      await requestNotificationPermissions();
      PDFGenerator.setupNotificationHandler();
    };

    initializeApp();

    // Only proceed with animations and navigation when auth is initialized
    if (!isLoading) {
      // Logo animation sequence
      Animated.sequence([
        // First: Scale and fade in the logo
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
        ]),
        // Then: Rotate the logo
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        // Finally: Slide up and fade in the text
        Animated.parallel([
          Animated.timing(slideUpAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(textFadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Navigate based on auth state
      const timer = setTimeout(() => {
        if (user) {
          // User is already logged in, navigate to their dashboard
          switch (user.role) {
            case 'employee':
              router.replace('/(dashboard)/employee/employee');
              break;
            case 'group-admin':
              router.replace('/(dashboard)/Group-Admin/group-admin');
              break;
            case 'management':
              router.replace('/(dashboard)/management/management');
              break;
            case 'super-admin':
              router.replace('/(dashboard)/super-admin/super-admin');
              break;
          }
        } else {
          // No user logged in, go to welcome screen
          router.replace('/welcome');
        }
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [isLoading, user]);

  const isDark = theme === 'dark';
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <>
      <StatusBar 
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? '#1E293B' : '#EEF2FF'}
      />
      <LinearGradient
        colors={isDark ? 
          ['#1E293B', '#0F172A'] : 
          ['#EEF2FF', '#E0E7FF']}
        style={{ flex: 1 }}
      >
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.4,
          backgroundColor: 'transparent',
          borderStyle: 'solid',
          borderWidth: 1.5,
          borderColor: isDark ? '#3B82F6' : '#6366F1',
          borderRadius: 20,
          transform: [{ scale: 1.5 }, { rotate: '45deg' }],
        }} />
        
        <View style={{ 
          flex: 1, 
          alignItems: 'center', 
          justifyContent: 'center',
        }}>
          <Animated.View style={{
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { rotate: spin }
            ],
            alignItems: 'center'
          }}>
            <View style={{
              width: 240,
              height: 240,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              padding: 3, // Added padding for border effect
              borderRadius: 120,
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(99, 102, 241, 0.1)',
              borderWidth: 2,
              borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(99, 102, 241, 0.3)',
              shadowColor: isDark ? '#3B82F6' : '#6366F1',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 8,
            }}>
              <View style={{
                width: '100%',
                height: '100%',
                borderRadius: 120,
                overflow: 'hidden',
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.05)' : 'rgba(99, 102, 241, 0.05)',
              }}>
                <Image 
                  source={require("../assets/images/icon.png")}
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                  resizeMode="cover"
                />
              </View>
            </View>
            <Animated.Text style={{
              fontSize: 40,
              fontWeight: 'bold',
              color: isDark ? '#ffffff' : '#1F2937',
              textShadowColor: 'rgba(0, 0, 0, 0.1)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 4,
              opacity: textFadeAnim,
              transform: [{ translateY: slideUpAnim }]
            }}>
              Parrot Analyzer
            </Animated.Text>
          </Animated.View>

          <Animated.View style={{
            position: 'absolute',
            bottom: 40,
            opacity: textFadeAnim,
            transform: [{ translateY: slideUpAnim }]
          }}>
            <Text style={{
              fontSize: 16,
              color: isDark ? '#D1D5DB' : '#4B5563',
              letterSpacing: 0.5
            }}>
              Powered by Loginware.ai
            </Text>
          </Animated.View>
        </View>
      </LinearGradient>
    </>
  );
} 