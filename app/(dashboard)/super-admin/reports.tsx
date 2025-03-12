import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import ThemeContext from "../../context/ThemeContext";
import { LineChart, BarChart } from "react-native-chart-kit";
import { useState } from "react";
import { superAdminNavItems } from "./utils/navigationItems";
import BottomNav from "../../components/BottomNav";

export default function Reports() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const screenWidth = Dimensions.get("window").width;

  const chartConfig = {
    backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF",
    backgroundGradientFrom: theme === "dark" ? "#1F2937" : "#FFFFFF",
    backgroundGradientTo: theme === "dark" ? "#1F2937" : "#FFFFFF",
    decimalPlaces: 0,
    color: (opacity = 1) =>
      theme === "dark"
        ? `rgba(255, 255, 255, ${opacity})`
        : `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) =>
      theme === "dark"
        ? `rgba(255, 255, 255, ${opacity})`
        : `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "6",
      strokeWidth: "2",
      stroke: "#3B82F6",
    },
  };

  const reportTypes = [
    { label: "User Activity", icon: "people", count: "1.2K", trend: "+12%" },
    { label: "System Load", icon: "speedometer", count: "45%", trend: "-5%" },
    { label: "Error Rate", icon: "warning", count: "0.8%", trend: "-15%" },
    { label: "API Calls", icon: "code-working", count: "850K", trend: "+8%" },
  ];

  const lineData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [
      {
        data: [65, 59, 80, 81, 56, 55, 40],
        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const barData = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets: [
      {
        data: [20, 45, 28, 80, 99, 43],
      },
    ],
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
                Reports
              </Text>
              <Text
                className={theme === "dark" ? "text-gray-400" : "text-gray-600"}
              >
                System Analytics & Reports
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        className={`flex-1 ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}
        showsVerticalScrollIndicator={false}
      >
        {/* Time Period Selector */}
        <View className="flex-row justify-between px-6 py-4">
          {["day", "week", "month", "year"].map((period) => (
            <TouchableOpacity
              key={period}
              onPress={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-full ${
                selectedPeriod === period
                  ? "bg-blue-500"
                  : theme === "dark"
                  ? "bg-gray-800"
                  : "bg-white"
              }`}
              style={styles.periodButton}
            >
              <Text
                className={`capitalize ${
                  selectedPeriod === period
                    ? "text-white"
                    : theme === "dark"
                    ? "text-gray-300"
                    : "text-gray-600"
                }`}
              >
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Stats */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-6 py-4"
        >
          {reportTypes.map((item, index) => (
            <View
              key={index}
              className={`mr-4 p-4 rounded-xl ${
                theme === "dark" ? "bg-gray-800" : "bg-white"
              }`}
              style={styles.statCard}
            >
              <View className="flex-row items-center mb-2">
                <View
                  className={`p-2 rounded-lg ${
                    theme === "dark" ? "bg-gray-700" : "bg-blue-50"
                  }`}
                >
                  <Ionicons name={item.icon as any} size={24} color="#3B82F6" />
                </View>
                <Text
                  className={`ml-2 ${
                    item.trend.startsWith("+")
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {item.trend}
                </Text>
              </View>
              <Text
                className={`text-2xl font-bold ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                {item.count}
              </Text>
              <Text
                className={theme === "dark" ? "text-gray-400" : "text-gray-600"}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Charts */}
        <View className="px-4 py-4">
          <View
            className={`p-4 rounded-xl mb-4 ${
              theme === "dark" ? "bg-gray-800" : "bg-white"
            }`}
            style={styles.chartCard}
          >
            <Text
              className={`text-lg font-semibold mb-4 ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            >
              User Activity
            </Text>
            <LineChart
              data={lineData}
              width={screenWidth - 48}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          </View>

          <View
            className={`p-4 rounded-xl ${
              theme === "dark" ? "bg-gray-800" : "bg-white"
            }`}
            style={styles.chartCard}
          >
            <Text
              className={`text-lg font-semibold mb-4 ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            >
              System Usage
            </Text>
            <BarChart
              data={barData}
              width={screenWidth - 48}
              height={220}
              chartConfig={chartConfig}
              yAxisLabel="%"
              yAxisSuffix="%"
              style={styles.chart}
            />
          </View>
        </View>

        {/* Export Options */}
        <View className="px-4 mb-8">
          <TouchableOpacity
            className={`p-4 rounded-xl flex-row items-center justify-center ${
              theme === "dark" ? "bg-blue-600" : "bg-blue-500"
            }`}
            style={styles.exportButton}
          >
            <Ionicons name="download-outline" size={24} color="#FFFFFF" />
            <Text className="text-white font-semibold ml-2">Export Report</Text>
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
  periodButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statCard: {
    minWidth: 150,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  chartCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  exportButton: {
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
});
