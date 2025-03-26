import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import axios from 'axios';
import AuthContext from '../../../../context/AuthContext';
import * as IntentLauncher from 'expo-intent-launcher';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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
  requires_documentation: boolean;
  documents: Array<{
    id: number;
    file_name: string;
    file_type: string;
  }>;
}

interface FilterState {
  status: string;
  employee: string;
  leaveType: string;
}

export default function LeaveApprovals() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === 'dark';
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: '',
    employee: '',
    leaveType: ''
  });

  const fetchRequests = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/leave-requests`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      // Filter for only pending requests
      const pendingRequests = response.data.filter((request: LeaveRequest) => request.status === 'pending');
      setRequests(pendingRequests);
      setFilteredRequests(pendingRequests);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    let result = requests;

    if (filters.status) {
      result = result.filter(request => 
        request.status.toLowerCase() === filters.status.toLowerCase()
      );
    }

    if (filters.employee) {
      result = result.filter(request => 
        request.user_name.toLowerCase().includes(filters.employee.toLowerCase()) ||
        request.employee_number.toLowerCase().includes(filters.employee.toLowerCase())
      );
    }

    if (filters.leaveType) {
      result = result.filter(request => 
        request.leave_type_name.toLowerCase().includes(filters.leaveType.toLowerCase())
      );
    }

    setFilteredRequests(result);
  }, [filters, requests]);

  const handleAction = async (requestId: number, action: 'approve' | 'reject' | 'escalate') => {
    setActionLoading(requestId);
    try {
      let response;
      const request = requests.find((req) => req.id === requestId);

      if (!request) {
        throw new Error("Leave request not found");
      }

      if (action === "approve") {
        response = await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/leave-requests/${requestId}/approve`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Send approval notification
        await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-notifications/notify-leave-status`,
          {
            employeeId: request.user_id,
            status: "approved",
            leaveDetails: {
              start_date: request.start_date,
              end_date: request.end_date,
              leave_type_name: request.leave_type_name,
              days_requested: request.days_requested,
            },
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else if (action === "reject") {
        response = await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/leave-requests/${requestId}/reject`,
          { rejection_reason: rejectionReason },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Send rejection notification
        await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-notifications/notify-leave-status`,
          {
            employeeId: request.user_id,
            status: "rejected",
            leaveDetails: {
              start_date: request.start_date,
              end_date: request.end_date,
              leave_type_name: request.leave_type_name,
              days_requested: request.days_requested,
            },
            reason: rejectionReason,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        // Handle escalation
        response = await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/leave-requests/${requestId}/escalate`,
          {
            escalation_reason: escalationReason,
            escalated_to: null, // This will be automatically assigned to a management user in the backend
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Send escalation notification to employee
        await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-notifications/notify-leave-status`,
          {
            employeeId: request.user_id,
            status: "escalated",
            leaveDetails: {
              start_date: request.start_date,
              end_date: request.end_date,
              leave_type_name: request.leave_type_name,
              days_requested: request.days_requested,
            },
            reason: escalationReason,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Send notification to management
        const managementNotificationTitle = `⚠️ Leave Request Escalation Required`;
        const managementNotificationMessage = 
          `A leave request has been escalated for your review.\n\n` +
          `👤 Employee: ${request.user_name} (${request.employee_number})\n` +
          `📝 Leave Type: ${request.leave_type_name}\n` +
          `📅 Period: ${new Date(request.start_date).toLocaleDateString()} to ${new Date(request.end_date).toLocaleDateString()}\n` +
          `⏱️ Duration: ${request.days_requested} day(s)\n` +
          `\n📋 Escalation Reason: ${escalationReason}`;

        await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-notifications/notify-admin`,
          {
            title: managementNotificationTitle,
            message: managementNotificationMessage,
            type: "leave-escalation",
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      if (response.status === 200) {
        await fetchRequests();
        setShowRejectModal(false);
        setShowEscalateModal(false);
        setRejectionReason("");
        setEscalationReason("");

        // Show success message
        Alert.alert(
          "Success",
          `Leave request has been ${action}${
            action === "approve" ? "d" : action === "reject" ? "ed" : "d"
          }`,
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error('Error processing leave request:', error);
      Alert.alert('Error', 'Failed to process leave request. Please try again.');
    } finally {
      setActionLoading(null);
      setSelectedRequest(null);
    }
  };

  const handleViewDocument = async (doc: { file_name: string; file_type: string; id: number }) => {
    try {
      // First fetch the document data
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/document/${doc.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'text'
        }
      );

      // Create a temporary file
      const fileUri = `${FileSystem.cacheDirectory}${doc.file_name}`;
      await FileSystem.writeAsStringAsync(
        fileUri,
        response.data,
        { encoding: FileSystem.EncodingType.Base64 }
      );

      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(fileUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: doc.file_type,
        });
      } else {
        // For iOS, first check if we can share
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            UTI: doc.file_type === 'application/pdf' ? 'com.adobe.pdf' : 'public.item',
            mimeType: doc.file_type,
          });
        } else {
          // Fallback to opening in browser
          await WebBrowser.openBrowserAsync(`file://${fileUri}`);
        }
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      Alert.alert('Error', 'Failed to open document. Please try again.');
    }
  };

  const renderFilter = (
    label: string,
    value: string,
    onChange: (text: string) => void,
    placeholder: string,
    icon: keyof typeof Ionicons.glyphMap
  ) => (
    <View className="mb-4">
      <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
        {label}
      </Text>
      <View className={`flex-row items-center px-4 py-2 rounded-lg ${
        isDark ? 'bg-gray-800' : 'bg-white'
      } border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <Ionicons name={icon} size={20} color={isDark ? '#9CA3AF' : '#6B7280'} style={{ marginRight: 8 }} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
          className={`flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}
        />
      </View>
    </View>
  );

  const renderActionButton = (
    label: string,
    onPress: () => void,
    color: string,
    icon: keyof typeof Ionicons.glyphMap,
    isLoading: boolean
  ) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLoading}
      className={`flex-1 flex-row items-center justify-center p-3 rounded-lg ${color}`}
    >
      {isLoading ? (
        <ActivityIndicator color="white" size="small" style={{ marginRight: 8 }} />
      ) : (
        <Ionicons name={icon} size={20} color="white" style={{ marginRight: 8 }} />
      )}
      <Text className="text-white font-medium">
        {isLoading ? 'Processing...' : label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[isDark ? '#60A5FA' : '#3B82F6']}
            tintColor={isDark ? '#60A5FA' : '#3B82F6'}
          />
        }
      >
        <View className="flex-1">
          {/* Filters */}
          <View className={`p-4 mb-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
            {/* {renderFilter(
              'Status',
              filters.status,
              (text) => setFilters(prev => ({ ...prev, status: text })),
              'Filter by status',
              'flag-outline'
            )} */}
            {renderFilter(
              'Employee',
              filters.employee,
              (text) => setFilters(prev => ({ ...prev, employee: text })),
              'Search by name or employee number',
              'person-outline'
            )}
            {renderFilter(
              'Leave Type',
              filters.leaveType,
              (text) => setFilters(prev => ({ ...prev, leaveType: text })),
              'Filter by leave type',
              'layers-outline'
            )}
          </View>

          {/* Requests List */}
          {filteredRequests.length === 0 ? (
            <View className={`flex-1 justify-center items-center p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>  
              <Ionicons name="checkmark-circle-outline" size={50} color={isDark ? '#60A5FA' : '#3B82F6'} />
              <Text className={`text-lg font-semibold mt-4 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>No Pending Approvals</Text>
              <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-2`}>Currently, there are no pending leave requests from employees awaiting your review.</Text>
              <TouchableOpacity onPress={onRefresh} className="mt-4 p-2 w-1/3 bg-blue-500 rounded-lg flex-row items-center justify-center">
                <Ionicons name="refresh" size={20} color={isDark ? '#E0F2FE' : '#FFFFFF'} />
                <Text className="text-white text-center ml-2">Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredRequests.map((request) => (
              <View
                key={request.id}
                className={`mb-4 p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
              >
                <View className="flex-row justify-between items-start mb-4">
                  <View>
                    <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {request.user_name}
                    </Text>
                    <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {request.employee_number} • {request.department}
                    </Text>
                  </View>
                  <View className={`px-3 py-1 rounded-full ${
                    request.status === 'pending' ? 'bg-yellow-100' :
                    request.status === 'approved' ? 'bg-green-100' :
                    request.status === 'rejected' ? 'bg-red-100' :
                    request.status === 'escalated' ? 'bg-purple-100' : 'bg-gray-100'
                  }`}>
                    <Text className={
                      request.status === 'pending' ? 'text-yellow-800' :
                      request.status === 'approved' ? 'text-green-800' :
                      request.status === 'rejected' ? 'text-red-800' :
                      request.status === 'escalated' ? 'text-purple-800' : 'text-gray-800'
                    }>
                      {request.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View className="mb-4">
                  <Text className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {request.leave_type_name} Leave
                  </Text>
                  <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                  </Text>
                  <Text className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {request.reason}
                  </Text>
                </View>

                {request.documents.length > 0 && (
                  <View className="mb-4">
                    <Text className={`font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Documents
                    </Text>
                    {request.documents.map((doc) => (
                      <TouchableOpacity
                        key={doc.id}
                        onPress={() => handleViewDocument(doc)}
                        className={`flex-row items-center p-2 rounded-lg mb-2 ${
                          isDark ? 'bg-gray-700' : 'bg-gray-100'
                        }`}
                      >
                        <Ionicons 
                          name={doc.file_type.includes('image') ? 'image' : 'document-text'} 
                          size={20} 
                          color={isDark ? '#9CA3AF' : '#6B7280'} 
                        />
                        <Text className={`ml-2 flex-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {doc.file_name}
                        </Text>
                        <Ionicons 
                          name="eye-outline" 
                          size={20} 
                          color={isDark ? '#60A5FA' : '#3B82F6'} 
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {request.status === 'pending' && (
                  <View className="flex-row gap-2 space-x-2">
                    {renderActionButton(
                      'Approve',
                      () => handleAction(request.id, 'approve'),
                      'bg-green-500',
                      'checkmark-circle-outline',
                      actionLoading === request.id
                    )}
                    {renderActionButton(
                      'Reject',
                      () => {
                        setSelectedRequest(request.id);
                        setShowRejectModal(true);
                      },
                      'bg-red-500',
                      'close-circle-outline',
                      actionLoading === request.id
                    )}
                    {renderActionButton(
                      'Escalate',
                      () => {
                        setSelectedRequest(request.id);
                        setShowEscalateModal(true);
                      },
                      'bg-purple-500',
                      'arrow-up-circle-outline',
                      actionLoading === request.id
                    )}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className={`w-11/12 p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Reject Leave Request
            </Text>
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
                onPress={() => setShowRejectModal(false)}
                className="flex-1 p-3 rounded-lg bg-gray-500"
              >
                <Text className="text-white text-center font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => selectedRequest && handleAction(selectedRequest, 'reject')}
                className={`flex-1 p-3 rounded-lg ${actionLoading === selectedRequest ? 'bg-red-400' : 'bg-red-500'}`}
                disabled={!rejectionReason.trim() || actionLoading === selectedRequest}
              >
                {actionLoading === selectedRequest ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-center font-medium">Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Escalate Modal */}
      <Modal
        visible={showEscalateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEscalateModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className={`w-11/12 p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Escalate to Management
            </Text>
            <TextInput
              value={escalationReason}
              onChangeText={setEscalationReason}
              placeholder="Enter reason for escalation"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              className={`p-3 rounded-lg mb-4 ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}
              multiline
            />
            <View className="flex-row space-x-2 gap-2">
              <TouchableOpacity
                onPress={() => setShowEscalateModal(false)}
                className="flex-1 p-3 rounded-lg bg-gray-500"
              >
                <Text className="text-white text-center font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => selectedRequest && handleAction(selectedRequest, 'escalate')}
                className={`flex-1 p-3 rounded-lg ${actionLoading === selectedRequest ? 'bg-purple-400' : 'bg-purple-500'}`}
                disabled={!escalationReason.trim() || actionLoading === selectedRequest}
              >
                {actionLoading === selectedRequest ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-center font-medium">Escalate</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
} 