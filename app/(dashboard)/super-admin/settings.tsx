import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  StyleSheet,
  Platform,
  StatusBar,
  Modal,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ThemeContext from "../../context/ThemeContext";
import AuthContext from "../../context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";

interface SettingItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  action: () => void;
  showArrow?: boolean;
  isSwitch?: boolean;
  value?: boolean;
}

export default function SuperAdminSettings() {
  const { theme, toggleTheme } = ThemeContext.useTheme();
  const { logout } = AuthContext.useAuth();
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const [modalAnimation] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (showLogoutModal) {
      Animated.timing(modalAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(modalAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showLogoutModal]);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    try {
      // Call logout() first to properly unregister device tokens
      await logout();
      // Then navigate to signin
      router.replace("/(auth)/signin");
    } catch (error) {
      console.error("Error during logout:", error);
      // Still try to navigate even if logout fails
      router.replace("/(auth)/signin");
    }
  };

  const settingsSections: { title: string; items: SettingItem[] }[] = [
    {
      title: "Company Management",
      items: [
        {
          icon: "business-outline",
          label: "Add New Company",
          action: () => router.push("/(dashboard)/super-admin/add-company"),
          showArrow: true,
        },
        {
          icon: "settings-outline",
          label: "Manage Companies",
          action: () =>
            router.push("/(dashboard)/super-admin/company_management"),
          showArrow: true,
        },
      ],
    },
    {
      title: "User Management",
      items: [
        {
          icon: "people-outline",
          label: "View All Users",
          action: () =>
            router.push("/(dashboard)/super-admin/settings/usersSettings"),
          showArrow: true,
        },
      ],
    },
    {
      title: "Subscription Management",
      items: [
        {
          icon: "card-outline",
          label: "View Subscription Plans",
          action: () =>
            router.push(
              "/(dashboard)/super-admin/settings/subscriptionsSettings"
            ),
          showArrow: true,
        },
      ],
    },
    {
      title: "Security Settings",
      items: [
        {
          icon: "lock-closed-outline",
          label: "Change Password",
          action: () =>
            router.push(
              "/(dashboard)/super-admin/settings/change-passwordSettings"
            ),
          showArrow: true,
        },
      ],
    },
    {
      title: "Appearance",
      items: [
        {
          icon: theme === "dark" ? "moon" : "sunny",
          label: "Dark Mode",
          action: toggleTheme,
          isSwitch: true,
          value: theme === "dark",
        },
      ],
    },
  ];

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: theme === "dark" ? "#111827" : "#F3F4F6" }}
    >
      <StatusBar
        backgroundColor={theme === "dark" ? "#1F2937" : "#FFFFFF"}
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
      />

      <View
        className={`${theme === "dark" ? "bg-gray-800" : "bg-white"}`}
        style={styles.header}
      >
        <View className="flex-row items-center justify-between px-4 pt-3 pb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className={`p-2 rounded-full ${
              theme === "dark" ? "bg-gray-700" : "bg-gray-100"
            }`}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={theme === "dark" ? "#FFFFFF" : "#111827"}
            />
          </TouchableOpacity>
          <Text
            className={`text-xl font-semibold ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            Settings
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView
        className={`flex-1 ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {settingsSections.map((section, sectionIndex) => (
          <View
            key={section.title}
            className={`mb-6 ${sectionIndex !== 0 ? "mt-2" : ""}`}
            style={styles.section}
          >
            <Text
              className={`px-6 py-2 text-sm font-semibold ${
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              }`}
            >
              {section.title}
            </Text>
            <View
              className={`mx-4 rounded-xl ${
                theme === "dark" ? "bg-gray-800" : "bg-white"
              }`}
              style={styles.sectionContent}
            >
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={item.action}
                  className="p-4 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center flex-1">
                    <View
                      className={`w-10 h-10 rounded-xl items-center justify-center ${
                        theme === "dark" ? "bg-gray-700" : "bg-gray-100"
                      }`}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={22}
                        color={theme === "dark" ? "#FFFFFF" : "#000000"}
                      />
                    </View>
                    <Text
                      className={`ml-3 text-base font-medium ${
                        theme === "dark" ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {item.label}
                    </Text>
                  </View>
                  {item.isSwitch ? (
                    <Switch
                      value={item.value}
                      onValueChange={item.action}
                      trackColor={{
                        false: theme === "dark" ? "#4B5563" : "#D1D5DB",
                        true: "#60A5FA",
                      }}
                      thumbColor={item.value ? "#3B82F6" : "#F3F4F6"}
                    />
                  ) : (
                    item.showArrow && (
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
                      />
                    )
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View className="px-4 mb-8">
          <TouchableOpacity
            onPress={handleLogout}
            style={styles.logoutButton}
            className="rounded-md"
          >
            <LinearGradient
              colors={["#DC2626", "#B91C1C"]}
              className="p-4 rounded-md"
            >
              <Text className="text-white text-center font-semibold text-base">
                Logout
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View className="items-center mb-8">
          <Text
            className={theme === "dark" ? "text-gray-500" : "text-gray-400"}
          >
            Version {process.env.EXPO_PUBLIC_APP_VERSION}
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={showLogoutModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <Animated.View 
          style={[
            styles.modalOverlay,
            {
              opacity: modalAnimation,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }
          ]}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                opacity: modalAnimation,
                transform: [
                  {
                    scale: modalAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
                backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF",
              },
            ]}
          >
            <View className="items-center mb-2">
              <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-4">
                <Ionicons name="log-out-outline" size={32} color="#EF4444" />
              </View>
              <Text className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                Logout Confirmation
              </Text>
            </View>
            
            <Text className={`text-center my-4 px-4 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
              Are you sure you want to logout from your account?
            </Text>
            
            <View className="flex-row mt-2 px-2">
              <TouchableOpacity
                onPress={() => setShowLogoutModal(false)}
                className={`flex-1 py-3 mr-2 rounded-xl ${theme === "dark" ? "bg-gray-700" : "bg-gray-200"}`}
              >
                <Text className={`text-center font-semibold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={confirmLogout}
                className="flex-1 py-3 ml-2 rounded-xl bg-red-500"
              >
                <Text className="text-center text-white font-semibold">
                  Logout
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === "ios" ? 44 : StatusBar.currentHeight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 8,
  },
  sectionContent: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  logoutButton: {
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderRadius: 16,
    marginTop: 15,
    overflow: "hidden",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
});
