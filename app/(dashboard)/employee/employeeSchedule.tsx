import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../context/ThemeContext';
import { Calendar, AgendaList, CalendarProvider } from 'react-native-calendars';
import { format } from 'date-fns';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthContext from '../../context/AuthContext';
import { AddEventModal } from './components/AddEventModal';

interface ScheduleEvent {
  id: number;
  title: string;
  time: string;
  location: string;
  description?: string;
  date: string;
  userId: number;
}

interface AddEventModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (event: Partial<ScheduleEvent>) => void;
  selectedDate: string;
}

export default function EmployeeSchedule() {
  const { theme } = ThemeContext.useTheme();
  const { user } = AuthContext.useAuth();
  const router = useRouter();
  
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [schedule, setSchedule] = useState<{ [key: string]: ScheduleEvent[] }>({});
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isDark = theme === 'dark';

  // Fetch schedule data
  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.replace('/(auth)/login');
        return;
      }

      const response = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/schedule`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('Fetched schedule data:', response.data); // Debug log

      // Transform the data into the required format with consistent date format
      const formattedSchedule: { [key: string]: ScheduleEvent[] } = {};
      response.data.forEach((event: ScheduleEvent) => {
        // Format the date consistently
        const formattedDate = format(new Date(event.date), 'yyyy-MM-dd');
        
        if (!formattedSchedule[formattedDate]) {
          formattedSchedule[formattedDate] = [];
        }
        formattedSchedule[formattedDate].push({
          ...event,
          date: formattedDate // Ensure consistent date format
        });
      });

      console.log('Formatted schedule:', formattedSchedule); // Debug log
      setSchedule(formattedSchedule);
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
        router.replace('/(auth)/login');
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

  const renderScheduleItem = (item: ScheduleEvent) => (
    <View 
      key={item.id} 
      className={`mb-4 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
    >
      <View className="flex-row justify-between items-center mb-2">
        <Text className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {item.time}
        </Text>
        <View className="flex-row items-center">
          <Ionicons 
            name="location-outline" 
            size={16} 
            color={isDark ? '#9CA3AF' : '#6B7280'} 
          />
          <Text className={`ml-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {item.location || 'No location'}
          </Text>
        </View>
      </View>
      <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {item.title}
      </Text>
      {item.description && (
        <Text className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {item.description}
        </Text>
      )}
    </View>
  );

  // Add a debug section to show current state (remove in production)
  useEffect(() => {
    console.log('Selected date:', selectedDate);
    console.log('Events for selected date:', schedule[selectedDate]);
  }, [selectedDate, schedule]);

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
          Schedule
        </Text>
        <TouchableOpacity>
          <Ionicons 
            name="filter" 
            size={24} 
            color={isDark ? '#FFFFFF' : '#111827'} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1">
        {/* Calendar */}
        <View className={`mx-4 mt-4 rounded-lg overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Calendar
            current={selectedDate}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            markedDates={markedDates}
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
            }}
          />
        </View>

        {/* Schedule List */}
        <View className="p-4">
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {format(new Date(selectedDate), 'MMMM d, yyyy')}
          </Text>
          
          {isLoading ? (
            <View className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
              <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Loading...
              </Text>
            </View>
          ) : schedule[selectedDate] && schedule[selectedDate].length > 0 ? (
            schedule[selectedDate].map(renderScheduleItem)
          ) : (
            <View className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
              <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                No events scheduled for this day
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Event FAB */}
      <TouchableOpacity 
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-500 items-center justify-center"
        onPress={() => setIsAddModalVisible(true)}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Event Modal */}
      <AddEventModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        onSubmit={handleAddEvent}
        selectedDate={selectedDate}
      />
    </View>
  );
}
