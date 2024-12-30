import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, StatusBar as RNStatusBar, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../../context/ThemeContext';

interface Session {
  id: string;
  device: string;
  location: string;
  lastActivity: string;
}

const PrivacySettings = () => {
  const router = useRouter();
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === 'dark';
  
  // State management
  const [dataVisibility, setDataVisibility] = useState({
    groupAdmins: true,
    employees: false,
    reports: true,
    personalData: false
  });
  const [dataSharing, setDataSharing] = useState({
    thirdParty: false,
    anonymized: true
  });
  const [isAccountLocked, setIsAccountLocked] = useState(false);
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const [activeSessions] = useState<Session[]>([
    {
      id: '1',
      device: 'Windows PC',
      location: 'New York, US',
      lastActivity: '2 minutes ago'
    },
    {
      id: '2',
      device: 'iPhone 13',
      location: 'San Francisco, US',
      lastActivity: '1 hour ago'
    }
  ]);

  // Load saved settings on component mount
  useEffect(() => {
    loadSavedSettings();
  }, []);

  const loadSavedSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('privacySettings');
      if (savedSettings) {
        setDataVisibility(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.log('Error loading settings:', error);
    }
  };

  // Update the visibility handler to persist changes
  const handleVisibilityChange = async (key: string) => {
    const newSettings = {
      ...dataVisibility,
      [key]: !dataVisibility[key as keyof typeof dataVisibility]
    };
    setDataVisibility(newSettings);
    try {
      await AsyncStorage.setItem('privacySettings', JSON.stringify(newSettings));
    } catch (error) {
      console.log('Error saving settings:', error);
    }
  };

  // Handlers
  const handleLockAccount = () => {
    setIsAccountLocked(!isAccountLocked);
  };

  const handleExportData = () => {
    // Implement data export logic
    console.log('Exporting data...');
  };

  const handleLogoutAllDevices = () => {
    Alert.alert(
      "Logout Devices",
      "Are you sure you want to log out from all devices?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          onPress: () => {
            // Implement logout logic here
            Alert.alert(
              "Success",
              "Successfully logged out from all devices",
              [{ text: "OK" }]
            );
          },
          style: "destructive"
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: async () => {
            try {
              // Implement delete logic here
              // For example: await deleteAccount();
              
              Alert.alert(
                "Success",
                "Your account has been successfully deleted",
                [
                  { 
                    text: "OK",
                    onPress: async () => {
                      try {
                        // Clear any stored data
                        await AsyncStorage.clear();
                        // Navigate to auth screen or handle logout
                        // You might want to trigger your auth context logout here
                      } catch (error) {
                        console.log('Error during logout:', error);
                      }
                    }
                  }
                ]
              );
            } catch (error) {
              Alert.alert(
                "Error",
                "Failed to delete account. Please try again."
              );
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  return (
    <ScrollView 
      style={[styles.mainContainer, { backgroundColor: isDark ? '#111827' : '#F3F4F6' }]}
      showsVerticalScrollIndicator={false}
      bounces={true}
      overScrollMode="always"
      stickyHeaderIndices={[]}
    >
      <LinearGradient
        colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
        style={[styles.header, { 
          paddingTop: Platform.OS === 'ios' ? RNStatusBar.currentHeight || 44 : RNStatusBar.currentHeight || 0 
        }]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[
                styles.backButton,
                { backgroundColor: isDark ? '#374151' : '#F3F4F6' }
              ]}
            >
              <MaterialIcons 
                name="arrow-back" 
                size={24} 
                color={isDark ? '#FFFFFF' : '#000000'} 
              />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[
                styles.headerTitle,
                { color: isDark ? '#FFFFFF' : '#111827' }
              ]}>
                Privacy & Security
              </Text>
              <Text style={[
                styles.headerSubtitle,
                { color: isDark ? '#9CA3AF' : '#6B7280' }
              ]}>
                Manage your privacy and security settings
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Data Visibility Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Visibility Controls</Text>
          <View style={styles.cardContainer}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.iconContainer}>
                  <MaterialIcons name="visibility" size={24} color="#2563eb" />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Group Admins Access</Text>
                  <Text style={styles.settingDescription}>
                    Control what Group Admins can see
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.toggle,
                  { backgroundColor: dataVisibility.groupAdmins ? '#2563eb' : '#e5e7eb' }
                ]}
                onPress={() => handleVisibilityChange('groupAdmins')}
              >
                <View style={[
                  styles.toggleButton,
                  { transform: [{ translateX: dataVisibility.groupAdmins ? 20 : 4 }] }
                ]} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Session Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Sessions</Text>
          <View style={styles.card}>
            <TouchableOpacity 
              style={styles.logoutAllButton}
              onPress={handleLogoutAllDevices}
            >
              <MaterialIcons name="logout" size={20} color="white" />
              <Text style={styles.logoutAllText}>Log Out All Devices</Text>
            </TouchableOpacity>
            {activeSessions.map(session => (
              <View key={session.id} style={styles.sessionRow}>
                <View style={styles.sessionInfo}>
                  <MaterialIcons name="devices" size={24} color="#2563eb" />
                  <View style={styles.sessionText}>
                    <Text style={styles.sessionDevice}>{session.device}</Text>
                    <Text style={styles.sessionDetails}>
                      {session.location} • {session.lastActivity}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.endSessionButton}>
                  <MaterialIcons name="close" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Account Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Security</Text>
          <View style={styles.card}>
            <TouchableOpacity 
              style={[styles.lockButton, isAccountLocked && styles.unlockButton]}
              onPress={handleLockAccount}
            >
              <MaterialIcons 
                name={isAccountLocked ? "lock-open" : "lock"} 
                size={20} 
                color="white" 
              />
              <Text style={styles.lockButtonText}>
                {isAccountLocked ? 'Unlock Account' : 'Lock Account'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          <View style={styles.card}>
            <TouchableOpacity 
              style={styles.exportButton}
              onPress={handleExportData}
            >
              <MaterialIcons name="download" size={20} color="white" />
              <Text style={styles.exportButtonText}>Export My Data</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={handleDeleteAccount}
            >
              <MaterialIcons name="delete" size={20} color="white" />
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  header: {
    width: '100%',
    paddingBottom: 16,
  },
  headerContent: {
    paddingHorizontal: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    marginLeft: 4,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginHorizontal: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingText: {
    marginLeft: 16,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  toggle: {
    width: 52,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleButton: {
    width: 20,
    height: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sessionText: {
    marginLeft: 12,
  },
  sessionDevice: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  sessionDetails: {
    fontSize: 14,
    color: '#6b7280',
  },
  logoutAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  logoutAllText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '500',
  },
  endSessionButton: {
    padding: 8,
  },
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  unlockButton: {
    backgroundColor: '#10b981',
  },
  lockButtonText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '500',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  exportButtonText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  deleteButtonText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '500',
  },
});

export default PrivacySettings;
