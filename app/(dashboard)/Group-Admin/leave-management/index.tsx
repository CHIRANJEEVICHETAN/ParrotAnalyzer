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
  RefreshControl,
  Modal as RNModal,
} from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import axios from 'axios';
import { format, isWithinInterval, parseISO } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';

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

interface Filters {
  status: 'all' | 'pending' | 'approved' | 'rejected';
  searchQuery: string;
  dateRange: {
    startDate: Date | null;
    endDate: Date | null;
  };
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
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    searchQuery: '',
    dateRange: {
      startDate: null,
      endDate: null,
    },
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'start' | 'end'>('start');

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

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchLeaveRequests();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const filteredRequests = React.useMemo(() => {
    return leaveRequests.filter(request => {
      if (filters.status !== 'all' && request.status !== filters.status) {
        return false;
      }

      const searchLower = filters.searchQuery.toLowerCase();
      if (searchLower && !request.user_name.toLowerCase().includes(searchLower) &&
          !request.employee_number.toLowerCase().includes(searchLower) &&
          !request.department.toLowerCase().includes(searchLower)) {
        return false;
      }

      if (filters.dateRange.startDate && filters.dateRange.endDate) {
        const requestDate = parseISO(request.start_date);
        if (!isWithinInterval(requestDate, {
          start: filters.dateRange.startDate,
          end: filters.dateRange.endDate
        })) {
          return false;
        }
      }

      return true;
    });
  }, [leaveRequests, filters]);

  const renderFilters = () => (
    <View className={`px-4 py-2 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
      <View className="flex-row items-center justify-between mb-2">
        <TextInput
          placeholder="Search requests..."
          placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
          value={filters.searchQuery}
          onChangeText={(text) => setFilters(prev => ({ ...prev, searchQuery: text }))}
          className={`flex-1 mr-2 px-4 py-2 rounded-lg ${
            isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
          }`}
        />
        <TouchableOpacity
          onPress={() => setShowFilters(true)}
          className={`p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
        >
          <Ionicons 
            name="options-outline" 
            size={24} 
            color={isDark ? '#FFFFFF' : '#111827'} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFilterModal = () => (
    <RNModal
      visible={showFilters}
      transparent
      animationType="slide"
      onRequestClose={() => setShowFilters(false)}
    >
      <View className="flex-1 justify-end">
        <View 
          className={`rounded-t-3xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          style={styles.filterModal}
        >
          <View className="p-4">
            <View className="flex-row justify-between items-center mb-6">
              <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Filters
              </Text>
              <TouchableOpacity
                onPress={() => setShowFilters(false)}
                className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
              >
                <Ionicons name="close" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
              </TouchableOpacity>
            </View>

            <View className="mb-6">
              <Text className={`text-base font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Status
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {['all', 'pending', 'approved', 'rejected'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    onPress={() => setFilters(prev => ({ ...prev, status: status as any }))}
                    className={`px-4 py-2 rounded-lg ${
                      filters.status === status
                        ? isDark ? 'bg-blue-600' : 'bg-blue-500'
                        : isDark ? 'bg-gray-700' : 'bg-gray-100'
                    }`}
                  >
                    <Text className={
                      filters.status === status
                        ? 'text-white'
                        : isDark ? 'text-gray-300' : 'text-gray-700'
                    }>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="mb-6">
              <Text className={`text-base font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Date Range
              </Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => {
                    setDatePickerType('start');
                    setShowDatePicker(true);
                  }}
                  className={`flex-1 p-3 rounded-lg border ${
                    isDark ? 'border-gray-700 bg-gray-700' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <Text className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    {filters.dateRange.startDate 
                      ? format(filters.dateRange.startDate, 'MMM dd, yyyy')
                      : 'Start Date'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setDatePickerType('end');
                    setShowDatePicker(true);
                  }}
                  className={`flex-1 p-3 rounded-lg border ${
                    isDark ? 'border-gray-700 bg-gray-700' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <Text className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    {filters.dateRange.endDate 
                      ? format(filters.dateRange.endDate, 'MMM dd, yyyy')
                      : 'End Date'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                setFilters({
                  status: 'all',
                  searchQuery: '',
                  dateRange: { startDate: null, endDate: null }
                });
                setShowFilters(false);
              }}
              className={`p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
            >
              <Text className={`text-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Reset Filters
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </RNModal>
  );

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

      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[isDark ? '#60A5FA' : '#3B82F6']}
            tintColor={isDark ? '#60A5FA' : '#3B82F6'}
            title="Pull to refresh"
            titleColor={isDark ? '#60A5FA' : '#3B82F6'}
          />
        }
      >
        {renderFilters()}
        {loading ? (
          <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
        ) : filteredRequests.length === 0 ? (
          <View className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No leave requests found
            </Text>
          </View>
        ) : (
          filteredRequests.map((request, index) => (
            <View 
              key={request.id} 
              className={`mb-4 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} ${
                index === filteredRequests.length - 1 ? 'mb-4' : ''
              }`}
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

      {renderFilterModal()}

      {showDatePicker && (
        <DateTimePicker
          value={datePickerType === 'start' 
            ? filters.dateRange.startDate || new Date()
            : filters.dateRange.endDate || new Date()
          }
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setFilters(prev => ({
                ...prev,
                dateRange: {
                  ...prev.dateRange,
                  [datePickerType === 'start' ? 'startDate' : 'endDate']: selectedDate
                }
              }));
            }
          }}
        />
      )}
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
  },
  filterModal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  }
}); 