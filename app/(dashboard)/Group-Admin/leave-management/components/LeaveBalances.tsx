import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import axios from 'axios';

interface LeaveBalance {
  id: number;
  user_id: number;
  user_name: string;
  employee_number: string;
  department: string;
  leave_type_id: number;
  leave_type_name: string;
  total_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
  year: number;
}

interface FilterState {
  department: string;
  employee: string;
  leaveType: string;
}

interface EmployeeInfo {
  id: number;
  name: string;
  employee_number?: string;
  department?: string;
}

interface BackendLeaveBalance {
  id: number;
  name: string;
  is_paid: boolean;
  total_days: number;
  used_days: number;
  pending_days: number;
  carry_forward_days?: number;
  available_days?: number;
  leave_type_id?: number;
  max_days?: number;
  requires_documentation?: boolean;
  year?: number;
}

export default function LeaveBalances() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === 'dark';
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [filteredBalances, setFilteredBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [filters, setFilters] = useState<FilterState>({
    department: '',
    employee: '',
    leaveType: ''
  });
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  const fetchBalances = async () => {
    try {
      // Fetch list of employees under this group admin
      const employeesResponse = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/employees`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (employeesResponse.data && employeesResponse.data.length > 0) {
        // Create an array to store all balances
        let allBalances: LeaveBalance[] = [];
        
        // Fetch leave balances for each employee
        for (const employee of employeesResponse.data as EmployeeInfo[]) {
          try {
            const response = await axios.get(
              `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/employee-leave-balances?userId=${employee.id}`,
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            );
            
            // Add employee information to each balance record
            const balancesWithUserInfo = response.data.map((balance: BackendLeaveBalance) => {
              return {
                ...balance,
                user_id: employee.id,
                user_name: employee.name,
                employee_number: employee.employee_number || 'N/A',
                department: employee.department || 'N/A',
                leave_type_name: balance.name, // Map name to leave_type_name for backward compatibility
                leave_type_id: balance.leave_type_id || balance.id,
                remaining_days: balance.available_days || (balance.total_days - balance.used_days - balance.pending_days),
                year: balance.year || selectedYear
              } as LeaveBalance;
            });
            
            allBalances = [...allBalances, ...balancesWithUserInfo];
          } catch (error) {
            console.error(`Error fetching balances for employee ${employee.id}:`, error);
          }
        }
        
        setBalances(allBalances);
        setFilteredBalances(allBalances);
      } else {
        setBalances([]);
        setFilteredBalances([]);
      }
    } catch (error) {
      console.error('Error fetching leave balances:', error);
      setBalances([]);
      setFilteredBalances([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBalances();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  useEffect(() => {
    let result = balances;

    if (filters.department) {
      result = result.filter(balance => 
        balance.department.toLowerCase().includes(filters.department.toLowerCase())
      );
    }

    if (filters.employee) {
      result = result.filter(balance => 
        balance.user_name.toLowerCase().includes(filters.employee.toLowerCase()) ||
        balance.employee_number.toLowerCase().includes(filters.employee.toLowerCase())
      );
    }

    if (filters.leaveType) {
      result = result.filter(balance => 
        balance.leave_type_name.toLowerCase().includes(filters.leaveType.toLowerCase())
      );
    }

    setFilteredBalances(result);
  }, [filters, balances]);

  // Group balances by employee
  const employeeBalances = filteredBalances.reduce((acc, balance) => {
    const key = `${balance.user_id}`;
    if (!acc[key]) {
      acc[key] = {
        id: balance.user_id,
        name: balance.user_name,
        employee_number: balance.employee_number,
        department: balance.department,
        balances: []
      };
    }
    
    // Calculate remaining days
    const remainingDays = balance.remaining_days !== undefined 
      ? balance.remaining_days 
      : balance.total_days - balance.used_days - balance.pending_days;
    
    const existingBalanceIndex = acc[key].balances.findIndex(
      (b: LeaveBalance) => b.leave_type_id === balance.leave_type_id
    );
    
    if (existingBalanceIndex === -1) {
      acc[key].balances.push({
        ...balance,
        remaining_days: remainingDays
      });
    }
    return acc;
  }, {} as Record<string, any>);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
      </View>
    );
  }

  const renderFilter = (
    label: string,
    value: string,
    onChange: (text: string) => void,
    placeholder: string,
    icon: keyof typeof Ionicons.glyphMap
  ) => (
    <View className="mb-4">
      <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
        {label}
      </Text>
      <View className={`flex-row items-center px-4 py-2 rounded-lg ${
        isDark ? 'bg-gray-800' : 'bg-white'
      } border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <Ionicons name={icon} size={20} color={isDark ? '#9CA3AF' : '#6B7280'} style={{ marginRight: 8 }} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
          className={`flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}
        />
      </View>
    </View>
  );

  const renderEmployeeCard = (employeeData: any) => {
    const isSelected = selectedEmployee === employeeData.id.toString();
    
    return (
      <TouchableOpacity
        key={`employee-${employeeData.id}`}
        onPress={() => setSelectedEmployee(isSelected ? null : employeeData.id.toString())}
        className={`mb-6 rounded-xl overflow-hidden ${
          isDark ? 'bg-gray-800' : 'bg-white'
        } shadow-sm`}
      >
        {/* Employee Header */}
        <View className={`p-4 ${
          isSelected ? isDark ? 'bg-blue-900/50' : 'bg-blue-50' : ''
        }`}>
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text className={`text-lg font-semibold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {employeeData.name}
              </Text>
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {employeeData.employee_number} • {employeeData.department}
              </Text>
            </View>
            <Ionicons
              name={isSelected ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </View>
        </View>

        {/* Leave Balances */}
        {isSelected && (
          <View className="p-4">
            {employeeData.balances.map((balance: LeaveBalance, index: number) => {
              // Calculate available days accurately based on total, used, and pending
              const availableDays = Math.max(0, balance.total_days - balance.used_days - balance.pending_days);
              const isLast = index === employeeData.balances.length - 1;
              return (
                <View 
                  key={`balance-${balance.user_id}-${balance.leave_type_id}`}
                  className={`${!isLast ? 'mb-6' : ''}`}
                >
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {balance.leave_type_name}
                    </Text>
                    <View className={`px-2 py-1 rounded-full ${
                      availableDays > 0 ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      <Text className={
                        availableDays > 0 ? 'text-green-800' : 'text-red-800'
                      }>
                        {availableDays} days left
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View className="mt-2 mb-3">
                    <View className={`h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                      <View
                        className="h-2 rounded-full bg-blue-500"
                        style={{
                          width: balance.total_days > 0 ? 
                            `${Math.min(100, ((balance.used_days + balance.pending_days) / balance.total_days) * 100)}%` : 
                            '0%',
                        }}
                      />
                    </View>
                  </View>

                  <View className="flex-row justify-between">
                    <View>
                      <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total</Text>
                      <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {balance.total_days} days
                      </Text>
                    </View>
                    <View>
                      <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Used</Text>
                      <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {balance.used_days} days
                      </Text>
                    </View>
                    <View>
                      <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Pending</Text>
                      <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {balance.pending_days} days
                      </Text>
                    </View>
                    <View>
                      <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Available</Text>
                      <Text className={`font-medium ${
                        availableDays > 0
                          ? isDark ? 'text-green-400' : 'text-green-600'
                          : isDark ? 'text-red-400' : 'text-red-600'
                      }`}>
                        {availableDays} days
                      </Text>
                    </View>
                  </View>
                  
                  {/* Separation Line */}
                  {!isLast && (
                    <View className={`h-[1px] mt-6 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                  )}
                </View>
              );
            })}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[isDark ? '#60A5FA' : '#3B82F6']}
          tintColor={isDark ? '#60A5FA' : '#3B82F6'}
        />
      }
    >
      <View className="flex-1">
        {/* Header with Year Selection */}
        <View className="flex-row justify-between items-center mb-6">
          <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Leave Balances
          </Text>
          <View className="flex-row items-center space-x-4">
            <TouchableOpacity
              onPress={() => setSelectedYear(prev => prev - 1)}
              className={`p-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={isDark ? '#D1D5DB' : '#4B5563'}
              />
            </TouchableOpacity>
            <Text className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {selectedYear}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedYear(prev => prev + 1)}
              disabled={selectedYear >= new Date().getFullYear()}
              className={`p-2 rounded-lg ${
                selectedYear >= new Date().getFullYear()
                  ? 'opacity-50'
                  : ''
              } ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={isDark ? '#D1D5DB' : '#4B5563'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filters */}
        <View className={`p-4 mb-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          {renderFilter(
            'Department',
            filters.department,
            (text) => setFilters(prev => ({ ...prev, department: text })),
            'Filter by department',
            'business-outline'
          )}
          {renderFilter(
            'Employee',
            filters.employee,
            (text) => setFilters(prev => ({ ...prev, employee: text })),
            'Search by name or employee number',
            'person-outline'
          )}
          {renderFilter(
            'Leave Type',
            filters.leaveType,
            (text) => setFilters(prev => ({ ...prev, leaveType: text })),
            'Filter by leave type',
            'layers-outline'
          )}
        </View>

        {/* Employee List */}
        {Object.values(employeeBalances).length === 0 ? (
          <View className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
            <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No leave balances found
            </Text>
          </View>
        ) : (
          Object.values(employeeBalances).map(renderEmployeeCard)
        )}
      </View>
    </ScrollView>
  );
} 