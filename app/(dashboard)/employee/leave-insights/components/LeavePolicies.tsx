import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import axios from 'axios';

interface LeavePolicy {
  id: number;
  name: string;
  description: string;
  max_days: number;
  is_paid: boolean;
  default_days: number;
  notice_period_days: number;
  max_consecutive_days: number;
  requires_documentation: boolean;
  carry_forward_days: number;
  min_service_days: number;
}

export default function LeavePolicies() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === 'dark';
  
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPolicy, setExpandedPolicy] = useState<number | null>(null);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave/types`,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      setPolicies(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error fetching policies:', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url
        });
      } else {
        console.error('Error fetching policies:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const togglePolicy = (policyId: number) => {
    setExpandedPolicy(expandedPolicy === policyId ? null : policyId);
  };

  return (
    <ScrollView className="flex-1">
      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" />
      ) : (
        policies.map(policy => (
          <View
            key={policy.id}
            className={`mb-4 rounded-lg overflow-hidden ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <TouchableOpacity
              onPress={() => togglePolicy(policy.id)}
              className="p-4 flex-row justify-between items-center"
            >
              <View className="flex-1">
                <Text className={`text-lg font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {policy.name}
                </Text>
                <View className="flex-row flex-wrap gap-2 mt-1">
                  <Text className="text-blue-500">
                    {policy.default_days} days/year
                  </Text>
                  <Text className={policy.is_paid ? 'text-green-500' : 'text-red-500'}>
                    {policy.is_paid ? 'Paid' : 'Unpaid'}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={expandedPolicy === policy.id ? 'chevron-up' : 'chevron-down'}
                size={24}
                color={isDark ? '#FFFFFF' : '#111827'}
              />
            </TouchableOpacity>

            {expandedPolicy === policy.id && (
              <View className={`p-4 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <Text className={`mb-3 ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {policy.description}
                </Text>
                
                <View className="space-y-2">
                  <View className="flex-row justify-between">
                    <Text className={isDark ? 'text-gray-300' : 'text-gray-600'}>Maximum Days:</Text>
                    <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {policy.max_days} days
                    </Text>
                  </View>

                  <View className="flex-row justify-between">
                    <Text className={isDark ? 'text-gray-300' : 'text-gray-600'}>Notice Period:</Text>
                    <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {policy.notice_period_days} days
                    </Text>
                  </View>

                  <View className="flex-row justify-between">
                    <Text className={isDark ? 'text-gray-300' : 'text-gray-600'}>Max Consecutive Days:</Text>
                    <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {policy.max_consecutive_days} days
                    </Text>
                  </View>

                  {policy.carry_forward_days > 0 && (
                    <View className="flex-row justify-between">
                      <Text className={isDark ? 'text-gray-300' : 'text-gray-600'}>Carry Forward:</Text>
                      <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {policy.carry_forward_days} days
                      </Text>
                    </View>
                  )}

                  {policy.min_service_days > 0 && (
                    <View className="flex-row justify-between">
                      <Text className={isDark ? 'text-gray-300' : 'text-gray-600'}>Minimum Service Required:</Text>
                      <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {policy.min_service_days} days
                      </Text>
                    </View>
                  )}

                  {policy.requires_documentation && (
                    <View className="mt-2 p-2 bg-yellow-100 rounded">
                      <Text className="text-yellow-800">
                        <Ionicons name="information-circle" size={16} /> Documentation required
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
} 