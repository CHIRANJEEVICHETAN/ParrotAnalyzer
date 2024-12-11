import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import ThemeContext from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';
import { Ionicons } from '@expo/vector-icons';
import type { NavItem } from '../types/nav';

export default function SuperAdminDashboard() {
  const { theme, toggleTheme } = ThemeContext.useTheme();

  const navItems: NavItem[] = [
    { icon: 'home-outline', label: 'Home', href: '/(dashboard)/super-admin' },
    { icon: 'people-outline', label: 'Users', href: '/(dashboard)/super-admin/users' },
    { icon: 'settings-outline', label: 'Config', href: '/(dashboard)/super-admin/config' },
    { icon: 'person-outline', label: 'Profile', href: '/(dashboard)/super-admin/profile' },
  ];

  return (
    <View className="flex-1">
      <ScrollView 
        className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
      >
        {/* Header */}
        <View className="px-6 pt-12 pb-4 flex-row justify-between items-center">
          <View>
            <Text 
              className={`text-2xl font-bold 
              ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}
            >
              Super Admin
            </Text>
            <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              System Overview
            </Text>
          </View>
          <TouchableOpacity onPress={toggleTheme} className="p-2">
            <Ionicons 
              name={theme === 'dark' ? 'sunny' : 'moon'} 
              size={24} 
              color={theme === 'dark' ? '#FFF' : '#000'}
            />
          </TouchableOpacity>
        </View>

        {/* System Metrics */}
        <View className="px-6 py-4">
          <View className="flex-row flex-wrap justify-between">
            {[
              { label: 'Total Users', value: '256', icon: 'people-outline', status: 'normal' },
              { label: 'Active Sessions', value: '124', icon: 'pulse-outline', status: 'warning' },
              { label: 'System Load', value: '65%', icon: 'speedometer-outline', status: 'normal' },
              { label: 'Storage Used', value: '82%', icon: 'server-outline', status: 'critical' },
            ].map((metric) => (
              <View 
                key={metric.label}
                className={`w-[48%] p-4 rounded-xl mb-4
                ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
              >
                <View className="flex-row justify-between items-center">
                  <Ionicons 
                    name={metric.icon as keyof typeof Ionicons.glyphMap}
                    size={24}
                    color={
                      metric.status === 'critical' ? '#EF4444' :
                      metric.status === 'warning' ? '#F59E0B' : '#3B82F6'
                    }
                  />
                  <View 
                    className={`w-2 h-2 rounded-full
                    ${metric.status === 'critical' ? 'bg-red-500' :
                      metric.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                  />
                </View>
                <Text 
                  className={`text-2xl font-bold mt-2
                  ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}
                >
                  {metric.value}
                </Text>
                <Text 
                  className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}
                >
                  {metric.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent System Alerts */}
        <View className="px-6 py-4">
          <Text 
            className={`text-lg font-semibold mb-4
            ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}
          >
            System Alerts
          </Text>
          <View 
            className={`p-4 rounded-xl
            ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
          >
            {[
              { message: 'High CPU Usage Detected', time: '5 mins ago', type: 'critical' },
              { message: 'New User Registration Spike', time: '15 mins ago', type: 'warning' },
              { message: 'Database Backup Completed', time: '1 hour ago', type: 'success' },
            ].map((alert, index) => (
              <View 
                key={index}
                className={`py-3 flex-row items-center
                ${index !== 2 ? 'border-b border-gray-700' : ''}`}
              >
                <View 
                  className={`w-2 h-2 rounded-full mr-3
                  ${alert.type === 'critical' ? 'bg-red-500' :
                    alert.type === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                />
                <View className="flex-1">
                  <Text 
                    className={`font-medium
                    ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}
                  >
                    {alert.message}
                  </Text>
                  <Text 
                    className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}
                  >
                    {alert.time}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Admin Actions */}
        <View className="px-6 py-4 mb-4">
          <Text 
            className={`text-lg font-semibold mb-4
            ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}
          >
            System Management
          </Text>
          <View className="space-y-3">
            {[
              { label: 'User Management', icon: 'people-outline', badge: '3' },
              { label: 'System Settings', icon: 'settings-outline' },
              { label: 'Security Logs', icon: 'shield-checkmark-outline' },
              { label: 'Database Management', icon: 'server-outline' },
              { label: 'API Configuration', icon: 'code-working-outline' },
            ].map((action) => (
              <TouchableOpacity
                key={action.label}
                className={`flex-row items-center p-4 rounded-xl
                ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
              >
                <Ionicons 
                  name={action.icon as keyof typeof Ionicons.glyphMap}
                  size={24}
                  color="#3B82F6"
                />
                <Text 
                  className={`ml-3 font-medium flex-1
                  ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}
                >
                  {action.label}
                </Text>
                {action.badge && (
                  <View className="bg-red-500 px-2 py-1 rounded-full">
                    <Text className="text-white text-xs">
                      {action.badge}
                    </Text>
                  </View>
                )}
                <Ionicons 
                  name="chevron-forward"
                  size={24}
                  color={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                  className="ml-2"
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
      
      <BottomNav items={navItems} />
    </View>
  );
} 