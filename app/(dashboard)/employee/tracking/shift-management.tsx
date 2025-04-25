import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import axios from 'axios';

import { useAuth } from '../../../context/AuthContext';
import { useColorScheme, useThemeColor } from '../../../hooks/useColorScheme';
import { useGeofencing } from '../../../hooks/useGeofencing';
import { useSocket } from '../../../hooks/useSocket';
import { useShiftManagement } from '../../../hooks/useShiftManagement';
import { useLocationTracking } from '../../../hooks/useLocationTracking';
import useLocationStore from '../../../store/locationStore';

interface ShiftHistory {
  id: number;
  date: string;
  startTime: string;
  endTime: string | null;
  duration: string | null;
  totalDistance: number | null;
  inGeofence: boolean;
}

export default function ShiftManagementScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { user } = useAuth();
  const backgroundColor = useThemeColor('#f8fafc', '#0f172a');
  const textColor = useThemeColor('#334155', '#e2e8f0');
  const cardColor = useThemeColor('#ffffff', '#1e293b');
  const accentColor = useThemeColor('#3b82f6', '#60a5fa');

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [shiftHistory, setShiftHistory] = useState<ShiftHistory[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [canSubmitAnywhere, setCanSubmitAnywhere] = useState(false);
  
  // Location tracking
  const { getCurrentLocation } = useLocationTracking();
  const { isLocationInAnyGeofence } = useGeofencing();
  const { currentLocation, isInGeofence } = useLocationStore();
  
  // Shift management
  const { 
    currentShift,
    isShiftActive,
    isLoading,
    error,
    startShift,
    endShift,
    getShiftHistory
  } = useShiftManagement({
    onShiftStart: (shiftData) => {
      console.log('Shift started:', shiftData);
      fetchShiftHistory();
    },
    onShiftEnd: (shiftData) => {
      console.log('Shift ended:', shiftData);
      fetchShiftHistory();
    },
    onError: (errorMsg) => {
      Alert.alert('Shift Error', errorMsg);
    }
  });

  // Socket for real-time updates
  const { socket, isConnected } = useSocket();

  // Check if user can submit shift from anywhere
  useEffect(() => {
    async function checkUserPermissions() {
      if (!user) return;
      
      try {
        const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
        const response = await axios.get(`${API_URL}/api/user-settings`);
        
        if (response.data && response.data.can_submit_expenses_anytime !== undefined) {
          setCanSubmitAnywhere(response.data.can_submit_expenses_anytime);
        }
      } catch (error) {
        console.error('Error fetching user settings:', error);
        // Default to requiring geofence
        setCanSubmitAnywhere(false);
      }
    }
    
    checkUserPermissions();
  }, [user]);

  // Check permissions on component mount
  useEffect(() => {
    checkPermissions();
    fetchShiftHistory();
  }, []);

  // Check location permissions and services
  const checkPermissions = async () => {
    // Check if location services are enabled
    const locationServicesEnabled = await Location.hasServicesEnabledAsync();
    setIsLocationEnabled(locationServicesEnabled);

    if (!locationServicesEnabled) {
      Alert.alert(
        'Location Services Disabled',
        'Please enable location services in your device settings to use shift tracking.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => {
              // For Expo, we can use Linking to open settings
              try {
                Location.requestForegroundPermissionsAsync().then(() => {
                  // This typically prompts the system to ask about enabling location services
                });
              } catch (e) {
                console.error('Could not open settings:', e);
              }
            } 
          }
        ]
      );
      return false;
    }

    // Check foreground permissions
    let foregroundPermission = await Location.getForegroundPermissionsAsync();
    
    if (!foregroundPermission.granted) {
      foregroundPermission = await Location.requestForegroundPermissionsAsync();
      if (!foregroundPermission.granted) {
        Alert.alert('Permission Denied', 'Location permission is required for shift tracking');
        return false;
      }
    }

    // Check background permissions if foreground is granted
    if (foregroundPermission.granted) {
      let backgroundPermission = await Location.getBackgroundPermissionsAsync();
      
      if (!backgroundPermission.granted) {
        backgroundPermission = await Location.requestBackgroundPermissionsAsync();
      }
      
      setPermissionStatus(backgroundPermission.status);
      
      // If we need background but don't have it, warn the user
      if (backgroundPermission.status !== 'granted') {
        Alert.alert(
          'Background Location',
          'For accurate shift tracking, please allow background location access',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Settings', 
              onPress: () => {
                try {
                  Location.requestBackgroundPermissionsAsync();
                } catch (e) {
                  console.error('Could not request background permissions:', e);
                }
              } 
            }
          ]
        );
      }
    }
    
    return foregroundPermission.granted;
  };

  // Fetch shift history
  const fetchShiftHistory = async () => {
    try {
      const today = new Date();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const formattedStartDate = oneMonthAgo.toISOString().split('T')[0];
      const formattedEndDate = today.toISOString().split('T')[0];
      
      const shifts = await getShiftHistory(formattedStartDate, formattedEndDate);
      
      // Transform data for display
      const formattedShifts = shifts.map(shift => ({
        id: shift.shiftId,
        date: new Date(shift.startTimestamp).toLocaleDateString(),
        startTime: new Date(shift.startTimestamp).toLocaleTimeString(),
        endTime: shift.endTimestamp ? new Date(shift.endTimestamp).toLocaleTimeString() : null,
        duration: shift.endTimestamp ? formatDuration(
          new Date(shift.startTimestamp),
          new Date(shift.endTimestamp)
        ) : null,
        totalDistance: shift.totalDistance || null,
        inGeofence: shift.isInGeofence
      }));
      
      setShiftHistory(formattedShifts);
    } catch (error) {
      console.error('Error fetching shift history:', error);
    }
  };

  // Handle shift start
  const handleStartShift = async () => {
    // First check permissions
    const hasPermissions = await checkPermissions();
    if (!hasPermissions || !isLocationEnabled) {
      return;
    }
    
    // Get current location and check if in geofence
    const location = await getCurrentLocation();
    if (!location) {
      Alert.alert('Error', 'Unable to get current location');
      return;
    }
    
    const inGeofence = isLocationInAnyGeofence(location);
    
    // If not in geofence and required, alert user
    if (!inGeofence && !canSubmitAnywhere) {
      Alert.alert(
        'Outside Geofence Area',
        'You must be within a registered work area to start your shift.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Start shift
    await startShift();
  };

  // Handle shift end
  const handleEndShift = async () => {
    // First check permissions
    const hasPermissions = await checkPermissions();
    if (!hasPermissions || !isLocationEnabled) {
      return;
    }
    
    // Get current location and check if in geofence
    const location = await getCurrentLocation();
    if (!location) {
      Alert.alert('Error', 'Unable to get current location');
      return;
    }
    
    const inGeofence = isLocationInAnyGeofence(location);
    
    // If not in geofence and required, alert user
    if (!inGeofence && !canSubmitAnywhere) {
      Alert.alert(
        'Outside Geofence Area',
        'You must be within a registered work area to end your shift.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // End shift
    await endShift();
  };

  // Format duration between two dates
  const formatDuration = (startDate: Date, endDate: Date) => {
    const diff = endDate.getTime() - startDate.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await checkPermissions();
    await fetchShiftHistory();
    setRefreshing(false);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen 
        options={{
          title: 'Shift Management',
          headerStyle: {
            backgroundColor: cardColor,
          },
          headerTintColor: textColor,
        }}
      />
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Current shift status card */}
        <View style={[styles.card, { backgroundColor: cardColor }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Current Shift Status</Text>
          
          <View style={styles.shiftStatusContainer}>
            <View style={styles.statusIconContainer}>
              <View 
                style={[
                  styles.statusIndicator, 
                  { backgroundColor: isShiftActive ? '#10b981' : '#6b7280' }
                ]} 
              />
              <Text style={[styles.statusText, { color: textColor }]}>
                {isShiftActive ? 'Shift Active' : 'No Active Shift'}
              </Text>
            </View>
            
            {isShiftActive && currentShift && (
              <View style={styles.shiftDetails}>
                <Text style={[styles.shiftTime, { color: textColor }]}>
                  Started: {new Date(currentShift.startTimestamp).toLocaleTimeString()}
                </Text>
                <Text style={[styles.shiftDate, { color: textColor }]}>
                  {new Date(currentShift.startTimestamp).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
          
          {/* Geofence status */}
          <View style={styles.geofenceStatus}>
            <Ionicons 
              name="map" 
              size={18} 
              color={isInGeofence ? '#10b981' : '#ef4444'} 
            />
            <Text style={[styles.geofenceText, { color: textColor }]}>
              {isInGeofence 
                ? 'Within work area'
                : canSubmitAnywhere 
                  ? 'Outside work area (permitted)'
                  : 'Outside work area (shift actions restricted)'
              }
            </Text>
          </View>
          
          {/* Action buttons */}
          <View style={styles.shiftActions}>
            {!isShiftActive ? (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: accentColor }]}
                onPress={handleStartShift}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Ionicons name="play" size={18} color="#ffffff" />
                    <Text style={styles.actionButtonText}>Start Shift</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#ef4444' }]}
                onPress={handleEndShift}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Ionicons name="stop" size={18} color="#ffffff" />
                    <Text style={styles.actionButtonText}>End Shift</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
          
          {/* Show error if exists */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>
        
        {/* Shift history */}
        <View style={[styles.card, { backgroundColor: cardColor }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Recent Shifts</Text>
          
          {shiftHistory.length === 0 ? (
            <Text style={[styles.emptyText, { color: textColor }]}>
              No shifts in the last 30 days
            </Text>
          ) : (
            <View style={styles.historyList}>
              {shiftHistory.map((shift) => (
                <View key={shift.id} style={styles.historyItem}>
                  <View style={styles.historyHeader}>
                    <Text style={[styles.historyDate, { color: textColor }]}>
                      {shift.date}
                    </Text>
                    <View 
                      style={[
                        styles.geofenceIndicator, 
                        { backgroundColor: shift.inGeofence ? '#10b981' : '#f59e0b' }
                      ]}
                    >
                      <Text style={styles.geofenceIndicatorText}>
                        {shift.inGeofence ? 'In Zone' : 'Out of Zone'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.historyTimes}>
                    <View style={styles.timeBlock}>
                      <Text style={[styles.timeLabel, { color: textColor }]}>Start</Text>
                      <Text style={[styles.timeValue, { color: textColor }]}>{shift.startTime}</Text>
                    </View>
                    
                    <View style={styles.timeBlock}>
                      <Text style={[styles.timeLabel, { color: textColor }]}>End</Text>
                      <Text style={[styles.timeValue, { color: textColor }]}>
                        {shift.endTime || 'Active'}
                      </Text>
                    </View>
                    
                    <View style={styles.timeBlock}>
                      <Text style={[styles.timeLabel, { color: textColor }]}>Duration</Text>
                      <Text style={[styles.timeValue, { color: textColor }]}>
                        {shift.duration || '-'}
                      </Text>
                    </View>
                  </View>
                  
                  {shift.totalDistance && (
                    <View style={styles.distanceContainer}>
                      <Ionicons name="trending-up" size={14} color={textColor} />
                      <Text style={[styles.distanceText, { color: textColor }]}>
                        {`${Math.round(shift.totalDistance)} meters traveled`}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
        
        {/* Information card */}
        <View style={[styles.card, { backgroundColor: cardColor }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Shift Guidelines</Text>
          
          <View style={styles.infoItem}>
            <Ionicons name="information-circle" size={18} color={accentColor} />
            <Text style={[styles.infoText, { color: textColor }]}>
              {canSubmitAnywhere
                ? 'You are permitted to start and end shifts from any location.'
                : 'Shifts must be started and ended within designated work areas.'
              }
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <Ionicons name="location" size={18} color={accentColor} />
            <Text style={[styles.infoText, { color: textColor }]}>
              Location tracking will continue throughout your shift for accurate reporting.
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <Ionicons name="battery-charging" size={18} color={accentColor} />
            <Text style={[styles.infoText, { color: textColor }]}>
              Ensure your phone is charged or charging during long shifts for uninterrupted tracking.
            </Text>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  shiftStatusContainer: {
    marginBottom: 12,
  },
  statusIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  shiftDetails: {
    marginLeft: 20,
  },
  shiftTime: {
    fontSize: 14,
    fontWeight: '500',
  },
  shiftDate: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  geofenceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
  },
  geofenceText: {
    marginLeft: 8,
    fontSize: 14,
  },
  shiftActions: {
    marginBottom: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  errorText: {
    color: '#b91c1c',
    marginLeft: 8,
    fontSize: 14,
  },
  historyList: {
    marginTop: 8,
  },
  historyItem: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    paddingVertical: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyDate: {
    fontWeight: '600',
  },
  geofenceIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  geofenceIndicatorText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  historyTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeBlock: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 12,
    marginLeft: 4,
    opacity: 0.7,
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    opacity: 0.7,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoText: {
    marginLeft: 8,
    flex: 1,
  },
}); 