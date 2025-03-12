import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Platform, StatusBar as RNStatusBar, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../context/ThemeContext';
import axios from 'axios';
import Modal from 'react-native-modal';
import { StatusBar } from 'expo-status-bar';
import { superAdminNavItems } from "./utils/navigationItems";
import BottomNav from "../../components/BottomNav";

interface Company {
  id: number;
  name: string;
  email: string;
  status: "active" | "disabled";
  management: {
    name: string;
    email: string;
    phone: string;
  } | null;
  user_count: number;
  created_at: string;
  user_limit: number;
  pending_users: number;
}

export default function CompanyManagement() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "disabled"
  >("all");
  const [error, setError] = useState<string | null>(null);
  const [isEditLimitModalVisible, setIsEditLimitModalVisible] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [newUserLimit, setNewUserLimit] = useState("");
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (Platform.OS === "android") {
      RNStatusBar.setBackgroundColor(theme === "dark" ? "#1F2937" : "#FFFFFF");
      RNStatusBar.setBarStyle(
        theme === "dark" ? "light-content" : "dark-content"
      );
    }
  }, [theme]);

  const fetchCompanies = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/companies`
      );
      setCompanies(response.data);
      if (response.data.length === 0) {
        setError("No companies found. Add your first company!");
      }
    } catch (error: any) {
      setError(
        error.response?.data?.message ||
          "Failed to fetch companies. Please try again."
      );
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (companyId: number) => {
    try {
      setUpdatingStatus(companyId);
      const response = await axios.patch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/companies/${companyId}/toggle-status`
      );

      setCompanies(
        companies.map((company) =>
          company.id === companyId
            ? { ...company, status: response.data.status }
            : company
        )
      );

      Alert.alert("Success", response.data.message, [{ text: "OK" }]);
    } catch (error: any) {
      console.error("Error updating company status:", error);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to update company status",
        [{ text: "OK" }]
      );
    } finally {
      setUpdatingStatus(null);
    }
  };

  // const handleDeleteCompany = async (companyId: number) => {
  //   Alert.alert(
  //     'Delete Company',
  //     'Are you sure? This will permanently delete the company and all associated users.',
  //     [
  //       { text: 'Cancel', style: 'cancel' },
  //       {
  //         text: 'Delete',
  //         style: 'destructive',
  //         onPress: async () => {
  //           try {
  //             await axios.delete(`${process.env.EXPO_PUBLIC_API_URL}/api/companies/${companyId}`);
  //             fetchCompanies();
  //           } catch (error) {
  //             Alert.alert('Error', 'Failed to delete company');
  //           }
  //         }
  //       }
  //     ]
  //   );
  // };

  const handleUpdateUserLimit = async () => {
    if (!selectedCompany || !newUserLimit) return;

    const limit = parseInt(newUserLimit);
    if (isNaN(limit) || limit < 1) {
      Alert.alert("Error", "Please enter a valid number");
      return;
    }

    try {
      setIsUpdatingLimit(true);
      await axios.patch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/companies/${selectedCompany.id}/user-limit`,
        {
          userLimit: limit,
        }
      );

      setCompanies(
        companies.map((company) =>
          company.id === selectedCompany.id
            ? { ...company, user_limit: limit }
            : company
        )
      );

      setIsEditLimitModalVisible(false);
      Alert.alert("Success", "User limit updated successfully");
    } catch (error) {
      console.error("Error updating user limit:", error);
      Alert.alert("Error", "Failed to update user limit");
    } finally {
      setIsUpdatingLimit(false);
    }
  };

  const filteredCompanies = companies.filter((company) => {
    const matchesSearch =
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || company.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchCompanies();
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <View
      className="flex-1"
      style={{
        backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF",
      }}
    >
      <StatusBar style={theme === "dark" ? "light" : "dark"} />

      <View
        style={{
          height: Platform.OS === "ios" ? 44 : RNStatusBar.currentHeight || 0,
          backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF",
        }}
      />

      <LinearGradient
        colors={
          theme === "dark" ? ["#1F2937", "#111827"] : ["#FFFFFF", "#F3F4F6"]
        }
        className="pb-4"
        style={[styles.header, { paddingTop: 10 }]}
      >
        <View className="flex-row items-center justify-between px-6">
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
          <Text
            className={`text-2xl font-bold ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            Companies
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(dashboard)/super-admin/add-company")}
            className="p-2 rounded-full flex-row items-center"
            accessibilityLabel="Add new company"
            style={[
              styles.addButton,
              { backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6" },
            ]}
          >
            <Ionicons
              name="add"
              size={24}
              color={theme === "dark" ? "#FFFFFF" : "#000000"}
            />
            <Text
              className={`ml-1 text-sm ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            >
              Add
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View
        className={`flex-1 ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}
      >
        {/* Search and Filter */}
        <View className="p-4">
          {/* Search Input with Icon */}
          <View className="relative mb-4">
            <View className="absolute left-4 top-[14px] z-10">
              <Ionicons
                name="search-outline"
                size={20}
                color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
              />
            </View>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search companies..."
              className={`pl-12 p-4 rounded-lg ${
                theme === "dark"
                  ? "bg-gray-800 text-white"
                  : "bg-white text-gray-900"
              }`}
              style={styles.searchInput}
              placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
            />
          </View>

          <View className="flex-row mb-4">
            {["all", "active", "disabled"].map((status) => (
              <TouchableOpacity
                key={status}
                onPress={() => setStatusFilter(status as any)}
                className={`mr-2 px-4 py-2 rounded-full ${
                  statusFilter === status
                    ? "bg-blue-500"
                    : theme === "dark"
                    ? "bg-gray-800"
                    : "bg-white"
                }`}
              >
                <Text
                  className={
                    statusFilter === status
                      ? "text-white"
                      : theme === "dark"
                      ? "text-gray-300"
                      : "text-gray-600"
                  }
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Companies List */}
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme === "dark" ? "#FFFFFF" : "#111827"]}
              tintColor={theme === "dark" ? "#FFFFFF" : "#111827"}
              progressBackgroundColor={theme === "dark" ? "#374151" : "#F3F4F6"}
            />
          }
        >
          {loading ? (
            <View className="flex-1 justify-center items-center p-4">
              <ActivityIndicator
                size="large"
                color={theme === "dark" ? "#FFFFFF" : "#000000"}
              />
              <Text
                className={`mt-4 ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                Loading companies...
              </Text>
            </View>
          ) : error ? (
            <View className="flex-1 justify-center items-center p-4">
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color={theme === "dark" ? "#FFFFFF" : "#000000"}
              />
              <Text
                className={`mt-4 text-center ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                {error}
              </Text>
              <TouchableOpacity
                onPress={fetchCompanies}
                className="mt-4 bg-blue-500 px-6 py-3 rounded-full"
              >
                <Text className="text-white font-semibold">Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredCompanies.map((company) => (
              <TouchableOpacity
                key={company.id}
                onPress={() =>
                  router.push(`/super-admin/company/${company.id}`)
                }
                className={`mx-4 mb-4 p-4 rounded-lg ${
                  theme === "dark" ? "bg-gray-800" : "bg-white"
                }`}
                style={styles.companyCard}
              >
                <View className="flex-row justify-between">
                  <View className="flex-1">
                    <Text
                      className={`text-lg font-semibold ${
                        theme === "dark" ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {company.name}
                    </Text>
                    <Text
                      className={
                        theme === "dark" ? "text-gray-400" : "text-gray-600"
                      }
                    >
                      {company.email}
                    </Text>
                    {company.management ? (
                      <View className="mt-2">
                        <Text
                          className={`font-medium ${
                            theme === "dark" ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          Management:
                        </Text>
                        <Text
                          className={
                            theme === "dark" ? "text-gray-400" : "text-gray-600"
                          }
                        >
                          {company.management.name}
                        </Text>
                        <Text
                          className={
                            theme === "dark" ? "text-gray-400" : "text-gray-600"
                          }
                        >
                          {company.management.email}
                        </Text>
                        <Text
                          className={
                            theme === "dark" ? "text-gray-400" : "text-gray-600"
                          }
                        >
                          {company.management.phone}
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-yellow-500 mt-2">
                        No management account assigned
                      </Text>
                    )}
                    <View className="mt-2 flex-row items-center">
                      <Ionicons
                        name="people-outline"
                        size={16}
                        color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
                      />
                      <Text
                        className={`ml-1 ${
                          theme === "dark" ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        {company.user_count}{" "}
                        {company.user_count === 1 ? "user" : "users"}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-start gap-3">
                    <TouchableOpacity
                      onPress={() => handleStatusToggle(company.id)}
                      disabled={updatingStatus === company.id}
                      className={`p-2 rounded-full ${
                        company.status === "active"
                          ? "bg-green-500"
                          : "bg-red-500"
                      } ${updatingStatus === company.id ? "opacity-50" : ""}`}
                      style={styles.actionButton}
                    >
                      {updatingStatus === company.id ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Ionicons
                          name={
                            company.status === "active" ? "checkmark" : "close"
                          }
                          size={20}
                          color="white"
                        />
                      )}
                    </TouchableOpacity>

                    {/* <TouchableOpacity
                      onPress={() => handleDeleteCompany(company.id)}
                      className="p-2 rounded-full bg-red-500"
                      style={styles.actionButton}
                    >
                      <Ionicons name="trash" size={20} color="white" />
                    </TouchableOpacity> */}
                  </View>
                </View>

                <View
                  className={`absolute top-2 right-2 px-2 py-1 rounded-full ${
                    company.status === "active" ? "bg-green-100" : "bg-red-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      company.status === "active"
                        ? "text-green-800"
                        : "text-red-800"
                    }`}
                  >
                    {company.status.charAt(0).toUpperCase() +
                      company.status.slice(1)}
                  </Text>
                </View>

                {company.pending_users > 0 && (
                  <TouchableOpacity
                    onPress={() =>
                      router.push(
                        `/super-admin/company/${company.id}/pending-users`
                      )
                    }
                    className="absolute top-2 right-20 px-2 py-1 bg-yellow-100 rounded-full"
                  >
                    <Text className="text-yellow-800 text-xs font-medium">
                      {company.pending_users} Pending
                    </Text>
                  </TouchableOpacity>
                )}

                <View className="flex-row items-center justify-between mb-2">
                  <Text
                    className={
                      theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }
                  >
                    Users: {company.user_count} / {company.user_limit || 50}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedCompany(company);
                      setNewUserLimit((company.user_limit || 50).toString());
                      setIsEditLimitModalVisible(true);
                    }}
                    className="p-2"
                  >
                    <Ionicons
                      name="pencil"
                      size={20}
                      color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      <Modal
        isVisible={isEditLimitModalVisible}
        onBackdropPress={() =>
          !isUpdatingLimit && setIsEditLimitModalVisible(false)
        }
        className="m-4"
      >
        <View
          className={`p-6 rounded-2xl ${
            theme === "dark" ? "bg-gray-800" : "bg-white"
          }`}
        >
          <Text
            className={`text-lg font-semibold mb-4 ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            Edit User Limit for {selectedCompany?.name}
          </Text>
          <TextInput
            value={newUserLimit}
            onChangeText={setNewUserLimit}
            keyboardType="numeric"
            editable={!isUpdatingLimit}
            className={`p-4 rounded-lg mb-4 ${
              theme === "dark"
                ? "bg-gray-700 text-white"
                : "bg-gray-50 text-gray-900"
            }`}
            style={styles.input}
            placeholder="Enter new user limit"
            placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
          />
          <View className="flex-row justify-end gap-2">
            <TouchableOpacity
              onPress={() => setIsEditLimitModalVisible(false)}
              disabled={isUpdatingLimit}
              className={`px-4 py-2 rounded-lg bg-gray-500 ${
                isUpdatingLimit ? "opacity-50" : ""
              }`}
            >
              <Text className="text-white">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleUpdateUserLimit}
              disabled={isUpdatingLimit}
              className={`px-4 py-2 rounded-lg bg-blue-500 ${
                isUpdatingLimit ? "opacity-50" : ""
              }`}
            >
              {isUpdatingLimit ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white">Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BottomNav items={superAdminNavItems} />
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
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  addButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  companyCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  actionButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  input: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  searchInput: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  }
});
