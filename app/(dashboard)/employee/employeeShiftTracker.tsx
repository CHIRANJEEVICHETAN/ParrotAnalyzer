import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, differenceInSeconds } from 'date-fns';

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
    loadShiftHistory();
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

  const loadShiftHistory = async () => {
    try {
      const history = await AsyncStorage.getItem('shiftHistory');
      if (history) {
        setShiftHistory(JSON.parse(history));
      }
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
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartShift = async () => {
    const now = new Date();
    setShiftStart(now);
    setIsShiftActive(true);
    setElapsedTime(0);

    try {
      await AsyncStorage.setItem('shiftStatus', JSON.stringify({
        isActive: true,
        startTime: now.toISOString(),
      }));
      
      setModalData({
        title: 'Shift Started',
        message: `Your shift has started at ${format(now, 'hh:mm a')}. The timer will continue running even if you close the app.`,
        type: 'success',
        showCancel: false
      });
      setShowModal(true);
    } catch (error) {
      console.error('Error saving shift status:', error);
    }
  };

  const confirmEndShift = async () => {
    const now = new Date();
    if (shiftStart) {
      const duration = formatElapsedTime(differenceInSeconds(now, shiftStart));
      const newShiftData: ShiftData = {
        date: format(shiftStart, 'yyyy-MM-dd'),
        startTime: format(shiftStart, 'HH:mm:ss'),
        endTime: format(now, 'HH:mm:ss'),
        duration,
      };

      try {
        const updatedHistory = [newShiftData, ...shiftHistory];
        await AsyncStorage.setItem('shiftHistory', JSON.stringify(updatedHistory));
        await AsyncStorage.removeItem('shiftStatus');
        
        setShiftHistory(updatedHistory);
        setIsShiftActive(false);
        setShiftStart(null);

        setModalData({
          title: 'Shift Completed',
          message: `Total Duration: ${duration}\nStart: ${format(shiftStart, 'hh:mm a')}\nEnd: ${format(now, 'hh:mm a')}`,
          type: 'info',
          showCancel: false
        });
        setShowModal(true);
      } catch (error) {
        console.error('Error ending shift:', error);
      }
    }
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

      {/* Header */}
      <View className={`flex-row items-center justify-between p-4 ${isDark ? 'bg-gray-800' : 'bg-white'} border-b border-gray-200`}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons 
            name="arrow-back" 
            size={24} 
            color={isDark ? '#FFFFFF' : '#111827'} 
          />
        </TouchableOpacity>
        <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Shift Tracker
        </Text>
        <View style={{ width: 24 }} />
      </View>

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

        {/* Shift History */}
        <View className={`rounded-lg p-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Recent Shifts
          </Text>
          {shiftHistory.map((shift, index) => (
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
