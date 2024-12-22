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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, differenceInSeconds } from 'date-fns';
import axios from 'axios';
import AuthContext from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

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

export default function EmployeeShiftTracker() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  // Animated values
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;

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

      // Add safe date parsing
      const convertedHistory: ShiftData[] = response.data.map((shift: any) => {
        try {
          return {
            date: format(new Date(shift.date), 'yyyy-MM-dd'),
            startTime: shift.shifts[0]?.shift_start 
              ? format(new Date(shift.shifts[0].shift_start), 'HH:mm:ss')
              : '',
            endTime: shift.shifts[0]?.shift_end 
              ? format(new Date(shift.shifts[0].shift_end), 'HH:mm:ss')
              : null,
            duration: shift.total_hours 
              ? formatElapsedTime(parseFloat(shift.total_hours.toString()) * 3600)
              : null,
          };
        } catch (err) {
          console.error('Error parsing shift data:', err, shift);
          return null;
        }
      }).filter(Boolean); // Remove any null entries from failed parsing

      console.log('Converted history:', convertedHistory);
      setShiftHistory(convertedHistory);
      await AsyncStorage.setItem('shiftHistory', JSON.stringify(convertedHistory));
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
    // Get timezone offset in minutes
    const tzOffset = date.getTimezoneOffset();
    // Create new date with timezone offset applied
    const localDate = new Date(date.getTime() - (tzOffset * 60000));
    return localDate.toISOString().replace('Z', '+05:30'); // Replace with your timezone offset
  };

  // Optimize shift start
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
            startTime: formatDateForBackend(now)  // Send ISO string with timezone
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        await AsyncStorage.setItem('shiftStatus', JSON.stringify({
          isActive: true,
          startTime: now.toISOString(),
        }));

        // Update modal with success message
        setModalData({
          title: 'Shift Started',
          message: `Your shift has started at ${format(now, 'hh:mm a')}. The timer will continue running even if you close the app.`,
          type: 'success',
          showCancel: false
        });
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

  // Optimize shift end
  const confirmEndShift = async () => {
    const now = new Date();
    if (!shiftStart) return;

    // Update UI immediately
    const duration = formatElapsedTime(differenceInSeconds(now, shiftStart));
    setShowModal(false);
    setIsShiftActive(false);
    pulseAnim.setValue(1);
    rotateAnim.setValue(0);

    // Show intermediate feedback
    setModalData({
      title: 'Ending Shift',
      message: 'Processing...',
      type: 'info',
      showCancel: false
    });
    setShowModal(true);

    // Perform API call and storage updates in background
    InteractionManager.runAfterInteractions(async () => {
      try {
        const response = await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL}/api/employee/shift/end`,
          {
            endTime: formatDateForBackend(now)  // Send ISO string with timezone
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        const newShiftData: ShiftData = {
          date: format(shiftStart, 'yyyy-MM-dd'),
          startTime: format(shiftStart, 'HH:mm:ss'),
          endTime: format(now, 'HH:mm:ss'),
          duration,
        };

        // Batch storage updates
        await Promise.all([
          AsyncStorage.setItem('shiftHistory', JSON.stringify([newShiftData, ...shiftHistory])),
          AsyncStorage.removeItem('shiftStatus')
        ]);

        // Refresh shift history from backend to ensure we have latest data
        await loadShiftHistoryFromBackend();
        setShiftStart(null);

        // Show final success message
        setModalData({
          title: 'Shift Completed',
          message: `Total Duration: ${duration}\nStart: ${format(shiftStart, 'hh:mm a')}\nEnd: ${format(now, 'hh:mm a')}`,
          type: 'info',
          showCancel: false
        });
      } catch (error: any) {
        // Revert UI state on error
        setIsShiftActive(true);
        startAnimations();
        
        Alert.alert(
          'Error',
          error.response?.data?.error || 'Failed to end shift. Please try again.'
        );
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

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* Updated Header */}
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
          <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Shift Tracker
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView className="flex-1 p-4">
        {/* Enhanced Time Display */}
        <View className={`rounded-lg p-6 mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-center text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {format(currentTime, 'HH:mm:ss')}
          </Text>
          <Text className={`text-center text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {format(currentTime, 'EEEE, MMMM do, yyyy')}
          </Text>
        </View>

        {/* Enhanced Shift Control */}
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

          {isShiftActive && (
            <View className="mt-6">
              <Text className={`text-center text-lg ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Current Shift Duration
              </Text>
              <Text className={`text-center text-3xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-500'}`}>
                {formatElapsedTime(elapsedTime)}
              </Text>
            </View>
          )}
        </View>

        {/* Recent Shifts */}
        <View className={`rounded-lg p-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <View className="flex-row justify-between items-center mb-4 px-1">
            <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Recent Shifts
            </Text>
            <TouchableOpacity 
              onPress={() => router.push('/(dashboard)/employee/attendanceManagement')}
              className="px-2"
            >
              <Text className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-500'}`}>
                View All
              </Text>
            </TouchableOpacity>
          </View>
          
          {shiftHistory.slice(0, 3).map((shift, index) => (
            <View 
              key={index} 
              className={`p-4 rounded-lg mb-2 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}
            >
              <Text className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Date: {format(new Date(shift.date), 'MMM dd, yyyy')}
              </Text>
              <View className="flex-row justify-between mt-2">
                <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Start: {format(new Date(`${shift.date} ${shift.startTime}`), 'hh:mm a')}
                </Text>
                <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  End: {shift.endTime ? format(new Date(`${shift.date} ${shift.endTime}`), 'hh:mm a') : '--:--'}
                </Text>
              </View>
              <Text className={`mt-2 font-semibold ${isDark ? 'text-blue-400' : 'text-blue-500'}`}>
                Duration: {shift.duration}
              </Text>
            </View>
          ))}
        </View>

        {/* Attendance Management Button */}
        <TouchableOpacity
          onPress={() => router.push('/(dashboard)/employee/attendanceManagement')}
          className={`mx-4 my-6 p-4 rounded-xl flex-row items-center justify-center ${
            isDark ? 'bg-blue-900' : 'bg-blue-500'
          }`}
          style={styles.attendanceButton}
        >
          <Ionicons name="calendar-outline" size={24} color="white" />
          <Text className="text-white font-semibold text-lg ml-2">
            Attendance Management
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Custom Modal */}
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
                className={`flex-1 py-3 rounded-lg ${
                  modalData.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
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
    </View>
  );
}

const styles = {
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  attendanceButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
};
