import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  StatusBar,
} from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import axios from 'axios';

interface LeaveRequest {
  id: number;
  user_name: string;
  employee_number: string;
  department: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
}

export default function LeaveManagement() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/admin/leave-requests`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setLeaveRequests(response.data);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      Alert.alert('Error', 'Failed to fetch leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: number, action: 'approve' | 'reject', rejectionReason?: string) => {
    try {
      setActionLoading(id);
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/admin/leave-requests/${id}/${action}`,
        { rejectionReason },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      Alert.alert('Success', `Leave request ${action}ed successfully`);
      fetchLeaveRequests();
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedRequest(null);
    } catch (error) {
      console.error('Error updating leave request:', error);
      Alert.alert('Error', `Failed to ${action} leave request`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#F3F4F6' }}>
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* Header */}
      <View 
        className={`${isDark ? 'bg-gray-800' : 'bg-white'}`}
        style={styles.header}
      >
        <View className="flex-row items-center justify-between px-4 pt-3 pb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
            style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}
          >
            <Ionicons 
              name="arrow-back" 
              size={24} 
              color={isDark ? '#FFFFFF' : '#111827'} 
            />
          </TouchableOpacity>
          <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
            <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Leave Requests
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {loading ? (
          <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
        ) : leaveRequests.length === 0 ? (
          <View className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No leave requests found
            </Text>
          </View>
        ) : (
          leaveRequests.map((request) => (
            <View 
              key={request.id} 
              className={`mb-4 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              style={styles.card}
            >
              <View className="flex-row justify-between items-start mb-2">
                <View>
                  <Text className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {request.user_name}
                  </Text>
                  <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {request.employee_number} • {request.department}
                  </Text>
                </View>
                <View className={`px-3 py-1 rounded-full ${
                  request.status === 'pending' ? 'bg-yellow-100' :
                  request.status === 'approved' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <Text className={
                    request.status === 'pending' ? 'text-yellow-800' :
                    request.status === 'approved' ? 'text-green-800' : 'text-red-800'
                  }>
                    {request.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View className="mb-4">
                <Text className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {request.leave_type} Leave
                </Text>
                <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                </Text>
                <Text className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {request.reason}
                </Text>
              </View>

              {request.status === 'pending' && (
                <View className="flex-row space-x-2 gap-3">
                  <TouchableOpacity
                    onPress={() => handleAction(request.id, 'approve')}
                    disabled={actionLoading === request.id}
                    className={`flex-1 bg-green-500 p-2 rounded-lg ${
                      actionLoading === request.id ? 'opacity-70' : ''
                    }`}
                  >
                    {actionLoading === request.id ? (
                      <View className="flex-row items-center justify-center">
                        <ActivityIndicator color="white" size="small" style={{ marginRight: 8 }} />
                        <Text className="text-white text-center font-medium">
                          Approving...
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-white text-center font-medium">Approve</Text>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedRequest(request.id);
                      setShowRejectModal(true);
                    }}
                    disabled={actionLoading === request.id}
                    className={`flex-1 bg-red-500 p-2 rounded-lg ${
                      actionLoading === request.id ? 'opacity-70' : ''
                    }`}
                  >
                    {actionLoading === request.id ? (
                      <View className="flex-row items-center justify-center">
                        <ActivityIndicator color="white" size="small" style={{ marginRight: 8 }} />
                        <Text className="text-white text-center font-medium">
                          Rejecting...
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-white text-center font-medium">Reject</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Reject Modal */}
      <Modal
        isVisible={showRejectModal}
        backdropOpacity={0.5}
        onBackdropPress={() => {
          setShowRejectModal(false);
          setRejectionReason('');
          setSelectedRequest(null);
        }}
        style={{ margin: 0 }}
      >
        <View className={`m-4 p-6 rounded-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Reject Leave Request
          </Text>
          <TextInput
            value={rejectionReason}
            onChangeText={setRejectionReason}
            placeholder="Enter reason for rejection"
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            multiline
            numberOfLines={4}
            className={`p-3 rounded-lg border mb-4 ${
              isDark 
                ? 'border-gray-700 bg-gray-700 text-white' 
                : 'border-gray-200 bg-gray-50 text-gray-900'
            }`}
            textAlignVertical="top"
          />
          <View className="flex-row space-x-2">
            <TouchableOpacity
              onPress={() => {
                setShowRejectModal(false);
                setRejectionReason('');
                setSelectedRequest(null);
              }}
              className="flex-1 bg-gray-500 p-3 rounded-lg"
            >
              <Text className="text-white text-center font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (rejectionReason.trim() && selectedRequest) {
                  handleAction(selectedRequest, 'reject', rejectionReason.trim());
                } else {
                  Alert.alert('Error', 'Please provide a reason for rejection');
                }
              }}
              className="flex-1 bg-red-500 p-3 rounded-lg"
            >
              <Text className="text-white text-center font-medium">Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  }
}); 