import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Switch,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import axios from 'axios';
import Modal from 'react-native-modal';
import { format, differenceInDays } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
  
interface LeaveType {
  id: number;
  name: string;
  description: string;
  requires_documentation: boolean;
  max_days: number;
  is_paid: boolean;
}

interface LeaveRequest {
  id: number;
  user_id: number;
  leave_type_id: number;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  rejection_reason?: string;
  contact_number: string;
  requires_documentation: boolean;
  documentation_url?: string;
  created_at: string;
  updated_at: string;
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
  const router = useRouter();
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === 'dark';
  const { token, user } = AuthContext.useAuth();

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveType | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: new Date(),
    end_date: new Date(),
    reason: '',
    contact_number: '',
    documentation_url: ''
  });

  // Error modal state
  const [errorModal, setErrorModal] = useState<ErrorModalState>({
    visible: false,
    title: '',
    message: '',
    type: 'error'
  });

  useEffect(() => {
    fetchRequests();
    fetchLeaveTypes();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/leave-types`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data) {
        setLeaveTypes(response.data);
      }
    } catch (error) {
      console.error('Error fetching leave types:', error);
      setErrorModal({
        visible: true,
        title: 'Error',
        message: 'Failed to fetch leave types. Please try again.',
        type: 'error'
      });
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/leave-requests`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data) {
        setRequests(response.data);
        setError(null);
      }
    } catch (error: any) {
      console.error('Error fetching requests:', error);
      setError(error.response?.data?.error || 'Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  // Function to handle document upload
  const handleDocumentUpload = async (method: 'camera' | 'file') => {
    try {
      if (method === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          setErrorModal({
            visible: true,
            title: 'Permission Required',
            message: 'Please enable camera access to take photos',
            type: 'error'
          });
          return;
        }
        
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: 'images',
          quality: 0.7,
          base64: true,
        });

        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          const fileName = asset.uri.split('/').pop() || 'photo.jpg';
          
          setDocuments(prev => [...prev, {
            file_name: fileName,
            file_type: 'image/jpeg',
            file_data: asset.base64!,
            upload_method: 'camera'
          }]);
        }
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/*', 'application/pdf'],
          copyToCacheDirectory: true,
        });

        if (result.assets && result.assets[0]) {
          const asset = result.assets[0];
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const reader = new FileReader();
          
          reader.onload = () => {
            const base64Data = reader.result?.toString().split(',')[1];
            if (base64Data) {
              setDocuments(prev => [...prev, {
                file_name: asset.name,
                file_type: asset.mimeType || 'application/octet-stream',
                file_data: base64Data,
                upload_method: 'file'
              }]);
            }
          };
          
          reader.readAsDataURL(blob);
        }
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      setErrorModal({
        visible: true,
        title: 'Upload Failed',
        message: 'Failed to upload document. Please try again.',
        type: 'error'
      });
    }
  };

  // Function to remove document
  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      if (!user?.id) {
        setErrorModal({
          visible: true,
          title: 'Authentication Error',
          message: 'User not authenticated. Please log in again.',
          type: 'error'
        });
        return;
      }

      // Validate phone number
      const phoneNumber = formData.contact_number.trim();
      const phoneRegex = /^\+91[0-9]{10}$/;
      if (!phoneRegex.test(phoneNumber)) {
        setErrorModal({
          visible: true,
          title: 'Invalid Phone Number',
          message: 'Please enter a valid phone number starting with +91 followed by 10 digits',
          type: 'error'
        });
        return;
      }

      // Validate required documentation
      if (selectedLeaveType?.requires_documentation && documents.length === 0) {
        setErrorModal({
          visible: true,
          title: 'Documentation Required',
          message: 'Please upload required documentation for this leave type',
          type: 'warning'
        });
        return;
      }

      // Calculate days
      const daysRequested = differenceInDays(formData.end_date, formData.start_date) + 1;

      // Validate leave type selection
      if (!formData.leave_type_id) {
        setErrorModal({
          visible: true,
          title: 'Leave Type Required',
          message: 'Please select a leave type',
          type: 'error'
        });
        return;
      }

      // Validate dates
      if (formData.end_date < formData.start_date) {
        setErrorModal({
          visible: true,
          title: 'Invalid Dates',
          message: 'End date cannot be before start date',
          type: 'error'
        });
        return;
      }

      // Validate start date is not in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (formData.start_date < today) {
        setErrorModal({
          visible: true,
          title: 'Invalid Start Date',
          message: 'Start date cannot be in the past',
          type: 'error'
        });
        return;
      }

      // Validate reason
      if (!formData.reason.trim()) {
        setErrorModal({
          visible: true,
          title: 'Reason Required',
          message: 'Please provide a reason for your leave request',
          type: 'error'
        });
        return;
      }

      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/leave-requests`,
        {
          user_id: user.id,
          leave_type_id: parseInt(formData.leave_type_id),
          start_date: format(formData.start_date, 'yyyy-MM-dd'),
          end_date: format(formData.end_date, 'yyyy-MM-dd'),
          reason: formData.reason,
          contact_number: phoneNumber,
          days_requested: daysRequested,
          documents: documents
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data) {
        await fetchRequests();
        setShowAddModal(false);
        resetForm();
        setErrorModal({
          visible: true,
          title: 'Success',
          message: 'Leave request submitted successfully',
          type: 'success'
        });
      }
    } catch (error: any) {
      console.error('Error submitting request:', error);
      
      const errorMessage = error.response?.data?.error || error.message;
      const errorDetails = error.response?.data?.details;
      let userFriendlyMessage = 'Failed to submit request. Please try again.';
      let errorType: 'error' | 'warning' = 'error';
      let errorTitle = 'Request Failed';

      if (errorMessage.includes('Notice period requirement not met') && errorDetails) {
        errorTitle = 'Notice Period Required';
        userFriendlyMessage = `This leave type requires ${errorDetails.required_days} days notice. The earliest possible start date is ${format(new Date(errorDetails.earliest_possible_date), 'MMM dd, yyyy')}.`;
        errorType = 'warning';
      } else if (errorMessage.includes('Insufficient leave balance')) {
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
      } else if (errorMessage.includes('minimum service')) {
        errorTitle = 'Service Period Not Met';
        userFriendlyMessage = 'You have not completed the minimum service period required for this leave type.';
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
      documentation_url: '',
    });
    setDocuments([]);
    setSelectedLeaveType(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'escalated':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  // Update leave type selection to track documentation requirement
  const handleLeaveTypeChange = (value: string) => {
    const selectedType = leaveTypes.find(type => type.id.toString() === value);
    setSelectedLeaveType(selectedType || null);
    setFormData(prev => ({ ...prev, leave_type_id: value }));
  };

  // Update the document preview icon logic
  const getDocumentIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return 'image';
    } else if (fileType.includes('pdf')) {
      return 'document-text';
    }
    return 'document-outline';
  };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Header with Add Button - Always visible */}
      <View className="flex-row z-10 justify-between items-center mb-6">
        <Text
          className={`text-xl font-semibold ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          Leave Requests
        </Text>
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="bg-blue-500 px-4 z-10 py-2 rounded-lg flex-row items-center"
        >
          <Ionicons name="add" size={24} color="white" />
          <Text className="text-white font-medium ml-2">Request Leave</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View className="flex-1 justify-center items-center p-4">
          <Text
            className={`text-lg text-center mb-4 ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {error}
          </Text>
          <TouchableOpacity
            onPress={fetchRequests}
            className="bg-blue-500 px-4 py-2 rounded-lg flex-row items-center"
          >
            <Ionicons
              name="refresh"
              size={20}
              color="white"
              style={{ marginRight: 8 }}
            />
            <Text className="text-white font-medium">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !requests || requests.length === 0 ? (
        <View className="flex-1 justify-center items-center p-4">
          <Ionicons
            name="document-text-outline"
            size={64}
            color={isDark ? "#9CA3AF" : "#6B7280"}
          />
          <Text
            className={`text-xl font-semibold mt-4 ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            No Leave Requests
          </Text>
          <Text
            className={`text-center mt-2 ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            You haven't made any leave requests yet.
          </Text>
          <TouchableOpacity
            onPress={fetchRequests}
            className="mt-6 bg-blue-500 px-6 py-3 rounded-lg flex-row items-center"
          >
            <Ionicons
              name="refresh"
              size={20}
              color="white"
              style={{ marginRight: 8 }}
            />
            <Text className="text-white font-medium">Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#3B82F6"]}
              tintColor={isDark ? "#FFFFFF" : "#3B82F6"}
            />
          }
        >
          {requests.map((request) => (
            <View
              key={request.id}
              className={`mb-4 p-4 rounded-lg ${
                isDark ? "bg-gray-800" : "bg-white"
              }`}
            >
              <View className="flex-row justify-between items-start mb-2">
                <Text
                  className={`text-lg font-semibold ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  {request.leave_type_name}
                </Text>
                <View
                  className={`px-2 py-1 rounded ${getStatusColor(
                    request.status
                  )}`}
                >
                  <Text className="text-sm capitalize">{request.status}</Text>
                </View>
              </View>

              <View className="mt-4 space-y-2">
                <View className="flex-row items-center">
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={isDark ? "#9CA3AF" : "#6B7280"}
                    style={{ marginRight: 8 }}
                  />
                  <Text className={isDark ? "text-gray-300" : "text-gray-700"}>
                    {format(new Date(request.start_date), "MMM dd, yyyy")} -{" "}
                    {format(new Date(request.end_date), "MMM dd, yyyy")} (
                    {request.days_requested} days)
                  </Text>
                </View>

                <View className="flex-row items-center">
                  <Ionicons
                    name="document-text-outline"
                    size={16}
                    color={isDark ? "#9CA3AF" : "#6B7280"}
                    style={{ marginRight: 8 }}
                  />
                  <Text className={isDark ? "text-gray-300" : "text-gray-700"}>
                    {request.reason}
                  </Text>
                </View>

                {request.rejection_reason && (
                  <View className="flex-row items-center">
                    <Ionicons
                      name="alert-circle-outline"
                      size={16}
                      color="#EF4444"
                      style={{ marginRight: 8 }}
                    />
                    <Text className="text-red-500">
                      {request.rejection_reason}
                    </Text>
                  </View>
                )}

                <View className="flex-row items-center">
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={isDark ? "#9CA3AF" : "#6B7280"}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    className={`text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Requested on{" "}
                    {format(new Date(request.created_at), "MMM dd, yyyy")}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add/Edit Leave Request Modal */}
      <Modal
        isVisible={showAddModal}
        onBackdropPress={() => {
          setShowAddModal(false);
          resetForm();
        }}
        style={{ margin: 0 }}
      >
        <View
          className={`m-4 p-6 rounded-2xl ${
            isDark ? "bg-gray-800" : "bg-white"
          }`}
        >
          <Text
            className={`text-xl font-semibold mb-6 ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Request Leave
          </Text>

          {/* Form Fields */}
          <View className="space-y-4">
            {/* Leave Type Picker */}
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Leave Type
              </Text>
              <View
                className={`border rounded-lg overflow-hidden ${
                  isDark ? "border-gray-700" : "border-gray-200"
                }`}
              >
                <Picker
                  selectedValue={formData.leave_type_id}
                  onValueChange={handleLeaveTypeChange}
                  style={{ color: isDark ? "#FFFFFF" : "#111827" }}
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
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Start Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker("start")}
                className={`p-3 border rounded-lg flex-row justify-between items-center ${
                  isDark
                    ? "border-gray-700 bg-gray-700"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <Text className={isDark ? "text-white" : "text-gray-900"}>
                  {format(formData.start_date, "MMM dd, yyyy")}
                </Text>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                />
              </TouchableOpacity>
            </View>

            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                End Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker("end")}
                className={`p-3 border rounded-lg flex-row justify-between items-center ${
                  isDark
                    ? "border-gray-700 bg-gray-700"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <Text className={isDark ? "text-white" : "text-gray-900"}>
                  {format(formData.end_date, "MMM dd, yyyy")}
                </Text>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                />
              </TouchableOpacity>
            </View>

            {/* Reason Input */}
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Reason
              </Text>
              <TextInput
                value={formData.reason}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, reason: text }))
                }
                multiline
                numberOfLines={3}
                className={`p-3 rounded-lg border ${
                  isDark
                    ? "border-gray-700 bg-gray-700 text-white"
                    : "border-gray-200 bg-gray-50 text-gray-900"
                }`}
                placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
                textAlignVertical="top"
              />
            </View>

            {/* Contact Number */}
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Contact Number
              </Text>
              <View
                className={`flex-row items-center p-3 rounded-lg border ${
                  isDark
                    ? "border-gray-700 bg-gray-700"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <Text className={isDark ? "text-white" : "text-gray-900"}>
                  +91
                </Text>
                <TextInput
                  value={formData.contact_number.replace("+91", "")}
                  onChangeText={(text) => {
                    const numbersOnly = text.replace(/[^0-9]/g, "");
                    setFormData((prev) => ({
                      ...prev,
                      contact_number:
                        numbersOnly.length > 0
                          ? `+91${numbersOnly.slice(0, 10)}`
                          : "+91",
                    }));
                  }}
                  keyboardType="phone-pad"
                  className={`flex-1 ml-1 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                  placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
                  maxLength={13} // +91 + 10 digits
                />
              </View>
            </View>

            {/* Document Upload Section */}
            {selectedLeaveType?.requires_documentation && (
              <View className="mt-2">
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Documentation Required
                </Text>
                <View className="flex-row space-x-2 gap-4">
                  <TouchableOpacity
                    onPress={() => handleDocumentUpload("camera")}
                    className="flex-1 bg-blue-500 p-3 rounded-lg flex-row justify-center items-center"
                  >
                    <Ionicons
                      name="camera"
                      size={20}
                      color="white"
                      style={{ marginRight: 8 }}
                    />
                    <Text className="text-white font-medium">Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDocumentUpload("file")}
                    className="flex-1 bg-blue-500 p-3 rounded-lg flex-row justify-center items-center"
                  >
                    <Ionicons
                      name="document"
                      size={20}
                      color="white"
                      style={{ marginRight: 8 }}
                    />
                    <Text className="text-white font-medium">Upload File</Text>
                  </TouchableOpacity>
                </View>

                {/* Document Preview */}
                {documents.length > 0 && (
                  <View className="mt-4">
                    <Text
                      className={`text-sm font-medium mb-2 ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Uploaded Documents
                    </Text>
                    {documents.map((doc, index) => (
                      <View
                        key={index}
                        className={`flex-row items-center justify-between p-2 rounded-lg mb-2 ${
                          isDark ? "bg-gray-700" : "bg-gray-100"
                        }`}
                      >
                        <View className="flex-row items-center flex-1">
                          <Ionicons
                            name={getDocumentIcon(doc.file_type)}
                            size={20}
                            color={isDark ? "#9CA3AF" : "#6B7280"}
                          />
                          <Text
                            className={`ml-2 flex-1 ${
                              isDark ? "text-white" : "text-gray-900"
                            }`}
                            numberOfLines={1}
                          >
                            {doc.file_name}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => removeDocument(index)}
                          className="ml-2 p-1"
                        >
                          <Ionicons
                            name="close-circle"
                            size={20}
                            color={isDark ? "#9CA3AF" : "#6B7280"}
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View className="flex-row space-x-4 mt-6 gap-4">
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className={`flex-1 py-3 rounded-lg ${
                isDark ? "bg-gray-700" : "bg-gray-100"
              }`}
            >
              <Text
                className={`text-center font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-blue-500 py-3 rounded-lg"
            >
              {submitting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white text-center font-medium">
                  Submit Request
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={
            showDatePicker === "start" ? formData.start_date : formData.end_date
          }
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(null);
            if (selectedDate) {
              setFormData((prev) => ({
                ...prev,
                [showDatePicker === "start" ? "start_date" : "end_date"]:
                  selectedDate,
              }));
            }
          }}
        />
      )}

      {/* Status Modal */}
      <StatusModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
        onClose={() => setErrorModal((prev) => ({ ...prev, visible: false }))}
      />
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
  backButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  fabButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

const StatusModal = ({ 
  visible, 
  title, 
  message, 
  type, 
  onClose 
}: ErrorModalState & { onClose: () => void }) => {
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === 'dark';

  const getIconName = () => {
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'warning':
        return 'warning';
      case 'error':
        return 'close-circle';
      default:
        return 'information-circle';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return '#10B981';
      case 'warning':
        return '#F59E0B';
      case 'error':
        return '#EF4444';
      default:
        return '#3B82F6';
    }
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      style={{ margin: 0 }}
    >
      <View className={`m-4 p-6 rounded-2xl ${
        isDark ? 'bg-gray-800' : 'bg-white'
      }`}>
        <View className="items-center mb-4">
          <Ionicons
            name={getIconName()}
            size={48}
            color={getIconColor()}
          />
        </View>
        
        <Text className={`text-xl font-semibold text-center mb-2 ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>
          {title}
        </Text>
        
        <Text className={`text-center mb-6 ${
          isDark ? 'text-gray-300' : 'text-gray-600'
        }`}>
          {message}
        </Text>
        
        <TouchableOpacity
          onPress={onClose}
          className={`py-3 px-6 rounded-lg ${
            type === 'error' ? 'bg-red-500' :
            type === 'success' ? 'bg-green-500' :
            type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
          }`}
        >
          <Text className="text-white text-center font-medium">
            {type === 'error' ? 'Try Again' : 'OK'}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};