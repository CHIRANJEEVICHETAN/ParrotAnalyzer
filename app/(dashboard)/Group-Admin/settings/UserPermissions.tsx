import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, StatusBar, StyleSheet, TextInput, Alert, ActivityIndicator, Modal, Switch, Animated, RefreshControl, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ThemeContext from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import axios from 'axios';
import { useTrackingPermissionsStore } from '../../../store/trackingPermissionsStore';
import { MotiView } from 'moti';

// Define types
interface User {
    id: string;
    name: string;
    role: string;
    email: string;
}

interface Permission {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
}

interface Role {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    isFixed?: boolean;
    activePermissions?: string[];
}

interface ActivityLog {
    id: string;
    action: string;
    user: string;
    timestamp: string;
    details: string;
}

// Add new interface for role change modal
interface RoleChangeModal {
    visible: boolean;
    selectedRole: string;
}

// Add new interface for tracking permissions
interface TrackingPermission {
    id: number;
    user_id: number;
    user_name: string;
    can_override_geofence: boolean;
    tracking_precision: 'low' | 'medium' | 'high';
    updated_at: string;
}

// Update the type definition for field in updateTrackingPermission
type TrackingField = 'can_override_geofence' | 'tracking_precision' | 'location_required_for_shift';

export default function UserPermissions() {
    const router = useRouter();
    const { theme } = ThemeContext.useTheme();
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState<'roles' | 'tracking'>('tracking');
    
    // Sample data - Replace with actual API calls
    const [users] = useState<User[]>([
        { id: '1', name: 'John Doe', role: 'Group Admin', email: 'john@example.com' },
        { id: '2', name: 'Jane Smith', role: 'Employee', email: 'jane@example.com' },
    ]);

    const [permissions] = useState<Permission[]>([
        { id: '1', name: 'Submit Expenses', description: 'Can submit expense reports', enabled: true },
        { id: '2', name: 'View Team Reports', description: 'Access to team reports', enabled: true },
        { id: '3', name: 'Manage Shifts', description: 'Can modify team shifts', enabled: false },
    ]);

    const [roles, setRoles] = useState<Role[]>([
        { 
            id: '1', 
            name: 'Group Admin', 
            description: 'Full access to manage team and approve requests',
            permissions: ['1', '2', '3'],
            isFixed: true,
            activePermissions: ['1', '2', '3']
        },
        { 
            id: '2', 
            name: 'Employee', 
            description: 'Basic employee access',
            permissions: ['1'],
            isFixed: false,
            activePermissions: ['1']
        },
    ]);

    const [activityLogs] = useState<ActivityLog[]>([
        {
            id: '1',
            action: 'Role Change',
            user: 'John Doe',
            timestamp: '2024-01-10 14:30',
            details: 'Changed to Team Lead'
        },
    ]);

    // Add new states
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [roleModal, setRoleModal] = useState<RoleChangeModal>({
        visible: false,
        selectedRole: ''
    });

    // Use the tracking permissions store
    const {
        mergedData,
        isLoading: storeIsLoading,
        isUpdating,
        searchQuery,
        error: storeError,
        fetchEmployees,
        fetchTrackingPermissions,
        updateTrackingPermission: updateTrackingPermissionStore,
        updateExpensePermission: updateExpensePermissionStore,
        setSearchQuery,
        refreshData
    } = useTrackingPermissionsStore();
    
    // Add back useLocalSearchParams to get the returned data
    const params = useLocalSearchParams();

    // Add back effect to handle returned data from edit-role
    useEffect(() => {
        if (params.updatedRoleId && params.enabledPermissions) {
            const enabledPermissions = JSON.parse(params.enabledPermissions as string);
            setRoles(currentRoles => 
                currentRoles.map(role => {
                    if (role.id === params.updatedRoleId) {
                        return {
                            ...role,
                            activePermissions: enabledPermissions
                        };
                    }
                    return role;
                })
            );
        }
    }, [params.updatedRoleId, params.enabledPermissions]);

    // Use animation value for switch toggling
    const fadeAnim = useRef(new Animated.Value(1)).current;
    
    // Update tracking permission with animation
    const updateTrackingPermission = async (userId: number, field: TrackingField, value: boolean | string) => {
        // Fade out
        Animated.timing(fadeAnim, {
            toValue: 0.4,
            duration: 200,
            useNativeDriver: true,
        }).start();
        
        // Update the permission
        await updateTrackingPermissionStore(token!, userId, field, value);
        
        // Fade back in
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };
    
    // Refresh function that uses the store
    const handleRefresh = async () => {
        await refreshData(token!);
    };
    
    // Load data on mount and when activeTab changes
    useEffect(() => {
        if (activeTab === 'tracking') {
            fetchEmployees(token!);
            fetchTrackingPermissions(token!);
        }
    }, [activeTab]);

    const handleBulkDelete = () => {
        Alert.alert(
            'Delete Users',
            `Are you sure you want to delete ${selectedUsers.length} users?`,
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        // Filter out selected users
                        const updatedUsers = users.filter(user => !selectedUsers.includes(user.id));
                        // Update users state here
                        setSelectedUsers([]);
                        // Show success message
                        Alert.alert('Success', 'Users deleted successfully');
                    }
                }
            ]
        );
    };

    const handleRoleChange = async (newRole: string) => {
        try {
            setIsLoading(true);
            // Add your API call here
            // await fetch(...);
            
            setSelectedUsers([]);
            setRoleModal(prev => ({ ...prev, visible: false }));
            Alert.alert('Success', 'Roles updated successfully');
        } catch (err) {
            Alert.alert('Error', 'Failed to update roles. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const renderHeader = () => (
        <LinearGradient
            colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
            style={[styles.header, { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 10 }]}
        >
            <View className="px-6">
                <View className="flex-row items-center">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="mr-4 p-2 rounded-full"
                        style={[styles.backButton, { backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6' }]}
                    >
                        <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFFFFF' : '#000000'} />
                    </TouchableOpacity>
                    <View>
                        <Text className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            User Permissions
                        </Text>
                        <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                            Manage roles and permissions
                        </Text>
                    </View>
                </View>
            </View>

            {/* Tab Navigation */}
            <View className="flex-row px-6 mt-4">
                {(['roles', 'tracking'] as const).map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        className={`mr-4 pb-2 ${
                            activeTab === tab 
                                ? 'border-b-2 border-blue-500' 
                                : ''
                        }`}
                    >
                        <Text
                            className={`${
                                activeTab === tab
                                    ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                                    : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            } font-medium`}
                        >
                            {tab === 'tracking' ? 'Tracking' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </LinearGradient>
    );

    const renderRolesTab = () => (
        <View className="px-6 py-4">
            {roles.map((role) => (
                <View 
                    key={role.id}
                    className={`mb-4 p-4 rounded-xl ${
                        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    }`}
                    style={styles.card}
                >
                    <View className="flex-row justify-between items-center mb-2">
                        <View className="flex-row items-center">
                            <Text className={`text-lg font-semibold ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                                {role.name}
                            </Text>
                            {role.isFixed && (
                                <View className="ml-2 px-2 py-1 rounded-md bg-blue-100">
                                    <Text className="text-blue-800 text-xs">Default</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <Text className={`mb-3 ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                        {role.description}
                    </Text>
                    <View className="border-t border-gray-200 pt-3">
                        <Text className={`mb-2 font-medium ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                            Permissions:
                        </Text>
                        <View>
                            {permissions.map(permission => (
                                <View 
                                    key={permission.id}
                                    className="flex-row items-center mb-2 py-2"
                                >
                                    <View className="flex-row items-center flex-1">
                                        <Ionicons
                                            name={role.activePermissions?.includes(permission.id)
                                                ? "checkmark-circle"
                                                : "close-circle"}
                                            size={20}
                                            color={role.activePermissions?.includes(permission.id)
                                                ? theme === 'dark' ? '#10B981' : '#059669'
                                                : theme === 'dark' ? '#EF4444' : '#DC2626'
                                            }
                                        />
                                        <View className="ml-2 flex-1">
                                            <Text className={`${
                                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                            }`}>
                                                {permission.name}
                                            </Text>
                                            <Text className={`text-sm ${
                                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                            }`}>
                                                {permission.description}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                    
                    {role.isFixed && (
                        <View className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-gray-700/50">
                            <Text className={`text-sm ${
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                                Group Admin role has full access and cannot be modified
                            </Text>
                        </View>
                    )}
                </View>
            ))}
        </View>
    );

    const renderSearchBar = () => (
        <View className="mb-4">
            <View 
                className={`flex-row items-center px-4 py-2 rounded-xl ${
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                }`}
                style={styles.searchBar}
            >
                <Ionicons 
                    name="search-outline" 
                    size={20} 
                    color={theme === 'dark' ? '#9CA3AF' : '#6B7280'} 
                />
                <TextInput
                    placeholder="Search users..."
                    placeholderTextColor={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    className={`ml-2 flex-1 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                />
            </View>
        </View>
    );

    const renderBulkActions = () => (
        false && (
            <View 
                className={`absolute bottom-0 left-0 right-0 p-4 ${
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                }`}
                style={styles.bulkActions}
            >
                <View className="flex-row justify-between items-center">
                    <Text className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {selectedUsers.length} selected
                    </Text>
                    <TouchableOpacity 
                        className="bg-red-500 px-4 py-2 rounded-lg"
                        onPress={handleBulkDelete}
                    >
                        <Text className="text-white">Delete</Text>
                    </TouchableOpacity>
                </View>
            </View>
        )
    );

    // Enhanced tracking tab render function with modern UI
    const renderTrackingTab = () => (
      <View className="px-4 py-2 pb-20">
        {/* Enhanced search bar */}
        <View
          className={`flex-row items-center px-4 py-3 rounded-xl shadow-sm mb-4 ${
            theme === "dark" ? "bg-gray-800" : "bg-white"
          }`}
          style={styles.searchBarEnhanced}
        >
          <Ionicons
            name="search-outline"
            size={20}
            color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
          />
          <TextInput
            placeholder="Search by name or employee number..."
            placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className={`ml-2 flex-1 ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          />
          {searchQuery && searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
              />
            </TouchableOpacity>
          )}
        </View>

        {storeIsLoading ? (
          <View className="items-center justify-center py-8">
            <ActivityIndicator
              size="large"
              color={theme === "dark" ? "#60A5FA" : "#3B82F6"}
            />
            <Text
              className={`mt-2 ${
                theme === "dark" ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Loading tracking permissions...
            </Text>
          </View>
        ) : storeError ? (
          <View className="items-center justify-center py-8">
            <Ionicons
              name="alert-circle-outline"
              size={40}
              color={theme === "dark" ? "#EF4444" : "#DC2626"}
            />
            <Text
              className={`mt-2 text-center ${
                theme === "dark" ? "text-gray-300" : "text-gray-700"
              }`}
            >
              {storeError}
            </Text>
            <TouchableOpacity
              className="mt-4 bg-blue-500 px-4 py-2 rounded-lg"
              onPress={handleRefresh}
            >
              <Text className="text-white">Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : mergedData.length === 0 ? (
          <View className="items-center justify-center py-8">
            <Ionicons
              name="location-outline"
              size={40}
              color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
            />
            <Text
              className={`mt-2 text-center ${
                theme === "dark" ? "text-gray-300" : "text-gray-700"
              }`}
            >
              No employee tracking permissions found
            </Text>
            <TouchableOpacity
              className="mt-4 bg-blue-500 px-4 py-2 rounded-lg"
              onPress={handleRefresh}
            >
              <Text className="text-white">Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={mergedData.filter(
              (perm) =>
                perm.user_name
                  .toLowerCase()
                  .includes((searchQuery || "").toLowerCase()) ||
                (perm.employee_number &&
                  perm.employee_number.includes(searchQuery || ""))
            )}
            keyExtractor={(item) => `permission-${item.id}-${item.user_id}`}
            renderItem={({ item }) => (
              <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "timing", duration: 300 }}
                className={`mb-4 rounded-xl overflow-hidden shadow-sm ${
                  theme === "dark" ? "bg-gray-800" : "bg-white"
                }`}
                style={styles.cardEnhanced}
              >
                <Animated.View style={{ opacity: fadeAnim }}>
                  <View className="p-4">
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text
                          className={`text-lg font-semibold ${
                            theme === "dark" ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {item.user_name}
                        </Text>
                        <View className="flex-row items-center mt-1">
                          <MaterialCommunityIcons
                            name="badge-account-horizontal-outline"
                            size={16}
                            color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
                          />
                          <Text
                            className={`ml-1 ${
                              theme === "dark"
                                ? "text-gray-400"
                                : "text-gray-600"
                            }`}
                          >
                            {item.employee_number || "No Employee Number"}
                          </Text>
                        </View>
                      </View>

                      {item.department && (
                        <View className="bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                          <Text className="text-blue-800 dark:text-blue-300 text-xs font-medium">
                            {item.department}
                          </Text>
                        </View>
                      )}
                    </View>

                    {item.designation && (
                      <View className="mt-1">
                        <Text
                          className={`text-sm ${
                            theme === "dark" ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          {item.designation}
                        </Text>
                      </View>
                    )}

                    <View className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <View className="flex-row items-center justify-between py-2">
                        <View className="flex-row items-center flex-1">
                          <Ionicons
                            name="map-outline"
                            size={20}
                            color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
                          />
                          <Text
                            className={`ml-2 flex-1 ${
                              theme === "dark"
                                ? "text-gray-300"
                                : "text-gray-700"
                            }`}
                          >
                            Can Override Geofence
                          </Text>
                        </View>
                        <Switch
                          value={item.can_override_geofence}
                          onValueChange={(value) =>
                            updateTrackingPermission(
                              item.user_id,
                              "can_override_geofence",
                              value
                            )
                          }
                          disabled={isUpdating}
                          trackColor={{
                            false: theme === "dark" ? "#4B5563" : "#D1D5DB",
                            true: "#3B82F6",
                          }}
                          thumbColor={theme === "dark" ? "#E5E7EB" : "#FFFFFF"}
                          ios_backgroundColor={
                            theme === "dark" ? "#4B5563" : "#D1D5DB"
                          }
                        />
                      </View>

                      {/* Add new Location Required toggle */}
                      <View className="flex-row items-center justify-between py-2">
                        <View className="flex-row items-center flex-1">
                          <Ionicons
                            name="location-outline"
                            size={20}
                            color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
                          />
                          <Text
                            className={`ml-2 flex-1 ${
                              theme === "dark"
                                ? "text-gray-300"
                                : "text-gray-700"
                            }`}
                          >
                            Location Required for Shift
                          </Text>
                        </View>
                        <Switch
                          value={item.location_required_for_shift}
                          onValueChange={(value) =>
                            updateTrackingPermission(
                              item.user_id,
                              "location_required_for_shift",
                              value
                            )
                          }
                          disabled={isUpdating}
                          trackColor={{
                            false: theme === "dark" ? "#4B5563" : "#D1D5DB",
                            true: "#3B82F6",
                          }}
                          thumbColor={theme === "dark" ? "#E5E7EB" : "#FFFFFF"}
                          ios_backgroundColor={
                            theme === "dark" ? "#4B5563" : "#D1D5DB"
                          }
                        />
                      </View>

                      {/* Add new Expense Submission toggle */}
                      <View className="flex-row items-center justify-between py-2">
                        <View className="flex-row items-center flex-1">
                          <Ionicons
                            name="cash-outline"
                            size={20}
                            color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
                          />
                          <Text
                            className={`ml-2 flex-1 ${
                              theme === "dark"
                                ? "text-gray-300"
                                : "text-gray-700"
                            }`}
                          >
                            Can Submit Expenses Anytime
                          </Text>
                        </View>
                        <Switch
                          value={item.can_submit_expenses_anytime}
                          onValueChange={(value) => updateExpensePermissionStore(token!, item.user_id, value)}
                          disabled={isUpdating}
                          trackColor={{ 
                            false: theme === 'dark' ? '#4B5563' : '#D1D5DB',
                            true: '#3B82F6'
                          }}
                          thumbColor={theme === 'dark' ? '#E5E7EB' : '#FFFFFF'}
                          ios_backgroundColor={theme === 'dark' ? '#4B5563' : '#D1D5DB'}
                        />
                      </View>

                      <View className="pt-2">
                        <View className="flex-row items-center mb-2">
                          <Ionicons
                            name="speedometer-outline"
                            size={20}
                            color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
                          />
                          <Text
                            className={`ml-2 ${
                              theme === "dark"
                                ? "text-gray-300"
                                : "text-gray-700"
                            }`}
                          >
                            Tracking Precision
                          </Text>
                        </View>
                        <View className="flex-row">
                          {(["low", "medium", "high"] as const).map(
                            (precision) => (
                              <TouchableOpacity
                                key={precision}
                                style={[
                                  styles.precisionButton,
                                  {
                                    flex: 1,
                                    marginHorizontal: 4,
                                    paddingVertical: 10,
                                    borderRadius: 10,
                                    alignItems: "center",
                                    backgroundColor:
                                      item.tracking_precision === precision
                                        ? theme === "dark"
                                          ? "#3B82F6"
                                          : "#2563EB"
                                        : theme === "dark"
                                        ? "#374151"
                                        : "#F3F4F6",
                                  },
                                ]}
                                onPress={() =>
                                  updateTrackingPermission(
                                    item.user_id,
                                    "tracking_precision",
                                    precision
                                  )
                                }
                                disabled={isUpdating}
                              >
                                <Text
                                  style={{
                                    color:
                                      item.tracking_precision === precision
                                        ? "#FFFFFF"
                                        : theme === "dark"
                                        ? "#E5E7EB"
                                        : "#374151",
                                    fontWeight: "600",
                                    fontSize: 13,
                                  }}
                                >
                                  {precision.charAt(0).toUpperCase() +
                                    precision.slice(1)}
                                </Text>
                              </TouchableOpacity>
                            )
                          )}
                        </View>
                      </View>
                    </View>

                    <Text
                      className={`mt-3 text-xs ${
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Last updated: {new Date(item.updated_at).toLocaleString()}
                    </Text>
                  </View>
                </Animated.View>
              </MotiView>
            )}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={storeIsLoading}
                onRefresh={handleRefresh}
                colors={[theme === "dark" ? "#60A5FA" : "#3B82F6"]}
                tintColor={theme === "dark" ? "#60A5FA" : "#3B82F6"}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );

    // Add role change modal
    const renderRoleModal = () => (
        <Modal
            visible={roleModal.visible}
            transparent
            animationType="slide"
            onRequestClose={() => setRoleModal(prev => ({ ...prev, visible: false }))}
        >
            <View className="flex-1 justify-end">
                <View 
                    className={`rounded-t-3xl p-6 ${
                        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    }`}
                >
                    <Text className={`text-xl font-bold mb-4 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                        Change Role
                    </Text>
                    <ScrollView className="max-h-72">
                        {roles.map(role => (
                            <TouchableOpacity
                                key={role.id}
                                onPress={() => handleRoleChange(role.id)}
                                className={`p-4 mb-2 rounded-xl ${
                                    roleModal.selectedRole === role.id
                                        ? 'bg-blue-500'
                                        : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                }`}
                            >
                                <Text className={`font-medium ${
                                    roleModal.selectedRole === role.id
                                        ? 'text-white'
                                        : theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>
                                    {role.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <View className="flex-row justify-end mt-4">
                        <TouchableOpacity
                            onPress={() => setRoleModal(prev => ({ ...prev, visible: false }))}
                            className="px-4 py-2 rounded-lg mr-2"
                        >
                            <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                Cancel
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.container}>
                {renderHeader()}
                
                {isLoading && activeTab !== 'tracking' ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#3B82F6" />
                    </View>
                ) : error && activeTab !== 'tracking' ? (
                    <View className="flex-1 justify-center items-center p-6">
                        <Text className={`text-center mb-4 ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                            {error}
                        </Text>
                        <TouchableOpacity
                            className="bg-blue-500 px-4 py-2 rounded-lg"
                            onPress={handleRefresh}
                        >
                            <Text className="text-white">Try Again</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    activeTab === 'tracking' ? (
                        // Directly render the tracking tab without ScrollView wrapper
                        renderTrackingTab()
                    ) : (
                        // Only use ScrollView for the roles tab
                    <ScrollView 
                        className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                        showsVerticalScrollIndicator={false}
                    >
                            {renderRolesTab()}
                    </ScrollView>
                    )
                )}
                
                {renderBulkActions()}
                {renderRoleModal()}
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        paddingBottom: 16,
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
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    searchBar: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    bulkActions: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    cardEnhanced: {
        elevation: 3,
        borderRadius: 16,
        overflow: 'hidden',
    },
    searchBarEnhanced: {
        elevation: 2,
        borderRadius: 12,
    },
    precisionButton: {
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
    },
});
