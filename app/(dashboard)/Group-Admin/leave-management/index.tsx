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
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import axios from 'axios';
import { format, isWithinInterval, parseISO } from 'date-fns';
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import LeaveTypes from './components/LeaveTypes';
import LeavePolicies from './components/LeavePolicies';
import LeaveBalances from './components/LeaveBalances';
import LeaveApprovals from './components/LeaveApprovals';

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

interface LeaveStats {
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
}

type TabType = 'types' | 'policies' | 'balances' | 'approvals';

interface TabItem {
  id: TabType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export default function GroupAdminLeaveManagement() {
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
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<LeaveStats>({
    pending_requests: 0,
    approved_requests: 0,
    rejected_requests: 0
  });
  const [activeTab, setActiveTab] = useState<TabType>('types');

  const tabs: TabItem[] = [
    {
      id: 'types',
      label: 'Types',
      icon: 'layers-outline',
      activeIcon: 'layers',
      color: '#3B82F6'
    },
    {
      id: 'policies',
      label: 'Policies',
      icon: 'shield-outline',
      activeIcon: 'shield',
      color: '#10B981'
    },
    {
      id: 'balances',
      label: 'Balances',
      icon: 'wallet-outline',
      activeIcon: 'wallet',
      color: '#F59E0B'
    },
    {
      id: 'approvals',
      label: 'Approvals',
      icon: 'checkmark-circle-outline',
      activeIcon: 'checkmark-circle',
      color: '#6366F1'
    }
  ];

  useEffect(() => {
    fetchLeaveRequests();
    fetchStats();
  }, []);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/leave-requests`,
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
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/leave-requests/${id}/${action}`,
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
    await fetchStats(false);
    setRefreshing(false);
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

  const fetchStats = async (useCache = true) => {
    const cacheKey = 'group_admin_leave_stats';
    const cacheExpiry = 5 * 60 * 1000; // 5 minutes

    try {
      if (useCache) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < cacheExpiry) {
            setStats(data);
            setStatsLoading(false);
            return;
          }
        }
      }

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/leave-statistics`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setStats(response.data);
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        data: response.data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error fetching leave stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'types':
        return <LeaveTypes />;
      case 'policies':
        return <LeavePolicies />;
      case 'balances':
        return <LeaveBalances />;
      case 'approvals':
        return <LeaveApprovals />;
      default:
        return null;
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#F9FAFB' }}>
      <StatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
      />

      {/* Header with proper status bar spacing */}
      <LinearGradient
        colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        style={[
          styles.header,
          { paddingTop: Platform.OS === 'ios' ? RNStatusBar.currentHeight || 44 : RNStatusBar.currentHeight || 0 }
        ]}
      >
        <View className="flex-row items-center justify-between px-6 py-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className={`p-2 rounded-full ${isDark ? 'bg-gray-800/80' : 'bg-gray-100'}`}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#E5E7EB' : '#374151'} />
          </TouchableOpacity>
          <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Leave Management
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Enhanced Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="px-4 pb-4"
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              className={`flex-row items-center px-4 py-3 mr-3 rounded-xl ${
                activeTab === tab.id
                  ? isDark
                    ? 'bg-gray-800'
                    : 'bg-white'
                  : isDark
                  ? 'bg-gray-800/50'
                  : 'bg-gray-100'
              }`}
              style={[
                styles.tabButton,
                activeTab === tab.id && {
                  shadowColor: tab.color,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 3.84,
                  elevation: 5
                }
              ]}
            >
              <Ionicons
                name={activeTab === tab.id ? tab.activeIcon : tab.icon}
                size={20}
                color={activeTab === tab.id ? tab.color : isDark ? '#9CA3AF' : '#6B7280'}
                style={{ marginRight: 8 }}
              />
              <Text
                className={`font-medium ${
                  activeTab === tab.id
                    ? isDark
                      ? 'text-white'
                      : 'text-gray-900'
                    : isDark
                    ? 'text-gray-400'
                    : 'text-gray-600'
                }`}
                style={activeTab === tab.id ? { color: tab.color } : {}}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* Content */}
      <ScrollView 
        className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {renderContent()}
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
  backButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  tabButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  filterModal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  }
}); 