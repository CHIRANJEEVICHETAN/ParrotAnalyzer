import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  StatusBar,
  Platform,
  Animated
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { format } from 'date-fns';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthContext from '../../context/AuthContext';
import ThemeContext from '../../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import AddScheduleModal from './components/AddScheduleModal';
import EditScheduleModal from './components/EditScheduleModal';
import { CalendarTheme } from './types';

// Remove the import of AddEventModal from components and define it inline
interface AddEventModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (event: {
    title: string;
    description: string;
    location: string;
    time: string;
    date: Date;
  }) => void;
  selectedDate: Date;
}

// Add proper interfaces
interface ScheduleEvent {
  id: number;
  title: string;
  time: string;
  location: string;
  description?: string;
  date: string;
  userId: number;
}

// Add interface for Calendar day
interface CalendarDay {
  dateString: string;
  day: number;
  month: number;
  year: number;
  timestamp: number;
}

// Create a calendar theme object
const calendarTheme: CalendarTheme = {
  textDayFontSize: 16,
  textDayFontWeight: '400',
  textMonthFontSize: 18,
  textMonthFontWeight: '600',
  textDayHeaderFontSize: 14,
  'stylesheet.calendar.header': {
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingLeft: 10,
      paddingRight: 10,
      marginTop: 8,
      alignItems: 'center',
    },
  },
};

export default function EmployeeSchedule() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';
  const successScale = useRef(new Animated.Value(0)).current;
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [schedule, setSchedule] = useState<{ [key: string]: ScheduleEvent[] }>({});
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);

  // Fetch schedule data
  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/schedule`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Transform the data into a format grouped by date
      const scheduleByDate: { [key: string]: ScheduleEvent[] } = {};
      response.data.forEach((event: ScheduleEvent) => {
        // Ensure date is in yyyy-MM-dd format
        const dateKey = format(new Date(event.date), 'yyyy-MM-dd');
        if (!scheduleByDate[dateKey]) {
          scheduleByDate[dateKey] = [];
        }
        scheduleByDate[dateKey].push({
          ...event,
          date: dateKey // Ensure consistent date format
        });
      });

      console.log('Schedules by date:', scheduleByDate); // Debug log
      setSchedule(scheduleByDate);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      Alert.alert('Error', 'Failed to fetch schedule');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEvent = async (eventData: Partial<ScheduleEvent>) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.replace('/(auth)/signin' as any);
        return;
      }

      console.log('Submitting event data:', eventData); // Debug log

      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/schedule`,
        eventData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Update local state with consistent date format
      const newEvent = response.data;
      const formattedDate = format(new Date(newEvent.date), 'yyyy-MM-dd');
      
      setSchedule(prev => ({
        ...prev,
        [formattedDate]: [...(prev[formattedDate] || []), {
          ...newEvent,
          date: formattedDate
        }],
      }));

      setIsAddModalVisible(false);
      Alert.alert('Success', 'Event added successfully');
      
      // Refresh schedule after adding new event
      fetchSchedule();
    } catch (error) {
      console.error('Error adding event:', error);
      Alert.alert('Error', 'Failed to add event');
    }
  };

  const showSuccessAnimation = () => {
    setShowSuccess(true);
    Animated.sequence([
      Animated.spring(successScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
        stiffness: 200,
      }),
    ]).start();

    // Auto hide after 2 seconds
    setTimeout(() => {
      setShowSuccess(false);
      successScale.setValue(0);
    }, 2000);
  };

  const handleAddSchedule = async (scheduleData: {
    title: string;
    description: string;
    location: string;
    time: string;
    date: string;
  }) => {
    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/schedule`,
        scheduleData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Update local state
      const newEvent = response.data;
      setSchedule(prev => ({
        ...prev,
        [scheduleData.date]: [
          ...(prev[scheduleData.date] || []),
          newEvent
        ]
      }));

      setIsAddModalVisible(false);
      showSuccessAnimation();
    } catch (error) {
      console.error('Error adding schedule:', error);
      Alert.alert('Error', 'Failed to add schedule');
    }
  };

  const handleEditSchedule = (event: ScheduleEvent) => {
    setSelectedEvent(event);
    setEditModalVisible(true);
  };

  const handleDeleteSchedule = async (eventId: number) => {
    Alert.alert(
      'Delete Schedule',
      'Are you sure you want to delete this schedule?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(
                `${process.env.EXPO_PUBLIC_API_URL}/api/schedule/${eventId}`,
                {
                  headers: { Authorization: `Bearer ${token}` }
                }
              );
              fetchSchedule(); // Refresh the schedule list
              Alert.alert('Success', 'Schedule deleted successfully');
            } catch (error) {
              console.error('Error deleting schedule:', error);
              Alert.alert('Error', 'Failed to delete schedule');
            }
          }
        }
      ]
    );
  };

  const handleUpdateSchedule = async (scheduleData: {
    id: number;
    title: string;
    description: string;
    location: string;
    time: string;
    date: string;
  }) => {
    try {
      const response = await axios.patch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/schedule/${scheduleData.id}`,
        scheduleData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      fetchSchedule(); // Refresh the schedule list
      setEditModalVisible(false);
      setSelectedEvent(null);
      Alert.alert('Success', 'Schedule updated successfully');
    } catch (error) {
      console.error('Error updating schedule:', error);
      Alert.alert('Error', 'Failed to update schedule');
    }
  };

  const markedDates = React.useMemo(() => {
    const dates: any = {};
    Object.keys(schedule).forEach(date => {
      dates[date] = {
        marked: true,
        dotColor: '#3B82F6',
        selected: date === selectedDate,
        selectedColor: date === selectedDate ? '#3B82F6' : undefined
      };
    });
    return dates;
  }, [selectedDate, schedule]);

  const renderScheduleItem = (event: ScheduleEvent) => (
    <TouchableOpacity 
      key={event.id} 
      className={`mb-4 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
      style={styles.eventCard}
      onPress={() => {
        setSelectedEvent(event);
        setEditModalVisible(true);
      }}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {event.title}
          </Text>
          {event.description && (
            <Text className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {event.description}
            </Text>
          )}
          <View className="flex-row items-center mt-2">
            <Ionicons 
              name="time-outline" 
              size={16} 
              color={isDark ? '#9CA3AF' : '#6B7280'} 
            />
            <Text className={`ml-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {event.time}
            </Text>
            {event.location && (
              <View className="flex-row items-center ml-4">
                <Ionicons 
                  name="location-outline" 
                  size={16} 
                  color={isDark ? '#9CA3AF' : '#6B7280'} 
                />
                <Text className={`ml-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {event.location}
                </Text>
              </View>
            )}
          </View>
        </View>
        
        <View className="flex-row justify-end mt-2">
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              setSelectedEvent(event);
              setEditModalVisible(true);
            }}
            className="mr-4"
          >
            <Ionicons 
              name="pencil-outline" 
              size={20} 
              color={isDark ? '#60A5FA' : '#3B82F6'} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleDeleteSchedule(event.id);
            }}
          >
            <Ionicons 
              name="trash-outline" 
              size={20} 
              color={isDark ? '#EF4444' : '#DC2626'} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Add a debug section to show current state (remove in production)
  useEffect(() => {
    console.log('Selected date:', selectedDate);
    console.log('Events for selected date:', schedule[selectedDate]);
  }, [selectedDate, schedule]);

  // Add this useEffect for debugging
  useEffect(() => {
    console.log('Current schedule state:', schedule);
    console.log('Selected date:', selectedDate);
    console.log('Events for selected date:', schedule[selectedDate]);
  }, [schedule, selectedDate]);

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* Updated Header with LinearGradient */}
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
            Schedule
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView className="flex-1">
        {/* Calendar with swipe gestures */}
        <View className={`mx-4 mt-4 rounded-lg overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`} 
          style={styles.calendarContainer}>
          <Calendar
            current={selectedDate}
            onDayPress={(day: CalendarDay) => setSelectedDate(day.dateString)}
            onPressArrowLeft={(subtractMonth: () => void) => subtractMonth()}
            onPressArrowRight={(addMonth: () => void) => addMonth()}
            enableSwipeMonths={true}
            markedDates={{
              [selectedDate]: {
                selected: true,
                selectedColor: '#3B82F6'
              }
            }}
            theme={{
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
              calendarBackground: isDark ? '#1F2937' : '#FFFFFF',
              textSectionTitleColor: isDark ? '#9CA3AF' : '#6B7280',
              selectedDayBackgroundColor: '#3B82F6',
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: '#3B82F6',
              dayTextColor: isDark ? '#FFFFFF' : '#111827',
              textDisabledColor: isDark ? '#4B5563' : '#D1D5DB',
              monthTextColor: isDark ? '#FFFFFF' : '#111827',
              arrowColor: '#3B82F6',
              ...calendarTheme
            }}
          />
        </View>

        {/* Schedule List */}
        <View className="p-4">
          <View className="flex-row justify-between items-center mb-4">
            <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {format(new Date(selectedDate), 'MMMM d, yyyy')}
            </Text>
          </View>
          
          {isLoading ? (
            <View className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={styles.scheduleCard}>
              <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Loading schedules...
              </Text>
            </View>
          ) : schedule[selectedDate]?.length > 0 ? (
            schedule[selectedDate].map((event) => (
              <TouchableOpacity
                key={event.id}
                onPress={() => {
                  setSelectedEvent(event);
                  setEditModalVisible(true);
                }}
                className={`mb-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                style={styles.scheduleCard}
              >
                <View className="p-4">
                  <View className="flex-row justify-between items-start">
                    <Text className={`text-lg font-semibold flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {event.title}
                    </Text>
                    <View className="flex-row space-x-2">
                      <TouchableOpacity
                        className={`p-2 rounded-full ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'}`}
                        onPress={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(event);
                          setEditModalVisible(true);
                        }}
                      >
                        <Ionicons 
                          name="pencil-outline" 
                          size={16} 
                          color={isDark ? '#60A5FA' : '#3B82F6'} 
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        className={`p-2 rounded-full ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'}`}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteSchedule(event.id);
                        }}
                      >
                        <Ionicons 
                          name="trash-outline" 
                          size={16} 
                          color={isDark ? '#EF4444' : '#DC2626'} 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View className="flex-row items-center mt-3">
                    <Ionicons 
                      name="time-outline" 
                      size={16} 
                      color={isDark ? '#9CA3AF' : '#6B7280'} 
                    />
                    <Text className={`ml-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {format(new Date(`2000-01-01T${event.time}`), 'hh:mm a')}
                    </Text>
                    {event.location && (
                      <>
                        <Text className={`mx-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>•</Text>
                        <Ionicons 
                          name="location-outline" 
                          size={16} 
                          color={isDark ? '#9CA3AF' : '#6B7280'} 
                        />
                        <Text className={`ml-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {event.location}
                        </Text>
                      </>
                    )}
                  </View>

                  {event.description && (
                    <Text className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {event.description}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View 
              className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              style={styles.scheduleCard}
            >
              <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                No schedules for this day
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        className={`absolute bottom-6 right-6 flex-row items-center px-4 py-3 rounded-full ${
          isDark ? 'bg-blue-500' : 'bg-blue-500'
        }`}
        style={styles.fab}
        onPress={() => setIsAddModalVisible(true)}
      >
        <Ionicons 
          name="add" 
          size={24} 
          color="#FFFFFF"
        />
        <Text className="text-white font-medium ml-2">
          Add Schedule
        </Text>
      </TouchableOpacity>

      {/* Success Modal */}
      {showSuccess && (
        <Animated.View 
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 50,
            },
            {
              transform: [{ scale: successScale }],
            }
          ]}
        >
          <View style={{ alignItems: 'center', padding: 24 }}>
            <View style={{ 
              width: 80, 
              height: 80, 
              borderRadius: 40, 
              backgroundColor: isDark ? 'rgba(74, 222, 128, 0.2)' : 'rgba(74, 222, 128, 0.1)',
              justifyContent: 'center', 
              alignItems: 'center',
              marginBottom: 16
            }}>
              <MaterialCommunityIcons
                name="check-circle"
                size={40}
                color={isDark ? "#4ADE80" : "#22C55E"}
              />
            </View>
            <Text style={{ 
              fontSize: 24, 
              fontWeight: '600',
              marginBottom: 8,
              color: isDark ? '#FFFFFF' : '#111827'
            }}>
              Success!
            </Text>
            <Text style={{ 
              fontSize: 16,
              textAlign: 'center',
              color: isDark ? '#9CA3AF' : '#4B5563'
            }}>
              Schedule has been added successfully
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Modals */}
      <AddScheduleModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        onSubmit={handleAddSchedule}
        selectedDate={selectedDate}
        isDark={isDark}
      />
      
      <EditScheduleModal
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedEvent(null);
        }}
        onSubmit={handleUpdateSchedule}
        schedule={selectedEvent}
        isDark={isDark}
      />
    </View>
  );
}

// Add to styles
const styles = StyleSheet.create({
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  fab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    zIndex: 1000,
  },
  calendarContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 16,
  },
  eventCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  scheduleCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
});
