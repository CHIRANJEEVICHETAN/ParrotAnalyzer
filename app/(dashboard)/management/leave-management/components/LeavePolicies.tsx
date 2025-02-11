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
import { Picker } from '@react-native-picker/picker';

interface LeaveType {
  id: number;
  name: string;
}

interface LeavePolicy {
  id: number;
  leave_type_id: number;
  leave_type_name: string;
  default_days: number;
  carry_forward_days: number;
  min_service_days: number;
  requires_approval: boolean;
  notice_period_days: number;
  max_consecutive_days: number;
  gender_specific: string | null;
  is_active: boolean;
}

export default function LeavePolicies() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === 'dark';

  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicy | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    leave_type_id: '',
    default_days: '',
    carry_forward_days: '',
    min_service_days: '',
    requires_approval: true,
    notice_period_days: '',
    max_consecutive_days: '',
    gender_specific: '',
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [policiesRes, typesRes] = await Promise.all([
        axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/leave-policies`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/leave-types`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      ]);

      setPolicies(policiesRes.data);
      setLeaveTypes(typesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const endpoint = editingPolicy
        ? `/api/leave-management/leave-policies/${editingPolicy.id}`
        : '/api/leave-management/leave-policies';
      
      const method = editingPolicy ? 'put' : 'post';
      
      const response = await axios[method](
        `${process.env.EXPO_PUBLIC_API_URL}${endpoint}`,
        {
          ...formData,
          default_days: parseInt(formData.default_days),
          carry_forward_days: parseInt(formData.carry_forward_days),
          min_service_days: parseInt(formData.min_service_days),
          notice_period_days: parseInt(formData.notice_period_days),
          max_consecutive_days: parseInt(formData.max_consecutive_days),
          gender_specific: formData.gender_specific || null,
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data) {
        await fetchData();
        setShowAddModal(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving policy:', error);
      setError('Failed to save policy');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      leave_type_id: '',
      default_days: '',
      carry_forward_days: '',
      min_service_days: '',
      requires_approval: true,
      notice_period_days: '',
      max_consecutive_days: '',
      gender_specific: '',
      is_active: true,
    });
    setEditingPolicy(null);
  };

  const handleEdit = (policy: LeavePolicy) => {
    setEditingPolicy(policy);
    setFormData({
      leave_type_id: policy.leave_type_id.toString(),
      default_days: policy.default_days.toString(),
      carry_forward_days: policy.carry_forward_days.toString(),
      min_service_days: policy.min_service_days.toString(),
      requires_approval: policy.requires_approval,
      notice_period_days: policy.notice_period_days.toString(),
      max_consecutive_days: policy.max_consecutive_days.toString(),
      gender_specific: policy.gender_specific || '',
      is_active: policy.is_active,
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
          Leave Policies
        </Text>
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="bg-blue-500 px-4 py-2 rounded-lg flex-row items-center"
        >
          <Ionicons name="add" size={24} color="white" />
          <Text className="text-white font-medium ml-2">Add Policy</Text>
        </TouchableOpacity>
      </View>

      {/* Policies List */}
      <ScrollView className="flex-1">
        {policies.map((policy) => (
          <TouchableOpacity
            key={policy.id}
            onPress={() => handleEdit(policy)}
            className={`mb-4 p-4 rounded-lg ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <View className="flex-row justify-between items-center">
              <Text className={`text-lg font-semibold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {policy.leave_type_name}
              </Text>
              <View className={`px-2 py-1 rounded ${
                policy.is_active
                  ? 'bg-green-100'
                  : 'bg-red-100'
              }`}>
                <Text className={`text-sm ${
                  policy.is_active
                    ? 'text-green-800'
                    : 'text-red-800'
                }`}>
                  {policy.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>

            <View className="mt-4 space-y-2">
              <View className="flex-row justify-between">
                <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  Default Days:
                </Text>
                <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                  {policy.default_days}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  Carry Forward:
                </Text>
                <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                  {policy.carry_forward_days} days
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  Min Service:
                </Text>
                <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                  {policy.min_service_days} days
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  Notice Period:
                </Text>
                <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                  {policy.notice_period_days} days
                </Text>
              </View>

              {policy.gender_specific && (
                <View className="flex-row justify-between">
                  <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                    Gender Specific:
                  </Text>
                  <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                    {policy.gender_specific}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
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
            {editingPolicy ? 'Edit Policy' : 'Add Policy'}
          </Text>

          {/* Form Fields */}
          <ScrollView className="space-y-4">
            {/* Leave Type Picker */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Leave Type
              </Text>
              <View className={`border rounded-lg overflow-hidden ${
                isDark ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <Picker
                  selectedValue={formData.leave_type_id}
                  onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, leave_type_id: value }))
                  }
                  style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                >
                  <Picker.Item label="Select Leave Type" value="" />
                  {leaveTypes.map((type) => (
                    <Picker.Item
                      key={type.id}
                      label={type.name}
                      value={type.id.toString()}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Numeric Inputs */}
            {[
              { key: 'default_days', label: 'Default Days' },
              { key: 'carry_forward_days', label: 'Carry Forward Days' },
              { key: 'min_service_days', label: 'Minimum Service Days' },
              { key: 'notice_period_days', label: 'Notice Period Days' },
              { key: 'max_consecutive_days', label: 'Maximum Consecutive Days' },
            ].map((field) => (
              <View key={field.key}>
                <Text className={`text-sm font-medium mb-2 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {field.label}
                </Text>
                <TextInput
                  value={formData[field.key as keyof typeof formData].toString()}
                  onChangeText={(text) => 
                    setFormData(prev => ({ ...prev, [field.key]: text }))
                  }
                  keyboardType="numeric"
                  className={`p-3 rounded-lg border ${
                    isDark
                      ? 'border-gray-700 bg-gray-700 text-white'
                      : 'border-gray-200 bg-gray-50 text-gray-900'
                  }`}
                  placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                />
              </View>
            ))}

            {/* Gender Specific Picker */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Gender Specific
              </Text>
              <View className={`border rounded-lg overflow-hidden ${
                isDark ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <Picker
                  selectedValue={formData.gender_specific}
                  onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, gender_specific: value }))
                  }
                  style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                >
                  <Picker.Item label="All Genders" value="" />
                  <Picker.Item label="Male Only" value="male" />
                  <Picker.Item label="Female Only" value="female" />
                </Picker>
              </View>
            </View>

            {/* Switches */}
            <View className="flex-row justify-between items-center">
              <Text className={`text-sm font-medium ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Requires Approval
              </Text>
              <Switch
                value={formData.requires_approval}
                onValueChange={(value) =>
                  setFormData(prev => ({ ...prev, requires_approval: value }))
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
          </ScrollView>

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
                  {editingPolicy ? 'Update' : 'Create'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
} 