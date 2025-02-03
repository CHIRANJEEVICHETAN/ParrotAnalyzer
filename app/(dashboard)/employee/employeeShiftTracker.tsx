import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Modal,
  Animated,
  Easing,
  Alert,
  InteractionManager,
  Platform,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, differenceInSeconds } from 'date-fns';
import axios from 'axios';
import AuthContext from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNav from '../../components/BottomNav';
import { employeeNavItems } from './utils/navigationItems';
import * as Notifications from 'expo-notifications';

interface ShiftData {
  date: string;
  startTime: string;
  endTime: string | null;
  duration: string | null;
}

interface ShiftStatus {
  isActive: boolean;
  startTime: string | null;
}

interface RecentShift {
  id: number;
  start_time: string;
  end_time: string | null;
  duration: string;
  date: string;
}

interface WarningMessage {
  title: string;
  message: string;
}

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Add these warning messages array before the component
const warningMessages: WarningMessage[] = [
  {
    title: 'Important Shift Notice',
    message: 'Please start and end your shifts properly on time. Never forget to end your shift before leaving.'
  },
  {
    title: 'Warning',
    message: 'Do not logout or uninstall the app without ending your active shift first.'
  }
];

// Update the TimerPicker component with manual time selection
const TimerPicker = ({ visible, onClose, onSelectHours, isDark }: {
  visible: boolean;
  onClose: () => void;
  onSelectHours: (hours: number) => void;
  isDark: boolean;
}) => {
  const [manualHours, setManualHours] = useState('');
  const [manualMinutes, setManualMinutes] = useState('');

  const handleManualSubmit = () => {
    const hours = parseFloat(manualHours) || 0;
    const minutes = parseFloat(manualMinutes) || 0;
    const totalHours = hours + (minutes / 60);
    
    if (totalHours <= 0) {
      Alert.alert('Invalid Time', 'Please enter a valid duration');
      return;
    }
    
    if (totalHours > 24) {
      Alert.alert('Invalid Duration', 'Duration cannot exceed 24 hours');
      return;
    }

    onSelectHours(totalHours);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className={`m-5 p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} w-5/6`}>
          <Text className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Set Shift Duration
          </Text>

          {/* Preset durations */}
          <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Preset Durations
          </Text>
          <View className="flex-row flex-wrap justify-between gap-2 mb-4">
            {[4, 6, 8, 9, 10, 12].map((hours) => (
              <TouchableOpacity
                key={hours}
                onPress={() => onSelectHours(hours)}
                className={`p-4 rounded-lg mb-2 w-[48%] ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
              >
                <Text className={`text-center font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {hours} Hours
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Manual time selection */}
          <View className="mt-4">
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              Custom Duration
            </Text>
            <View className="flex-row justify-between items-center gap-2">
              <View className="flex-1">
                <Text className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Hours</Text>
                <TextInput
                  value={manualHours}
                  onChangeText={text => setManualHours(text.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="0"
                  className={`p-3 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                />
              </View>
              <View className="flex-1">
                <Text className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Minutes</Text>
                <TextInput
                  value={manualMinutes}
                  onChangeText={text => {
                    const num = parseInt(text);
                    if (!text || (num >= 0 && num < 60)) {
                      setManualMinutes(text.replace(/[^0-9]/g, ''));
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="0"
                  className={`p-3 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                />
              </View>
              <TouchableOpacity
                onPress={handleManualSubmit}
                className="bg-blue-500 p-3 rounded-lg mt-4"
              >
                <Text className="text-white font-semibold">Set</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={onClose}
            className="mt-6 p-4 rounded-lg bg-gray-500"
          >
            <Text className="text-white text-center font-semibold">
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function EmployeeShiftTracker() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  // Animated values
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const spinValue = React.useRef(new Animated.Value(0)).current;

  // State
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [shiftStart, setShiftStart] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [shiftHistory, setShiftHistory] = useState<ShiftData[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<{
    title: string;
    message: string;
    type: 'success' | 'info';
    showCancel?: boolean;
  }>({
    title: '',
    message: '',
    type: 'info',
    showCancel: false
  });
  const [recentShifts, setRecentShifts] = useState<RecentShift[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [timerDuration, setTimerDuration] = useState<number | null>(null);
  const [timerEndTime, setTimerEndTime] = useState<Date | null>(null);
  const [currentWarningIndex, setCurrentWarningIndex] = useState(-1);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [notificationId, setNotificationId] = useState<string | null>(null);

  // Load persistent state
  useEffect(() => {
    loadShiftStatus();
    loadShiftHistoryFromBackend();
  }, []);

  // Animation effects
  useEffect(() => {
    if (isShiftActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [isShiftActive]);

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (isShiftActive && shiftStart) {
        setElapsedTime(differenceInSeconds(new Date(), shiftStart));
        updateEmployeeDashboard();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isShiftActive, shiftStart]);

  const loadShiftStatus = async () => {
    try {
      const status = await AsyncStorage.getItem('shiftStatus');
      if (status) {
        const { isActive, startTime } = JSON.parse(status);
        setIsShiftActive(isActive);
        if (isActive && startTime) {
          setShiftStart(new Date(startTime));
        }
      }
    } catch (error) {
      console.error('Error loading shift status:', error);
    }
  };

  const loadShiftHistoryFromBackend = async () => {
    try {
      const currentMonth = format(new Date(), 'yyyy-MM');
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/employee/attendance/${currentMonth}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const convertedHistory: ShiftData[] = response.data.map((shift: any) => {
        try {
          const startTime = new Date(shift.shifts[0]?.shift_start);
          const endTime = shift.shifts[0]?.shift_end ? new Date(shift.shifts[0].shift_end) : null;

          return {
            date: format(startTime, 'yyyy-MM-dd'),
            startTime: format(startTime, 'HH:mm:ss'),
            endTime: endTime ? format(endTime, 'HH:mm:ss') : null,
            duration: shift.total_hours
              ? formatElapsedTime(parseFloat(shift.total_hours.toString()) * 3600)
              : null,
          };
        } catch (err) {
          console.error('Error parsing shift data:', err, shift);
          return null;
        }
      }).filter(Boolean);

      console.log('Converted history:', convertedHistory);
      setShiftHistory(convertedHistory);
    } catch (error) {
      console.error('Error loading shift history:', error);
    }
  };

  const updateEmployeeDashboard = async () => {
    try {
      const dashboardData = {
        shiftStatus: isShiftActive ? 'Active Shift' : 'No Active Shift',
        attendanceStatus: isShiftActive ? 'Present' : 'Not Marked',
        currentShiftDuration: formatElapsedTime(elapsedTime),
      };
      await AsyncStorage.setItem('dashboardStatus', JSON.stringify(dashboardData));
    } catch (error) {
      console.error('Error updating dashboard:', error);
    }
  };

  // Format elapsed time
  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Optimize animations with useCallback
  const startAnimations = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [pulseAnim, rotateAnim]);

  // Add this helper function at the top
  const formatDateForBackend = (date: Date) => {
    // Format date in local timezone without any conversion
    return format(date, "yyyy-MM-dd'T'HH:mm:ss.SSS");
  };

  // Modify the notification scheduling code
  const schedulePersistentNotification = async () => {
    try {
      // Cancel any existing notification
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      }

      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Notifications are required to track your shift status.');
        return;
      }

      // Set notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('active-shift', {
          name: 'Active Shift',
          importance: Notifications.AndroidImportance.HIGH,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          sound: 'default',
          enableVibrate: true,
          vibrationPattern: [0, 250, 250, 250],
          showBadge: true,
        });
      }

      // Schedule the persistent notification
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🟢 Active Shift Running ⏰',
          body: '⚡ Live: Your shift is in progress!\n🔔 Remember to end your shift before leaving\n⏱️ Started at: ' + format(shiftStart || new Date(), 'hh:mm a'),
          priority: 'max',
          sticky: true,
          color: '#3B82F6',
          badge: 1,
          vibrate: [0, 250, 250, 250],
          // Android specific
          ...(Platform.OS === 'android' && {
            channelId: 'active-shift',
          }),
          // iOS specific
          ...(Platform.OS === 'ios' && {
            interruptionLevel: 'timeSensitive',
          }),
          data: {
            type: 'active-shift',
            startTime: shiftStart?.toISOString() || new Date().toISOString(),
          },
        },
        trigger: null // Use null to make it show immediately and stay
      });
      setNotificationId(id);
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  };

  // Add this function to show warning messages sequentially
  const showWarningMessages = useCallback(() => {
    setCurrentWarningIndex(0);
    setShowWarningModal(true);
  }, []);

  // Add this effect to handle warning message display
  useEffect(() => {
    if (currentWarningIndex >= 0 && currentWarningIndex < warningMessages.length) {
      const timer = setTimeout(() => {
        setShowWarningModal(false);
        setTimeout(() => {
          if (currentWarningIndex < warningMessages.length - 1) {
            setCurrentWarningIndex(prev => prev + 1);
            setShowWarningModal(true);
          } else {
            setCurrentWarningIndex(-1);
          }
        }, 500);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [currentWarningIndex, showWarningModal]);

  // Modify handleStartShift to include warnings and notification
  const handleStartShift = async () => {
    const now = new Date();

    // Update UI immediately
    setShiftStart(now);
    setIsShiftActive(true);
    setElapsedTime(0);
    startAnimations();

    // Show feedback immediately
    setModalData({
      title: 'Starting Shift',
      message: `Your shift is starting at ${format(now, 'hh:mm a')}...`,
      type: 'success',
      showCancel: false
    });
    setShowModal(true);

    // Perform API call and storage updates in background
    InteractionManager.runAfterInteractions(async () => {
      try {
        await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL}/api/employee/shift/start`,
          {
            startTime: formatDateForBackend(now)
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        await AsyncStorage.setItem('shiftStatus', JSON.stringify({
          isActive: true,
          startTime: now.toISOString(),
        }));

        // Schedule persistent notification
        await schedulePersistentNotification();

        // Update modal with success message
        setModalData({
          title: 'Shift Started',
          message: `Your shift has started at ${format(now, 'hh:mm a')}. The timer will continue running even if you close the app.`,
          type: 'success',
          showCancel: false
        });

        // Show warning messages after shift start confirmation
        setTimeout(() => {
          showWarningMessages();
        }, 1500);
      } catch (error: any) {
        // Revert UI state on error
        setShiftStart(null);
        setIsShiftActive(false);
        setElapsedTime(0);
        pulseAnim.setValue(1);
        rotateAnim.setValue(0);

        Alert.alert(
          'Error',
          error.response?.data?.error || 'Failed to start shift. Please try again.'
        );
      }
    });
  };

  // Modify confirmEndShift to clean up notification
  const confirmEndShift = async () => {
    const now = new Date();
    if (!shiftStart) return;

    // Immediately update UI state
    setShowModal(false);
    setIsShiftActive(false);
    setShiftStart(null);
    pulseAnim.setValue(1);
    rotateAnim.setValue(0);

    // Calculate duration for immediate feedback
    const duration = formatElapsedTime(differenceInSeconds(now, shiftStart));

    // Show completion modal immediately
    setModalData({
      title: 'Shift Completed',
      message: `Total Duration: ${duration}\nStart: ${format(shiftStart, 'hh:mm a')}\nEnd: ${format(now, 'hh:mm a')}`,
      type: 'success',
      showCancel: false
    });
    setShowModal(true);

    // Create new shift data
    const newShiftData: ShiftData = {
      date: format(shiftStart, 'yyyy-MM-dd'),
      startTime: format(shiftStart, 'HH:mm:ss'),
      endTime: format(now, 'HH:mm:ss'),
      duration,
    };

    // Perform API call and storage updates in background
    InteractionManager.runAfterInteractions(async () => {
      try {
        await Promise.all([
          // API call
          axios.post(
            `${process.env.EXPO_PUBLIC_API_URL}/api/employee/shift/end`,
            {
              endTime: formatDateForBackend(now)
            },
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          ),
          // Storage updates
          AsyncStorage.removeItem('shiftStatus'),
          AsyncStorage.setItem('shiftHistory', JSON.stringify([newShiftData, ...shiftHistory]))
        ]);

        // Refresh data in background
        await Promise.all([
          loadShiftHistoryFromBackend(),
          fetchRecentShifts()
        ]);

        // Cancel the persistent notification
        if (notificationId) {
          await Notifications.cancelScheduledNotificationAsync(notificationId);
          setNotificationId(null);
        }

      } catch (error: any) {
        console.error('Error ending shift:', error);
        
        // Show error modal
        setModalData({
          title: 'Error',
          message: error.response?.data?.error || 'Failed to end shift. Please try again.',
          type: 'info',
          showCancel: false
        });
        setShowModal(true);

        // Revert UI state
        setIsShiftActive(true);
        setShiftStart(shiftStart);
        startAnimations();
      }
    });
  };

  const handleEndShift = () => {
    setModalData({
      title: 'End Shift',
      message: 'Are you sure you want to end your current shift?',
      type: 'info',
      showCancel: true
    });
    setShowModal(true);
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const fetchRecentShifts = async () => {
    try {
      setIsRefreshing(true);
      const response = await axios.get<RecentShift[]>(
        `${process.env.EXPO_PUBLIC_API_URL}/api/employee/shifts/recent`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Process and set the recent shifts
      const formattedShifts = response.data.map((shift: RecentShift) => {
        // Since timestamps are already in IST from backend, just create Date objects
        const startDate = new Date(shift.start_time);
        const endDate = shift.end_time ? new Date(shift.end_time) : null;
        
        return {
          ...shift,
          date: format(startDate, 'yyyy-MM-dd'),
          // Format times in 12-hour format
          start_time: format(startDate, 'hh:mm a'),
          end_time: endDate ? format(endDate, 'hh:mm a') : 'Ongoing',
          duration: shift.duration ? parseFloat(shift.duration).toFixed(1) : '0.0'
        };
      });

      setRecentShifts(formattedShifts);
    } catch (error) {
      console.error('Error fetching recent shifts:', error);
      Alert.alert('Error', 'Failed to fetch recent shifts');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecentShifts();
  }, []);

  // Add this effect to handle the refresh animation
  React.useEffect(() => {
    if (isRefreshing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [isRefreshing]);

  // Add this with other interpolations
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  // Update the handleSetTimer function
  const handleSetTimer = (hours: number) => {
    const endTime = new Date(Date.now() + hours * 60 * 60 * 1000);
    setTimerDuration(hours);
    setTimerEndTime(endTime);
    setShowTimerPicker(false);

    // Show confirmation modal
    setModalData({
      title: 'Timer Set',
      message: `Your shift will automatically end at ${format(endTime, 'hh:mm a')}`,
      type: 'success',
      showCancel: false
    });
    setShowModal(true);

    // Set timeout to end shift
    const timeoutId = setTimeout(() => {
      if (isShiftActive) {
        confirmEndShift();
      }
    }, hours * 60 * 60 * 1000);

    // Clear timeout if shift is ended manually
    return () => clearTimeout(timeoutId);
  };

  // Add this near other useEffect hooks
  useEffect(() => {
    // Handle notification dismissal attempts
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.type === 'active-shift' && isShiftActive) {
        // Reschedule the notification if it was dismissed and shift is still active
        schedulePersistentNotification();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isShiftActive]);

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

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
          <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Shift Tracker
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView className="flex-1 p-4">
        <View className={`rounded-lg p-6 mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-center text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {format(currentTime, 'HH:mm:ss')}
          </Text>
          <Text className={`text-center text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {format(currentTime, 'EEEE, MMMM do, yyyy')}
          </Text>
        </View>

        <View className="items-center mb-6">
          <Animated.View style={{
            transform: [{ scale: pulseAnim }]
          }}>
            <TouchableOpacity
              onPress={isShiftActive ? handleEndShift : handleStartShift}
              className={`w-40 h-40 rounded-full items-center justify-center ${
                isShiftActive ? 'bg-red-500' : 'bg-green-500'
              }`}
            >
              <Animated.View style={{ transform: [{ rotate }] }}>
                <Ionicons
                  name={isShiftActive ? 'power' : 'power-outline'}
                  size={60}
                  color="white"
                />
              </Animated.View>
              <Text className="text-white text-xl font-bold mt-2">
                {isShiftActive ? 'End Shift' : 'Start Shift'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {isShiftActive && !timerEndTime && (
            <View className="mt-6">
              <TouchableOpacity
                onPress={() => setShowTimerPicker(true)}
                className={`px-6 py-3 rounded-lg flex-row items-center justify-center ${
                  isDark ? 'bg-blue-600' : 'bg-blue-500'
                }`}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  elevation: 2,
                }}
              >
                <Ionicons name="timer-outline" size={24} color="white" />
                <Text className="text-white font-semibold ml-2">
                  Set Auto-End Timer
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {timerEndTime && (
            <View className="mt-4 items-center">
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Shift will end in
              </Text>
              <View className="flex-row items-center">
                <Ionicons 
                  name="timer-outline" 
                  size={20} 
                  color={isDark ? '#60A5FA' : '#3B82F6'} 
                />
                <Text className={`ml-2 font-semibold ${
                  isDark ? 'text-blue-400' : 'text-blue-600'
                }`}>
                  {format(timerEndTime, 'hh:mm a')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setTimerDuration(null);
                  setTimerEndTime(null);
                }}
                className="mt-2 px-4 py-2 rounded-lg bg-red-500"
              >
                <Text className="text-white font-semibold">
                  Cancel Timer
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {isShiftActive && (
            <View className="mt-6">
              <Text className={`text-center text-lg ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Current Shift Duration
              </Text>
              <Text className={`text-center text-3xl font-bold ${
                isDark ? 'text-blue-400' : 'text-blue-500'
              }`}>
                {formatElapsedTime(elapsedTime)}
              </Text>
            </View>
          )}
        </View>

        <View className="mt-4">
          <View className="flex-row justify-between items-center mb-4">
            <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Recent Shifts
            </Text>
            <TouchableOpacity
              onPress={fetchRecentShifts}
              disabled={isRefreshing}
              className={`p-2 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
            >
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons
                  name="refresh-outline"
                  size={20}
                  color={isDark ? '#9CA3AF' : '#6B7280'}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>

          {recentShifts.length > 0 ? (
            recentShifts.map((shift: RecentShift, index: number) => (
              <View
                key={index}
                className={`mb-3 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                style={[styles.shiftCard, { borderLeftWidth: 4, borderLeftColor: '#3B82F6' }]}
              >
                <View>
                  <Text className={`text-sm mb-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    {format(new Date(shift.date), 'EEEE, MMMM do, yyyy')}
                  </Text>
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Shift Time
                      </Text>
                      <View className="flex-row items-center">
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color={isDark ? '#9CA3AF' : '#6B7280'}
                          style={{ marginRight: 4 }}
                        />
                        <Text className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {shift.start_time} - {shift.end_time}
                        </Text>
                      </View>
                    </View>
                    <View>
                      <Text className={`text-sm text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Duration
                      </Text>
                      <View className="flex-row items-center">
                        <Ionicons
                          name="hourglass-outline"
                          size={16}
                          color={isDark ? '#9CA3AF' : '#6B7280'}
                          style={{ marginRight: 4 }}
                        />
                        <Text className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {shift.duration} hrs
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View className={`p-8 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
              <View className="items-center">
                <Ionicons
                  name="calendar-outline"
                  size={40}
                  color={isDark ? '#4B5563' : '#9CA3AF'}
                />
                <Text className={`text-center mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  No recent shifts found
                </Text>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(dashboard)/employee/attendanceManagement')}
          className={`mx-4 my-6 p-4 rounded-xl flex-row items-center justify-center ${isDark ? 'bg-blue-900' : 'bg-blue-500'
            }`}
          style={styles.attendanceButton}
        >
          <Ionicons name="calendar-outline" size={24} color="white" />
          <Text className="text-white font-semibold text-lg ml-2">
            Attendance Management
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className={`m-5 p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} w-5/6`}>
            <Text className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {modalData.title}
            </Text>
            <Text className={`text-base mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              {modalData.message}
            </Text>
            <View className={`flex-row justify-between gap-4`}>
              {modalData.showCancel && (
                <TouchableOpacity
                  onPress={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-lg bg-gray-500"
                >
                  <Text className="text-white text-center font-semibold">
                    Cancel
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  if (modalData.showCancel) {
                    confirmEndShift();
                  }
                  setShowModal(false);
                }}
                className={`flex-1 py-3 rounded-lg ${modalData.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                  }`}
              >
                <Text className="text-white text-center font-semibold">
                  {modalData.showCancel ? 'Confirm' : 'OK'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TimerPicker 
        visible={showTimerPicker}
        onClose={() => setShowTimerPicker(false)}
        onSelectHours={handleSetTimer}
        isDark={isDark}
      />

      {/* Warning Modal */}
      <Modal
        visible={showWarningModal}
        transparent
        animationType="fade"
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className={`m-5 p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} w-5/6`}>
            <View className="flex-row items-center mb-4">
              <Ionicons 
                name={currentWarningIndex === 0 ? "warning-outline" : "alert-circle-outline"} 
                size={24} 
                color="#EF4444" 
              />
              <Text className={`ml-2 text-xl font-bold text-red-500`}>
                {warningMessages[currentWarningIndex]?.title}
              </Text>
            </View>
            <Text className={`text-red-500 text-base`}>
              {warningMessages[currentWarningIndex]?.message}
            </Text>
          </View>
        </View>
      </Modal>

      <BottomNav items={employeeNavItems} />
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
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  attendanceButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  shiftCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
});
