import React, { useState, useEffect, useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, StatusBar, StyleSheet, TextInput, Alert, ActivityIndicator, Modal, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ThemeContext from '../../../context/ThemeContext';

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

export default function UserPermissions() {
    const router = useRouter();
    const { theme } = ThemeContext.useTheme();
    const [activeTab, setActiveTab] = useState<'roles' | 'users' | 'logs'>('roles');
    
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
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [roleModal, setRoleModal] = useState<RoleChangeModal>({
        visible: false,
        selectedRole: ''
    });

    // Add useLocalSearchParams to get the returned data
    const params = useLocalSearchParams();

    // Effect to handle returned data from edit-role
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

    // Add refresh function
    const refreshData = async () => {
        try {
            setIsLoading(true);
            setError(null);
            // Add your API calls here
            // const response = await fetch(...);
            // const data = await response.json();
            // Update state with new data
        } catch (err) {
            setError('Failed to load data. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, []);

    // Add handlers for user management
    const handleAddUser = () => {
        // Navigate to add user form
        router.push('/(dashboard)/Group-Admin/settings/add-user');
    };

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

    const handleUserSelect = (userId: string) => {
        setSelectedUsers(prev => 
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleEditRole = (roleId: string) => {
        const role = roles.find(r => r.id === roleId);
        if (role?.isFixed) {
            Alert.alert(
                'Cannot Modify Role',
                'The Group Admin role cannot be modified as it has full system access.'
            );
            return;
        }
        router.push({
            pathname: '/(dashboard)/Group-Admin/settings/edit-role',
            params: { id: roleId }
        });
    };

    const handlePermissionToggle = (roleId: string, permissionId: string) => {
        setRoles(currentRoles => 
            currentRoles.map(role => {
                if (role.id === roleId && !role.isFixed) {
                    const newActivePermissions = role.activePermissions || [];
                    if (newActivePermissions.includes(permissionId)) {
                        return {
                            ...role,
                            activePermissions: newActivePermissions.filter(id => id !== permissionId)
                        };
                    } else {
                        return {
                            ...role,
                            activePermissions: [...newActivePermissions, permissionId]
                        };
                    }
                }
                return role;
            })
        );
    };

    const renderHeader = () => (
        <LinearGradient
            colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
            style={[styles.header, { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 0 }]}
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
                {(['roles', 'users', 'logs'] as const).map((tab) => (
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
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
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
                        {!role.isFixed && (
                            <TouchableOpacity 
                                className="bg-blue-500 px-3 py-1 rounded-lg"
                                onPress={() => handleEditRole(role.id)}
                            >
                                <Text className="text-white">Edit</Text>
                            </TouchableOpacity>
                        )}
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
                        <View className="mt-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
                            <Text className={`text-sm ${
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
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
        activeTab === 'users' && selectedUsers.length > 0 && (
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

    const renderUsersTab = () => (
        <View className="px-6 py-4 pb-20">
            {renderSearchBar()}
            {users
                .filter(user => 
                    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    user.email.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((user) => (
                    <TouchableOpacity 
                        key={user.id}
                        onPress={() => handleUserSelect(user.id)}
                        onLongPress={() => handleUserSelect(user.id)}
                    >
                        <View 
                            className={`mb-4 p-4 rounded-xl ${
                                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                            } ${
                                selectedUsers.includes(user.id) ? 'border-2 border-blue-500' : ''
                            }`}
                            style={styles.card}
                        >
                            <View className="flex-row justify-between items-center">
                                <View>
                                    <Text className={`text-lg font-semibold ${
                                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    }`}>
                                        {user.name}
                                    </Text>
                                    <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                        {user.email}
                                    </Text>
                                </View>
                                <View className={`px-3 py-1 rounded-lg ${
                                    user.role === 'Group Admin' ? 'bg-blue-500' : 'bg-green-500'
                                }`}>
                                    <Text className="text-white">{user.role}</Text>
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>
                ))
            }
        </View>
    );

    const renderLogsTab = () => (
        <View className="px-6 py-4">
            {activityLogs.map((log) => (
                <View 
                    key={log.id}
                    className={`mb-4 p-4 rounded-xl ${
                        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    }`}
                    style={styles.card}
                >
                    <View className="flex-row items-center mb-2">
                        <Ionicons 
                            name="time-outline" 
                            size={20} 
                            color={theme === 'dark' ? '#60A5FA' : '#2563EB'} 
                        />
                        <Text className={`ml-2 ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                            {log.timestamp}
                        </Text>
                    </View>
                    <Text className={`text-lg font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                        {log.action}
                    </Text>
                    <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        {log.user} - {log.details}
                    </Text>
                </View>
            ))}
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
                
                {isLoading ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#3B82F6" />
                    </View>
                ) : error ? (
                    <View className="flex-1 justify-center items-center p-6">
                        <Text className={`text-center mb-4 ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                            {error}
                        </Text>
                        <TouchableOpacity
                            className="bg-blue-500 px-4 py-2 rounded-lg"
                            onPress={refreshData}
                        >
                            <Text className="text-white">Try Again</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <ScrollView 
                        className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                        showsVerticalScrollIndicator={false}
                    >
                        {activeTab === 'roles' && renderRolesTab()}
                        {activeTab === 'users' && renderUsersTab()}
                        {activeTab === 'logs' && renderLogsTab()}
                    </ScrollView>
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
    }
});
