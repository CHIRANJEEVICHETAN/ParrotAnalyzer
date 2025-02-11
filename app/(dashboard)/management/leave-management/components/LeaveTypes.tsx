import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import axios from 'axios';
import Modal from 'react-native-modal';

interface LeaveType {
  id: number;
  name: string;
  description: string;
  requires_documentation: boolean;
  max_days: number;
  is_paid: boolean;
  is_active: boolean;
}

export default function LeaveTypes() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === 'dark';

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    requires_documentation: false,
    max_days: '',
    is_paid: true,
    is_active: true,
  });

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/leave-types`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setLeaveTypes(response.data);
    } catch (error) {
      console.error('Error fetching leave types:', error);
      setError('Failed to fetch leave types');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const endpoint = editingType
        ? `/api/leave-management/leave-types/${editingType.id}`
        : '/api/leave-management/leave-types';
      
      const method = editingType ? 'put' : 'post';
      
      const response = await axios[method](
        `${process.env.EXPO_PUBLIC_API_URL}${endpoint}`,
        {
          ...formData,
          max_days: parseInt(formData.max_days)
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data) {
        await fetchLeaveTypes();
        setShowAddModal(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving leave type:', error);
      setError('Failed to save leave type');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      requires_documentation: false,
      max_days: '',
      is_paid: true,
      is_active: true,
    });
    setEditingType(null);
  };

  const handleEdit = (type: LeaveType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      description: type.description,
      requires_documentation: type.requires_documentation,
      max_days: type.max_days.toString(),
      is_paid: type.is_paid,
      is_active: type.is_active,
    });
    setShowAddModal(true);
  };

  if (loading && !showAddModal) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Header with Add Button */}
      <View className="flex-row justify-between items-center mb-6">
        <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Leave Types
        </Text>
        <View className="flex-row">
          {leaveTypes.length === 0 && (
            <TouchableOpacity
              onPress={async () => {
                try {
                  setLoading(true);
                  await axios.post(
                    `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/initialize-defaults`,
                    {},
                    {
                      headers: { Authorization: `Bearer ${token}` }
                    }
                  );
                  await fetchLeaveTypes();
                } catch (error) {
                  console.error('Error initializing defaults:', error);
                  setError('Failed to initialize defaults');
                } finally {
                  setLoading(false);
                }
              }}
              className="bg-green-500 px-4 py-2 rounded-lg flex-row items-center mr-2"
            >
              <Ionicons name="refresh" size={24} color="white" />
              <Text className="text-white font-medium ml-2">Initialize Defaults</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="bg-blue-500 px-4 py-2 rounded-lg flex-row items-center"
          >
            <Ionicons name="add" size={24} color="white" />
            <Text className="text-white font-medium ml-2">Add Type</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Leave Types List */}
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {leaveTypes.map((type, index) => (
          <React.Fragment key={type.id}>
            <TouchableOpacity
              onPress={() => handleEdit(type)}
              className={`p-4 ${
                isDark ? 'bg-gray-800' : 'bg-white'
              }`}
            >
              <View className="flex-row justify-between items-center">
                <Text className={`text-lg font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {type.name}
                </Text>
                <View className={`px-2 py-1 rounded ${
                  type.is_active
                    ? 'bg-green-100'
                    : 'bg-red-100'
                }`}>
                  <Text className={`text-sm ${
                    type.is_active
                      ? 'text-green-800'
                      : 'text-red-800'
                  }`}>
                    {type.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
              
              <Text className={`mt-2 ${
                isDark ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {type.description}
              </Text>
              
              <View className="flex-row mt-4 justify-between">
                <View className="flex-row items-center flex-1">
                  <Ionicons
                    name="document-text"
                    size={16}
                    color={isDark ? '#9CA3AF' : '#4B5563'}
                  />
                  <Text className={`ml-2 ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {type.requires_documentation ? 'Docs Required' : 'No Docs Required'}
                  </Text>
                </View>
                
                <View className="flex-row items-center flex-1 mx-4">
                  <Ionicons
                    name="calendar"
                    size={16}
                    color={isDark ? '#9CA3AF' : '#4B5563'}
                  />
                  <Text className={`ml-2 ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Max {type.max_days} days
                  </Text>
                </View>
                
                <View className="flex-row items-center flex-1">
                  <Ionicons
                    name="cash"
                    size={16}
                    color={isDark ? '#9CA3AF' : '#4B5563'}
                  />
                  <Text className={`ml-2 ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {type.is_paid ? 'Paid' : 'Unpaid'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
            
            {/* Add separator if not the last item */}
            {index < leaveTypes.length - 1 && (
              <View 
                className={`h-[1px] mx-4 ${
                  isDark ? 'bg-gray-700' : 'bg-gray-200'
                }`}
              />
            )}
            
            {/* Add spacing between items */}
            {index < leaveTypes.length - 1 && (
              <View className="h-4" />
            )}
          </React.Fragment>
        ))}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        isVisible={showAddModal}
        onBackdropPress={() => {
          setShowAddModal(false);
          resetForm();
        }}
        style={{ margin: 0 }}
      >
        <View className={`m-4 p-6 rounded-2xl ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}>
          <Text className={`text-xl font-semibold mb-6 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            {editingType ? 'Edit Leave Type' : 'Add Leave Type'}
          </Text>

          {/* Form Fields */}
          <View className="space-y-4">
            <View>
              <Text className={`text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Name
              </Text>
              <TextInput
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                className={`p-3 rounded-lg border ${
                  isDark
                    ? 'border-gray-700 bg-gray-700 text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-900'
                }`}
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              />
            </View>

            <View>
              <Text className={`text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Description
              </Text>
              <TextInput
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={3}
                className={`p-3 rounded-lg border ${
                  isDark
                    ? 'border-gray-700 bg-gray-700 text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-900'
                }`}
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                textAlignVertical="top"
              />
            </View>

            <View>
              <Text className={`text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Maximum Days
              </Text>
              <TextInput
                value={formData.max_days}
                onChangeText={(text) => setFormData(prev => ({ ...prev, max_days: text }))}
                keyboardType="numeric"
                className={`p-3 rounded-lg border ${
                  isDark
                    ? 'border-gray-700 bg-gray-700 text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-900'
                }`}
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              />
            </View>

            <View className="flex-row justify-between items-center">
              <Text className={`text-sm font-medium ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Requires Documentation
              </Text>
              <Switch
                value={formData.requires_documentation}
                onValueChange={(value) =>
                  setFormData(prev => ({ ...prev, requires_documentation: value }))
                }
              />
            </View>

            <View className="flex-row justify-between items-center">
              <Text className={`text-sm font-medium ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Is Paid Leave
              </Text>
              <Switch
                value={formData.is_paid}
                onValueChange={(value) =>
                  setFormData(prev => ({ ...prev, is_paid: value }))
                }
              />
            </View>

            <View className="flex-row justify-between items-center">
              <Text className={`text-sm font-medium ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Active
              </Text>
              <Switch
                value={formData.is_active}
                onValueChange={(value) =>
                  setFormData(prev => ({ ...prev, is_active: value }))
                }
              />
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row space-x-4 mt-6 gap-4">
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className={`flex-1 py-3 rounded-lg ${
                isDark ? 'bg-gray-700' : 'bg-gray-100'
              }`}
            >
              <Text className={`text-center font-medium ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              className="flex-1 bg-blue-500 py-3 rounded-lg"
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white text-center font-medium">
                  {editingType ? 'Update' : 'Create'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}