import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import ThemeContext from "../../context/ThemeContext";
import BottomNav from "../../components/BottomNav";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import { StatusBar as RNStatusBar } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { managementNavItems } from "./utils/navigationItems";

interface Activity {
  title: string;
  type: "expense" | string;
  description: {
    employee_name?: string;
    amount?: string;
    department?: string;
    group_admin?: string;
    status?: string;
    name?: string;
  };
  time: string;
}

interface QuickAction {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  route: string;
  color: string;
}

interface LeaveStats {
  pending_requests: number;
  approved_requests: number;
  active_leave_types: number;
}

// Add new quick actions array
const newQuickActions = [
  {
    title: "Group Admin",
    icon: "people-outline", 
    description: "Manage group admins and permissions",
    route: "/(dashboard)/management/group-admin-management",
    color: "#F59E0B",
  },
  {
    title: "Leave Insights",
    icon: "document-text-outline",
    description: "Manage Leave & Balances",
    route: "/(dashboard)/management/leave-insights",
    color: "#10B981",
  },
];

export default function ManagementDashboard() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const { token, user } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [shiftStartTime, setShiftStartTime] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState({
    totalTeams: 0,
    userLimit: 0,
    recentActivities: [] as Activity[],
    analytics: {
      teamPerformance: { value: 0, trend: "0%" },
      attendanceRate: { value: 0, trend: "0%" },
      travelEfficiency: { value: 0, trend: "0%" },
      expenseOverview: { value: 0, trend: "0%" },
    },
  });
  const [leaveStats, setLeaveStats] = useState<LeaveStats>({
    pending_requests: 0,
    approved_requests: 0,
    active_leave_types: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const CACHE_KEY = "management_dashboard_data";
  const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds

  const fetchDashboardData = async (useCache = true) => {
    try {
      // Check cache first if useCache is true
      if (useCache) {
        const cachedData = await AsyncStorage.getItem(CACHE_KEY);
        if (cachedData) {
          const { data, timestamp } = JSON.parse(cachedData);
          const isExpired = Date.now() - timestamp > CACHE_EXPIRY;

          if (!isExpired) {
            setDashboardData(data);
            setIsLoading(false);
            return;
          }
        }
      }

      // Fetch fresh data
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/management/dashboard-stats`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Update state with new data
      setDashboardData(response.data);

      // Cache the new data
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          data: response.data,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error("Error details:", {
        message: (error as Error).message,
        response: (error as any).response?.data,
        status: (error as any).response?.status,
      });

      // Try to get cached data as fallback
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const { data } = JSON.parse(cachedData);
        setDashboardData(data);
      } else {
        setDashboardData({
          totalTeams: 0,
          userLimit: 0,
          recentActivities: [],
          analytics: {
            teamPerformance: { value: 0, trend: "0%" },
            attendanceRate: { value: 0, trend: "0%" },
            travelEfficiency: { value: 0, trend: "0%" },
            expenseOverview: { value: 0, trend: "0%" },
          },
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkShiftStatus = async () => {
    try {
      const status = await AsyncStorage.getItem(`${user?.role}-shiftStatus`);
      if (status) {
        const { isActive, startTime } = JSON.parse(status);
        setIsShiftActive(isActive);
        setShiftStartTime(startTime);
      }
    } catch (error) {
      console.error("Error checking shift status:", error);
    }
  };

  const fetchLeaveStats = async (useCache = true) => {
    if (!user?.id) {
      console.warn("No user ID available for fetching leave stats");
      return;
    }

    const cacheKey = `leaveStats_${user.id}`; // Make cache key user-specific
    const cacheExpiry = 5 * 60 * 1000; // 5 minutes

    try {
      // Check cache first if useCache is true
      if (useCache) {
        try {
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            // Validate cache data structure
            if (
              data &&
              typeof data === "object" &&
              "pending_requests" in data &&
              "approved_requests" in data &&
              "active_leave_types" in data &&
              Date.now() - timestamp < cacheExpiry
            ) {
              setLeaveStats(data);
              setStatsLoading(false);
              // Fetch fresh data in background after 5 seconds
              setTimeout(() => fetchLeaveStats(false), 5000);
              return;
            } else {
              // Invalid or expired cache, remove it
              await AsyncStorage.removeItem(cacheKey);
            }
          }
        } catch (error) {
          console.error("Error reading cache:", error);
          // Clear invalid cache
          await AsyncStorage.removeItem(cacheKey);
        }
      }

      setStatsLoading(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave-management/stats`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data) {
        // Validate response data
        const validStats = {
          pending_requests: parseInt(response.data.pending_requests) || 0,
          approved_requests: parseInt(response.data.approved_requests) || 0,
          active_leave_types: parseInt(response.data.active_leave_types) || 0,
        };

        setLeaveStats(validStats);

        // Update cache only if useCache is true
        if (useCache) {
          try {
            await AsyncStorage.setItem(
              cacheKey,
              JSON.stringify({
                data: validStats,
                timestamp: Date.now(),
              })
            );
          } catch (error) {
            console.error("Error updating cache:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching leave stats:", error);
      // Clear cache on error
      await AsyncStorage.removeItem(cacheKey);
    } finally {
      setStatsLoading(false);
    }
  };

  // Add a function to clear stats cache
  const clearStatsCache = async () => {
    if (user?.id) {
      try {
        await AsyncStorage.removeItem(`leaveStats_${user.id}`);
      } catch (error) {
        console.error("Error clearing stats cache:", error);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDashboardData(false), fetchLeaveStats(false)]);
    setRefreshing(false);
  };

  // Initial load
  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  useEffect(() => {
    fetchLeaveStats();
  }, []);

  // Add shift status check
  useEffect(() => {
    checkShiftStatus();
    const interval = setInterval(checkShiftStatus, 1000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (Platform.OS === "ios") {
      RNStatusBar.setBarStyle(
        theme === "dark" ? "light-content" : "dark-content"
      );
    } else {
      RNStatusBar.setBackgroundColor(theme === "dark" ? "#1F2937" : "#FFFFFF");
      RNStatusBar.setBarStyle(
        theme === "dark" ? "light-content" : "dark-content"
      );
    }
  }, [theme]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const updateShiftStatus = async () => {
      try {
        const shiftStatusData = await AsyncStorage.getItem(
          `${user?.role}-shiftStatus`
        );

        if (shiftStatusData) {
          const { isActive, startTime } = JSON.parse(shiftStatusData);
          setIsShiftActive(isActive);
          setShiftStartTime(startTime);
        } else {
          setIsShiftActive(false);
          setShiftStartTime(null);
        }
      } catch (error) {
        console.error("Error updating shift status:", error);
      }
    };

    // Initial update
    updateShiftStatus();

    // Set up interval for real-time updates
    intervalId = setInterval(updateShiftStatus, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [user?.role]);

  // Call clearStatsCache when component unmounts
  useEffect(() => {
    return () => {
      clearStatsCache();
    };
  }, [user?.id]);

  const quickActions: QuickAction[] = [
    {
      title: "Leave Management",
      icon: "calendar-outline",
      description: "Configure leave types, policies, and view analytics",
      route: "/(dashboard)/management/leave-management",
      color: "#3B82F6",
    },
  ];

  const handleNewQuickAction = (action: (typeof newQuickActions)[0]) => {
    if (action.title === "Shift Tracker") {
      Alert.alert("Under Development", "This feature will be available soon!", [
        { text: "OK" },
      ]);
      return;
    }
    router.push(action.route as any);
  };

  return (
    <View className="flex-1" style={styles.container as ViewStyle}>
      <StatusBar
        backgroundColor={theme === "dark" ? "#1F2937" : "#FFFFFF"}
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
        translucent
      />

      {/* Enhanced Header with Gradient */}
      <LinearGradient
        colors={
          theme === "dark" ? ["#1F2937", "#111827"] : ["#FFFFFF", "#F3F4F6"]
        }
        style={
          [
            styles.header,
            {
              paddingTop:
                Platform.OS === "ios" ? 50 : RNStatusBar.currentHeight ?? 0,
            },
          ] as unknown as ViewStyle
        }
      >
        <View
          className="flex-row items-center justify-between px-6"
          style={{
            paddingTop:
              Platform.OS === "ios"
                ? StatusBar.currentHeight || 44
                : StatusBar.currentHeight || 0,
          }}
        >
          <View>
            <Text
              className={`text-2xl font-bold ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
              style={styles.headerTitle as TextStyle}
            >
              Management Portal
            </Text>
            <Text
              className={theme === "dark" ? "text-gray-400" : "text-gray-600"}
            >
              Performance Overview
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(dashboard)/management/settings")}
            className="p-2 rounded-full"
            style={
              [
                styles.settingsButton,
                { backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6" },
              ] as unknown as ViewStyle
            }
          >
            <Ionicons
              name="settings-outline"
              size={24}
              color={theme === "dark" ? "#FFFFFF" : "#000000"}
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        className={`flex-1 ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#3B82F6"]} // Android
            tintColor={theme === "dark" ? "#FFFFFF" : "#3B82F6"} // iOS
          />
        }
      >
        {/* Shift Status Button */}
        <View className="mt-2" style={styles.shiftStatusContainer}>
          <TouchableOpacity
            onPress={() => router.push("/(dashboard)/shared/shiftTracker")}
            style={[
              styles.shiftStatusButton,
              {
                backgroundColor: isShiftActive
                  ? theme === "dark"
                    ? "#DC2626"
                    : "#EF4444"
                  : theme === "dark"
                  ? "#059669"
                  : "#10B981",
              },
            ]}
          >
            <View className="flex-row items-center justify-between w-full">
              <View className="flex-row items-center flex-1">
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor: isShiftActive
                        ? theme === "dark"
                          ? "rgba(220, 38, 38, 0.8)"
                          : "rgba(239, 68, 68, 0.8)"
                        : theme === "dark"
                        ? "rgba(5, 150, 105, 0.8)"
                        : "rgba(16, 185, 129, 0.8)",
                    },
                  ]}
                >
                  <Ionicons
                    name={isShiftActive ? "timer" : "timer-outline"}
                    size={20}
                    color="white"
                  />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.statusText}>
                    {isShiftActive ? "Active Shift" : "Start Shift"}
                  </Text>
                  {isShiftActive && shiftStartTime && (
                    <Text style={styles.timeText}>
                      Started at{" "}
                      {new Date(shiftStartTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.chevronContainer}>
                <Ionicons name="chevron-forward" size={20} color="white" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View className="px-6 py-4">
          {isLoading ? (
            <View className="h-[100px] flex items-center justify-center">
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between">
              {[
                {
                  label: "Total Teams",
                  value: dashboardData.totalTeams.toString(),
                  icon: "people",
                  trend: "+2",
                  onPress: () => {},
                },
                {
                  label: "Total Users Allowed",
                  value: dashboardData.userLimit.toString(),
                  icon: "people-circle",
                  trend: null,
                  onPress: () => {},
                },
              ].map((metric) => (
                <TouchableOpacity
                  key={metric.label}
                  onPress={metric.onPress}
                  className={`w-[48%] p-4 rounded-xl mb-4
                ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}
                >
                  <View className="flex-row justify-between items-center">
                    <Ionicons
                      name={metric.icon as keyof typeof Ionicons.glyphMap}
                      size={24}
                      color="#3B82F6"
                    />
                    {metric.trend && (
                      <Text
                        className={`text-sm ${
                          metric.trend.startsWith("+")
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {metric.trend}
                      </Text>
                    )}
                  </View>
                  <Text
                    className={`text-2xl font-bold mt-2
                  ${theme === "dark" ? "text-white" : "text-gray-800"}`}
                  >
                    {metric.value}
                  </Text>
                  <Text
                    className={
                      theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }
                  >
                    {metric.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* New Quick Actions Section - Above Group Analytics */}
        <View className="px-6 py-4">
          <Text
            className={`text-lg font-semibold mb-4 ${
              theme === "dark" ? "text-white" : "text-gray-800"
            }`}
          >
            Quick Actions
          </Text>
          <View className="flex-row flex-wrap -mx-2">
            {newQuickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                className="w-1/2 px-2 mb-4"
                onPress={() => handleNewQuickAction(action)}
              >
                <View
                  className={`p-4 rounded-xl ${
                    theme === "dark" ? "bg-gray-800" : "bg-white"
                  }`}
                  style={[styles.actionCard, { height: 160 }]}
                >
                  <View
                    className="w-12 h-12 rounded-full items-center justify-center mb-3"
                    style={{ backgroundColor: `${action.color}15` }}
                  >
                    <Ionicons
                      name={action.icon as keyof typeof Ionicons.glyphMap}
                      size={24}
                      color={action.color}
                    />
                  </View>
                  <Text
                    className={`text-xl font-semibold mb-1 ${
                      theme === "dark" ? "text-white" : "text-gray-800"
                    }`}
                  >
                    {action.title}
                  </Text>
                  <Text
                    className={`text-base ${
                      theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}
                    numberOfLines={2}
                  >
                    {action.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Enhanced Group Analytics Section */}
        <View className="px-6 py-4">
          <Text
            className={`text-lg font-semibold mb-4 ${
              theme === "dark" ? "text-white" : "text-gray-800"
            }`}
          >
            Group Analytics
          </Text>
          {isLoading ? (
            <View className="h-[150px] flex items-center justify-center">
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="space-x-4"
              contentContainerStyle={styles.analyticsContainer as ViewStyle}
            >
              {[
                {
                  title: "Team Performance",
                  icon: "trending-up",
                  count: `${dashboardData.analytics.teamPerformance.value}%`,
                  trend: dashboardData.analytics.teamPerformance.trend,
                },
                {
                  title: "Attendance Rate",
                  icon: "calendar",
                  count: `${dashboardData.analytics.attendanceRate.value}%`,
                  trend: dashboardData.analytics.attendanceRate.trend,
                },
                {
                  title: "Travel Efficiency",
                  icon: "car",
                  count: `₹${dashboardData.analytics.travelEfficiency.value}/km`,
                  trend: dashboardData.analytics.travelEfficiency.trend,
                },
                {
                  title: "Expense Overview",
                  icon: "wallet",
                  count: `₹${dashboardData.analytics.expenseOverview.value}`,
                  trend: dashboardData.analytics.expenseOverview.trend,
                },
              ].map((item) => (
                <TouchableOpacity
                  key={item.title}
                  style={[
                    styles.analyticsCard,
                    {
                      backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF",
                    },
                  ]}
                  className="relative overflow-hidden"
                >
                  <LinearGradient
                    colors={
                      theme === "dark"
                        ? [
                            "rgba(59, 130, 246, 0.1)",
                            "rgba(59, 130, 246, 0.05)",
                          ]
                        : [
                            "rgba(59, 130, 246, 0.1)",
                            "rgba(59, 130, 246, 0.02)",
                          ]
                    }
                    style={styles.cardGradient as ViewStyle}
                  />
                  <View className="flex-row justify-between items-center mb-3">
                    <View
                      className={`p-2 rounded-lg ${
                        theme === "dark" ? "bg-gray-800" : "bg-blue-50"
                      }`}
                    >
                      <Ionicons
                        name={item.icon as keyof typeof Ionicons.glyphMap}
                        size={24}
                        color="#3B82F6"
                      />
                    </View>
                    <Text
                      className={`text-sm ${
                        item.trend.startsWith("+")
                          ? "text-green-500"
                          : "text-red-500"
                      } font-medium`}
                    >
                      {item.trend}
                    </Text>
                  </View>
                  <Text
                    className={`text-2xl font-bold mb-1 ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {item.count}
                  </Text>
                  <Text
                    className={
                      theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }
                  >
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Leave Management Section - Updated UI */}
        <View className="px-6 py-4">
          <TouchableOpacity
            onPress={() => router.push(quickActions[0].route as any)}
            className={`p-6 rounded-xl ${
              theme === "dark" ? "bg-gray-800" : "bg-white"
            }`}
            style={styles.leaveCard}
          >
            <View className="flex-row items-center">
              <View
                className="w-14 h-14 rounded-full items-center justify-center"
                style={{ backgroundColor: `${quickActions[0].color}20` }}
              >
                <Ionicons
                  name={quickActions[0].icon}
                  size={28}
                  color={quickActions[0].color}
                />
              </View>
              <View className="flex-1 ml-4">
                <Text
                  className={`text-xl font-semibold mb-1 ${
                    theme === "dark" ? "text-white" : "text-gray-800"
                  }`}
                >
                  {quickActions[0].title}
                </Text>
                <Text
                  className={`text-sm ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {quickActions[0].description}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={24}
                color={theme === "dark" ? "#6B7280" : "#9CA3AF"}
              />
            </View>

            <View className="flex-row justify-between mt-6 pt-6 border-t border-gray-700">
              {statsLoading ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                [
                  {
                    label: "Pending",
                    value: leaveStats.pending_requests.toString(),
                    color: "#F59E0B",
                    icon: "time-outline",
                  },
                  {
                    label: "Approved",
                    value: leaveStats.approved_requests.toString(),
                    color: "#10B981",
                    icon: "checkmark-circle-outline",
                  },
                  {
                    label: "Active",
                    value: leaveStats.active_leave_types.toString(),
                    color: "#3B82F6",
                    icon: "people-outline",
                  },
                ].map((stat, index) => (
                  <View key={stat.label} className="items-center flex-1">
                    <View
                      className="w-10 h-10 rounded-full mb-2 items-center justify-center"
                      style={{ backgroundColor: `${stat.color}15` }}
                    >
                      <Ionicons
                        name={stat.icon as keyof typeof Ionicons.glyphMap}
                        size={20}
                        color={stat.color}
                      />
                    </View>
                    <Text
                      className="text-lg font-bold mb-1"
                      style={{ color: stat.color }}
                    >
                      {stat.value}
                    </Text>
                    <Text
                      className={`text-xs ${
                        theme === "dark" ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {stat.label}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Recent Activities Section */}
        <View className="px-6 py-4 mb-20">
          <View className="flex-row justify-between items-center mb-4">
            <Text
              className={`text-lg font-semibold ${
                theme === "dark" ? "text-white" : "text-gray-800"
              }`}
            >
              Recent Activities
            </Text>
          </View>
          {isLoading ? (
            <View className="h-[200px] flex items-center justify-center">
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : (
            <View
              className={`rounded-xl ${
                theme === "dark" ? "bg-gray-800" : "bg-white"
              }`}
              style={styles.approvalSection}
            >
              {dashboardData.recentActivities.length > 0 ? (
                dashboardData.recentActivities.map((activity, index) => {
                  // The description is already an object, no need to parse
                  const description = activity.description;

                  return (
                    <View
                      key={index}
                      className={`py-4 px-4 ${
                        index !== dashboardData.recentActivities.length - 1
                          ? "border-b"
                          : ""
                      } ${
                        theme === "dark" ? "border-gray-700" : "border-gray-200"
                      }`}
                    >
                      <View className="flex-row justify-between items-start mb-2">
                        <View className="flex-1 mr-3">
                          <Text
                            className={`font-medium mb-1 ${
                              theme === "dark" ? "text-white" : "text-gray-800"
                            }`}
                          >
                            {activity.title}
                          </Text>
                          {activity.type === "expense" ? (
                            <View>
                              <Text
                                className={`text-sm ${
                                  theme === "dark"
                                    ? "text-gray-400"
                                    : "text-gray-600"
                                }`}
                              >
                                {description.employee_name} - ₹
                                {description.amount}
                              </Text>
                              <Text
                                className={`text-xs ${
                                  theme === "dark"
                                    ? "text-gray-500"
                                    : "text-gray-500"
                                }`}
                              >
                                {description.department} •{" "}
                                {description.group_admin}
                              </Text>
                              <Text
                                className={`text-xs mt-1 ${
                                  description.status === "pending"
                                    ? "text-yellow-500"
                                    : description.status === "approved"
                                    ? "text-green-500"
                                    : "text-red-500"
                                }`}
                              >
                                {description.status?.toUpperCase() ?? "UNKNOWN"}
                              </Text>
                            </View>
                          ) : (
                            <Text
                              className={`text-sm ${
                                theme === "dark"
                                  ? "text-gray-400"
                                  : "text-gray-600"
                              }`}
                            >
                              {description.name}
                              {description.department &&
                                ` - ${description.department}`}
                              {description.group_admin &&
                                ` • ${description.group_admin}`}
                            </Text>
                          )}
                        </View>
                        <Text className="text-sm text-gray-500">
                          {new Date(activity.time).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View className="py-4 px-4">
                  <Text
                    className={`text-center ${
                      theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    No recent activities
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* New Section: Report Generation */}
        {/* <View className="px-6 py-4">
                    <Text className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                        Reports
                    </Text>
                    <View className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`} style={styles.reportSection as ViewStyle}>
                        {[
                            { label: 'Generate Performance Report', icon: 'document-text', format: 'PDF' },
                            { label: 'Export Attendance Data', icon: 'calendar', format: 'Excel' },
                            { label: 'Travel Analytics Export', icon: 'map', format: 'PDF' },
                        ].map((report, index) => (
                            <TouchableOpacity
                                key={index}
                                className={`flex-row items-center justify-between py-3 
                                ${index !== 2 ? 'border-b' : ''} ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}
                            >
                                <View className="flex-row items-center">
                                    <Ionicons name={report.icon as any} size={24} color="#3B82F6" />
                                    <Text className={`ml-3 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                        {report.label}
                                    </Text>
                                </View>
                                <View className="bg-blue-100 px-2 py-1 rounded">
                                    <Text className="text-blue-600 text-xs">{report.format}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View> */}

        {/* Enhanced Pending Approvals Section */}
        {/* <View className="px-6 py-4 mb-20">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                            Pending Approvals
                        </Text>
                        <TouchableOpacity 
                            className="flex-row items-center"
                            onPress={() => router.push('/(dashboard)/management/approvals')}
                        >
                            <Text className="text-blue-500 mr-1" style={{ fontSize: 14, marginHorizontal: -50 }}>View All</Text>
                            <Ionicons name="arrow-forward" size={16} color="#3B82F6" />
                        </TouchableOpacity>
                    </View>
                    <View 
                        className={`rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`} 
                        style={styles.approvalSection}
                    >
                        {[
                            { 
                                task: 'Review Q3 Performance Reports',
                                deadline: 'Due Tomorrow',
                                priority: 'high',
                                amount: '$15,000',
                                submitter: 'Sarah Chen'
                            },
                            { 
                                task: 'Approve Team Expenses',
                                deadline: 'Due Today',
                                priority: 'medium',
                                amount: '$8,500',
                                submitter: 'Mike Johnson'
                            },
                            { 
                                task: 'Schedule Leadership Meeting',
                                deadline: 'Due in 3 days',
                                priority: 'low',
                                amount: '$2,300',
                                submitter: 'Alex Thompson'
                            },
                        ].map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                className={`py-4 px-4 ${
                                    index !== 2 ? 'border-b' : ''
                                } ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}
                                style={styles.approvalItem as ViewStyle}
                            >
                                <View className="flex-row justify-between items-start mb-2">
                                    <View className="flex-1 mr-3">
                                        <Text className={`font-medium mb-1 ${
                                            theme === 'dark' ? 'text-white' : 'text-gray-800'
                                        }`}>
                                            {item.task}
                                        </Text>
                                        <Text className={`text-sm ${
                                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                        }`}>
                                            By {item.submitter}
                                        </Text>
                                    </View>
                                    <Text className="text-blue-500 font-medium">
                                        {item.amount}
                                    </Text>
                                </View>
                                <View className="flex-row justify-between items-center">
                                    <View className="flex-row items-center">
                                        <Ionicons 
                                            name="time-outline" 
                                            size={16} 
                                            color={theme === 'dark' ? '#9CA3AF' : '#6B7280'} 
                                        />
                                        <Text className={`ml-1 text-sm ${
                                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                        }`}>
                                            {item.deadline}
                                        </Text>
                                    </View>
                                    <View className={`px-3 py-1 rounded-full ${
                                        item.priority === 'high' ? 'bg-red-500' :
                                        item.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                                    }`}>
                                        <Text className="text-white text-xs capitalize font-medium">
                                            {item.priority}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View> */}
      </ScrollView>

      {/* <TouchableOpacity
                onPress={() => router.push('/management/group-admin-management')}
                className="absolute bottom-24 right-6 bg-blue-500 rounded-full p-4 shadow-lg"
                style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                    elevation: 5,
                }}
            >
                <View className="flex-row items-center">
                    <Ionicons name="people-circle" size={24} color="white" />
                    <Text className="text-white font-semibold ml-2">
                        Manage Group Admins
                    </Text>
                </View>
            </TouchableOpacity> */}

      <BottomNav items={managementNavItems} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  header: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 28,
    letterSpacing: 0.5,
  },
  settingsButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  scrollView: {},
  analyticsContainer: {
    paddingRight: 24,
    paddingVertical: 8,
  },
  analyticsCard: {
    padding: 16,
    borderRadius: 16,
    width: 180,
    marginRight: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  reportSection: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  approvalSection: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: Platform.OS === "ios" ? 0.5 : 0,
    borderColor: "rgba(0,0,0,0.1)",
  },
  approvalItem: {
    backgroundColor: "transparent",
  },
  leaveCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statsContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  //   iconContainer: {
  //     width: 48,
  //     height: 48,
  //     borderRadius: 12,
  //     justifyContent: "center",
  //     alignItems: "center",
  //   },
  actionCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  shiftStatusContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  shiftStatusButton: {
    padding: 16,
    paddingRight: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  timeText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 13,
    fontWeight: "500",
  },
  chevronContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 4,
    marginLeft: 12,
  },
});
