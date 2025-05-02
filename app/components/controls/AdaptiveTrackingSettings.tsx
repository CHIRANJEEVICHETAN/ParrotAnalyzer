import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme, useThemeColor } from '../../hooks/useColorScheme';
import { useTracking } from '../../context/TrackingContext';

// Storage keys for settings
const BATTERY_ADAPTIVE_TRACKING_KEY = 'battery_adaptive_tracking';
const ACTIVITY_ADAPTIVE_TRACKING_KEY = 'activity_adaptive_tracking';
const STATIONARY_ADAPTIVE_TRACKING_KEY = 'stationary_adaptive_tracking';

interface AdaptiveTrackingSettingsProps {
  onSettingsChanged?: () => void;
}

const AdaptiveTrackingSettings: React.FC<AdaptiveTrackingSettingsProps> = ({ 
  onSettingsChanged 
}) => {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor('#ffffff', '#1e293b');
  const textColor = useThemeColor('#334155', '#e2e8f0');
  const borderColor = useThemeColor('#e2e8f0', '#334155');
  const accentColor = useThemeColor('#3b82f6', '#60a5fa');
  
  const { configureAdaptiveTracking, deviceInfo } = useTracking();
  
  // Settings state
  const [batteryAdaptive, setBatteryAdaptive] = useState(false);
  const [activityAdaptive, setActivityAdaptive] = useState(false);
  const [stationaryAdaptive, setStationaryAdaptive] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Load current settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const batteryEnabled = await AsyncStorage.getItem(BATTERY_ADAPTIVE_TRACKING_KEY);
        const activityEnabled = await AsyncStorage.getItem(ACTIVITY_ADAPTIVE_TRACKING_KEY);
        const stationaryEnabled = await AsyncStorage.getItem(STATIONARY_ADAPTIVE_TRACKING_KEY);
        
        setBatteryAdaptive(batteryEnabled === 'true');
        setActivityAdaptive(activityEnabled === 'true');
        setStationaryAdaptive(stationaryEnabled === 'true');
        
      } catch (error) {
        console.error('Error loading adaptive tracking settings:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings();
  }, []);
  
  // Handle toggle changes
  const handleToggle = async (type: 'battery' | 'activity' | 'stationary', value: boolean) => {
    try {
      // Update local state first for immediate feedback
      if (type === 'battery') {
        setBatteryAdaptive(value);
      } else if (type === 'activity') {
        setActivityAdaptive(value);
      } else {
        setStationaryAdaptive(value);
      }
      
      // Apply setting changes
      await configureAdaptiveTracking({
        battery: type === 'battery' ? value : batteryAdaptive,
        activity: type === 'activity' ? value : activityAdaptive,
        stationary: type === 'stationary' ? value : stationaryAdaptive
      });
      
      if (onSettingsChanged) {
        onSettingsChanged();
      }
    } catch (error) {
      console.error(`Error toggling ${type} adaptive setting:`, error);
      
      // Revert UI state on error
      if (type === 'battery') {
        setBatteryAdaptive(!value);
      } else if (type === 'activity') {
        setActivityAdaptive(!value);
      } else {
        setStationaryAdaptive(!value);
      }
      
      Alert.alert('Error', `Failed to update ${type} tracking setting. Please try again.`);
    }
  };
  
  // Show help information
  const showHelp = (type: 'battery' | 'activity' | 'stationary') => {
    let title = '';
    let message = '';
    
    if (type === 'battery') {
      title = 'Battery-Based Adaptive Tracking';
      message = 'When enabled, tracking frequency will be automatically adjusted based on your device battery level.\n\nAt low battery levels, updates will be less frequent to conserve power.';
    } else if (type === 'activity') {
      title = 'Activity-Based Adaptive Tracking';
      message = 'When enabled, tracking frequency will be automatically adjusted based on your movement.\n\nWhen driving or moving quickly, updates will be more frequent. When walking or stationary, updates will be less frequent.';
    } else {
      title = 'Stationary Adaptive Tracking';
      message = 'When enabled, tracking will automatically reduce frequency when you haven\'t moved significantly for several minutes.\n\nThis helps conserve battery when you\'re not moving.';
    }
    
    Alert.alert(title, message);
  };
  
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <Text style={[styles.loadingText, { color: textColor }]}>Loading settings...</Text>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={[styles.title, { color: textColor }]}>
        Adaptive Tracking Settings
      </Text>
      
      <Text style={[styles.description, { color: textColor }]}>
        Optimize battery usage and tracking performance with these smart settings.
      </Text>
      
      {deviceInfo.needsBatteryOptimization && (
        <View style={[styles.warningBox, { borderColor: '#f59e0b' }]}>
          <Ionicons name="warning" size={20} color="#f59e0b" />
          <Text style={[styles.warningText, { color: textColor }]}>
            Your device ({deviceInfo.manufacturer}) is known to have aggressive battery optimization.
            Enabling these settings is highly recommended.
          </Text>
        </View>
      )}
      
      <View style={[styles.settingItem, { borderColor }]}>
        <View style={styles.settingLeft}>
          <Text style={[styles.settingLabel, { color: textColor }]}>Battery-Based Tracking</Text>
          <Text style={[styles.settingDescription, { color: textColor }]}>
            Adjust frequency based on battery level
          </Text>
        </View>
        
        <View style={styles.settingRight}>
          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => showHelp('battery')}
          >
            <Ionicons name="information-circle-outline" size={22} color={accentColor} />
          </TouchableOpacity>
          
          <Switch
            value={batteryAdaptive}
            onValueChange={(value) => handleToggle('battery', value)}
            trackColor={{ false: '#767577', true: accentColor }}
            thumbColor={batteryAdaptive ? '#fff' : '#f4f3f4'}
            ios_backgroundColor="#3e3e3e"
          />
        </View>
      </View>
      
      <View style={[styles.settingItem, { borderColor }]}>
        <View style={styles.settingLeft}>
          <Text style={[styles.settingLabel, { color: textColor }]}>Activity-Based Tracking</Text>
          <Text style={[styles.settingDescription, { color: textColor }]}>
            Adjust frequency based on movement speed
          </Text>
        </View>
        
        <View style={styles.settingRight}>
          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => showHelp('activity')}
          >
            <Ionicons name="information-circle-outline" size={22} color={accentColor} />
          </TouchableOpacity>
          
          <Switch
            value={activityAdaptive}
            onValueChange={(value) => handleToggle('activity', value)}
            trackColor={{ false: '#767577', true: accentColor }}
            thumbColor={activityAdaptive ? '#fff' : '#f4f3f4'}
            ios_backgroundColor="#3e3e3e"
          />
        </View>
      </View>
      
      <View style={[styles.settingItem, { borderColor, borderBottomWidth: 0 }]}>
        <View style={styles.settingLeft}>
          <Text style={[styles.settingLabel, { color: textColor }]}>Stationary Detection</Text>
          <Text style={[styles.settingDescription, { color: textColor }]}>
            Reduce frequency when not moving
          </Text>
        </View>
        
        <View style={styles.settingRight}>
          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => showHelp('stationary')}
          >
            <Ionicons name="information-circle-outline" size={22} color={accentColor} />
          </TouchableOpacity>
          
          <Switch
            value={stationaryAdaptive}
            onValueChange={(value) => handleToggle('stationary', value)}
            trackColor={{ false: '#767577', true: accentColor }}
            thumbColor={stationaryAdaptive ? '#fff' : '#f4f3f4'}
            ios_backgroundColor="#3e3e3e"
          />
        </View>
      </View>
      
      <View style={styles.recommendedSettings}>
        <TouchableOpacity 
          style={[
            styles.recommendedButton, 
            { backgroundColor: accentColor }
          ]}
          onPress={() => {
            // Apply recommended settings
            handleToggle('battery', true);
            handleToggle('activity', true);
            handleToggle('stationary', true);
          }}
        >
          <Text style={styles.recommendedButtonText}>
            Apply Recommended Settings
          </Text>
        </TouchableOpacity>
        
        <Text style={[styles.recommendedDescription, { color: textColor }]}>
          For optimal battery life and tracking accuracy, we recommend enabling all adaptive features.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
    opacity: 0.8,
    lineHeight: 20,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  warningText: {
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    opacity: 0.7,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helpButton: {
    padding: 4,
  },
  recommendedSettings: {
    marginTop: 24,
    alignItems: 'center',
  },
  recommendedButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  recommendedButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  recommendedDescription: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.7,
    paddingHorizontal: 16,
  },
  loadingText: {
    textAlign: 'center',
    padding: 20,
  },
});

export default AdaptiveTrackingSettings; 