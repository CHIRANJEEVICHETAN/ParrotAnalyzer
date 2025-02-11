import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { useAuth } from '../../../../context/AuthContext';
import ThemeContext from '../../../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { format } from 'date-fns';
import { TextInput } from 'react-native-gesture-handler';

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
  status: string;
  documents: Array<{
    id: number;
    file_name: string;
    file_type: string;
    file_data: string;
    upload_method: string;
  }>;
}

interface Props {
  onUpdate: () => void;
}

export default function LeaveRequests({ onUpdate }: Props) {
  const { theme } = ThemeContext.useTheme();
  const { token } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'escalate' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchRequests = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/leave-requests`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;

    setSubmitting(true);
    setErrorMessage('');

    try {
      let endpoint = '';
      let payload = {};

      switch (actionType) {
        case 'approve':
          endpoint = `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/leave-requests/${selectedRequest.id}/approve`;
          break;
        case 'reject':
          endpoint = `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/leave-requests/${selectedRequest.id}/reject`;
          payload = { rejection_reason: actionReason };
          break;
        case 'escalate':
          endpoint = `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/leave-requests/${selectedRequest.id}/escalate`;
          payload = { reason: actionReason };
          break;
      }

      await axios.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      await fetchRequests();
      onUpdate();
      setShowActionModal(false);
      setSelectedRequest(null);
      setActionType(null);
      setActionReason('');
    } catch (error: any) {
      console.error('Error processing leave request:', error);
      setErrorMessage(error.response?.data?.error || 'Failed to process request');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return theme === 'dark' ? '#F59E0B' : '#FCD34D';
      case 'approved':
        return theme === 'dark' ? '#10B981' : '#34D399';
      case 'rejected':
        return theme === 'dark' ? '#EF4444' : '#F87171';
      case 'escalated':
        return theme === 'dark' ? '#6366F1' : '#818CF8';
      default:
        return theme === 'dark' ? '#6B7280' : '#9CA3AF';
    }
  };

  const renderActionModal = () => (
    <Modal
      visible={showActionModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowActionModal(false)}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className={`w-11/12 p-6 rounded-lg ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        }`}>
          <Text className={`text-lg font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {actionType === 'approve' ? 'Approve Request' :
             actionType === 'reject' ? 'Reject Request' : 'Escalate Request'}
          </Text>

          {(actionType === 'reject' || actionType === 'escalate') && (
            <View className="mb-4">
              <Text className={`text-sm mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {actionType === 'reject' ? 'Rejection Reason' : 'Escalation Reason'}
              </Text>
              <TextInput
                value={actionReason}
                onChangeText={setActionReason}
                multiline
                numberOfLines={4}
                className={`p-2 rounded-lg border ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                placeholder={`Enter ${actionType === 'reject' ? 'rejection' : 'escalation'} reason`}
              />
            </View>
          )}

          {errorMessage ? (
            <Text className="text-red-500 mb-4">{errorMessage}</Text>
          ) : null}

          <View className="flex-row justify-end space-x-4">
            <TouchableOpacity
              onPress={() => {
                setShowActionModal(false);
                setActionType(null);
                setActionReason('');
                setErrorMessage('');
              }}
              className={`px-4 py-2 rounded-lg ${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
              }`}
            >
              <Text className={
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleAction}
              disabled={submitting || (
                (actionType === 'reject' || actionType === 'escalate') && !actionReason
              )}
              className={`px-4 py-2 rounded-lg ${
                submitting || (
                  (actionType === 'reject' || actionType === 'escalate') && !actionReason
                )
                  ? 'bg-gray-400'
                  : actionType === 'approve'
                    ? 'bg-green-500'
                    : actionType === 'reject'
                      ? 'bg-red-500'
                      : 'bg-blue-500'
              }`}
            >
              {submitting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white font-medium">
                  {actionType === 'approve' ? 'Approve' :
                   actionType === 'reject' ? 'Reject' : 'Escalate'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center py-4">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View>
      <Text className={`text-xl font-semibold mb-4 ${
        theme === 'dark' ? 'text-white' : 'text-gray-900'
      }`}>
        Leave Management
      </Text>

      {requests.length === 0 ? (
        <Text className={`text-center py-4 ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          No leave requests found
        </Text>
      ) : (
        <ScrollView className="space-y-4">
          {requests.map((request) => (
            <View
              key={request.id}
              className={`p-4 rounded-lg ${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
              }`}
            >
              <View className="flex-row justify-between items-start mb-2">
                <View>
                  <Text className={`font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {request.user_name}
                  </Text>
                  <Text className={`text-sm ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {request.employee_number} • {request.department}
                  </Text>
                </View>
                <View className={`px-2 py-1 rounded-full`} style={{
                  backgroundColor: `${getStatusColor(request.status)}20`
                }}>
                  <Text style={{ color: getStatusColor(request.status) }} className="text-sm">
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </Text>
                </View>
              </View>

              <View className="space-y-2 mb-4">
                <Text className={`${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {request.leave_type_name}
                </Text>
                <Text className={`text-sm ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {format(new Date(request.start_date), 'MMM dd, yyyy')} - {format(new Date(request.end_date), 'MMM dd, yyyy')}
                  {' • '}{request.days_requested} day{request.days_requested !== 1 ? 's' : ''}
                </Text>
                <Text className={`text-sm ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {request.reason}
                </Text>
              </View>

              {request.documents.length > 0 && (
                <View className="mb-4">
                  <Text className={`text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Attachments
                  </Text>
                  <View className="flex-row flex-wrap">
                    {request.documents.map((doc) => (
                      <View
                        key={doc.id}
                        className={`mr-2 mb-2 px-3 py-1 rounded-full flex-row items-center ${
                          theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                        }`}
                      >
                        <Ionicons
                          name="document-outline"
                          size={16}
                          color={theme === 'dark' ? '#D1D5DB' : '#4B5563'}
                        />
                        <Text className={`ml-1 text-sm ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {doc.file_name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {request.status === 'pending' && (
                <View className="flex-row space-x-2">
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedRequest(request);
                      setActionType('approve');
                      setShowActionModal(true);
                    }}
                    className="flex-1 bg-green-500 py-2 rounded-lg items-center"
                  >
                    <Text className="text-white font-medium">Approve</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setSelectedRequest(request);
                      setActionType('reject');
                      setShowActionModal(true);
                    }}
                    className="flex-1 bg-red-500 py-2 rounded-lg items-center"
                  >
                    <Text className="text-white font-medium">Reject</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setSelectedRequest(request);
                      setActionType('escalate');
                      setShowActionModal(true);
                    }}
                    className="flex-1 bg-blue-500 py-2 rounded-lg items-center"
                  >
                    <Text className="text-white font-medium">Escalate</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {renderActionModal()}
    </View>
  );
} 