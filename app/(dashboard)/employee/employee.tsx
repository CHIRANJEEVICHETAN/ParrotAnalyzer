import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AuthContext from '../../context/AuthContext';
import ThemeContext from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { format, differenceInSeconds } from 'date-fns';
import axios from 'axios';
import TaskList from './components/TaskList';

// Add Task interface
interface Task {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  due_date: string;
  assigned_by_name: string;
}

export default function EmployeeDashboard() {
  const { theme } = ThemeContext.useTheme();
  const { user, token } = AuthContext.useAuth();
  const router = useRouter();

  // State management
  const [activeTab, setActiveTab] = useState('home');
  const [greeting, setGreeting] = useState('');
  const [lastLogin, setLastLogin] = useState('');
  const [shiftStatus, setShiftStatus] = useState('No Active Shift');
  const [attendanceStatus, setAttendanceStatus] = useState('Not Marked');
  const [activeTaskType, setActiveTaskType] = useState('All Tasks');
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add new state for quick actions
  const [quickActions] = useState([
    {
      id: 1,
      title: 'Shift Tracker',
      icon: 'time-outline',
      color: '#10B981',
      action: () => router.push('/(dashboard)/employee/employeeShiftTracker'),
    },
    {
      id: 2,
      title: 'Submit Expenses',
      icon: 'receipt-outline',
      color: '#F59E0B',
      action: () => router.push('/(dashboard)/employee/employeeExpenses'),
    },
    {
      id: 3,
      title: 'View Schedule',
      icon: 'calendar-outline',
      color: '#3B82F6',
      action: () => router.push('/(dashboard)/employee/employeeSchedule'),
    },
    {
      id: 4,
      title: 'Request Leave',
      icon: 'airplane-outline',
      color: '#8B5CF6',
      action: () => router.push('/(dashboard)/employee/employeeLeave'),
    },
  ]);

  // Add isFocused hook
  const isFocused = useIsFocused();

  // Add new state for shift duration
  const [currentShiftDuration, setCurrentShiftDuration] = useState<string | null>(null);
  const [shiftStartTime, setShiftStartTime] = useState<Date | null>(null);

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');

    // Simulate fetching last login
    setLastLogin(new Date().toLocaleString());
  }, []);

  // Add effect for real-time updates
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const updateDashboard = async () => {
      try {
        const shiftStatusData = await AsyncStorage.getItem('shiftStatus');
        
        if (shiftStatusData) {
          const { isActive, startTime } = JSON.parse(shiftStatusData);
          
          if (isActive && startTime) {
            setShiftStatus('Active Shift');
            setAttendanceStatus('Present');
            setShiftStartTime(new Date(startTime));
            
            // Calculate duration in real-time
            const elapsedSeconds = differenceInSeconds(new Date(), new Date(startTime));
            const hours = Math.floor(elapsedSeconds / 3600);
            const minutes = Math.floor((elapsedSeconds % 3600) / 60);
            const seconds = elapsedSeconds % 60;
            const duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            setCurrentShiftDuration(duration);
          } else {
            setShiftStatus('No Active Shift');
            setAttendanceStatus('Not Marked');
            setCurrentShiftDuration(null);
            setShiftStartTime(null);
          }
        } else {
          setShiftStatus('No Active Shift');
          setAttendanceStatus('Not Marked');
          setCurrentShiftDuration(null);
          setShiftStartTime(null);
        }
      } catch (error) {
        console.error('Error updating dashboard:', error);
      }
    };

    if (isFocused) {
      // Initial update
      updateDashboard();
      
      // Set up interval for real-time updates
      intervalId = setInterval(updateDashboard, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isFocused]);

  // Add this helper function
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Low':
        return '#10B981';
      case 'Medium':
        return '#F59E0B';
      case 'High':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  // Add this function to filter tasks
  const getFilteredTasks = () => {
    if (activeTaskType === 'All Tasks') return tasks;
    return tasks.filter(task => task.status.toLowerCase() === activeTaskType.toLowerCase());
  };

  // Add this function to check if a task is from today
  const isToday = (dateString: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateString.split('T')[0] === today;
  };

  // Update the fetchTasks function
  const fetchTasks = async () => {
    try {
      const response = await axios.get<Task[]>(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks/employee`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Tasks are already filtered by date on the backend
      setTasks(response.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      Alert.alert('Error', 'Failed to fetch tasks');
    }
  };

  // Add an effect to refresh tasks at midnight
  useEffect(() => {
    fetchTasks();

    // Calculate time until next midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();

    // Set up timer to refresh tasks at midnight
    const timer = setTimeout(() => {
      fetchTasks();
    }, timeUntilMidnight);

    return () => clearTimeout(timer);
  }, []);

  const updateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      await axios.patch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks/${taskId}/status`,
        { status: newStatus },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      fetchTasks(); // Refresh tasks
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task status');
    }
  };

  const filteredTasks = tasks.filter(task => 
    activeTaskType === 'All Tasks' || task.status.toLowerCase() === activeTaskType.toLowerCase()
  );

  useEffect(() => {
    fetchTasks();
  }, []);

  // Add this function to handle refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchTasks();
    } catch (error) {
      console.error('Error refreshing tasks:', error);
      Alert.alert('Error', 'Failed to refresh tasks');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <View className="flex-1">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: theme === 'dark' ? '#111827' : '#F3F4F6' }]}
      >
        <StatusBar 
          backgroundColor={theme === 'dark' ? '#1F2937' : '#FFFFFF'}
          barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        />

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }]}>
          <TouchableOpacity onPress={() => router.replace('/(dashboard)/employee/employee')}>
            <Image
              source={require('./../../../assets/images/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <View>
            <Text style={[styles.welcomeText, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
              {greeting}, {user?.name}
            </Text>
            <Text style={[styles.subText, { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
              Last login: {lastLogin}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(dashboard)/employee/employeeSettings')}>
            <Ionicons
              name="settings-outline"
              size={24}
              color={theme === 'dark' ? '#FFFFFF' : '#111827'}
            />
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <ScrollView style={styles.content}>
          {/* Quick Actions Grid */}
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.quickActionCard,
                  { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }
                ]}
                onPress={action.action}
              >
                <View style={[styles.iconCircle, { backgroundColor: `${action.color}20` }]}>
                  <Ionicons name={action.icon as any} size={24} color={action.color} />
                </View>
                <Text style={[styles.quickActionText, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
                  {action.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Status and Tasks Container */}
          <View style={[
            styles.mainContainer,
            { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }
          ]}>
            {/* Today's Status */}
            <View style={styles.statusSection}>
              <Text style={[
                styles.sectionTitle,
                { color: theme === 'dark' ? '#FFFFFF' : '#111827' }
              ]}>
                Today's Status
              </Text>
              <View style={styles.enhancedStatusRow}>
                <View style={styles.statusItem}>
                  <View style={[
                    styles.statusIconCircle,
                    { backgroundColor: shiftStatus === 'Active Shift' ? '#10B98120' : '#9CA3AF20' }
                  ]}>
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color={shiftStatus === 'Active Shift' ? '#10B981' : '#9CA3AF'}
                    />
                  </View>
                  <View>
                    <Text style={[styles.statusLabel, { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                      Shift Status
                    </Text>
                    <Text style={[styles.statusValue, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
                      {shiftStatus}
                    </Text>
                    {currentShiftDuration && (
                      <Text style={[styles.statusSubValue, { color: theme === 'dark' ? '#60A5FA' : '#3B82F6' }]}>
                        Duration: {currentShiftDuration}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.statusItem}>
                  <View style={[
                    styles.statusIconCircle,
                    { backgroundColor: attendanceStatus === 'Present' ? '#10B98120' : '#9CA3AF20' }
                  ]}>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={attendanceStatus === 'Present' ? '#10B981' : '#9CA3AF'}
                    />
                  </View>
                  <View>
                    <View style={styles.attendanceHeader}>
                      <Text style={[styles.statusLabel, { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                        Attendance
                      </Text>
                      {attendanceStatus === 'Present' && (
                        <View style={styles.liveIndicator}>
                          <Text style={styles.liveText}>LIVE <Ionicons name="flash-outline" size={8} color={theme === 'dark' ? "#10B981" : "#FFFFFF" } /></Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.statusValue, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
                      {attendanceStatus}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Divider */}
            <View style={[
              styles.divider,
              { backgroundColor: theme === 'dark' ? '#374151' : '#E5E7EB' }
            ]} />

            {/* My Tasks Section */}
            <View style={styles.tasksSection}>
              <View style={styles.taskHeader}>
                <Text style={[styles.sectionTitle, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
                  My Tasks
                </Text>
                <View style={styles.taskCount}>
                  <View style={[styles.dot, { backgroundColor: theme === 'dark' ? '#60A5FA' : '#3B82F6' }]} />
                  <Text style={[styles.taskCountText, { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                    {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'} for Today
                  </Text>
                </View>
              </View>

              <TaskList
                tasks={tasks}
                isDark={theme === 'dark'}
                onUpdateStatus={updateTaskStatus}
                activeTaskType={activeTaskType}
                onChangeTaskType={setActiveTaskType}
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
              />
            </View>
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <View className={`flex-row justify-around items-center py-2 border-t ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <TouchableOpacity 
            className="items-center px-4 py-2"
            onPress={() => setActiveTab('home')}
          >
            <Ionicons
              name={activeTab === 'home' ? 'home' : 'home-outline'}
              size={24}
              color={activeTab === 'home' 
                ? (theme === 'dark' ? '#60A5FA' : '#2563EB')
                : (theme === 'dark' ? '#9CA3AF' : '#6B7280')
              }
            />
            <Text className={`text-xs mt-1 ${
              activeTab === 'home'
                ? (theme === 'dark' ? 'text-blue-400' : 'text-blue-600')
                : (theme === 'dark' ? 'text-gray-400' : 'text-gray-600')
            }`}>
              Home
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="items-center px-4 py-2"
            onPress={() => router.push('/(dashboard)/employee/employeeShiftTracker')}
          >
            <Ionicons
              name={activeTab === 'shift' ? 'time' : 'time-outline'}
              size={24}
              color={activeTab === 'shift' 
                ? (theme === 'dark' ? '#60A5FA' : '#2563EB')
                : (theme === 'dark' ? '#9CA3AF' : '#6B7280')
              }
            />
            <Text className={`text-xs mt-1 ${
              activeTab === 'shift'
                ? (theme === 'dark' ? 'text-blue-400' : 'text-blue-600')
                : (theme === 'dark' ? 'text-gray-400' : 'text-gray-600')
            }`}>
              Shift Tracker
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="items-center px-4 py-2"
            onPress={() => router.push('/(dashboard)/employee/notifications')}
          >
            <Ionicons
              name={activeTab === 'notifications' ? 'notifications' : 'notifications-outline'}
              size={24}
              color={activeTab === 'notifications' 
                ? (theme === 'dark' ? '#60A5FA' : '#2563EB')
                : (theme === 'dark' ? '#9CA3AF' : '#6B7280')
              }
            />
            <Text className={`text-xs mt-1 ${
              activeTab === 'notifications'
                ? (theme === 'dark' ? 'text-blue-400' : 'text-blue-600')
                : (theme === 'dark' ? 'text-gray-400' : 'text-gray-600')
            }`}>
              Notifications
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="items-center px-4 py-2"
            onPress={() => router.push('/(dashboard)/employee/profile')}
          >
            <Ionicons
              name={activeTab === 'profile' ? 'person' : 'person-outline'}
              size={24}
              color={activeTab === 'profile' 
                ? (theme === 'dark' ? '#60A5FA' : '#2563EB')
                : (theme === 'dark' ? '#9CA3AF' : '#6B7280')
              }
            />
            <Text className={`text-xs mt-1 ${
              activeTab === 'profile'
                ? (theme === 'dark' ? 'text-blue-400' : 'text-blue-600')
                : (theme === 'dark' ? 'text-gray-400' : 'text-gray-600')
            }`}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 100,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
  },
  subText: {
    fontSize: 12,
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 16,
  },
  pickerContainer: {
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  progressText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
  },
  notification: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
  },
  notificationText: {
    fontSize: 14,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  navItem: {
    alignItems: 'center',
    padding: 8,
  },
  navLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  quickActionCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  enhancedStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  statusIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  refreshButton: {
    padding: 8,
  },
  taskTypeSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    overflow: 'scroll',
  },
  taskTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 6,
  },
  activeTaskType: {
    backgroundColor: '#3B82F6',
  },
  taskTypeText: {
    color: '#6B7280',
    fontSize: 13,
  },
  activeTaskTypeText: {
    color: '#FFFFFF',
  },
  taskMetaInputs: {
    marginTop: 16,
  },
  taskMetaRow: {
    marginBottom: 16,
  },
  metaLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  prioritySelector: {
    marginBottom: 16,
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    opacity: 0.6,
  },
  activePriority: {
    opacity: 1,
  },
  priorityText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  statusSubValue: {
    fontSize: 12,
    marginTop: 2,
  },
  activeShiftIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeShiftText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  mainContainer: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  statusSection: {
    padding: 16,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  tasksSection: {
    padding: 16,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  taskCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  taskCountText: {
    fontSize: 14,
  },
  attendanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveIndicator: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
  },
});