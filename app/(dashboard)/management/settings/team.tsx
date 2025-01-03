import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Platform, StatusBar as RNStatusBar, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface TeamMember {
  id: string;
  name: string;
  role: 'Group Admin' | 'Employee';
  email: string;
  status: 'Active' | 'Inactive';
  joinDate: string;
}

const mockTeamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Sowjanya H R',
    role: 'Group Admin',
    email: 'john@example.com',
    status: 'Active',
    joinDate: '2023-12-01',
  },
  {
    id: '2',
    name: 'Chetan B R',
    role: 'Employee',
    email: 'jane@example.com',
    status: 'Active',
    joinDate: '2023-12-15',
  },
  // Add more mock data as needed
];

export default function TeamManagementScreen() {
  const router = useRouter();
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === 'dark';

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(mockTeamMembers);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('All');

  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === 'All' || member.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const handleRemoveMember = (id: string) => {
    Alert.alert(
      'Remove Team Member',
      'Are you sure you want to remove this team member?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          onPress: () => {
            setTeamMembers(prev => prev.filter(member => member.id !== id));
            Alert.alert('Success', 'Team member removed successfully');
          },
          style: 'destructive'
        }
      ]
    );
  };

  useEffect(() => {
    if (Platform.OS === 'ios') {
      RNStatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
    } else {
      RNStatusBar.setBackgroundColor(isDark ? '#1F2937' : '#FFFFFF');
      RNStatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
    }
  }, [isDark]);

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#111827' : '#F3F4F6' }}>
      <RNStatusBar
        backgroundColor={isDark ? '#1F2937' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
      />
      {/* Header */}
      <LinearGradient
        colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        style={[
          styles.header,
          { paddingTop: Platform.OS === 'ios' ? 60 : (RNStatusBar.currentHeight || 0) + 10 }
        ]}
      >
        <View className="flex-row items-center px-4" style={{ paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
          >
            <MaterialIcons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
          <Text className={`text-2xl font-semibold ml-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Team Management
          </Text>
        </View>
      </LinearGradient>

      {/* Search and Filter */}
      <View className="px-4 py-3">
        <View className={`flex-row items-center p-2 rounded-lg mb-3 ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}>
          <MaterialIcons name="search" size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
          <TextInput
            placeholder="Search team members..."
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className={`flex-1 ml-2 ${isDark ? 'text-white' : 'text-gray-900'}`}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          {['All', 'Group Admin', 'Employee'].map((role) => (
            <TouchableOpacity
              key={role}
              onPress={() => setSelectedRole(role)}
              className={`mr-2 px-4 py-2 rounded-full ${
                selectedRole === role
                  ? 'bg-blue-500'
                  : isDark ? 'bg-gray-800' : 'bg-white'
              }`}
            >
              <Text className={
                selectedRole === role
                  ? 'text-white font-medium'
                  : isDark ? 'text-gray-300' : 'text-gray-700'
              }>
                {role}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Team Members List */}
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {filteredMembers.map((member) => (
          <View
            key={member.id}
            style={[styles.card, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}
            className="mb-3 p-4 rounded-xl"
          >
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {member.name}
                </Text>
                <Text className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {member.email}
                </Text>
                <View className="flex-row items-center mt-2">
                  <View className={`px-2 py-1 rounded-full ${
                    member.role === 'Group Admin' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Text className={
                      member.role === 'Group Admin' ? 'text-blue-800' : 'text-gray-800'
                    }>
                      {member.role}
                    </Text>
                  </View>
                  <View className={`ml-2 flex-row items-center ${
                    member.status === 'Active' ? 'text-green-500' : 'text-red-500'
                  }`}>
                    <View className={`w-2 h-2 rounded-full mr-1 ${
                      member.status === 'Active' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <Text className={
                      member.status === 'Active' ? 'text-green-500' : 'text-red-500'
                    }>
                      {member.status}
                    </Text>
                  </View>
                </View>
              </View>
              <View className="flex-row">
                <TouchableOpacity
                  onPress={() => {/* Handle edit */}}
                  className={`w-8 h-8 rounded-full items-center justify-center mr-2 ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}
                >
                  <MaterialIcons name="edit" size={18} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRemoveMember(member.id)}
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}
                >
                  <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Add Member Button */}
      <View className="p-4">
        <TouchableOpacity
          onPress={() => {router.push('/management/group-admin-management/individual')}}
          className="bg-blue-500 p-4 rounded-lg flex-row items-center justify-center"
          style={styles.addButton}
        >
          <MaterialIcons name="add" size={24} color="#FFFFFF" />
          <Text className="text-white font-semibold ml-2">
            Add Team Member
          </Text>
        </TouchableOpacity>
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
    paddingBottom: 16,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  addButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
});
