import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, useThemeColor } from '../hooks/useColorScheme';
import { isBackgroundLocationTrackingActive } from '../utils/backgroundLocationTask';
import useLocationStore from '../store/locationStore';

interface BackgroundTrackingNotificationProps {
  onPress?: () => void;
  showTime?: boolean;
  autoHide?: boolean;
  hideAfter?: number; // milliseconds
}

const BackgroundTrackingNotification: React.FC<BackgroundTrackingNotificationProps> = ({
  onPress,
  showTime = true,
  autoHide = false,
  hideAfter = 5000, // 5 seconds
}) => {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor('#10b981', '#0d9488');
  const textColor = useThemeColor('#ffffff', '#ffffff');
  
  const [isVisible, setIsVisible] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const { backgroundTrackingEnabled } = useLocationStore();
  
  const opacity = new Animated.Value(0);
  
  // Check if background tracking is active
  useEffect(() => {
    let checkInterval: NodeJS.Timeout;
    
    const checkBackgroundTracking = async () => {
      const isActive = await isBackgroundLocationTrackingActive();
      
      if (isActive && !isVisible) {
        setIsVisible(true);
        setStartTime(new Date());
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else if (!isActive && isVisible) {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setIsVisible(false);
          setStartTime(null);
        });
      }
    };
    
    checkBackgroundTracking();
    checkInterval = setInterval(checkBackgroundTracking, 10000);
    
    return () => {
      clearInterval(checkInterval);
    };
  }, [backgroundTrackingEnabled]);
  
  // Update elapsed time
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (startTime && isVisible) {
      timer = setInterval(() => {
        const now = new Date();
        const diffMs = now.getTime() - startTime.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        const minutes = Math.floor(diffSec / 60);
        const seconds = diffSec % 60;
        setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [startTime, isVisible]);
  
  // Auto hide after specified time
  useEffect(() => {
    let hideTimer: NodeJS.Timeout;
    
    if (autoHide && isVisible) {
      hideTimer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setIsVisible(false);
        });
      }, hideAfter);
    }
    
    return () => {
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [autoHide, isVisible, hideAfter]);
  
  if (!isVisible) return null;
  
  return (
    <Animated.View style={[
      styles.container,
      { backgroundColor, opacity, ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        }
      }) }
    ]}>
      <TouchableOpacity 
        style={styles.content} 
        onPress={onPress} 
        activeOpacity={onPress ? 0.7 : 1}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="locate" size={20} color={textColor} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: textColor }]}>
            Background tracking active
          </Text>
          {showTime && (
            <Text style={[styles.subtitle, { color: `${textColor}99` }]}>
              Running for {elapsedTime}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={textColor} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    right: 16,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default BackgroundTrackingNotification; 