import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import EditTaskModal from './EditTaskModal';

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
  is_reassigned?: boolean;
}

interface StatusHistory {
  status: string;
  updatedAt: string;
  updatedBy: number;
  updatedByName?: string;
}

interface TaskCardProps {
  task: Task;
  isDark: boolean;
  employees: any[];
  onUpdateTask: (taskId: number, updates: any) => Promise<void>;
}

// Add helper functions for colors
const getPriorityColor = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'high': return 'bg-red-500';
    case 'medium': return 'bg-amber-500';
    case 'low': return 'bg-green-500';
    default: return 'bg-gray-500';
  }
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed': return 'bg-green-500';
    case 'in_progress': return 'bg-amber-500';
    case 'pending': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
};

// Add a helper function for safe date formatting
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'Not set';
  try {
    return format(new Date(dateString), 'MMM dd, yyyy');
  } catch (error) {
    return 'Invalid date';
  }
};

// Add a helper function to check if task is editable
const isTaskEditable = (task: Task) => {
  return ['pending', 'in_progress'].includes(task.status);
};

// Add a helper function to check if task is overdue
const isTaskOverdue = (task: Task) => {
  if (!task.due_date) return false;
  const dueDate = new Date(task.due_date);
  return dueDate < new Date() && task.status !== 'completed';
};

export default function TaskCard({ task, isDark, employees, onUpdateTask }: TaskCardProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdateTask = async (taskId: number, updates: any) => {
    try {
      setIsLoading(true);
      await onUpdateTask(taskId, updates);
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating task:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if task has been reassigned
  const hasBeenReassigned = task.is_reassigned;

  return (
    <>
      <TouchableOpacity
        onPress={() => isTaskEditable(task) && setShowEditModal(true)}
        className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
        style={styles.card}
        disabled={!isTaskEditable(task)}
      >
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {task.title}
            </Text>
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Assigned to: {task.employee_name}
            </Text>
            <Text className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Created: {formatDate(task.createdAt)}
            </Text>
            <Text 
              className={`text-xs mt-1 ${
                isTaskOverdue(task) ? 'text-red-500' : isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Due: {task.due_date ? format(new Date(task.due_date), 'MMM dd, yyyy') : 'Not set'}
              {isTaskOverdue(task) && ' (Overdue)'}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <View className={`px-2 py-1 rounded-lg ${getPriorityColor(task.priority)}`}>
              <Text className="text-white text-xs font-medium">
                {task.priority.toUpperCase()}
              </Text>
            </View>
            {hasBeenReassigned && (
              <View className="px-2 py-1 rounded-lg bg-purple-500">
                <Text className="text-white text-xs font-medium">
                  Reassigned
                </Text>
              </View>
            )}
            {isTaskEditable(task) && (
              <TouchableOpacity
                onPress={() => setShowEditModal(true)}
                className={`p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
              >
                <Ionicons 
                  name="pencil" 
                  size={16} 
                  color={isDark ? '#60A5FA' : '#3B82F6'} 
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text className={`mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          {task.description}
        </Text>

        <View className="flex-row justify-end items-center">
          <View className={`px-2 py-1 rounded-lg ${getStatusColor(task.status)}`}>
            <Text className="text-white text-xs font-medium">
              {task.status === 'in_progress' ? 'In Progress' : 
               task.status.charAt(0).toUpperCase() + task.status.slice(1)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <EditTaskModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        task={task}
        employees={employees}
        onUpdateTask={handleUpdateTask}
        isDark={isDark}
        isLoading={isLoading}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
}); 