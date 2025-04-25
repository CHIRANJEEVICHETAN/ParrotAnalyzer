import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, Linking } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { useColorScheme, useThemeColor } from '../hooks/useColorScheme';
import { 
  isBackgroundLocationTrackingActive,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  BACKGROUND_LOCATION_TASK
} from '../utils/backgroundLocationTask';
import BatteryOptimizationHelper from '../utils/batteryOptimizationHelper';
import BackgroundTrackingToggle from '../components/controls/BackgroundTrackingToggle';
import BackgroundTrackingNotification from '../components/BackgroundTrackingNotification';

export default function TrackingTestScreen() {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor('#f8fafc', '#0f172a');
  const cardColor = useThemeColor('#ffffff', '#1e293b');
  const textColor = useThemeColor('#334155', '#e2e8f0');
  const accentColor = useThemeColor('#3b82f6', '#60a5fa');
  
  const [isActive, setIsActive] = useState(false);
  const [lastLocation, setLastLocation] = useState<Location.LocationObject | null>(null);
  const [taskStatus, setTaskStatus] = useState<string>('Unknown');
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<string>('Unknown');
  
  // Check tracking status on component mount
  useEffect(() => {
    checkTrackingStatus();
    checkPermissions();
  }, []);
  
  // Check background tracking status
  const checkTrackingStatus = async () => {
    try {
      const isTracking = await isBackgroundLocationTrackingActive();
      setIsActive(isTracking);
      
      if (isTracking) {
        // If tracking is active, try to get the current location
        try {
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced
          });
          setLastLocation(currentLocation);
          addLog('Retrieved current location');
        } catch (error) {
          addLog(`Error getting current location: ${error}`);
        }
      }
      
      // Check if task is defined
      const isTaskDefined = TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK);
      setTaskStatus(isTaskDefined ? 'Defined' : 'Not defined');
      addLog(`Task status: ${isTaskDefined ? 'Defined' : 'Not defined'}`);
    } catch (error) {
      addLog(`Error checking tracking status: ${error}`);
    }
  };
  
  // Check location permissions
  const checkPermissions = async () => {
    try {
      const foregroundPermission = await Location.getForegroundPermissionsAsync();
      const backgroundPermission = await Location.getBackgroundPermissionsAsync();
      
      setPermissionStatus(`Foreground: ${foregroundPermission.status}, Background: ${backgroundPermission.status}`);
      addLog(`Permissions - Foreground: ${foregroundPermission.status}, Background: ${backgroundPermission.status}`);
    } catch (error) {
      addLog(`Error checking permissions: ${error}`);
    }
  };
  
  // Add a new function to specifically request background permissions
  const requestBackgroundPermission = async () => {
    addLog("Requesting background location permission...");
    
    try {
      // Check foreground permission first
      const foregroundPermission = await Location.getForegroundPermissionsAsync();
      
      if (foregroundPermission.status !== 'granted') {
        addLog("⚠️ Foreground location permission not granted. Requesting it first...");
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          addLog("❌ Foreground location permission denied");
          Alert.alert(
            "Foreground Permission Required",
            "Background location requires foreground location permission first. Please enable location services in settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() }
            ]
          );
          return;
        }
        addLog("✅ Foreground location permission granted");
      }
      
      // Now request background permission
      addLog("Requesting background location permission...");
      
      if (Platform.OS === 'ios') {
        // On iOS, explain the process clearly first
        Alert.alert(
          "Background Location Required",
          "In the next prompt, please select 'Always Allow' to enable background location tracking. This is required for tracking to work when the app is in the background.",
          [{ text: "Continue", onPress: async () => {
            const { status } = await Location.requestBackgroundPermissionsAsync();
            
            if (status === 'granted') {
              addLog("✅ Background location permission granted");
              // Check if we actually got the permission
              await checkPermissions();
            } else {
              addLog("❌ Background location permission denied");
              Alert.alert(
                "Permission Denied",
                "Background location was not granted. Please go to Settings > Privacy > Location Services > Parrot Analyzer and select 'Always' to enable background tracking.",
                [
                  { text: "Later", style: "cancel" },
                  { text: "Open Settings", onPress: () => Linking.openSettings() }
                ]
              );
            }
          }}]
        );
      } else {
        // On Android, request directly
        const { status } = await Location.requestBackgroundPermissionsAsync();
        
        if (status === 'granted') {
          addLog("✅ Background location permission granted");
          await checkPermissions();
        } else {
          addLog("❌ Background location permission denied");
          Alert.alert(
            "Permission Denied",
            "To enable background location tracking, please go to Settings > Apps > Parrot Analyzer > Permissions > Location and select 'Allow all the time'.",
            [
              { text: "Later", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() }
            ]
          );
        }
      }
    } catch (error: any) {
      addLog(`❌ Error requesting background permission: ${error.message || String(error)}`);
      console.error("Error requesting background permission:", error);
    }
  };
  
  // Update the startTracking function to handle permissions better
  const startTracking = async () => {
    addLog("Starting background location tracking...");
    
    try {
      // Check for both foreground and background permissions
      const foregroundPermission = await Location.getForegroundPermissionsAsync();
      const backgroundPermission = await Location.getBackgroundPermissionsAsync();
      
      if (foregroundPermission.status !== 'granted') {
        addLog("⚠️ Foreground location permission not granted");
        return;
      }
      
      if (backgroundPermission.status !== 'granted') {
        addLog("⚠️ Background location permission not granted");
        
        Alert.alert(
          "Background Permission Required",
          "Background location permission is required to track location in the background. Would you like to grant it now?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Grant Permission", onPress: requestBackgroundPermission }
          ]
        );
        return;
      }
      
      // Check if already active
      const isActive = await isBackgroundLocationTrackingActive();
      
      if (isActive) {
        addLog("ℹ️ Background tracking is already active");
        setIsActive(true);
        return;
      }
      
      // For Android, check battery optimization
      if (Platform.OS === 'android') {
        await BatteryOptimizationHelper.promptForBatteryOptimizationDisable();
      }
      
      const success = await startBackgroundLocationTracking({
        timeInterval: 30000,  // Update every 30 seconds
        distanceInterval: 10, // or if moved 10 meters
        accuracy: Location.Accuracy.Balanced
      });
      
      if (success) {
        addLog("✅ Background location tracking started");
        setIsActive(true);
        
        // Set a timer to check tracking status after a short delay
        setTimeout(checkTrackingStatus, 2000);
      } else {
        addLog("❌ Failed to start background tracking");
      }
    } catch (error: any) {
      addLog(`❌ Error starting tracking: ${error.message || String(error)}`);
      console.error("Error starting tracking:", error);
    }
  };
  
  // Stop background tracking
  const stopTracking = async () => {
    try {
      addLog('Stopping background tracking...');
      
      const success = await stopBackgroundLocationTracking();
      
      if (success) {
        setIsActive(false);
        addLog('Background tracking stopped successfully');
      } else {
        addLog('Failed to stop background tracking');
      }
      
      await checkTrackingStatus();
    } catch (error) {
      addLog(`Error stopping tracking: ${error}`);
      Alert.alert('Error', `Failed to stop tracking: ${error}`);
    }
  };
  
  // Helper to add log messages
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogMessages(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  };
  
  // Format coordinates
  const formatCoordinate = (value?: number) => {
    return value !== undefined ? value.toFixed(6) : 'N/A';
  };
  
  return (
    <View style={[styles.container, { backgroundColor, marginTop: 50 }]}>
      <Stack.Screen 
        options={{
          title: 'Background Tracking Test',
          headerStyle: {
            backgroundColor: cardColor,
          },
          headerTintColor: textColor,
        }}
      />
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      
      {/* Background tracking notification */}
      <BackgroundTrackingNotification onPress={checkTrackingStatus} />
      
      <ScrollView contentContainerStyle={styles.content}>
        {/* Status card */}
        <View style={[styles.card, { backgroundColor: cardColor }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Tracking Status</Text>
          
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: textColor }]}>Status:</Text>
            <View style={[styles.badge, { backgroundColor: isActive ? '#10b981' : '#ef4444' }]}>
              <Text style={styles.badgeText}>{isActive ? 'Active' : 'Inactive'}</Text>
            </View>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: textColor }]}>Task:</Text>
            <Text style={[styles.value, { color: textColor }]}>{taskStatus}</Text>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: textColor }]}>Permissions:</Text>
            <Text style={[styles.value, { color: textColor }]}>{permissionStatus}</Text>
          </View>
        </View>
        
        {/* Last location card */}
        {lastLocation && (
          <View style={[styles.card, { backgroundColor: cardColor }]}>
            <Text style={[styles.cardTitle, { color: textColor }]}>Last Location</Text>
            
            <View style={styles.locationRow}>
              <Text style={[styles.label, { color: textColor }]}>Latitude:</Text>
              <Text style={[styles.value, { color: textColor }]}>
                {formatCoordinate(lastLocation.coords.latitude)}
              </Text>
            </View>
            
            <View style={styles.locationRow}>
              <Text style={[styles.label, { color: textColor }]}>Longitude:</Text>
              <Text style={[styles.value, { color: textColor }]}>
                {formatCoordinate(lastLocation.coords.longitude)}
              </Text>
            </View>
            
            <View style={styles.locationRow}>
              <Text style={[styles.label, { color: textColor }]}>Accuracy:</Text>
              <Text style={[styles.value, { color: textColor }]}>
                {lastLocation.coords.accuracy ? `${Math.round(lastLocation.coords.accuracy)}m` : 'N/A'}
              </Text>
            </View>
            
            <View style={styles.locationRow}>
              <Text style={[styles.label, { color: textColor }]}>Time:</Text>
              <Text style={[styles.value, { color: textColor }]}>
                {new Date(lastLocation.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          </View>
        )}
        
        {/* Controls */}
        <View style={[styles.card, { backgroundColor: cardColor }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Controls</Text>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: accentColor }]}
              onPress={checkTrackingStatus}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.buttonText}>Refresh Status</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: accentColor }]}
              onPress={checkPermissions}
            >
              <Ionicons name="key" size={20} color="#fff" />
              <Text style={styles.buttonText}>Check Permissions</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: accentColor }]}
              onPress={requestBackgroundPermission}
            >
              <Text style={styles.buttonText}>Request Background Permission</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[
                styles.button, 
                { backgroundColor: isActive ? '#ef4444' : '#10b981' }
              ]}
              onPress={isActive ? stopTracking : startTracking}
            >
              <Ionicons 
                name={isActive ? 'stop-circle' : 'play-circle'} 
                size={20} 
                color="#fff" 
              />
              <Text style={styles.buttonText}>
                {isActive ? 'Stop Tracking' : 'Start Tracking'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <BackgroundTrackingToggle />
        </View>
        
        {/* Logs */}
        <View style={[styles.card, { backgroundColor: cardColor }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Logs</Text>
          <View style={styles.logContainer}>
            {logMessages.map((log, index) => (
              <Text 
                key={index} 
                style={[styles.logText, { color: textColor }]}
                numberOfLines={2}
              >
                {log}
              </Text>
            ))}
            
            {logMessages.length === 0 && (
              <Text style={[styles.emptyLog, { color: `${textColor}80` }]}>
                No logs yet
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  label: {
    fontSize: 16,
    opacity: 0.8,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  logContainer: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
  },
  logText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingVertical: 2,
  },
  emptyLog: {
    textAlign: 'center',
    fontStyle: 'italic',
    marginVertical: 12,
  },
});