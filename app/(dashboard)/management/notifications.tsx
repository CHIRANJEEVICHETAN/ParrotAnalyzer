import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  TouchableOpacity,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import ThemeContext from "./../../context/ThemeContext";
import { useAuth } from "./../../context/AuthContext";
import PushNotificationsList from "./../../components/PushNotificationsList";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import axios from "axios";
import { LinearGradient } from 'expo-linear-gradient';
import { managementNavItems } from "./utils/navigationItems";
import BottomNav from "../../components/BottomNav";
import { useNotifications, Notification } from "../../context/NotificationContext";

type NotificationType = "all" | "role" | "user" | "announcement" | "general";
type NotificationMode = "role" | "user";

interface NotificationData {
  title: string;
  message: string;
  type: string;
  targetRole?: string;
  userIds?: string[];
  priority?: "high" | "default" | "low";
}

export default function ManagementNotifications() {
  const { theme } = ThemeContext.useTheme();
  const { user, token } = useAuth();
  const router = useRouter();
  const isDark = theme === "dark";
  const [selectedType, setSelectedType] = useState<NotificationType>("all");
  const [showSendModal, setShowSendModal] = useState(false);
  const [notificationMode, setNotificationMode] =
    useState<NotificationMode>("role");
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const { width: SCREEN_WIDTH } = Dimensions.get("window");
  const { unreadCount, notifications } = useNotifications();
  const listRef = useRef<any>(null);
  const [notificationData, setNotificationData] = useState<NotificationData>({
    title: "",
    message: "",
    type: "general",
    priority: "default",
  });

  // Add new state for send button loading
  const [isSending, setIsSending] = useState(false);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Add keyboard listeners
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const filterTypes = useMemo(() => {
    // Get counts for each category
    const roleCount = notifications?.filter((n: Notification) => n.type === 'role' && !n.read).length || 0;
    const userCount = notifications?.filter((n: Notification) => n.type === 'user' && !n.read).length || 0;
    const announcementCount = notifications?.filter((n: Notification) => n.type === 'announcement' && !n.read).length || 0;
    const generalCount = notifications?.filter((n: Notification) => n.type === 'general' && !n.read).length || 0;

    return [
      { id: "all", label: "All", icon: "bell-outline", count: unreadCount },
      { id: "role", label: "Role", icon: "shield-account-outline", count: roleCount },
      { id: "user", label: "User", icon: "account-outline", count: userCount },
      { id: "announcement", label: "Announcements", icon: "bullhorn-outline", count: announcementCount },
      { id: "general", label: "General", icon: "information-outline", count: generalCount },
    ];
  }, [unreadCount, notifications]);

  const roles = [
    { id: "employee", label: "Employees" },
    { id: "group-admin", label: "Group Admins" },
  ];

  const handleTypeChange = useCallback(
    async (type: NotificationType) => {
      setIsLoading(true);

      // Parallel animations for smoother transition
      Animated.parallel([
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
            delay: 100,
          }),
        ]),
        Animated.spring(scrollX, {
          toValue:
            filterTypes.findIndex((t) => t.id === type) *
            (SCREEN_WIDTH / filterTypes.length),
          useNativeDriver: true,
          damping: 20,
          stiffness: 90,
        }),
      ]).start();

      setSelectedType(type);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setIsLoading(false);
    },
    [fadeAnim, scrollX, filterTypes, SCREEN_WIDTH]
  );

  const sendNotification = async () => {
    if (isSending) return; // Prevent double submission

    try {
      setIsSending(true);
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      const endpoint =
        notificationMode === "role"
          ? `${process.env.EXPO_PUBLIC_API_URL}/api/management-notifications/send-role`
          : `${process.env.EXPO_PUBLIC_API_URL}/api/management-notifications/send-users`;

      await axios.post(
        endpoint,
        {
          ...notificationData,
          userId: user.id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      Alert.alert("Success", "Notification sent successfully");
      setShowSendModal(false);
      setNotificationData({
        title: "",
        message: "",
        type: "general",
        priority: "default",
      });
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to send notification"
      );
    } finally {
      setIsSending(false);
    }
  };

  const SendNotificationModal = () => {
    const modalHeight = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (showSendModal) {
        Animated.spring(modalHeight, {
          toValue: 1,
          useNativeDriver: true,
          damping: 20,
          stiffness: 90,
        }).start();
      }
    }, [showSendModal]);

    if (!showSendModal) return null;

    return (
      <Modal
        visible={true}
        transparent
        statusBarTranslucent
        animationType="fade"
      >
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.3)" },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <TouchableWithoutFeedback
              onPress={() => {
                Keyboard.dismiss();
                setShowSendModal(false);
              }}
            >
              <View style={{ flex: 1 }} />
            </TouchableWithoutFeedback>

            <Animated.View
              className={`rounded-t-xl ${isDark ? "bg-gray-900" : "bg-white"}`}
              style={{
                transform: [
                  {
                    translateY: modalHeight.interpolate({
                      inputRange: [0, 1],
                      outputRange: [600, 0],
                    }),
                  },
                ],
              }}
            >
              <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-200/10">
                <Text
                  className={`text-xl font-semibold ${isDark ? "text-white" : "text-gray-900"
                    }`}
                >
                  Send Notification
                </Text>
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowSendModal(false);
                  }}
                  className="p-2 rounded-full active:bg-gray-100/10"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color={isDark ? "#9CA3AF" : "#6B7280"}
                  />
                </Pressable>
              </View>

              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView
                  className="px-4 py-3"
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingBottom: Platform.OS === "ios" ? 20 : 80,
                  }}
                >
                  {/* Notification Mode Selection */}
                  <View className="flex-row mb-4 bg-gray-100/5 p-1 rounded-lg">
                    <Pressable
                      onPress={() => setNotificationMode("role")}
                      className={`flex-1 py-2.5 rounded-md ${notificationMode === "role"
                          ? isDark
                            ? "bg-blue-600"
                            : "bg-blue-500"
                          : "bg-transparent"
                        }`}
                    >
                      <Text
                        className={`text-center font-medium ${notificationMode === "role"
                            ? "text-white"
                            : isDark
                              ? "text-gray-300"
                              : "text-gray-600"
                          }`}
                      >
                        By Role
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setNotificationMode("user")}
                      className={`flex-1 py-2.5 rounded-md ${notificationMode === "user"
                          ? isDark
                            ? "bg-blue-600"
                            : "bg-blue-500"
                          : "bg-transparent"
                        }`}
                    >
                      <Text
                        className={`text-center font-medium ${notificationMode === "user"
                            ? "text-white"
                            : isDark
                              ? "text-gray-300"
                              : "text-gray-600"
                          }`}
                      >
                        By User
                      </Text>
                    </Pressable>
                  </View>

                  {/* Role Selection */}
                  {notificationMode === "role" && (
                    <View className="mb-4">
                      <Text
                        className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
                          }`}
                      >
                        Select Role
                      </Text>
                      <View
                        className={`rounded-lg overflow-hidden ${isDark ? "bg-gray-800" : "bg-gray-100"
                          }`}
                      >
                        <Picker
                          selectedValue={notificationData.targetRole}
                          onValueChange={(value) =>
                            setNotificationData((prev) => ({
                              ...prev,
                              targetRole: value,
                            }))
                          }
                          dropdownIconColor={isDark ? "#FFFFFF" : "#000000"}
                          style={{
                            color: isDark ? "#FFFFFF" : "#000000",
                            height: 50,
                          }}
                        >
                          <Picker.Item label="Select Role" value="" />
                          {roles.map((role) => (
                            <Picker.Item
                              key={role.id}
                              label={role.label}
                              value={role.id}
                            />
                          ))}
                        </Picker>
                      </View>
                    </View>
                  )}

                  {/* Title Input */}
                  <View className="mb-4">
                    <Text
                      className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                    >
                      Title
                    </Text>
                    <TextInput
                      value={notificationData.title}
                      onChangeText={(text) =>
                        setNotificationData((prev) => ({
                          ...prev,
                          title: text,
                        }))
                      }
                      placeholder="Notification title"
                      placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                      className={`p-3 rounded-lg ${isDark
                          ? "bg-gray-800 text-white"
                          : "bg-gray-100 text-gray-900"
                        }`}
                      style={{ height: 50 }}
                      returnKeyType="next"
                      autoCapitalize="sentences"
                    />
                  </View>

                  {/* Message Input */}
                  <View className="mb-4">
                    <Text
                      className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                    >
                      Message
                    </Text>
                    <TextInput
                      value={notificationData.message}
                      onChangeText={(text) =>
                        setNotificationData((prev) => ({
                          ...prev,
                          message: text,
                        }))
                      }
                      placeholder="Notification message"
                      placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                      multiline
                      numberOfLines={4}
                      className={`p-3 rounded-lg ${isDark
                          ? "bg-gray-800 text-white"
                          : "bg-gray-100 text-gray-900"
                        }`}
                      style={{
                        height: 100,
                        textAlignVertical: "top",
                      }}
                      autoCapitalize="sentences"
                    />
                  </View>

                  {/* Priority Selection */}
                  <View className="mb-6">
                    <Text
                      className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                    >
                      Priority
                    </Text>
                    <View
                      className={`rounded-lg overflow-hidden ${isDark ? "bg-gray-800" : "bg-gray-100"
                        }`}
                    >
                      <Picker
                        selectedValue={notificationData.priority}
                        onValueChange={(value) =>
                          setNotificationData((prev) => ({
                            ...prev,
                            priority: value as "high" | "default" | "low",
                          }))
                        }
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

                  {/* Send Button */}
                  <View className="mb-4">
                    <Pressable
                      onPress={sendNotification}
                      disabled={isSending}
                      className={`py-3.5 px-4 rounded-lg flex-row justify-center items-center ${isDark
                          ? isSending
                            ? "bg-blue-600/70"
                            : "bg-blue-600"
                          : isSending
                            ? "bg-blue-500/70"
                            : "bg-blue-500"
                        } ${isSending ? "opacity-80" : ""}`}
                    >
                      {isSending ? (
                        <>
                          <ActivityIndicator
                            size="small"
                            color="white"
                            style={{ marginRight: 8 }}
                          />
                          <Text className="text-white font-semibold text-base">
                            Sending...
                          </Text>
                        </>
                      ) : (
                        <Text className="text-white font-semibold text-base">
                          Send Notification
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </ScrollView>
              </TouchableWithoutFeedback>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  };

  return (
    <View className="flex-1">
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Enhanced Header with proper status bar height and integrated tabs */}
      <LinearGradient
        colors={isDark ? ["#1F2937", "#111827"] : ["#FFFFFF", "#F3F4F6"]}
        style={[styles.header]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor="transparent"
          translucent
        />

        {/* Header Content with adjusted spacing */}
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
                    className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"
                      }`}
                  >
                    Notifications {unreadCount > 0 && (
                      <Text className={`text-sm ${isDark ? "text-blue-400" : "text-blue-500"}`}>
                        ({unreadCount})
                      </Text>
                    )}
                  </Text>
                  <Text
                    className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-600"
                      }`}
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
                    style={styles.markAllButton}
                  >
                    <Text className="text-white font-medium text-sm">
                      Mark all as read
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>

          {/* Tabs integrated in header */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
            style={styles.scrollView}
            className="pl-6"
          >
            {filterTypes.map((type, index) => (
              <Pressable
                key={type.id}
                onPress={() => handleTypeChange(type.id as NotificationType)}
                className={`py-2.5 px-4 rounded-2xl flex-row items-center ${selectedType === type.id
                    ? isDark
                      ? "bg-blue-500/90 border border-blue-400/30"
                      : "bg-blue-500 border border-blue-600/20"
                    : isDark
                      ? "bg-gray-800/40 border border-gray-700"
                      : "bg-gray-50 border border-gray-200"
                  }`}
                style={[
                  styles.tabButton,
                  selectedType === type.id && styles.activeTabButton,
                  {
                    transform: [
                      {
                        scale: selectedType === type.id ? 1 : 0.98,
                      },
                    ],
                    marginRight: index === filterTypes.length - 1 ? 10 : 0,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={type.icon as any}
                  size={20}
                  color={
                    selectedType === type.id
                      ? "#FFFFFF"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B"
                  }
                  style={{ marginRight: 8 }}
                />
                <Text
                  className={`text-sm font-medium ${selectedType === type.id
                      ? "text-white"
                      : isDark
                        ? "text-gray-300"
                        : "text-gray-700"
                    }`}
                >
                  {type.label}
                </Text>
                {type.count > 0 && (
                  <View
                    className={`ml-2 px-2 py-0.5 rounded-full ${selectedType === type.id
                        ? "bg-white/20 border border-white/10"
                        : isDark
                          ? "bg-gray-900/60 border border-gray-700"
                          : "bg-white border border-gray-200"
                      }`}
                  >
                    <Text
                      className={`text-xs font-medium ${selectedType === type.id
                          ? "text-white/90"
                          : isDark
                            ? "text-gray-300"
                            : "text-gray-600"
                        }`}
                    >
                      {type.count}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </LinearGradient>

      <View className={`flex-1 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
        {/* Loading State and Animated Content */}
        <Animated.View
          className="flex-1 pt-3"
          style={{
            opacity: fadeAnim,
            transform: [
              {
                translateX: scrollX.interpolate({
                  inputRange: [0, SCREEN_WIDTH],
                  outputRange: [0, -20],
                }),
              },
            ],
          }}
        >
          {isLoading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator
                size="large"
                color={isDark ? "#60A5FA" : "#3B82F6"}
              />
              <Text
                className={`mt-4 text-sm ${isDark ? "text-gray-400" : "text-gray-600"
                  }`}
              >
                Loading notifications...
              </Text>
            </View>
          ) : (
            <PushNotificationsList
              ref={listRef}
              filterType={selectedType === "all" ? undefined : selectedType}
              unreadCount={unreadCount}
              onMarkAllAsRead={() => {
                handleTypeChange(selectedType);
              }}
              showSendButton={true}
              onSendNotification={() => setShowSendModal(true)}
            />
          )}
        </Animated.View>
      </View>

      <SendNotificationModal />
      <BottomNav items={managementNavItems} />
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
  scrollView: {
    // Remove paddingLeft from here since we're using className
  },
  tabsContainer: {
    paddingRight: 24,
    paddingBottom: 16,
    gap: 12,
  },
  tabButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activeTabButton: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  markAllButton: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  }
});
