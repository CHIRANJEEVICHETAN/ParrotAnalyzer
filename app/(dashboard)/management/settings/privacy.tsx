import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar as RNStatusBar, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PrivacySettings = () => {
  const router = useRouter();
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === 'dark';

  // State management
  const [isProfileVisible, setIsProfileVisible] = useState(true);
  const [notifications, setNotifications] = useState({
    loginActivity: true,
    systemUpdates: true
  });

  // Load saved settings on component mount
  useEffect(() => {
    loadSavedSettings();
  }, []);

  const loadSavedSettings = async () => {
    try {
      const savedProfile = await AsyncStorage.getItem('profileVisibility');
      const savedNotifications = await AsyncStorage.getItem('notifications');
      
      if (savedProfile) {
        setIsProfileVisible(JSON.parse(savedProfile));
      }
      if (savedNotifications) {
        setNotifications(JSON.parse(savedNotifications));
      }
    } catch (error) {
      console.log('Error loading settings:', error);
    }
  };

  // Update handlers to persist changes
  const handleProfileVisibilityChange = async (value: boolean) => {
    setIsProfileVisible(value);
    try {
      await AsyncStorage.setItem('profileVisibility', JSON.stringify(value));
    } catch (error) {
      console.log('Error saving profile visibility:', error);
    }
  };

  const handleNotificationChange = async (key: string, value: boolean) => {
    const newNotifications = { ...notifications, [key]: value };
    setNotifications(newNotifications);
    try {
      await AsyncStorage.setItem('notifications', JSON.stringify(newNotifications));
    } catch (error) {
      console.log('Error saving notifications:', error);
    }
  };

  // Handlers
  const handleLogoutAllDevices = () => {
    Alert.alert(
      "Logout from All Devices",
      "You will need to log in again to access your account.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Logout",
          onPress: () => {
            Alert.alert("Success", "Logged out from all devices successfully");
          },
          style: "destructive"
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure? This action is irreversible, and all your data will be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: () => {
            Alert.alert("Account Deleted", "Your account has been successfully deleted");
          },
          style: "destructive"
        }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#111827' : '#F3F4F6' }}>
      {/* Header with back button */}
      <LinearGradient
        colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        style={[styles.header, { 
          paddingTop: Platform.OS === 'ios' ? RNStatusBar.currentHeight || 44 : RNStatusBar.currentHeight || 0 
        }]}
      >
        <View className="px-6">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-4 p-2 rounded-full"
              style={[styles.backButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}
            >
              <MaterialIcons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
            <View>
              <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Privacy & Security
              </Text>
              <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                Manage your privacy and security settings
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Profile Visibility */}
        <View style={[styles.section, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="visibility" size={24} color="#3B82F6" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              Profile Visibility
            </Text>
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                Make my profile visible to others
              </Text>
              <Text style={[styles.settingDescription, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                Toggle to allow or restrict your profile visibility in the app
              </Text>
            </View>
            <Switch
              value={isProfileVisible}
              onValueChange={handleProfileVisibilityChange}
              trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Privacy & Security Info */}
        <View style={[styles.section, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="security" size={24} color="#3B82F6" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              Privacy & Security
            </Text>
          </View>
          <View style={[styles.infoBox, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
            <Text style={[styles.infoTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              Your Privacy & Security
            </Text>
            <View style={styles.infoList}>
              {[
                'Your data is protected and encrypted',
                'We do not share your information without consent',
                'Review your activity logs regularly for security'
              ].map((text, index) => (
                <View key={index} style={styles.infoItem}>
                  <MaterialIcons name="check-circle" size={20} color="#3B82F6" />
                  <Text style={[styles.infoText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
                    {text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Email Notifications */}
        <View style={[styles.section, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="notifications" size={24} color="#3B82F6" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              Email Notifications
            </Text>
          </View>
          {Object.entries(notifications).map(([key, value]) => (
            <View key={key} style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                  {key === 'loginActivity' ? 'Login activity notifications' : 'System updates notifications'}
                </Text>
              </View>
              <Switch
                value={value}
                onValueChange={(newValue) => handleNotificationChange(key, newValue)}
                trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
        </View>

        {/* Account Management */}
        <View style={[styles.section, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="manage-accounts" size={24} color="#3B82F6" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              Account Management
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.button, styles.logoutButton]} 
            onPress={handleLogoutAllDevices}
          >
            <MaterialIcons name="logout" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Logout from All Devices</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.deleteButton]}
            onPress={handleDeleteAccount}
          >
            <MaterialIcons name="delete" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Delete My Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    paddingBottom: 14,
  },
  backButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  infoBox: {
    borderRadius: 8,
    padding: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoList: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  logoutButton: {
    backgroundColor: '#3B82F6',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default PrivacySettings;