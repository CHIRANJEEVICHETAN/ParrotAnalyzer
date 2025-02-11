import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import axios from 'axios';
import { format } from 'date-fns';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

interface LeaveType {
  id: number;
  name: string;
  description: string;
  requires_documentation: boolean;
  max_days: number;
  is_paid: boolean;
  is_active: boolean;
}

interface LeaveRequest {
  id: number;
  leave_type_id: number;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  contact_number: string;
  requires_documentation: boolean;
  documents: Document[];
  created_at: string;
}

interface Document {
  id?: number;
  file_name: string;
  file_type: string;
  file_data: string;
  upload_method: 'camera' | 'file';
}

interface ErrorModalState {
  visible: boolean;
  title: string;
  message: string;
  type: 'error' | 'success' | 'warning';
}

export default function LeaveRequests() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === 'dark';

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: new Date(),
    end_date: new Date(),
    reason: '',
    contact_number: '',
  });

  const [errorModal, setErrorModal] = useState<ErrorModalState>({
    visible: false,
    title: '',
    message: '',
    type: 'error',
  });

  useEffect(() => {
    fetchLeaveTypes();
    fetchRequests();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/leave-types`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setLeaveTypes(response.data.filter((type: LeaveType) => type.is_active));
    } catch (error) {
      console.error('Error fetching leave types:', error);
      showError('Failed to fetch leave types');
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/my-requests`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
      showError('Failed to fetch leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = async (method: 'camera' | 'file') => {
    try {
      let result;
      
      if (method === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Error', 'Camera permission is required');
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          base64: true,
        });
      } else {
        result = await DocumentPicker.getDocumentAsync({
          type: ['image/*', 'application/pdf'],
          copyToCacheDirectory: true,
        });
      }

      if (!result.canceled) {
        let newDocument: Document;
        
        if (method === 'camera') {
          const imageAsset = result.assets[0] as ImagePicker.ImagePickerAsset;
          if (!imageAsset.base64) {
            showError('Failed to get image data');
            return;
          }
          
          newDocument = {
            file_name: `camera_${Date.now()}.jpg`,
            file_type: 'image/jpeg',
            file_data: imageAsset.base64,
            upload_method: 'camera'
          };
        } else {
          const docAsset = result as DocumentPicker.DocumentPickerResult;
          if (!docAsset.assets) return;
          
          const asset = docAsset.assets[0];
          const base64Data = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64
          });
          
          newDocument = {
            file_name: asset.name,
            file_type: asset.mimeType || 'application/octet-stream',
            file_data: base64Data,
            upload_method: 'file'
          };
        }

        setDocuments(prev => [...prev, newDocument]);
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      showError('Failed to upload document');
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      if (!formData.leave_type_id) {
        setErrorModal({
          visible: true,
          title: 'Warning',
          message: 'Please select a leave type',
          type: 'warning'
        });
        return;
      }

      if (!formData.reason.trim()) {
        setErrorModal({
          visible: true,
          title: 'Warning',
          message: 'Please enter a reason for leave',
          type: 'warning'
        });
        return;
      }

      // Contact number validation
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(formData.contact_number)) {
        setErrorModal({
          visible: true,
          title: 'Warning',
          message: 'Please enter a valid 10-digit mobile number starting with 6-9',
          type: 'warning'
        });
        return;
      }

      // Date validation
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (startDate < today) {
        setErrorModal({
          visible: true,
          title: 'Warning',
          message: 'Start date cannot be in the past',
          type: 'warning'
        });
        return;
      }

      if (endDate < startDate) {
        setErrorModal({
          visible: true,
          title: 'Warning',
          message: 'End date cannot be before start date',
          type: 'warning'
        });
        return;
      }

      const selectedLeaveType = leaveTypes.find(
        type => type.id === parseInt(formData.leave_type_id)
      );

      if (selectedLeaveType?.requires_documentation && documents.length === 0) {
        setErrorModal({
          visible: true,
          title: 'Warning',
          message: 'Please upload required documentation',
          type: 'warning'
        });
        return;
      }

      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/request`,
        {
          ...formData,
          leave_type_id: parseInt(formData.leave_type_id),
          start_date: format(formData.start_date, 'yyyy-MM-dd'),
          end_date: format(formData.end_date, 'yyyy-MM-dd'),
          documents
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data) {
        setErrorModal({
          visible: true,
          title: 'Success',
          message: 'Leave request submitted successfully',
          type: 'success'
        });
        resetForm();
        setShowRequestModal(false);
        fetchRequests();
      }
    } catch (error: any) {
      console.error('Error submitting leave request:', error);
      
      // Handle specific error messages
      const errorMessage = error.response?.data?.error || error.message;
      let userFriendlyMessage = 'Failed to submit request. Please try again.';
      let errorType: 'error' | 'warning' = 'error';
      let errorTitle = 'Request Failed';

      if (errorMessage.includes('Insufficient leave balance')) {
        errorTitle = 'Insufficient Leave Balance';
        userFriendlyMessage = `You don't have enough leave balance for this request. Please check your available balance before requesting leaves.`;
        errorType = 'warning';
      } else if (errorMessage.includes('Cannot request more than')) {
        errorTitle = 'Maximum Days Exceeded';
        userFriendlyMessage = 'You cannot request more than the maximum consecutive days allowed for this leave type.';
        errorType = 'warning';
      } else if (errorMessage.includes('overlapping')) {
        errorTitle = 'Overlapping Request';
        userFriendlyMessage = 'This leave request overlaps with an existing request.';
        errorType = 'warning';
      } else if (errorMessage.includes('notice period')) {
        errorTitle = 'Notice Period Required';
        userFriendlyMessage = 'Please submit your request within the required notice period.';
        errorType = 'warning';
      } else if (errorMessage.includes('minimum service')) {
        errorTitle = 'Service Period Not Met';
        userFriendlyMessage = 'You have not completed the minimum service period required for this leave type.';
        errorType = 'warning';
      } else if (errorMessage.includes('gender specific')) {
        errorTitle = 'Not Eligible';
        userFriendlyMessage = 'This leave type is not applicable for your gender.';
        errorType = 'warning';
      } else if (errorMessage.includes('documentation required')) {
        errorTitle = 'Documentation Required';
        userFriendlyMessage = 'Please attach the required documentation for this leave type.';
        errorType = 'warning';
      } else if (errorMessage.includes('past date')) {
        errorTitle = 'Invalid Date';
        userFriendlyMessage = 'Cannot submit leave request for past dates.';
        errorType = 'warning';
      } else if (errorMessage.includes('maximum allowed')) {
        errorTitle = 'Limit Exceeded';
        userFriendlyMessage = 'You have exceeded the maximum allowed leaves for this type.';
        errorType = 'warning';
      }

      setErrorModal({
        visible: true,
        title: errorTitle,
        message: userFriendlyMessage,
        type: errorType
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      leave_type_id: '',
      start_date: new Date(),
      end_date: new Date(),
      reason: '',
      contact_number: '',
    });
    setDocuments([]);
  };

  const showError = (message: string) => {
    setErrorModal({
      visible: true,
      title: 'Error',
      message,
      type: 'error'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return theme === 'dark' ? '#F59E0B' : '#FCD34D';
      case 'approved':
        return theme === 'dark' ? '#10B981' : '#34D399';
      case 'rejected':
        return theme === 'dark' ? '#EF4444' : '#F87171';
      default:
        return theme === 'dark' ? '#6B7280' : '#9CA3AF';
    }
  };

  const getDocumentIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return 'image';
    }
    if (fileType === 'application/pdf') {
      return 'document-text';
    }
    return 'document';
  };

  const handleViewDocument = async (document: Document) => {
    try {
      const fileUri = `${FileSystem.cacheDirectory}${document.file_name}`;
      const base64Content = document.file_data;
      
      await FileSystem.writeAsStringAsync(fileUri, base64Content, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const contentUri = await FileSystem.getContentUriAsync(fileUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: document.file_type,
      });
    } catch (error) {
      console.error('Error opening document:', error);
      showError('Failed to open document. Please try again.');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Header with Add Button */}
      <View className="flex-row justify-between items-center mb-6">
        <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          My Leave Requests
        </Text>
        <TouchableOpacity
          onPress={() => setShowRequestModal(true)}
          className="bg-blue-500 px-4 py-2 rounded-lg flex-row items-center"
        >
          <Ionicons name="add" size={24} color="white" />
          <Text className="text-white font-medium ml-2">New Request</Text>
        </TouchableOpacity>
      </View>

      {/* Requests List */}
      <ScrollView className="flex-1">
        {requests.length === 0 ? (
          <View className={`p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No leave requests found
            </Text>
          </View>
        ) : (
          requests.map((request, index) => (
            <React.Fragment key={request.id}>
              <View className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                {/* Status Badge */}
                <View className="flex-row justify-between items-start mb-4">
                  <View className="flex-row items-center">
                    <Ionicons
                      name={
                        request.status === 'approved'
                          ? 'checkmark-circle'
                          : request.status === 'rejected'
                          ? 'close-circle'
                          : 'time'
                      }
                      size={24}
                      color={getStatusColor(request.status)}
                      style={{ marginRight: 8 }}
                    />
                    <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {request.leave_type_name}
                    </Text>
                  </View>
                  <View className={`px-3 py-1 rounded-full`} style={{
                    backgroundColor: `${getStatusColor(request.status)}20`
                  }}>
                    <Text style={{ color: getStatusColor(request.status), fontWeight: '600' }}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Text>
                  </View>
                </View>

                {/* Request Details */}
                <View className="space-y-3">
                  {/* Date Range */}
                  <View className="flex-row items-center">
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={isDark ? '#9CA3AF' : '#6B7280'}
                      style={{ marginRight: 8 }}
                    />
                    <Text className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                      {format(new Date(request.start_date), 'MMM dd, yyyy')} - {format(new Date(request.end_date), 'MMM dd, yyyy')}
                      {' • '}
                      <Text className="font-medium">
                        {request.days_requested} day{request.days_requested !== 1 ? 's' : ''}
                      </Text>
                    </Text>
                  </View>

                  {/* Reason */}
                  <View className="flex-row items-start">
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color={isDark ? '#9CA3AF' : '#6B7280'}
                      style={{ marginRight: 8, marginTop: 2 }}
                    />
                    <Text className={`flex-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {request.reason}
                    </Text>
                  </View>

                  {/* Contact Number */}
                  <View className="flex-row items-center">
                    <Ionicons
                      name="call-outline"
                      size={18}
                      color={isDark ? '#9CA3AF' : '#6B7280'}
                      style={{ marginRight: 8 }}
                    />
                    <Text className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                      +91 {request.contact_number}
                    </Text>
                  </View>
                </View>

                {/* Documents Section */}
                {request.documents.length > 0 && (
                  <View className="mt-4 pt-4 border-t border-gray-200">
                    <Text className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Attachments
                    </Text>
                    <View className="flex-row flex-wrap">
                      {request.documents.map((doc) => (
                        <TouchableOpacity
                          key={doc.id}
                          onPress={() => handleViewDocument(doc)}
                          className={`mr-2 mb-2 px-4 py-2 rounded-lg flex-row items-center ${
                            isDark ? 'bg-gray-700' : 'bg-gray-100'
                          }`}
                        >
                          <Ionicons
                            name={getDocumentIcon(doc.file_type)}
                            size={18}
                            color={isDark ? '#D1D5DB' : '#4B5563'}
                          />
                          <Text className={`ml-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {doc.file_name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Rejection Reason */}
                {request.rejection_reason && (
                  <View className="mt-4 p-4 rounded-lg bg-red-50">
                    <View className="flex-row items-start">
                      <Ionicons
                        name="alert-circle"
                        size={20}
                        color="#DC2626"
                        style={{ marginRight: 8, marginTop: 2 }}
                      />
                      <View className="flex-1">
                        <Text className="text-red-800 font-medium mb-1">
                          Rejection Reason
                        </Text>
                        <Text className="text-red-600">
                          {request.rejection_reason}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
              
              {/* Add separator if not the last item */}
              {index < requests.length - 1 && (
                <View className="h-4" />
              )}
            </React.Fragment>
          ))
        )}
      </ScrollView>

      {/* New Request Modal */}
      <Modal
        visible={showRequestModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className={`w-11/12 max-h-[80%] rounded-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <View className="p-6 border-b border-gray-200">
              <View className="flex-row justify-between items-center">
                <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  New Leave Request
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowRequestModal(false);
                    resetForm();
                  }}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDark ? '#D1D5DB' : '#4B5563'}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView className="p-6">
              <View className="space-y-4">
                {/* Leave Type Picker */}
                <View>
                  <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Leave Type
                  </Text>
                  <View className={`border rounded-lg ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <Picker
                      selectedValue={formData.leave_type_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, leave_type_id: value }))}
                      style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                    >
                      <Picker.Item label="Select Leave Type" value="" />
                      {leaveTypes.map((type) => (
                        <Picker.Item
                          key={type.id}
                          label={type.name}
                          value={type.id.toString()}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>

                {/* Date Selection */}
                <View className="flex-row space-x-4 gap-2 mt-2">
                  <View className="flex-1">
                    <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Start Date
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setDatePickerMode('start');
                        setShowDatePicker(true);
                      }}
                      className={`p-3 rounded-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
                    >
                      <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                        {format(formData.start_date, 'MMM dd, yyyy')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View className="flex-1">
                    <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      End Date
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setDatePickerMode('end');
                        setShowDatePicker(true);
                      }}
                      className={`p-3 rounded-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
                    >
                      <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                        {format(formData.end_date, 'MMM dd, yyyy')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {showDatePicker && (
                  <DateTimePicker
                    value={datePickerMode === 'start' ? formData.start_date : formData.end_date}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) {
                        setFormData(prev => ({
                          ...prev,
                          [datePickerMode === 'start' ? 'start_date' : 'end_date']: selectedDate
                        }));
                      }
                    }}
                  />
                )}

                {/* Reason Input */}
                <View className="mt-2">
                  <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Reason
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
                  />
                </View>

                {/* Contact Number Input */}
                <View className="mt-2">
                  <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Contact Number
                  </Text>
                  <View className={`flex-row items-center rounded-lg border ${
                    isDark
                      ? 'border-gray-700 bg-gray-700'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <Text className={`px-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>+91</Text>
                    <TextInput
                      value={formData.contact_number}
                      onChangeText={(text: string) => {
                        // Remove any non-numeric characters and the +91 prefix if accidentally pasted
                        const cleanedText = text.replace(/\D/g, '').replace(/^91/, '');
                        setFormData(prev => ({ ...prev, contact_number: cleanedText }));
                      }}
                      keyboardType="phone-pad"
                      maxLength={10}
                      className={`flex-1 p-3 ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}
                      placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                      placeholder="Enter contact number"
                    />
                  </View>
                </View>

                {/* Document Upload - Only show for leave types requiring documentation */}
                {leaveTypes.find(type => type.id.toString() === formData.leave_type_id)?.requires_documentation && (
                  <View className="mt-2">
                    <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Documents Required <Text className="text-red-500">*</Text>
                    </Text>
                    <View className="flex-row space-x-4 mb-4 gap-2">
                      <TouchableOpacity
                        onPress={() => handleDocumentUpload('camera')}
                        className="flex-1 bg-blue-500 p-3 rounded-lg flex-row justify-center items-center"
                      >
                        <Ionicons name="camera" size={20} color="white" style={{ marginRight: 8 }} />
                        <Text className="text-white font-medium">Camera</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDocumentUpload('file')}
                        className="flex-1 bg-green-500 p-3 rounded-lg flex-row justify-center items-center"
                      >
                        <Ionicons name="document" size={20} color="white" style={{ marginRight: 8 }} />
                        <Text className="text-white font-medium">Upload</Text>
                      </TouchableOpacity>
                    </View>

                    {documents.length > 0 && (
                      <View className="space-y-2">
                        {documents.map((doc, index) => (
                          <View
                            key={index}
                            className={`flex-row justify-between items-center p-3 rounded-lg ${
                              isDark ? 'bg-gray-700' : 'bg-gray-100'
                            }`}
                          >
                            <View className="flex-row items-center">
                              <Ionicons
                                name={getDocumentIcon(doc.file_type)}
                                size={20}
                                color={isDark ? '#D1D5DB' : '#4B5563'}
                              />
                              <Text className={`ml-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {doc.file_name}
                              </Text>
                            </View>
                            <TouchableOpacity onPress={() => removeDocument(index)}>
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
                  </View>
                )}

                {/* Submit Button moved inside ScrollView */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={submitting}
                  className={`py-3 rounded-lg mt-6 ${submitting ? 'bg-gray-400' : 'bg-blue-500'}`}
                >
                  {submitting ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white text-center font-medium">
                      Submit Request
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Error/Success Modal */}
      <Modal
        visible={errorModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModal(prev => ({ ...prev, visible: false }))}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className={`w-11/12 p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <View className="items-center mb-4">
              <Ionicons
                name={
                  errorModal.type === 'success'
                    ? 'checkmark-circle'
                    : errorModal.type === 'warning'
                    ? 'warning'
                    : 'alert-circle'
                }
                size={48}
                color={
                  errorModal.type === 'success'
                    ? '#10B981'
                    : errorModal.type === 'warning'
                    ? '#F59E0B'
                    : '#EF4444'
                }
              />
            </View>
            <Text className={`text-lg font-semibold text-center mb-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              {errorModal.title}
            </Text>
            <Text className={`text-center mb-6 ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {errorModal.message}
            </Text>
            <TouchableOpacity
              onPress={() => setErrorModal(prev => ({ ...prev, visible: false }))}
              className={`py-3 rounded-lg ${
                errorModal.type === 'success'
                  ? 'bg-green-500'
                  : errorModal.type === 'warning'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
            >
              <Text className="text-white text-center font-medium">
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
} 