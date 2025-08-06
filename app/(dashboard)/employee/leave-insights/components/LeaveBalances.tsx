import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useColorScheme } from '../../../../../app/hooks/useColorScheme';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import LeaveRequestForm from './LeaveRequestForm';
import Modal from 'react-native-modal';

interface LeaveBalance {
  id: number;
  leave_type_id: number;
  name: string;
  is_paid: boolean;
  total_days: number;
  used_days: number;
  pending_days: number;
  carry_forward_days: number;
  available_days: number;
  role_default_days: number;
  role_carry_forward_days: number;
  requires_documentation: boolean;
}

export default function LeaveBalances() {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [tooltipInfo, setTooltipInfo] = useState<{ visible: boolean; text: string; x: number; y: number }>({
    visible: false,
    text: '',
    x: 0,
    y: 0
  });
  const isDark = useColorScheme() === 'dark';

  useEffect(() => {
    fetchLeaveBalances();
  }, [selectedYear]);

  const fetchLeaveBalances = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave/balance?year=${selectedYear}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      setBalances(response.data);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching leave balances:', error);
      setError(error.response?.data?.error || 'Failed to fetch leave balances');
    } finally {
      setLoading(false);
    }
  };

  const getLeaveTypeColor = (leaveType: string): string => {
    const type = leaveType.toLowerCase();
    if (type.includes('casual') || type.includes('cl')) return '#3B82F6';
    if (type.includes('sick') || type.includes('sl')) return '#EF4444';
    if (type.includes('annual') || type.includes('privilege') || type.includes('pl') || type.includes('el')) return '#10B981';
    if (type.includes('maternity') || type.includes('paternity') || type.includes('adoption')) return '#EC4899';
    if (type.includes('marriage')) return '#8B5CF6';
    if (type.includes('bereavement')) return '#6B7280';
    if (type.includes('compensatory') || type.includes('comp')) return '#14B8A6';
    return '#6B7280';
  };

  const showTooltip = (text: string, event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setTooltipInfo({
      visible: true,
      text,
      x: pageX,
      y: pageY - 60 // Offset to show above the finger
    });
  };

  const renderYearSelector = () => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    return (
      <View className="flex-row justify-center space-x-2 mb-4">
        {years.map(year => (
          <TouchableOpacity
            key={year}
            onPress={() => setSelectedYear(year)}
            className={`px-4 py-2 rounded-full ${
              selectedYear === year
                ? 'bg-blue-500'
                : isDark ? 'bg-gray-700' : 'bg-gray-200'
            }`}
          >
            <Text
              className={`${
                selectedYear === year
                  ? 'text-white'
                  : isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              {year}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderProgressBar = (used: number, total: number, pending: number) => {
    const usedPercentage = (used / total) * 100;
    const pendingPercentage = (pending / total) * 100;
    
    return (
      <View className="h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
        <View 
          style={{ width: `${usedPercentage}%` }}
          className="h-full bg-blue-500 absolute left-0"
        />
        <View 
          style={{ width: `${pendingPercentage}%`, left: `${usedPercentage}%` }}
          className="h-full bg-yellow-500 absolute"
        />
      </View>
    );
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
          onPress={fetchLeaveBalances}
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
        {renderYearSelector()}

        {/* Action Button */}
        <TouchableOpacity
          onPress={() => setShowRequestForm(true)}
          className="bg-blue-500 px-4 py-3 rounded-lg mb-6 flex-row justify-center items-center"
        >
          <Ionicons name="add-circle-outline" size={20} color="white" style={{ marginRight: 8 }} />
          <Text className="text-white font-medium">Request Leave</Text>
        </TouchableOpacity>

        {/* Summary Cards */}
        <View className="flex-row flex-wrap justify-between mb-6">
          <View className={`w-[48%] p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Total Leave Types
            </Text>
            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {balances.length}
            </Text>
          </View>
          <View className={`w-[48%] p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Available Days
            </Text>
            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {balances.reduce((sum, balance) => sum + balance.available_days, 0)}
            </Text>
          </View>
        </View>

        {/* Leave Type Cards */}
        {balances.map((balance) => (
          <View
            key={balance.id}
            className={`mb-4 rounded-lg overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          >
            <View 
              className="p-4 border-l-4" 
              style={{ borderLeftColor: getLeaveTypeColor(balance.name) }}
            >
              <View className="flex-row justify-between items-center mb-2">
                <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {balance.name}
                </Text>
                <TouchableOpacity
                  onPress={(e) => showTooltip(
                    `${balance.requires_documentation ? 'Documentation required' : 'No documentation needed'}\n` +
                    `Default: ${balance.role_default_days} days/year` +
                    `${balance.role_carry_forward_days > 0 ? 
                      `\nCarry forward up to ${balance.role_carry_forward_days} days` : ''
                    }`,
                    e
                  )}
                >
                  <Ionicons 
                    name="information-circle" 
                    size={20} 
                    color={isDark ? '#9CA3AF' : '#6B7280'} 
                  />
                </TouchableOpacity>
              </View>

              {renderProgressBar(
                balance.used_days,
                balance.total_days + balance.carry_forward_days,
                balance.pending_days
              )}

              <View className="flex-row flex-wrap justify-between mt-4">
                <View className="w-1/2 mb-2">
                  <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Total Days
                  </Text>
                  <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {balance.total_days}
                  </Text>
                </View>
                <View className="w-1/2 mb-2">
                  <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Used Days
                  </Text>
                  <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {balance.used_days}
                  </Text>
                </View>
                <View className="w-1/2 mb-2">
                  <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Pending Days
                  </Text>
                  <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {balance.pending_days}
                  </Text>
                </View>
                <View className="w-1/2 mb-2">
                  <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Carry Forward
                  </Text>
                  <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {balance.carry_forward_days}
                  </Text>
                </View>
              </View>

              <View className="mt-2 pt-2 border-t border-gray-700">
                <View className="flex-row justify-between items-center">
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Available Days
                  </Text>
                  <Text 
                    className={`text-lg font-semibold ${
                      balance.available_days > 0 
                        ? isDark ? 'text-green-400' : 'text-green-600'
                        : isDark ? 'text-red-400' : 'text-red-600'
                    }`}
                  >
                    {balance.available_days}
                  </Text>
                </View>
                {balance.role_default_days > 0 && (
                  <Text className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Default allocation: {balance.role_default_days} days/year
                    {balance.role_carry_forward_days > 0 && 
                      ` (up to ${balance.role_carry_forward_days} days carry forward)`}
                  </Text>
                )}
              </View>

              {balance.is_paid ? (
                <View className="mt-2 flex-row items-center">
                  <Ionicons 
                    name="checkmark-circle" 
                    size={14} 
                    color={isDark ? '#10B981' : '#059669'} 
                  />
                  <Text className={`ml-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Paid Leave
                  </Text>
                </View>
              ) : (
                <View className="mt-2 flex-row items-center">
                  <Ionicons 
                    name="information-circle" 
                    size={14} 
                    color={isDark ? '#9CA3AF' : '#6B7280'} 
                  />
                  <Text className={`ml-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Unpaid Leave
                  </Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* Custom Tooltip */}
      <Modal
        isVisible={tooltipInfo.visible}
        onBackdropPress={() => setTooltipInfo(prev => ({ ...prev, visible: false }))}
        backdropOpacity={0}
        animationIn="fadeIn"
        animationOut="fadeOut"
        style={{
          margin: 0,
          position: 'absolute',
          left: tooltipInfo.x - 150, // Center the tooltip
          top: tooltipInfo.y
        }}
      >
        <View 
          className={`p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          style={{ width: 300, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}
        >
          <Text className={isDark ? 'text-white' : 'text-gray-900'}>
            {tooltipInfo.text}
          </Text>
        </View>
      </Modal>

      {/* Leave Request Form Modal */}
      <Modal
        isVisible={showRequestForm}
        onBackdropPress={() => setShowRequestForm(false)}
        onBackButtonPress={() => setShowRequestForm(false)}
        useNativeDriver
        style={{ margin: 0 }}
      >
        <View className={`flex-1 mt-20 rounded-t-3xl ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
          <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
            <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Request Leave
            </Text>
            <TouchableOpacity onPress={() => setShowRequestForm(false)}>
              <Ionicons 
                name="close" 
                size={24} 
                color={isDark ? '#9CA3AF' : '#6B7280'} 
              />
            </TouchableOpacity>
          </View>
          <LeaveRequestForm 
            onSuccess={() => {
              setShowRequestForm(false);
              fetchLeaveBalances();
            }} 
          />
        </View>
      </Modal>
    </ScrollView>
  );
} 