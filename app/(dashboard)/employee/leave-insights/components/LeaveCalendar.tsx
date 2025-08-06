import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useColorScheme } from '../../../../../app/hooks/useColorScheme';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isWeekend,
} from 'date-fns';

interface LeaveRequest {
  id: number;
  user_id: number;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected';
  is_paid: boolean;
}

interface Holiday {
  date: string;
  name: string;
  is_full_day: boolean;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  leaves: LeaveRequest[];
}

export default function LeaveCalendar() {
  const isDark = useColorScheme() === 'dark';
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);

      // Fetch leaves
      const leavesResponse = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave/team-calendar`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          params: {
            start_date: format(start, 'yyyy-MM-dd'),
            end_date: format(end, 'yyyy-MM-dd')
          }
        }
      );

      // Fetch holidays
      const holidaysResponse = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/holidays`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          params: {
            start_date: format(start, 'yyyy-MM-dd'),
            end_date: format(end, 'yyyy-MM-dd')
          }
        }
      );

      setLeaves(leavesResponse.data);
      setHolidays(holidaysResponse.data);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching calendar data:', error);
      setError(error.response?.data?.error || 'Failed to fetch calendar data');
    } finally {
      setLoading(false);
    }
  };

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    return days.map(day => {
      const dayLeaves = leaves.filter(leave => {
        const leaveStart = new Date(leave.start_date);
        const leaveEnd = new Date(leave.end_date);
        return day >= leaveStart && day <= leaveEnd;
      });

      const holiday = holidays.find(h => isSameDay(new Date(h.date), day));

      return {
        date: day,
        isCurrentMonth: isSameMonth(day, currentMonth),
        isWeekend: isWeekend(day),
        isHoliday: !!holiday,
        holidayName: holiday?.name,
        leaves: dayLeaves,
      };
    });
  }, [currentMonth, leaves, holidays]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const getDayColor = (day: CalendarDay) => {
    if (day.isHoliday) return isDark ? '#EF4444' : '#DC2626';
    if (day.isWeekend) return isDark ? '#6B7280' : '#9CA3AF';
    return isDark ? '#FFFFFF' : '#000000';
  };

  const renderDayContent = (day: CalendarDay) => {
    const hasLeaves = day.leaves.length > 0;
    const approvedLeaves = day.leaves.filter(l => l.status === 'approved');
    const pendingLeaves = day.leaves.filter(l => l.status === 'pending');

    return (
      <View>
        <Text
          className={`text-sm font-medium ${
            day.isCurrentMonth
              ? isDark ? 'text-white' : 'text-gray-900'
              : isDark ? 'text-gray-600' : 'text-gray-400'
          }`}
          style={{ color: getDayColor(day) }}
        >
          {format(day.date, 'd')}
        </Text>
        {day.isHoliday && (
          <Text className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`} numberOfLines={1}>
            {day.holidayName}
          </Text>
        )}
        {hasLeaves && (
          <View className="flex-row mt-1">
            {approvedLeaves.length > 0 && (
              <View className={`w-2 h-2 rounded-full ${isDark ? 'bg-green-400' : 'bg-green-600'} mr-1`} />
            )}
            {pendingLeaves.length > 0 && (
              <View className={`w-2 h-2 rounded-full ${isDark ? 'bg-yellow-400' : 'bg-yellow-600'}`} />
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text className={`text-center mb-4 ${isDark ? 'text-red-400' : 'text-red-500'}`}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={fetchData}
          className="bg-blue-500 px-4 py-2 rounded-full"
        >
          <Text className="text-white">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1">
      <View className="p-4">
        {/* Month Navigation */}
        <View className="flex-row justify-between items-center mb-4">
          <TouchableOpacity
            onPress={() => navigateMonth('prev')}
            className={`p-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </TouchableOpacity>
          <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {format(currentMonth, 'MMMM yyyy')}
          </Text>
          <TouchableOpacity
            onPress={() => navigateMonth('next')}
            className={`p-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <View className="flex-row flex-wrap">
          {/* Weekday Headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
            <View
              key={day}
              style={{ width: screenWidth / 7 - 8 }}
              className="items-center p-2"
            >
              <Text className={`text-sm font-medium ${
                index === 0 || index === 6
                  ? isDark ? 'text-gray-500' : 'text-gray-400'
                  : isDark ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {day}
              </Text>
            </View>
          ))}

          {/* Calendar Days */}
          {calendarDays.map((day, index) => (
            <TouchableOpacity
              key={index}
              style={{ width: screenWidth / 7 - 8 }}
              className={`p-2 min-h-[80px] border ${
                isDark
                  ? 'border-gray-700 bg-gray-800'
                  : 'border-gray-200 bg-white'
              } ${
                selectedDate && isSameDay(day.date, selectedDate)
                  ? isDark ? 'bg-gray-700' : 'bg-blue-50'
                  : ''
              }`}
              onPress={() => setSelectedDate(day.date)}
            >
              {renderDayContent(day)}
            </TouchableOpacity>
          ))}
        </View>

        {/* Legend */}
        <View className="mt-4 p-4 rounded-lg bg-opacity-50 flex-row justify-around items-center">
          <View className="flex-row items-center">
            <View className={`w-3 h-3 rounded-full ${isDark ? 'bg-green-400' : 'bg-green-600'} mr-2`} />
            <Text className={isDark ? 'text-gray-300' : 'text-gray-600'}>Approved</Text>
          </View>
          <View className="flex-row items-center">
            <View className={`w-3 h-3 rounded-full ${isDark ? 'bg-yellow-400' : 'bg-yellow-600'} mr-2`} />
            <Text className={isDark ? 'text-gray-300' : 'text-gray-600'}>Pending</Text>
          </View>
          <View className="flex-row items-center">
            <View className={`w-3 h-3 rounded-full ${isDark ? 'bg-red-400' : 'bg-red-600'} mr-2`} />
            <Text className={isDark ? 'text-gray-300' : 'text-gray-600'}>Holiday</Text>
          </View>
        </View>

        {/* Selected Day Details */}
        {selectedDate && (
          <View className="mt-4">
            <Text className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </Text>
            {calendarDays.find(day => isSameDay(day.date, selectedDate))?.leaves.map((leave, index) => (
              <View
                key={index}
                className={`p-3 rounded-lg mb-2 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              >
                <View className="flex-row justify-between items-center">
                  <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {leave.employee_name}
                  </Text>
                  <View className={`px-2 py-1 rounded-full ${
                    leave.status === 'approved'
                      ? isDark ? 'bg-green-900' : 'bg-green-100'
                      : isDark ? 'bg-yellow-900' : 'bg-yellow-100'
                  }`}>
                    <Text className={
                      leave.status === 'approved'
                        ? isDark ? 'text-green-400' : 'text-green-600'
                        : isDark ? 'text-yellow-400' : 'text-yellow-600'
                    }>
                      {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {leave.leave_type} ({leave.is_paid ? 'Paid' : 'Unpaid'})
                </Text>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {format(new Date(leave.start_date), 'MMM d')} - {format(new Date(leave.end_date), 'MMM d')}
                </Text>
              </View>
            ))}
            {calendarDays.find(day => isSameDay(day.date, selectedDate))?.isHoliday && (
              <View className={`p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                <Text className={`font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  Holiday
                </Text>
                <Text className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {calendarDays.find(day => isSameDay(day.date, selectedDate))?.holidayName}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
} 