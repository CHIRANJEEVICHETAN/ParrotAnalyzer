import React, { useState, useCallback, useRef } from "react";
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
} from "react-native";
import { Stack } from "expo-router";
import ThemeContext from "../../context/ThemeContext";
import PushNotificationsList from "./../../components/PushNotificationsList";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { LinearGradient } from 'expo-linear-gradient';

type NotificationType = "all" | "general" | "task" | "reminder";

export default function EmployeeNotifications() {
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === "dark";
  const [selectedType, setSelectedType] = useState<NotificationType>("all");
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const { width: SCREEN_WIDTH } = Dimensions.get('window');

  const filterTypes = useMemo(() => [
    { id: "all", label: "All", icon: "bell-outline", count: 12 },
    { id: "general", label: "General", icon: "information-outline", count: 5 },
    { id: "task", label: "Tasks", icon: "clipboard-list-outline", count: 4 },
    { id: "reminder", label: "Reminders", icon: "clock-outline", count: 3 },
  ], []);

  const handleTypeChange = useCallback(async (type: NotificationType) => {
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
    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsLoading(false);
  }, [fadeAnim, scrollX, filterTypes, SCREEN_WIDTH]);

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
              Stay updated with your activities
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
});
