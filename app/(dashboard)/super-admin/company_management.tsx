import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Platform, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../context/ThemeContext';
import axios from 'axios';

interface Company {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'disabled';
  management: {
    name: string;
    email: string;
    phone: string;
  } | null;
  user_count: number;
  created_at: string;
}

export default function CompanyManagement() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/companies`);
      setCompanies(response.data);
      if (response.data.length === 0) {
        setError('No companies found. Add your first company!');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to fetch companies. Please try again.');
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (companyId: number) => {
    try {
      await axios.patch(`${process.env.EXPO_PUBLIC_API_URL}/api/companies/${companyId}/toggle-status`);
      fetchCompanies();
    } catch (error) {
      Alert.alert('Error', 'Failed to update company status');
    }
  };

  const handleDeleteCompany = async (companyId: number) => {
    Alert.alert(
      'Delete Company',
      'Are you sure? This will permanently delete the company and all associated users.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${process.env.EXPO_PUBLIC_API_URL}/api/companies/${companyId}`);
              fetchCompanies();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete company');
            }
          }
        }
      ]
    );
  };

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         company.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || company.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <View className="flex-1">
      <LinearGradient
        colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        className="pb-4"
        style={[styles.header, { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 0 }]}
      >
        <View className="flex-row items-center justify-between px-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2 rounded-full"
            style={[styles.backButton, { backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6' }]}
          >
            <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
          <Text className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Companies
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(dashboard)/super-admin/add-company')}
            className="p-2 rounded-full flex-row items-center"
            accessibilityLabel="Add new company"
            style={[styles.addButton, { backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6' }]}
          >
            <Ionicons name="add" size={24} color={theme === 'dark' ? '#FFFFFF' : '#000000'} />
            <Text className={`ml-1 text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Add
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Search and Filter */}
        <View className="p-4">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search companies..."
            className={`mb-4 p-4 rounded-lg ${
              theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
            }`}
            placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
          />

          <View className="flex-row mb-4">
            {['all', 'active', 'disabled'].map((status) => (
              <TouchableOpacity
                key={status}
                onPress={() => setStatusFilter(status as any)}
                className={`mr-2 px-4 py-2 rounded-full ${
                  statusFilter === status
                    ? 'bg-blue-500'
                    : theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                }`}
              >
                <Text className={
                  statusFilter === status
                    ? 'text-white'
                    : theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Companies List */}
        <ScrollView className="flex-1">
          {loading ? (
            <View className="flex-1 justify-center items-center p-4">
              <ActivityIndicator size="large" color={theme === 'dark' ? '#FFFFFF' : '#000000'} />
              <Text className={`mt-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Loading companies...
              </Text>
            </View>
          ) : error ? (
            <View className="flex-1 justify-center items-center p-4">
              <Ionicons name="alert-circle-outline" size={48} color={theme === 'dark' ? '#FFFFFF' : '#000000'} />
              <Text className={`mt-4 text-center ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {error}
              </Text>
              <TouchableOpacity
                onPress={fetchCompanies}
                className="mt-4 bg-blue-500 px-6 py-3 rounded-full"
              >
                <Text className="text-white font-semibold">Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredCompanies.map((company) => (
              <TouchableOpacity
                key={company.id}
                // onPress={() => router.push(`/(dashboard)/company/${company.id}`)}
                className={`mx-4 mb-4 p-4 rounded-lg ${
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                }`}
                style={styles.companyCard}
              >
                <View className="flex-row justify-between">
                  <View className="flex-1">
                    <Text className={`text-lg font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      {company.name}
                    </Text>
                    <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                      {company.email}
                    </Text>
                    {company.management ? (
                      <View className="mt-2">
                        <Text className={`font-medium ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Management:
                        </Text>
                        <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                          {company.management.name}
                        </Text>
                        <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                          {company.management.email}
                        </Text>
                        <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                          {company.management.phone}
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-yellow-500 mt-2">
                        No management account assigned
                      </Text>
                    )}
                    <View className="mt-2 flex-row items-center">
                      <Ionicons 
                        name="people-outline" 
                        size={16} 
                        color={theme === 'dark' ? '#9CA3AF' : '#6B7280'} 
                      />
                      <Text className={`ml-1 ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {company.user_count} {company.user_count === 1 ? 'user' : 'users'}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-start gap-3">
                    <TouchableOpacity
                      onPress={() => handleStatusToggle(company.id)}
                      className={`p-2 rounded-full ${
                        company.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={styles.actionButton}
                    >
                      <Ionicons
                        name={company.status === 'active' ? 'checkmark' : 'close'}
                        size={20}
                        color="white"
                      />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      onPress={() => handleDeleteCompany(company.id)}
                      className="p-2 rounded-full bg-red-500"
                      style={styles.actionButton}
                    >
                      <Ionicons name="trash" size={20} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View className={`absolute top-2 right-2 px-2 py-1 rounded-full ${
                  company.status === 'active' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <Text className={`text-xs font-medium ${
                    company.status === 'active' ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {company.status.charAt(0).toUpperCase() + company.status.slice(1)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
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
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  addButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  companyCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  actionButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  }
});
