import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert, StatusBar, RefreshControl, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import axios from 'axios';
import BottomNav from '../../../components/BottomNav';
import { groupAdminNavItems } from '../utils/navigationItems';

interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

interface LoadingToggles {
  [key: number]: boolean;
}

export default function EmployeeManagement() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingToggles, setLoadingToggles] = useState<LoadingToggles>({});

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/employees`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEmployees(response.data);
    } catch (error: any) {
      console.error('Error fetching employees:', error);
      setError(error.response?.data?.error || 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (id: number) => {
    Alert.alert(
      'Delete Employee',
      'Are you sure you want to delete this employee?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(
                `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/employees/${id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              setEmployees(prev => prev.filter(emp => emp.id !== id));
            } catch (error) {
              console.error('Error deleting employee:', error);
              Alert.alert('Error', 'Failed to delete employee');
            }
          }
        }
      ]
    );
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchEmployees();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

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
              Employee Management
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      {/* Action Buttons */}
      <View className="flex-row justify-between p-4">
        <TouchableOpacity
          onPress={() => router.push('/Group-Admin/employee-management/individual')}
          className={`flex-1 mr-2 p-4 rounded-xl ${isDark ? 'bg-blue-600' : 'bg-blue-500'}`}
          style={[styles.actionButton, { elevation: 4 }]}
        >
          <View className="flex-row items-center justify-center">
            <View className={`w-8 h-8 rounded-full items-center justify-center bg-white/20 mr-2`}>
              <Ionicons 
                name="person-add-outline" 
                size={18} 
                color="white" 
              />
            </View>
            <View>
              <Text className="text-white text-base font-semibold">
                Add Individual
              </Text>
              <Text className="text-white/80 text-xs">
                Create single employee
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => router.push('/Group-Admin/employee-management/bulk')}
          className={`flex-1 ml-2 p-4 rounded-xl ${isDark ? 'bg-green-600' : 'bg-green-500'}`}
          style={[styles.actionButton, { elevation: 4 }]}
        >
          <View className="flex-row items-center justify-center">
            <View className={`w-8 h-8 rounded-full items-center justify-center bg-white/20 mr-2`}>
              <Ionicons 
                name="people-outline" 
                size={18} 
                color="white" 
              />
            </View>
            <View>
              <Text className="text-white text-base font-semibold">
                Bulk Upload
              </Text>
              <Text className="text-white/80 text-xs">
                Import multiple employees
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View className="px-4 mb-4">
        <View className={`flex-row items-center rounded-lg px-4 ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`} style={styles.searchBar}>
          <Ionicons 
            name="search" 
            size={20} 
            color={isDark ? '#9CA3AF' : '#6B7280'} 
          />
          <TextInput
            placeholder="Search employees..."
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className={`flex-1 ml-2 py-3 ${isDark ? 'text-white' : 'text-gray-900'}`}
          />
        </View>
      </View>

      {/* Employee List */}
      <ScrollView 
        className="flex-1 px-4 pb-20"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[isDark ? '#60A5FA' : '#3B82F6']}
            tintColor={isDark ? '#60A5FA' : '#3B82F6'}
            titleColor={isDark ? '#60A5FA' : '#3B82F6'}
            title="Pull to refresh"
          />
        }
      >
        {error ? (
          <View className="p-4 bg-red-100 rounded-lg">
            <Text className="text-red-800">{error}</Text>
          </View>
        ) : loading && !refreshing ? (
          <View className="p-4">
            <Text className={isDark ? 'text-gray-300' : 'text-gray-600'}>
              Loading employees...
            </Text>
          </View>
        ) : filteredEmployees.length === 0 ? (
          <View className="p-4">
            <Text className={isDark ? 'text-gray-300' : 'text-gray-600'}>
              No employees found
            </Text>
          </View>
        ) : (
          filteredEmployees.map(employee => (
            <View
              key={employee.id}
              className={`mb-4 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              style={styles.employeeCard}
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className={`text-lg font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {employee.name}
                  </Text>
                  <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                    {employee.email}
                  </Text>
                  {employee.phone && (
                    <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                      {employee.phone}
                    </Text>
                  )}
                </View>
                {/*  
                <TouchableOpacity
                  onPress={() => handleDeleteEmployee(employee.id)}
                  className="p-2 rounded-lg bg-red-500"
                >
                  <Ionicons name="trash" size={20} color="white" />
                </TouchableOpacity>
                */}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <BottomNav items={groupAdminNavItems} />
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
  actionButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchBar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  employeeCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  }
}); 