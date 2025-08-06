import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useColorScheme } from '../../../../../app/hooks/useColorScheme';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { format, differenceInBusinessDays, isWeekend, addDays, isSameDay, parseISO } from 'date-fns';

interface LeaveType {
  id: number;
  name: string;
  description: string;
  requires_documentation: boolean;
  max_days: number;
  is_paid: boolean;
  default_days: number;
  carry_forward_days: number;
  min_service_days: number;
  notice_period_days: number;
  max_consecutive_days: number;
  gender_specific: string | null;
}

interface Document {
  file_name: string;
  file_type: string;
  file_data: string;
  upload_method: 'camera' | 'file';
}

interface Holiday {
  date: string;
  name: string;
}

export default function LeaveRequestForm({ onSuccess }: { onSuccess: () => void }) {
  const isDark = useColorScheme() === 'dark';
  const [loading, setLoading] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveType | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<{
    total_days: number;
    used_days: number;
    pending_days: number;
    carry_forward_days: number;
    available_days: number;
  } | null>(null);

  useEffect(() => {
    fetchLeaveTypes();
    fetchHolidays();
  }, []);

  useEffect(() => {
    if (selectedLeaveType) {
      fetchLeaveBalance(selectedLeaveType.id);
    }
  }, [selectedLeaveType]);

  const fetchLeaveTypes = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/leave-types`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.data && Array.isArray(response.data)) {
        // Transform the data to match the expected interface
        const transformedLeaveTypes = response.data.map((type: any) => ({
          id: type.leave_type_id,
          name: type.leave_type_name,
          description: type.description || '',
          requires_documentation: type.requires_documentation || false,
          max_days: type.max_days || 0,
          is_paid: type.is_paid !== undefined ? type.is_paid : true,
          default_days: type.total_days || 0,
          carry_forward_days: type.carry_forward_days || 0,
          min_service_days: 0, // Default value
          notice_period_days: 0, // Default value
          max_consecutive_days: type.max_days || 30, // Use max_days as default
          gender_specific: type.gender_specific || null
        }));
        setLeaveTypes(transformedLeaveTypes);
      } else {
        setLeaveTypes([]);
      }
    } catch (error: any) {
      console.error('Error fetching leave types:', error);
      setError(error.response?.data?.error || 'Failed to fetch leave types');
    }
  };

  const fetchHolidays = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      // Since holidays endpoint doesn't exist, we'll set an empty array
      // You can implement holidays functionality later if needed
      setHolidays([]);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      setHolidays([]);
    }
  };

  const fetchLeaveBalance = async (leaveTypeId: number) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave/balance?year=${new Date().getFullYear()}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.data && Array.isArray(response.data)) {
        const balance = response.data.find((b: any) => b.leave_type_id === leaveTypeId);
        if (balance) {
          setLeaveBalance({
            total_days: balance.total_days || 0,
            used_days: balance.used_days || 0,
            pending_days: balance.pending_days || 0,
            carry_forward_days: balance.carry_forward_days || 0,
            available_days: (balance.total_days || 0) + (balance.carry_forward_days || 0) - (balance.used_days || 0) - (balance.pending_days || 0),
          });
        } else {
          // If no balance found, set default values
          setLeaveBalance({
            total_days: 0,
            used_days: 0,
            pending_days: 0,
            carry_forward_days: 0,
            available_days: 0,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching leave balance:', error);
      // Set default values on error
      setLeaveBalance({
        total_days: 0,
        used_days: 0,
        pending_days: 0,
        carry_forward_days: 0,
        available_days: 0,
      });
    }
  };

  const isHoliday = (date: Date): boolean => {
    return holidays.some(holiday => isSameDay(parseISO(holiday.date), date));
  };

  const calculateWorkingDays = (start: Date, end: Date): number => {
    let days = 0;
    let current = new Date(start);
    
    while (current <= end) {
      if (!isWeekend(current) && !isHoliday(current)) {
        days++;
      }
      current = addDays(current, 1);
    }
    
    return days;
  };

  const validateNoticePeriod = (): string | null => {
    if (!selectedLeaveType) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const noticeDays = differenceInBusinessDays(startDate, today);

    if (noticeDays < selectedLeaveType.notice_period_days) {
      const earliestPossibleDate = addDays(today, selectedLeaveType.notice_period_days);
      return `Notice period requirement not met. Earliest possible start date is ${format(earliestPossibleDate, 'dd MMM yyyy')}`;
    }

    return null;
  };

  const validateLeaveBalance = (daysRequested: number): string | null => {
    if (!leaveBalance) return null;

    const availableDays = leaveBalance.total_days + leaveBalance.carry_forward_days - 
                         leaveBalance.used_days - leaveBalance.pending_days;

    if (availableDays < daysRequested) {
      return `Insufficient leave balance. Available: ${availableDays} days, Requested: ${daysRequested} days`;
    }

    return null;
  };

  const handleDateChange = (event: any, selectedDate: Date | undefined, isStart: boolean) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
      setShowEndDatePicker(false);
    }

    if (selectedDate) {
      if (isStart) {
        setStartDate(selectedDate);
        if (selectedDate > endDate) {
          setEndDate(selectedDate);
        }
      } else {
        setEndDate(selectedDate);
      }
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
      });

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result?.toString().split(',')[1];
          if (base64data) {
            setDocuments([
              ...documents,
              {
                file_name: asset.name,
                file_type: asset.mimeType || 'application/octet-stream',
                file_data: base64data,
                upload_method: 'file',
              },
            ]);
          }
        };
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          setDocuments([
            ...documents,
            {
              file_name: `photo_${Date.now()}.jpg`,
              file_type: 'image/jpeg',
              file_data: asset.base64,
              upload_method: 'camera',
            },
          ]);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const validateRequest = () => {
    if (!selectedLeaveType) {
      return 'Please select a leave type';
    }
    if (!reason.trim()) {
      return 'Please provide a reason for leave';
    }
    if (!contactNumber.trim()) {
      return 'Please provide a contact number';
    }
    if (selectedLeaveType.requires_documentation && documents.length === 0) {
      return 'Please upload required documents';
    }

    const daysRequested = calculateWorkingDays(startDate, endDate);
    
    if (daysRequested === 0) {
      return 'Selected dates include only weekends or holidays';
    }

    if (daysRequested > selectedLeaveType.max_consecutive_days) {
      return `Maximum consecutive days allowed is ${selectedLeaveType.max_consecutive_days}`;
    }

    const noticePeriodError = validateNoticePeriod();
    if (noticePeriodError) return noticePeriodError;

    const balanceError = validateLeaveBalance(daysRequested);
    if (balanceError) return balanceError;

    return null;
  };

  const handleSubmit = async () => {
    try {
      const validationError = validateRequest();
      if (validationError) {
        setError(validationError);
        return;
      }

      setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      const daysRequested = calculateWorkingDays(startDate, endDate);

      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave/request`,
        {
          leave_type_id: selectedLeaveType?.id,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          days_requested: daysRequested,
          reason,
          contact_number: contactNumber,
          documents,
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      Alert.alert(
        'Success',
        'Leave request submitted successfully',
        [{ text: 'OK', onPress: onSuccess }]
      );
    } catch (error: any) {
      console.error('Error submitting leave request:', error);
      const errorMessage = error.response?.data?.details?.message || 
                         error.response?.data?.error || 
                         'Failed to submit leave request';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderDatePreview = () => {
    if (!startDate || !endDate) return null;

    const weekends = [];
    const holidayDates = [];
    let current = new Date(startDate);
    
    while (current <= endDate) {
      if (isWeekend(current)) {
        weekends.push(format(current, 'dd MMM'));
      } else if (isHoliday(current)) {
        const holiday = holidays.find(h => isSameDay(parseISO(h.date), current));
        if (holiday) {
          holidayDates.push(`${format(current, 'dd MMM')} (${holiday.name})`);
        }
      }
      current = addDays(current, 1);
    }

    return (
      <View className="mt-2">
        {weekends.length > 0 && (
          <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Weekends: {weekends.join(', ')}
          </Text>
        )}
        {holidayDates.length > 0 && (
          <Text className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Holidays: {holidayDates.join(', ')}
          </Text>
        )}
        <Text className={`text-sm mt-1 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Working days: {calculateWorkingDays(startDate, endDate)}
        </Text>
      </View>
    );
  };

  return (
    <ScrollView className="flex-1">
      <View className="p-4">
        {/* Leave Type Selection */}
        <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Leave Type *
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          className="mb-4"
        >
          {leaveTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              onPress={() => setSelectedLeaveType(type)}
              className={`mr-2 px-4 py-2 rounded-full ${
                selectedLeaveType?.id === type.id
                  ? 'bg-blue-500'
                  : isDark ? 'bg-gray-700' : 'bg-gray-200'
              }`}
            >
              <Text
                className={
                  selectedLeaveType?.id === type.id
                    ? 'text-white'
                    : isDark ? 'text-gray-300' : 'text-gray-700'
                }
              >
                {type.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedLeaveType && (
          <View className={`mb-4 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {selectedLeaveType.description}
            </Text>
            {selectedLeaveType.requires_documentation && (
              <View className="flex-row items-center mt-2">
                <Ionicons 
                  name="information-circle" 
                  size={16} 
                  color={isDark ? '#9CA3AF' : '#6B7280'} 
                />
                <Text className={`ml-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Documentation required
                </Text>
              </View>
            )}
            <View className="flex-row items-center mt-1">
              <Ionicons 
                name="time" 
                size={16} 
                color={isDark ? '#9CA3AF' : '#6B7280'} 
              />
              <Text className={`ml-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {selectedLeaveType.notice_period_days} days notice required
              </Text>
            </View>
            <View className="flex-row items-center mt-1">
              <Ionicons 
                name="calendar" 
                size={16} 
                color={isDark ? '#9CA3AF' : '#6B7280'} 
              />
              <Text className={`ml-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Max {selectedLeaveType.max_consecutive_days} consecutive days
              </Text>
            </View>

            {/* Leave Balance Preview */}
            {leaveBalance && (
              <View className="mt-3 pt-3 border-t border-gray-700">
                <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Current Balance
                </Text>
                <View className="flex-row justify-between mt-2">
                  <View>
                    <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Total
                    </Text>
                    <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {leaveBalance.total_days}
                    </Text>
                  </View>
                  <View>
                    <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Used
                    </Text>
                    <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {leaveBalance.used_days}
                    </Text>
                  </View>
                  <View>
                    <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Pending
                    </Text>
                    <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {leaveBalance.pending_days}
                    </Text>
                  </View>
                  <View>
                    <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Available
                    </Text>
                    <Text className={`text-sm font-medium ${
                      leaveBalance.available_days > 0
                        ? isDark ? 'text-green-400' : 'text-green-600'
                        : isDark ? 'text-red-400' : 'text-red-600'
                    }`}>
                      {leaveBalance.available_days}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Date Selection */}
        <View className="mb-4">
          <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Start Date *
          </Text>
          <TouchableOpacity
            onPress={() => setShowStartDatePicker(true)}
            className={`p-3 rounded-lg border ${
              isDark 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-300'
            }`}
          >
            <Text className={isDark ? 'text-white' : 'text-gray-900'}>
              {format(startDate, 'dd MMM yyyy')}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mb-4">
          <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            End Date *
          </Text>
          <TouchableOpacity
            onPress={() => setShowEndDatePicker(true)}
            className={`p-3 rounded-lg border ${
              isDark 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-300'
            }`}
          >
                      <Text className={isDark ? 'text-white' : 'text-gray-900'}>
            {format(endDate, 'dd MMM yyyy')}
          </Text>
        </TouchableOpacity>
        {renderDatePreview()}
      </View>

      {/* Date Pickers */}
        {(showStartDatePicker || showEndDatePicker) && (
          <DateTimePicker
            value={showStartDatePicker ? startDate : endDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => 
              handleDateChange(event, date, showStartDatePicker)
            }
            minimumDate={new Date()}
          />
        )}

        {/* Reason */}
        <View className="mb-4">
          <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Reason *
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Enter reason for leave"
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            multiline
            numberOfLines={3}
            className={`p-3 rounded-lg border ${
              isDark 
                ? 'bg-gray-800 border-gray-700 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
            style={{ textAlignVertical: 'top' }}
          />
        </View>

        {/* Contact Number */}
        <View className="mb-4">
          <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Contact Number *
          </Text>
          <TextInput
            value={contactNumber}
            onChangeText={setContactNumber}
            placeholder="Enter contact number"
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            keyboardType="phone-pad"
            className={`p-3 rounded-lg border ${
              isDark 
                ? 'bg-gray-800 border-gray-700 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
        </View>

        {/* Document Upload */}
        {selectedLeaveType?.requires_documentation && (
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Supporting Documents *
            </Text>
            <View className="flex-row mb-2">
              <TouchableOpacity
                onPress={pickDocument}
                className={`flex-1 mr-2 p-3 rounded-lg ${
                  isDark ? 'bg-gray-800' : 'bg-gray-100'
                }`}
              >
                <Text className={`text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Upload File
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={takePhoto}
                className={`flex-1 p-3 rounded-lg ${
                  isDark ? 'bg-gray-800' : 'bg-gray-100'
                }`}
              >
                <Text className={`text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Take Photo
                </Text>
              </TouchableOpacity>
            </View>

            {documents.map((doc, index) => (
              <View
                key={index}
                className={`flex-row items-center justify-between p-3 mb-2 rounded-lg ${
                  isDark ? 'bg-gray-800' : 'bg-gray-100'
                }`}
              >
                <View className="flex-row items-center flex-1">
                  <Ionicons
                    name={doc.upload_method === 'camera' ? 'camera' : 'document'}
                    size={20}
                    color={isDark ? '#9CA3AF' : '#6B7280'}
                  />
                  <Text
                    className={`ml-2 flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}
                    numberOfLines={1}
                  >
                    {doc.file_name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeDocument(index)}
                  className="ml-2"
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={isDark ? '#EF4444' : '#DC2626'}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Error Message */}
        {error && (
          <View className="mb-4 p-3 rounded-lg bg-red-100">
            <Text className="text-red-800">{error}</Text>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          className={`p-4 rounded-lg ${
            loading 
              ? isDark ? 'bg-gray-700' : 'bg-gray-300'
              : 'bg-blue-500'
          }`}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-medium">
              Submit Request
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
} 