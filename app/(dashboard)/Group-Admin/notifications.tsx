import React, { useState, useCallback, useRef, useMemo, useEffect, memo } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  Platform,
  StatusBar,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Keyboard,
  KeyboardAvoidingView,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import ThemeContext from "./../../context/ThemeContext";
import { useAuth } from "./../../context/AuthContext";
import PushNotificationsList from "./../../components/PushNotificationsList";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import axios from "axios";
import { LinearGradient } from 'expo-linear-gradient';
import BottomNav from "../../components/BottomNav";
import { groupAdminNavItems } from "./utils/navigationItems";
import { useNotifications, Notification } from "./../../context/NotificationContext";
import { Picker } from "@react-native-picker/picker";

type NotificationType = "all" | "group" | "general" | "announcement";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  employee_number?: string;
}

interface NotificationData {
  title: string;
  message: string;
  type: "all" | "user";
  priority: "default" | "high" | "low";
  selectedUsers: string[];
}

interface SendNotificationModalProps {
  visible: boolean;
  onClose: () => void;
  onSend: () => void;
  title: string;
  message: string;
  onTitleChange: (text: string) => void;
  onMessageChange: (text: string) => void;
  isDark: boolean;
  notificationMode: "all" | "user";
  onModeChange: (mode: "all" | "user") => void;
  priority: "default" | "high" | "low";
  onPriorityChange: (priority: "default" | "high" | "low") => void;
  selectedUsers: string[];
  onUserSelect: (userIds: string[]) => void;
  showSuccess: boolean;
  SuccessModal: () => JSX.Element;
}

const SendNotificationModal = memo(({ 
  visible, 
  onClose, 
  onSend, 
  title, 
  message, 
  onTitleChange, 
  onMessageChange, 
  isDark,
  notificationMode,
  onModeChange,
  priority,
  onPriorityChange,
  selectedUsers = [],
  onUserSelect,
  showSuccess,
  SuccessModal
}: SendNotificationModalProps) => {
  const { token } = useAuth();
  const titleInputRef = useRef<TextInput>(null);
  const messageInputRef = useRef<TextInput>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<Record<string, User[]>>({});
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      if (notificationMode === "user") {
        setIsLoadingUsers(true);
        try {
          const response = await axios.get(
            `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-notifications/users`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          
          if (response.data && typeof response.data === 'object') {
            setUsers(response.data);
          } else {
            console.error("[User Fetch] Invalid response format:", response.data);
            Alert.alert(
              "Error",
              "Failed to load users. Please try again."
            );
          }
        } catch (error) {
          console.error("[User Fetch] Error fetching users:", error);
          if (axios.isAxiosError(error)) {
            console.error("[User Fetch] Response data:", error.response?.data);
            console.error("[User Fetch] Status:", error.response?.status);
          }
          Alert.alert(
            "Error",
            "Failed to load users. Please try again."
          );
        } finally {
          setIsLoadingUsers(false);
        }
      } else {
        setUsers({});
      }
    };

    fetchUsers();
  }, [notificationMode, token]);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    if (visible && Platform.OS === 'android') {
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 300);
    }

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [visible]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const handleSend = useCallback(async () => {
    try {
      setIsLoading(true);
      Keyboard.dismiss();
      await onSend();
      setIsLoading(false);
      // Auto close after success
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      setIsLoading(false);
      // Error will be handled by the parent component
    }
  }, [onSend, handleClose]);

  const filteredUsers = useMemo(() => {
    if (!users || Object.keys(users).length === 0) {
      return {};
    }
    
    if (!searchQuery) return users;
    
    const query = searchQuery.toLowerCase();
    return Object.entries(users).reduce((acc, [role, roleUsers]) => {
      acc[role] = roleUsers.filter(user => 
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.employee_number && user.employee_number.toLowerCase().includes(query))
      );
      return acc;
    }, {} as Record<string, User[]>);
  }, [users, searchQuery]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View 
          style={{ 
            flex: 1,
            backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(107,114,128,0.5)',
            justifyContent: 'flex-end'
          }}
        >
          <View 
            style={{
              backgroundColor: isDark ? '#111827' : '#ffffff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 20,
              maxHeight: '95%',
              position: 'relative'
            }}
          >
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: 20,
              paddingHorizontal: 20
            }}>
              <Text style={{
                fontSize: 20,
                fontWeight: '600',
                color: isDark ? '#ffffff' : '#111827'
              }}>
                Send Group Notification
              </Text>
              <Pressable 
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                />
              </Pressable>
            </View>

            <ScrollView 
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: '80%' }}
              contentContainerStyle={{
                paddingHorizontal: 20
              }}
            >
              {/* Notification Mode Selection */}
              <View className="flex-row mb-4 bg-gray-100/5 p-1 rounded-lg">
                <Pressable
                  onPress={() => onModeChange("all")}
                  className={`flex-1 py-2.5 rounded-md ${
                    notificationMode === "all"
                      ? isDark
                        ? "bg-blue-600"
                        : "bg-blue-500"
                      : "bg-transparent"
                  }`}
                >
                  <Text
                    className={`text-center font-medium ${
                      notificationMode === "all"
                        ? "text-white"
                        : isDark
                          ? "text-gray-300"
                          : "text-gray-600"
                    }`}
                  >
                    All Employees
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onModeChange("user")}
                  className={`flex-1 py-2.5 rounded-md ${
                    notificationMode === "user"
                      ? isDark
                        ? "bg-blue-600"
                        : "bg-blue-500"
                      : "bg-transparent"
                  }`}
                >
                  <Text
                    className={`text-center font-medium ${
                      notificationMode === "user"
                        ? "text-white"
                        : isDark
                          ? "text-gray-300"
                          : "text-gray-600"
                    }`}
                  >
                    Select Users
                  </Text>
                </Pressable>
              </View>

              {/* User Selection */}
              {notificationMode === "user" && (
                <View className="mb-4">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text
                      className={`text-sm font-medium ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Select Employees
                    </Text>
                    {selectedUsers.length > 0 && (
                      <View className={`px-2 py-1 rounded-full ${
                        isDark ? "bg-blue-600/20" : "bg-blue-100"
                      }`}>
                        <Text className={`text-xs font-medium ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}>
                          {selectedUsers.length} selected
                        </Text>
                      </View>
                    )}
                  </View>
                  <TextInput
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    className={`rounded-lg p-3 mb-3 ${
                      isDark ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-900"
                    }`}
                  />
                  {isLoadingUsers ? (
                    <View className="items-center py-4">
                      <ActivityIndicator color={isDark ? "#60A5FA" : "#3B82F6"} />
                      <Text className={`mt-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        Loading employees...
                      </Text>
                    </View>
                  ) : Object.keys(filteredUsers).length === 0 ? (
                    <View className="items-center py-4">
                      <MaterialCommunityIcons
                        name="account-search"
                        size={40}
                        color={isDark ? "#6B7280" : "#9CA3AF"}
                      />
                      <Text className={`mt-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        {searchQuery ? "No employees found" : "No employees available"}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ height: 300 }}>
                      <ScrollView 
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled={true}
                        contentContainerStyle={{ paddingBottom: 16 }}
                      >
                        {Object.entries(filteredUsers).map(([role, roleUsers]) => (
                          roleUsers.length > 0 && (
                            <View key={role} className="mb-4">
                              <View className="flex-row justify-between items-center mb-2">
                                <Text className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                                  {roleUsers.length} employees
                                </Text>
                              </View>
                              {roleUsers.map((user) => (
                                <Pressable
                                  key={user.id}
                                  onPress={() => onUserSelect(selectedUsers.includes(user.id) ? selectedUsers.filter((id) => id !== user.id) : [...selectedUsers, user.id])}
                                  className={`flex-row items-center p-3 rounded-lg mb-1 ${
                                    selectedUsers.includes(user.id)
                                      ? isDark
                                        ? "bg-blue-600/20"
                                        : "bg-blue-100"
                                      : isDark
                                        ? "bg-gray-800"
                                        : "bg-gray-100"
                                  }`}
                                >
                                  <View className="flex-1">
                                    <Text
                                      className={`font-medium ${
                                        isDark ? "text-white" : "text-gray-900"
                                      }`}
                                      numberOfLines={1}
                                    >
                                      {user.name}
                                    </Text>
                                    <Text
                                      className={`text-sm ${
                                        isDark ? "text-gray-400" : "text-gray-600"
                                      }`}
                                      numberOfLines={1}
                                    >
                                      {user.employee_number || user.email}
                                    </Text>
                                  </View>
                                  <MaterialCommunityIcons
                                    name={
                                      selectedUsers.includes(user.id)
                                        ? "checkbox-marked"
                                        : "checkbox-blank-outline"
                                    }
                                    size={24}
                                    color={
                                      selectedUsers.includes(user.id)
                                        ? isDark
                                          ? "#60A5FA"
                                          : "#3B82F6"
                                        : isDark
                                          ? "#6B7280"
                                          : "#9CA3AF"
                                    }
                                  />
                                </Pressable>
                              ))}
                            </View>
                          )
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              {/* Title Input */}
              <Text style={{
                fontSize: 14,
                fontWeight: '500',
                marginBottom: 8,
                color: isDark ? '#D1D5DB' : '#374151'
              }}>
                Title
              </Text>
              <TextInput
                ref={titleInputRef}
                value={title}
                onChangeText={onTitleChange}
                placeholder="Notification title"
                placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                style={{
                  backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                  color: isDark ? '#ffffff' : '#111827',
                  fontSize: 16
                }}
                returnKeyType="next"
                onSubmitEditing={() => messageInputRef.current?.focus()}
              />

              {/* Message Input */}
              <Text style={{
                fontSize: 14,
                fontWeight: '500',
                marginBottom: 8,
                color: isDark ? '#D1D5DB' : '#374151'
              }}>
                Message
              </Text>
              <TextInput
                ref={messageInputRef}
                value={message}
                onChangeText={onMessageChange}
                placeholder="Notification message"
                placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 20,
                  color: isDark ? '#ffffff' : '#111827',
                  fontSize: 16,
                  minHeight: 100,
                  textAlignVertical: 'top'
                }}
              />

              {/* Priority Selection */}
              <View className="mb-6">
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Priority
                </Text>
                <View
                  className={`rounded-lg overflow-hidden ${
                    isDark ? "bg-gray-800" : "bg-gray-100"
                  }`}
                >
                  <Picker<"default" | "high" | "low">
                    selectedValue={priority}
                    onValueChange={onPriorityChange}
                    dropdownIconColor={isDark ? "#FFFFFF" : "#000000"}
                    style={{
                      color: isDark ? "#FFFFFF" : "#000000",
                      height: 50,
                    }}
                  >
                    <Picker.Item label="Default Priority" value="default" />
                    <Picker.Item label="High Priority" value="high" />
                    <Picker.Item label="Low Priority" value="low" />
                  </Picker>
                </View>
              </View>
            </ScrollView>

            {/* Send Button */}
            <View className="flex-row justify-between items-center mx-4 mb-4">
              <Pressable
                onPress={handleSend}
                disabled={isLoading || (notificationMode === "user" && selectedUsers.length === 0)}
                className={`flex-1 p-4 rounded-lg flex-row justify-center items-center ${
                  isDark 
                    ? isLoading ? 'bg-blue-600/70' : 'bg-blue-600' 
                    : isLoading ? 'bg-blue-500/70' : 'bg-blue-500'
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" style={{ marginRight: 8 }} />
                ) : (
                  <MaterialCommunityIcons
                    name="send"
                    size={20}
                    color="white"
                    style={{ marginRight: 8 }}
                  />
                )}
                <Text className="text-white font-medium">
                  {isLoading ? 'Sending...' : 'Send Notification'}
                </Text>
              </Pressable>
            </View>

            {/* Success Modal Overlay */}
            {showSuccess && <SuccessModal />}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

export default function GroupAdminNotifications() {
  const { theme } = ThemeContext.useTheme();
  const { user, token } = useAuth();
  const isDark = theme === "dark";
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const successScale = useRef(new Animated.Value(0)).current;
  const [notificationData, setNotificationData] = useState<NotificationData>({
    title: "",
    message: "",
    type: "all",
    priority: "default",
    selectedUsers: []
  });
  const { unreadCount, notifications, setNotifications } = useNotifications();
  const listRef = useRef<any>(null);
  const router = useRouter();
  const [showSendModal, setShowSendModal] = useState(false);

  // Add isMounted ref for cleanup
  const isMounted = useRef(true);

  // Add pagination state management
  const [isEndReached, setIsEndReached] = useState(false);
  const loadingRef = useRef(false);
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const showSuccessAnimation = useCallback(() => {
    setShowSuccess(true);
    Animated.sequence([
      Animated.spring(successScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
        stiffness: 200,
      }),
    ]).start();
  }, [successScale]);

  // Success Modal Component
  const SuccessModal = useCallback(() => (
    <Animated.View 
      className={`absolute inset-0 items-center justify-center ${isDark ? 'bg-gray-900/95' : 'bg-white/95'}`}
      style={{
        transform: [{ scale: successScale }],
      }}
    >
      <View className="items-center px-6">
        <View className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
          <MaterialCommunityIcons
            name="check-circle"
            size={40}
            color={isDark ? "#4ADE80" : "#22C55E"}
          />
        </View>
        <Text className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Success!
        </Text>
        <Text className={`text-base text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Your notification has been sent successfully
        </Text>
      </View>
    </Animated.View>
  ), [isDark, successScale]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Handle end reached for pagination
  const handleEndReached = useCallback(async () => {
    if (!loadingRef.current && !isEndReached && !isFetchingMore) {
      try {
        setIsFetchingMore(true);
        loadingRef.current = true;

        // Fetch next page of notifications
        const nextPage = page + 1;
        setPage(nextPage);
        
        const response = await axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-notifications`,
          {
            params: {
              page: nextPage,
              limit: PAGE_SIZE,
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data && (
          (response.data.push && response.data.push.length > 0) || 
          (response.data.inApp && response.data.inApp.length > 0)
        )) {
          // Pagination logic is handled in the PushNotificationsList component
        } else {
          setIsEndReached(true);
        }
      } catch (error) {
        console.error("Error fetching more notifications:", error);
      } finally {
        if (isMounted.current) {
          setIsFetchingMore(false);
          loadingRef.current = false;
        }
      }
    }
  }, [page, isEndReached, isFetchingMore, token]);

  // Handle when all data is loaded
  const handleAllDataLoaded = useCallback(() => {
    setIsEndReached(true);
    loadingRef.current = false;
  }, []);

  const handleSendNotification = async () => {
    try {
      setIsLoading(true);
      const endpoint = notificationData.type === "all" 
        ? "/api/group-admin-notifications/send-group"
        : "/api/group-admin-notifications/send-users";

      const payload = {
        title: notificationData.title,
        message: notificationData.message,
        type: "group",
        priority: notificationData.priority,
        groupAdminId: user?.id,
        ...(notificationData.type === "user" && { userIds: notificationData.selectedUsers })
      };

      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}${endpoint}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 200) {
        // Show success modal
        showSuccessAnimation();
        
        // Reset form after a delay
        setTimeout(() => {
          setNotificationData({
            title: "",
            message: "",
            type: "all",
            priority: "default",
            selectedUsers: []
          });
          setShowSuccess(false); // Reset success state
          setShowSendModal(false);
        }, 2000);
      }
    } catch (error) {
      console.error("Error sending notification:", error);
      Alert.alert(
        "Error",
        "Failed to send notification. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Add initial data loading for notifications
  useEffect(() => {
    const loadNotifications = async () => {
      if (!token || !user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch initial notification data
        const response = await axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-notifications`,
          {
            params: { limit: 15, offset: 0 },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        
        if (isMounted.current) {
          if (response.data && (response.data.push || response.data.inApp)) {
            // Process notifications to calculate unread
            const notificationsMap = new Map();
            
            // Add push notifications with a prefix
            (response.data.push || []).forEach((notification: Notification) => {
              notificationsMap.set(`push_${notification.id}`, {
                ...notification,
                uniqueId: `push_${notification.id}`,
                source: "push",
              });
            });
            
            // Add in-app notifications with a prefix
            (response.data.inApp || []).forEach((notification: Notification) => {
              notificationsMap.set(`inapp_${notification.id}`, {
                ...notification,
                uniqueId: `inapp_${notification.id}`,
                source: "inapp",
              });
            });
            
            // Convert to array and set to context
            const allNotifications = Array.from(notificationsMap.values()) as Notification[];
            setNotifications(allNotifications);
          } else {
            // If no notifications, set empty array
            setNotifications([]);
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error("[Group Admin Notifications] Error loading initial data:", error);
        if (isMounted.current) {
          setIsLoading(false);
          setNotifications([]); // Set empty array on error
        }
      }
    };
    
    loadNotifications();
    
    return () => {
      isMounted.current = false;
    };
  }, [token, user?.id, setNotifications]);

  return (
    <View className="flex-1">
      {/* Screen Configuration */}
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Enhanced Header with status bar integration */}
      <LinearGradient
        colors={isDark ? ["#1F2937", "#111827"] : ["#FFFFFF", "#F3F4F6"]}
        style={styles.header}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor="transparent"
          translucent
        />

        {/* Header Content */}
        <View
          style={{
            paddingTop:
              Platform.OS === "ios"
                ? 60
                : StatusBar.currentHeight
                  ? StatusBar.currentHeight + 20
                  : 40,
          }}
        >
          <View className="px-6 mb-6">
            <View className="flex-row items-center mb-1">
              <TouchableOpacity
                onPress={() => router.back()}
                className={`w-12 h-12 rounded-full items-center justify-center ${isDark ? "bg-gray-800/80" : "bg-gray-100"}`}
              >
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={28}
                  color={isDark ? "#E5E7EB" : "#374151"}
                />
              </TouchableOpacity>
              <View className="flex-1 flex-row justify-between items-center">
                <View>
                  <Text
                    className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                  >
                    Notifications {unreadCount > 0 && (
                      <Text className={`text-sm ${isDark ? "text-blue-400" : "text-blue-500"}`}>
                        ({unreadCount})
                      </Text>
                    )}
                  </Text>
                  <Text
                    className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}
                  >
                    Stay updated with your activities
                  </Text>
                </View>
                {unreadCount > 0 && (
                  <Pressable
                    onPress={() => {
                      if (unreadCount > 0) {
                        Alert.alert(
                          "Mark All as Read",
                          "Are you sure you want to mark all notifications as read?",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Mark All",
                              onPress: () => {
                                if (listRef.current) {
                                  listRef.current.markAllAsRead();
                                }
                              },
                            },
                          ]
                        );
                      }
                    }}
                    className={`py-2 px-4 rounded-lg ${isDark ? "bg-blue-600" : "bg-blue-500"
                      }`}
                    style={[styles.markAllButton, { position: 'absolute', right: 0 }]}
                  >
                    <Text className="text-white font-medium text-sm">
                      Mark all as read
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>

      <View className={`flex-1 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
        {/* Loading State and Content */}
        <View className="flex-1 pt-3">
          {isLoading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator
                size="large"
                color={isDark ? "#60A5FA" : "#3B82F6"}
              />
              <Text
                className={`mt-4 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}
              >
                Loading notifications...
              </Text>
            </View>
          ) : (
            <PushNotificationsList
              ref={listRef}
              unreadCount={unreadCount}
              onMarkAllAsRead={() => {
                // Refresh notifications
                setNotifications([]);
                setIsLoading(true);
                setPage(1);
                setIsEndReached(false);
                loadingRef.current = false;
                
                // Fetch notifications again
                const refreshNotifications = async () => {
                  try {
                    const response = await axios.get(
                      `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-notifications`,
                      {
                        params: { limit: PAGE_SIZE, page: 1 },
                        headers: { Authorization: `Bearer ${token}` },
                      }
                    );
                    
                    if (response.data && (response.data.push || response.data.inApp)) {
                      const notificationsMap = new Map();
                      
                      (response.data.push || []).forEach((notification: Notification) => {
                        notificationsMap.set(`push_${notification.id}`, {
                          ...notification,
                          uniqueId: `push_${notification.id}`,
                          source: "push",
                          read: true
                        });
                      });
                      
                      (response.data.inApp || []).forEach((notification: Notification) => {
                        notificationsMap.set(`inapp_${notification.id}`, {
                          ...notification,
                          uniqueId: `inapp_${notification.id}`,
                          source: "inapp",
                          read: true
                        });
                      });
                      
                      const allNotifications = Array.from(notificationsMap.values()) as Notification[];
                      setNotifications(allNotifications);
                    }
                  } catch (error) {
                    console.error("Error refreshing notifications:", error);
                  } finally {
                    setIsLoading(false);
                  }
                };
                
                refreshNotifications();
              }}
              showSendButton={true}
              onSendNotification={() => setShowSendModal(true)}
              onEndReached={handleEndReached}
              onAllDataLoaded={handleAllDataLoaded}
            />
          )}
        </View>
      </View>

      {/* Send Notification Modal */}
      <SendNotificationModal
        visible={showSendModal}
        onClose={() => {
          setShowSuccess(false);
          setShowSendModal(false);
        }}
        onSend={handleSendNotification}
        title={notificationData.title}
        message={notificationData.message}
        onTitleChange={(text) => setNotificationData((prev) => ({ ...prev, title: text }))}
        onMessageChange={(text) => setNotificationData((prev) => ({ ...prev, message: text }))}
        isDark={isDark}
        notificationMode={notificationData.type}
        onModeChange={(mode) => setNotificationData((prev) => ({ ...prev, type: mode }))}
        priority={notificationData.priority}
        onPriorityChange={(priority: "default" | "high" | "low") => 
          setNotificationData((prev) => ({ ...prev, priority }))
        }
        selectedUsers={notificationData.selectedUsers}
        onUserSelect={(userIds) => setNotificationData((prev) => ({ ...prev, selectedUsers: userIds }))}
        showSuccess={showSuccess}
        SuccessModal={SuccessModal}
      />
      <BottomNav items={groupAdminNavItems} />
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
  markAllButton: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    marginLeft: 'auto',
    zIndex: 10,
  }
});
