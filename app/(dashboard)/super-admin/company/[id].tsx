import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Alert,
  Platform,
  StatusBar as RNStatusBar 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../context/ThemeContext';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  employee_number: string;
  department: string;
  designation: string;
  created_at: string;
}

interface GroupAdmin {
  id: number;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  employee_count: number;
  employees: Employee[];
}

interface Management {
  id: number;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

interface CompanyHierarchy {
  id: number;
  name: string;
  email: string;
  status: string;
  management: Management[];
  group_admins: GroupAdmin[];
}

export default function CompanyDetails() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const companyId = params.id;
  const isDark = theme === 'dark';

  const [hierarchy, setHierarchy] = useState<CompanyHierarchy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAdmins, setExpandedAdmins] = useState<number[]>([]);

  useEffect(() => {
    fetchCompanyHierarchy();
  }, [companyId]);

  const fetchCompanyHierarchy = async () => {
    try {
      const response = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/companies/${companyId}/hierarchy`);
      setHierarchy(response.data);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to fetch company details');
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminExpanded = (adminId: number) => {
    setExpandedAdmins(prev => 
      prev.includes(adminId) 
        ? prev.filter(id => id !== adminId)
        : [...prev, adminId]
    );
  };

  // Add StatusBar effect
  React.useEffect(() => {
    if (Platform.OS === 'ios') {
      RNStatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
    } else {
      RNStatusBar.setBackgroundColor(isDark ? '#1F2937' : '#FFFFFF');
      RNStatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
    }
  }, [isDark]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={isDark ? '#FFFFFF' : '#000000'} />
      </View>
    );
  }

  if (error || !hierarchy) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text className={`text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {error || 'Failed to load company details'}
        </Text>
        <TouchableOpacity
          onPress={fetchCompanyHierarchy}
          className="mt-4 bg-blue-500 px-6 py-3 rounded-full"
        >
          <Text className="text-white">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1" style={styles.container}>
      <RNStatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
      />

      {/* Header with Gradient */}
      <LinearGradient
        colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        style={[
          styles.header,
          { paddingTop: Platform.OS === 'ios' ? 60 : (RNStatusBar.currentHeight || 0) + 10 }
        ]}
      >
        <View className="flex-row items-center px-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2 rounded-full"
            style={[
              styles.backButton,
              { backgroundColor: isDark ? '#374151' : '#F3F4F6' }
            ]}
          >
            <Ionicons 
              name="arrow-back" 
              size={24} 
              color={isDark ? '#FFFFFF' : '#000000'} 
            />
          </TouchableOpacity>
          <View>
            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {hierarchy?.name}
            </Text>
            <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              {hierarchy?.email}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16 }}
      >
        {/* Management Section */}
        <View className="mb-6">
          <Text className={`text-lg font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Management
          </Text>
          {hierarchy.management.map(manager => (
            <View
              key={manager.id}
              className={`p-4 rounded-lg mb-2 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
              style={styles.card}
            >
              <Text className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {manager.name}
              </Text>
              <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                {manager.email}
              </Text>
              <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                {manager.phone}
              </Text>
            </View>
          ))}
        </View>

        {/* Group Admins Section */}
        <View className="mb-6">
          <Text className={`text-lg font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Group Admins
          </Text>
          {hierarchy.group_admins.map(admin => (
            <View key={admin.id} className="mb-4">
              <TouchableOpacity
                onPress={() => toggleAdminExpanded(admin.id)}
                className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                style={styles.card}
              >
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {admin.name}
                    </Text>
                    <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                      {admin.email}
                    </Text>
                    <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                      {admin.employee_count} employees
                    </Text>
                  </View>
                  <Ionicons
                    name={expandedAdmins.includes(admin.id) ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color={theme === 'dark' ? '#FFFFFF' : '#000000'}
                  />
                </View>
              </TouchableOpacity>

              {/* Employees List */}
              {expandedAdmins.includes(admin.id) && (
                <View className="ml-4 mt-2">
                  {admin.employees.map(employee => (
                    <View
                      key={employee.id}
                      className={`p-4 rounded-lg mb-2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}`}
                      style={styles.card}
                    >
                      <Text className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {employee.name}
                      </Text>
                      <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        {employee.email}
                      </Text>
                      <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        {employee.employee_number} • {employee.department}
                      </Text>
                      {employee.designation && (
                        <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                          {employee.designation}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  }
}); 