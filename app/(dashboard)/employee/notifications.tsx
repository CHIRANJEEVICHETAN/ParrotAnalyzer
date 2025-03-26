import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Animated,
  ScrollView,
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import ThemeContext from "../../context/ThemeContext";
import PushNotificationsList from "./../../components/PushNotificationsList";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import { useNotifications, Notification } from "../../context/NotificationContext";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

type NotificationType = "all" | "task-assignment" | "leave-status" | "expense-status" | "general";

export default function EmployeeNotifications() {
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === "dark";
  const [selectedType, setSelectedType] = useState<NotificationType>("all");
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const { unreadCount, notifications, setNotifications } = useNotifications();
  const listRef = useRef<any>(null);
  const router = useRouter();
  const { user, token } = useAuth();
  
  // Create refs to keep track of component mounted state for animation cleanup
  const isMounted = useRef(true);
  
  // Add initial data loading for notifications
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        if (!token || !user?.id) return;
        
        // Reset notification states
        setIsLoading(true);
        
        // Fetch initial notification data
        const response = await axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/employee-notifications`,
          {
            params: { limit: 15, offset: 0 },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        
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
        }
      } catch (error) {
        console.error("[Employee Notifications] Error loading initial data:", error);
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    };
    
    loadNotifications();
    
    return () => {
      isMounted.current = false;
    };
  }, [token, user]);
  
  // Use useMemo to calculate notification counts by type
  const filterTypes = useMemo(() => {
    // Get counts for each category
    const taskCount = notifications?.filter((n: Notification) => n.type === 'task-assignment' && !n.read).length || 0;
    const leaveCount = notifications?.filter((n: Notification) => n.type === 'leave-status' && !n.read).length || 0;
    const expenseCount = notifications?.filter((n: Notification) => n.type === 'expense-status' && !n.read).length || 0;
    const generalCount = notifications?.filter((n: Notification) => n.type === 'general' && !n.read).length || 0;

    return [
      { id: "all", label: "All", icon: "bell-outline", count: unreadCount },
      { id: "task-assignment", label: "Tasks", icon: "clipboard-list-outline", count: taskCount },
      { id: "leave-status", label: "Leave Status", icon: "calendar-clock", count: leaveCount },
      { id: "expense-status", label: "Expense Status", icon: "receipt", count: expenseCount },
      { id: "general", label: "General", icon: "information-outline", count: generalCount },
    ];
  }, [unreadCount, notifications]);

  // Memoize the type change handler to prevent unnecessary re-renders
  const handleTypeChange = useCallback(async (type: NotificationType) => {
    if (selectedType === type) return; // Don't reload if same type selected
    
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
        toValue: filterTypes.findIndex(t => t.id === type) * (SCREEN_WIDTH / filterTypes.length),
        useNativeDriver: true,
        damping: 20,
        stiffness: 90,
      }),
    ]).start();

    setSelectedType(type);
    // Shorter loading delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (isMounted.current) {
      setIsLoading(false);
    }
  }, [fadeAnim, scrollX, filterTypes, SCREEN_WIDTH, selectedType]);

  // Memoize the tab renderer for better performance
  const renderFilterTab = useCallback((type: {id: string, label: string, icon: string, count: number}, index: number) => (
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
  ), [handleTypeChange, selectedType, isDark]);

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
            <View className="flex-row items-center">
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
              <View className="flex-1 flex-row justify-between items-center ml-3">
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
                    className={`py-2 px-4 rounded-lg ${isDark ? "bg-blue-600" : "bg-blue-500"}`}
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

          {/* Tabs integrated in header */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
            style={styles.scrollView}
            className="pl-6"
          >
            {filterTypes.map((type, index) => renderFilterTab(type, index))}
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
                  outputRange: [0, 0],
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
            />
          )}
        </Animated.View>
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    marginLeft: 'auto',
    zIndex: 10,
  }
});
