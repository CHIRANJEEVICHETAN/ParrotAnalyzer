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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AuthContext from '../context/AuthContext';
import ThemeContext from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function EmployeeDashboard() {
  const { theme } = ThemeContext.useTheme();
  const { user, logout } = AuthContext.useAuth();
  const router = useRouter();

  // State management
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
  const [attendanceStatus, setAttendanceStatus] = useState('Present');

  // Animations
  const menuSlide = useRef(new Animated.Value(-SCREEN_WIDTH)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(new Animated.Value(0)).current;

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

  // Menu animation functions
  const toggleMenu = () => {
    const toValue = isMenuOpen ? -SCREEN_WIDTH : 0;
    const opacityValue = isMenuOpen ? 0 : 0.5;

    Animated.parallel([
      Animated.timing(menuSlide, {
        toValue,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(menuOpacity, {
        toValue: opacityValue,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    setIsMenuOpen(!isMenuOpen);
  };

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

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme === 'dark' ? '#111827' : '#F3F4F6' }]}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }]}>
        <TouchableOpacity onPress={() => router.replace('/(dashboard)/employee')}>
          <Image
            source={require('./../../assets/images/icon.png')}
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
        <TouchableOpacity onPress={toggleMenu}>
          <Ionicons
            name="menu"
            size={24}
            color={theme === 'dark' ? '#FFFFFF' : '#111827'}
          />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.content}>
        {/* Status Card */}
        <View style={[styles.card, { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }]}>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Ionicons name="time-outline" size={20} color="#3B82F6" />
              <Text style={[styles.statusText, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
                {shiftStatus}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Ionicons name="calendar-outline" size={20} color="#10B981" />
              <Text style={[styles.statusText, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
                {attendanceStatus}
              </Text>
            </View>
          </View>
        </View>

        {/* Task Form */}
        <View style={[styles.card, { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }]}>
          <Text style={[styles.cardTitle, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
            Task Details
          </Text>
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
          <Text style={[styles.charCount, { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
            {characterCount}/300
          </Text>

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

      {/* Side Menu */}
      <Animated.View
        style={[
          styles.menuOverlay,
          {
            opacity: menuOpacity,
            display: isMenuOpen ? 'flex' : 'none',
          },
        ]}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={toggleMenu}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.menu,
          {
            transform: [{ translateX: menuSlide }],
            backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
          },
        ]}
      >
        <View style={styles.menuHeader}>
          <Text style={[styles.menuTitle, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
            Menu
          </Text>
          <TouchableOpacity onPress={toggleMenu}>
            <Ionicons
              name="close"
              size={24}
              color={theme === 'dark' ? '#FFFFFF' : '#111827'}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="person-outline" size={20} color="#3B82F6" />
          <Text style={[styles.menuItemText, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
            Profile
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="settings-outline" size={20} color="#3B82F6" />
          <Text style={[styles.menuItemText, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
            Settings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="help-circle-outline" size={20} color="#3B82F6" />
          <Text style={[styles.menuItemText, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
            Help
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={[styles.menuItemText, { color: '#EF4444' }]}>
            Logout
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }]}>
        {[
          { id: 'home', icon: 'home', label: 'Home' },
          { id: 'notifications', icon: 'notifications', label: 'Notifications' },
          { id: 'calendar', icon: 'calendar', label: 'Attendance' },
          { id: 'person', icon: 'person', label: 'Profile' }
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={styles.navItem}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={`${tab.icon}${activeTab === tab.id ? '' : '-outline'}`}
              size={24}
              color={activeTab === tab.id ? '#3B82F6' : theme === 'dark' ? '#9CA3AF' : '#6B7280'}
            />
            <Text
              style={[
                styles.navLabel,
                {
                  color: activeTab === tab.id ? '#3B82F6' : theme === 'dark' ? '#9CA3AF' : '#6B7280'
                }
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
    </KeyboardAvoidingView>
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
    paddingTop: 48,
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
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  menu: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: SCREEN_WIDTH * 0.8,
    height: '100%',
    padding: 16,
    paddingTop: 48,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  menuTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
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
});