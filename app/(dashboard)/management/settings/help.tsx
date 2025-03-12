import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar as RNStatusBar,
  Alert,
  Linking,
  Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import ThemeContext from "../../../context/ThemeContext";
import { StyleSheet } from "react-native";

interface HelpCategory {
  id: string;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  articles: HelpArticle[];
}

interface HelpArticle {
  id: string;
  title: string;
  preview: string;
}

interface Step {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const helpCategories: HelpCategory[] = [
  {
    id: "1",
    title: "Getting Started",
    icon: "rocket-launch",
    articles: [
      {
        id: "1-1",
        title: "How to Set Up Your Account",
        preview: "Learn the basics of setting up and configuring your account.",
      },
      {
        id: "1-2",
        title: "Understanding Dashboard",
        preview: "Get familiar with the main dashboard and its features.",
      },
    ],
  },
  {
    id: "2",
    title: "Account Management",
    icon: "manage-accounts",
    articles: [
      {
        id: "2-1",
        title: "Managing Team Members",
        preview: "Learn how to add, edit, and manage team members.",
      },
      {
        id: "2-2",
        title: "Privacy Settings",
        preview: "Configure your privacy and security settings.",
      },
    ],
  },
  {
    id: "3",
    title: "Reports & Analytics",
    icon: "analytics",
    articles: [
      {
        id: "3-1",
        title: "Generating Reports",
        preview: "Learn how to create and customize reports.",
      },
      {
        id: "3-2",
        title: "Understanding Analytics",
        preview: "Make sense of your analytics data.",
      },
    ],
  },
];

const articleSteps: Record<string, Step[]> = {
  "1-1": [
    {
      id: "1",
      title: "Receive Login Credentials",
      description: "Obtain your username and password from your administrator.",
      icon: "vpn-key",
    },
    {
      id: "2",
      title: "Login",
      description:
        "Open the Parrot Analyzer app, enter your credentials, and click Login.",
      icon: "login",
    },
    {
      id: "3",
      title: "Update Profile",
      description:
        "Navigate to the Profile section and update your personal details (e.g., name, contact information).",
      icon: "person",
    },
    {
      id: "4",
      title: "Change Password",
      description:
        "Go to Settings > Security, click Change Password, and set a new secure password.",
      icon: "lock",
    },
    {
      id: "5",
      title: "Explore Features",
      description:
        "Access available tools like Team Management, Notifications, and Report Settings to start managing your activities.",
      icon: "explore",
    },
  ],
  "1-2": [
    {
      id: "1",
      title: "Overview",
      description: "Key metrics like active employees and recent activities.",
      icon: "dashboard",
    },
    {
      id: "2",
      title: "Navigation",
      description:
        "Access features via the menu (e.g., Team Management, Notifications).",
      icon: "menu",
    },
    {
      id: "3",
      title: "Real-Time Data",
      description:
        "View live updates like employee locations and shift statuses.",
      icon: "update",
    },
    {
      id: "4",
      title: "Visuals",
      description: "Analyze trends with graphs and charts.",
      icon: "bar-chart",
    },
    {
      id: "5",
      title: "Alerts",
      description:
        "Address highlighted tasks like approvals or unread notifications.",
      icon: "notifications",
    },
  ],
  "2-1": [
    {
      id: "1",
      title: "View Team",
      description:
        "Navigate to Team Management to see a list of all team members.",
      icon: "group",
    },
    {
      id: "2",
      title: "Add Members",
      description:
        "Use the Add Member button to input details manually or upload a CSV file for bulk additions.",
      icon: "person-add",
    },
    {
      id: "3",
      title: "Edit Details",
      description:
        "Select a team member and click Edit to update their role or contact information.",
      icon: "edit",
    },
    {
      id: "4",
      title: "Remove Members",
      description: "Use the Remove option to delete a team member if needed.",
      icon: "person-remove",
    },
    {
      id: "5",
      title: "Search and Filter",
      description:
        "Quickly find team members using the search bar or role/status filters.",
      icon: "filter-list",
    },
  ],
  "2-2": [
    {
      id: "1",
      title: "Access Settings",
      description: "Navigate to Settings > Privacy from the dashboard.",
      icon: "settings",
    },
    {
      id: "2",
      title: "Control Data Sharing",
      description:
        "Enable or disable options for sharing data with other team members or departments.",
      icon: "share",
    },
    {
      id: "3",
      title: "Manage Permissions",
      description:
        "Set who can view or edit your reports, location, or personal details.",
      icon: "security",
    },
    {
      id: "4",
      title: "Password Protection",
      description:
        "Ensure your account is secure by regularly updating your password in the Security section.",
      icon: "lock",
    },
    {
      id: "5",
      title: "Activity Logs",
      description:
        "Review your recent activities and changes to ensure account security.",
      icon: "history",
    },
  ],
  "3-1": [
    {
      id: "1",
      title: "Access Reports",
      description: "Go to the Reports section from the dashboard.",
      icon: "description",
    },
    {
      id: "2",
      title: "Select Report Type",
      description:
        "Choose the desired report category (e.g., expenses, attendance).",
      icon: "category",
    },
    {
      id: "3",
      title: "Customize Filters",
      description: "Apply filters like date range, team, or specific metrics.",
      icon: "filter-alt",
    },
    {
      id: "4",
      title: "Preview Report",
      description:
        "Review the report summary to ensure accuracy before generating.",
      icon: "preview",
    },
    {
      id: "5",
      title: "Download or Share",
      description:
        "Export the report in your preferred format (e.g., PDF, Excel) or share it directly via email.",
      icon: "download",
    },
  ],
  "3-2": [
    {
      id: "1",
      title: "Dashboard Metrics",
      description:
        "View key performance indicators (KPIs) like attendance trends, expense summaries, or task completion rates.",
      icon: "speed",
    },
    {
      id: "2",
      title: "Charts and Graphs",
      description:
        "Analyze visual representations of data for insights into patterns and trends.",
      icon: "insert-chart",
    },
    {
      id: "3",
      title: "Filters",
      description:
        "Apply filters like date range, department, or team to refine analytics.",
      icon: "filter-list",
    },
    {
      id: "4",
      title: "Drill-Down Data",
      description:
        "Click on specific metrics or chart sections for detailed information.",
      icon: "zoom-in",
    },
    {
      id: "5",
      title: "Export Insights",
      description: "Save analytics reports for future reference or sharing.",
      icon: "save-alt",
    },
  ],
};

export default function HelpScreen() {
  const router = useRouter();
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === "dark";
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      RNStatusBar.setBarStyle(isDark ? "light-content" : "dark-content");
    } else {
      RNStatusBar.setBackgroundColor(isDark ? "#1F2937" : "#FFFFFF");
      RNStatusBar.setBarStyle(isDark ? "light-content" : "dark-content");
    }
  }, [isDark]);

  const handleArticlePress = (articleId: string) => {
    setSelectedArticle(articleId);
    setModalVisible(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#111827" : "#F3F4F6" }}>
      <RNStatusBar
        backgroundColor={isDark ? "#1F2937" : "#FFFFFF"}
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent
      />

      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#1F2937", "#111827"] : ["#FFFFFF", "#F3F4F6"]}
        style={[
          styles.header,
          {
            paddingTop:
              Platform.OS === "ios"
                ? 60
                : (RNStatusBar.currentHeight || 0) + 10,
          },
        ]}
      >
        <View
          className="flex-row items-center px-4"
          style={{ paddingBottom: 8 }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              isDark ? "bg-gray-800" : "bg-gray-100"
            }`}
          >
            <MaterialIcons
              name="arrow-back"
              size={24}
              color={isDark ? "#FFFFFF" : "#000000"}
            />
          </TouchableOpacity>
          <Text
            className={`text-2xl font-semibold ml-4 ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Help & Support
          </Text>
        </View>
      </LinearGradient>

      {/* Main Content */}
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {helpCategories.map((category) => (
          <View key={category.id} className="mb-6">
            <View className="flex-row items-center mb-3">
              <MaterialIcons
                name={category.icon}
                size={24}
                color={isDark ? "#60A5FA" : "#3B82F6"}
              />
              <Text
                className={`text-lg font-semibold ml-2 ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                {category.title}
              </Text>
            </View>
            {category.articles.map((article) => (
              <TouchableOpacity
                key={article.id}
                onPress={() => handleArticlePress(article.id)}
                className={`p-4 rounded-lg mb-2 ${
                  isDark ? "bg-gray-800" : "bg-white"
                }`}
                style={styles.card}
              >
                <Text
                  className={`font-medium mb-1 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  {article.title}
                </Text>
                <Text className={isDark ? "text-gray-400" : "text-gray-600"}>
                  {article.preview}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Article Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: isDark ? "rgba(0,0,0,0.9)" : "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? "#1F2937" : "#FFFFFF" },
            ]}
          >
            {selectedArticle && articleSteps[selectedArticle] && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="flex-row items-center justify-between mb-4">
                  <Text
                    className={`text-xl font-bold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {
                      helpCategories
                        .flatMap((category) => category.articles)
                        .find((article) => article.id === selectedArticle)
                        ?.title
                    }
                  </Text>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    className={`w-10 h-10 rounded-full items-center justify-center ${
                      isDark ? "bg-gray-700" : "bg-gray-200"
                    }`}
                  >
                    <MaterialIcons
                      name="close"
                      size={24}
                      color={isDark ? "#FFFFFF" : "#000000"}
                    />
                  </TouchableOpacity>
                </View>

                <View
                  className={`p-4 rounded-lg mb-4 ${
                    isDark ? "bg-gray-800" : "bg-gray-100"
                  }`}
                >
                  <Text
                    className={`text-base ${
                      isDark ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Follow these steps to{" "}
                    {helpCategories
                      .flatMap((category) => category.articles)
                      .find((article) => article.id === selectedArticle)
                      ?.title.toLowerCase()}
                  </Text>
                </View>

                {articleSteps[selectedArticle].map((step, index) => (
                  <View
                    key={step.id}
                    className={`mb-4 p-4 rounded-lg ${
                      isDark ? "bg-gray-800" : "bg-white"
                    }`}
                    style={styles.card}
                  >
                    <View className="flex-row items-center mb-2">
                      <View
                        className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                          isDark ? "bg-blue-900" : "bg-blue-100"
                        }`}
                      >
                        <MaterialIcons
                          name={step.icon}
                          size={22}
                          color={isDark ? "#60A5FA" : "#3B82F6"}
                        />
                      </View>
                      <View className="flex-row items-center">
                        <View
                          className={`w-6 h-6 rounded-full items-center justify-center mr-2 ${
                            isDark ? "bg-blue-800" : "bg-blue-500"
                          }`}
                        >
                          <Text className="text-white font-medium text-xs">
                            {index + 1}
                          </Text>
                        </View>
                        <Text
                          className={`text-lg font-medium ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {step.title}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className={`ml-13 pl-3 ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      {step.description}
                    </Text>
                  </View>
                ))}

                <View className="items-center mb-6 mt-4">
                  <TouchableOpacity
                    className={`px-6 py-3 rounded-full ${
                      isDark ? "bg-blue-700" : "bg-blue-500"
                    }`}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text className="text-white font-medium">Got it</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    paddingBottom: 16,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modalContent: {
    flex: 1,
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
});
