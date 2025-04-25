import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ThemeContext from "../../../../context/ThemeContext";
import AuthContext from "../../../../context/AuthContext";
import axios from "axios";

interface LeaveBalance {
  id: number;
  leave_type_id?: number;
  name: string;
  leave_type_name?: string;
  total_days: number;
  used_days: number;
  pending_days: number;
  available_days?: number;
  carry_forward_days?: number;
  max_days?: number;
  requires_documentation?: boolean;
  is_paid: boolean;
  year?: number;
}

export default function LeaveBalance() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const isDark = theme === "dark";

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    fetchBalances();
  }, [selectedYear]);

  const fetchBalances = async () => {
    try {
      setError(null);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/my-balances?year=${selectedYear}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      // Map the response to include all necessary properties
      const mappedBalances = response.data.map((balance: any) => ({
        ...balance,
        available_days: balance.available_days ?? 
          calculateAvailableDays(
            balance.total_days || 0,
            balance.used_days || 0,
            balance.pending_days || 0,
            balance.carry_forward_days || 0
          )
      }));
      
      setBalances(mappedBalances);
    } catch (error) {
      console.error("Error fetching leave balances:", error);
      setError("Failed to fetch leave balances");
    } finally {
      setLoading(false);
    }
  };

  const initializeBalances = async () => {
    try {
      setInitializing(true);
      setError(null);

      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-leave/initialize-my-balances`,
        { year: selectedYear },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.status === "created") {
        setBalances(response.data.balances);
        Alert.alert(
          "Success",
          "Your leave balances have been initialized successfully.",
          [{ text: "OK" }]
        );
      } else if (response.data.status === "exists") {
        // Balances already exist, fetch them again
        await fetchBalances();
        Alert.alert(
          "Information",
          "Your leave balances were already initialized for this year.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Error initializing leave balances:", error);
      setError("Failed to initialize leave balances");
    } finally {
      setInitializing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBalances();
    setRefreshing(false);
  };

  const calculateAvailableDays = (totalDays: number, usedDays: number, pendingDays: number, carryForwardDays = 0) => {
    return Math.max(0, totalDays + carryForwardDays - usedDays - pendingDays);
  };

  // Helper function to get total eligible days (total + carry forward)
  const getTotalEligibleDays = (balance: LeaveBalance) => {
    return (balance.total_days || 0) + (balance.carry_forward_days || 0);
  };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={isDark ? "#EF4444" : "#DC2626"}
        />
        <Text
          className={`text-lg text-center mt-4 mb-2 ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          {error}
        </Text>
        <TouchableOpacity
          onPress={fetchBalances}
          className="bg-blue-500 px-6 py-3 rounded-lg flex-row items-center mt-4"
        >
          <Ionicons
            name="refresh"
            size={20}
            color="white"
            style={{ marginRight: 8 }}
          />
          <Text className="text-white font-medium">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Header with Year Selection */}
      <View className="flex-row justify-between items-center mb-6">
        <Text
          className={`text-xl font-semibold ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          Leave Balances
        </Text>
        <View className="flex-row items-center space-x-4">
          <TouchableOpacity
            onPress={() => setSelectedYear((prev) => prev - 1)}
            className={`p-2 rounded-lg ${
              isDark ? "bg-gray-800" : "bg-gray-100"
            }`}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={isDark ? "#D1D5DB" : "#4B5563"}
            />
          </TouchableOpacity>
          <Text
            className={`text-lg font-medium ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            {selectedYear}
          </Text>
          <TouchableOpacity
            onPress={() => setSelectedYear((prev) => prev + 1)}
            disabled={selectedYear >= new Date().getFullYear()}
            className={`p-2 rounded-lg ${
              selectedYear >= new Date().getFullYear() ? "opacity-50" : ""
            } ${isDark ? "bg-gray-800" : "bg-gray-100"}`}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDark ? "#D1D5DB" : "#4B5563"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Balance Cards */}
      {balances.length === 0 ? (
        <View
          className={`p-6 rounded-lg ${isDark ? "bg-gray-800" : "bg-white"}`}
        >
          <Text
            className={`text-center mb-4 ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            No leave balances found for {selectedYear}
          </Text>
          <TouchableOpacity
            onPress={initializeBalances}
            disabled={initializing}
            className={`bg-blue-500 p-4 rounded-lg flex-row justify-center items-center ${
              initializing ? "opacity-70" : ""
            }`}
          >
            {initializing ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
            ) : (
              <Ionicons
                name="add-circle-outline"
                size={20}
                color="white"
                style={{ marginRight: 8 }}
              />
            )}
            <Text className="text-white font-medium">
              {initializing
                ? "Initializing Balances..."
                : "Initialize Leave Balances"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          className="space-y-4 mb-6"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#3B82F6"]}
              tintColor={isDark ? "#FFFFFF" : "#3B82F6"}
            />
          }
        >
          {balances.map((balance, index) => {
            const availableDays = balance.available_days !== undefined
              ? balance.available_days
              : calculateAvailableDays(
                  balance.total_days || 0,
                  balance.used_days || 0,
                  balance.pending_days || 0,
                  balance.carry_forward_days || 0
                );
            
            const leaveTypeName = balance.leave_type_name || balance.name;
            const hasCarryForward = balance.carry_forward_days && balance.carry_forward_days > 0;
            const totalEligibleDays = getTotalEligibleDays(balance);
            const usedPercentage = totalEligibleDays > 0 
              ? Math.min(100, ((balance.used_days + balance.pending_days) / totalEligibleDays) * 100)
              : 0;
            
            return (
              <View
                key={
                  balance.id
                    ? `id-${balance.id}`
                    : `temp-${balance.leave_type_id}-${index}`
                }
                className={`p-4 rounded-lg ${
                  isDark ? "bg-gray-800" : "bg-white"
                } mb-4`}
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View>
                    <Text
                      className={`text-lg font-semibold ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {leaveTypeName}
                    </Text>
                    <View className="flex-row flex-wrap">
                      <Text
                        className={`text-sm ${
                          isDark ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        {balance.is_paid ? "Paid Leave" : "Unpaid Leave"}
                      </Text>
                      {balance.max_days !== undefined && (
                        <Text
                          className={`text-sm ml-2 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          • Max: {balance.max_days} days
                        </Text>
                      )}
                      {balance.requires_documentation && (
                        <Text
                          className={`text-sm ml-2 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          • Requires Documentation
                        </Text>
                      )}
                    </View>
                  </View>
                  <View className={`px-2 py-1 rounded-full ${
                    availableDays > 0 ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    <Text className={
                      availableDays > 0 ? 'text-green-800' : 'text-red-800'
                    }>
                      {availableDays} days left
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View className="mt-2 mb-4">
                  <View className={`h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <View
                      className="h-2 rounded-full bg-green-500"
                      style={{
                        width: `${usedPercentage}%`,
                      }}
                    />
                  </View>
                  <View className="flex-row justify-between mt-1">
                    <Text className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      0%
                    </Text>
                    <Text className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      {usedPercentage.toFixed(0)}% used
                    </Text>
                    <Text className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      100%
                    </Text>
                  </View>
                </View>

                {/* Days Details */}
                <View className="flex-row justify-between">
                  <View>
                    <Text className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>Total</Text>
                    <Text
                      className={`font-medium ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {totalEligibleDays} days
                      {/* {hasCarryForward && (
                        <Text className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                          {` (${balance.total_days}+${balance.carry_forward_days})`}
                        </Text>
                      )} */}
                    </Text>
                  </View>
                  <View>
                    <Text className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>Used</Text>
                    <Text
                      className={`font-medium ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {balance.used_days || 0} days
                    </Text>
                  </View>
                  <View>
                    <Text className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>Pending</Text>
                    <Text
                      className={`font-medium ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {balance.pending_days || 0} days
                    </Text>
                  </View>
                  <View>
                    <Text className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>Available</Text>
                    <Text
                      className={`font-medium ${
                        availableDays > 0
                          ? isDark ? 'text-green-400' : 'text-green-600'
                          : isDark ? 'text-red-400' : 'text-red-600'
                      }`}
                    >
                      {availableDays} days
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
} 