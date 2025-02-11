import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import axios from 'axios';

interface LeavePolicy {
  id: number;
  leave_type_id: number;
  leave_type_name: string;
  default_days: number;
  carry_forward_days: number;
  min_service_days: number;
  requires_approval: boolean;
  notice_period_days: number;
  max_consecutive_days: number;
  gender_specific: string | null;
  is_active: boolean;
}

export default function LeavePolicies() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === 'dark';
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<number | null>(null);

  const fetchPolicies = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/leave-policies`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setPolicies(response.data);
    } catch (error) {
      console.error('Error fetching leave policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPolicies();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
      </View>
    );
  }

  const renderPolicyCard = (policy: LeavePolicy) => {
    const isSelected = selectedPolicy === policy.id;
    
    return (
      <TouchableOpacity
        key={policy.id}
        onPress={() => setSelectedPolicy(isSelected ? null : policy.id)}
        className={`mb-4 rounded-xl overflow-hidden ${
          isDark ? 'bg-gray-800' : 'bg-white'
        } shadow-sm`}
      >
        {/* Header */}
        <View className={`p-4 ${
          isSelected ? isDark ? 'bg-blue-900/50' : 'bg-blue-50' : ''
        }`}>
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text className={`text-lg font-semibold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {policy.leave_type_name}
              </Text>
              <View className="flex-row items-center mt-1">
                <View className={`px-2 py-1 rounded-full ${
                  policy.is_active ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <Text className={
                    policy.is_active ? 'text-green-800' : 'text-red-800'
                  }>
                    {policy.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </View>
                {policy.gender_specific && (
                  <View className="px-2 py-1 rounded-full bg-purple-100 ml-2">
                    <Text className="text-purple-800">
                      {policy.gender_specific.toUpperCase()} ONLY
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Ionicons
              name={isSelected ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </View>
        </View>

        {/* Quick Info */}
        <View className="px-4 py-3 flex-row justify-between border-t border-b border-gray-200">
          <View className="items-center flex-1">
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Default Days
            </Text>
            <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {policy.default_days}
            </Text>
          </View>
          <View className="items-center flex-1 border-l border-r border-gray-200">
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Carry Forward
            </Text>
            <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {policy.carry_forward_days}
            </Text>
          </View>
          <View className="items-center flex-1">
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Max Consecutive
            </Text>
            <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {policy.max_consecutive_days}
            </Text>
          </View>
        </View>

        {/* Expanded Details */}
        {isSelected && (
          <View className="p-4 space-y-3">
            <View className="flex-row items-center">
              <View className={`w-8 h-8 rounded-full ${
                isDark ? 'bg-gray-700' : 'bg-gray-100'
              } items-center justify-center mr-3`}>
                <Ionicons name="time-outline" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </View>
              <View>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Notice Period Required
                </Text>
                <Text className={`text-base font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {policy.notice_period_days} days
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className={`w-8 h-8 rounded-full ${
                isDark ? 'bg-gray-700' : 'bg-gray-100'
              } items-center justify-center mr-3`}>
                <Ionicons name="hourglass-outline" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </View>
              <View>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Minimum Service Required
                </Text>
                <Text className={`text-base font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {policy.min_service_days} days
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className={`w-8 h-8 rounded-full ${
                isDark ? 'bg-gray-700' : 'bg-gray-100'
              } items-center justify-center mr-3`}>
                <Ionicons
                  name={policy.requires_approval ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={policy.requires_approval ? '#10B981' : '#EF4444'}
                />
              </View>
              <View>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Approval Requirement
                </Text>
                <Text className={`text-base font-medium ${
                  policy.requires_approval ? 'text-green-500' : 'text-red-500'
                }`}>
                  {policy.requires_approval ? 'Requires Approval' : 'Auto-Approved'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[isDark ? '#60A5FA' : '#3B82F6']}
          tintColor={isDark ? '#60A5FA' : '#3B82F6'}
        />
      }
    >
      <View className="flex-1">
        {policies.length === 0 ? (
          <View className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
            <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No leave policies found
            </Text>
          </View>
        ) : (
          policies.map(renderPolicyCard)
        )}
      </View>
    </ScrollView>
  );
} 