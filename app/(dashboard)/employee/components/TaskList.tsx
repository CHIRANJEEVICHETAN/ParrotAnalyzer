import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

interface Task {
  id: number;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  due_date: string;
  assigned_by_name: string;
}

interface TaskListProps {
  tasks: Task[];
  isDark: boolean;
  onUpdateStatus: (taskId: number, newStatus: string) => void;
  activeTaskType: string;
  onChangeTaskType: (type: string) => void;
}

export default function TaskList({ tasks, isDark, onUpdateStatus, activeTaskType, onChangeTaskType }: TaskListProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'low': return '#10B981';
      case 'medium': return '#F59E0B';
      case 'high': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getTaskTypeColor = (type: string, isActive: boolean) => {
    if (isActive) {
      return {
        bg: '#3B82F6',
        text: '#FFFFFF'
      };
    }
    return {
      bg: isDark ? '#374151' : '#F3F4F6',
      text: isDark ? '#9CA3AF' : '#6B7280'
    };
  };

  const filteredTasks = tasks.filter(task => 
    activeTaskType === 'All Tasks' || 
    task.status.toLowerCase().replace('_', ' ') === activeTaskType.toLowerCase()
  );

  const taskTypes = [
    { label: 'All Tasks', value: 'All Tasks' },
    { label: 'Pending', value: 'pending' },
    { label: 'In Progress', value: 'in progress' },
    { label: 'Completed', value: 'completed' }
  ];

  return (
    <View style={styles.container}>
      {/* Task Type Selector */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.taskTypeSelector}
      >
        {taskTypes.map((type) => (
          <TouchableOpacity
            key={type.label}
            onPress={() => onChangeTaskType(type.label)}
            style={[
              styles.taskTypeButton,
              { backgroundColor: getTaskTypeColor(type.label, activeTaskType === type.label).bg }
            ]}
          >
            <Text style={[
              styles.taskTypeText,
              { color: getTaskTypeColor(type.label, activeTaskType === type.label).text }
            ]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
          <Ionicons 
            name="calendar-outline" 
            size={48} 
            color={isDark ? '#4B5563' : '#9CA3AF'} 
          />
          <Text style={[styles.emptyText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            No tasks for today
          </Text>
          <Text style={[styles.emptySubText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
            Check back later for new assignments
          </Text>
        </View>
      ) : (
        filteredTasks.map((task) => (
          <View 
            key={task.id}
            style={[styles.taskCard, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}
          >
            <View style={styles.taskHeader}>
              <Text style={[styles.taskTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                {task.title}
              </Text>
              <View style={[
                styles.priorityBadge,
                { backgroundColor: `${getPriorityColor(task.priority)}20` }
              ]}>
                <Text style={[styles.priorityText, { color: getPriorityColor(task.priority) }]}>
                  {task.priority.toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={[styles.taskDescription, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {task.description}
            </Text>

            <View style={styles.taskFooter}>
              <View style={styles.statusContainer}>
                <Text style={[styles.label, { color: isDark ? '#D1D5DB' : '#374151' }]}>
                  Status:
                </Text>
                <Picker
                  selectedValue={task.status}
                  onValueChange={(value) => onUpdateStatus(task.id, value)}
                  style={[styles.statusPicker, { color: isDark ? '#FFFFFF' : '#111827' }]}
                >
                  <Picker.Item label="Pending" value="pending" />
                  <Picker.Item label="In Progress" value="in_progress" />
                  <Picker.Item label="Completed" value="completed" />
                </Picker>
              </View>
            </View>

            <View style={[
              styles.assignedByContainer,
              { borderTopColor: isDark ? '#374151' : '#E5E7EB' }
            ]}>
              <Text style={[styles.assignedBy, { color: isDark ? '#D1D5DB' : '#374151' }]}>
                Assigned by: {task.assigned_by_name}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  taskTypeSelector: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  taskTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  taskTypeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  taskCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  taskDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  label: {
    fontSize: 14,
    marginRight: 8,
  },
  statusPicker: {
    width: 150,
  },
  assignedByContainer: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  assignedBy: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 8,
  },
  emptySubText: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
}); 