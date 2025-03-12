// app/(dashboard)/management/analytics.tsx
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar as RNStatusBar, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../context/ThemeContext';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { useEffect, useState } from 'react';
import BottomNav from "../../components/BottomNav";
import { managementNavItems } from "./utils/navigationItems";

interface ChartData {
  datasets: { data: number[] }[];
  labels: string[];
}

export default function ManagementAnalytics() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const { token } = useAuth();
  const screenWidth = Dimensions.get("window").width;
  const isDark = theme === "dark";

  const [analyticsData, setAnalyticsData] = useState({
    performanceData: {
      labels: [],
      datasets: [{ data: [] }],
    },
    attendanceData: {
      labels: [],
      datasets: [{ data: [] }],
    },
    keyMetrics: {
      avgPerformance: { value: 0, trend: "0%" },
      attendanceRate: { value: 0, trend: "0%" },
      taskCompletion: { value: 0, trend: "0%" },
      teamEfficiency: { value: 0, trend: "0%" },
    },
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/management/analytics-data`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setAnalyticsData(response.data);
      } catch (error) {
        console.error("Error fetching analytics data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [token]);

  useEffect(() => {
    if (Platform.OS === "ios") {
      RNStatusBar.setBarStyle(isDark ? "light-content" : "dark-content");
    } else {
      RNStatusBar.setBackgroundColor(isDark ? "#1F2937" : "#FFFFFF");
      RNStatusBar.setBarStyle(isDark ? "light-content" : "dark-content");
    }
  }, [isDark]);

  const chartConfig = {
    backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF",
    backgroundGradientFrom: theme === "dark" ? "#1F2937" : "#FFFFFF",
    backgroundGradientTo: theme === "dark" ? "#1F2937" : "#FFFFFF",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
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
    formatYLabel: (value: string | number): string =>
      Math.round(Number(value)).toString(),
    formatXLabel: (value: string | number): string => value.toString(),
  };

  const isValidChartData = (data: ChartData): boolean => {
    return (
      data?.datasets?.[0]?.data?.length > 0 &&
      data.labels?.length > 0 &&
      data.datasets[0].data.every(
        (value) => typeof value === "number" && !isNaN(value)
      )
    );
  };

  return (
    <View style={styles.container}>
      <RNStatusBar
        backgroundColor={isDark ? "#1F2937" : "#FFFFFF"}
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent
      />

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
        <View className="flex-row items-center justify-between px-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-4 p-2 rounded-full"
              style={[
                styles.backButton,
                { backgroundColor: isDark ? "#374151" : "#F3F4F6" },
              ]}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={isDark ? "#FFFFFF" : "#000000"}
              />
            </TouchableOpacity>
            <Text
              className={`text-2xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Analytics
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        className={`flex-1 ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}
        showsVerticalScrollIndicator={false}
      >
        {/* Performance Overview */}
        <View className="p-6">
          <Text
            className={`text-xl font-bold mb-4 ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            Team Performance
          </Text>
          {isLoading ? (
            <View className="h-[220px] flex items-center justify-center">
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : isValidChartData(analyticsData.performanceData) ? (
            <LineChart
              data={analyticsData.performanceData}
              width={screenWidth - 40}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              fromZero
              yAxisSuffix="%"
            />
          ) : (
            <Text className="text-gray-500">No data available</Text>
          )}
        </View>

        {/* Attendance Metrics */}
        <View className="p-6">
          <Text
            className={`text-xl font-bold mb-4 ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            Attendance Overview
          </Text>
          {isLoading ? (
            <View className="h-[220px] flex items-center justify-center">
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : isValidChartData(analyticsData.attendanceData) ? (
            <BarChart
              data={analyticsData.attendanceData}
              width={screenWidth - 40}
              height={220}
              yAxisLabel=""
              chartConfig={chartConfig}
              style={styles.chart}
              fromZero
              yAxisSuffix="%"
            />
          ) : (
            <Text className="text-gray-500">No data available</Text>
          )}
        </View>

        {/* Key Metrics */}
        <View className="p-6">
          <Text
            className={`text-xl font-bold mb-4 ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            Key Metrics
          </Text>
          {isLoading ? (
            <View className="h-[200px] flex items-center justify-center">
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between">
              {[
                {
                  label: "Avg Performance",
                  ...analyticsData.keyMetrics.avgPerformance,
                },
                {
                  label: "Attendance Rate",
                  ...analyticsData.keyMetrics.attendanceRate,
                },
                {
                  label: "Task Completion",
                  ...analyticsData.keyMetrics.taskCompletion,
                },
                {
                  label: "Team Efficiency",
                  ...analyticsData.keyMetrics.teamEfficiency,
                },
              ].map((metric, index) => (
                <View
                  key={index}
                  className={`w-[48%] p-4 rounded-xl mb-4 ${
                    theme === "dark" ? "bg-gray-800" : "bg-white"
                  }`}
                  style={styles.metricCard}
                >
                  <Text
                    className={`text-sm ${
                      theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {metric.label}
                  </Text>
                  <Text
                    className={`text-2xl font-bold mt-2 ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {metric.value}%
                  </Text>
                  <Text className="text-green-500 text-sm">{metric.trend}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <BottomNav items={managementNavItems} />
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    backButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },
    metricCard: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
});