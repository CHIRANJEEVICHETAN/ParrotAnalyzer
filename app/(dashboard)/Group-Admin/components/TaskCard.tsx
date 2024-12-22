import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

interface StatusHistory {
  status: string;
  updatedAt: string;
  updatedBy: number;
  updatedByName?: string;
}

interface TaskCardProps {
  task: {
    id: number;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'in_progress' | 'completed';
    employee_name: string;
    status_history: StatusHistory[];
  };
  isDark: boolean;
}

export default function TaskCard({ task, isDark }: TaskCardProps) {
  const [showHistory, setShowHistory] = useState(false);

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'low': return '#10B981';
      case 'medium': return '#F59E0B';
      case 'high': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return '#10B981';
      case 'in_progress': return '#F59E0B';
      case 'pending': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#111827' }]}>
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

      <Text style={[styles.description, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
        {task.description}
      </Text>

      <View style={styles.metaInfo}>
        <View style={styles.assignedTo}>
          <Text style={[styles.label, { color: isDark ? '#D1D5DB' : '#374151' }]}>
            Assigned to:
          </Text>
          <Text style={[styles.value, { color: isDark ? '#FFFFFF' : '#111827' }]}>
            {task.employee_name}
          </Text>
        </View>

        <View style={styles.status}>
          <Text style={[styles.label, { color: isDark ? '#D1D5DB' : '#374151' }]}>
            Current Status:
          </Text>
          <Text style={[styles.statusText, { color: getStatusColor(task.status) }]}>
            {task.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Status History Section */}
      <TouchableOpacity 
        style={styles.historyButton}
        onPress={() => setShowHistory(!showHistory)}
      >
        <Ionicons 
          name={showHistory ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color={isDark ? '#9CA3AF' : '#6B7280'} 
        />
        <Text style={[styles.historyButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
          {showHistory ? 'Hide Status History' : 'Show Status History'}
        </Text>
      </TouchableOpacity>

      {showHistory && (
        <View style={[
          styles.historyContainer,
          { borderTopColor: isDark ? '#374151' : '#E5E7EB' }
        ]}>
          {task.status_history.map((history, index) => (
            <View key={index} style={styles.historyItem}>
              <View style={styles.historyDot}>
                <View style={[
                  styles.dot,
                  { backgroundColor: getStatusColor(history.status) }
                ]} />
                <View style={[
                  styles.line,
                  { 
                    backgroundColor: isDark ? '#374151' : '#E5E7EB',
                    display: index === task.status_history.length - 1 ? 'none' : 'flex'
                  }
                ]} />
              </View>
              <View style={styles.historyContent}>
                <Text style={[styles.historyStatus, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                  {history.status.replace('_', ' ').toUpperCase()}
                </Text>
                <Text style={[styles.historyMeta, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  Updated by {history.updatedByName} on {format(new Date(history.updatedAt), 'MMM dd, yyyy HH:mm')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
  },
  metaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  assignedTo: {
    flex: 1,
  },
  status: {
    flex: 1,
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 12,
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  historyButtonText: {
    marginLeft: 8,
    fontSize: 14,
  },
  historyContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  historyItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  historyDot: {
    alignItems: 'center',
    width: 20,
    marginRight: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  historyContent: {
    flex: 1,
  },
  historyStatus: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  historyMeta: {
    fontSize: 12,
  },
}); 