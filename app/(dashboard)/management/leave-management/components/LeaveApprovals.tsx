import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import axios from 'axios';
import Modal from 'react-native-modal';
import { format } from 'date-fns';
import Toast from 'react-native-toast-message';

interface Document {
  id: number;
  file_name: string;
  file_type: string;
  file_data: string;
  upload_method: 'camera' | 'file';
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
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  rejection_reason?: string;
  contact_number: string;
  requires_documentation: boolean;
  documentation_url?: string;
  created_at: string;
  documents: Document[];
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
  const [actionLoading, setActionLoading] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  useEffect(() => {
    fetchRequests();
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

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selectedRequest || !user?.id) return;

    try {
      if (action === 'reject' && !rejectionReason.trim()) {
        setError('Rejection reason is required');
        return;
      }

      setActionLoading(true);
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/leave-requests/${selectedRequest.id}/${action}`,
        {
          rejection_reason: action === 'reject' ? rejectionReason.trim() : undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data) {
        await fetchRequests();
        setShowActionModal(false);
        setSelectedRequest(null);
        setRejectionReason('');
        setError(null);
      }
    } catch (error: any) {
      console.error('Error processing request:', error);
      setError(error.response?.data?.error || 'Failed to process request. Please try again.');
    } finally {
      setActionLoading(false);
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

  const handleViewDocument = (document: Document) => {
    setSelectedDocument(document);
    setShowDocumentModal(true);
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
              className="mr-2 mb-2 p-2 bg-gray-100 rounded-lg flex-row items-center"
            >
              <Ionicons
                name={doc.upload_method === 'camera' ? 'camera' : 'document'}
                size={20}
                color="#6B7280"
              />
              <Text className="ml-2 text-gray-700" numberOfLines={1}>
                {doc.file_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
          You're all caught up! There are no leave requests waiting for your approval.
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
      <ScrollView className="flex-1">
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

              <View>
                <Text className={`text-sm font-medium mb-2 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Rejection Reason (required if rejecting)
                </Text>
                <TextInput
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                  multiline
                  numberOfLines={3}
                  className={`p-3 rounded-lg border ${
                    isDark
                      ? 'border-gray-700 bg-gray-700 text-white'
                      : 'border-gray-200 bg-gray-50 text-gray-900'
                  }`}
                  placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                  placeholder="Enter reason for rejection..."
                  textAlignVertical="top"
                />
              </View>

              <View className="flex-row space-x-4 gap-3 mt-4">
                <TouchableOpacity
                  onPress={() => {
                    setShowActionModal(false);
                    setSelectedRequest(null);
                    setRejectionReason('');
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
                  onPress={() => handleAction('reject')}
                  disabled={actionLoading}
                  className="flex-1 bg-red-500 py-3 rounded-lg"
                >
                  {actionLoading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="text-white text-center font-medium">
                      Reject
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleAction('approve')}
                  disabled={actionLoading}
                  className="flex-1 bg-green-500 py-3 rounded-lg"
                >
                  {actionLoading ? (
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

      {/* Document Preview Modal */}
      <Modal
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
      </Modal>
    </View>
  );
} 