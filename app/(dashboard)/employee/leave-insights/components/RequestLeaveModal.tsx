import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { format, differenceInDays, isWeekend } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

interface LeaveType {
  id: number;
  name: string;
  requires_documentation: boolean;
  max_days: number;
  max_consecutive_days: number;
  notice_period_days: number;
}

interface LeaveBalance {
  id: number;
  name: string;
  max_days: number;
  days_used: number;
}

interface RequestLeaveModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RequestLeaveModal({ visible, onClose, onSuccess }: RequestLeaveModalProps) {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === 'dark';

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState('');
  const [contactNumber, setContactNumber] = useState('+91');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (visible) {
      fetchData();
      resetForm();
      checkCameraPermission();
    }
  }, [visible]);

  const checkCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required for taking photos');
    }
  };

  const fetchData = async () => {
    try {
      const year = new Date().getFullYear();
      const [typesResponse, balanceResponse] = await Promise.all([
        axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/leave/types`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/leave/balance?year=${year}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      ]);
      
      if (typesResponse.data) {
        setLeaveTypes(typesResponse.data);
      }
      if (balanceResponse.data) {
        setBalances(balanceResponse.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load leave types and balances');
    }
  };

  const resetForm = () => {
    setSelectedType(null);
    setStartDate(new Date());
    setEndDate(new Date());
    setReason('');
    setContactNumber('+91');
    setDocuments([]);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!selectedType) {
      newErrors.leaveType = 'Please select a leave type';
    }

    if (!reason.trim()) {
      newErrors.reason = 'Please provide a reason for leave';
    }

    // Validate contact number (Indian format)
    const contactRegex = /^\+91[6-9]\d{9}$/;
    if (!contactRegex.test(contactNumber)) {
      newErrors.contactNumber = 'Please enter a valid Indian mobile number (+91XXXXXXXXXX)';
    }

    // Get selected leave type
    const selectedLeaveType = leaveTypes.find(type => type.id === selectedType);
    if (selectedLeaveType) {
      // Calculate working days
      const totalDays = calculateWorkingDays(startDate, endDate);

      // Check max consecutive days
      if (totalDays > selectedLeaveType.max_consecutive_days) {
        newErrors.dates = `Maximum ${selectedLeaveType.max_consecutive_days} consecutive days allowed`;
      }

      // Check notice period
      const noticeGiven = differenceInDays(startDate, new Date());
      if (noticeGiven < selectedLeaveType.notice_period_days) {
        newErrors.dates = `Requires ${selectedLeaveType.notice_period_days} days notice period`;
      }

      // Check if documents are required
      if (selectedLeaveType.requires_documentation && documents.length === 0) {
        newErrors.documents = 'Supporting documents are required for this leave type';
      }

      // Check leave balance
      const balance = balances.find(b => b.id === selectedType);
      if (balance && totalDays > (balance.max_days - balance.days_used)) {
        newErrors.dates = 'Insufficient leave balance';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateWorkingDays = (start: Date, end: Date) => {
    let days = 0;
    const current = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    while (current <= endDate) {
      if (!isWeekend(current)) {
        days++;
      }
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const handleDocumentSelection = () => {
    Alert.alert(
      'Upload Document',
      'Choose upload method',
      [
        {
          text: 'Take Photo',
          onPress: handleCameraUpload,
        },
        {
          text: 'Choose File',
          onPress: handleFileUpload,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleCameraUpload = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const fileSize = asset.fileSize || 0;
        
        if (fileSize > 5 * 1024 * 1024) {
          Alert.alert('Error', 'File size should not exceed 5MB');
          return;
        }

        setDocuments(prev => [...prev, {
          name: `photo_${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
          uri: asset.uri,
          size: fileSize,
        }]);
        setErrors(prev => ({ ...prev, documents: '' }));
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const fileSize = asset.size || 0;
        
        if (fileSize > 5 * 1024 * 1024) {
          Alert.alert('Error', 'File size should not exceed 5MB');
          return;
        }

        setDocuments(prev => [...prev, {
          name: asset.name,
          mimeType: asset.mimeType,
          uri: asset.uri,
          size: fileSize,
        }]);
        setErrors(prev => ({ ...prev, documents: '' }));
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to upload document');
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const formData = {
        leave_type_id: selectedType,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        reason,
        contact_number: contactNumber,
        documents: documents.map(doc => ({
          file_name: doc.name,
          file_type: doc.mimeType,
          file_data: doc.uri,
        })),
      };

      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave/request`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Leave request submitted successfully');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error submitting leave request:', error);
      Alert.alert('Error', 'Failed to submit leave request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className={`w-11/12 max-h-[80vh] rounded-lg ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
          <ScrollView className="p-4">
            <View className="flex-row justify-between items-center mb-4">
              <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Request Leave
            </Text>
              <TouchableOpacity 
                onPress={onClose}
                className={`p-2 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
              >
                <Ionicons name="close" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
              </TouchableOpacity>
            </View>

            {/* Leave Type Picker */}
            <View className="mb-4">
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Leave Type <Text className="text-red-500">*</Text>
              </Text>
              <View className={`border rounded-lg ${isDark ? 'border-gray-700' : 'border-gray-300'} ${errors.leaveType ? 'border-red-500' : ''}`}>
                <Picker
                  selectedValue={selectedType}
                  onValueChange={(value) => {
                    setSelectedType(value);
                    setErrors(prev => ({ ...prev, leaveType: '' }));
                  }}
                  style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                >
                  <Picker.Item label="Select Leave Type" value={null} />
                  {leaveTypes.map(type => (
                    <Picker.Item key={type.id} label={type.name} value={type.id} />
                  ))}
                </Picker>
              </View>
              {errors.leaveType && (
                <Text className="text-red-500 text-sm mt-1">{errors.leaveType}</Text>
              )}
            </View>

            {/* Date Selection */}
            <View className="flex-row space-x-4 mb-4">
              {/* Start Date */}
              <View className="flex-1">
                <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Start Date <Text className="text-red-500">*</Text>
                </Text>
                <TouchableOpacity
                  onPress={() => setShowStartDate(true)}
                  className={`p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'} ${errors.dates ? 'border border-red-500' : ''}`}
                >
                  <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                    {format(startDate, 'MMM dd, yyyy')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* End Date */}
              <View className="flex-1">
                <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  End Date <Text className="text-red-500">*</Text>
                </Text>
                <TouchableOpacity
                  onPress={() => setShowEndDate(true)}
                  className={`p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'} ${errors.dates ? 'border border-red-500' : ''}`}
                >
                  <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                    {format(endDate, 'MMM dd, yyyy')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {errors.dates && (
              <Text className="text-red-500 text-sm mb-4">{errors.dates}</Text>
            )}

            {/* Date Pickers */}
            {(showStartDate || showEndDate) && Platform.OS !== 'web' && (
              <DateTimePicker
                value={showStartDate ? startDate : endDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  if (showStartDate) {
                    setShowStartDate(Platform.OS === 'ios');
                    if (selectedDate) {
                      setStartDate(selectedDate);
                      setErrors(prev => ({ ...prev, dates: '' }));
                    }
                  } else {
                    setShowEndDate(Platform.OS === 'ios');
                    if (selectedDate) {
                      setEndDate(selectedDate);
                      setErrors(prev => ({ ...prev, dates: '' }));
                    }
                  }
                }}
              />
            )}

            {/* Reason Input */}
            <View className="mb-4">
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Reason <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={reason}
                onChangeText={(text) => {
                  setReason(text);
                  setErrors(prev => ({ ...prev, reason: '' }));
                }}
                multiline
                numberOfLines={3}
                className={`p-3 rounded-lg ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} ${
                  errors.reason ? 'border border-red-500' : ''
                }`}
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                placeholder="Enter reason for leave"
              />
              {errors.reason && (
                <Text className="text-red-500 text-sm mt-1">{errors.reason}</Text>
              )}
            </View>

            {/* Contact Number Input */}
            <View className="mb-4">
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Contact Number <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={contactNumber}
                onChangeText={(text) => {
                  setContactNumber(text);
                  setErrors(prev => ({ ...prev, contactNumber: '' }));
                }}
                className={`p-3 rounded-lg ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} ${
                  errors.contactNumber ? 'border border-red-500' : ''
                }`}
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                placeholder="+91XXXXXXXXXX"
                keyboardType="phone-pad"
              />
              {errors.contactNumber && (
                <Text className="text-red-500 text-sm mt-1">{errors.contactNumber}</Text>
              )}
            </View>

            {/* Document Upload */}
            <View className="mb-4">
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Supporting Documents
                {selectedType && leaveTypes.find(t => t.id === selectedType)?.requires_documentation && (
                  <Text className="text-red-500"> *</Text>
                )}
              </Text>
              
              <TouchableOpacity
                onPress={handleDocumentSelection}
                className={`p-3 rounded-lg border-2 border-dashed ${
                  isDark ? 'border-gray-700' : 'border-gray-300'
                } ${errors.documents ? 'border-red-500' : ''}`}
              >
                <View className="items-center">
                  <Ionicons 
                    name="cloud-upload-outline" 
                    size={24} 
                    color={isDark ? '#9CA3AF' : '#6B7280'} 
                  />
                  <Text className={`mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    Take Photo or Upload Document
                  </Text>
                  <Text className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Supported: Images, PDF (Max 5MB)
                  </Text>
                </View>
              </TouchableOpacity>

              {documents.length > 0 && (
                <View className="mt-2 space-y-2">
                  {documents.map((doc, index) => (
                    <View key={index} className="flex-row items-center justify-between">
                      <Text className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                        <Ionicons name="document-outline" size={16} /> {doc.name}
                      </Text>
                      <TouchableOpacity onPress={() => removeDocument(index)}>
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {errors.documents && (
                <Text className="text-red-500 text-sm mt-1">{errors.documents}</Text>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              className={`bg-blue-500 p-4 rounded-lg mt-4 ${loading ? 'opacity-70' : ''}`}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center font-semibold">
                  Submit Request
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
} 