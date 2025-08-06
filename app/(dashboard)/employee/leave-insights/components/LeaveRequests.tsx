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
import { format, isWithinInterval, parseISO } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import RequestLeaveModal from './RequestLeaveModal';
import Modal from 'react-native-modal';

interface LeaveRequest {
  id: number;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  contact_number: string;
  created_at: string;
  rejection_reason?: string;
  leave_type: string;
  requires_documentation: boolean;
  is_paid: boolean;
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
  workflow_id: number;
  current_level: string;
  current_level_order: number;
  approval_history: Array<{
    level_id: number;
    status: string;
    comments: string;
    approver_name: string;
    approved_at: string;
  }>;
}

type SortField = 'created_at' | 'start_date' | 'days_requested';
type SortOrder = 'asc' | 'desc';

export default function LeaveRequests() {
  const isDark = useColorScheme() === 'dark';
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [dateRange, setDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({ start: null, end: null });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    field: SortField;
    order: SortOrder;
  }>({ field: 'created_at', order: 'desc' });
  
  // RequestLeaveModal props
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);

  useEffect(() => {
    fetchRequests();
    fetchLeaveTypes();
    fetchBalances();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave/requests`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      setRequests(response.data);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching leave requests:', error);
      setError(error.response?.data?.error || 'Failed to fetch leave requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/leave-types`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.data && Array.isArray(response.data)) {
        const transformedLeaveTypes = response.data.map((type: any) => ({
          id: type.leave_type_id,
          name: type.leave_type_name,
          requires_documentation: type.requires_documentation || false,
          max_days: type.max_days || 0,
          max_consecutive_days: type.max_days || 30,
          notice_period_days: 0, // Default value
        }));
        setLeaveTypes(transformedLeaveTypes);
      }
    } catch (error) {
      console.error('Error fetching leave types:', error);
    }
  };

  const fetchBalances = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave/balance?year=${new Date().getFullYear()}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.data && Array.isArray(response.data)) {
        const transformedBalances = response.data.map((balance: any) => ({
          id: balance.leave_type_id,
          name: balance.leave_type_name,
          max_days: balance.total_days || 0,
          days_used: balance.used_days || 0,
        }));
        setBalances(transformedBalances);
      }
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  const handleCancel = async (requestId: number) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave/cancel/${requestId}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Leave request cancelled successfully');
      fetchRequests();
    } catch (error: any) {
      console.error('Error cancelling leave request:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to cancel leave request'
      );
    }
  };

  const handleRequestSubmit = () => {
    setShowRequestForm(false);
    fetchRequests();
  };

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleDateChange = (event: any, selectedDate: Date | undefined, isStart: boolean) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
      setShowEndPicker(false);
    }

    if (selectedDate) {
      setDateRange(prev => ({
        ...prev,
        [isStart ? 'start' : 'end']: selectedDate
      }));
    }
  };

  const clearFilters = () => {
    setSelectedStatus('all');
    setSearchQuery('');
    setDateRange({ start: null, end: null });
    setSortConfig({ field: 'created_at', order: 'desc' });
  };

  const filteredAndSortedRequests = useMemo(() => {
    let filtered = [...requests];

    // Status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(request => request.status === selectedStatus);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(request => 
        request.leave_type.toLowerCase().includes(query) ||
        request.reason.toLowerCase().includes(query)
      );
    }

    // Date range filter
    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter(request => {
        const requestDate = parseISO(request.start_date);
        const startDate = dateRange.start;
        const endDate = dateRange.end;
        if (startDate && endDate) {
          return isWithinInterval(requestDate, { start: startDate, end: endDate });
        }
        return true;
      });
    }

    // Sort
    return filtered.sort((a, b) => {
      const aValue = a[sortConfig.field];
      const bValue = b[sortConfig.field];
      
      if (sortConfig.field === 'created_at' || sortConfig.field === 'start_date') {
        const dateA = new Date(aValue);
        const dateB = new Date(bValue);
        return sortConfig.order === 'asc' 
          ? dateA.getTime() - dateB.getTime()
          : dateB.getTime() - dateA.getTime();
      }
      
      return sortConfig.order === 'asc'
        ? (aValue > bValue ? 1 : -1)
        : (bValue > aValue ? 1 : -1);
    });
  }, [requests, selectedStatus, searchQuery, dateRange, sortConfig]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return isDark ? 'text-green-400' : 'text-green-600';
      case 'rejected':
        return isDark ? 'text-red-400' : 'text-red-600';
      case 'cancelled':
        return isDark ? 'text-gray-400' : 'text-gray-600';
      default:
        return isDark ? 'text-yellow-400' : 'text-yellow-600';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'approved':
        return isDark ? 'bg-green-900' : 'bg-green-100';
      case 'rejected':
        return isDark ? 'bg-red-900' : 'bg-red-100';
      case 'cancelled':
        return isDark ? 'bg-gray-800' : 'bg-gray-100';
      default:
        return isDark ? 'bg-yellow-900' : 'bg-yellow-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return 'checkmark-circle';
      case 'rejected':
        return 'close-circle';
      case 'cancelled':
        return 'ban';
      default:
        return 'time';
    }
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
        <Text className={`text-center mb-4 ${isDark ? 'text-red-400' : 'text-red-500'}`}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={fetchRequests}
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
            placeholder="Search leave requests..."
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
          <TouchableOpacity 
            onPress={() => setShowFilterModal(true)}
            className="ml-2 p-1"
          >
            <Ionicons 
              name="filter" 
              size={20} 
              color={isDark ? '#9CA3AF' : '#6B7280'} 
            />
          </TouchableOpacity>
        </View>

        {/* Summary Cards and New Request Button - All on same line */}
        <View className="flex-row items-center justify-between mb-6">
          {/* Total Requests Card */}
          <View className={`flex-1 mr-2 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Total Requests
            </Text>
            <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {requests.length}
            </Text>
          </View>

          {/* Pending Requests Card */}
          <View className={`flex-1 mr-2 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Pending Requests
            </Text>
            <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {requests.filter(r => r.status === 'pending').length}
            </Text>
          </View>

          {/* New Request Button */}
          <TouchableOpacity
            onPress={() => setShowRequestForm(true)}
            className={`p-3 rounded-lg flex-row items-center justify-center ${
              isDark ? 'bg-blue-600' : 'bg-blue-500'
            }`}
            style={{ minWidth: 100 }}
          >
            <Ionicons 
              name="add-circle-outline" 
              size={20} 
              color="white" 
              style={{ marginRight: 4 }}
            />
            <Text className="text-white font-medium text-sm">
              New Request
            </Text>
          </TouchableOpacity>
        </View>

        {/* Leave Request Form Modal */}
        <RequestLeaveModal
          visible={showRequestForm}
          onClose={() => setShowRequestForm(false)}
          onSuccess={handleRequestSubmit}
          leaveTypes={leaveTypes}
          balances={balances}
        />

        {/* Filter Modal */}
        <Modal
          isVisible={showFilterModal}
          onBackdropPress={() => setShowFilterModal(false)}
          useNativeDriver
          style={{ margin: 0, justifyContent: 'flex-end' }}
        >
          <View className={`rounded-t-3xl ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <View className="p-6">
              {/* Modal Header */}
              <View className="flex-row justify-between items-center mb-6">
                <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Filters
                </Text>
                <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                  <Ionicons 
                    name="close" 
                    size={24} 
                    color={isDark ? '#9CA3AF' : '#6B7280'} 
                  />
                </TouchableOpacity>
              </View>

              {/* Date Range Filters */}
              <View className="mb-6">
                <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Date Range
                </Text>
                <View className="flex-row justify-between">
                  <TouchableOpacity
                    onPress={() => setShowStartPicker(true)}
                    className={`flex-1 mr-2 p-3 rounded-lg ${
                      isDark ? 'bg-gray-800' : 'bg-white'
                    }`}
                  >
                    <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      From
                    </Text>
                    <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                      {dateRange.start ? format(dateRange.start, 'dd MMM yyyy') : 'Select date'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setShowEndPicker(true)}
                    className={`flex-1 p-3 rounded-lg ${
                      isDark ? 'bg-gray-800' : 'bg-white'
                    }`}
                  >
                    <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      To
                    </Text>
                    <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                      {dateRange.end ? format(dateRange.end, 'dd MMM yyyy') : 'Select date'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Status Filter */}
              <View className="mb-6">
                <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Status
                </Text>
                <View className="flex-row flex-wrap">
                  {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      onPress={() => setSelectedStatus(status)}
                      className={`mr-2 mb-2 px-4 py-2 rounded-full ${
                        selectedStatus === status
                          ? 'bg-blue-500'
                          : isDark ? 'bg-gray-700' : 'bg-gray-200'
                      }`}
                    >
                      <Text
                        className={
                          selectedStatus === status
                            ? 'text-white'
                            : isDark ? 'text-gray-300' : 'text-gray-700'
                        }
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Sort Options */}
              <View className="mb-6">
                <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Sort By
                </Text>
                <View className="flex-row flex-wrap">
                  <TouchableOpacity
                    onPress={() => handleSort('created_at')}
                    className={`mr-2 mb-2 px-4 py-2 rounded-lg ${
                      sortConfig.field === 'created_at'
                        ? 'bg-blue-500'
                        : isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}
                  >
                    <Text className={
                      sortConfig.field === 'created_at'
                        ? 'text-white'
                        : isDark ? 'text-gray-300' : 'text-gray-700'
                    }>
                      Date {sortConfig.field === 'created_at' && (sortConfig.order === 'asc' ? '↑' : '↓')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleSort('days_requested')}
                    className={`mr-2 mb-2 px-4 py-2 rounded-lg ${
                      sortConfig.field === 'days_requested'
                        ? 'bg-blue-500'
                        : isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}
                  >
                    <Text className={
                      sortConfig.field === 'days_requested'
                        ? 'text-white'
                        : isDark ? 'text-gray-300' : 'text-gray-700'
                    }>
                      Days {sortConfig.field === 'days_requested' && (sortConfig.order === 'asc' ? '↑' : '↓')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row justify-between">
                <TouchableOpacity
                  onPress={() => {
                    clearFilters();
                    setShowFilterModal(false);
                  }}
                  className={`flex-1 mr-2 p-3 rounded-lg ${
                    isDark ? 'bg-gray-700' : 'bg-gray-200'
                  }`}
                >
                  <Text className={`text-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Clear All
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowFilterModal(false)}
                  className={`flex-1 p-3 rounded-lg ${
                    isDark ? 'bg-blue-600' : 'bg-blue-500'
                  }`}
                >
                  <Text className="text-white text-center font-medium">
                    Apply Filters
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Date Pickers */}
        {(showStartPicker || showEndPicker) && (
          <DateTimePicker
            value={showStartPicker ? (dateRange.start || new Date()) : (dateRange.end || new Date())}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => 
              handleDateChange(event, date, showStartPicker)
            }
          />
        )}

        {/* Request List */}
        {filteredAndSortedRequests.length === 0 ? (
          <View className={`p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No leave requests found
            </Text>
          </View>
        ) : (
          filteredAndSortedRequests.map((request) => (
            <View
              key={request.id}
              className={`mb-4 rounded-lg overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            >
              {/* Header */}
              <View className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {request.leave_type}
                  </Text>
                  <View className={`px-3 py-1 rounded-full flex-row items-center ${getStatusBgColor(request.status)}`}>
                    <Ionicons
                      name={getStatusIcon(request.status)}
                      size={16}
                      color={isDark ? '#9CA3AF' : '#6B7280'}
                      style={{ marginRight: 4 }}
                    />
                    <Text className={getStatusColor(request.status)}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {format(new Date(request.created_at), 'dd MMM yyyy')}
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
                      {format(new Date(request.start_date), 'dd MMM yyyy')}
                    </Text>
                  </View>
                  <View>
                    <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      End Date
                    </Text>
                    <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {format(new Date(request.end_date), 'dd MMM yyyy')}
                    </Text>
                  </View>
                  <View>
                    <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Days
                    </Text>
                    <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {request.days_requested}
                    </Text>
                  </View>
                </View>

                <View className="mb-4">
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Reason
                  </Text>
                  <Text className={`mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {request.reason}
                  </Text>
                </View>

                {request.rejection_reason && (
                  <View className="mb-4">
                    <Text className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                      Rejection Reason
                    </Text>
                    <Text className={`mt-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                      {request.rejection_reason}
                    </Text>
                  </View>
                )}

                {/* Approval Status */}
                {request.status === 'pending' && (
                  <View className="mb-4">
                    <Text className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Approval Status
                    </Text>
                    <View className={`p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Pending approval from {request.current_level}
                      </Text>
                      <Text className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Level {request.current_level_order} of {request.approval_history.length + 1}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Approval History */}
                {request.approval_history.length > 0 && (
                  <View className="mb-4">
                    <Text className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Approval History
                    </Text>
                    {request.approval_history.map((history, index) => (
                      <View
                        key={index}
                        className={`flex-row items-center justify-between p-3 rounded-lg mb-2 ${
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

                {request.documents.length > 0 && (
                  <View className="mb-4">
                    <Text className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Documents
                    </Text>
                    {request.documents.map((doc) => (
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
                    Leave Balance at Time of Request
                  </Text>
                  <View className="flex-row justify-between">
                    <View>
                      <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Total
                      </Text>
                      <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {request.balance_info.total_days}
                      </Text>
                    </View>
                    <View>
                      <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Used
                      </Text>
                      <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {request.balance_info.used_days}
                      </Text>
                    </View>
                    <View>
                      <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Pending
                      </Text>
                      <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {request.balance_info.pending_days}
                      </Text>
                    </View>
                    <View>
                      <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Carry Forward
                      </Text>
                      <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {request.balance_info.carry_forward_days}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Actions */}
                {request.status === 'pending' && (
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Cancel Request',
                        'Are you sure you want to cancel this leave request?',
                        [
                          { text: 'No', style: 'cancel' },
                          { 
                            text: 'Yes', 
                            style: 'destructive',
                            onPress: () => handleCancel(request.id)
                          }
                        ]
                      );
                    }}
                    className="mt-4 p-3 rounded-lg bg-red-500"
                  >
                    <Text className="text-white text-center font-medium">
                      Cancel Request
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
} 