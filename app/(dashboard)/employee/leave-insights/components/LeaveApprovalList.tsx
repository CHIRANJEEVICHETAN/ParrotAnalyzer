import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { useColorScheme } from '../../../../../app/hooks/useColorScheme';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Modal from 'react-native-modal';

interface LeaveApproval {
  request_id: number;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  contact_number: string;
  created_at: string;
  workflow_id: number;
  current_level_id: number;
  approval_status: string;
  employee_name: string;
  employee_number: string;
  department: string;
  leave_type: string;
  requires_documentation: boolean;
  is_paid: boolean;
  requires_all_levels: boolean;
  current_level: string;
  current_level_order: number;
  documents: Array<{
    id: number;
    file_name: string;
    file_type: string;
  }>;
  balance_info: {
    total_days: number;
    used_days: number;
    pending_days: number;
    carry_forward_days: number;
  };
  approval_history: Array<{
    level_id: number;
    status: string;
    comments: string;
    approver_name: string;
    approved_at: string;
  }>;
}

export default function LeaveApprovalList() {
  const isDark = useColorScheme() === 'dark';
  const [approvals, setApprovals] = useState<LeaveApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<LeaveApproval | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-approvals/pending`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      setApprovals(response.data);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching approvals:', error);
      setError(error.response?.data?.error || 'Failed to fetch approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId: number, action: 'approve' | 'reject') => {
    try {
      setProcessingAction(true);
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-approvals/${requestId}/${action}`,
        { comments: approvalComments },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      Alert.alert(
        'Success',
        `Leave request ${action === 'approve' ? 'approved' : 'rejected'} successfully`
      );
      setShowApprovalModal(false);
      setApprovalComments('');
      setSelectedRequest(null);
      fetchApprovals();
    } catch (error: any) {
      console.error('Error processing leave request:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to process leave request'
      );
    } finally {
      setProcessingAction(false);
    }
  };

  const filteredApprovals = useMemo(() => {
    if (!searchQuery) return approvals;

    const query = searchQuery.toLowerCase();
    return approvals.filter(approval => 
      approval.employee_name.toLowerCase().includes(query) ||
      approval.employee_number.toLowerCase().includes(query) ||
      approval.leave_type.toLowerCase().includes(query) ||
      approval.department.toLowerCase().includes(query)
    );
  }, [approvals, searchQuery]);

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
        <Text className={`text-center mb-4 ${isDark ? 'text-red-400' : 'text-red-500'}`}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={fetchApprovals}
          className="bg-blue-500 px-4 py-2 rounded-full"
        >
          <Text className="text-white">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1">
      <View className="p-4">
        {/* Search Bar */}
        <View className={`mb-4 flex-row items-center p-2 rounded-lg ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}>
          <Ionicons 
            name="search" 
            size={20} 
            color={isDark ? '#9CA3AF' : '#6B7280'} 
            style={{ marginRight: 8 }}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by employee name, number, or leave type..."
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            className={isDark ? 'text-white flex-1' : 'text-gray-900 flex-1'}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons 
                name="close-circle" 
                size={20} 
                color={isDark ? '#9CA3AF' : '#6B7280'} 
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Summary Card */}
        <View className={`mb-6 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Pending Approvals
          </Text>
          <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {approvals.length}
          </Text>
        </View>

        {/* Approval List */}
        {filteredApprovals.length === 0 ? (
          <View className={`p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No pending approvals found
            </Text>
          </View>
        ) : (
          filteredApprovals.map((approval) => (
            <View
              key={approval.request_id}
              className={`mb-4 rounded-lg overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            >
              {/* Header */}
              <View className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {approval.employee_name}
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    #{approval.employee_number}
                  </Text>
                </View>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {approval.department} • {approval.leave_type}
                </Text>
              </View>

              {/* Body */}
              <View className="p-4">
                <View className="flex-row justify-between mb-4">
                  <View>
                    <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Start Date
                    </Text>
                    <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {format(new Date(approval.start_date), 'dd MMM yyyy')}
                    </Text>
                  </View>
                  <View>
                    <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      End Date
                    </Text>
                    <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {format(new Date(approval.end_date), 'dd MMM yyyy')}
                    </Text>
                  </View>
                  <View>
                    <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Days
                    </Text>
                    <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {approval.days_requested}
                    </Text>
                  </View>
                </View>

                <View className="mb-4">
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Reason
                  </Text>
                  <Text className={`mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {approval.reason}
                  </Text>
                </View>

                {approval.documents.length > 0 && (
                  <View className="mb-4">
                    <Text className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Documents
                    </Text>
                    {approval.documents.map((doc) => (
                      <View
                        key={doc.id}
                        className={`flex-row items-center p-2 rounded-lg ${
                          isDark ? 'bg-gray-700' : 'bg-gray-100'
                        }`}
                      >
                        <Ionicons
                          name="document"
                          size={16}
                          color={isDark ? '#9CA3AF' : '#6B7280'}
                        />
                        <Text className={`ml-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {doc.file_name}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Balance Info */}
                <View className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <Text className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Leave Balance
                  </Text>
                  <View className="flex-row justify-between">
                    <View>
                      <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Total
                      </Text>
                      <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {approval.balance_info.total_days}
                      </Text>
                    </View>
                    <View>
                      <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Used
                      </Text>
                      <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {approval.balance_info.used_days}
                      </Text>
                    </View>
                    <View>
                      <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Pending
                      </Text>
                      <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {approval.balance_info.pending_days}
                      </Text>
                    </View>
                    <View>
                      <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Carry Forward
                      </Text>
                      <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {approval.balance_info.carry_forward_days}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Approval History */}
                {approval.approval_history.length > 0 && (
                  <View className="mt-4">
                    <Text className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Approval History
                    </Text>
                    {approval.approval_history.map((history, index) => (
                      <View
                        key={index}
                        className={`flex-row items-center justify-between p-2 rounded-lg mb-2 ${
                          isDark ? 'bg-gray-700' : 'bg-gray-100'
                        }`}
                      >
                        <View className="flex-1">
                          <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {history.approver_name}
                          </Text>
                          {history.comments && (
                            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {history.comments}
                            </Text>
                          )}
                        </View>
                        <View className="flex-row items-center">
                          <Ionicons
                            name={history.status === 'approved' ? 'checkmark-circle' : 'close-circle'}
                            size={16}
                            color={history.status === 'approved' ? '#10B981' : '#EF4444'}
                          />
                          <Text className={`ml-1 text-sm ${
                            history.status === 'approved'
                              ? isDark ? 'text-green-400' : 'text-green-600'
                              : isDark ? 'text-red-400' : 'text-red-600'
                          }`}>
                            {history.status.charAt(0).toUpperCase() + history.status.slice(1)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Actions */}
                <View className="flex-row justify-end mt-4 space-x-2">
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedRequest(approval);
                      setShowApprovalModal(true);
                    }}
                    className="bg-green-500 px-4 py-2 rounded-lg"
                  >
                    <Text className="text-white font-medium">
                      Approve
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedRequest(approval);
                      setShowApprovalModal(true);
                    }}
                    className="bg-red-500 px-4 py-2 rounded-lg"
                  >
                    <Text className="text-white font-medium">
                      Reject
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Approval Modal */}
      <Modal
        isVisible={showApprovalModal}
        onBackdropPress={() => {
          if (!processingAction) {
            setShowApprovalModal(false);
            setSelectedRequest(null);
            setApprovalComments('');
          }
        }}
        useNativeDriver
        style={{ margin: 0, justifyContent: 'flex-end' }}
      >
        <View className={`p-4 rounded-t-3xl ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
          <View className="flex-row justify-between items-center mb-4">
            <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Process Leave Request
            </Text>
            {!processingAction && (
              <TouchableOpacity
                onPress={() => {
                  setShowApprovalModal(false);
                  setSelectedRequest(null);
                  setApprovalComments('');
                }}
              >
                <Ionicons 
                  name="close" 
                  size={24} 
                  color={isDark ? '#9CA3AF' : '#6B7280'} 
                />
              </TouchableOpacity>
            )}
          </View>

          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Comments
            </Text>
            <TextInput
              value={approvalComments}
              onChangeText={setApprovalComments}
              placeholder="Add your comments (optional)"
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              multiline
              numberOfLines={3}
              className={`p-3 rounded-lg border ${
                isDark 
                  ? 'bg-gray-800 border-gray-700 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              style={{ textAlignVertical: 'top' }}
              editable={!processingAction}
            />
          </View>

          <View className="flex-row space-x-2">
            <TouchableOpacity
              onPress={() => handleAction(selectedRequest!.request_id, 'approve')}
              disabled={processingAction}
              className={`flex-1 p-3 rounded-lg ${
                processingAction
                  ? isDark ? 'bg-gray-700' : 'bg-gray-300'
                  : 'bg-green-500'
              }`}
            >
              {processingAction ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center font-medium">
                  Approve
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleAction(selectedRequest!.request_id, 'reject')}
              disabled={processingAction}
              className={`flex-1 p-3 rounded-lg ${
                processingAction
                  ? isDark ? 'bg-gray-700' : 'bg-gray-300'
                  : 'bg-red-500'
              }`}
            >
              {processingAction ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center font-medium">
                  Reject
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
} 