import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
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
  startOfWeek,
  endOfWeek,
  getDay,
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
  const { width: screenWidth } = Dimensions.get('window');
  
  // Calculate responsive dimensions
  // Account for parent container padding (10px) and additional spacing
  const parentPadding = 10;
  const additionalPadding = 8;
  const totalPadding = (parentPadding + additionalPadding) * 2;
  const calendarWidth = screenWidth - totalPadding;
  const dayWidth = calendarWidth / 7;
  const dayHeight = Math.max(dayWidth * 0.8, 70);
  
  // Ensure the calendar container fits properly within screen bounds
  const adjustedDayWidth = Math.max(dayWidth, 40); // Minimum width for readability

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

      // Fetch holidays (handle case where table might not exist or be empty)
      let holidaysData = [];
      try {
        const holidaysResponse = await axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/leave/holidays`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
              start_date: format(start, 'yyyy-MM-dd'),
              end_date: format(end, 'yyyy-MM-dd')
            }
          }
        );
        holidaysData = holidaysResponse.data || [];
      } catch (holidayError: any) {
        console.log('Holidays not available or table does not exist:', holidayError.message);
        // Set empty array for holidays - this is not a critical error
        holidaysData = [];
      }

      setLeaves(leavesResponse.data || []);
      setHolidays(holidaysData);
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
    
    // Get the start and end of the calendar grid (including previous/next month dates)
    // Use date-fns startOfWeek with Monday as first day
    const calendarStart = startOfWeek(start, { weekStartsOn: 1 }); // Monday as first day
    
    // Calculate exactly 6 weeks (42 days) from the start
    const totalDays = 42;
    const days: Date[] = [];
    
    for (let i = 0; i < totalDays; i++) {
      const day = new Date(calendarStart);
      day.setDate(calendarStart.getDate() + i);
      days.push(day);
    }
    

    


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
    if (!day.isCurrentMonth) return isDark ? '#4B5563' : '#D1D5DB';
    if (day.isHoliday && day.isCurrentMonth) return isDark ? '#EF4444' : '#DC2626';
    if (day.isWeekend && day.isCurrentMonth) return isDark ? '#6B7280' : '#9CA3AF';
    return isDark ? '#FFFFFF' : '#000000';
  };

  const renderDayContent = (day: CalendarDay) => {
    const hasLeaves = day.leaves.length > 0;
    const approvedLeaves = day.leaves.filter(l => l.status === 'approved');
    const pendingLeaves = day.leaves.filter(l => l.status === 'pending');

    return (
      <View style={styles.dayContent}>
        <Text
          style={[
            styles.dayNumber,
            {
              color: getDayColor(day),
              opacity: day.isCurrentMonth ? 1 : 0.4,
              fontWeight: day.isCurrentMonth ? '600' : '400',
            }
          ]}
        >
          {format(day.date, 'd')}
        </Text>
        {day.isHoliday && day.isCurrentMonth && (
          <Text 
            style={[
              styles.holidayText,
              { color: isDark ? '#FCA5A5' : '#DC2626' }
            ]} 
            numberOfLines={1}
          >
            {day.holidayName}
          </Text>
        )}
        {hasLeaves && day.isCurrentMonth && (
          <View style={styles.leaveIndicators}>
            {approvedLeaves.length > 0 && (
              <View style={[
                styles.leaveIndicator,
                { backgroundColor: isDark ? '#34D399' : '#059669' }
              ]} />
            )}
            {pendingLeaves.length > 0 && (
              <View style={[
                styles.leaveIndicator,
                { 
                  backgroundColor: isDark ? '#FBBF24' : '#D97706',
                  marginLeft: approvedLeaves.length > 0 ? 4 : 0
                }
              ]} />
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
    <ScrollView style={styles.container}>
      <View style={[styles.content, { paddingHorizontal: additionalPadding }]}>
        {/* Month Navigation */}
        <View style={styles.monthNavigation}>
          <TouchableOpacity
            onPress={() => navigateMonth('prev')}
            style={[
              styles.navButton,
              { backgroundColor: isDark ? '#374151' : '#F3F4F6' }
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </TouchableOpacity>
          <Text style={[
            styles.monthTitle,
            { color: isDark ? '#FFFFFF' : '#111827' }
          ]}>
            {format(currentMonth, 'MMMM yyyy')}
          </Text>
          <TouchableOpacity
            onPress={() => navigateMonth('next')}
            style={[
              styles.navButton,
              { backgroundColor: isDark ? '#374151' : '#F3F4F6' }
            ]}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </TouchableOpacity>
        </View>

        {/* Calendar Container */}
        <View style={[
          styles.calendarContainer,
          { 
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? '#374151' : '#E5E7EB'
          }
        ]}>
          {/* Weekday Headers */}
          <View style={styles.weekdayHeader}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
              <View
                key={day}
                style={[styles.weekdayCell, { width: adjustedDayWidth }]}
              >
                <Text style={[
                  styles.weekdayText,
                  {
                    color: index === 5 || index === 6
                      ? (isDark ? '#6B7280' : '#9CA3AF')
                      : (isDark ? '#D1D5DB' : '#6B7280')
                  }
                ]}>
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {Array.from({ length: 6 }, (_, weekIndex) => (
              <View key={weekIndex} style={styles.weekRow}>
                {Array.from({ length: 7 }, (_, dayIndex) => {
                  const index = weekIndex * 7 + dayIndex;
                  const day = calendarDays[index];
                  return (
                    <TouchableOpacity
                      key={`${format(day.date, 'yyyy-MM-dd')}-${index}`}
                      style={[
                        styles.dayCell,
                        {
                          width: adjustedDayWidth,
                          height: dayHeight,
                          backgroundColor: selectedDate && isSameDay(day.date, selectedDate)
                            ? (isDark ? '#374151' : '#DBEAFE')
                            : (isDark ? '#1F2937' : '#FFFFFF'),
                          borderColor: isDark ? '#374151' : '#E5E7EB',
                        }
                      ]}
                      onPress={() => setSelectedDate(day.date)}
                      activeOpacity={0.7}
                    >
                      {renderDayContent(day)}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {/* Legend */}
        <View style={[
          styles.legend,
          { backgroundColor: isDark ? '#374151' : '#F9FAFB' }
        ]}>
          <View style={styles.legendItem}>
            <View style={[
              styles.legendIndicator,
              { backgroundColor: isDark ? '#34D399' : '#059669' }
            ]} />
            <Text style={[
              styles.legendText,
              { color: isDark ? '#D1D5DB' : '#6B7280' }
            ]}>
              Approved
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[
              styles.legendIndicator,
              { backgroundColor: isDark ? '#FBBF24' : '#D97706' }
            ]} />
            <Text style={[
              styles.legendText,
              { color: isDark ? '#D1D5DB' : '#6B7280' }
            ]}>
              Pending
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[
              styles.legendIndicator,
              { backgroundColor: isDark ? '#F87171' : '#DC2626' }
            ]} />
            <Text style={[
              styles.legendText,
              { color: isDark ? '#D1D5DB' : '#6B7280' }
            ]}>
              Holiday
            </Text>
          </View>
        </View>

        {/* Selected Day Details */}
        {selectedDate && (
          <View style={styles.selectedDayContainer}>
            <Text style={[
              styles.selectedDayTitle,
              { color: isDark ? '#FFFFFF' : '#111827' }
            ]}>
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </Text>
            {calendarDays.find(day => isSameDay(day.date, selectedDate))?.leaves.map((leave, index) => (
              <View
                key={index}
                style={[
                  styles.leaveDetailCard,
                  { backgroundColor: isDark ? '#374151' : '#FFFFFF' }
                ]}
              >
                <View style={styles.leaveDetailHeader}>
                  <Text style={[
                    styles.employeeName,
                    { color: isDark ? '#FFFFFF' : '#111827' }
                  ]}>
                    {leave.employee_name}
                  </Text>
                  <View style={[
                    styles.statusBadge,
                    {
                      backgroundColor: leave.status === 'approved'
                        ? (isDark ? '#064E3B' : '#D1FAE5')
                        : (isDark ? '#92400E' : '#FEF3C7')
                    }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      {
                        color: leave.status === 'approved'
                          ? (isDark ? '#34D399' : '#059669')
                          : (isDark ? '#FBBF24' : '#D97706')
                      }
                    ]}>
                      {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={[
                  styles.leaveTypeText,
                  { color: isDark ? '#9CA3AF' : '#6B7280' }
                ]}>
                  {leave.leave_type} ({leave.is_paid ? 'Paid' : 'Unpaid'})
                </Text>
                <Text style={[
                  styles.leaveDateText,
                  { color: isDark ? '#9CA3AF' : '#6B7280' }
                ]}>
                  {format(new Date(leave.start_date), 'MMM d')} - {format(new Date(leave.end_date), 'MMM d')}
                </Text>
              </View>
            ))}
            {calendarDays.find(day => isSameDay(day.date, selectedDate))?.isHoliday && (
              <View style={[
                styles.holidayDetailCard,
                { backgroundColor: isDark ? '#374151' : '#FFFFFF' }
              ]}>
                <Text style={[
                  styles.holidayTitle,
                  { color: isDark ? '#F87171' : '#DC2626' }
                ]}>
                  Holiday
                </Text>
                <Text style={[
                  styles.holidayName,
                  { color: isDark ? '#9CA3AF' : '#6B7280' }
                ]}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  monthNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
    width: '100%',
    maxWidth: 400,
  },
  navButton: {
    padding: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  calendarContainer: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxWidth: '100%',
    alignSelf: 'center',
  },
  weekdayHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  weekdayCell: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 35, // Ensure minimum width for text visibility
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  calendarGrid: {
    width: '100%',
  },
  weekRow: {
    flexDirection: 'row',
    width: '100%',
  },
  dayCell: {
    borderWidth: 0.5,
    padding: 4,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    minWidth: 35, // Ensure minimum width for content
  },
  dayContent: {
    flex: 1,
    width: '100%',
    alignItems: 'flex-start',
  },
  dayNumber: {
    fontSize: 14,
    textAlign: 'left',
    marginBottom: 2,
    fontWeight: '500',
  },
  holidayText: {
    fontSize: 9,
    marginTop: 2,
    textAlign: 'left',
    lineHeight: 11,
    fontWeight: '400',
  },
  leaveIndicators: {
    flexDirection: 'row',
    marginTop: 4,
    alignItems: 'center',
  },
  leaveIndicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  legend: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectedDayContainer: {
    marginTop: 16,
    width: '100%',
    maxWidth: 400,
  },
  selectedDayTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  leaveDetailCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  leaveDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  leaveTypeText: {
    fontSize: 14,
    marginBottom: 4,
  },
  leaveDateText: {
    fontSize: 14,
  },
  holidayDetailCard: {
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  holidayTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  holidayName: {
    fontSize: 14,
  },
}); 