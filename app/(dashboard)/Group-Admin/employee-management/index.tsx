import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import axios from 'axios';

interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  can_submit_expenses_anytime: boolean;
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

  const handleToggleAccess = async (employeeId: number, currentValue: boolean) => {
    try {
      const response = await axios.patch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/employees/${employeeId}/access`,
        { can_submit_expenses_anytime: !currentValue },
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );

      if (response.data) {
        // Update local state
        setEmployees(prev => prev.map(emp => 
          emp.id === employeeId 
            ? { ...emp, can_submit_expenses_anytime: !currentValue }
            : emp
        ));
      }
    } catch (error: any) {
      console.error('Error updating access:', error.response?.data || error);
      Alert.alert(
        'Error',
        error.response?.data?.details || 'Failed to update access permission'
      );
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

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#F3F4F6' }}>
      {/* Header */}
      <View className={`p-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={styles.header}>
        <View className="flex-row items-center justify-between">
          <Link href="/Group-Admin/group-admin" asChild>
            <TouchableOpacity className="p-2">
              <Ionicons 
                name="arrow-back" 
                size={24} 
                color={isDark ? '#FFFFFF' : '#000000'} 
              />
            </TouchableOpacity>
          </Link>
          <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Employee Management
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      {/* Action Buttons */}
      <View className="flex-row justify-between p-4">
        <TouchableOpacity
          onPress={() => router.push('/Group-Admin/employee-management/individual')}
          className={`flex-1 mr-2 p-4 rounded-lg ${isDark ? 'bg-blue-600' : 'bg-blue-500'}`}
          style={styles.actionButton}
        >
          <Text className="text-white text-center font-semibold">Add Individual</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => router.push('/Group-Admin/employee-management/bulk')}
          className={`flex-1 ml-2 p-4 rounded-lg ${isDark ? 'bg-green-600' : 'bg-green-500'}`}
          style={styles.actionButton}
        >
          <Text className="text-white text-center font-semibold">Bulk Upload</Text>
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
      <ScrollView className="flex-1 px-4">
        {error ? (
          <View className="p-4 bg-red-100 rounded-lg">
            <Text className="text-red-800">{error}</Text>
          </View>
        ) : loading ? (
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

                <View className="flex-row items-center">
                  <TouchableOpacity
                    onPress={() => handleToggleAccess(
                      employee.id,
                      employee.can_submit_expenses_anytime
                    )}
                    className={`mr-4 p-2 rounded-lg ${
                      employee.can_submit_expenses_anytime
                        ? (isDark ? 'bg-green-600' : 'bg-green-500')
                        : (isDark ? 'bg-gray-600' : 'bg-gray-400')
                    }`}
                  >
                    <Ionicons
                      name={employee.can_submit_expenses_anytime ? 'checkmark' : 'close'}
                      size={20}
                      color="white"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDeleteEmployee(employee.id)}
                    className="p-2 rounded-lg bg-red-500"
                  >
                    <Ionicons name="trash" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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