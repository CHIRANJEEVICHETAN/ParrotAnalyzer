import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, StyleSheet, Platform, StatusBar as RNStatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingItem {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    action: () => void;
    showArrow?: boolean;
    isSwitch?: boolean;
    switchValue?: boolean;
}

interface SettingSection {
    title: string;
    items: SettingItem[];
}

export default function ManagementSettings() {
    const { theme, toggleTheme } = ThemeContext.useTheme();
    const { logout } = AuthContext.useAuth();
    const router = useRouter();
    const isDark = theme === 'dark';

    React.useEffect(() => {
        if (Platform.OS === 'ios') {
            RNStatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
        } else {
            RNStatusBar.setBackgroundColor(isDark ? '#111827' : '#F9FAFB');
            RNStatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
        }
    }, [isDark]);

    // Handle theme toggle with AsyncStorage persistence
    const handleThemeToggle = async () => {
        // Toggle theme immediately first
        toggleTheme();
        
        // Then save the new theme preference in the background
        try {
            const newTheme = theme === 'dark' ? 'light' : 'dark';
            await AsyncStorage.setItem('theme', newTheme);
        } catch (error) {
            console.error('Error saving theme preference:', error);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await AsyncStorage.removeItem('userToken');
                        logout();
                        router.replace('/(auth)/signin');
                    }
                }
            ]
        );
    };

    const settingsSections: SettingSection[] = [
        {
            title: 'Account',
            items: [
                {
                    icon: 'person-outline',
                    label: 'Profile Settings',
                    action: () => router.push('/(dashboard)/management/settings/profile'),
                    showArrow: true
                },
                {
                    icon: 'shield-outline',
                    label: 'Privacy & Security',
                    action: () => router.push('/(dashboard)/management/settings/privacy'),
                    showArrow: true
                }
            ]
        },
        {
            title: 'Notifications',
            items: [
                {
                    icon: 'notifications-outline',
                    label: 'Notifications',
                    action: () => router.push('/(dashboard)/management/settings/notifications'),
                    showArrow: true
                }
            ]
        },
        {
            title: 'Management Tools',
            items: [
                {
                    icon: 'bar-chart-outline',
                    label: 'Report Settings',
                    action: () => router.push('/(dashboard)/management/settings/reports'),
                    showArrow: true
                },
                {
                    icon: 'people-outline',
                    label: 'Team Management',
                    action: () => router.push('/(dashboard)/management/settings/team'),
                    showArrow: true
                }
            ]
        },
        {
            title: 'Support',
            items: [
                {
                    icon: 'help-circle-outline',
                    label: 'Help & Support',
                    action: () => router.push('/(dashboard)/management/settings/help'),
                    showArrow: true
                },
                {
                    icon: 'information-circle-outline',
                    label: 'About',
                    action: () => router.push('/(dashboard)/management/settings/about'),
                    showArrow: true
                }
            ]
        },
        {
            title: 'Appearance',
            items: [
                {
                    icon: isDark ? 'moon' : 'sunny',
                    label: 'Dark Mode',
                    isSwitch: true,
                    switchValue: isDark,
                    action: () => {
                        // Call handleThemeToggle directly without any additional wrapping
                        handleThemeToggle();
                    }
                }
            ]
        }
    ];

    return (
      <View
        className={`flex-1 ${isDark ? "bg-gray-900" : "bg-[#F9FAFB]"}`}
        style={styles.container}
      >
        <RNStatusBar
          backgroundColor={isDark ? "#111827" : "#F9FAFB"}
          barStyle={isDark ? "light-content" : "dark-content"}
          translucent
        />

        <View
          className={isDark ? "bg-gray-900" : "bg-[#F9FAFB]"}
          style={styles.header}
        >
          <View className="flex-row items-center px-5 pt-4 pb-5">
            <TouchableOpacity
              onPress={() => router.back()}
              className={`w-11 h-11 rounded-full items-center justify-center shadow-sm ${
                isDark ? "bg-gray-800" : "bg-white"
              }`}
            >
              <Ionicons
                name="arrow-back"
                size={26}
                color={isDark ? "#FFFFFF" : "#000000"}
                style={{ marginLeft: -1 }}
              />
            </TouchableOpacity>
            <Text
              className={`text-[26px] font-bold ml-4 ${
                isDark ? "text-white" : "text-[#111827]"
              }`}
            >
              Settings
            </Text>
          </View>
        </View>

        <ScrollView
          className={isDark ? "bg-gray-900" : "bg-[#F9FAFB]"}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
          style={styles.scrollView}
        >
          {settingsSections.map((section, sectionIndex) => (
            <View key={section.title} className="mb-7">
              <Text
                className={`px-5 py-2.5 text-[13px] font-semibold uppercase tracking-wide ${
                  isDark ? "text-gray-400" : "text-[#6B7280]"
                }`}
              >
                {section.title}
              </Text>
              <View
                className={`mx-5 rounded-2xl border ${
                  isDark
                    ? "bg-gray-800 border-gray-700"
                    : "bg-white border-[#F3F4F6]"
                }`}
              >
                {section.items.map((item, index) => (
                  <TouchableOpacity
                    key={item.label}
                    onPress={item.isSwitch ? undefined : item.action}
                    className={`flex-row items-center justify-between py-4 px-5 ${
                      index !== section.items.length - 1
                        ? isDark
                          ? "border-b border-gray-700"
                          : "border-b border-[#F3F4F6]"
                        : ""
                    }`}
                  >
                    <View className="flex-row items-center flex-1">
                      <View
                        className={`w-[42px] h-[42px] rounded-full items-center justify-center ${
                          isDark ? "bg-gray-700" : "bg-[#F9FAFB]"
                        }`}
                      >
                        <Ionicons
                          name={item.icon}
                          size={24}
                          color={isDark ? "#FFFFFF" : "#000000"}
                          style={{ opacity: 0.9 }}
                        />
                      </View>
                      <Text
                        className={`ml-4 text-[16px] font-semibold ${
                          isDark ? "text-white" : "text-[#111827]"
                        }`}
                      >
                        {item.label}
                      </Text>
                    </View>
                    {item.isSwitch ? (
                      <Switch
                        value={item.switchValue}
                        onValueChange={item.action}
                        trackColor={{
                          false: isDark ? "#4B5563" : "#E5E7EB",
                          true: "#3B82F6",
                        }}
                        thumbColor="#FFFFFF"
                        ios_backgroundColor={isDark ? "#4B5563" : "#E5E7EB"}
                        style={{ transform: [{ scale: 0.85 }] }}
                      />
                    ) : (
                      item.showArrow && (
                        <Ionicons
                          name="chevron-forward"
                          size={22}
                          color={isDark ? "#9CA3AF" : "#9CA3AF"}
                        />
                      )
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <View className="h-6" />

          <TouchableOpacity
            onPress={handleLogout}
            className="mx-5 mb-5 bg-red-600 rounded-2xl"
          >
            <Text className="text-white font-bold text-[17px] text-center py-4">
              Logout
            </Text>
          </TouchableOpacity>

          <View className="mb-10 items-center">
            <Text
              className={`text-[13px] font-medium ${
                isDark ? "text-gray-500" : "text-gray-400"
              }`}
            >
              Version {process.env.EXPO_PUBLIC_APP_VERSION}
            </Text>
          </View>
        </ScrollView>
      </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? 50 : RNStatusBar.currentHeight || 0,
    },
    header: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    scrollView: {
        flex: 1,
    }
});
