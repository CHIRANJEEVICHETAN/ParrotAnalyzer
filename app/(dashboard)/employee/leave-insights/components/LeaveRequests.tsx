import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  RefreshControl,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import RequestLeaveModal from './RequestLeaveModal';
import axios from 'axios';
import { format, parseISO, isWithinInterval, startOfYear, endOfYear } from 'date-fns';
import { Picker } from '@react-native-picker/picker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system';

interface LeaveRequest {
  id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string;
  days_requested: number;
  contact_number: string;
  documents: Array<{
    id: number;
    file_name: string;
    file_type: string;
    file_data: string;
  }>;
  rejection_reason?: string;
}

interface LeaveBalance {
  id: number;
  name: string;
  max_days: number;
  days_used: number;
}

interface LeaveType {
  id: number;
  name: string;
  requires_documentation: boolean;
  max_days: number;
  max_consecutive_days: number;
  notice_period_days: number;
}

// Add this interface for cache structure
interface CacheData {
  requests: LeaveRequest[];
  balances: LeaveBalance[];
  leaveTypes: LeaveType[];
  lastFetched: number;
}

export default function LeaveRequests() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === 'dark';
  
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [expandedRequest, setExpandedRequest] = useState<number | null>(null);
  const [errorModal, setErrorModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'success'
  });
  const [documentLoading, setDocumentLoading] = useState(false);
  const [loadingDocumentId, setLoadingDocumentId] = useState<number | null>(null); // Track loading state for specific document

  // Enhanced cache implementation
  const dataCache = useRef<CacheData>({
    requests: [],
    balances: [],
    leaveTypes: [],
    lastFetched: 0
  });

  // Add cache validation function
  const isCacheValid = (forceRefresh = false): boolean => {
    if (forceRefresh) return false;

    const now = Date.now();
    const cacheAge = now - dataCache.current.lastFetched;
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache duration

    return cacheAge < CACHE_DURATION && 
           dataCache.current.requests.length > 0 &&
           dataCache.current.balances.length > 0 &&
           dataCache.current.leaveTypes.length > 0;
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Enhanced fetchData function
  const fetchData = async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Check cache validity
      if (isCacheValid(isRefreshing)) {
        setRequests(dataCache.current.requests);
        setBalances(dataCache.current.balances);
        setLeaveTypes(dataCache.current.leaveTypes);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [requestsResponse, balanceResponse, typesResponse] = await Promise.all([
        axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/leave/requests`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/leave/balance`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/leave/types`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      ]);

      // Update cache with new data
      dataCache.current = {
        requests: requestsResponse.data,
        balances: balanceResponse.data,
        leaveTypes: typesResponse.data,
        lastFetched: Date.now()
      };

      // Update state with new data
      setRequests(requestsResponse.data);
      setBalances(balanceResponse.data);
      setLeaveTypes(typesResponse.data);

    } catch (error) {
      console.error('Error fetching data:', error);
      // If cache exists, use it as fallback during error
      if (dataCache.current.requests.length > 0) {
        setRequests(dataCache.current.requests);
        setBalances(dataCache.current.balances);
        setLeaveTypes(dataCache.current.leaveTypes);
      } else {
        setErrorModal({
          visible: true,
          title: 'Error',
          message: 'Failed to fetch data. Please try again.',
          type: 'error'
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return { bg: '#34D399', text: '#10B981' }; // Green
      case 'pending':
        return { bg: '#FCD34D', text: '#F59E0B' }; // Yellow
      case 'rejected':
        return { bg: '#F87171', text: '#EF4444' }; // Red
      case 'cancelled':
        return { bg: '#E5E7EB', text: '#6B7280' }; // Gray
      default:
        return { bg: '#9CA3AF', text: '#6B7280' }; // Default
    }
  };

  const filterRequests = () => {
    return requests.filter(request => {
      const matchesStatus = selectedStatus === 'all' || request.status.toLowerCase() === selectedStatus;
      
      let matchesDate = true;
      const requestDate = parseISO(request.start_date);
      
      switch (selectedDateRange) {
        case 'thisYear':
          matchesDate = isWithinInterval(requestDate, {
            start: startOfYear(new Date()),
            end: endOfYear(new Date())
          });
          break;
        case 'lastMonth':
          const lastMonth = new Date();
          lastMonth.setMonth(lastMonth.getMonth() - 1);
          matchesDate = requestDate.getMonth() === lastMonth.getMonth() &&
                       requestDate.getFullYear() === lastMonth.getFullYear();
          break;
        case 'thisMonth':
          const now = new Date();
          matchesDate = requestDate.getMonth() === now.getMonth() &&
                       requestDate.getFullYear() === now.getFullYear();
          break;
      }

      return matchesStatus && matchesDate;
    });
  };

  const toggleRequest = (requestId: number) => {
    setExpandedRequest(expandedRequest === requestId ? null : requestId);
  };

  // Enhanced handleCancelRequest to update cache
  const handleCancelRequest = async (requestId: number) => {
    try {
      setCancellingId(requestId);
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave/cancel/${requestId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update cache with the cancelled request
      const updatedRequests = dataCache.current.requests.map(request => 
        request.id === requestId 
          ? { ...request, status: 'cancelled' }
          : request
      );
      dataCache.current = {
        ...dataCache.current,
        requests: updatedRequests
      };

      setRequests(updatedRequests);
      
      setErrorModal({
        visible: true,
        title: 'Success',
        message: 'Leave request cancelled successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Error cancelling request:', error);
      setErrorModal({
        visible: true,
        title: 'Error',
        message: 'Failed to cancel request. Please try again.',
        type: 'error'
      });
    } finally {
      setCancellingId(null);
    }
  };

  const onRefresh = () => {
    fetchData(true);
  };

  const getDocumentIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return 'image';
    }
    if (fileType === 'application/pdf') {
      return 'document-text';
    }
    return 'document';
  };

  const handleViewDocument = async (document: { id: number; file_name: string; file_type: string }) => {
    setLoadingDocumentId(document.id); // Set loading state for the specific document
    try {
      const response = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/leave/document/${document.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const fetchedDocument = response.data;

      const fileUri = `${FileSystem.cacheDirectory}${fetchedDocument.file_name}`;
      const base64Content = fetchedDocument.file_data;

      await FileSystem.writeAsStringAsync(fileUri, base64Content, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const contentUri = await FileSystem.getContentUriAsync(fileUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: fetchedDocument.file_type,
      });
    } catch (error) {
      console.error('Error fetching or opening document:', error);
      showError('Error', 'Failed to open document. Please try again.', 'error');
    } finally {
      setLoadingDocumentId(null); // Reset loading state
    }
  };

  const showError = (title: string, message: string, type: 'error' | 'warning' | 'success') => {
    setErrorModal({
      visible: true,
      title,
      message,
      type
    });
  };

  // Add cache cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear cache when component unmounts
      dataCache.current = {
        requests: [],
        balances: [],
        leaveTypes: [],
        lastFetched: 0
      };
    };
  }, []);

  return (
    <View className="flex-1">
      {/* Filters with reduced size */}
      <View className="mb-6">
        <Text className={`text-sm font-medium mb-2 ${
          isDark ? 'text-gray-300' : 'text-gray-600'
        }`}>
          Filter Requests
        </Text>
        <View className="flex-row space-x-3 gap-2">
          <View className="flex-1">
            <View className={`flex-row items-center p-1.5 rounded-xl border ${
              isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white'
            }`}>
              <Ionicons 
                name="filter-outline" 
                size={18} 
                color={isDark ? '#9CA3AF' : '#6B7280'} 
                style={{ marginRight: 8, marginLeft: 8 }}
              />
              <Picker
                selectedValue={selectedStatus}
                onValueChange={setSelectedStatus}
                style={{ 
                  flex: 1,
                  color: isDark ? '#FFFFFF' : '#111827',
                  backgroundColor: 'transparent',
                  margin: -8,
                  height: 52,
                }}
              >
                <Picker.Item label="All Status" value="all" style={{ fontSize: 14 }} />
                <Picker.Item label="Pending" value="pending" style={{ fontSize: 14 }} />
                <Picker.Item label="Approved" value="approved" style={{ fontSize: 14 }} />
                <Picker.Item label="Rejected" value="rejected" style={{ fontSize: 14 }} />
                <Picker.Item label="Cancelled" value="cancelled" style={{ fontSize: 14 }} />
              </Picker>
            </View>
          </View>

          <View className="flex-1">
            <View className={`flex-row items-center p-1.5 rounded-xl border ${
              isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white'
            }`}>
              <Ionicons 
                name="calendar-outline" 
                size={18} 
                color={isDark ? '#9CA3AF' : '#6B7280'} 
                style={{ marginRight: 8, marginLeft: 8 }}
              />
              <Picker
                selectedValue={selectedDateRange}
                onValueChange={setSelectedDateRange}
                style={{ 
                  flex: 1,
                  color: isDark ? '#FFFFFF' : '#111827',
                  backgroundColor: 'transparent',
                  margin: -8,
                  height: 52,
                }}
              >
                <Picker.Item label="All Time" value="all" style={{ fontSize: 14 }} />
                <Picker.Item label="This Month" value="thisMonth" style={{ fontSize: 14 }} />
                <Picker.Item label="Last Month" value="lastMonth" style={{ fontSize: 14 }} />
                <Picker.Item label="This Year" value="thisYear" style={{ fontSize: 14 }} />
              </Picker>
            </View>
          </View>
        </View>
      </View>

      {/* Header with Request Button */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <View className={`w-8 h-8 rounded-full items-center justify-center ${
            isDark ? 'bg-blue-500/20' : 'bg-blue-50'
          }`}>
            <Ionicons 
              name="document-text-outline" 
              size={20} 
              color={isDark ? '#60A5FA' : '#2563EB'} 
            />
          </View>
          <Text className={`text-xl font-bold ml-2 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Leave Requests
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowRequestModal(true)}
          disabled={loading}
          className={`py-2.5 px-4 rounded-lg flex-row items-center ${
            isDark ? 'bg-blue-500/20' : 'bg-blue-500'
          } ${loading ? 'opacity-50' : ''}`}
        >
          <Ionicons 
            name="add-circle-outline" 
            size={20} 
            color={isDark ? '#FFFFFF' : '#FFFFFF'} 
          />
          <Text className={`font-semibold ml-1 text-base ${
            isDark ? 'text-white' : 'text-white'
          }`}>
            New Request
          </Text>
        </TouchableOpacity>
      </View>

      {/* Leave Requests List with Pull to Refresh */}
      <ScrollView 
        className="flex-1" 
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3B82F6']}
            tintColor={isDark ? '#FFFFFF' : '#3B82F6'}
          />
        }
      >
        {loading ? (
          <View className="flex-1 justify-center items-center py-8">
            <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#2563EB'} />
          </View>
        ) : filterRequests().length === 0 ? (
          <View className="flex-1 justify-center items-center py-12">
            <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${
              isDark ? 'bg-gray-800' : 'bg-gray-100'
            }`}>
              <Ionicons 
                name="document-text-outline" 
                size={32} 
                color={isDark ? '#4B5563' : '#9CA3AF'} 
              />
            </View>
            <Text className={`text-lg font-medium mb-2 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              No leave requests found
            </Text>
            <Text className={`text-sm ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}>
              Try adjusting your filters or create a new request
            </Text>
          </View>
        ) : (
          <View>
            {filterRequests().map((request, index) => (
              <React.Fragment key={request.id}>
                <View className={`rounded-lg overflow-hidden border ${
                  isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white'
                }`}> 
                  <View className="p-4">
                    <View className="flex-row justify-between items-start mb-4">
                      <View className="flex-row items-center">
                        <Ionicons
                          name={
                            request.status === 'approved'
                              ? 'checkmark-circle'
                              : request.status === 'rejected'
                              ? 'close-circle'
                              : request.status === 'pending'
                              ? 'time'
                              : 'alert-circle'
                          }
                          size={24}
                          color={getStatusColor(request.status).text}
                          style={{ marginRight: 8 }}
                        />
                        <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{request.leave_type}</Text>
                      </View>
                      <View className={`px-3 py-1 rounded-full`} style={{
                        backgroundColor: `${getStatusColor(request.status).bg}20`
                      }}>
                        <Text style={{ color: getStatusColor(request.status).text, fontWeight: '600' }}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Text>
                      </View>
                    </View>

                    <View className="space-y-3">
                      <View className="flex-row items-center">
                        <Ionicons
                          name="calendar-outline"
                          size={18}
                          color={isDark ? '#9CA3AF' : '#6B7280'}
                          style={{ marginRight: 8 }}
                        />
                        <Text className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                          {format(new Date(request.start_date), 'MMM dd, yyyy')} - {format(new Date(request.end_date), 'MMM dd, yyyy')}
                          {' • '}
                          <Text className="font-medium">
                            {request.days_requested} day{request.days_requested !== 1 ? 's' : ''}
                          </Text>
                        </Text>
                      </View>

                      <View className="flex-row items-start">
                        <Ionicons
                          name="document-text-outline"
                          size={18}
                          color={isDark ? '#9CA3AF' : '#6B7280'}
                          style={{ marginRight: 8, marginTop: 2 }}
                        />
                        <Text className={`flex-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{request.reason}</Text>
                      </View>

                      <View className="flex-row items-center">
                        <Ionicons
                          name="call-outline"
                          size={18}
                          color={isDark ? '#9CA3AF' : '#6B7280'}
                          style={{ marginRight: 8 }}
                        />
                        <Text className={isDark ? 'text-gray-300' : 'text-gray-700'}>+91 {request.contact_number}</Text>
                      </View>
                    </View>

                    {request.documents.length > 0 && (
                      <View className="mt-4 pt-4 border-t border-gray-200">
                        <Text className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Attachments</Text>
                        <View className="flex-row flex-wrap">
                          {request.documents.map((doc) => (
                            <View key={doc.id} className="flex-1">
                              {loadingDocumentId === doc.id ? ( // Check if this document is loading
                                <ActivityIndicator size="small" color="#3B82F6" />
                              ) : (
                                <TouchableOpacity
                                  onPress={() => handleViewDocument(doc)}
                                  className={`mr-2 mb-2 px-4 py-2 rounded-lg flex-row items-center ${
                                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                                  }`}
                                >
                                  <Ionicons
                                    name={getDocumentIcon(doc.file_type)}
                                    size={18}
                                    color={isDark ? '#D1D5DB' : '#4B5563'}
                                  />
                                  <Text className={`ml-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{doc.file_name}</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {request.rejection_reason && (
                      <View className="mt-4 p-4 rounded-lg bg-red-50">
                        <View className="flex-row items-start">
                          <Ionicons
                            name="alert-circle"
                            size={20}
                            color="#DC2626"
                            style={{ marginRight: 8, marginTop: 2 }}
                          />
                          <View className="flex-1">
                            <Text className="text-red-800 font-medium mb-1">Rejection Reason</Text>
                            <Text className="text-red-600">{request.rejection_reason}</Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
                {index < filterRequests().length - 1 && <View className="h-4 w-full" />}
              </React.Fragment>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Request Leave Modal */}
      <RequestLeaveModal 
        visible={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        onSuccess={() => {
          fetchData();
          setShowRequestModal(false);
        }}
        leaveTypes={leaveTypes}
        balances={balances}
      />

      {/* Status Modal */}
      <Modal
        visible={errorModal.visible}
        transparent
        animationType="fade"
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className={`w-11/12 p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <View className="items-center mb-4">
              <Ionicons
                name={errorModal.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={48}
                color={errorModal.type === 'success' ? '#10B981' : '#EF4444'}
              />
            </View>
            <Text className={`text-lg font-semibold text-center mb-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              {errorModal.title}
            </Text>
            <Text className={`text-center mb-6 ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {errorModal.message}
            </Text>
            <TouchableOpacity
              onPress={() => setErrorModal(prev => ({ ...prev, visible: false }))}
              className={`py-3 rounded-lg ${
                errorModal.type === 'success' ? 'bg-green-500' : 'bg-red-500'
              }`}
            >
              <Text className="text-white text-center font-medium">
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {documentLoading && (
        <ActivityIndicator size="large" color="#3B82F6" style={{ position: 'absolute', top: '50%', left: '50%' }} />
      )}
    </View>
  );
} 