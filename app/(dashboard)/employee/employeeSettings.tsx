import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Image,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AuthContext from '../../context/AuthContext';
import ThemeContext from '../../context/ThemeContext';

export default function EmployeeSettings() {
  const { theme, toggleTheme } = ThemeContext.useTheme();
  const { user, logout } = AuthContext.useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(theme === 'dark');

  React.useEffect(() => {
    setDarkMode(theme === 'dark');
  }, [theme]);

  const handleThemeToggle = (value: boolean) => {
    setDarkMode(value);
    toggleTheme();
  };

  const settingsSections = [
    {
      title: 'Account',
      items: [
        {
          icon: 'person-outline',
          title: 'Edit Profile',
          action: () => router.push('/(dashboard)/profile'),
        },
        {
          icon: 'lock-closed-outline',
          title: 'Change Password',
          action: () => router.push('/(dashboard)/change-password'),
        },
        {
          icon: 'notifications-outline',
          title: 'Notifications',
          type: 'switch',
          value: notifications,
          onChange: setNotifications,
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: 'moon-outline',
          title: 'Dark Mode',
          type: 'switch',
          value: darkMode,
          onChange: handleThemeToggle,
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'help-circle-outline',
          title: 'Help Center',
          action: () => router.push('/(dashboard)/help'),
        },
        {
          icon: 'chatbox-outline',
          title: 'Contact Support',
          action: () => router.push('/(dashboard)/support'),
        },
        {
          icon: 'document-text-outline',
          title: 'Terms & Privacy',
          action: () => router.push('/(dashboard)/terms'),
        },
      ],
    },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme === 'dark' ? '#111827' : '#F3F4F6' }]}>
      <StatusBar 
        backgroundColor={theme === 'dark' ? '#1F2937' : '#FFFFFF'}
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
      />
      
      <View style={[styles.header, { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFFFFF' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
          Settings
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileSection}>
          <Image
            source={{ uri: user?.avatar || 'https://via.placeholder.com/100' }}
            style={styles.profileImage}
          />
          <Text style={[styles.profileName, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
            {user?.name}
          </Text>
          <Text style={[styles.profileEmail, { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
            {user?.email}
          </Text>
        </View>

        {settingsSections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
              {section.title}
            </Text>
            <View style={[styles.sectionContent, { backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF' }]}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={[
                    styles.settingItem,
                    itemIndex < section.items.length - 1 && styles.settingItemBorder,
                  ]}
                  onPress={item.action}
                >
                  <View style={styles.settingItemLeft}>
                    <Ionicons
                      name={item.icon}
                      size={24}
                      color={theme === 'dark' ? '#FFFFFF' : '#111827'}
                    />
                    <Text style={[styles.settingItemTitle, { color: theme === 'dark' ? '#FFFFFF' : '#111827' }]}>
                      {item.title}
                    </Text>
                  </View>
                  {item.type === 'switch' ? (
                    <Switch
                      value={item.value}
                      onValueChange={item.onChange}
                      trackColor={{ false: '#767577', true: '#3B82F6' }}
                    />
                  ) : (
                    <View style={styles.settingItemRight}>
                      {item.subtitle && (
                        <Text style={[styles.settingItemSubtitle, { color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                          {item.subtitle}
                        </Text>
                      )}
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: '#EF4444' }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    padding: 24,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  sectionContent: {
    borderRadius: 12,
    marginHorizontal: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingItemTitle: {
    fontSize: 16,
    marginLeft: 12,
  },
  settingItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingItemSubtitle: {
    fontSize: 14,
    marginRight: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginVertical: 24,
    padding: 16,
    borderRadius: 12,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 