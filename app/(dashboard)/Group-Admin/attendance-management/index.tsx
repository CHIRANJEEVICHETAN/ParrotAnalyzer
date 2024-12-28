import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { format } from 'date-fns';
import { Picker } from '@react-native-picker/picker';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Employee {
  id: number;
  name: string;
  employee_number: string;
}

interface AttendanceData {
  id: number;
  user_id: number;
  employee_name: string;
  employee_number: string;
  date: string;
  shifts: any[];
  total_hours: number;
  total_distance: number;
  total_expenses: number;
  shift_count: number;
}

interface CalendarDay {
  timestamp: number;
  dateString: string;
  day: number;
  month: number;
  year: number;
}

// Add these cache keys
const CACHE_KEYS = {
  EMPLOYEES: 'admin_employees',
  ATTENDANCE: 'admin_attendance_',
  LAST_FETCH: 'admin_attendance_last_fetch_'
};

// Add cache duration (e.g., 1 hour in milliseconds)
const CACHE_DURATION = 60 * 60 * 1000;

export default function AdminAttendanceManagement() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceData, setAttendanceData] = useState<{ [key: string]: AttendanceData[] }>({});
  const [monthStats, setMonthStats] = useState({
    totalEmployees: 0,
    totalShifts: 0,
    avgHours: 0,
    totalExpenses: 0,
  });
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(true);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      const newMonth = format(selectedDate, 'yyyy-MM');
      if (newMonth !== currentMonth || selectedEmployee) {
        setCurrentMonth(newMonth);
        fetchAttendanceData(newMonth);
      }
    }
  }, [selectedDate, selectedEmployee, employees]);

  const fetchEmployees = async () => {
    try {
      setIsEmployeesLoading(true);
      setError(null);

      // Try to get cached employees data
      const cachedData = await AsyncStorage.getItem(CACHE_KEYS.EMPLOYEES);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        const isExpired = Date.now() - timestamp > CACHE_DURATION;

        if (!isExpired) {
          setEmployees(data);
          setMonthStats(prev => ({
            ...prev,
            totalEmployees: data.length
          }));
          setIsEmployeesLoading(false);
          return;
        }
      }

      // If no cache or expired, fetch from API
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/employees`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Cache the new data
      await AsyncStorage.setItem(CACHE_KEYS.EMPLOYEES, JSON.stringify({
        data: response.data,
        timestamp: Date.now()
      }));

      setEmployees(response.data);
      setMonthStats(prev => ({
        ...prev,
        totalEmployees: response.data.length
      }));
    } catch (error) {
      console.error('Error fetching employees:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch employees';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsEmployeesLoading(false);
    }
  };

  const fetchAttendanceData = async (month: string) => {
    try {
      setIsAttendanceLoading(true);
      setError(null);
      const cacheKey = `${CACHE_KEYS.ATTENDANCE}${month}_${selectedEmployee}`;
      const lastFetchKey = `${CACHE_KEYS.LAST_FETCH}${month}_${selectedEmployee}`;

      // Try to get cached attendance data
      const cachedData = await AsyncStorage.getItem(cacheKey);
      const lastFetch = await AsyncStorage.getItem(lastFetchKey);

      if (cachedData && lastFetch) {
        const isExpired = Date.now() - parseInt(lastFetch) > CACHE_DURATION;

        if (!isExpired) {
          const attendance = JSON.parse(cachedData);
          setAttendanceData(attendance);
          const allAttendance = Object.values(attendance).reduce<AttendanceData[]>((acc, curr) => {
            return acc.concat(curr as AttendanceData[]);
          }, []);
          calculateMonthStats(allAttendance);
          setIsAttendanceLoading(false);
          return;
        }
      }

      // If no cache or expired, fetch from API
      const url = `${process.env.EXPO_PUBLIC_API_URL}/api/employee/admin/attendance/${month}`;
      const params = selectedEmployee !== 'all' ? { employee_id: selectedEmployee } : {};
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      const { attendance } = response.data;

      // Cache the new data
      await AsyncStorage.setItem(cacheKey, JSON.stringify(attendance));
      await AsyncStorage.setItem(lastFetchKey, Date.now().toString());

      setAttendanceData(attendance);
      const allAttendance = Object.values(attendance).reduce<AttendanceData[]>((acc, curr) => {
        return acc.concat(curr as AttendanceData[]);
      }, []);
      calculateMonthStats(allAttendance);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch attendance data';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsAttendanceLoading(false);
    }
  };

  const calculateMonthStats = (data: AttendanceData[]) => {
    if (!data || data.length === 0) {
      setMonthStats({
        totalEmployees: employees.length,
        totalShifts: 0,
        avgHours: 0,
        totalExpenses: 0,
      });
      return;
    }

    const stats = data.reduce((acc, curr) => ({
      totalEmployees: employees.length,
      totalShifts: acc.totalShifts + (Number(curr.shift_count) || 0),
      avgHours: acc.avgHours + (Number(curr.total_hours) || 0),
      totalExpenses: acc.totalExpenses + (Number(curr.total_expenses) || 0),
    }), {
      totalEmployees: employees.length,
      totalShifts: 0,
      avgHours: 0,
      totalExpenses: 0,
    });

    const numberOfDays = data.length || 1;
    stats.avgHours = stats.avgHours / numberOfDays;

    setMonthStats(stats);
  };

  const getMarkedDates = () => {
    const marked: { [key: string]: any } = {};
    Object.keys(attendanceData).forEach(date => {
      marked[date] = {
        marked: true,
        dotColor: isDark ? '#60A5FA' : '#3B82F6',
        selected: format(selectedDate, 'yyyy-MM-dd') === date,
        selectedColor: isDark ? '#1E40AF' : '#93C5FD',
      };
    });
    return marked;
  };

  // Add cache clearing function
  const clearCache = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => 
        key.startsWith(CACHE_KEYS.ATTENDANCE) || 
        key.startsWith(CACHE_KEYS.LAST_FETCH) ||
        key === CACHE_KEYS.EMPLOYEES
      );
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  // Add cache clearing on error
  useEffect(() => {
    return () => {
      // Clear cache when component unmounts if there was an error
      if (error) {
        clearCache();
      }
    };
  }, [error]);

  return (
    <View className="flex-1">
      <LinearGradient
        colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        className="pb-4"
        style={[
          styles.header,
          { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 0 }
        ]}
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
            Employee Attendance
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Employee Filter */}
        <View className="mx-6 mt-4">
          <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Select Employee
          </Text>
          <View
            className={`rounded-xl overflow-hidden ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
            style={[
              styles.pickerContainer, 
              { 
                borderWidth: 1, 
                borderColor: isDark ? '#374151' : '#E5E7EB',
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF'
              }
            ]}
          >
            <Picker
              selectedValue={selectedEmployee}
              onValueChange={(value) => setSelectedEmployee(value)}
              dropdownIconColor={isDark ? '#FFFFFF' : '#000000'}
              style={{
                backgroundColor: 'transparent',
                color: isDark ? '#FFFFFF' : '#000000',
                height: Platform.OS === 'ios' ? 120 : 50,
                paddingHorizontal: 12,
              }}
              itemStyle={{
                fontSize: 16,
                height: Platform.OS === 'ios' ? 120 : 50,
                color: isDark ? '#FFFFFF' : '#000000',
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                paddingHorizontal: 12,
              }}
            >
              <Picker.Item 
                label="👥 All Employees" 
                value="all"
                style={{
                  fontSize: 16,
                  color: isDark ? '#FFFFFF' : '#000000',
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                }}
              />
              {employees.map((emp) => (
                <Picker.Item
                  key={emp.id}
                  label={`👤 ${emp.name} (${emp.employee_number})`}
                  value={emp.id.toString()}
                  style={{
                    fontSize: 16,
                    color: isDark ? '#FFFFFF' : '#000000',
                    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                  }}
                />
              ))}
            </Picker>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
        showsVerticalScrollIndicator={false}
      >
        {/* Monthly Stats */}
        <View className="flex-row flex-wrap p-4">
          {[
            {
              title: 'Total Employees',
              value: isEmployeesLoading ? '-' : monthStats.totalEmployees.toString(),
              icon: 'people-outline',
              color: 'bg-blue-500',
              isLoading: isEmployeesLoading
            },
            {
              title: 'Total Shifts',
              value: monthStats.totalShifts.toString(),
              icon: 'time-outline',
              color: 'bg-green-500',
              isLoading: false
            },
            {
              title: 'Avg Hours/Day',
              value: monthStats.avgHours?.toFixed(1) || '0.0',
              icon: 'stats-chart-outline',
              color: 'bg-purple-500',
              isLoading: false
            },
            {
              title: 'Total Expenses',
              value: `₹${monthStats.totalExpenses?.toFixed(0) || '0'}`,
              icon: 'cash-outline',
              color: 'bg-orange-500',
              isLoading: false
            },
          ].map((stat, index) => (
            <View key={index} className="w-1/2 p-2">
              <View
                className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                style={styles.statCard}
              >
                <View className={`w-10 h-10 rounded-full items-center justify-center ${stat.color}`}>
                  <Ionicons name={stat.icon as any} size={20} color="white" />
                </View>
                {stat.isLoading ? (
                  <ActivityIndicator 
                    size="small" 
                    color={isDark ? '#60A5FA' : '#3B82F6'} 
                    style={{ marginTop: 8 }}
                  />
                ) : (
                  <>
                    <Text className={`mt-2 text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {stat.value}
                    </Text>
                    <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {stat.title}
                    </Text>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Calendar */}
        <View
          className={`mx-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          style={styles.calendarCard}
        >
          <Calendar
            theme={{
              calendarBackground: 'transparent',
              textSectionTitleColor: isDark ? '#9CA3AF' : '#6B7280',
              selectedDayBackgroundColor: isDark ? '#1E40AF' : '#93C5FD',
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: isDark ? '#60A5FA' : '#3B82F6',
              dayTextColor: isDark ? '#FFFFFF' : '#111827',
              textDisabledColor: isDark ? '#4B5563' : '#D1D5DB',
              monthTextColor: isDark ? '#FFFFFF' : '#111827',
              arrowColor: isDark ? '#FFFFFF' : '#111827',
            }}
            markedDates={getMarkedDates()}
            onDayPress={(day: CalendarDay) => setSelectedDate(new Date(day.timestamp))}
            maxDate={format(new Date(), 'yyyy-MM-dd')}
          />
        </View>

        {/* Attendance Details */}
        {isAttendanceLoading ? (
          <View className="m-4 p-8">
            <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
          </View>
        ) : attendanceData[format(selectedDate, 'yyyy-MM-dd')]?.length > 0 ? (
          attendanceData[format(selectedDate, 'yyyy-MM-dd')].map((attendance, index) => (
            <View
              key={index}
              className={`m-4 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              style={styles.detailCard}
            >
              <Text className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {attendance.employee_name}
              </Text>
              <Text className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Employee ID: {attendance.employee_number}
              </Text>

              <View className="space-y-3">
                {[
                  {
                    label: 'Total Shifts',
                    value: attendance.shift_count?.toString() || '0',
                    icon: 'time-outline'
                  },
                  {
                    label: 'Total Hours',
                    value: `${Number(attendance.total_hours)?.toFixed(1) || '0.0'} hrs`,
                    icon: 'hourglass-outline'
                  },
                  {
                    label: 'Total Distance',
                    value: `${Number(attendance.total_distance)?.toFixed(1) || '0.0'} km`,
                    icon: 'map-outline'
                  },
                  {
                    label: 'Total Expenses',
                    value: `₹${Number(attendance.total_expenses)?.toFixed(2) || '0.00'}`,
                    icon: 'cash-outline'
                  }
                ].map((detail, detailIndex) => (
                  <View key={detailIndex} className="flex-row items-center">
                    <View className={`w-8 h-8 rounded-full items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <Ionicons
                        name={detail.icon as any}
                        size={16}
                        color={isDark ? '#60A5FA' : '#3B82F6'}
                      />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {detail.label}
                      </Text>
                      <Text className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {detail.value}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))
        ) : (
          <View
            className={`m-4 p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            style={styles.detailCard}
          >
            <View className="items-center">
              <Ionicons
                name="calendar-outline"
                size={48}
                color={isDark ? '#4B5563' : '#9CA3AF'}
              />
              <Text
                className={`mt-4 text-center text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
              >
                No attendance records found
              </Text>
              <Text
                className={`mt-2 text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
              >
                {format(selectedDate, 'MMMM d, yyyy')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
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
  },
  statCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  calendarCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  detailCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  pickerContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
}); 