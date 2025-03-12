import React, { useState, useCallback, useRef } from "react";
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
} from "react-native";
import { Stack } from "expo-router";
import ThemeContext from "./../../context/ThemeContext";
import { useAuth } from "./../../context/AuthContext";
import PushNotificationsList from "./../../components/PushNotificationsList";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import axios from "axios";
import { LinearGradient } from 'expo-linear-gradient';
import BottomNav from "../../components/BottomNav";
import { groupAdminNavItems } from "./utils/navigationItems";

type NotificationType = "all" | "group" | "general" | "announcement";

export default function GroupAdminNotifications() {
  const { theme } = ThemeContext.useTheme();
  const { user, token } = useAuth();
  const isDark = theme === "dark";
  const [selectedType, setSelectedType] = useState<NotificationType>("all");
  const [showSendModal, setShowSendModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const { width: SCREEN_WIDTH } = Dimensions.get("window");
  const [notificationData, setNotificationData] = useState({
    title: "",
    message: "",
    type: "group",
  });

  const filterTypes = [
    { id: "all", label: "All", icon: "bell-outline", count: 12 },
    { id: "group", label: "Group", icon: "account-group-outline", count: 5 },
    { id: "general", label: "General", icon: "information-outline", count: 4 },
    {
      id: "announcement",
      label: "Announcements",
      icon: "bullhorn-outline",
      count: 3,
    },
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
      // Simulate loading delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      setIsLoading(false);
    },
    [fadeAnim, scrollX, filterTypes, SCREEN_WIDTH]
  );

  const sendGroupNotification = async () => {
    try {
      console.log("[Group Notification] Starting to send notification");
      console.log("[Group Notification] User:", user?.id);
      console.log("[Group Notification] Data:", notificationData);

      if (!user?.id) {
        console.error("[Group Notification] No user ID found");
        throw new Error("User not authenticated");
      }

      if (!token) {
        console.error("[Group Notification] No auth token found");
        throw new Error("Authentication token missing");
      }

      const baseUrl = process.env.EXPO_PUBLIC_API_URL;
      console.log("[Group Notification] API URL:", baseUrl);

      // Validate required fields
      if (!notificationData.title.trim() || !notificationData.message.trim()) {
        throw new Error("Title and message are required");
      }

      const response = await axios.post(
        `${baseUrl}/api/group-admin-notifications/send-group`,
        {
          ...notificationData,
          groupAdminId: user.id, // Include groupAdminId as required by backend
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("[Group Notification] Response:", response.data);

      Alert.alert("Success", "Notification sent successfully");
      setShowSendModal(false);
      setNotificationData({ title: "", message: "", type: "group" });
    } catch (error) {
      console.error("[Group Notification] Error:", error);

      let errorMessage = "Failed to send notification";
      if (axios.isAxiosError(error)) {
        console.error(
          "[Group Notification] Response data:",
          error.response?.data
        );
        console.error("[Group Notification] Status:", error.response?.status);

        // Handle specific error cases
        if (error.response?.status === 400) {
          errorMessage =
            "Missing required information. Please check all fields.";
        } else if (error.response?.status === 403) {
          errorMessage =
            "You are not authorized to send notifications to this group.";
        } else {
          errorMessage = error.response?.data?.error || error.message;
        }
      }

      Alert.alert("Error", errorMessage);
    }
  };

  const SendNotificationModal = () => (
    <Modal
      visible={showSendModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowSendModal(false)}
    >
      <View className="flex-1 justify-center items-center">
        <View
          className={`absolute inset-0 ${
            isDark ? "bg-black/50" : "bg-gray-500/50"
          }`}
        />
        <View
          className={`w-11/12 max-w-lg rounded-xl p-6 ${
            isDark ? "bg-gray-900" : "bg-white"
          }`}
        >
          <View className="flex-row justify-between items-center mb-6">
            <Text
              className={`text-xl font-semibold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Send Group Notification
            </Text>
            <Pressable onPress={() => setShowSendModal(false)} className="p-2">
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={isDark ? "#9CA3AF" : "#6B7280"}
              />
            </Pressable>
          </View>

          <ScrollView>
            <Text
              className={`text-sm font-medium mb-2 ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Title
            </Text>
            <TextInput
              value={notificationData.title}
              onChangeText={(text) =>
                setNotificationData((prev) => ({ ...prev, title: text }))
              }
              placeholder="Notification title"
              placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
              className={`p-3 rounded-lg mb-4 ${
                isDark ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-900"
              }`}
            />

            <Text
              className={`text-sm font-medium mb-2 ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Message
            </Text>
            <TextInput
              value={notificationData.message}
              onChangeText={(text) =>
                setNotificationData((prev) => ({ ...prev, message: text }))
              }
              placeholder="Notification message"
              placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
              multiline
              numberOfLines={4}
              className={`p-3 rounded-lg mb-6 ${
                isDark ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-900"
              }`}
              textAlignVertical="top"
            />

            <Pressable
              onPress={sendGroupNotification}
              className={`py-3 px-4 rounded-lg ${
                isDark ? "bg-blue-600" : "bg-blue-500"
              }`}
            >
              <Text className="text-white font-semibold text-center">
                Send Notification
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

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
            <Text
              className={`text-2xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Notifications
            </Text>
            <Text
              className={`text-sm mt-1 ${
                isDark ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Manage group notifications
            </Text>
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
                className={`py-2.5 px-4 rounded-2xl flex-row items-center ${
                  selectedType === type.id
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
                  className={`text-sm font-medium ${
                    selectedType === type.id
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
                    className={`ml-2 px-2 py-0.5 rounded-full ${
                      selectedType === type.id
                        ? "bg-white/20 border border-white/10"
                        : isDark
                        ? "bg-gray-900/60 border border-gray-700"
                        : "bg-white border border-gray-200"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        selectedType === type.id
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
                className={`mt-4 text-sm ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Loading notifications...
              </Text>
            </View>
          ) : (
            <PushNotificationsList
              filterType={selectedType === "all" ? undefined : selectedType}
              showSendButton={true}
              onSendNotification={() => setShowSendModal(true)}
            />
          )}
        </Animated.View>
      </View>

      <SendNotificationModal />
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
});
