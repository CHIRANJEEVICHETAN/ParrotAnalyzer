import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import axios from 'axios';

interface LeaveBalance {
  id: number;
  leave_type_name: string;
  leave_type_description: string;
  total_days: number;
  used_days: number;
  pending_days: number;
  is_paid: boolean;
  year: number;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  employee_number: string | null;
}

export default function LeaveBalances() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === 'dark';

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [cachedBalances, setCachedBalances] = useState<{[key: string]: LeaveBalance[]}>({});
  const [showUserModal, setShowUserModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Calculate available years
  const availableYears = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 2;  // 2 years back
    const endYear = currentYear + 2;    // 2 years ahead
    return Array.from(
      { length: endYear - startYear + 1 },
      (_, i) => startYear + i
    );
  }, []);

  // Cache key generator
  const getCacheKey = (userId: string, year: number) => `${userId}-${year}`;

  // Filter users based on search query
  const filteredUsers = React.useMemo(() => {
    if (!searchQuery.trim()) return users;
    
    const query = searchQuery.toLowerCase();
    return users.filter(user => 
      user.name.toLowerCase().includes(query) ||
      (user.employee_number && user.employee_number.toLowerCase().includes(query))
    );
  }, [users, searchQuery]);

  // Group users by role
  const groupedUsers = React.useMemo(() => {
    const groups: { [key: string]: User[] } = {
      management: [],
      'group-admin': [],
      employee: []
    };
    
    filteredUsers.forEach(user => {
      if (groups[user.role]) {
        groups[user.role].push(user);
      }
    });
    
    return groups;
  }, [filteredUsers]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      const cacheKey = getCacheKey(selectedUserId, selectedYear);
      if (cachedBalances[cacheKey]) {
        setBalances(cachedBalances[cacheKey]);
      } else {
        fetchBalances();
      }
    }
  }, [selectedUserId, selectedYear]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/users`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data && response.data.length > 0) {
        setUsers(response.data);
        setSelectedUserId(response.data[0].id.toString());
        setSelectedUser(response.data[0]);
        setError(null);
      } else {
        setError('No users found');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users. Please try again later.');
    }
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setSelectedUserId(user.id.toString());
    setShowUserModal(false);
    setSearchQuery('');
  };

  const renderUserItem = ({ item: user }: { item: User }) => (
    <TouchableOpacity
      onPress={() => handleUserSelect(user)}
      className={`p-4 border-b ${
        isDark ? 'border-gray-700' : 'border-gray-200'
      }`}
    >
      <Text className={`font-medium ${
        isDark ? 'text-white' : 'text-gray-900'
      }`}>
        {user.name} {user.employee_number ? `- ${user.employee_number}` : ''}
      </Text>
      <Text className={`text-sm ${
        isDark ? 'text-gray-400' : 'text-gray-600'
      }`}>
        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
      </Text>
    </TouchableOpacity>
  );

  const fetchBalances = async () => {
    try {
      setLoading(true);
      const cacheKey = getCacheKey(selectedUserId, selectedYear);
      
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/leave-balances/${selectedUserId}?year=${selectedYear}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Update cache and state
      setCachedBalances(prev => ({
        ...prev,
        [cacheKey]: response.data
      }));
      setBalances(response.data);
    } catch (error) {
      console.error('Error fetching leave balances:', error);
      setError('Failed to fetch leave balances');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBalances();
    setRefreshing(false);
  };

  const getProgressColor = (used: number, total: number) => {
    const percentage = (used / total) * 100;
    if (percentage >= 80) return '#EF4444';
    if (percentage >= 50) return '#F59E0B';
    return '#10B981';
  };

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text className={`text-lg text-center mb-4 ${
          isDark ? 'text-gray-400' : 'text-gray-600'
        }`}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={fetchUsers}
          className="bg-blue-500 px-4 py-2 rounded-lg flex-row items-center"
        >
          <Ionicons name="refresh" size={20} color="white" style={{ marginRight: 8 }} />
          <Text className="text-white font-medium">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Header Controls */}
      <View className="mb-6 space-y-4">
        <View className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-sm font-medium mb-2 ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Select Employee
          </Text>
          <TouchableOpacity
            onPress={() => setShowUserModal(true)}
            className={`p-3 border rounded-lg flex-row justify-between items-center ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}
          >
            <Text className={isDark ? 'text-white' : 'text-gray-900'}>
              {selectedUser ? 
                `${selectedUser.name}${selectedUser.employee_number ? ` - ${selectedUser.employee_number}` : ''}` :
                'Select an employee'
              }
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </TouchableOpacity>
        </View>

        <View className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-sm font-medium mb-2 ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Select Year
          </Text>
          <View className={`border rounded-lg overflow-hidden ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {availableYears.map((year) => (
                <TouchableOpacity
                  key={year}
                  onPress={() => setSelectedYear(year)}
                  className={`px-6 py-3 ${
                    selectedYear === year
                      ? isDark
                        ? 'bg-blue-500'
                        : 'bg-blue-500'
                      : 'bg-transparent'
                  }`}
                >
                  <Text className={`${
                    selectedYear === year
                      ? 'text-white font-medium'
                      : isDark
                      ? 'text-gray-300'
                      : 'text-gray-700'
                  }`}>
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>

      {/* User Selection Modal */}
      <Modal
        visible={showUserModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUserModal(false)}
      >
        <View className="flex-1 justify-end">
          <View className={`flex-1 ${
            isDark ? 'bg-black/50' : 'bg-black/30'
          }`}>
            <TouchableOpacity
              className="flex-1"
              onPress={() => setShowUserModal(false)}
            />
          </View>
          <View className={`rounded-t-3xl ${
            isDark ? 'bg-gray-900' : 'bg-white'
          }`}>
            <View className="p-4 border-b border-gray-200">
              <View className="flex-row justify-between items-center mb-4">
                <Text className={`text-xl font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  Select Employee
                </Text>
                <TouchableOpacity
                  onPress={() => setShowUserModal(false)}
                  className="p-2"
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDark ? '#9CA3AF' : '#6B7280'}
                  />
                </TouchableOpacity>
              </View>
              <View className={`flex-row items-center p-2 rounded-lg ${
                isDark ? 'bg-gray-800' : 'bg-gray-100'
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
                  placeholder="Search by name or employee ID"
                  placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                  className={isDark ? 'text-white flex-1' : 'text-gray-900 flex-1'}
                />
              </View>
            </View>
            <FlatList
              data={filteredUsers}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.id.toString()}
              className="max-h-[60vh]"
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </Modal>

      {/* Leave Balances List */}
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
        {balances.map((balance) => (
          <View
            key={balance.id}
            className={`mb-4 p-4 rounded-lg ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1">
                <Text className={`text-lg font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {balance.leave_type_name}
                </Text>
                <Text className={`text-sm mt-1 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {balance.leave_type_description}
                </Text>
              </View>
              <View className={`px-2 py-1 rounded ${
                balance.is_paid ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <Text className={`text-sm ${
                  balance.is_paid ? 'text-green-800' : 'text-red-800'
                }`}>
                  {balance.is_paid ? 'Paid' : 'Unpaid'}
                </Text>
              </View>
            </View>

            {/* Progress Bars */}
            <View className="space-y-3 mt-4">
              {/* Used Days */}
              <View>
                <View className="flex-row justify-between mb-1">
                  <Text className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Used
                  </Text>
                  <Text className={`text-sm font-medium ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {balance.used_days}/{balance.total_days} days
                  </Text>
                </View>
                <View className={`h-2 rounded-full ${
                  isDark ? 'bg-gray-700' : 'bg-gray-200'
                }`}>
                  <View
                    className="h-2 rounded-full"
                    style={{
                      width: `${(balance.used_days / balance.total_days) * 100}%`,
                      backgroundColor: getProgressColor(balance.used_days, balance.total_days)
                    }}
                  />
                </View>
              </View>

              {/* Pending Days */}
              {balance.pending_days > 0 && (
                <View>
                  <View className="flex-row justify-between mb-1">
                    <Text className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Pending
                    </Text>
                    <Text className={`text-sm font-medium ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {balance.pending_days} days
                    </Text>
                  </View>
                  <View className={`h-2 rounded-full ${
                    isDark ? 'bg-gray-700' : 'bg-gray-200'
                  }`}>
                    <View
                      className="h-2 rounded-full bg-yellow-500"
                      style={{
                        width: `${(balance.pending_days / balance.total_days) * 100}%`
                      }}
                    />
                  </View>
                </View>
              )}

              {/* Available Days */}
              <View>
                <View className="flex-row justify-between mb-1">
                  <Text className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Available
                  </Text>
                  <Text className={`text-sm font-medium ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {balance.total_days - balance.used_days - balance.pending_days} days
                  </Text>
                </View>
                <View className={`h-2 rounded-full ${
                  isDark ? 'bg-gray-700' : 'bg-gray-200'
                }`}>
                  <View
                    className="h-2 rounded-full bg-blue-500"
                    style={{
                      width: `${((balance.total_days - balance.used_days - balance.pending_days) / balance.total_days) * 100}%`
                    }}
                  />
                </View>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
} 