import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../context/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { format } from 'date-fns';

type LeaveType = 'casual' | 'sick' | 'annual' | 'other';

interface LeaveBalance {
  casual: number;
  sick: number;
  annual: number;
}

export default function EmployeeLeave() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';

  // Mock leave balance - replace with API data
  const leaveBalance: LeaveBalance = {
    casual: 10,
    sick: 7,
    annual: 14,
  };

  // Form state
  const [formData, setFormData] = useState({
    leaveType: '' as LeaveType,
    startDate: new Date(),
    endDate: new Date(),
    reason: '',
    contactNumber: '',
  });

  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateType, setDateType] = useState<'start' | 'end'>('start');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleDateSelect = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData(prev => ({
        ...prev,
        [dateType === 'start' ? 'startDate' : 'endDate']: selectedDate,
      }));
    }
  };

  const showDatePickerModal = (type: 'start' | 'end') => {
    setDateType(type);
    setShowDatePicker(true);
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.leaveType) {
      newErrors.leaveType = 'Please select leave type';
    }

    if (!formData.reason.trim()) {
      newErrors.reason = 'Please provide a reason';
    }

    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = 'Please provide contact number';
    }

    if (formData.endDate < formData.startDate) {
      newErrors.date = 'End date cannot be before start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      // Submit form logic here
      Alert.alert(
        'Success',
        'Leave request submitted successfully',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  };

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* Header */}
      <View className={`flex-row items-center justify-between p-4 ${isDark ? 'bg-gray-800' : 'bg-white'} border-b border-gray-200`}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons 
            name="arrow-back" 
            size={24} 
            color={isDark ? '#FFFFFF' : '#111827'} 
          />
        </TouchableOpacity>
        <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Request Leave
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Leave Balance Card */}
        <View className={`rounded-lg p-4 mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Leave Balance
          </Text>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-500'}`}>
                {leaveBalance.casual}
              </Text>
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Casual
              </Text>
            </View>
            <View className="items-center">
              <Text className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-500'}`}>
                {leaveBalance.sick}
              </Text>
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Sick
              </Text>
            </View>
            <View className="items-center">
              <Text className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-500'}`}>
                {leaveBalance.annual}
              </Text>
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Annual
              </Text>
            </View>
          </View>
        </View>

        {/* Leave Request Form */}
        <View className={`rounded-lg p-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          {/* Leave Type */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Leave Type *
            </Text>
            <View className={`border rounded-lg overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <Picker
                selectedValue={formData.leaveType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, leaveType: value as LeaveType }))}
                style={{ color: isDark ? '#FFFFFF' : '#111827' }}
              >
                <Picker.Item label="Select Leave Type" value="" />
                <Picker.Item label="Casual Leave" value="casual" />
                <Picker.Item label="Sick Leave" value="sick" />
                <Picker.Item label="Annual Leave" value="annual" />
                <Picker.Item label="Other" value="other" />
              </Picker>
            </View>
            {errors.leaveType && (
              <Text className="text-red-500 text-sm mt-1">{errors.leaveType}</Text>
            )}
          </View>

          {/* Date Selection */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Date Range *
            </Text>
            <View className="flex-row space-x-4">
              <TouchableOpacity
                onPress={() => showDatePickerModal('start')}
                className={`flex-1 p-3 rounded-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
              >
                <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                  {format(formData.startDate, 'MMM dd, yyyy')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => showDatePickerModal('end')}
                className={`flex-1 p-3 rounded-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
              >
                <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                  {format(formData.endDate, 'MMM dd, yyyy')}
                </Text>
              </TouchableOpacity>
            </View>
            {errors.date && (
              <Text className="text-red-500 text-sm mt-1">{errors.date}</Text>
            )}
          </View>

          {/* Reason */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Reason *
            </Text>
            <TextInput
              multiline
              numberOfLines={4}
              value={formData.reason}
              onChangeText={(text) => setFormData(prev => ({ ...prev, reason: text }))}
              className={`p-3 rounded-lg border ${
                isDark 
                  ? 'border-gray-700 bg-gray-700 text-white' 
                  : 'border-gray-200 bg-gray-50 text-gray-900'
              }`}
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              placeholder="Enter reason for leave"
            />
            {errors.reason && (
              <Text className="text-red-500 text-sm mt-1">{errors.reason}</Text>
            )}
          </View>

          {/* Contact Number */}
          <View className="mb-6">
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Contact Number During Leave *
            </Text>
            <TextInput
              value={formData.contactNumber}
              onChangeText={(text) => setFormData(prev => ({ ...prev, contactNumber: text }))}
              keyboardType="phone-pad"
              className={`p-3 rounded-lg border ${
                isDark 
                  ? 'border-gray-700 bg-gray-700 text-white' 
                  : 'border-gray-200 bg-gray-50 text-gray-900'
              }`}
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              placeholder="Enter contact number"
            />
            {errors.contactNumber && (
              <Text className="text-red-500 text-sm mt-1">{errors.contactNumber}</Text>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            className="bg-blue-500 rounded-lg py-4"
          >
            <Text className="text-white text-center font-semibold">
              Submit Request
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={dateType === 'start' ? formData.startDate : formData.endDate}
          mode="date"
          display="default"
          onChange={handleDateSelect}
          minimumDate={dateType === 'end' ? formData.startDate : new Date()}
        />
      )}
    </View>
  );
}
