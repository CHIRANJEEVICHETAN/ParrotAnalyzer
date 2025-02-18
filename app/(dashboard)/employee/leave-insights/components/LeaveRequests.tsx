import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import RequestLeaveModal from './RequestLeaveModal';
import axios from 'axios';
import { format, parseISO, isWithinInterval, startOfYear, endOfYear } from 'date-fns';
import { Picker } from '@react-native-picker/picker';

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
  }>;
}

interface LeaveBalance {
  id: number;
  name: string;
  max_days: number;
  days_used: number;
}

export default function LeaveRequests() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === 'dark';
  
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [expandedRequest, setExpandedRequest] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [requestsResponse, balanceResponse] = await Promise.all([
        axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/leave/requests`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/leave/balance`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      ]);

      setRequests(requestsResponse.data);
      setBalances(balanceResponse.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return { bg: 'bg-green-100', text: 'text-green-800' };
      case 'pending':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
      case 'rejected':
        return { bg: 'bg-red-100', text: 'text-red-800' };
      case 'cancelled':
        return { bg: 'bg-gray-100', text: 'text-gray-800' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800' };
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

  const handleCancelRequest = async (requestId: number) => {
    try {
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave/cancel/${requestId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchData();
    } catch (error) {
      console.error('Error cancelling request:', error);
    }
  };

  return (
    <View className="flex-1">
      {/* Header with Request Button */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <Ionicons 
            name="document-text-outline" 
            size={24} 
            color={isDark ? '#FFFFFF' : '#111827'} 
          />
          <Text className={`text-xl font-bold ml-2 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Leave Requests
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowRequestModal(true)}
          className="bg-blue-500 py-2 px-4 rounded-lg flex-row items-center"
        >
          <Ionicons name="add-circle-outline" size={20} color="white" />
          <Text className="text-white font-semibold ml-1">
            New Request
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View className="flex-row mb-4 space-x-2">
        <View className={`flex-1 rounded-lg overflow-hidden border ${
          isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
        }`}>
          <Picker
            selectedValue={selectedStatus}
            onValueChange={setSelectedStatus}
            style={{ 
              color: isDark ? '#FFFFFF' : '#111827',
              backgroundColor: 'transparent'
            }}
          >
            <Picker.Item label="All Status" value="all" />
            <Picker.Item label="Pending" value="pending" />
            <Picker.Item label="Approved" value="approved" />
            <Picker.Item label="Rejected" value="rejected" />
            <Picker.Item label="Cancelled" value="cancelled" />
          </Picker>
        </View>

        <View className={`flex-1 rounded-lg overflow-hidden border ${
          isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
        }`}>
          <Picker
            selectedValue={selectedDateRange}
            onValueChange={setSelectedDateRange}
            style={{ 
              color: isDark ? '#FFFFFF' : '#111827',
              backgroundColor: 'transparent'
            }}
          >
            <Picker.Item label="All Time" value="all" />
            <Picker.Item label="This Month" value="thisMonth" />
            <Picker.Item label="Last Month" value="lastMonth" />
            <Picker.Item label="This Year" value="thisYear" />
          </Picker>
        </View>
      </View>

      {/* Leave Requests List */}
      <ScrollView className="flex-1">
        {loading ? (
          <View className="flex-1 justify-center items-center py-8">
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : filterRequests().length === 0 ? (
          <View className="flex-1 justify-center items-center py-8">
            <Ionicons 
              name="document-text-outline" 
              size={48} 
              color={isDark ? '#4B5563' : '#9CA3AF'} 
            />
            <Text className={`mt-4 text-lg ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              No leave requests found
            </Text>
          </View>
        ) : (
          filterRequests().map(request => (
            <TouchableOpacity
              key={request.id}
              onPress={() => toggleRequest(request.id)}
              className={`mb-4 rounded-lg overflow-hidden border ${
                isDark 
                  ? 'border-gray-700 bg-gray-800' 
                  : 'border-gray-200 bg-white'
              }`}
            >
              <View className="p-4">
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className={`text-lg font-semibold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {request.leave_type}
                    </Text>
                    <Text className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                      {format(new Date(request.start_date), 'MMM dd')} - {format(new Date(request.end_date), 'MMM dd, yyyy')}
                    </Text>
                  </View>
                  <View className={`px-3 py-1 rounded-full ${getStatusColor(request.status).bg}`}>
                    <Text className={getStatusColor(request.status).text}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Text>
                  </View>
                </View>

                {expandedRequest === request.id && (
                  <View className="mt-4 space-y-3 pt-4 border-t border-gray-200">
                    <View className="flex-row">
                      <View className="w-32">
                        <Text className={`font-medium ${
                          isDark ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          Days Requested:
                        </Text>
                      </View>
                      <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                        {request.days_requested} days
                      </Text>
                    </View>

                    <View className="flex-row">
                      <View className="w-32">
                        <Text className={`font-medium ${
                          isDark ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          Reason:
                        </Text>
                      </View>
                      <Text className={`flex-1 ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {request.reason}
                      </Text>
                    </View>

                    <View className="flex-row">
                      <View className="w-32">
                        <Text className={`font-medium ${
                          isDark ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          Contact:
                        </Text>
                      </View>
                      <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                        {request.contact_number}
                      </Text>
                    </View>
                    
                    {request.documents && request.documents.length > 0 && (
                      <View className="mt-2">
                        <Text className={`font-medium mb-2 ${
                          isDark ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          Attachments:
                        </Text>
                        <View className="space-y-1">
                          {request.documents.map(doc => (
                            <View 
                              key={doc.id} 
                              className={`flex-row items-center p-2 rounded ${
                                isDark ? 'bg-gray-700' : 'bg-gray-50'
                              }`}
                            >
                              <Ionicons 
                                name="document-outline" 
                                size={16} 
                                color={isDark ? '#9CA3AF' : '#6B7280'} 
                              />
                              <Text className={`ml-2 ${
                                isDark ? 'text-gray-300' : 'text-gray-600'
                              }`}>
                                {doc.file_name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {request.status === 'pending' && (
                      <TouchableOpacity
                        onPress={() => handleCancelRequest(request.id)}
                        className="mt-4 py-2 px-4 bg-red-100 rounded-lg flex-row items-center justify-center"
                      >
                        <Ionicons name="close-circle-outline" size={20} color="#991B1B" />
                        <Text className="text-red-800 font-medium ml-2">
                          Cancel Request
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
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
      />
    </View>
  );
} 