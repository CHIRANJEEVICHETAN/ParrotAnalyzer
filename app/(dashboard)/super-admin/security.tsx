import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Switch,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import ThemeContext from "../../context/ThemeContext";
import { useState } from "react";
import { superAdminNavItems } from "./utils/navigationItems";
import BottomNav from "../../components/BottomNav";

export default function Security() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: true,
    biometricLogin: false,
    passwordExpiry: true,
    loginNotifications: true,
    ipRestriction: false,
    auditLogging: true,
  });

  const securitySections = [
    {
      title: "Authentication",
      items: [
        {
          label: "Two-Factor Authentication",
          description: "Require 2FA for all admin accounts",
          key: "twoFactorAuth",
          icon: "shield-checkmark-outline",
          criticalSetting: true,
        },
        {
          label: "Biometric Login",
          description: "Allow fingerprint/face authentication",
          key: "biometricLogin",
          icon: "finger-print-outline",
        },
        {
          label: "Password Expiry",
          description: "Force password change every 90 days",
          key: "passwordExpiry",
          icon: "key-outline",
        },
      ],
    },
    {
      title: "Monitoring",
      items: [
        {
          label: "Login Notifications",
          description: "Alert on suspicious login attempts",
          key: "loginNotifications",
          icon: "notifications-outline",
        },
        {
          label: "IP Restriction",
          description: "Limit access to specific IP ranges",
          key: "ipRestriction",
          icon: "globe-outline",
        },
        {
          label: "Audit Logging",
          description: "Track all system changes",
          key: "auditLogging",
          icon: "document-text-outline",
          criticalSetting: true,
        },
      ],
    },
  ];

  // Recent security events
  const securityEvents = [
    {
      type: "warning",
      message: "Failed login attempt",
      details: "IP: 192.168.1.1",
      time: "2 mins ago",
    },
    {
      type: "success",
      message: "Security scan completed",
      details: "No vulnerabilities found",
      time: "1 hour ago",
    },
    {
      type: "error",
      message: "Multiple failed 2FA attempts",
      details: "User: admin@example.com",
      time: "3 hours ago",
    },
  ];

  const handleSettingChange = (key: string, value: boolean) => {
    setSecuritySettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={
          theme === "dark" ? ["#1F2937", "#111827"] : ["#FFFFFF", "#F3F4F6"]
        }
        style={[
          styles.header,
          {
            paddingTop:
              Platform.OS === "ios"
                ? StatusBar.currentHeight || 44
                : (StatusBar.currentHeight ?? 0) + 10,
          },
        ]}
      >
        <View className="flex-row items-center justify-between px-6">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-4 p-2 rounded-full"
              style={[
                styles.backButton,
                { backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6" },
              ]}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={theme === "dark" ? "#FFFFFF" : "#000000"}
              />
            </TouchableOpacity>
            <View>
              <Text
                className={`text-2xl font-bold ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                Security
              </Text>
              <Text
                className={theme === "dark" ? "text-gray-400" : "text-gray-600"}
              >
                System Security Settings
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(dashboard)/super-admin/reports")}
            className="p-2 rounded-full"
            style={[
              styles.logButton,
              { backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6" },
            ]}
          >
            <Ionicons
              name="list-outline"
              size={24}
              color={theme === "dark" ? "#FFFFFF" : "#000000"}
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        className={`flex-1 ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}
        showsVerticalScrollIndicator={false}
      >
        {/* Security Score */}
        <View className="px-6 py-4">
          <View
            className={`p-4 rounded-xl ${
              theme === "dark" ? "bg-gray-800" : "bg-white"
            }`}
            style={styles.scoreCard}
          >
            <Text
              className={`text-lg font-semibold mb-2 ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            >
              Security Score
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-3xl font-bold text-green-500">85/100</Text>
              <TouchableOpacity
                className="bg-green-500 px-4 py-2 rounded-lg"
                onPress={() =>
                  Alert.alert(
                    "Security Recommendations",
                    "The security recommendations feature is coming soon. This will provide detailed suggestions to improve your security score.",
                    [{ text: "OK", style: "default" }]
                  )
                }
              >
                <Text className="text-white font-medium">
                  View Recommendations
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Security Settings */}
        {securitySections.map((section) => (
          <View key={section.title} className="mb-6">
            <Text
              className={`px-6 py-2 text-sm font-medium ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {section.title}
            </Text>
            <View
              className={`mx-4 rounded-xl ${
                theme === "dark" ? "bg-gray-800" : "bg-white"
              }`}
              style={styles.sectionContainer}
            >
              {section.items.map((item, index) => (
                <View
                  key={item.key}
                  className={`p-4 ${
                    index !== section.items.length - 1
                      ? "border-b border-gray-700"
                      : ""
                  }`}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center flex-1">
                      <View
                        className={`w-8 h-8 rounded-full items-center justify-center ${
                          theme === "dark" ? "bg-gray-700" : "bg-gray-100"
                        }`}
                      >
                        <Ionicons
                          name={item.icon as any}
                          size={20}
                          color={
                            securitySettings[
                              item.key as keyof typeof securitySettings
                            ]
                              ? "#3B82F6"
                              : theme === "dark"
                              ? "#9CA3AF"
                              : "#6B7280"
                          }
                        />
                      </View>
                      <View className="ml-3 flex-1">
                        <View className="flex-row items-center">
                          <Text
                            className={`font-medium ${
                              theme === "dark" ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {item.label}
                          </Text>
                          {item.criticalSetting && (
                            <View className="ml-2 px-2 py-1 bg-red-500 rounded-full">
                              <Text className="text-white text-xs">
                                Critical
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text
                          className={`${
                            theme === "dark" ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          {item.description}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={
                        securitySettings[
                          item.key as keyof typeof securitySettings
                        ]
                      }
                      onValueChange={(value) =>
                        handleSettingChange(item.key, value)
                      }
                      trackColor={{ false: "#767577", true: "#3B82F6" }}
                      thumbColor={theme === "dark" ? "#FFFFFF" : "#F3F4F6"}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Recent Security Events */}
        <View className="px-6 mb-8">
          <Text
            className={`text-lg font-semibold mb-4 ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            Recent Events
          </Text>
          <View
            className={`rounded-xl ${
              theme === "dark" ? "bg-gray-800" : "bg-white"
            }`}
            style={styles.eventsContainer}
          >
            {securityEvents.map((event, index) => (
              <View
                key={index}
                className={`p-4 ${
                  index !== securityEvents.length - 1
                    ? "border-b border-gray-700"
                    : ""
                }`}
              >
                <View className="flex-row items-center mb-2">
                  <View
                    className={`w-2 h-2 rounded-full mr-2 ${
                      event.type === "warning"
                        ? "bg-yellow-500"
                        : event.type === "error"
                        ? "bg-red-500"
                        : "bg-green-500"
                    }`}
                  />
                  <Text
                    className={`font-medium ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {event.message}
                  </Text>
                </View>
                <Text
                  className={
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }
                >
                  {event.details}
                </Text>
                <Text
                  className={`text-sm ${
                    theme === "dark" ? "text-gray-500" : "text-gray-400"
                  }`}
                >
                  {event.time}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <BottomNav items={superAdminNavItems} />
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
    elevation: 3,
    paddingBottom: 16,
  },
  backButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  scoreCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  eventsContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
});
