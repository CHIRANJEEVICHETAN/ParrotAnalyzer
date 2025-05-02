import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Alert } from 'react-native';
import { useTracking } from '../../context/TrackingContext';
import useLocationStore from '../../store/locationStore';
import { TrackingStatus } from '../../types/liveTracking';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Battery from 'expo-battery';
import EventEmitter from '../../utils/EventEmitter';

// Configure notifications for tracking status
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface TrackingStatusNotificationProps {
  compact?: boolean;
}

const TrackingStatusNotification: React.FC<TrackingStatusNotificationProps> = ({ 
  compact = false
}) => {
  const { trackingStatus, currentLocation, backgroundTrackingEnabled } = useLocationStore();
  const { isInitialized, checkTrackingStatus, restartBackgroundTracking } = useTracking();
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [showHealthWarning, setShowHealthWarning] = useState(false);

  // Monitor tracking health
  useEffect(() => {
    // Update battery level
    const updateBatteryLevel = async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        setBatteryLevel(Math.round(level * 100));
      } catch (error) {
        console.error('Error getting battery level:', error);
      }
    };

    // Update timer and check tracking health
    const interval = setInterval(async () => {
      updateBatteryLevel();
      
      // Update last update time if we have a currentLocation
      if (currentLocation?.timestamp) {
        const timestamp = new Date(currentLocation.timestamp);
        setLastUpdateTime(timestamp);
        
        // Check if last update is too old (more than 5 minutes)
        const now = new Date();
        const timeDiff = now.getTime() - timestamp.getTime();
        
        // Show warning if tracking is active but updates are stale
        if (trackingStatus === TrackingStatus.ACTIVE && timeDiff > 5 * 60 * 1000) {
          setShowHealthWarning(true);
          
          // Show an alert if the tracking appears to have stopped
          if (timeDiff > 10 * 60 * 1000 && !compact) {
            Alert.alert(
              'Tracking Issue',
              'Tracking may have stopped. Tap to restart.',
              [{ text: 'OK' }]
            );
          }
        } else {
          setShowHealthWarning(false);
        }
      }
      
      // If tracking should be active, verify it's really running
      if (trackingStatus === TrackingStatus.ACTIVE && backgroundTrackingEnabled) {
        const isActive = await checkTrackingStatus();
        if (!isActive && !compact) {
          // Show notification that tracking stopped unexpectedly
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Tracking Stopped Unexpectedly',
              body: 'Your location tracking has stopped. Open the app to restart it.',
              data: { type: 'tracking_stopped' },
            },
            trigger: null, // Show immediately
          });
        }
      }
    }, 60000); // Check every minute
    
    // Listen for tracking restart events
    const trackingStartedSubscription = EventEmitter.addListener('backgroundTrackingStarted', () => {
      Alert.alert('Success', 'Location tracking started');
      setShowHealthWarning(false);
    });
    
    const trackingStoppedSubscription = EventEmitter.addListener('backgroundTrackingStopped', () => {
      Alert.alert('Info', 'Location tracking stopped');
    });
    
    const trackingRestartFailedSubscription = EventEmitter.addListener('trackingAutoRestartFailed', () => {
      if (!compact) {
        Alert.alert('Error', 'Failed to automatically restart tracking');
      }
    });
    
    // Initial checks
    updateBatteryLevel();
    if (currentLocation?.timestamp) {
      setLastUpdateTime(new Date(currentLocation.timestamp));
    }
    
    return () => {
      clearInterval(interval);
      trackingStartedSubscription.removeAllListeners();
      trackingStoppedSubscription.removeAllListeners();
      trackingRestartFailedSubscription.removeAllListeners();
    };
  }, [trackingStatus, currentLocation, backgroundTrackingEnabled, compact]);

  // Handle restart tracking
  const handleRestartTracking = async () => {
    if (trackingStatus === TrackingStatus.ACTIVE) {
      Alert.alert('Info', 'Attempting to restart tracking...');
      
      const success = await restartBackgroundTracking();
      
      if (success) {
        Alert.alert('Success', 'Tracking restarted successfully');
        setShowHealthWarning(false);
      } else {
        Alert.alert('Error', 'Failed to restart tracking');
      }
    }
  };

  if (!isInitialized) {
    return null;
  }

  // Compact version for small displays
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={[
          styles.statusIndicator, 
          { backgroundColor: getStatusColor(trackingStatus, showHealthWarning) }
        ]} />
        {batteryLevel !== null && (
          <Text style={styles.compactText}>
            {getBatteryIcon(batteryLevel)} {batteryLevel}%
          </Text>
        )}
      </View>
    );
  }

  // Full version for tracking screens
  return (
    <Pressable 
      style={[styles.container, showHealthWarning && styles.warningContainer]} 
      onPress={handleRestartTracking}
    >
      <View style={styles.statusRow}>
        <View style={[
          styles.statusIndicator, 
          { backgroundColor: getStatusColor(trackingStatus, showHealthWarning) }
        ]} />
        <Text style={styles.statusText}>
          {getStatusText(trackingStatus, showHealthWarning)}
        </Text>
        {showHealthWarning && (
          <View style={styles.warningButton}>
            <Ionicons name="refresh" size={16} color="#fff" />
          </View>
        )}
      </View>
      
      <View style={styles.detailsRow}>
        {batteryLevel !== null && (
          <Text style={styles.detailText}>
            {getBatteryIcon(batteryLevel)} {batteryLevel}%
          </Text>
        )}
        {lastUpdateTime && (
          <Text style={styles.detailText}>
            Last update: {formatTimeDifference(lastUpdateTime)}
          </Text>
        )}
      </View>
      
      {showHealthWarning && (
        <Text style={styles.warningText}>
          Tracking may have stopped. Tap to restart.
        </Text>
      )}
    </Pressable>
  );
};

// Helper functions
const getStatusColor = (status: TrackingStatus, showWarning: boolean): string => {
  if (showWarning) return '#f59e0b';
  
  switch (status) {
    case TrackingStatus.ACTIVE:
      return '#22c55e';
    case TrackingStatus.PAUSED:
      return '#f59e0b';
    case TrackingStatus.INACTIVE:
    default:
      return '#ef4444';
  }
};

const getStatusText = (status: TrackingStatus, showWarning: boolean): string => {
  if (showWarning) return 'Tracking Issue Detected';
  
  switch (status) {
    case TrackingStatus.ACTIVE:
      return 'Actively Tracking';
    case TrackingStatus.PAUSED:
      return 'Tracking Paused';
    case TrackingStatus.INACTIVE:
    default:
      return 'Tracking Inactive';
  }
};

const getBatteryIcon = (level: number): string => {
  if (level <= 10) return '🔴';
  if (level <= 30) return '🟠';
  return '🟢';
};

const formatTimeDifference = (timestamp: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  return `${diffHours} hours ago`;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
    marginVertical: 8,
  },
  warningContainer: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#334155',
    flex: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailText: {
    fontSize: 12,
    color: '#64748b',
  },
  compactText: {
    fontSize: 10,
    color: '#64748b',
  },
  warningText: {
    marginTop: 8,
    fontSize: 12,
    color: '#ea580c',
    fontWeight: '500',
  },
  warningButton: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default TrackingStatusNotification; 