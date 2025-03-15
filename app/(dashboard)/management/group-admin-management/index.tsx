import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../../context/ThemeContext';
import AuthContext from '../../../context/AuthContext';
import axios from 'axios';

interface GroupAdmin {
  id: number;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

export default function GroupAdminsList() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();

  const [groupAdmins, setGroupAdmins] = useState<GroupAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchGroupAdmins();
  }, []);

  const fetchGroupAdmins = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/group-admins`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroupAdmins(response.data);
    } catch (error: any) {
      console.error('Error fetching group admins:', error);
      Alert.alert('Error', 'Unable to fetch group admins');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchGroupAdmins();
    } finally {
      setRefreshing(false);
    }
  };

  // const handleDeleteGroupAdmin = async (id: number) => {
  //   Alert.alert(
  //     'Delete Group Admin',
  //     'Are you sure you want to delete this group admin?',
  //     [
  //       { text: 'Cancel', style: 'cancel' },
  //       {
  //         text: 'Delete',
  //         style: 'destructive',
  //         onPress: async () => {
  //           try {
  //             await axios.delete(
  //               `${process.env.EXPO_PUBLIC_API_URL}/api/group-admins/${id}`,
  //               { headers: { Authorization: `Bearer ${token}` } }
  //             );
  //             fetchGroupAdmins();
  //           } catch (error) {
  //             Alert.alert('Error', 'Failed to delete group admin');
  //           }
  //         }
  //       }
  //     ]
  //   );
  // };

  const filteredAdmins = groupAdmins.filter(admin => 
    admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <LinearGradient
        colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#F9FAFB', '#F3F4F6']}
        className="w-full"
        style={styles.header}
      >
        {/* <View className="flex-row items-center justify-between px-6">
          <Link href="../" asChild>
            <TouchableOpacity
              className="mr-4 p-2 rounded-full"
              style={[styles.backButton, { backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6' }]}
            >
              <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </Link>
          <Text 
            className="flex-1 text-xl font-semibold"
            style={{ color: theme === 'dark' ? '#F9FAFB' : '#111827' }}
          >
            Group Admins
          </Text>
        </View> */}
      </LinearGradient>

      <ScrollView 
        className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme === 'dark' ? '#60A5FA' : '#3B82F6'}
            colors={[theme === 'dark' ? '#60A5FA' : '#3B82F6']}
            progressBackgroundColor={theme === 'dark' ? '#374151' : '#F3F4F6'}
          />
        }
      >
        <View className="p-6">
          <View className="mt-4">
            <View className="flex-row justify-between items-center mb-4">
              <Text className={`text-xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Group Admins List
              </Text>
              <Text className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {groupAdmins.length} total
              </Text>
            </View>

            <View className="relative mb-6">
              <View className="relative">
                <Ionicons
                  name="search"
                  size={20}
                  color={theme === 'dark' ? '#9CA3AF' : '#6B7280'} 
                  style={{
                    position: 'absolute',
                    left: 16,
                    top: '50%',
                    transform: [{ translateY: -10 }],
                    zIndex: 1
                  }}
                />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search group admins..."
                  className={`pl-12 pr-4 py-3 rounded-lg ${
                    theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
                  }`}
                  placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                  style={[styles.searchInput, {paddingLeft: 48}]}
                />
              </View>
            </View>

            {loading ? (
              <View className="py-20">
                <ActivityIndicator size="large" color={theme === 'dark' ? '#60A5FA' : '#3B82F6'} />
              </View>
            ) : groupAdmins.length === 0 ? (
              <View className="py-20 items-center">
                <Ionicons
                  name="people-outline"
                  size={48}
                  color={theme === 'dark' ? '#4B5563' : '#9CA3AF'}
                />
                <Text className={`mt-4 text-center ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  No group admins found
                </Text>
              </View>
            ) : (
              filteredAdmins.map((admin) => (
                <View
                  key={admin.id}
                  className={`mb-4 p-4 rounded-xl ${
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  }`}
                  style={styles.adminCard}
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text className={`text-lg font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {admin.name}
                      </Text>
                      <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        {admin.email}
                      </Text>
                      <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        {admin.phone}
                      </Text>
                      <Text className={`mt-2 text-sm ${
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      }`}>
                        Added {new Date(admin.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    
                    {/* <TouchableOpacity
                      onPress={() => handleDeleteGroupAdmin(admin.id)}
                      className="p-2 rounded-full bg-red-100 dark:bg-red-900/30"
                    >
                      <Ionicons 
                        name="trash-outline" 
                        size={20} 
                        color={theme === 'dark' ? '#FCA5A5' : '#DC2626'} 
                      />
                    </TouchableOpacity> */}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
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
  backButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  adminCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  }
});