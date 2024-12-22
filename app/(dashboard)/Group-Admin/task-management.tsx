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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import TaskCard from './components/TaskCard';

interface Employee {
  id: number;
  name: string;
  email: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  assignedTo: number;
  priority: 'low' | 'medium' | 'high';
  dueDate: Date;
  status: 'pending' | 'in_progress' | 'completed';
  employee_name: string;
  status_history: StatusHistory[];
}

interface StatusHistory {
  status: string;
  updatedAt: string;
  updatedBy: number;
  updatedByName?: string;
}

export default function TaskManagement() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newTask, setNewTask] = useState<Omit<Task, 'id'>>({
    title: '',
    description: '',
    assignedTo: 0,
    priority: 'medium',
    dueDate: new Date(),
    status: 'pending',
    employee_name: '',
    status_history: []
  });

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
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks/admin`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      console.log('Tasks response:', response.data); // Debug log
      setTasks(response.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
        console.error('Status code:', error.response?.status);
      }
      Alert.alert('Error', 'Failed to fetch tasks');
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
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks`,
        newTask,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      Alert.alert('Success', 'Task created successfully');
      fetchTasks();
      // Reset form with all required fields
      setNewTask({
        title: '',
        description: '',
        assignedTo: 0,
        priority: 'medium',
        dueDate: new Date(),
        status: 'pending',
        employee_name: '',
        status_history: []
      });
    } catch (error) {
      console.error('Error creating task:', error);
      Alert.alert('Error', 'Failed to create task');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F3F4F6' }]}>
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons 
            name="arrow-back" 
            size={24} 
            color={isDark ? '#FFFFFF' : '#111827'} 
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
          Task Management
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Task creation form */}
      <ScrollView style={styles.content}>
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
        <View style={styles.taskList}>
          {tasks.length === 0 ? (
            <View style={[styles.emptyState, { 
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF' 
            }]}>
              <Ionicons 
                name="list-outline" 
                size={48} 
                color={isDark ? '#4B5563' : '#9CA3AF'} 
              />
              <Text style={[styles.emptyStateText, { 
                color: isDark ? '#9CA3AF' : '#6B7280' 
              }]}>
                No tasks created yet
              </Text>
              <Text style={[styles.emptyStateSubText, { 
                color: isDark ? '#6B7280' : '#9CA3AF' 
              }]}>
                Create your first task using the form above
              </Text>
            </View>
          ) : (
            tasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                isDark={theme === 'dark'} 
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
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
  },
  taskCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  taskDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  taskMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  assignedTo: {
    fontSize: 14,
  },
  priority: {
    fontSize: 14,
  },
  pickerContainer: {
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
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
}); 