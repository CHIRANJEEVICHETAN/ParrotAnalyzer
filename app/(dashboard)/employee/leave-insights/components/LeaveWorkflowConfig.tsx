import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useColorScheme } from '../../../../../app/hooks/useColorScheme';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

interface ApprovalLevel {
  level_id: number;
  level_name: string;
  level_order: number;
  role: string;
  is_required: boolean;
}

interface WorkflowConfig {
  id: number;
  company_id: number;
  leave_type_id: number;
  leave_type_name: string;
  min_days: number;
  max_days: number | null;
  requires_all_levels: boolean;
  is_active: boolean;
  approval_levels: ApprovalLevel[];
}

export default function LeaveWorkflowConfig() {
  const isDark = useColorScheme() === 'dark';
  const [workflows, setWorkflows] = useState<WorkflowConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWorkflow, setExpandedWorkflow] = useState<number | null>(null);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-approvals/workflows`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      setWorkflows(response.data);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching workflows:', error);
      setError(error.response?.data?.error || 'Failed to fetch workflows');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text className={`text-center mb-4 ${isDark ? 'text-red-400' : 'text-red-500'}`}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={fetchWorkflows}
          className="bg-blue-500 px-4 py-2 rounded-full"
        >
          <Text className="text-white">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1">
      <View className="p-4">
        {/* Summary Card */}
        <View className={`mb-6 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Active Workflows
          </Text>
          <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {workflows.length}
          </Text>
        </View>

        {/* Workflow List */}
        {workflows.length === 0 ? (
          <View className={`p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No approval workflows configured
            </Text>
          </View>
        ) : (
          workflows.map((workflow) => (
            <View
              key={workflow.id}
              className={`mb-4 rounded-lg overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            >
              {/* Header */}
              <TouchableOpacity
                onPress={() => setExpandedWorkflow(
                  expandedWorkflow === workflow.id ? null : workflow.id
                )}
                className={`p-4 flex-row justify-between items-center ${
                  expandedWorkflow === workflow.id && 
                  (isDark ? 'border-b border-gray-700' : 'border-b border-gray-200')
                }`}
              >
                <View>
                  <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {workflow.leave_type_name}
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {workflow.min_days} - {workflow.max_days ?? '∞'} days
                  </Text>
                </View>
                <Ionicons
                  name={expandedWorkflow === workflow.id ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color={isDark ? '#9CA3AF' : '#6B7280'}
                />
              </TouchableOpacity>

              {/* Expanded Content */}
              {expandedWorkflow === workflow.id && (
                <View className="p-4">
                  {/* Workflow Settings */}
                  <View className="mb-4">
                    <View className="flex-row items-center mb-2">
                      <Ionicons
                        name={workflow.requires_all_levels ? 'checkmark-circle' : 'alert-circle'}
                        size={16}
                        color={workflow.requires_all_levels ? '#10B981' : '#F59E0B'}
                      />
                      <Text className={`ml-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {workflow.requires_all_levels
                          ? 'All levels required'
                          : 'Flexible approval path'
                        }
                      </Text>
                    </View>
                  </View>

                  {/* Approval Levels */}
                  <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Approval Levels
                  </Text>
                  {workflow.approval_levels.map((level, index) => (
                    <View
                      key={level.level_id}
                      className={`flex-row items-center justify-between p-3 rounded-lg mb-2 ${
                        isDark ? 'bg-gray-700' : 'bg-gray-100'
                      }`}
                    >
                      <View className="flex-1">
                        <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {level.level_name}
                        </Text>
                        <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {level.role.charAt(0).toUpperCase() + level.role.slice(1).replace('_', ' ')}
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <Text className={`mr-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Level {level.level_order}
                        </Text>
                        {level.is_required && (
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color={isDark ? '#10B981' : '#059669'}
                          />
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
} 