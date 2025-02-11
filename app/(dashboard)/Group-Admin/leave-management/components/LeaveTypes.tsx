import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import axios from 'axios';

interface LeaveType {
  id: number;
  name: string;
  description: string;
  is_paid: boolean;
  requires_documentation: boolean;
  is_active: boolean;
}

export default function LeaveTypes() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === 'dark';
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaveTypes = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/leave-types`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setLeaveTypes(response.data);
    } catch (error) {
      console.error('Error fetching leave types:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLeaveTypes();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
      </View>
    );
  }

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
        {leaveTypes.length === 0 ? (
          <View className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
            <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No active leave types found
            </Text>
          </View>
        ) : (
          leaveTypes.map((type) => (
            <View
              key={type.id}
              className={`mb-4 p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
            >
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1">
                  <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {type.name}
                  </Text>
                  <Text className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {type.description}
                  </Text>
                </View>
                <View className={`px-3 py-1 rounded-full ${type.is_paid ? 'bg-green-100' : 'bg-yellow-100'}`}>
                  <Text className={type.is_paid ? 'text-green-800' : 'text-yellow-800'}>
                    {type.is_paid ? 'PAID' : 'UNPAID'}
                  </Text>
                </View>
              </View>

              <View className="flex-row mt-4 space-x-4">
                {type.requires_documentation && (
                  <View className="flex-row items-center">
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color={isDark ? '#9CA3AF' : '#6B7280'}
                      style={{ marginRight: 4 }}
                    />
                    <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Documentation Required
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
} 