import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import axios from 'axios';
import { getHeaderPaddingTop } from '@/utils/statusBarHeight';

interface LeaveBalance {
  casual_leave: number;
  sick_leave: number;
  annual_leave: number;
}

export default function LeaveBalanceSettings() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [balance, setBalance] = useState({
    casual: '',
    sick: '',
    annual: ''
  });

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/admin/leave-balance`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setBalance({
        casual: response.data.casual_leave.toString(),
        sick: response.data.sick_leave.toString(),
        annual: response.data.annual_leave.toString()
      });
    } catch (error) {
      console.error('Error fetching leave balance:', error);
      Alert.alert('Error', 'Failed to fetch leave balance');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Validate input
      const casualNum = parseInt(balance.casual);
      const sickNum = parseInt(balance.sick);
      const annualNum = parseInt(balance.annual);

      if (isNaN(casualNum) || isNaN(sickNum) || isNaN(annualNum)) {
        Alert.alert('Error', 'Please enter valid numbers for all fields');
        return;
      }

      if (casualNum < 0 || sickNum < 0 || annualNum < 0) {
        Alert.alert('Error', 'Leave days cannot be negative');
        return;
      }

      setSaving(true);
      const response = await axios.put(
        `${process.env.EXPO_PUBLIC_API_URL}/api/admin/leave-balance`,
        {
          casual: casualNum,
          sick: sickNum,
          annual: annualNum
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log('Update response:', response.data);
      Alert.alert('Success', 'Leave balance updated successfully');
    } catch (error: any) {
      console.error('Error updating leave balance:', error);
      Alert.alert(
        'Error',
        error.response?.data?.details || error.response?.data?.error || 'Failed to update leave balance'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#F3F4F6' }}>
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent={true}
      />

      {/* Header */}
      <View 
        className={`${isDark ? 'bg-gray-800' : 'bg-white'}`}
        style={[styles.header, { paddingTop: getHeaderPaddingTop() }]}
      >
        <View className="flex-row items-center justify-between px-4 pt-3 pb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
            style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}
          >
            <Ionicons 
              name="arrow-back" 
              size={24} 
              color={isDark ? '#FFFFFF' : '#111827'} 
            />
          </TouchableOpacity>
          <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
            <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Leave Balance Settings
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <View className="p-4">
        {loading ? (
          <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
        ) : (
          <View className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={styles.card}>
            <Text className={`text-lg font-semibold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Configure Leave Balance
            </Text>

            {/* Casual Leave */}
            <View className="mb-4">
              <Text className={`mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Casual Leave Days
              </Text>
              <TextInput
                value={balance.casual}
                onChangeText={(text) => setBalance(prev => ({ ...prev, casual: text }))}
                keyboardType="numeric"
                className={`p-4 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'}`}
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              />
            </View>

            {/* Sick Leave */}
            <View className="mb-4">
              <Text className={`mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Sick Leave Days
              </Text>
              <TextInput
                value={balance.sick}
                onChangeText={(text) => setBalance(prev => ({ ...prev, sick: text }))}
                keyboardType="numeric"
                className={`p-4 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'}`}
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              />
            </View>

            {/* Annual Leave */}
            <View className="mb-6">
              <Text className={`mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Annual Leave Days
              </Text>
              <TextInput
                value={balance.annual}
                onChangeText={(text) => setBalance(prev => ({ ...prev, annual: text }))}
                keyboardType="numeric"
                className={`p-4 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'}`}
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              />
            </View>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className={`p-4 rounded-lg bg-blue-500 ${saving ? 'opacity-50' : ''}`}
            >
              <Text className="text-white text-center font-semibold">
                {saving ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  }
}); 