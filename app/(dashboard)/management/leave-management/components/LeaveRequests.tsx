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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import axios from 'axios';
import Modal from 'react-native-modal';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, differenceInDays, addDays } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

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

  // Calculate statusBarHeight
  const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [requestsRes, typesRes] = await Promise.all([
        axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/leave-requests`,
          { 
            headers: { Authorization: `Bearer ${token}` },
            params: { user_id: user?.id }
          }
        ),
        axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/leave-types`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      ]);

      if (requestsRes.data && typesRes.data) {
        setRequests(requestsRes.data);
        setLeaveTypes(typesRes.data);
        setError(null);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.response?.data?.error || 'Failed to fetch data. Please try again.');
      setRequests([]);
      setLeaveTypes([]);
    } finally {
      setLoading(false);
    }
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
      if (!user?.id) {
        setErrorModal({
          visible: true,
          title: 'Authentication Error',
          message: 'User not authenticated. Please log in again.',
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

      // Validate contact number
      if (!formData.contact_number.trim()) {
        setErrorModal({
          visible: true,
          title: 'Contact Required',
          message: 'Please provide a contact number',
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

      setLoading(true);
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/leave-requests`,
        {
          user_id: user.id,
          leave_type_id: parseInt(formData.leave_type_id),
          start_date: format(formData.start_date, 'yyyy-MM-dd'),
          end_date: format(formData.end_date, 'yyyy-MM-dd'),
          reason: formData.reason,
          contact_number: formData.contact_number,
          days_requested: daysRequested,
          documents: documents
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data) {
        await fetchData();
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
      
      // Handle specific error messages
      const errorMessage = error.response?.data?.error || error.message;
      let userFriendlyMessage = 'Failed to submit request. Please try again.';

      if (errorMessage.includes('Cannot request more than')) {
        userFriendlyMessage = 'You cannot request more than the maximum consecutive days allowed for this leave type.';
      } else if (errorMessage.includes('insufficient balance')) {
        userFriendlyMessage = 'You have insufficient leave balance for this request.';
      } else if (errorMessage.includes('overlapping')) {
        userFriendlyMessage = 'This leave request overlaps with an existing request.';
      } else if (errorMessage.includes('notice period')) {
        userFriendlyMessage = 'Please submit your request within the required notice period.';
      } else if (errorMessage.includes('minimum service')) {
        userFriendlyMessage = 'You have not completed the minimum service period required for this leave type.';
      }

      setErrorModal({
        visible: true,
        title: 'Request Failed',
        message: userFriendlyMessage,
        type: 'error'
      });
    } finally {
      setLoading(false);
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

  if (loading && !showAddModal) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#F9FAFB' }}>
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
      />

      {/* Header with proper status bar spacing */}
      <LinearGradient
        colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        style={[
          styles.header,
          { paddingTop: statusBarHeight }
        ]}
      >
        <View className="flex-row items-center justify-between px-6 py-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className={`p-2 rounded-full ${isDark ? 'bg-gray-800/80' : 'bg-gray-100'}`}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#E5E7EB' : '#374151'} />
          </TouchableOpacity>
          <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Leave Request
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {/* Main Content */}
      <ScrollView 
        className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Requests List */}
        {requests.map((request) => (
          <View
            key={request.id}
            className={`mb-4 p-4 rounded-lg ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <View className="flex-row justify-between items-start mb-2">
              <View>
                <Text className={`text-lg font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {request.leave_type_name}
                </Text>
                <Text className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {format(new Date(request.start_date), 'MMM dd, yyyy')} - {format(new Date(request.end_date), 'MMM dd, yyyy')}
                </Text>
              </View>
              <View className={`px-2 py-1 rounded ${getStatusColor(request.status)}`}>
                <Text className="text-sm capitalize">
                  {request.status}
                </Text>
              </View>
            </View>

            <View className="mt-4 space-y-2">
              <Text className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Reason: {request.reason}
              </Text>
              
              <View className="flex-row justify-between">
                <Text className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Days Requested: {request.days_requested}
                </Text>
                <Text className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Contact: {request.contact_number}
                </Text>
              </View>

              {request.rejection_reason && (
                <Text className="text-sm text-red-500">
                  Rejection Reason: {request.rejection_reason}
                </Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Request Leave FAB */}
      <TouchableOpacity
        onPress={() => setShowAddModal(true)}
        className="absolute bottom-8 right-6 flex-row items-center px-4 py-3 rounded-full"
        style={[
          styles.fabButton,
          { backgroundColor: '#3B82F6' }
        ]}
      >
        <Ionicons name="add-circle-outline" size={24} color="white" style={{ marginRight: 8 }} />
        <Text className="text-white font-semibold">Request Leave</Text>
      </TouchableOpacity>

      {/* Add Request Modal */}
      <Modal
        isVisible={showAddModal}
        onBackdropPress={() => {
          setShowAddModal(false);
          resetForm();
        }}
        style={{ margin: 0 }}
      >
        <View className={`m-4 p-6 rounded-2xl ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}>
          <Text className={`text-xl font-semibold mb-6 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            New Leave Request
          </Text>

          {/* Form Fields */}
          <ScrollView className="space-y-4">
            {/* Leave Type Picker */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Leave Type
              </Text>
              <View className={`border rounded-lg overflow-hidden ${
                isDark ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <Picker
                  selectedValue={formData.leave_type_id}
                  onValueChange={(value) => 
                    handleLeaveTypeChange(value)
                  }
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

            {/* Date Pickers */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Start Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker('start')}
                className={`p-3 rounded-lg border ${
                  isDark
                    ? 'border-gray-700 bg-gray-700'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                  {format(formData.start_date, 'MMM dd, yyyy')}
                </Text>
              </TouchableOpacity>
            </View>

            <View>
              <Text className={`text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                End Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker('end')}
                className={`p-3 rounded-lg border ${
                  isDark
                    ? 'border-gray-700 bg-gray-700'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                  {format(formData.end_date, 'MMM dd, yyyy')}
                </Text>
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={showDatePicker === 'start' ? formData.start_date : formData.end_date}
                mode="date"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(null);
                  if (selectedDate) {
                    setFormData(prev => ({
                      ...prev,
                      [showDatePicker === 'start' ? 'start_date' : 'end_date']: selectedDate
                    }));
                  }
                }}
              />
            )}

            {/* Reason */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Reason
              </Text>
              <TextInput
                value={formData.reason}
                onChangeText={(text) => 
                  setFormData(prev => ({ ...prev, reason: text }))
                }
                multiline
                numberOfLines={3}
                className={`p-3 rounded-lg border ${
                  isDark
                    ? 'border-gray-700 bg-gray-700 text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-900'
                }`}
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                textAlignVertical="top"
              />
            </View>

            {/* Contact Number */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Contact Number
              </Text>
              <TextInput
                value={formData.contact_number}
                onChangeText={(text) => 
                  setFormData(prev => ({ ...prev, contact_number: text }))
                }
                keyboardType="phone-pad"
                className={`p-3 rounded-lg border ${
                  isDark
                    ? 'border-gray-700 bg-gray-700 text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-900'
                }`}
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              />
            </View>

            {/* Documentation Section */}
            {selectedLeaveType?.requires_documentation && (
              <View className="mt-4">
                <Text className={`text-sm font-medium mb-2 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Documentation Required
                </Text>
                
                <View className="flex-row space-x-4 gap-4 mb-4">
                  <TouchableOpacity
                    onPress={() => handleDocumentUpload('camera')}
                    className="flex-1 bg-blue-500 py-2 rounded-lg flex-row justify-center items-center"
                  >
                    <Ionicons name="camera" size={20} color="white" style={{ marginRight: 8 }} />
                    <Text className="text-white font-medium">Take Photo</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => handleDocumentUpload('file')}
                    className="flex-1 bg-blue-500 py-2 rounded-lg flex-row justify-center items-center"
                  >
                    <Ionicons name="document" size={20} color="white" style={{ marginRight: 8 }} />
                    <Text className="text-white font-medium">Upload File</Text>
                  </TouchableOpacity>
                </View>

                {/* Document Preview */}
                {documents.map((doc, index) => (
                  <View key={index} className="mb-2 p-2 bg-gray-100 rounded-lg flex-row justify-between items-center">
                    <View className="flex-row items-center flex-1">
                      <Ionicons
                        name={getDocumentIcon(doc.file_type)}
                        size={20}
                        color="#6B7280"
                      />
                      <Text className="ml-2 text-gray-700 flex-1" numberOfLines={1}>
                        {doc.file_name}
                      </Text>
                    </View>
                    
                    <TouchableOpacity
                      onPress={() => removeDocument(index)}
                      className="p-2"
                    >
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View className="flex-row space-x-4 gap-4 mt-6">
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className={`flex-1 py-3 rounded-lg ${
                isDark ? 'bg-gray-700' : 'bg-gray-100'
              }`}
            >
              <Text className={`text-center font-medium ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              className="flex-1 bg-blue-500 py-3 rounded-lg"
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white text-center font-medium">
                  Submit
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Status Modal */}
      <StatusModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
        onClose={() => setErrorModal(prev => ({ ...prev, visible: false }))}
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