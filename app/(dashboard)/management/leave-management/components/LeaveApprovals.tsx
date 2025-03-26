import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Image,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import axios from 'axios';
import Modal from 'react-native-modal';
import { format } from 'date-fns';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';

interface Document {
  id: number;
  file_name: string;
  file_type: string;
  file_data: string;
  upload_method: 'camera' | 'file';
}

interface EscalationDetails {
  escalation_id: number;
  escalated_by: number;
  escalated_by_name: string;
  reason: string;
  escalated_at: string;
}

interface LeaveRequest {
  id: number;
  user_id: number;
  user_name: string;
  employee_number: string;
  department: string;
  leave_type_id: number;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'escalated';
  rejection_reason?: string;
  contact_number: string;
  requires_documentation: boolean;
  documentation_url?: string;
  created_at: string;
  documents: Document[];
  escalation_details?: {
    escalation_id: number;
    escalated_by: number;
    escalated_by_name: string;
    reason: string;
    escalated_at: string;
    status: 'pending' | 'resolved';
    resolution_notes?: string;
  };
}

export default function LeaveApprovals() {
  const { theme } = ThemeContext.useTheme();
  const { token, user } = AuthContext.useAuth();
  const isDark = theme === 'dark';

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [documentLoading, setDocumentLoading] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  }, []);

  const fetchRequests = async () => {
    try {
      if (!user?.id) {
        setError('User not authenticated');
        return;
      }

      setLoading(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/pending-requests`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data) {
        setRequests(response.data);
        setError(null);
      } else {
        setRequests([]);
      }
    } catch (error: any) {
      console.error('Error fetching requests:', error);
      setError(error.response?.data?.error || 'Failed to fetch requests. Please try again.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId: number, action: 'approve' | 'reject') => {
    if (!selectedRequest) return;

    const isEscalated = selectedRequest.status === 'escalated';
    if (isEscalated && !resolutionNotes.trim()) {
      Alert.alert('Error', 'Resolution notes are required for escalated requests');
      return;
    }

    if (action === 'reject' && !rejectionReason.trim()) {
      Alert.alert('Error', 'Rejection reason is required');
      return;
    }

    setActionLoading(requestId);
    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/leave-requests/${requestId}/${action}`,
        {
          rejection_reason: action === 'reject' ? rejectionReason : undefined,
          resolution_notes: isEscalated ? resolutionNotes : undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 200) {
        // Send notification based on whether it's an escalated request or not
        if (isEscalated) {
          // For escalated requests, notify the employee
          const employeeNotificationTitle = `${action === 'approve' ? '✅' : '❌'} Leave Request ${action === 'approve' ? 'Approved' : 'Rejected'} by Management`;
          const employeeNotificationMessage = 
            `Your escalated leave request has been ${action === 'approve' ? 'approved' : 'rejected'} by management.\n\n` +
            `📅 Period: ${format(new Date(selectedRequest.start_date), 'MMM dd, yyyy')} to ${format(new Date(selectedRequest.end_date), 'MMM dd, yyyy')}\n` +
            `📝 Leave Type: ${selectedRequest.leave_type_name}\n` +
            `⏱️ Duration: ${selectedRequest.days_requested} day(s)\n` +
            `\n📋 ${action === 'approve' ? 'Resolution' : 'Rejection'} Notes: ${action === 'approve' ? resolutionNotes : rejectionReason}`;

          // Send notification to employee
          await axios.post(
            `${process.env.EXPO_PUBLIC_API_URL}/api/management-notifications/send-users`,
            {
              title: employeeNotificationTitle,
              message: employeeNotificationMessage,
              userIds: [selectedRequest.user_id],
              type: "leave-request-resolution",
              priority: "high",
              data: { 
                screen: "/(dashboard)/employee/leave-insights",
                action,
                leaveId: selectedRequest.id
              }
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          // Also notify the group admin who escalated the request
          if (selectedRequest.escalation_details?.escalated_by) {
            const groupAdminNotificationTitle = `${action === 'approve' ? '✅' : '❌'} Escalated Leave Request ${action === 'approve' ? 'Approved' : 'Rejected'}`;
            const groupAdminNotificationMessage = 
              `An escalated leave request you forwarded has been ${action === 'approve' ? 'approved' : 'rejected'} by management.\n\n` +
              `👤 Employee: ${selectedRequest.user_name} (${selectedRequest.employee_number})\n` +
              `📅 Period: ${format(new Date(selectedRequest.start_date), 'MMM dd, yyyy')} to ${format(new Date(selectedRequest.end_date), 'MMM dd, yyyy')}\n` +
              `📝 Leave Type: ${selectedRequest.leave_type_name}\n` +
              `⏱️ Duration: ${selectedRequest.days_requested} day(s)\n` +
              `\n📋 ${action === 'approve' ? 'Resolution' : 'Rejection'} Notes: ${action === 'approve' ? resolutionNotes : rejectionReason}`;

            await axios.post(
              `${process.env.EXPO_PUBLIC_API_URL}/api/management-notifications/send-users`,
              {
                title: groupAdminNotificationTitle,
                message: groupAdminNotificationMessage,
                userIds: [selectedRequest.escalation_details.escalated_by],
                type: "leave-request-resolution",
                priority: "high",
                data: { 
                  screen: "/(dashboard)/Group-Admin/leave-management",
                  action,
                  leaveId: selectedRequest.id
                }
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
          }
        } else {
          // For direct leave requests, notify the group admin
          const notificationTitle = `${action === 'approve' ? '✅' : '❌'} Leave Request ${action === 'approve' ? 'Approved' : 'Rejected'} by Management`;
          const notificationMessage = 
            `Your leave request has been ${action === 'approve' ? 'approved' : 'rejected'} by management.\n\n` +
            `📅 Period: ${format(new Date(selectedRequest.start_date), 'MMM dd, yyyy')} to ${format(new Date(selectedRequest.end_date), 'MMM dd, yyyy')}\n` +
            `📝 Leave Type: ${selectedRequest.leave_type_name}\n` +
            `⏱️ Duration: ${selectedRequest.days_requested} day(s)` +
            (action === 'reject' ? `\n\n📋 Rejection Reason: ${rejectionReason}` : '');

          await axios.post(
            `${process.env.EXPO_PUBLIC_API_URL}/api/management-notifications/send-users`,
            {
              title: notificationTitle,
              message: notificationMessage,
              userIds: [selectedRequest.user_id],
              type: "leave-request-resolution",
              priority: "high",
              data: { 
                screen: "/(dashboard)/Group-Admin/leave-management",
                action,
                leaveId: selectedRequest.id
              }
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }

        // Set success message before closing modals
        const actionText = action === 'approve' ? 'approved' : 'rejected';
        setSuccessMessage(`Leave request has been ${actionText} successfully`);
        
        // Close action-related modals
        setShowActionModal(false);
        setShowRejectModal(false);
        setShowApproveModal(false);
        
        // Reset form states
        setRejectionReason('');
        setResolutionNotes('');
        setSelectedRequest(null);
        
        // Show success modal
        setShowSuccessModal(true);
        
        // Refresh the requests list
        await fetchRequests();
      }
    } catch (error) {
      console.error('Error processing leave request:', error);
      Alert.alert('Error', 'Failed to process leave request. Please try again.');
    } finally {
      setActionLoading(null);
    }
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

  const handleViewDocument = async (document: Document) => {
    try {
      setDocumentLoading(document.id);
      
      if (!document.file_data) {
        // If no file data, try to fetch it first
        const response = await axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/document/${document.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'text'
          }
        );
        
        if (!response.data) {
          throw new Error('No document data received');
        }
        
        document.file_data = response.data;
      }

      const fileUri = `${FileSystem.cacheDirectory}${document.file_name}`;
      
      await FileSystem.writeAsStringAsync(fileUri, document.file_data, {
        encoding: FileSystem.EncodingType.Base64
      });

      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(fileUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: document.file_type,
        });
      } else {
        // For iOS
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri);
        } else {
          await WebBrowser.openBrowserAsync(`file://${fileUri}`);
        }
      }
    } catch (error) {
      console.error('Error opening document:', error);
      Alert.alert(
        'Error',
        'Failed to open document. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setDocumentLoading(null);
    }
  };

  const renderDocuments = (request: LeaveRequest) => {
    if (!request.documents || request.documents.length === 0) {
      return null;
    }

    return (
      <View className="mt-4">
        <Text className={`text-sm font-medium mb-2 ${
          isDark ? 'text-gray-300' : 'text-gray-700'
        }`}>
          Attached Documents
        </Text>
        <View className="flex-row flex-wrap">
          {request.documents.map((doc) => (
            <TouchableOpacity
              key={doc.id}
              onPress={() => handleViewDocument(doc)}
              disabled={documentLoading === doc.id}
              className="mr-2 mb-2 p-2 bg-gray-100 rounded-lg flex-row items-center"
            >
              {documentLoading === doc.id ? (
                <ActivityIndicator size="small" color="#6B7280" style={{ marginRight: 8 }} />
              ) : (
                <Ionicons
                  name={getDocumentIcon(doc.file_type)}
                  size={20}
                  color="#6B7280"
                />
              )}
              <Text className="ml-2 text-gray-700" numberOfLines={1}>
                {doc.file_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Helper function to determine icon based on file type
  const getDocumentIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return 'image';
    } else if (fileType.includes('pdf')) {
      return 'document-text';
    } else if (fileType.includes('word') || fileType.includes('doc')) {
      return 'document';
    }
    return 'document-outline';
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
        <Text className={`text-lg text-center mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={fetchRequests}
          className="bg-blue-500 px-4 py-2 rounded-lg flex-row items-center"
        >
          <Ionicons name="refresh" size={20} color="white" style={{ marginRight: 8 }} />
          <Text className="text-white font-medium">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Ionicons
          name="checkmark-circle-outline"
          size={64}
          color={isDark ? '#9CA3AF' : '#6B7280'}
        />
        <Text className={`text-xl font-semibold mt-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          No Pending Approvals
        </Text>
        <Text className={`text-center mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          You have no escalated requests or direct leave requests from group admins to review.
        </Text>
        <TouchableOpacity
          onPress={fetchRequests}
          className="mt-6 bg-blue-500 px-6 py-3 rounded-lg flex-row items-center"
        >
          <Ionicons name="refresh" size={20} color="white" style={{ marginRight: 8 }} />
          <Text className="text-white font-medium">Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="mb-6">
        <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Leave Approvals
        </Text>
      </View>

      {/* Requests List */}
      <ScrollView 
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[isDark ? '#60A5FA' : '#3B82F6']}
            tintColor={isDark ? '#FFFFFF' : '#3B82F6'}
          />
        }
      >
        {requests.map((request) => (
          <TouchableOpacity
            key={request.id}
            onPress={() => {
              setSelectedRequest(request);
              setShowActionModal(true);
            }}
            className={`mb-4 p-4 rounded-lg ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <View className="flex-row justify-between items-start mb-2">
              <View>
                <Text className={`text-lg font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {request.user_name}
                </Text>
                <Text className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {request.employee_number} • {request.department}
                </Text>
                {request.escalation_details && (
                  <View className="mt-2 p-2 rounded-lg bg-purple-100">
                    <Text className="text-purple-800 font-medium">
                      Escalated by {request.escalation_details.escalated_by_name}
                    </Text>
                    <Text className="text-purple-700 text-sm mt-1">
                      Reason: {request.escalation_details.reason}
                    </Text>
                    <Text className="text-purple-600 text-xs mt-1">
                      {format(new Date(request.escalation_details.escalated_at), 'MMM dd, yyyy HH:mm')}
                    </Text>
                  </View>
                )}
              </View>
              <View className={`px-2 py-1 rounded ${getStatusColor(request.status)}`}>
                <Text className="text-sm capitalize">
                  {request.status}
                </Text>
              </View>
            </View>

            <View className="mt-4 space-y-2">
              <Text className={`text-sm font-medium ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {request.leave_type_name}
              </Text>

              <Text className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {format(new Date(request.start_date), 'MMM dd, yyyy')} - {format(new Date(request.end_date), 'MMM dd, yyyy')}
              </Text>

              <Text className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Reason: {request.reason}
              </Text>

              <View className="flex-row justify-between">
                <Text className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Days: {request.days_requested}
                </Text>
                <Text className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Contact: {request.contact_number}
                </Text>
              </View>

              {request.requires_documentation && request.documentation_url && (
                <TouchableOpacity
                  onPress={() => {/* Handle document view */}}
                  className="flex-row items-center"
                >
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color={isDark ? '#9CA3AF' : '#6B7280'}
                  />
                  <Text className={`ml-2 text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    View Documentation
                  </Text>
                </TouchableOpacity>
              )}

              {renderDocuments(request)}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Action Modal */}
      <Modal
        isVisible={showActionModal}
        onBackdropPress={() => {
          setShowActionModal(false);
          setSelectedRequest(null);
          setRejectionReason('');
          setResolutionNotes('');
        }}
        style={{ margin: 0 }}
      >
        <View className={`m-4 p-6 rounded-2xl ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}>
          <Text className={`text-xl font-semibold mb-6 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Process Leave Request
          </Text>

          {selectedRequest && (
            <View className="space-y-4">
              <View>
                <Text className={`text-sm font-medium ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Employee
                </Text>
                <Text className={`text-base ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {selectedRequest.user_name}
                </Text>
              </View>

              <View>
                <Text className={`text-sm font-medium ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Leave Type
                </Text>
                <Text className={`text-base ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {selectedRequest.leave_type_name}
                </Text>
              </View>

              <View>
                <Text className={`text-sm font-medium ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Duration
                </Text>
                <Text className={`text-base ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {format(new Date(selectedRequest.start_date), 'MMM dd, yyyy')} - {format(new Date(selectedRequest.end_date), 'MMM dd, yyyy')}
                  {' '}({selectedRequest.days_requested} days)
                </Text>
              </View>

              <View>
                <Text className={`text-sm font-medium ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Reason
                </Text>
                <Text className={`text-base ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {selectedRequest.reason}
                </Text>
              </View>

              {selectedRequest.status === 'escalated' && (
                <View>
                  <Text className={`text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Resolution Notes <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    value={resolutionNotes}
                    onChangeText={setResolutionNotes}
                    placeholder="Enter resolution notes for the escalation"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    className={`p-3 rounded-lg ${
                      isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                    }`}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              )}

              {/* Only show rejection reason input when rejecting */}
              {showRejectModal && (
                <View>
                  <Text className={`text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Rejection Reason <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    value={rejectionReason}
                    onChangeText={setRejectionReason}
                    placeholder="Enter reason for rejection"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    className={`p-3 rounded-lg ${
                      isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                    }`}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              )}

              <View className="flex-row space-x-4 gap-3 mt-4">
                <TouchableOpacity
                  onPress={() => {
                    setShowActionModal(false);
                    setSelectedRequest(null);
                    setRejectionReason('');
                    setResolutionNotes('');
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
                  onPress={() => {
                    setShowRejectModal(true);
                    setShowActionModal(false);
                  }}
                  disabled={actionLoading === selectedRequest?.id}
                  className="flex-1 bg-red-500 py-3 rounded-lg"
                >
                  <Text className="text-white text-center font-medium">
                    Reject
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleAction(selectedRequest.id, 'approve')}
                  disabled={
                    actionLoading === selectedRequest?.id || 
                    (selectedRequest.status === 'escalated' && !resolutionNotes.trim())
                  }
                  className="flex-1 bg-green-500 py-3 rounded-lg"
                >
                  {actionLoading === selectedRequest?.id ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="text-white text-center font-medium">
                      Approve
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isVisible={showRejectModal}
        onBackdropPress={() => setShowRejectModal(false)}
        onBackButtonPress={() => setShowRejectModal(false)}
        style={{ margin: 0 }}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className={`w-11/12 p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Reject Leave Request
            </Text>
            
            {selectedRequest?.status === 'escalated' && (
              <View className="mb-4">
                <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Resolution Notes <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  value={resolutionNotes}
                  onChangeText={setResolutionNotes}
                  placeholder="Enter resolution notes for the escalation"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  className={`p-3 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}
                  multiline
                />
              </View>
            )}

            <TextInput
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Enter reason for rejection"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              className={`p-3 rounded-lg mb-4 ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}
              multiline
            />
            <View className="flex-row space-x-2 gap-2">
              <TouchableOpacity
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setResolutionNotes('');
                }}
                className="flex-1 p-3 rounded-lg bg-gray-500"
              >
                <Text className="text-white text-center font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => selectedRequest && handleAction(selectedRequest.id, 'reject')}
                className={`flex-1 p-3 rounded-lg ${actionLoading === selectedRequest?.id ? 'bg-red-400' : 'bg-red-500'}`}
                disabled={!rejectionReason.trim() || actionLoading === selectedRequest?.id || 
                  (selectedRequest?.status === 'escalated' && !resolutionNotes.trim())}
              >
                {actionLoading === selectedRequest?.id ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-center font-medium">Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Approve Modal for Escalated Requests */}
      <Modal
        isVisible={showApproveModal && selectedRequest?.status === 'escalated'}
        onBackdropPress={() => setShowApproveModal(false)}
        onBackButtonPress={() => setShowApproveModal(false)}
        style={{ margin: 0 }}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className={`w-11/12 p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Approve Escalated Request
            </Text>
            
            <View className="mb-4">
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Resolution Notes <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={resolutionNotes}
                onChangeText={setResolutionNotes}
                placeholder="Enter resolution notes for the escalation"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                className={`p-3 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}
                multiline
              />
            </View>

            <View className="flex-row space-x-2 gap-2">
              <TouchableOpacity
                onPress={() => {
                  setShowApproveModal(false);
                  setResolutionNotes('');
                }}
                className="flex-1 p-3 rounded-lg bg-gray-500"
              >
                <Text className="text-white text-center font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => selectedRequest && handleAction(selectedRequest.id, 'approve')}
                className={`flex-1 p-3 rounded-lg ${actionLoading === selectedRequest?.id ? 'bg-green-400' : 'bg-green-500'}`}
                disabled={!resolutionNotes.trim() || actionLoading === selectedRequest?.id}
              >
                {actionLoading === selectedRequest?.id ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-center font-medium">Approve</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        isVisible={showSuccessModal}
        onBackdropPress={() => setShowSuccessModal(false)}
        style={{ margin: 0 }}
        animationIn="fadeIn"
        animationOut="fadeOut"
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className={`w-11/12 p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <View className="items-center">
              <View className="w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4">
                <Ionicons name="checkmark-circle" size={40} color="#10B981" />
              </View>
              <Text className={`text-xl font-semibold text-center mb-2 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Success!
              </Text>
              <Text className={`text-center mb-6 ${
                isDark ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {successMessage}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowSuccessModal(false)}
              className="bg-green-500 py-3 rounded-lg"
            >
              <Text className="text-white text-center font-medium">
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Document Preview Modal */}
      {/* <Modal
        isVisible={showDocumentModal}
        onBackdropPress={() => {
          setShowDocumentModal(false);
          setSelectedDocument(null);
        }}
        style={{ margin: 0 }}
      >
        <View className={`m-4 p-6 rounded-2xl ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}>
          <View className="flex-row justify-between items-center mb-4">
            <Text className={`text-xl font-semibold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Document Preview
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowDocumentModal(false);
                setSelectedDocument(null);
              }}
              className="p-2"
            >
              <Ionicons
                name="close"
                size={24}
                color={isDark ? '#9CA3AF' : '#6B7280'}
              />
            </TouchableOpacity>
          </View>

          {selectedDocument && (
            <View>
              <Image
                source={{ uri: `data:${selectedDocument.file_type};base64,${selectedDocument.file_data}` }}
                style={{ width: '100%', height: 300 }}
                resizeMode="contain"
              />
              <Text className={`mt-4 text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {selectedDocument.file_name}
              </Text>
            </View>
          )}
        </View>
      </Modal> */}
    </View>
  );
}