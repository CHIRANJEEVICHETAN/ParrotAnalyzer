import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { useAuth } from "../context/AuthContext";
import ThemeContext from "../context/ThemeContext";
import { Picker } from "@react-native-picker/picker";
import axios from "axios";
import PushNotificationService from "../utils/pushNotificationService";
import { User } from "../types";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

interface NotificationPayload {
  title: string;
  message: string;
  type: string;
  priority: string;
  userId?: string;
  targetRole?: string;
  groupId?: number;
  groupAdminId?: number;
  userIds?: string[];
}

interface ExtendedUser extends User {
  group_id?: number;
}

interface GroupedUsers {
  [key: string]: {
    id: string;
    name: string;
    email: string;
    role: string;
  }[];
}

export default function TestNotifications() {
  const { theme } = ThemeContext.useTheme();
  const { user, token } = useAuth();
  const isDark = theme === "dark";
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [testTarget, setTestTarget] = useState<"self" | "others">("self");
  const [targetRole, setTargetRole] = useState<string>("employee");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupedUsers, setGroupedUsers] = useState<GroupedUsers>({});
  const [notificationData, setNotificationData] = useState({
    title: "",
    message: "",
    type: "test",
    priority: "default",
  });

  useEffect(() => {
    if (user?.role === "management" && testTarget === "others") {
      console.log("Management user selection section:", {
        userRole: user?.role,
        testTarget,
        hasGroupedUsers: Object.keys(groupedUsers).length > 0,
      });
    }
  }, [user?.role, testTarget, groupedUsers]);

  useEffect(() => {
    if (selectedUsers.length > 0 || targetRole === "specific") {
      console.log("User list section:", {
        selectedUsersCount: selectedUsers.length,
        targetRole,
        availableRoles: Object.keys(groupedUsers),
        totalUsers: Object.values(groupedUsers).flat().length,
      });
    }
  }, [selectedUsers, targetRole, groupedUsers]);

  // Fetch users when component mounts for management role
  useEffect(() => {
    if (user?.role === "management") {
      console.log("User is management, fetching users...");
      console.log("Current user:", user);
      fetchUsers();
    } else {
      console.log("User role is not management:", user?.role);
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      console.log("Starting fetchUsers...");
      const baseUrl = process.env.EXPO_PUBLIC_API_URL;
      const endpoint = `${baseUrl}/api/management-notifications/users`;
      console.log("API URL:", endpoint);
      console.log("Token:", token ? "Present" : "Missing");
      console.log("Current user role:", user?.role);

      if (!token) {
        console.error("No authentication token available");
        Alert.alert("Error", "Please log in again");
        return;
      }

      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Users API Response:", {
        status: response.status,
        data: response.data,
        userCount: Object.values(response.data).flat().length,
        roles: Object.keys(response.data),
      });

      setGroupedUsers(response.data);

      // Debug grouped users after state update
      setTimeout(() => {
        console.log("GroupedUsers state after update:", {
          roles: Object.keys(groupedUsers),
          totalUsers: Object.values(groupedUsers).flat().length,
          roleBreakdown: Object.entries(groupedUsers).map(([role, users]) => ({
            role,
            count: users.length,
          })),
        });
      }, 100);
    } catch (error) {
      console.error("Error fetching users:", error);
      if (axios.isAxiosError(error)) {
        console.error("Response data:", error.response?.data);
        console.error("Response status:", error.response?.status);
        console.error("Request config:", {
          url: error.config?.url,
          headers: error.config?.headers,
          method: error.config?.method,
        });
      }
      Alert.alert(
        "Error",
        "Failed to fetch users. Please check your connection and try again."
      );
    }
  };

  const [deviceToken, setDeviceToken] = useState<string | null>(null);

  const registerDevice = async () => {
    try {
      if (!user || !token) {
        Alert.alert("Error", "Please log in to register your device.");
        return;
      }

      setIsRegistering(true);
      const response =
        await PushNotificationService.registerForPushNotifications();

      if (response.success && response.token) {
        setDeviceToken(response.token);
        await PushNotificationService.registerDeviceWithBackend(
          user.id.toString(),
          response.token,
          token,
          user.role
        );
        Alert.alert("Success", "Device registered successfully!");
      } else {
        Alert.alert("Error", response.message);
      }
    } catch (error) {
      console.error("Device registration error:", error);
      Alert.alert(
        "Error",
        "Failed to register device. Please check your connection and try again."
      );
    } finally {
      setIsRegistering(false);
    }
  };

  const sendTestNotification = async () => {
    try {
      if (!notificationData.title || !notificationData.message) {
        Alert.alert("Error", "Please enter both title and message");
        return;
      }

      setIsSending(true);
      const baseUrl = process.env.EXPO_PUBLIC_API_URL;
      let endpoint = "";
      let payload: NotificationPayload = {
        ...notificationData,
      };

      const extendedUser = user as ExtendedUser | null;
      console.log("Current user data:", extendedUser);

      if (user?.role === "employee") {
        endpoint = `${baseUrl}/api/notifications/test`;
        payload = {
          ...notificationData,
          userId: user.id.toString(),
          type: "test",
        };
      } else if (user?.role === "group-admin") {
        if (testTarget === "self") {
          endpoint = `${baseUrl}/api/group-admin-notifications/test`;
          payload = {
            ...notificationData,
            userId: user.id.toString(),
            type: "test",
          };
        } else {
          // The current user is the group-admin, so we can use their ID directly
          endpoint = `${baseUrl}/api/group-admin-notifications/send-group`;
          payload = {
            title: notificationData.title,
            message: notificationData.message,
            type: "group",
            priority: notificationData.priority,
            groupAdminId: parseInt(user.id),
          };
        }
      } else if (user?.role === "management") {
        if (testTarget === "self") {
          endpoint = `${baseUrl}/api/management-notifications/test`;
          payload = {
            ...notificationData,
            userId: user.id.toString(),
            type: "test",
          };
        } else {
          if (selectedUsers.length > 0) {
            // Send to specific users
            endpoint = `${baseUrl}/api/management-notifications/send-users`;
            payload = {
              ...notificationData,
              userIds: selectedUsers,
              type: "test",
            };
          } else {
            // Send to all users of selected role
            endpoint = `${baseUrl}/api/management-notifications/send-role`;
            payload = {
              ...notificationData,
              targetRole,
              type: "test",
            };
          }
        }
      } else {
        Alert.alert("Error", "Unauthorized to send notifications");
        return;
      }

      console.log("Sending notification:", {
        endpoint,
        payload,
        headers: { Authorization: `Bearer ${token}` },
      });

      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Notification response:", response.data);

      Alert.alert("Success", "Test notification sent!");
      setNotificationData({
        title: "",
        message: "",
        type: "test",
        priority: "default",
      });
    } catch (error) {
      console.error("Send notification error:", error);
      if (axios.isAxiosError(error)) {
        console.error("Response data:", error.response?.data);
        const errorMessage =
          error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to send notification";
        Alert.alert("Error", errorMessage);
      } else {
        Alert.alert(
          "Error",
          error instanceof Error ? error.message : "Failed to send notification"
        );
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Test Notifications",
          headerStyle: {
            backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
          },
          headerTintColor: isDark ? "#FFFFFF" : "#000000",
          headerShadowVisible: false,
        }}
      />

      <ScrollView className={`flex-1 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
        <View className="p-4">
          <View className="mb-6">
            <Text
              className={`text-lg font-bold mb-2 ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Device Registration
            </Text>
            <Text
              className={`mb-4 ${isDark ? "text-gray-300" : "text-gray-600"}`}
            >
              Current Token: {deviceToken || "Not registered"}
            </Text>
            <Pressable
              onPress={registerDevice}
              disabled={isRegistering}
              className={`p-4 rounded-lg ${
                isDark ? "bg-blue-600" : "bg-blue-500"
              } ${isRegistering ? "opacity-50" : ""}`}
            >
              {isRegistering ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center font-medium">
                  Register Device
                </Text>
              )}
            </Pressable>
          </View>

          <View className="space-y-4">
            <Text
              className={`text-lg font-bold mb-2 ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Send Test Notification
            </Text>

            {(user?.role === "group-admin" || user?.role === "management") && (
              <View
                className={`border rounded-lg p-4 ${
                  isDark ? "border-gray-700" : "border-gray-200"
                }`}
              >
                <Text
                  className={`mb-2 ${
                    isDark ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  Test Target
                </Text>
                <Picker
                  selectedValue={testTarget}
                  onValueChange={(value: "self" | "others") =>
                    setTestTarget(value)
                  }
                  style={{
                    backgroundColor: isDark ? "#374151" : "#F3F4F6",
                  }}
                >
                  <Picker.Item label="Test Self" value="self" />
                  <Picker.Item
                    label={
                      user?.role === "group-admin"
                        ? "Test Employees"
                        : "Test Others"
                    }
                    value="others"
                  />
                </Picker>
              </View>
            )}

            {user?.role === "management" && testTarget === "others" && (
              <View className="mb-4">
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Select Recipients
                </Text>
                <View
                  className={`p-4 rounded-lg mb-4 ${
                    isDark ? "bg-gray-800" : "bg-gray-100"
                  }`}
                >
                  <Picker
                    selectedValue={
                      selectedUsers.length > 0 ? "specific" : targetRole
                    }
                    onValueChange={(value) => {
                      console.log("Picker value changed:", value);
                      if (value === "specific") {
                        // Keep current selection
                      } else {
                        setSelectedUsers([]);
                        setTargetRole(value);
                      }
                    }}
                    style={{
                      backgroundColor: isDark ? "#374151" : "#F3F4F6",
                    }}
                  >
                    <Picker.Item label="All Employees" value="employee" />
                    <Picker.Item label="All Group Admins" value="group-admin" />
                    <Picker.Item
                      label="Select Specific Users"
                      value="specific"
                    />
                  </Picker>

                  {(selectedUsers.length > 0 || targetRole === "specific") && (
                    <View className="mt-4">
                      <Text
                        className={`text-sm font-medium mb-2 ${
                          isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Selected Users ({selectedUsers.length})
                      </Text>
                      <ScrollView
                        className={`max-h-40 rounded-lg ${
                          isDark ? "bg-gray-800" : "bg-gray-100"
                        }`}
                        contentContainerStyle={{ padding: 16 }}
                      >
                        {Object.keys(groupedUsers).length === 0 ? (
                          <Text
                            className={`text-center ${
                              isDark ? "text-gray-400" : "text-gray-500"
                            }`}
                          >
                            No users available
                          </Text>
                        ) : (
                          Object.entries(groupedUsers).map(([role, users]) => {
                            console.log(
                              `Rendering ${role} group with ${users.length} users`
                            );
                            return (
                              <View key={role} className="mb-4">
                                <Text
                                  className={`text-sm font-semibold mb-2 ${
                                    isDark ? "text-gray-400" : "text-gray-600"
                                  }`}
                                >
                                  {role.charAt(0).toUpperCase() + role.slice(1)}
                                  s ({users.length})
                                </Text>
                                {users.map((user) => (
                                  <Pressable
                                    key={user.id}
                                    onPress={() => {
                                      setSelectedUsers((prev) => {
                                        const isSelected = prev.includes(
                                          user.id
                                        );
                                        console.log("User selection toggled:", {
                                          userId: user.id,
                                          userName: user.name,
                                          wasSelected: isSelected,
                                          newSelectionCount: isSelected
                                            ? prev.length - 1
                                            : prev.length + 1,
                                        });
                                        return isSelected
                                          ? prev.filter((id) => id !== user.id)
                                          : [...prev, user.id];
                                      });
                                    }}
                                    className={`flex-row items-center py-2 px-2 mb-1 rounded-md ${
                                      selectedUsers.includes(user.id)
                                        ? isDark
                                          ? "bg-blue-600"
                                          : "bg-blue-100"
                                        : "bg-transparent"
                                    }`}
                                  >
                                    <View
                                      className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                                        selectedUsers.includes(user.id)
                                          ? isDark
                                            ? "border-white bg-white"
                                            : "border-blue-500 bg-blue-500"
                                          : isDark
                                          ? "border-gray-500"
                                          : "border-gray-400"
                                      }`}
                                    >
                                      {selectedUsers.includes(user.id) && (
                                        <MaterialCommunityIcons
                                          name="check"
                                          size={14}
                                          color={isDark ? "#1F2937" : "#FFFFFF"}
                                        />
                                      )}
                                    </View>
                                    <View>
                                      <Text
                                        className={`font-medium ${
                                          selectedUsers.includes(user.id)
                                            ? isDark
                                              ? "text-white"
                                              : "text-blue-700"
                                            : isDark
                                            ? "text-gray-300"
                                            : "text-gray-700"
                                        }`}
                                      >
                                        {user.name}
                                      </Text>
                                      <Text
                                        className={`text-xs ${
                                          selectedUsers.includes(user.id)
                                            ? isDark
                                              ? "text-gray-300"
                                              : "text-blue-600"
                                            : isDark
                                            ? "text-gray-500"
                                            : "text-gray-500"
                                        }`}
                                      >
                                        {user.email}
                                      </Text>
                                    </View>
                                  </Pressable>
                                ))}
                              </View>
                            );
                          })
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
            )}

            <TextInput
              placeholder="Notification Title"
              value={notificationData.title}
              onChangeText={(text) =>
                setNotificationData({ ...notificationData, title: text })
              }
              className={`p-4 rounded-lg mb-4 ${
                isDark
                  ? "bg-gray-800 text-white"
                  : "bg-white text-gray-900 border border-gray-200"
              }`}
              placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
            />

            <TextInput
              placeholder="Notification Message"
              value={notificationData.message}
              onChangeText={(text) =>
                setNotificationData({ ...notificationData, message: text })
              }
              multiline
              numberOfLines={4}
              className={`p-4 rounded-lg mb-4 ${
                isDark
                  ? "bg-gray-800 text-white"
                  : "bg-white text-gray-900 border border-gray-200"
              }`}
              placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
              textAlignVertical="top"
            />

            <View
              className={`border rounded-lg p-4 mb-4 ${
                isDark ? "border-gray-700" : "border-gray-200"
              }`}
            >
              <Text
                className={`mb-2 ${isDark ? "text-gray-300" : "text-gray-600"}`}
              >
                Priority
              </Text>
              <Picker
                selectedValue={notificationData.priority}
                onValueChange={(value) =>
                  setNotificationData({
                    ...notificationData,
                    priority: value,
                  })
                }
                style={{
                  backgroundColor: isDark ? "#374151" : "#F3F4F6",
                }}
              >
                <Picker.Item label="Default" value="default" />
                <Picker.Item label="High" value="high" />
                <Picker.Item label="Low" value="low" />
              </Picker>
            </View>

            <Pressable
              onPress={sendTestNotification}
              disabled={isSending}
              className={`p-4 rounded-lg ${
                isDark ? "bg-blue-600" : "bg-blue-500"
              } ${isSending ? "opacity-50" : ""}`}
            >
              {isSending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center font-medium">
                  Send Test Notification
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
