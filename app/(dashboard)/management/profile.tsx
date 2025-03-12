import React, { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar as RNStatusBar, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../context/ThemeContext';
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import BottomNav from "../../components/BottomNav";
import { managementNavItems } from "./utils/navigationItems";

// Add a constant for cache duration (1 hour in milliseconds)
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export default function ManagementProfile() {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    company_name: "",
    profile_image: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isDark = theme === "dark";

  useEffect(() => {
    if (Platform.OS === "ios") {
      RNStatusBar.setBarStyle(isDark ? "light-content" : "dark-content");
    } else {
      RNStatusBar.setBackgroundColor(isDark ? "#1F2937" : "#FFFFFF");
      RNStatusBar.setBarStyle(isDark ? "light-content" : "dark-content");
    }
  }, [isDark]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        // Try to load from cache first
        const cachedData = await AsyncStorage.getItem("management_profile");
        const cacheTimestamp = await AsyncStorage.getItem(
          "management_profile_timestamp"
        );

        if (cachedData && cacheTimestamp) {
          const parsedCache = JSON.parse(cachedData);
          const timestamp = parseInt(cacheTimestamp);
          const now = Date.now();

          // If cache is still valid (less than 1 hour old)
          if (now - timestamp < CACHE_DURATION) {
            setProfileData(parsedCache);
            setIsLoading(false);
            return; // Don't fetch fresh data if cache is valid
          }
        }

        // If we get here, either there's no cache or it's expired
        await fetchProfileData();
      } catch (error) {
        console.error("Error loading profile:", error);
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  const fetchProfileData = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem("auth_token");

      if (!token) {
        console.log("No token found in storage");
        return;
      }

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/management/profile`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data) {
        const profileData = {
          name: response.data.name || "",
          email: response.data.email || "",
          phone: response.data.phone || "",
          role: response.data.role || "",
          company_name: response.data.company_name || "",
          profile_image: response.data.profile_image || "",
        };

        // If profile image is not included in the main response, fetch it separately
        if (!response.data.profile_image) {
          const imageResponse = await axios.get(
            `${process.env.EXPO_PUBLIC_API_URL}/api/users/profile-image/${response.data.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (imageResponse.data.image) {
            profileData.profile_image = imageResponse.data.image;
          }
        }

        // Update state and cache the data with timestamp
        setProfileData(profileData);
        await Promise.all([
          AsyncStorage.setItem(
            "management_profile",
            JSON.stringify(profileData)
          ),
          AsyncStorage.setItem(
            "management_profile_timestamp",
            Date.now().toString()
          ),
        ]);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      if (axios.isAxiosError(error)) {
        console.log("Error response:", error.response?.data);
        if (error.response?.status === 401) {
          await AsyncStorage.removeItem("auth_token");
          await AsyncStorage.removeItem("management_profile");
          await AsyncStorage.removeItem("management_profile_timestamp");
          router.replace("/(auth)/signin");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Add a function to force refresh (you can call this from a pull-to-refresh or button)
  const forceRefresh = async () => {
    await fetchProfileData();
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchProfileData();
    } catch (error) {
      console.error("Error refreshing profile:", error);
    } finally {
      setRefreshing(false);
    }
  }, []);

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
        <View className="flex-row items-center px-6 relative">
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-2 rounded-full absolute left-4"
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
          <View className="flex-1 items-center">
            <Text
              className={`text-2xl font-bold ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            >
              Profile
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        className={`flex-1 ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#3B82F6"]}
            tintColor={theme === "dark" ? "#FFFFFF" : "#3B82F6"}
            progressBackgroundColor={theme === "dark" ? "#374151" : "#F3F4F6"}
          />
        }
      >
        {/* Enhanced Profile Header */}
        <View
          className={`p-8 ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}
          style={styles.profileHeader}
        >
          {isLoading ? (
            <View className="h-[300px] items-center justify-center">
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : (
            <View className="items-center">
              <View style={styles.imageContainer}>
                {profileData.profile_image ? (
                  <Image
                    source={{
                      uri: `data:image/jpeg;base64,${profileData.profile_image}`,
                    }}
                    style={styles.profileImage}
                  />
                ) : (
                  <View style={[styles.profileImage, styles.defaultAvatar]}>
                    <Text style={styles.avatarText}>
                      {profileData.name
                        ? profileData.name
                            .split(" ")
                            .map((name) => name[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()
                        : "U"}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                className={`text-2xl font-bold mt-4 ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                {profileData.name}
              </Text>
              <Text
                className={`text-lg ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {profileData.role}
              </Text>
              <Text
                className={`mt-2 ${
                  theme === "dark" ? "text-blue-400" : "text-blue-600"
                }`}
              >
                {profileData.company_name}
              </Text>
            </View>
          )}
        </View>

        {/* Enhanced Profile Details */}
        <View className="p-6">
          {isLoading ? (
            <View className="h-[200px] items-center justify-center">
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : (
            <View
              className={`rounded-2xl ${
                theme === "dark" ? "bg-gray-800" : "bg-white"
              }`}
              style={styles.detailsCard}
            >
              {[
                { label: "Email", value: profileData.email, icon: "mail" },
                { label: "Phone", value: profileData.phone, icon: "call" },
                {
                  label: "Company",
                  value: profileData.company_name,
                  icon: "business",
                },
              ].map((detail, index) => (
                <View
                  key={detail.label}
                  className={`flex-row items-center p-5 ${
                    index !== 2 ? "border-b" : ""
                  } ${
                    theme === "dark" ? "border-gray-700" : "border-gray-200"
                  }`}
                >
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name={detail.icon as any}
                      size={24}
                      color="#3B82F6"
                    />
                  </View>
                  <View className="ml-4 flex-1">
                    <Text
                      className={`text-sm ${
                        theme === "dark" ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {detail.label}
                    </Text>
                    <Text
                      className={`text-base font-medium mt-1 ${
                        theme === "dark" ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {detail.value}
                    </Text>
                  </View>
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
    profileHeader: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    imageContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#F3F4F6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    profileImage: {
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 4,
        borderColor: '#FFFFFF',
    },
    detailsCard: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#EBF5FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    defaultAvatar: {
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: '#FFFFFF',
    },
    avatarText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
});
