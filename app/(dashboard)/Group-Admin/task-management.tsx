import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Platform,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import TaskCard from './components/TaskCard';
import { format } from 'date-fns';
import BottomNav from '../../components/BottomNav';
import { groupAdminNavItems } from './utils/navigationItems';

interface Employee {
  id: number;
  name: string;
  email: string;
  employee_number: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  assignedTo?: number;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
  due_date: string | null;
  employee_name: string;
  employee_number: string;
  assigned_by_name: string;
  status_history: StatusHistory[];
}

interface StatusHistory {
  status: string;
  updatedAt: string;
  updatedBy: number;
  updatedByName?: string;
}

interface NewTask {
  title: string;
  description: string;
  assignedTo: number;
  priority: 'low' | 'medium' | 'high';
  due_date?: string | null;
  // ... other fields
}

export default function TaskManagement() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTask, setNewTask] = useState<Omit<Task, 'id'>>({
    title: '',
    description: '',
    assignedTo: 0,
    priority: 'medium',
    status: 'pending',
    employee_name: '',
    employee_number: '',
    createdAt: format(new Date(), 'yyyy-MM-dd'),
    assigned_by_name: '',
    status_history: [],
    due_date: null
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/employees`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      console.log('Employees response:', response.data); // Debug log
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
        console.error('Status code:', error.response?.status);
      }
      Alert.alert('Error', 'Failed to fetch employees');
    }
  };

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks/admin`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      console.log('Tasks response:', response.data);
      setTasks(response.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
        console.error('Status code:', error.response?.status);
      }
      Alert.alert('Error', 'Failed to fetch tasks');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch employees and tasks
  useEffect(() => {
    fetchEmployees();
    fetchTasks();
  }, []);

  const createTask = async () => {
    try {
      setIsLoading(true);
      // Format the request body properly
      const taskData = {
        title: newTask.title,
        description: newTask.description,
        assignedTo: newTask.assignedTo,
        priority: newTask.priority,
        dueDate: newTask.due_date // Make sure this matches the backend expectation
      };

      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks`,
        taskData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      Alert.alert('Success', 'Task created successfully');
      fetchTasks();
      // Reset form
      setNewTask({
        title: '',
        description: '',
        assignedTo: 0,
        priority: 'medium',
        status: 'pending',
        employee_name: '',
        employee_number: '',
        createdAt: format(new Date(), 'yyyy-MM-dd'),
        assigned_by_name: '',
        status_history: [],
        due_date: null
      });
    } catch (error) {
      console.error('Error creating task:', error);
      Alert.alert('Error', 'Failed to create task');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    
    const matchesEmployee = employeeFilter === 'all' || 
      task.employee_name === employees.find(emp => emp.id.toString() === employeeFilter)?.name;
    
    let matchesDate = true;
    if (dateFilter) {
      try {
        const selectedDate = format(dateFilter, 'yyyy-MM-dd');
        const taskDate = format(new Date(task.createdAt), 'yyyy-MM-dd');
        matchesDate = selectedDate === taskDate;
      } catch (error) {
        console.error('Date comparison error:', error);
        matchesDate = false;
      }
    }

    return matchesSearch && matchesPriority && matchesStatus && matchesEmployee && matchesDate;
  });

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    
    if (selectedDate) {
      try {
        const newDate = new Date(selectedDate);
        if (!isNaN(newDate.getTime())) {
          setDateFilter(newDate);
        }
      } catch (error) {
        console.error('Invalid date selection:', error);
      }
    }
  };

  const handleDueDateChange = (event: any, selectedDate?: Date) => {
    setShowDueDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setNewTask(prev => ({
        ...prev,
        due_date: selectedDate.toISOString()
      }));
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchTasks(), fetchEmployees()]);
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#F3F4F6' }}>
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* Header */}
      <View 
        className={`${isDark ? 'bg-gray-800' : 'bg-white'}`}
        style={styles.header}
      >
        <View className="flex-row items-center justify-between px-4 pt-3 pb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
            style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}
          >
            <Ionicons 
              name="arrow-back" 
              size={24} 
              color={isDark ? '#FFFFFF' : '#111827'} 
            />
          </TouchableOpacity>
          <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
            <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Task Management
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      {/* Search Bar */}
      <View className="px-4 mt-4">
        <View 
          className={`flex-row items-center px-4 rounded-lg mb-4 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}
          style={styles.searchBar}
        >
          <Ionicons 
            name="search" 
            size={20} 
            color={isDark ? '#9CA3AF' : '#6B7280'} 
          />
          <TextInput
            placeholder="Search tasks..."
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className={`flex-1 ml-2 py-3 ${isDark ? 'text-white' : 'text-gray-900'}`}
          />
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
          >
            <Ionicons 
              name={showFilters ? "options" : "options-outline"} 
              size={20} 
              color={isDark ? '#60A5FA' : '#3B82F6'} 
            />
          </TouchableOpacity>
        </View>

        {/* Filters Section */}
        {showFilters && (
          <View 
            className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            style={styles.filterCard}
          >
            {/* Date Filter */}
            <View className="mb-4">
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Created Date
              </Text>
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => setDateFilter(null)}
                  className={`px-4 py-2 rounded-lg mr-2 ${
                    !dateFilter
                      ? isDark ? 'bg-blue-600' : 'bg-blue-500'
                      : isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}
                >
                  <Text className={!dateFilter ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-700'}>
                    All Dates
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className={`flex-1 flex-row items-center justify-between px-4 py-2 rounded-lg ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}
                >
                  <Text className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    {dateFilter && !isNaN(dateFilter.getTime()) 
                      ? format(dateFilter, 'MMM dd, yyyy') 
                      : 'Select Date'
                    }
                  </Text>
                  <Ionicons 
                    name="calendar-outline" 
                    size={20} 
                    color={isDark ? '#9CA3AF' : '#6B7280'} 
                  />
                </TouchableOpacity>
              </View>

              {/* Date Picker */}
              {showDatePicker && (
                <DateTimePicker
                  value={dateFilter || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                  textColor={isDark ? '#FFFFFF' : '#000000'}
                  style={{ 
                    backgroundColor: isDark ? '#374151' : '#FFFFFF',
                  }}
                />
              )}
            </View>

            {/* Employee Filter with improved styling */}
            <View className="mb-4">
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Employee
              </Text>
              <View
                className={`rounded-xl overflow-hidden ${
                  isDark ? 'bg-gray-700' : 'bg-gray-100'
                }`}
                style={[
                  styles.pickerContainer,
                  { borderWidth: 1, borderColor: isDark ? '#374151' : '#E5E7EB' }
                ]}
              >
                <Picker
                  selectedValue={employeeFilter}
                  onValueChange={(value) => setEmployeeFilter(value)}
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

            {/* Priority Filter */}
            <View className="mb-4">
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Priority
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {[
                  { value: 'all', icon: 'filter-outline', label: 'All' },
                  { value: 'high', icon: 'alert-circle-outline', label: 'High' },
                  { value: 'medium', icon: 'remove-circle-outline', label: 'Medium' },
                  { value: 'low', icon: 'checkmark-circle-outline', label: 'Low' }
                ].map(({ value, icon, label }) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setPriorityFilter(value)}
                    className={`px-4 py-2 rounded-lg flex-row items-center ${
                      priorityFilter === value
                        ? isDark ? 'bg-blue-600' : 'bg-blue-500'
                        : isDark ? 'bg-gray-700' : 'bg-gray-100'
                    }`}
                  >
                    <Ionicons 
                      name={icon as any} 
                      size={16} 
                      color={priorityFilter === value ? '#FFFFFF' : isDark ? '#9CA3AF' : '#6B7280'} 
                      style={{ marginRight: 4 }}
                    />
                    <Text className={`${
                      priorityFilter === value
                        ? 'text-white'
                        : isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Status Filter */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Status
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {[
                  { value: 'all', icon: 'list-outline', label: 'All' },
                  { value: 'pending', icon: 'time-outline', label: 'Pending' },
                  { value: 'in_progress', icon: 'play-outline', label: 'In Progress' },
                  { value: 'completed', icon: 'checkmark-outline', label: 'Completed' }
                ].map(({ value, icon, label }) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setStatusFilter(value)}
                    className={`px-4 py-2 rounded-lg flex-row items-center ${
                      statusFilter === value
                        ? isDark ? 'bg-blue-600' : 'bg-blue-500'
                        : isDark ? 'bg-gray-700' : 'bg-gray-100'
                    }`}
                  >
                    <Ionicons 
                      name={icon as keyof typeof Ionicons.glyphMap} 
                      size={16} 
                      color={statusFilter === value ? '#FFFFFF' : isDark ? '#9CA3AF' : '#6B7280'} 
                    />
                    <Text className={`${
                      statusFilter === value
                        ? 'text-white'
                        : isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Task creation form */}
      <ScrollView 
        style={[styles.content, { paddingBottom: 80 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[isDark ? '#60A5FA' : '#3B82F6']}
            tintColor={isDark ? '#60A5FA' : '#3B82F6'}
            progressBackgroundColor={isDark ? '#1F2937' : '#F3F4F6'}
          />
        }
      >
        <View style={[styles.formSection, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
          <TextInput
            style={[styles.input, { 
              backgroundColor: isDark ? '#374151' : '#F3F4F6',
              color: isDark ? '#FFFFFF' : '#111827'
            }]}
            placeholder="Task Title"
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            value={newTask.title}
            onChangeText={(text) => setNewTask(prev => ({ ...prev, title: text }))}
          />
          <TextInput
            style={[styles.input, { 
              backgroundColor: isDark ? '#374151' : '#F3F4F6',
              color: isDark ? '#FFFFFF' : '#111827',
              height: 100,
              textAlignVertical: 'top'
            }]}
            placeholder="Task Description"
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            value={newTask.description}
            onChangeText={(text) => setNewTask(prev => ({ ...prev, description: text }))}
            multiline
            numberOfLines={4}
          />
          
          {/* Employee Picker */}
          <View style={[styles.pickerContainer, { 
            backgroundColor: isDark ? '#374151' : '#F3F4F6',
          }]}>
            <Picker
              selectedValue={newTask.assignedTo}
              onValueChange={(value) => setNewTask(prev => ({ ...prev, assignedTo: value }))}
              style={{ color: isDark ? '#FFFFFF' : '#111827' }}
            >
              <Picker.Item label="Select Employee" value={0} />
              {employees.map(employee => (
                <Picker.Item 
                  key={employee.id} 
                  label={employee.name} 
                  value={employee.id} 
                />
              ))}
            </Picker>
          </View>

          {/* Priority Picker */}
          <View style={[styles.pickerContainer, { 
            backgroundColor: isDark ? '#374151' : '#F3F4F6',
          }]}>
            <Picker
              selectedValue={newTask.priority}
              onValueChange={(value) => setNewTask(prev => ({ ...prev, priority: value }))}
              style={{ color: isDark ? '#FFFFFF' : '#111827' }}
            >
              <Picker.Item label="Low Priority" value="low" />
              <Picker.Item label="Medium Priority" value="medium" />
              <Picker.Item label="High Priority" value="high" />
            </Picker>
          </View>

          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Due Date
            </Text>
            <TouchableOpacity
              onPress={() => setShowDueDatePicker(true)}
              className={`flex-row items-center justify-between p-4 rounded-lg ${
                isDark ? 'bg-gray-700' : 'bg-gray-100'
              }`}
            >
              <Text className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                {newTask.due_date ? format(new Date(newTask.due_date), 'MMM dd, yyyy') : 'Select Due Date'}
              </Text>
              <Ionicons 
                name="calendar-outline" 
                size={20} 
                color={isDark ? '#9CA3AF' : '#6B7280'} 
              />
            </TouchableOpacity>

            {showDueDatePicker && (
              <DateTimePicker
                value={newTask.due_date ? new Date(newTask.due_date) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDueDateChange}
                minimumDate={new Date()}
                textColor={isDark ? '#FFFFFF' : '#000000'}
              />
            )}
          </View>

          <TouchableOpacity
            style={[styles.createButton, { opacity: isLoading ? 0.7 : 1 }]}
            onPress={createTask}
            disabled={isLoading || !newTask.title || !newTask.assignedTo}
          >
            <Text style={styles.createButtonText}>
              {isLoading ? 'Creating...' : 'Create Task'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Task list */}
        <View style={[styles.taskList, { marginBottom: 20 }]}>
          {isLoading ? (
            <View style={[styles.emptyState, { 
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF' 
            }]}>
              <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
              <Text style={[styles.emptyStateText, { 
                color: isDark ? '#9CA3AF' : '#6B7280',
                marginTop: 16 
              }]}>
                Loading tasks...
              </Text>
            </View>
          ) : filteredTasks.length === 0 ? (
            <View style={[styles.emptyState, { 
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF' 
            }]}>
              <Ionicons 
                name={tasks.length === 0 ? "list-outline" : "search-outline"} 
                size={48} 
                color={isDark ? '#4B5563' : '#9CA3AF'} 
              />
              <Text style={[styles.emptyStateText, { 
                color: isDark ? '#9CA3AF' : '#6B7280' 
              }]}>
                {tasks.length === 0 ? 'No tasks created yet' : 'No matching tasks found'}
              </Text>
              <Text style={[styles.emptyStateSubText, { 
                color: isDark ? '#6B7280' : '#9CA3AF' 
              }]}>
                {tasks.length === 0 
                  ? 'Create your first task using the form above'
                  : 'Try adjusting your filters or search query'
                }
              </Text>
            </View>
          ) : (
            filteredTasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                isDark={theme === 'dark'} 
              />
            ))
          )}
        </View>
      </ScrollView>
      <BottomNav items={groupAdminNavItems} />
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
  content: {
    flex: 1,
    padding: 16,
    marginTop: 8,
  },
  formSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  taskList: {
    gap: 12,
    marginBottom: 20,
  },
  taskCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
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
  createButton: {
    backgroundColor: '#3B82F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyStateSubText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  searchBar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    height: 50,
    marginTop: 8,
  },
  filterCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
}); 