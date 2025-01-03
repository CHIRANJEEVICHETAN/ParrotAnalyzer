import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { format } from 'date-fns';

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

interface TaskCardProps {
  task: Task;
  isDark: boolean;
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

export default function TaskCard({ task, isDark }: TaskCardProps) {
  return (
    <View
      className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
      style={styles.card}
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
          <Text className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Due: {task.due_date ? format(new Date(task.due_date), 'MMM dd, yyyy') : 'Not set'}
          </Text>
        </View>
        <View className={`px-2 py-1 rounded-lg ${getPriorityColor(task.priority)}`}>
          <Text className="text-white text-xs font-medium">
            {task.priority.toUpperCase()}
          </Text>
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
    </View>
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