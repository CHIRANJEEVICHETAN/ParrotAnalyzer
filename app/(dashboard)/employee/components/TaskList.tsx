import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

interface Task {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  assigned_by_name: string;
}

interface Props {
  tasks: Task[];
  onRefresh: () => void;
  refreshing: boolean;
  isDark: boolean;
  onUpdateStatus: (taskId: number, newStatus: 'pending' | 'in_progress' | 'completed') => void;
  activeTaskType: string;
  onChangeTaskType: (type: string) => void;
}

export default function TaskList({ 
  tasks, 
  onRefresh, 
  refreshing, 
  isDark, 
  onUpdateStatus,
  activeTaskType,
  onChangeTaskType 
}: Props) {
  const [selectedTask, setSelectedTask] = useState<number | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusLoading, setStatusLoading] = useState<number | null>(null);
  
  const taskTypes = ['All Tasks', 'Pending', 'In Progress', 'Completed'];
  const statusOptions = [
    { value: 'pending', label: 'PENDING', icon: 'time-outline' },
    { value: 'in_progress', label: 'IN PROGRESS', icon: 'play-outline' },
    { value: 'completed', label: 'COMPLETED', icon: 'checkmark-circle-outline' }
  ];

  const filteredTasks = tasks.filter(task => {
    if (activeTaskType === 'All Tasks') return true;
    return task.status === activeTaskType.toLowerCase().replace(' ', '_');
  });

  const handleStatusUpdate = async (taskId: number, newStatus: string) => {
    setStatusLoading(taskId);
    try {
      await onUpdateStatus(taskId, newStatus as any);
    } finally {
      setStatusLoading(null);
      setShowStatusModal(false);
      setSelectedTask(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'in_progress': return '#3B82F6';
      case 'completed': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'low': return '#10B981';
      case 'medium': return '#F59E0B';
      case 'high': return '#EF4444';
      default: return '#6B7280';
    }
  };

  useEffect(() => {
    console.log('Current tasks:', tasks.map(task => ({
      id: task.id,
      title: task.title,
      due_date: task.due_date,
      status: task.status
    })));
  }, [tasks]);

  return (
    <View>
      {/* Task Type Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="mb-4"
      >
        {taskTypes.map((type) => (
          <TouchableOpacity
            key={type}
            onPress={() => onChangeTaskType(type)}
            className={`mr-2 px-4 py-2 rounded-full ${
              activeTaskType === type 
                ? 'bg-blue-500' 
                : isDark ? 'bg-gray-800' : 'bg-gray-100'
            }`}
          >
            <Text className={
              activeTaskType === type
                ? 'text-white font-medium'
                : isDark ? 'text-gray-300' : 'text-gray-600'
            }>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[isDark ? '#60A5FA' : '#3B82F6']} // Blue color for refresh spinner
            tintColor={isDark ? '#60A5FA' : '#3B82F6'}
            progressBackgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
          />
        }
      >
        {filteredTasks.length === 0 ? (
          <View className={`p-8 rounded-lg items-center justify-center ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <Ionicons 
              name="calendar-outline" 
              size={48} 
              color={isDark ? '#4B5563' : '#9CA3AF'} 
            />
            <Text className={`mt-4 text-lg font-medium ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              No tasks available
            </Text>
          </View>
        ) : (
          filteredTasks.map((task) => (
            <View 
              key={task.id}
              style={[
                styles.taskCard,
                { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }
              ]}
              className="mb-4 p-4 rounded-xl"
            >
              <View style={styles.taskContent}>
                <Text className={`text-lg font-semibold mb-2 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {task.title}
                </Text>
                <Text className={`mb-2 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {task.description}
                </Text>

                <Text className={`text-sm mb-3 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Due: {task.due_date ? format(new Date(task.due_date), 'MMM dd, yyyy') : 'Not set'}
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    setSelectedTask(task.id);
                    setShowStatusModal(true);
                  }}
                  className="flex-row items-center self-end"
                  style={[
                    styles.statusButton,
                    { backgroundColor: `${getStatusColor(task.status)}20` }
                  ]}
                  disabled={statusLoading === task.id}
                >
                  {statusLoading === task.id ? (
                    <ActivityIndicator 
                      size="small" 
                      color={getStatusColor(task.status)} 
                      style={{ marginRight: 8 }}
                    />
                  ) : (
                    <Ionicons
                      name={statusOptions.find(s => s.value === task.status)?.icon as any}
                      size={20}
                      color={getStatusColor(task.status)}
                    />
                  )}
                  <Text style={[
                    styles.statusText,
                    { color: getStatusColor(task.status) }
                  ]}>
                    {task.status.replace('_', ' ').toUpperCase()}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={getStatusColor(task.status)}
                    style={{ marginLeft: 8 }}
                  />
                </TouchableOpacity>

                <View className="flex-row justify-between items-center mt-3">
                  <Text className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    By: {task.assigned_by_name}
                  </Text>
                  <View style={[
                    styles.priorityBadge,
                    { backgroundColor: `${getPriorityColor(task.priority)}20` }
                  ]}>
                    <Text style={{ color: getPriorityColor(task.priority) }}>
                      {task.priority.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Status Update Modal */}
      <Modal
        visible={showStatusModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowStatusModal(false)}
        >
          <View style={[
            styles.modalContent,
            { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }
          ]}>
            {statusOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => handleStatusUpdate(selectedTask!, option.value)}
                style={[
                  styles.statusOption,
                  { borderBottomColor: isDark ? '#374151' : '#E5E7EB' }
                ]}
              >
                <Ionicons
                  name={option.icon as any}
                  size={24}
                  color={getStatusColor(option.value)}
                />
                <Text style={[
                  styles.statusOptionText,
                  { color: isDark ? '#FFFFFF' : '#111827' }
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  taskCard: {
    shadowColor: '#000',
    shadowOffset: { 
      width: 2,
      height: 2
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    backgroundColor: 'transparent',
    margin: 1,
  },
  taskContent: {
    flex: 1,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-end',
    maxWidth: '50%',
  },
  statusText: {
    marginLeft: 8,
    fontWeight: '500',
    fontSize: 12,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '60%',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'absolute',
    right: 20,
    top: '40%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  statusOptionText: {
    marginLeft: 12,
    fontWeight: '500',
  },
}); 