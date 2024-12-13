import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  Modal,
  ScrollView,
  Dimensions,
  StyleSheet,
  Image,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AuthContext from '../../context/AuthContext';
import ThemeContext from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { differenceInSeconds } from 'date-fns';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function EmployeeDashboard() {
  const { theme } = ThemeContext.useTheme();
  const { user, logout } = AuthContext.useAuth();
  const router = useRouter();

  // State management
  const [activeTab, setActiveTab] = useState('home');
  const [taskDetails, setTaskDetails] = useState('');
  const [shiftType, setShiftType] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [notifications, setNotifications] = useState([
    { id: 1, message: 'Your shift starts in 30 minutes', time: '10 mins ago' },
    { id: 2, message: 'New task assigned by admin', time: '1 hour ago' },
  ]);
  const [taskProgress, setTaskProgress] = useState(65);
  const [characterCount, setCharacterCount] = useState(0);
  const [lastLogin, setLastLogin] = useState('');
  const [shiftStatus, setShiftStatus] = useState('No Active Shift');
  const [attendanceStatus, setAttendanceStatus] = useState('Not Marked');
  const [activeTaskType, setActiveTaskType] = useState('All Tasks');
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Complete daily report', status: 'Pending', priority: 'High' },
    { id: 2, title: 'Team meeting', status: 'In Progress', priority: 'Medium' },
    { id: 3, title: 'Update documentation', status: 'Completed', priority: 'Low' },
  ]);

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

  // Animations
  const progressAnimation = useRef(new Animated.Value(0)).current;

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

    // Animate progress bar
    Animated.timing(progressAnimation, {
      toValue: taskProgress,
      duration: 1000,
      useNativeDriver: false,
    }).start();
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

  // Handle form submission
  const handleSubmit = async () => {
    if (!taskDetails.trim() || !shiftType) {
      alert('Please fill in all fields');
      return;
    }

    try {
      // Save to AsyncStorage for offline support
      const offlineData = {
        taskDetails,
        shiftType,
        timestamp: new Date().toISOString(),
      };
      await AsyncStorage.setItem('offlineTask', JSON.stringify(offlineData));

      // TODO: Implement API call to save data to PostgreSQL
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
      setTaskDetails('');
      setShiftType('');
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Failed to submit task. Data saved offline.');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

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
    return tasks.filter(task => task.status === activeTaskType);
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
                  <Ionicons name={action.icon} size={24} color={action.color} />
                </View>
                <Text style={[
                  styles.quickActionText,
                  { color: theme === 'dark' ? '#FFFFFF' : '#111827' }
                ]}>
                  {action.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Status Card with enhanced UI */}
          <View style={[styles.card, { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTitle, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
                Today's Status
              </Text>
              {shiftStatus === 'Active Shift' && (
                <View style={[styles.activeShiftIndicator, { backgroundColor: '#10B981' }]}>
                  <Text style={styles.activeShiftText}>Live</Text>
                </View>
              )}
            </View>
            <View style={styles.enhancedStatusRow}>
              <View style={styles.statusItem}>
                <View style={[styles.statusIconCircle, { 
                  backgroundColor: shiftStatus === 'Active Shift' ? '#10B98120' : '#EF444420' 
                }]}>
                  <Ionicons 
                    name="time-outline" 
                    size={20} 
                    color={shiftStatus === 'Active Shift' ? '#10B981' : '#EF4444'} 
                  />
                </View>
                <View>
                  <Text style={[styles.statusLabel, { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                    Shift Status
                  </Text>
                  <Text style={[
                    styles.statusValue, 
                    { color: theme === 'dark' ? '#FFFFFF' : '#111827' }
                  ]}>
                    {shiftStatus}
                  </Text>
                  {currentShiftDuration && shiftStatus === 'Active Shift' && (
                    <Text style={[
                      styles.statusSubValue, 
                      { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }
                    ]}>
                      Duration: {currentShiftDuration}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.statusItem}>
                <View style={[styles.statusIconCircle, { 
                  backgroundColor: attendanceStatus === 'Present' ? '#10B98120' : '#9CA3AF20' 
                }]}>
                  <Ionicons 
                    name="calendar-outline" 
                    size={20} 
                    color={attendanceStatus === 'Present' ? '#10B981' : '#9CA3AF'} 
                  />
                </View>
                <View>
                  <Text style={[styles.statusLabel, { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                    Attendance
                  </Text>
                  <Text style={[
                    styles.statusValue, 
                    { color: theme === 'dark' ? '#FFFFFF' : '#111827' }
                  ]}>
                    {attendanceStatus}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Task Form */}
          <View style={[styles.card, { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTitle, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
                Task Details
              </Text>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={() => {/* Refresh tasks */}}
              >
                <Ionicons name="refresh-outline" size={20} color="#3B82F6" />
              </TouchableOpacity>
            </View>

            <View style={styles.taskTypeSelector}>
              {['All Tasks', 'Pending', 'In Progress', 'Completed'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.taskTypeButton,
                    activeTaskType === type && styles.activeTaskType
                  ]}
                  onPress={() => setActiveTaskType(type)}
                >
                  <Text style={[
                    styles.taskTypeText,
                    activeTaskType === type && styles.activeTaskTypeText
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, { 
                color: theme === 'dark' ? '#FFFFFF' : '#111827',
                backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6'
              }]}
              placeholder="Enter task details or shift comments"
              placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
              value={taskDetails}
              onChangeText={(text) => {
                if (text.length <= 300) {
                  setTaskDetails(text);
                  setCharacterCount(text.length);
                }
              }}
              multiline
              maxLength={300}
            />
            
            <View style={styles.taskMetaInputs}>
              <View style={styles.taskMetaRow}>
                <View style={styles.prioritySelector}>
                  <Text style={[styles.metaLabel, { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                    Priority
                  </Text>
                  <View style={styles.priorityButtons}>
                    {['Low', 'Medium', 'High'].map((priority) => (
                      <TouchableOpacity
                        key={priority}
                        style={[
                          styles.priorityButton,
                          taskPriority === priority && styles.activePriority,
                          { backgroundColor: getPriorityColor(priority) }
                        ]}
                        onPress={() => setTaskPriority(priority)}
                      >
                        <Text style={styles.priorityText}>{priority}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View style={[styles.pickerContainer, { 
                backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6' 
              }]}>
                <Picker
                  selectedValue={shiftType}
                  onValueChange={(value) => setShiftType(value)}
                  style={{ color: theme === 'dark' ? '#FFFFFF' : '#111827' }}
                >
                  <Picker.Item label="Select Shift Type" value="" />
                  <Picker.Item label="Morning Shift" value="morning" />
                  <Picker.Item label="Evening Shift" value="evening" />
                  <Picker.Item label="Night Shift" value="night" />
                  <Picker.Item label="Custom Shift" value="custom" />
                </Picker>
              </View>
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
            >
              <Text style={styles.submitButtonText}>Submit Task</Text>
            </TouchableOpacity>
          </View>

          {/* Progress Card */}
          <View style={[styles.card, { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }]}>
            <Text style={[styles.cardTitle, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
              Today's Progress
            </Text>
            <View style={styles.progressContainer}>
              <Animated.View 
                style={[
                  styles.progressBar,
                  {
                    width: progressAnimation.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%']
                    })
                  }
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
              {taskProgress}% Tasks Completed
            </Text>
          </View>

          {/* Notifications */}
          <View style={[styles.card, { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }]}>
            <Text style={[styles.cardTitle, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
              Recent Notifications
            </Text>
            {notifications.map((notification) => (
              <View key={notification.id} style={styles.notification}>
                <Ionicons name="notifications-outline" size={20} color="#3B82F6" />
                <View style={styles.notificationContent}>
                  <Text style={[styles.notificationText, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
                    {notification.message}
                  </Text>
                  <Text style={[styles.notificationTime, { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                    {notification.time}
                  </Text>
                </View>
              </View>
            ))}
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
            onPress={() => router.push('/(dashboard)/notifications')}
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
            onPress={() => router.push('/(dashboard)/profile')}
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

      {/* Success Modal */}
      <Modal
        transparent
        visible={showSuccessModal}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }]}>
            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            <Text style={[styles.modalText, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
              Task submitted successfully!
            </Text>
          </View>
        </View>
      </Modal>
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
    width: 40,
    height: 40,
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
    padding: 16,
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    width: '80%',
  },
  modalText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickActionCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
});