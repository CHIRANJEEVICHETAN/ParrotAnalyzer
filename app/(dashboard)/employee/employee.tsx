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
  RefreshControl,
  ActivityIndicator,
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
import BottomNav from '../../components/BottomNav';
import { employeeNavItems } from './utils/navigationItems';
// import PushNotificationService from '../../utils/pushNotificationService';

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

// Add this interface near your other interfaces
interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  completionRate: number;
  currentMonth: string;
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
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add new state for quick actions
  const [quickActions] = useState([
    {
      id: 1,
      title: "Shift Tracker",
      icon: "time-outline",
      color: "#10B981",
      action: () => router.push("/(dashboard)/shared/shiftTracker"),
    },
    {
      id: 2,
      title: "Submit Expenses",
      icon: "receipt-outline",
      color: "#F59E0B",
      action: () => router.push("/(dashboard)/employee/employeeExpenses"),
    },
    {
      id: 3,
      title: "View Schedule",
      icon: "calendar-outline",
      color: "#3B82F6",
      action: () => router.push("/(dashboard)/employee/employeeSchedule"),
    },
    {
      id: 4,
      title: "Request Leave",
      icon: "airplane-outline",
      color: "#8B5CF6",
      action: () => router.push("/(dashboard)/employee/leave-insights"),
    },
  ]);

  // Add isFocused hook
  const isFocused = useIsFocused();

  // Add new state for shift duration
  const [currentShiftDuration, setCurrentShiftDuration] = useState<
    string | null
  >(null);
  const [shiftStartTime, setShiftStartTime] = useState<Date | null>(null);

  // Add these new states for TaskProgressBar
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    // Simulate fetching last login
    setLastLogin(new Date().toLocaleString());
  }, []);

  // Add effect for real-time updates
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const updateDashboard = async () => {
      try {
        const shiftStatusData = await AsyncStorage.getItem(
          `${user?.role}-shiftStatus`
        );

        if (shiftStatusData) {
          const { isActive, startTime } = JSON.parse(shiftStatusData);

          if (isActive && startTime) {
            setShiftStatus("Active Shift");
            setAttendanceStatus("Present");
            setShiftStartTime(new Date(startTime));

            // Calculate duration in real-time
            const elapsedSeconds = differenceInSeconds(
              new Date(),
              new Date(startTime)
            );
            const hours = Math.floor(elapsedSeconds / 3600);
            const minutes = Math.floor((elapsedSeconds % 3600) / 60);
            const seconds = elapsedSeconds % 60;
            const duration = `${hours.toString().padStart(2, "0")}:${minutes
              .toString()
              .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

            setCurrentShiftDuration(duration);
          } else {
            setShiftStatus("No Active Shift");
            setAttendanceStatus("Not Marked");
            setCurrentShiftDuration(null);
            setShiftStartTime(null);
          }
        } else {
          setShiftStatus("No Active Shift");
          setAttendanceStatus("Not Marked");
          setCurrentShiftDuration(null);
          setShiftStartTime(null);
        }
      } catch (error) {
        console.error("Error updating dashboard:", error);
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
      setIsLoading(true);
      console.log("Current user:", user);
      console.log("Token:", token);

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks/employee`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      // console.log('API Response:', response);
      setTasks(response.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      if (axios.isAxiosError(error)) {
        console.log('Error response:', error.response?.data);
      }
    } finally {
      setIsLoading(false);
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

  // Move fetchTaskStats to parent component
  const fetchTaskStats = async (forceRefresh = false) => {
    try {
      setStatsLoading(true);
      
      // Check cache first, unless forceRefresh is true
      if (!forceRefresh) {
        const cachedStats = await AsyncStorage.getItem('taskStats');
        const cachedTimestamp = await AsyncStorage.getItem('taskStatsTimestamp');
        
        const now = new Date().getTime();
        const cacheAge = cachedTimestamp ? now - parseInt(cachedTimestamp) : Infinity;
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

        // Use cached data if it's less than 5 minutes old
        if (cachedStats && cacheAge < CACHE_DURATION) {
          setTaskStats(JSON.parse(cachedStats));
          setStatsLoading(false);
          return;
        }
      }

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update cache
      await AsyncStorage.setItem('taskStats', JSON.stringify(response.data));
      await AsyncStorage.setItem('taskStatsTimestamp', new Date().getTime().toString());
      
      setTaskStats(response.data);
    } catch (error) {
      console.error('Error fetching task stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Modify handleUpdateTaskStatus to refresh stats after status update
  const handleUpdateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      await axios.patch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks/${taskId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Get the task that was updated
      const updatedTask = tasks.find((task) => task.id === taskId);
      if (updatedTask) {
        // Send notification to group admin
        await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL}/api/employee-notifications/notify-admin`,
          {
            title: `📋 Task Status Updated by ${user?.name}`,
            message:
              `━━━━━━━━ Task Details ━━━━━━━━\n` +
              `📌 Task: ${updatedTask.title}\n` +
              `📝 Description: ${updatedTask.description}\n\n` +
              `🔄 Status Change\n` +
              `• From: ${updatedTask.status
                .replace("_", " ")
                .toUpperCase()}\n` +
              `• To: ${newStatus.replace("_", " ").toUpperCase()}\n\n` +
              `⚡ Priority: ${updatedTask.priority.toUpperCase()}\n` +
              `📅 Due Date: ${
                updatedTask.due_date
                  ? format(new Date(updatedTask.due_date), "dd MMM yyyy")
                  : "Not set"
              }\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            type: "task-update",
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }

      // Fetch both tasks and stats after status update
      await Promise.all([
        fetchTasks(),
        fetchTaskStats(true), // Force refresh stats
      ]);
    } catch (error) {
      console.error("Error updating task status:", error);
      Alert.alert("Error", "Failed to update task status");
    }
  };

  // Initial fetch for both tasks and stats
  useEffect(() => {
    const initialFetch = async () => {
      await Promise.all([fetchTasks(), fetchTaskStats()]);
    };
    initialFetch();
  }, []);

  // Modify handleRefresh to update both tasks and stats
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchTasks(),
        fetchTaskStats(true), // Force refresh stats
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Modify TaskProgressBar component to use props
  const TaskProgressBar = () => {
    const { theme } = ThemeContext.useTheme();
    const isDark = theme === "dark";

    // Set up auto-refresh interval
    useEffect(() => {
      const intervalId = setInterval(() => {
        fetchTaskStats();
      }, 5 * 60 * 1000); // Refresh every 5 minutes

      return () => clearInterval(intervalId);
    }, []); // Empty dependency array since fetchTaskStats is stable

    if (statsLoading && !taskStats) {
      return (
        <View className="mx-4 mt-4">
          <ActivityIndicator size="small" color="#3B82F6" />
        </View>
      );
    }

    if (!taskStats) return null;

    // Calculate percentages safely
    const calculatePercentage = (value: number, total: number) => {
      if (total === 0) return 0; // Return 0% if total is 0
      return (value / total) * 100;
    };

    return (
      <View
        style={[
          styles.mainContainer,
          { backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF" },
        ]}
        className="mx-4 mt-4"
      >
        <View
          className={`p-4 rounded-xl ${
            isDark ? "bg-gray-800" : "bg-white"
          } shadow-md`}
        >
          {/* Header */}
          <View className="flex-row items-center mb-4">
            <View className="flex-1">
              <Text
                className={`text-lg font-semibold ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Task Progress
              </Text>
              <Text
                className={`text-sm ${
                  isDark ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {taskStats.currentMonth} •{" "}
                {taskStats.total === 0
                  ? "No Tasks"
                  : `${taskStats.total} Total Tasks`}
              </Text>
            </View>
            <View
              className={`px-3 py-1 rounded-full ${
                isDark ? "bg-blue-500/20" : "bg-blue-50"
              }`}
            >
              <Text className="text-blue-600 font-medium">
                {taskStats.total === 0 ? "0" : taskStats.completionRate}%
              </Text>
            </View>
          </View>

          {/* Progress bars container */}
          <View className="space-y-3">
            {/* Completed Tasks */}
            <View>
              <View className="flex-row justify-between mb-1.5">
                <Text
                  className={`text-sm ${
                    isDark ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  Completed
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  {taskStats.completed}/{taskStats.total}
                </Text>
              </View>
              <View
                className={`h-2 ${
                  isDark ? "bg-gray-700" : "bg-gray-100"
                } rounded-full overflow-hidden`}
              >
                <View
                  className="h-full bg-green-500 rounded-full"
                  style={{
                    width: `${calculatePercentage(
                      taskStats.completed,
                      taskStats.total
                    )}%`,
                  }}
                />
              </View>
            </View>

            {/* In Progress Tasks */}
            <View>
              <View className="flex-row justify-between mb-1.5">
                <Text
                  className={`text-sm ${
                    isDark ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  In Progress
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  {taskStats.inProgress}/{taskStats.total}
                </Text>
              </View>
              <View
                className={`h-2 ${
                  isDark ? "bg-gray-700" : "bg-gray-100"
                } rounded-full overflow-hidden`}
              >
                <View
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${calculatePercentage(
                      taskStats.inProgress,
                      taskStats.total
                    )}%`,
                  }}
                />
              </View>
            </View>

            {/* Pending Tasks */}
            <View>
              <View className="flex-row justify-between mb-1.5">
                <Text
                  className={`text-sm ${
                    isDark ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  Pending
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  {taskStats.pending}/{taskStats.total}
                </Text>
              </View>
              <View
                className={`h-2 ${
                  isDark ? "bg-gray-700" : "bg-gray-100"
                } rounded-full overflow-hidden`}
              >
                <View
                  className="h-full bg-yellow-500 rounded-full"
                  style={{
                    width: `${calculatePercentage(
                      taskStats.pending,
                      taskStats.total
                    )}%`,
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    );
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
        <View style={[
          styles.header,
          { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }
        ]}>
          <TouchableOpacity onPress={() => router.replace('/(dashboard)/employee/employee')}>
            <Image
              source={require('./../../../assets/images/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text 
              numberOfLines={1} 
              style={[styles.welcomeText, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}
            >
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
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[theme === 'dark' ? '#60A5FA' : '#3B82F6']} // Blue color for refresh spinner
              tintColor={theme === 'dark' ? '#60A5FA' : '#3B82F6'}
            />
          }
        >
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
                onUpdateStatus={handleUpdateTaskStatus}
                activeTaskType={activeTaskType}
                onChangeTaskType={setActiveTaskType}
                onRefresh={handleRefresh}
                refreshing={isRefreshing}
              />
            </View>
          </View>

          {/* Task Progress Bar */}
          <TaskProgressBar />
          {/* <TouchableOpacity onPress={() => router.push('/(testing)/notification-test')} className="flex justify-center items-center bg-blue-500 p-3 w-1/2 mb-5 rounded-md text-center mx-auto">
            <Text className="text-white">Send Test Notification</Text>
          </TouchableOpacity> */}
        </ScrollView>

        {/* Bottom Navigation */}
        <BottomNav items={employeeNavItems} />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTextContainer: {
    flex: 1,
    marginHorizontal: 12,
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
    gap: 4,
  },
  liveIndicator: {
    backgroundColor: '#10B981',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 0,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '600',
    lineHeight: 10,
  },
});