import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import PushNotificationService from '../../utils/pushNotificationService';
import ThemeContext from '../../context/ThemeContext';
import * as Notifications from 'expo-notifications';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';

/**
 * TestNotifications - A comprehensive push notification testing utility
 * 
 * This screen allows you to:
 * 1. Send local test notifications with custom titles and messages
 * 2. Test direct API notifications via Expo's servers
 * 3. Check notification configuration status
 * 4. View notification logs
 */
export default function TestNotifications() {
  const router = useRouter();
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === 'dark';
  
  const [localTitle, setLocalTitle] = useState('Local Test');
  const [localMessage, setLocalMessage] = useState('This is a local test notification');
  const [remoteTitle, setRemoteTitle] = useState('Remote Test');
  const [remoteMessage, setRemoteMessage] = useState('This is a remote test via Expo API');
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<string>('Checking...');

  useEffect(() => {
    // Get current token
    PushNotificationService.getCurrentToken().then(token => {
      setExpoPushToken(token);
      addLog(`Current token: ${token || 'Not found'}`);
    });

    // Check notification permissions
    Notifications.getPermissionsAsync().then(({ status }) => {
      setPermissionStatus(status);
      addLog(`Notification permission status: ${status}`);
    });

    // Check Android channels if on Android
    if (Platform.OS === 'android') {
      Notifications.getNotificationChannelsAsync().then(channels => {
        addLog(`Android channels: ${channels.map(c => c.name).join(', ') || 'None'}`);
      });
    }
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  };

  const sendLocalNotification = async () => {
    try {
      addLog('Sending local notification...');
      const result = await PushNotificationService.sendTestNotification(
        localTitle,
        localMessage
      );
      addLog(`Local notification sent: ${result ? 'Success' : 'Failed'}`);
    } catch (error) {
      addLog(`Error sending local notification: ${(error as Error).message}`);
    }
  };

  const sendRemoteNotification = async () => {
    try {
      if (!expoPushToken) {
        addLog('No token available for remote test');
        return;
      }
      
      addLog('Sending remote notification via Expo API...');
      
      const response = await axios.post(
        'https://exp.host/--/api/v2/push/send',
        {   // request body
            to: expoPushToken,
            title: remoteTitle,
            body: remoteMessage,
            data: { 
                source: 'test-page',
                screen: "/(dashboard)/employee/notifications",
                timestamp: new Date().toISOString()
            },
            sound: 'default',
            badge: 1,
            channelId: 'default',
            priority: 'high',
            _displayInForeground: true,
        },
        {   // config object
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        }
      );
      
      const result = response.data;
      addLog(`Remote notification response: ${JSON.stringify(result)}`);
    } catch (error) {
      addLog(`Error sending remote notification: ${(error as Error).message}`);
    }
  };

  const checkConnectivity = async () => {
    try {
      addLog('Checking connectivity to Expo servers...');
      
      const response = await axios.post(
        'https://exp.host/--/api/v2/push/getReceipts',
        { ids: ['connectivity-test'] },  // request body
        {   // config object
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        }
      );
      
      addLog(`Connectivity status: ${response.status === 200 ? 'OK' : 'Failed'}`);
      
      if (response.status === 200) {
        const data = response.data;
        addLog(`Server response: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      addLog(`Connectivity error: ${(error as Error).message}`);
    }
  };

  return (
    <ScrollView 
      className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}
      contentContainerStyle={{paddingBottom: 40}}
    >
      <View className="px-4 py-6">
        <View className="flex-row items-center mb-6">
          <Pressable 
            onPress={() => router.back()} 
            className="mr-3"
          >
            <MaterialCommunityIcons 
              name="arrow-left" 
              size={24} 
              color={isDark ? '#ffffff' : '#0f172a'} 
            />
          </Pressable>
          <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Push Notification Tester
          </Text>
        </View>

        {/* Permission Status */}
        <View className={`mb-6 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Configuration Status
          </Text>
          <View className="flex-row justify-between mb-2">
            <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Permission:</Text>
            <Text className={`font-medium ${
              permissionStatus === 'granted' 
                ? 'text-green-500' 
                : 'text-red-500'
            }`}>
              {permissionStatus}
            </Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Platform:</Text>
            <Text className={`font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              {Platform.OS} {Platform.Version}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Token:</Text>
            <Text className={`font-medium ${
              expoPushToken 
                ? (isDark ? 'text-green-400' : 'text-green-600')
                : (isDark ? 'text-red-400' : 'text-red-600')
            }`}>
              {expoPushToken ? 'Available' : 'Not found'}
            </Text>
          </View>
        </View>

        {/* Token Display */}
        {expoPushToken && (
          <View className={`mb-6 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Expo Push Token
            </Text>
            <Text selectable className={`p-2 rounded ${isDark ? 'bg-gray-700 text-blue-300' : 'bg-gray-100 text-blue-800'}`}>
              {expoPushToken}
            </Text>
          </View>
        )}

        {/* Local Notification Test */}
        <View className={`mb-6 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Local Notification Test
          </Text>
          <TextInput
            placeholder="Notification Title"
            value={localTitle}
            onChangeText={setLocalTitle}
            placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
            className={`p-3 mb-3 rounded-md border ${
              isDark 
                ? 'bg-gray-700 text-white border-gray-600' 
                : 'bg-white text-gray-900 border-gray-300'
            }`}
          />
          <TextInput
            placeholder="Notification Message"
            value={localMessage}
            onChangeText={setLocalMessage}
            placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
            className={`p-3 mb-3 rounded-md border ${
              isDark 
                ? 'bg-gray-700 text-white border-gray-600' 
                : 'bg-white text-gray-900 border-gray-300'
            }`}
          />
          <Pressable
            onPress={sendLocalNotification}
            className={`p-3 rounded-md ${isDark ? 'bg-blue-600' : 'bg-blue-500'}`}
          >
            <Text className="text-white font-medium text-center">
              Send Local Notification
            </Text>
          </Pressable>
        </View>

        {/* Remote Notification Test */}
        <View className={`mb-6 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Remote Notification Test
          </Text>
          <TextInput
            placeholder="Notification Title"
            value={remoteTitle}
            onChangeText={setRemoteTitle}
            placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
            className={`p-3 mb-3 rounded-md border ${
              isDark 
                ? 'bg-gray-700 text-white border-gray-600' 
                : 'bg-white text-gray-900 border-gray-300'
            }`}
          />
          <TextInput
            placeholder="Notification Message"
            value={remoteMessage}
            onChangeText={setRemoteMessage}
            placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
            className={`p-3 mb-3 rounded-md border ${
              isDark 
                ? 'bg-gray-700 text-white border-gray-600' 
                : 'bg-white text-gray-900 border-gray-300'
            }`}
          />
          <Pressable
            onPress={sendRemoteNotification}
            className={`p-3 mb-3 rounded-md ${
              expoPushToken 
                ? (isDark ? 'bg-green-600' : 'bg-green-500') 
                : 'bg-gray-400'
            }`}
            disabled={!expoPushToken}
          >
            <Text className="text-white font-medium text-center">
              Send Remote via Expo API
            </Text>
          </Pressable>
          <Pressable
            onPress={checkConnectivity}
            className={`p-3 rounded-md ${isDark ? 'bg-purple-600' : 'bg-purple-500'}`}
          >
            <Text className="text-white font-medium text-center">
              Check Expo Connectivity
            </Text>
          </Pressable>
        </View>

        {/* Logs */}
        <View className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <Text className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Logs
          </Text>
          <ScrollView 
            className={`p-3 rounded-md max-h-60 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}
          >
            {logs.length > 0 ? (
              logs.map((log, index) => (
                <Text 
                  key={index} 
                  className={`mb-1 font-mono text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  {log}
                </Text>
              ))
            ) : (
              <Text className={`italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                No logs yet
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </ScrollView>
  );
}
