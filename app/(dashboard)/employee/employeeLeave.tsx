import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../context/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { format } from 'date-fns';
import Modal from 'react-native-modal';
import axios from 'axios';
import AuthContext from '../../context/AuthContext';

type LeaveType = 'casual' | 'sick' | 'annual' | 'other';

interface LeaveBalance {
  casual: number;
  sick: number;
  annual: number;
}

export default function EmployeeLeave() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance>({
    casual: 0,
    sick: 0,
    annual: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactNumber, setContactNumber] = useState('');

  // Fetch leave balance
  useEffect(() => {
    fetchLeaveBalance();
  }, []);

  const fetchLeaveBalance = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave/balance`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      // Update the mapping to match backend field names
      setLeaveBalance({
        casual: response.data.casual_leave,
        sick: response.data.sick_leave,
        annual: response.data.annual_leave
      });
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const validatePhoneNumber = (number: string) => {
    // Remove any non-digit characters except the plus sign
    const cleanNumber = number.replace(/[^\d+]/g, '');
    // Check if it matches the format: +91 followed by 10 digits
    return /^\+91\d{10}$/.test(cleanNumber);
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.leaveType) {
      newErrors.leaveType = 'Please select leave type';
    }

    if (!formData.reason.trim()) {
      newErrors.reason = 'Please provide a reason';
    }

    if (!formData.contactNumber) {
      newErrors.contactNumber = 'Please provide contact number';
    } else if (!validatePhoneNumber(formData.contactNumber)) {
      newErrors.contactNumber = 'Please enter a valid 10-digit number';
    }

    if (formData.endDate < formData.startDate) {
      newErrors.date = 'End date cannot be before start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validateForm()) {
      try {
        setIsSubmitting(true);
        await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL}/api/leave/request`,
          formData,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        setShowSuccessModal(true);
      } catch (error) {
        Alert.alert('Error', 'Failed to submit leave request');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* Header - Updated to match profile page exactly */}
      <View 
        className={`${isDark ? 'bg-gray-800' : 'bg-white'}`}
        style={styles.header}
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
              Request Leave
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Leave Balance Card */}
        <View className={`rounded-lg p-4 mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Leave Balance
          </Text>
          {isLoading ? (
            <ActivityIndicator color={isDark ? '#60A5FA' : '#3B82F6'} />
          ) : (
            <View className="flex-row justify-between">
              {[
                { type: 'Casual', balance: leaveBalance.casual },
                { type: 'Sick', balance: leaveBalance.sick },
                { type: 'Annual', balance: leaveBalance.annual }
              ].map((item) => (
                <View key={item.type} className="items-center">
                  <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {item.balance}
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {item.type}
                  </Text>
                </View>
              ))}
            </View>
          )}
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
              Leave Period *
            </Text>
            <View className="flex-row space-x-4 gap-3">
              {/* Start Date */}
              <TouchableOpacity
                onPress={() => showDatePickerModal('start')}
                className={`flex-1 p-3 rounded-lg border ${
                  isDark 
                    ? 'border-gray-700 bg-gray-700' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                  {format(formData.startDate, 'dd/MM/yyyy')}
                </Text>
              </TouchableOpacity>

              {/* End Date */}
              <TouchableOpacity
                onPress={() => showDatePickerModal('end')}
                className={`flex-1 p-3 rounded-lg border ${
                  isDark 
                    ? 'border-gray-700 bg-gray-700' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                  {format(formData.endDate, 'dd/MM/yyyy')}
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
              Reason for Leave *
            </Text>
            <TextInput
              value={formData.reason}
              onChangeText={(text) => setFormData(prev => ({ ...prev, reason: text }))}
              multiline
              numberOfLines={4}
              className={`p-3 rounded-lg border ${
                isDark 
                  ? 'border-gray-700 bg-gray-700 text-white' 
                  : 'border-gray-200 bg-gray-50 text-gray-900'
              }`}
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              placeholder="Enter reason for leave"
              textAlignVertical="top"
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
            <View className={`flex-row items-center p-3 rounded-lg border ${
              isDark 
                ? 'border-gray-700 bg-gray-700' 
                : 'border-gray-200 bg-gray-50'
            }`}>
              <Text className={`${isDark ? 'text-white' : 'text-gray-900'} mr-2`}>
                +91
              </Text>
              <TextInput
                value={contactNumber}
                onChangeText={(text) => {
                  // Remove any non-digit characters
                  const cleaned = text.replace(/\D/g, '');
                  // Limit to 10 digits
                  const truncated = cleaned.slice(0, 10);
                  setContactNumber(truncated);
                  // Update form data with complete number including prefix
                  setFormData(prev => ({ 
                    ...prev, 
                    contactNumber: truncated ? `+91${truncated}` : '' 
                  }));
                }}
                keyboardType="phone-pad"
                className={`flex-1 ${
                  isDark 
                    ? 'text-white' 
                    : 'text-gray-900'
                }`}
                placeholder="Enter 10 digit number"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                maxLength={10}
              />
            </View>
            {errors.contactNumber && (
              <Text className="text-red-500 text-sm mt-1">{errors.contactNumber}</Text>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            className={`bg-blue-500 rounded-lg py-4 ${isSubmitting ? 'opacity-70' : ''}`}
          >
            {isSubmitting ? (
              <View className="flex-row items-center justify-center">
                <ActivityIndicator color="white" size="small" style={{ marginRight: 8 }} />
                <Text className="text-white font-semibold">
                  Submitting...
                </Text>
              </View>
            ) : (
              <Text className="text-white text-center font-semibold">
                Submit Request
              </Text>
            )}
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

      {/* Success Modal */}
      <Modal
        isVisible={showSuccessModal}
        backdropOpacity={0.5}
        onBackdropPress={() => setShowSuccessModal(false)}
        style={{ margin: 0 }}
      >
        <View className={`m-4 p-6 rounded-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <View className="items-center">
            <View className="w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4">
              <Ionicons name="checkmark-circle" size={40} color="#10B981" />
            </View>
            <Text className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Leave Request Submitted
            </Text>
            <Text className={`text-center mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Your leave request has been submitted successfully. You will be notified once it's reviewed.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowSuccessModal(false);
                router.back();
              }}
              className="bg-green-500 py-3 px-6 rounded-lg w-full"
            >
              <Text className="text-white text-center font-semibold">
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  }
});
