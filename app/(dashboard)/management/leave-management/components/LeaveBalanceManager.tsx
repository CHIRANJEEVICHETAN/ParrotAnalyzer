import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '../../../../../app/hooks/useColorScheme';
import Modal from 'react-native-modal';

interface User {
  id: number;
  name: string;
  employee_number: string;
  role: string;
  department?: string;
  email?: string;
  gender?: string;
}

interface LeaveBalance {
  leave_type_id: number;
  leave_type_name: string;
  is_paid: boolean;
  total_days: number;
  used_days: number;
  pending_days: number;
  carry_forward_days: number;
  year: number;
  gender_specific: string | null;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LeaveBalanceManager() {
  const isDark = useColorScheme() === 'dark';
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingBalance, setEditingBalance] = useState<LeaveBalance | null>(null);
  const [newTotalDays, setNewTotalDays] = useState('');
  const [newCarryForwardDays, setNewCarryForwardDays] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  useEffect(() => {
    console.log('Fetching users...');
    fetchUsers().then(() => {
      // Auto-select the first user after fetching
      if (users.length === 0) {
        fetchAndSelectFirstUser();
      }
    });
  }, []);

  const fetchAndSelectFirstUser = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/users`,
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        setUsers(response.data);
        // Auto-select the first user
        setSelectedUser(response.data[0]);
      }
    } catch (error) {
      console.error('Error in auto-selecting first user:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      console.log('Fetching users with token:', token ? 'Token exists' : 'No token');
      
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/users`,
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Users fetched:', response.data.length);
      if (response.data && Array.isArray(response.data)) {
        // Store users and auto-select the first one if none selected
        setUsers(response.data);
        if (!selectedUser && response.data.length > 0) {
          setSelectedUser(response.data[0]);
        }
      } else {
        console.error('Invalid users data format:', response.data);
        Alert.alert('Error', 'Invalid data format received from server');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response:', error.response?.data);
        console.error('Status:', error.response?.status);
      }
      Alert.alert(
        'Error',
        'Failed to fetch users. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUser) {
      console.log('Selected user changed, fetching balances...', selectedUser);
      fetchUserBalances();
    }
  }, [selectedUser, year]);

  const fetchUserBalances = async () => {
    if (!selectedUser) return;
    
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      console.log('Fetching balances for user:', selectedUser);
      
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/user-balances/${selectedUser.id}?year=${year}`,
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Raw balances response:', JSON.stringify(response.data, null, 2));
      if (response.data && Array.isArray(response.data)) {
        // Process the balances to ensure we have all required fields
        const processedBalances = response.data
          .map(balance => ({
            leave_type_id: balance.leave_type_id,
            leave_type_name: balance.leave_type_name,
            is_paid: balance.is_paid,
            total_days: parseInt(balance.total_days) || 0,
            used_days: parseInt(balance.used_days) || 0,
            pending_days: parseInt(balance.pending_days) || 0,
            carry_forward_days: parseInt(balance.carry_forward_days) || 0,
            year: balance.year || year,
            gender_specific: balance.gender_specific
          }));
        
        console.log('Selected user gender:', selectedUser.gender);
        console.log('Processed balances:', JSON.stringify(processedBalances, null, 2));
        setBalances(processedBalances);
      } else {
        console.error('Invalid balance data format:', response.data);
        Alert.alert('Error', 'Invalid balance data format received from server');
      }
    } catch (error) {
      console.error('Error fetching balances:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response:', error.response?.data);
        console.error('Status:', error.response?.status);
      }
      Alert.alert(
        'Error',
        'Failed to fetch leave balances. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Add a retry mechanism for fetching users
  const retryFetchUsers = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        await fetchUsers();
        return; // Success, exit the retry loop
      } catch (error) {
        console.error(`Retry ${i + 1} failed:`, error);
        if (i === retries - 1) {
          Alert.alert(
            'Error',
            'Failed to load employees after multiple attempts. Please check your connection.'
          );
        } else {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
      }
    }
  };

  // Add a function to handle employee selection
  const handleEmployeeSelect = (user: User) => {
    console.log('Selecting employee:', user.name);
    setSelectedUser(user);
    setShowEmployeeModal(false);
    // Immediately fetch balances for the selected user
    fetchUserBalances();
  };

  // Add a refresh function
  const handleRefresh = async () => {
    if (selectedUser) {
      await fetchUserBalances();
    } else {
      await retryFetchUsers();
    }
  };

  // Add function to initialize default balances
  const handleInitializeDefaultBalances = async () => {
    // Add confirmation dialog
    Alert.alert(
      'Initialize Default Leave Balances',
      'This will initialize default leave balances for all users who don\'t have them yet. Existing balances will not be modified. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Initialize',
          onPress: async () => {
            try {
              setLoading(true);
              const token = await AsyncStorage.getItem('auth_token');
              
              const response = await axios.post(
                `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/initialize-default-balances`,
                {},
                { 
                  headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                }
              );

              if (response.data.success) {
                Alert.alert(
                  'Success', 
                  `Successfully initialized leave balances:\n\n` +
                  `• Users Processed: ${response.data.details.users_processed}\n` +
                  `• Leave Types: ${response.data.details.leave_types_processed}\n` +
                  `• Balances Initialized: ${response.data.details.balances_initialized}`
                );
                
                // Refresh current user's balances if one is selected
                if (selectedUser) {
                  await fetchUserBalances();
                }
              } else {
                Alert.alert('Error', response.data.error || 'Failed to initialize default balances');
              }
            } catch (error) {
              console.error('Error initializing default balances:', error);
              Alert.alert(
                'Error', 
                'Failed to initialize default balances. Please try again.\n\n' +
                (error instanceof Error ? error.message : 'Unknown error')
              );
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleUpdateBalance = async () => {
    if (!editingBalance || !selectedUser) return;

    try {
      // Validate inputs
      const totalDays = parseInt(newTotalDays);
      const carryForwardDays = parseInt(newCarryForwardDays);

      if (isNaN(totalDays) || totalDays < 0) {
        Alert.alert('Error', 'Please enter a valid number for total days');
        return;
      }

      if (isNaN(carryForwardDays) || carryForwardDays < 0) {
        Alert.alert('Error', 'Please enter a valid number for carry forward days');
        return;
      }

      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      
      console.log('Updating balance:', {
        userId: selectedUser.id,
        leaveTypeId: editingBalance.leave_type_id,
        totalDays,
        carryForwardDays,
        year
      });

      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/user-balances/${selectedUser.id}`,
        {
          leave_type_id: editingBalance.leave_type_id,
          total_days: totalDays,
          carry_forward_days: carryForwardDays,
          year: year,
        },
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data) {
        console.log('Balance update response:', JSON.stringify(response.data, null, 2));
        
        // Close the modal first
        setShowEditModal(false);
        
        // Immediately update the local state with the new values
        setBalances(prevBalances => 
          prevBalances.map(balance => 
            balance.leave_type_id === editingBalance.leave_type_id
              ? {
                  ...balance,
                  total_days: totalDays,
                  carry_forward_days: carryForwardDays
                }
              : balance
          )
        );
        
        // Then fetch fresh data to ensure we have the latest state
        await fetchUserBalances();
        
        Alert.alert('Success', 'Leave balance updated successfully');
      }
    } catch (error) {
      console.error('Error updating balance:', error);
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error || 'Failed to update leave balance';
        Alert.alert('Error', errorMessage);
      } else {
        Alert.alert('Error', 'Failed to update leave balance');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchQuery.trim() === '' || 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.employee_number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (user.department?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    const matchesRole = !roleFilter || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'employee':
        return { bg: isDark ? 'bg-blue-900' : 'bg-blue-100', text: isDark ? 'text-blue-200' : 'text-blue-800' };
      case 'group_admin':
        return { bg: isDark ? 'bg-purple-900' : 'bg-purple-100', text: isDark ? 'text-purple-200' : 'text-purple-800' };
      case 'management':
        return { bg: isDark ? 'bg-green-900' : 'bg-green-100', text: isDark ? 'text-green-200' : 'text-green-800' };
      default:
        return { bg: isDark ? 'bg-gray-900' : 'bg-gray-100', text: isDark ? 'text-gray-200' : 'text-gray-800' };
    }
  };

  return (
    <View className="flex-1">
      {/* Top Bar with Refresh, Initialize Defaults, and Year Selection */}
      <View className="flex-row justify-between items-center mb-4 px-4">
        {/* Year Selector */}
        <View className="flex-row items-center space-x-2">
          <TouchableOpacity
            onPress={() => setYear(year - 1)}
            className={`p-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          >
            <Ionicons name="chevron-back" size={20} color={isDark ? '#E5E7EB' : '#374151'} />
          </TouchableOpacity>
          <View className={`px-3 py-1 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={isDark ? 'text-white' : 'text-gray-900'}>{year}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setYear(year + 1)}
            className={`p-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          >
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#E5E7EB' : '#374151'} />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View className="flex-row items-center space-x-2">
          {/* Initialize Defaults Button */}
          <TouchableOpacity
            onPress={handleInitializeDefaultBalances}
            disabled={loading}
            className={`flex-row items-center p-2 rounded-lg ${
              loading 
                ? isDark ? 'bg-blue-800' : 'bg-blue-300'
                : isDark ? 'bg-blue-600' : 'bg-blue-500'
            }`}
          >
            <Ionicons 
              name="add-circle-outline" 
              size={20} 
              color="white" 
              style={{ marginRight: 4 }}
            />
            <Text className="text-white">
              Initialize Defaults
            </Text>
          </TouchableOpacity>

          {/* Refresh Button */}
          {loading ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : (
            <TouchableOpacity
              onPress={handleRefresh}
              className={`flex-row items-center ml-2 p-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            >
              <Ionicons 
                name="refresh" 
                size={20} 
                color={isDark ? '#9CA3AF' : '#6B7280'} 
                style={{ marginRight: 4 }}
              />
              <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                Refresh
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Selected Employee Display with gender info */}
      <TouchableOpacity
        onPress={() => setShowEmployeeModal(true)}
        className={`mb-4 mx-4 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
      >
        <View className="flex-row justify-between items-center">
          <View className="flex-1">
            {selectedUser ? (
              <>
                <View className="flex-row items-center">
                  <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {selectedUser.name}
                  </Text>
                  <View className={`ml-2 px-2 py-1 rounded-full ${getRoleBadgeColor(selectedUser.role).bg}`}>
                    <Text className={`text-xs ${getRoleBadgeColor(selectedUser.role).text}`}>
                      {selectedUser.role.replace('_', ' ')}
                    </Text>
                  </View>
                  {selectedUser.gender && (
                    <View className={`ml-2 px-2 py-1 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <Text className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {selectedUser.gender.charAt(0).toUpperCase() + selectedUser.gender.slice(1)}
                      </Text>
                    </View>
                  )}
                </View>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  #{selectedUser.employee_number}
                </Text>
              </>
            ) : (
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Loading employees...
              </Text>
            )}
          </View>
          <View className="flex-row items-center">
            <Text className={`mr-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Change Employee
            </Text>
            <View className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <Ionicons 
                name="chevron-down" 
                size={20} 
                color={isDark ? '#9CA3AF' : '#6B7280'} 
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Balances List */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : selectedUser ? (
        <ScrollView className="px-4">
          {balances.map((balance) => (
            <View
              key={balance.leave_type_id}
              className={`mb-4 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            >
              <View className="flex-row justify-between items-center mb-2">
                <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {balance.leave_type_name}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setEditingBalance(balance);
                    setNewTotalDays(balance.total_days.toString());
                    setNewCarryForwardDays(balance.carry_forward_days.toString());
                    setShowEditModal(true);
                  }}
                  className="p-2 rounded-lg bg-blue-500"
                >
                  <Ionicons name="pencil" size={16} color="white" />
                </TouchableOpacity>
              </View>
              
              <View className="flex-row justify-between mt-2">
                <View>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Total Days
                  </Text>
                  <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {balance.total_days}
                  </Text>
                </View>
                <View>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Used
                  </Text>
                  <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {balance.used_days}
                  </Text>
                </View>
                <View>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Pending
                  </Text>
                  <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {balance.pending_days}
                  </Text>
                </View>
                <View>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Carry Forward
                  </Text>
                  <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {balance.carry_forward_days}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View className="flex-1 justify-center items-center px-4">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className={`mt-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Loading employee data...
          </Text>
        </View>
      )}

      {/* Bottom Sheet Modal for Employee Selection */}
      <Modal
        isVisible={showEmployeeModal}
        onBackdropPress={() => setShowEmployeeModal(false)}
        onSwipeComplete={() => setShowEmployeeModal(false)}
        swipeDirection={['down']}
        useNativeDriver
        style={{
          justifyContent: 'flex-end',
          margin: 0,
        }}
      >
        <View 
          className={`${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
          style={{ maxHeight: SCREEN_HEIGHT * 0.8, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
        >
          {/* Drag Indicator */}
          <View className="items-center pt-2 pb-4">
            <View className={`w-10 h-1 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />
          </View>

          <View className="p-4 border-b border-gray-200 dark:border-gray-700">
            <View className="flex-row justify-between items-center mb-4">
              <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Select Employee
              </Text>
              <TouchableOpacity 
                onPress={() => setShowEmployeeModal(false)}
                className={`p-2 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
              >
                <Ionicons 
                  name="close" 
                  size={24} 
                  color={isDark ? '#9CA3AF' : '#6B7280'} 
                />
              </TouchableOpacity>
            </View>

            {/* Search Bar with Icon */}
            <View className={`mb-4 flex-row items-center p-3 rounded-xl ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}>
              <View className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'} mr-3`}>
                <Ionicons 
                  name="search" 
                  size={20} 
                  color={isDark ? '#9CA3AF' : '#6B7280'} 
                />
              </View>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by name, ID, or department..."
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                className={`flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}
              />
              {searchQuery ? (
                <TouchableOpacity 
                  onPress={() => setSearchQuery('')}
                  className={`p-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
                >
                  <Ionicons 
                    name="close-circle" 
                    size={20} 
                    color={isDark ? '#9CA3AF' : '#6B7280'} 
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Role Filter Pills */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              {['All', 'Employee', 'Group Admin', 'Management'].map((role) => (
                <TouchableOpacity
                  key={role}
                  onPress={() => setRoleFilter(role === 'All' ? null : role.toLowerCase().replace(' ', '-'))}
                  className={`mr-2 px-4 py-2 rounded-full ${
                    (role === 'All' && !roleFilter) || 
                    (roleFilter === role.toLowerCase().replace(' ', '-'))
                      ? 'bg-blue-500'
                      : isDark ? 'bg-gray-800' : 'bg-white'
                  }`}
                >
                  <Text className={
                    (role === 'All' && !roleFilter) || 
                    (roleFilter === role.toLowerCase().replace(' ', '-'))
                      ? 'text-white'
                      : isDark ? 'text-gray-300' : 'text-gray-900'
                  }>
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Employee List with Improved Styling */}
          <ScrollView 
            className="px-4" 
            style={{ maxHeight: SCREEN_HEIGHT * 0.5 }}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View className="py-8">
                <ActivityIndicator size="large" color="#3B82F6" />
              </View>
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  onPress={() => handleEmployeeSelect(user)}
                  className={`mb-3 p-4 rounded-xl ${
                    selectedUser?.id === user.id
                      ? 'bg-blue-500'
                      : isDark ? 'bg-gray-800' : 'bg-white'
                  }`}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 3,
                    elevation: 3,
                  }}
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text className={`text-lg font-semibold ${
                        selectedUser?.id === user.id
                          ? 'text-white'
                          : isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {user.name}
                      </Text>
                      <Text className={`text-sm ${
                        selectedUser?.id === user.id
                          ? 'text-white/70'
                          : isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        #{user.employee_number}
                      </Text>
                      {user.department && (
                        <Text className={`text-sm mt-1 ${
                          selectedUser?.id === user.id
                            ? 'text-white/70'
                            : isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {user.department}
                        </Text>
                      )}
                    </View>
                    <View className={`px-3 py-1 rounded-full ${
                      selectedUser?.id === user.id
                        ? 'bg-white/20'
                        : getRoleBadgeColor(user.role).bg
                    }`}>
                      <Text className={`text-xs font-medium ${
                        selectedUser?.id === user.id
                          ? 'text-white'
                          : getRoleBadgeColor(user.role).text
                      }`}>
                        {user.role.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View className="flex-1 justify-center items-center py-8">
                <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  No employees found
                </Text>
              </View>
            )}
            {/* Add bottom padding for better scrolling */}
            <View className="h-6" />
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Balance Modal */}
      <Modal
        isVisible={showEditModal}
        onBackdropPress={() => setShowEditModal(false)}
        useNativeDriver
        style={{ margin: 0, justifyContent: 'flex-end' }}
      >
        <View className={`p-6 rounded-t-3xl ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
          <Text className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Edit Leave Balance
          </Text>
          
          <View className="mb-4">
            <Text className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Total Days
            </Text>
            <TextInput
              value={newTotalDays}
              onChangeText={setNewTotalDays}
              keyboardType="numeric"
              className={`p-3 rounded-lg border ${
                isDark 
                  ? 'bg-gray-800 border-gray-700 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
          </View>

          <View className="mb-6">
            <Text className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Carry Forward Days
            </Text>
            <TextInput
              value={newCarryForwardDays}
              onChangeText={setNewCarryForwardDays}
              keyboardType="numeric"
              className={`p-3 rounded-lg border ${
                isDark 
                  ? 'bg-gray-800 border-gray-700 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
          </View>

          <View className="flex-row space-x-4">
            <TouchableOpacity
              onPress={() => setShowEditModal(false)}
              className={`flex-1 p-3 rounded-lg ${
                isDark ? 'bg-gray-800' : 'bg-gray-200'
              }`}
            >
              <Text className={`text-center font-medium ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleUpdateBalance}
              className="flex-1 p-3 rounded-lg bg-blue-500"
            >
              <Text className="text-center font-medium text-white">
                Save
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
} 