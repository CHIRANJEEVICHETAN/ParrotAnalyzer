import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
} from "react-native";
import ThemeContext from "../../context/ThemeContext";
import BottomNav from "../../components/BottomNav";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { NavItem } from "../../types/nav";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import AuthContext from "../../context/AuthContext";
import { groupAdminNavItems } from "./utils/navigationItems";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Add new interface for activities
interface RecentActivity {
  type: string;
  name: string;
  time: string;
}

export default function GroupAdminDashboard() {
  // Add state for activities
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [shiftStartTime, setShiftStartTime] = useState<string | null>(null);
  const { theme } = ThemeContext.useTheme();
  const { token, user } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === "dark";

  // Add useEffect to fetch activities
  useEffect(() => {
    fetchRecentActivities();
  }, []);

  // Add shift status check
  useEffect(() => {
    checkShiftStatus();
    const interval = setInterval(checkShiftStatus, 1000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchRecentActivities = async () => {
    try {
      setLoadingActivities(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/recent-activities`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setActivities(response.data);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
    } finally {
      setLoadingActivities(false);
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

  // Quick action cards data
  const quickActions = [
    {
      title: "Employee Management",
      icon: "people-outline",
      color: "#3B82F6",
      route: "/(dashboard)/Group-Admin/employee-management",
      description: "Manage your employees",
    },
    {
      title: "Expense Management",
      icon: "receipt-outline",
      color: "#10B981",
      route: "/(dashboard)/Group-Admin/expense-management",
      description: "Manage employee expenses",
    },
    {
      title: "Task Management",
      icon: "list-outline",
      color: "#8B5CF6",
      route: "/(dashboard)/Group-Admin/task-management",
      description: "Manage employee tasks",
    },
    {
      title: "Attendance Management",
      icon: "calendar-outline",
      color: "#F59E0B", // Amber color
      route: "/(dashboard)/Group-Admin/attendance-management",
      description: "Track employee attendance",
    },
    {
      title: "Live Tracking",
      icon: "location-outline",
      color: "#EF4444", // Red color
      route: "/(dashboard)/Group-Admin/tracking",
      description: "Real-time employee location",
    },
    {
      title: "View Reports",
      icon: "bar-chart-outline",
      color: "#6366F1", // Changed to Indigo color
      route: "/(dashboard)/Group-Admin/reports",
      description: "Access employee reports",
    },
  ];

  // Add new section for Leave Management
  const leaveManagementActions = [
    {
      title: "Leave Management",
      icon: "calendar-outline",
      color: "#EC4899", // Pink color for distinction
      route: "/(dashboard)/Group-Admin/leave-management",
      description: "Manage employee leave requests",
    },
    {
      title: "Leave Insights",
      icon: "time-outline",
      color: "#6366F1", // Indigo color
      route: "/(dashboard)/Group-Admin/leave-insights",
      description: "View leave balance and request for leaves",
    },
  ];

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: isDark ? "#111827" : "#F3F4F6" }}
    >
      <StatusBar
        backgroundColor={isDark ? "#1F2937" : "#FFFFFF"}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      {/* Header */}
      <View
        className={`${isDark ? "bg-gray-800" : "bg-white"}`}
        style={styles.header}
      >
        <View className="flex-row items-center justify-between px-4 pt-3 pb-4">
          <Text
            style={{ fontSize: 23 }}
            className={`pl-4 font-semibold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Group Admin
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(dashboard)/Group-Admin/settings")}
            className={`p-2 rounded-full ${
              isDark ? "bg-gray-700" : "bg-gray-100"
            }`}
          >
            <Ionicons
              name="settings-outline"
              size={24}
              color={isDark ? "#FFFFFF" : "#111827"}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={[
          styles.content,
          { backgroundColor: isDark ? "#111827" : "#F3F4F6" },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Shift Status Button - Moved inside header */}
        <View className="mt-2" style={styles.shiftStatusContainer}>
          <TouchableOpacity
            onPress={() => router.push("/(dashboard)/shared/shiftTracker")}
            style={[
              styles.shiftStatusButton,
              {
                backgroundColor: isShiftActive
                  ? isDark
                    ? "#DC2626"
                    : "#EF4444"
                  : isDark
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
                        ? isDark
                          ? "rgba(220, 38, 38, 0.8)"
                          : "rgba(239, 68, 68, 0.8)"
                        : isDark
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

        {/* Quick Actions Grid */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? "#FFFFFF" : "#111827" },
            ]}
          >
            Quick Actions
          </Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.quickActionCard,
                  { backgroundColor: isDark ? "#1F2937" : "#FFFFFF" },
                ]}
                onPress={() => router.push(action.route as any)}
              >
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: `${action.color}20` },
                  ]}
                >
                  <Ionicons
                    name={action.icon as keyof typeof Ionicons.glyphMap}
                    size={24}
                    color={action.color}
                  />
                </View>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: isDark ? "#FFFFFF" : "#111827" },
                  ]}
                >
                  {action.title}
                </Text>
                <Text
                  style={[
                    styles.cardDescription,
                    { color: isDark ? "#9CA3AF" : "#6B7280" },
                  ]}
                >
                  {action.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* New Leave Management Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? "#FFFFFF" : "#111827" },
            ]}
          >
            Leave Management
          </Text>
          <View style={styles.quickActionsGrid}>
            {leaveManagementActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.quickActionCard,
                  { backgroundColor: isDark ? "#1F2937" : "#FFFFFF" },
                ]}
                onPress={() => router.push(action.route as any)}
              >
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: `${action.color}20` },
                  ]}
                >
                  <Ionicons
                    name={action.icon as keyof typeof Ionicons.glyphMap}
                    size={24}
                    color={action.color}
                  />
                </View>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: isDark ? "#FFFFFF" : "#111827" },
                  ]}
                >
                  {action.title}
                </Text>
                <Text
                  style={[
                    styles.cardDescription,
                    { color: isDark ? "#9CA3AF" : "#6B7280" },
                  ]}
                >
                  {action.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Activity Section */}
        <View
          className={`mt-6 mx-4 p-4 rounded-xl mb-10 ${
            isDark ? "bg-gray-800" : "bg-white"
          }`}
          style={styles.activityCard}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <View
                className={`w-8 h-8 rounded-full items-center justify-center mr-2 ${
                  isDark ? "bg-blue-500/20" : "bg-blue-100"
                }`}
              >
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={isDark ? "#60A5FA" : "#3B82F6"}
                />
              </View>
              <Text
                className={`text-lg font-semibold ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Recent Activity
              </Text>
            </View>
          </View>

          {loadingActivities ? (
            <View className="py-8">
              <ActivityIndicator
                size="small"
                color={isDark ? "#60A5FA" : "#3B82F6"}
              />
            </View>
          ) : activities.length === 0 ? (
            <View className="py-8 items-center">
              <Ionicons
                name="notifications-outline"
                size={40}
                color={isDark ? "#4B5563" : "#9CA3AF"}
              />
              <Text
                className={`mt-2 text-center ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                No recent activities
              </Text>
            </View>
          ) : (
            activities.map((activity, index) => {
              // Determine icon based on activity type
              let icon: keyof typeof Ionicons.glyphMap = "ellipse-outline";
              let iconColor = isDark ? "#60A5FA" : "#3B82F6";

              if (activity.type.includes("Employee")) {
                icon = "person-add-outline";
                iconColor = "#10B981"; // Green
              } else if (activity.type.includes("Task")) {
                icon = "list-outline";
                iconColor = "#8B5CF6"; // Purple
              } else if (activity.type.includes("Expense")) {
                icon = "receipt-outline";
                iconColor = activity.type.includes("Approved")
                  ? "#10B981"
                  : "#EF4444";
              }

              return (
                <View
                  key={index}
                  className={`py-3 ${
                    index !== activities.length - 1 ? "border-b" : ""
                  } ${isDark ? "border-gray-700" : "border-gray-200"}`}
                >
                  <View className="flex-row items-center">
                    <View
                      className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                        isDark ? "bg-gray-700" : "bg-gray-100"
                      }`}
                    >
                      <Ionicons name={icon} size={16} color={iconColor} />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1">
                          <Text
                            className={`text-sm font-medium ${
                              isDark ? "text-gray-300" : "text-gray-700"
                            }`}
                          >
                            {activity.type}
                          </Text>
                          <Text
                            className={`text-base font-semibold ${
                              isDark ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {activity.name}
                          </Text>
                        </View>
                        <Text
                          className={`text-xs ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          {activity.time}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <BottomNav items={groupAdminNavItems} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3, // Add padding to accommodate the shift status button
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  headerSubtitle: {
    fontSize: 14,
  },
  settingsButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickActionCard: {
    width: "48%",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
  },
  activityList: {
    borderRadius: 12,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  activityItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  borderBottom: {
    borderBottomWidth: 1,
  },
  activityContent: {
    flex: 1,
  },
  activityType: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  activityName: {
    fontSize: 16,
    fontWeight: "500",
  },
  activityTime: {
    fontSize: 12,
  },
  activityCard: {
    marginTop: 16, // Reduced margin since button is now fixed in header
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
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
