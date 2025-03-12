import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, StatusBar, StatusBar as RNStatusBar, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../context/ThemeContext';
import LeaveApprovals from './components/LeaveApprovals';
// import LeaveBalanceTracker from '../leave-insights/components/LeaveBalanceTracker';
// import LeaveAnalytics from './components/LeaveAnalytics';
import LeavePolicies from './components/LeavePolicies';
import LeaveTypes from './components/LeaveTypes';
import LeaveBalances from './components/LeaveBalances';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { managementNavItems } from "../utils/navigationItems";
import BottomNav from "../../../components/BottomNav";

type TabType =
  | "types"
  | "policies"
  | "balances"
  | "balances-tracker"
  | "analytics"
  | "approvals";

interface TabItem {
  id: TabType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export default function LeaveManagement() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const isDark = theme === "dark";
  const [activeTab, setActiveTab] = useState<TabType>("types");

  const tabs: TabItem[] = [
    {
      id: "types",
      label: "Types",
      icon: "layers-outline",
      activeIcon: "layers",
      color: "#3B82F6",
    },
    {
      id: "policies",
      label: "Policies",
      icon: "shield-outline",
      activeIcon: "shield",
      color: "#10B981",
    },
    {
      id: "balances",
      label: "Balances",
      icon: "wallet-outline",
      activeIcon: "wallet",
      color: "#F59E0B",
    },
    // {
    //   id: 'analytics',
    //   label: 'Analytics',
    //   icon: 'bar-chart-outline',
    //   activeIcon: 'bar-chart',
    //   color: '#8B5CF6'
    // },
    {
      id: "approvals",
      label: "Approvals",
      icon: "checkmark-circle-outline",
      activeIcon: "checkmark-circle",
      color: "#6366F1",
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "types":
        return <LeaveTypes />;
      case "policies":
        return <LeavePolicies />;
      case "balances":
        return <LeaveBalances />;
      // case 'analytics':
      // return <LeaveAnalytics />;
      case "approvals":
        return <LeaveApprovals />;
      default:
        return null;
    }
  };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: isDark ? "#111827" : "#F9FAFB" }}
    >
      <StatusBar
        backgroundColor={isDark ? "#1F2937" : "#FFFFFF"}
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent
      />

      {/* Header with proper status bar spacing */}
      <LinearGradient
        colors={isDark ? ["#1F2937", "#111827"] : ["#FFFFFF", "#F3F4F6"]}
        style={[
          styles.header,
          {
            paddingTop:
              Platform.OS === "ios"
                ? RNStatusBar.currentHeight || 44
                : RNStatusBar.currentHeight || 0,
          },
        ]}
      >
        <View className="flex-row items-center justify-between px-6 py-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className={`p-2 rounded-full ${
              isDark ? "bg-gray-800/80" : "bg-gray-100"
            }`}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? "#E5E7EB" : "#374151"}
            />
          </TouchableOpacity>
          <Text
            className={`text-xl font-semibold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Leave Management
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Enhanced Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-4 pb-4"
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              className={`flex-row items-center px-4 py-3 mr-3 rounded-xl ${
                activeTab === tab.id
                  ? isDark
                    ? "bg-gray-800"
                    : "bg-white"
                  : isDark
                  ? "bg-gray-800/50"
                  : "bg-gray-100"
              }`}
              style={[
                styles.tabButton,
                activeTab === tab.id && {
                  shadowColor: tab.color,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 3.84,
                  elevation: 5,
                },
              ]}
            >
              <Ionicons
                name={activeTab === tab.id ? tab.activeIcon : tab.icon}
                size={20}
                color={
                  activeTab === tab.id
                    ? tab.color
                    : isDark
                    ? "#9CA3AF"
                    : "#6B7280"
                }
                style={{ marginRight: 8 }}
              />
              <Text
                className={`font-medium ${
                  activeTab === tab.id
                    ? isDark
                      ? "text-white"
                      : "text-gray-900"
                    : isDark
                    ? "text-gray-400"
                    : "text-gray-600"
                }`}
                style={activeTab === tab.id ? { color: tab.color } : {}}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        className={`flex-1 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {renderContent()}
      </ScrollView>
      <BottomNav items={managementNavItems} />
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
  backButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  tabButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
}); 