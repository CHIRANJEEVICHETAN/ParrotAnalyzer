import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../context/ThemeContext';
import { useState } from 'react';
import { superAdminNavItems } from "./utils/navigationItems";
import BottomNav from "../../components/BottomNav";

export default function SystemConfig() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();

  // State for various system configurations
  const [configs, setConfigs] = useState({
    geofencing: true,
    automaticBackup: true,
    maintenanceMode: false,
    debugMode: false,
    emailNotifications: true,
    pushNotifications: true,
  });

  const configSections = [
    {
      title: "Core Settings",
      items: [
        {
          label: "Geofencing",
          description: "Enable location-based attendance tracking",
          key: "geofencing",
          icon: "location-outline",
        },
        {
          label: "Automatic Backup",
          description: "Daily system backup at midnight",
          key: "automaticBackup",
          icon: "save-outline",
        },
        {
          label: "Maintenance Mode",
          description: "Restrict access during maintenance",
          key: "maintenanceMode",
          icon: "construct-outline",
        },
      ],
    },
    {
      title: "Notifications",
      items: [
        {
          label: "Email Notifications",
          description: "Send system alerts via email",
          key: "emailNotifications",
          icon: "mail-outline",
        },
        {
          label: "Push Notifications",
          description: "Enable mobile push notifications",
          key: "pushNotifications",
          icon: "notifications-outline",
        },
      ],
    },
    {
      title: "Developer Options",
      items: [
        {
          label: "Debug Mode",
          description: "Enable detailed system logs",
          key: "debugMode",
          icon: "bug-outline",
        },
      ],
    },
  ];

  const handleConfigChange = (key: string, value: boolean) => {
    setConfigs((prev) => ({ ...prev, [key]: value }));
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
                ? StatusBar.currentHeight ?? 44
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
                System Config
              </Text>
              <Text
                className={theme === "dark" ? "text-gray-400" : "text-gray-600"}
              >
                Configure system settings
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        className={`flex-1 ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}
        showsVerticalScrollIndicator={false}
      >
        {configSections.map((section) => (
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
                    <View className="flex-row items-center">
                      <View
                        className={`w-8 h-8 rounded-full items-center justify-center ${
                          theme === "dark" ? "bg-gray-700" : "bg-gray-100"
                        }`}
                      >
                        <Ionicons
                          name={item.icon as any}
                          size={20}
                          color={
                            configs[item.key as keyof typeof configs]
                              ? "#3B82F6"
                              : theme === "dark"
                              ? "#9CA3AF"
                              : "#6B7280"
                          }
                        />
                      </View>
                      <Text
                        className={`ml-3 font-medium ${
                          theme === "dark" ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {item.label}
                      </Text>
                    </View>
                    <Switch
                      value={configs[item.key as keyof typeof configs]}
                      onValueChange={(value) =>
                        handleConfigChange(
                          item.key as keyof typeof configs,
                          value
                        )
                      }
                      trackColor={{ false: "#767577", true: "#3B82F6" }}
                      thumbColor={theme === "dark" ? "#FFFFFF" : "#F3F4F6"}
                    />
                  </View>
                  <Text
                    className={`ml-11 ${
                      theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {item.description}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Save Button */}
        <View className="px-4 mb-8">
          <TouchableOpacity
            onPress={() => {
              // Implement save configuration logic
              router.back();
            }}
            className="bg-blue-500 rounded-xl py-4"
            style={styles.saveButton}
          >
            <Text className="text-white text-center font-semibold text-lg">
              Save Changes
            </Text>
          </TouchableOpacity>
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
    sectionContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    saveButton: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 2,
    },
});
