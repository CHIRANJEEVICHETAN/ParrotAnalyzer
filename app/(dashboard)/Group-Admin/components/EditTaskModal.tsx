import React, { useState, useRef, useEffect, memo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
  FlatList,
  Keyboard
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useNotifications } from '../../../context/NotificationContext';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';

interface Employee {
  id: number;
  name: string;
  email: string;
  employee_number: string;
}

interface EditTaskModalProps {
  visible: boolean;
  onClose: () => void;
  task: any;
  employees: Employee[];
  onUpdateTask: (taskId: number, updates: any) => Promise<void>;
  isDark: boolean;
  isLoading: boolean;
}

interface EmployeePickerModalProps {
  show: boolean;
  onClose: () => void;
  employeeSearch: string;
  setEmployeeSearch: (text: string) => void;
  filteredEmployees: Employee[];
  isDark: boolean;
  onSelectEmployee: (id: number) => void;
  selectedEmployeeId: number;
}

const EmployeePickerModal = memo(({
  show,
  onClose,
  employeeSearch,
  setEmployeeSearch,
  filteredEmployees,
  isDark,
  onSelectEmployee,
  selectedEmployeeId
}: EmployeePickerModalProps) => {
  const employeeInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (show && Platform.OS === 'android') {
      setTimeout(() => {
        employeeInputRef.current?.focus();
      }, 300);
    }
  }, [show]);

  // Determine if this is the "All Employees" option (id: 0)
  const renderEmployeeItem = ({ item }: { item: Employee }) => (
    <TouchableOpacity
      style={{
        padding: 16,
        marginBottom: 10,
        borderRadius: 8,
        backgroundColor: selectedEmployeeId === item.id 
          ? (isDark ? '#2563eb' : '#bfdbfe')
          : (isDark ? '#374151' : '#f3f4f6')
      }}
      onPress={() => {
        Keyboard.dismiss();
        onSelectEmployee(item.id);
        onClose();
      }}
    >
      <Text style={{ fontWeight: '500', color: isDark ? '#fff' : '#000' }}>
        {item.id === 0 ? '👥 All Employees' : item.name}
      </Text>
      {item.id !== 0 && (
        <Text style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
          {item.employee_number}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={show}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
        activeOpacity={1}
        onPress={() => {
          Keyboard.dismiss();
          onClose();
        }}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={(e) => e.stopPropagation()}
          style={{
            maxHeight: '80%',
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            padding: 20,
            backgroundColor: isDark ? '#1F2937' : '#fff'
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: isDark ? '#fff' : '#000' }}>
              {selectedEmployeeId === 0 && filteredEmployees.some(e => e.id === 0) ? 'Select Filter' : 'Reassign To'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 10,
              marginBottom: 20,
              borderRadius: 8,
              backgroundColor: isDark ? '#374151' : '#f3f4f6'
            }}
          >
            <Ionicons name="search" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} style={{ marginRight: 8 }} />
            <TextInput
              ref={employeeInputRef}
              value={employeeSearch}
              onChangeText={setEmployeeSearch}
              placeholder="Search by name or employee number..."
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              style={{ flex: 1, color: isDark ? '#fff' : '#000' }}
              autoFocus={false}
            />
            {employeeSearch.length > 0 && (
              <TouchableOpacity onPress={() => setEmployeeSearch('')}>
                <Ionicons name="close-circle" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </TouchableOpacity>
            )}
          </View>
          {filteredEmployees.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Ionicons name="people" size={48} color={isDark ? '#4B5563' : '#9CA3AF'} />
              <Text style={{ marginTop: 16, textAlign: 'center', color: isDark ? '#9CA3AF' : '#6B7280' }}>
                No employees found
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredEmployees}
              keyboardShouldPersistTaps="always"
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderEmployeeItem}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
});

export default function EditTaskModal({
  visible,
  onClose,
  task,
  employees,
  onUpdateTask,
  isDark,
  isLoading: isLoadingProp
}: EditTaskModalProps) {
  const { notifications, setNotifications } = useNotifications();
  const [selectedEmployee, setSelectedEmployee] = useState(task?.assignedTo || 0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dueDate, setDueDate] = useState(
    task?.due_date ? new Date(task.due_date) : new Date()
  );
  const [isLoading, setIsLoading] = useState(isLoadingProp);
  const { token } = useAuth();
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Reset state when modal becomes visible
  React.useEffect(() => {
    if (visible) {
      setSelectedEmployee(task?.assignedTo || 0);
      setDueDate(task?.due_date ? new Date(task.due_date) : new Date());
      setEmployeeSearch('');
    }
  }, [visible, task]);

  // Filter employees based on search query
  const filteredEmployees = employees.filter(employee => 
    employee.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    employee.employee_number.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  const handleUpdate = async () => {
    try {
      setIsLoading(true);
      const isReassignment = selectedEmployee !== task.assignedTo;
      const formattedDueDate = format(dueDate, 'MMM dd, yyyy');
      
      const updates = {
        assignedTo: selectedEmployee,
        dueDate: dueDate.toISOString(),
        isReassignment
      };
      
      // First update the task
      const updatedTask = await onUpdateTask(task.id, updates);

      // Then send notification
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-notifications/notify-task-assignment`,
        {
          employeeId: selectedEmployee,
          taskDetails: {
            title: task.title,
            description: task.description,
            priority: task.priority,
            dueDate: dueDate.toISOString(),
            formattedDueDate: formattedDueDate,
            taskId: task.id,
            isReassignment,
            isDueDateChanged: task.due_date ? dueDate.toISOString() !== task.due_date : true
          },
        },
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        }
      );

      onClose();
    } catch (error) {
      console.error('Error in handleUpdate:', error);
      Alert.alert('Error', 'Failed to update task. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <TouchableOpacity
          className="absolute inset-0"
          onPress={onClose}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        />
        <View
          className={`rounded-t-3xl p-6 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}
          style={styles.modalContent}
        >
          <View className="flex-row justify-between items-center mb-6">
            <Text
              className={`text-xl font-semibold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              Edit Task
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className={`p-2 rounded-full ${
                isDark ? 'bg-gray-700' : 'bg-gray-100'
              }`}
            >
              <Ionicons
                name="close"
                size={24}
                color={isDark ? '#FFFFFF' : '#111827'}
              />
            </TouchableOpacity>
          </View>

          <View className="mb-6">
            <Text
              className={`text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Reassign To
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowEmployeePicker(true);
                setEmployeeSearch('');
                Keyboard.dismiss();
              }}
              className={`p-4 rounded-lg flex-row justify-between items-center ${
                isDark ? 'bg-gray-700' : 'bg-gray-100'
              }`}
            >
              <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                {selectedEmployee === 0 
                  ? 'Select Employee' 
                  : `${employees.find(e => e.id === selectedEmployee)?.name || ''} - ${employees.find(e => e.id === selectedEmployee)?.employee_number || ''}`
                }
              </Text>
              <Ionicons name="chevron-down" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          <View className="mb-6">
            <Text
              className={`text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Due Date
            </Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className={`flex-row items-center justify-between p-4 rounded-xl ${
                isDark ? 'bg-gray-700' : 'bg-gray-100'
              }`}
            >
              <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                {format(dueDate, 'MMM dd, yyyy')}
              </Text>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={isDark ? '#9CA3AF' : '#6B7280'}
              />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={dueDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                minimumDate={new Date()}
                textColor={isDark ? '#FFFFFF' : '#000000'}
              />
            )}
          </View>

          <TouchableOpacity
            className={`py-3 rounded-xl ${
              isDark ? 'bg-green-600' : 'bg-green-500'
            } items-center justify-center`}
            onPress={handleUpdate}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white font-semibold">
                Update Assignment
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      <EmployeePickerModal
        show={showEmployeePicker}
        onClose={() => setShowEmployeePicker(false)}
        employeeSearch={employeeSearch}
        setEmployeeSearch={setEmployeeSearch}
        filteredEmployees={filteredEmployees}
        isDark={isDark}
        onSelectEmployee={(id: number) => setSelectedEmployee(id)}
        selectedEmployeeId={selectedEmployee}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
}); 