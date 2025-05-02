import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform, Alert } from 'react-native';
import useLocationStore from '../store/locationStore';
import { 
  BACKGROUND_LOCATION_TASK, 
  startBackgroundLocationTracking, 
  stopBackgroundLocationTracking,
  isBackgroundLocationTrackingActive,
  toggleAdaptiveTracking
} from '../utils/backgroundLocationTask';
import * as Location from 'expo-location';
import { TrackingStatus } from '../types/liveTracking';
import EventEmitter from '../utils/EventEmitter';
import BatteryOptimizationHelper from '../utils/batteryOptimizationHelper';
import * as Device from 'expo-device';

// Define the TrackingContext types
interface TrackingContextType {
  isInitialized: boolean;
  checkTrackingStatus: () => Promise<boolean>;
  restartBackgroundTracking: () => Promise<boolean>;
  toggleBackgroundTracking: (enabled: boolean) => Promise<boolean>;
  isForegroundActive: boolean;
  configureAdaptiveTracking: (options: {
    battery: boolean;
    activity: boolean;
    stationary: boolean;
  }) => Promise<boolean>;
  openBatterySettings: () => Promise<void>;
  deviceInfo: {
    manufacturer: string | null;
    needsBatteryOptimization: boolean;
    isIOS: boolean;
    isAndroid: boolean;
  };
}

// Create context with default values
const TrackingContext = createContext<TrackingContextType>({
  isInitialized: false,
  checkTrackingStatus: async () => false,
  restartBackgroundTracking: async () => false,
  toggleBackgroundTracking: async () => false,
  isForegroundActive: false,
  configureAdaptiveTracking: async () => false,
  openBatterySettings: async () => {},
  deviceInfo: {
    manufacturer: null,
    needsBatteryOptimization: false,
    isIOS: Platform.OS === 'ios',
    isAndroid: Platform.OS === 'android'
  },
});

// Device-specific manufacturers known for aggressive battery optimization
const AGGRESSIVE_BATTERY_MANUFACTURERS = [
  'xiaomi', 'redmi', 'poco',  // Xiaomi family
  'huawei', 'honor',          // Huawei family
  'oppo', 'realme', 'oneplus', // OPPO family
  'vivo', 'iqoo',             // Vivo family
  'samsung',                  // Samsung
  'meizu',                    // Meizu
  'asus',                     // Asus
];

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const { 
    trackingStatus, 
    setTrackingStatus, 
    backgroundTrackingEnabled, 
    setBackgroundTrackingEnabled,
    setCurrentLocation
  } = useLocationStore();
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [isForegroundActive, setIsForegroundActive] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({
    manufacturer: null as string | null,
    needsBatteryOptimization: false,
    isIOS: Platform.OS === 'ios',
    isAndroid: Platform.OS === 'android'
  });
  
  // Initialize tracking on app start
  useEffect(() => {
    const initializeTracking = async () => {
      try {
        console.log('Initializing tracking context...');
        
        // Check stored settings
        const storedTracking = await AsyncStorage.getItem('backgroundTrackingEnabled');
        const storedTrackingStatus = await AsyncStorage.getItem('trackingStatus');
        
        // Restore tracking status from storage
        if (storedTrackingStatus === TrackingStatus.ACTIVE) {
          setTrackingStatus(TrackingStatus.ACTIVE);
        }
        
        if (storedTracking === 'true') {
          console.log('Background tracking was previously enabled, restoring state');
          setBackgroundTrackingEnabled(true);
          
          // Check if background tracking is actually active
          const isActive = await isBackgroundLocationTrackingActive();
          
          if (isActive) {
            console.log('Background tracking task is already active');
            setTrackingStatus(TrackingStatus.ACTIVE);
            
            // Try to get last stored location
            const lastLocationStr = await AsyncStorage.getItem('lastLocation');
            if (lastLocationStr) {
              try {
                const lastLocation = JSON.parse(lastLocationStr);
                setCurrentLocation({
                  latitude: lastLocation.latitude,
                  longitude: lastLocation.longitude,
                  accuracy: lastLocation.accuracy,
                  altitude: lastLocation.altitude,
                  altitudeAccuracy: lastLocation.altitudeAccuracy || null,
                  heading: lastLocation.heading,
                  speed: lastLocation.speed,
                  coords: {
                    latitude: lastLocation.latitude,
                    longitude: lastLocation.longitude,
                    accuracy: lastLocation.accuracy,
                    altitude: lastLocation.altitude,
                    altitudeAccuracy: lastLocation.altitudeAccuracy || null,
                    heading: lastLocation.heading,
                    speed: lastLocation.speed,
                  },
                  timestamp: lastLocation.timestamp,
                  batteryLevel: lastLocation.batteryLevel,
                  isMoving: lastLocation.isMoving,
                });
                console.log('Last location restored from storage');
              } catch (error) {
                console.error('Failed to parse last location from storage:', error);
              }
            }
          } else {
            // Background tracking should be active but isn't - restart it
            console.log('Background tracking should be active but is not, restarting...');
            const success = await restartBackgroundTracking();
            if (success) {
              console.log('Successfully restarted background tracking');
            } else {
              console.error('Failed to restart background tracking');
            }
          }
        }
        
        setIsInitialized(true);
        console.log('Tracking context initialized');
        
        // Emit initialization event
        EventEmitter.emit('trackingContextInitialized', { 
          isBackgroundEnabled: backgroundTrackingEnabled,
          trackingStatus
        });
      } catch (error) {
        console.error('Error initializing tracking context:', error);
        setIsInitialized(true); // Still mark as initialized to avoid blocking the app
      }
    };
    
    initializeTracking();
    
    // Monitor app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);
  
  // Get device info on mount
  useEffect(() => {
    const getDeviceInfo = async () => {
      try {
        // Get device manufacturer
        const deviceManufacturer = Device.manufacturer || Device.brand || null;
        
        // Check if device is from a manufacturer known for aggressive battery optimization
        const needsOptimization = deviceManufacturer 
          ? AGGRESSIVE_BATTERY_MANUFACTURERS.some(m => 
              deviceManufacturer.toLowerCase().includes(m.toLowerCase())
            )
          : false;
        
        setDeviceInfo({
          manufacturer: deviceManufacturer,
          needsBatteryOptimization: needsOptimization,
          isIOS: Platform.OS === 'ios',
          isAndroid: Platform.OS === 'android'
        });
        
        console.log(`Device info: ${deviceManufacturer}, needs optimization: ${needsOptimization}`);
      } catch (error) {
        console.error('Error getting device info:', error);
      }
    };
    
    getDeviceInfo();
  }, []);
  
  // Add iOS-specific initialization
  useEffect(() => {
    const setupiOSTracking = async () => {
      if (Platform.OS !== 'ios') return;
      
      try {
        // iOS requires separate handling for accurate background tracking
        const { status } = await Location.getBackgroundPermissionsAsync();
        
        if (status === 'granted') {
          // Enable significant location changes - iOS specific
          // This helps iOS wake up the app when significant location changes occur
          try {
            // Only call this on actual devices, not in simulator
            if (!(await Device.isDevice)) {
              console.log('Running in iOS simulator - skipping significant location changes');
              return;
            }
            
            console.log('Setting up iOS significant location changes');
            
            // First stop any existing significant location changes
            await Location.stopLocationUpdatesAsync('ios-significant-change').catch(() => {
              // Ignore errors if the task wasn't running
            });
            
            // Define the task if not already defined
            if (!TaskManager.isTaskDefined('ios-significant-change')) {
              TaskManager.defineTask('ios-significant-change', async ({ data, error }) => {
                if (error) {
                  console.error('iOS significant location changes error:', error);
                  return;
                }
                
                if (!data) return;
                
                const { locations } = data as { locations: Location.LocationObject[] };
                if (!locations || locations.length === 0) return;
                
                console.log('iOS significant location change detected');
                
                // Check if background tracking should be active
                const isEnabled = await AsyncStorage.getItem('backgroundTrackingEnabled');
                if (isEnabled !== 'true') return;
                
                // Check if task is active, restart if needed
                const isActive = await isBackgroundLocationTrackingActive();
                if (!isActive) {
                  console.log('Restarting background tracking from iOS significant change');
                  
                  // Get stored config or use defaults
                  const configStr = await AsyncStorage.getItem('trackingConfig');
                  const config = configStr ? JSON.parse(configStr) : {
                    timeInterval: 30000,
                    distanceInterval: 10,
                    accuracy: Location.Accuracy.Balanced
                  };
                  
                  await startBackgroundLocationTracking(config);
                }
              });
            }
            
            // Start the significant location change task
            await Location.startLocationUpdatesAsync('ios-significant-change', {
              accuracy: Location.Accuracy.Balanced,
              showsBackgroundLocationIndicator: true,
              activityType: Location.ActivityType.AutomotiveNavigation,
              pausesUpdatesAutomatically: false
            });
            
            console.log('iOS significant location changes enabled');
          } catch (error) {
            console.error('Error setting up iOS significant location changes:', error);
          }
        }
      } catch (error) {
        console.error('Error in iOS specific setup:', error);
      }
    };
    
    setupiOSTracking();
    
    // Clean up iOS-specific tracking on unmount
    return () => {
      if (Platform.OS === 'ios') {
        Location.stopLocationUpdatesAsync('ios-significant-change').catch(() => {
          // Ignore errors if the task wasn't running
        });
      }
    };
  }, []);
  
  // Modify handleAppStateChange to include platform-specific behavior
  const handleAppStateChange = useCallback(async (nextAppState: string) => {
    console.log(`App state changed: ${nextAppState}`);
    
    if (nextAppState === 'active') {
      // App came to foreground
      setIsForegroundActive(true);
      
      // Check if tracking should be active
      const storedTrackingStatus = await AsyncStorage.getItem('trackingStatus');
      
      if (storedTrackingStatus === TrackingStatus.ACTIVE) {
        // Check if background tracking should be active
        if (backgroundTrackingEnabled) {
          const isActive = await checkTrackingStatus();
          
          if (!isActive) {
            console.log('Background tracking should be active but is not, restarting');
            await restartBackgroundTracking();
          } else {
            console.log('Background tracking is active as expected');
          }
        }
      }
      
      // Android-specific: check for battery optimization on each foreground
      if (Platform.OS === 'android' && deviceInfo.needsBatteryOptimization) {
        // Check when we last prompted
        const lastPrompt = await AsyncStorage.getItem('last_battery_optimization_prompt');
        const now = Date.now();
        
        // Only prompt once a week
        if (!lastPrompt || (now - parseInt(lastPrompt)) > 7 * 24 * 60 * 60 * 1000) {
          const hasAsked = await BatteryOptimizationHelper.hasAskedForBatteryOptimization();
          
          if (!hasAsked) {
            // Show reminder to disable battery optimization
            setTimeout(async () => {
              await BatteryOptimizationHelper.promptForBatteryOptimizationDisable();
              await AsyncStorage.setItem('last_battery_optimization_prompt', now.toString());
            }, 5000); // Delay to not interrupt app startup
          }
        }
      }
    } else if (nextAppState.match(/inactive|background/)) {
      // App went to background
      setIsForegroundActive(false);
      
      // Check if tracking is active, ensure background tracking is enabled if needed
      if (trackingStatus === TrackingStatus.ACTIVE && backgroundTrackingEnabled) {
        const isActive = await isBackgroundLocationTrackingActive();
        
        if (!isActive) {
          console.log('Activating background tracking before app goes to background');
          
          // Get stored config or use defaults
          const configStr = await AsyncStorage.getItem('trackingConfig');
          const config = configStr ? JSON.parse(configStr) : {
            timeInterval: 30000,
            distanceInterval: 10,
            accuracy: Location.Accuracy.Balanced
          };
          
          await startBackgroundLocationTracking(config);
        }
      }
      
      // iOS-specific: restart significant changes tracking when going to background
      if (Platform.OS === 'ios' && trackingStatus === TrackingStatus.ACTIVE) {
        const { status } = await Location.getBackgroundPermissionsAsync();
        
        if (status === 'granted') {
          try {
            // Restart significant changes to ensure it's running
            await Location.stopLocationUpdatesAsync('ios-significant-change').catch(() => {});
            
            await Location.startLocationUpdatesAsync('ios-significant-change', {
              accuracy: Location.Accuracy.Balanced,
              showsBackgroundLocationIndicator: true,
              activityType: Location.ActivityType.AutomotiveNavigation,
              pausesUpdatesAutomatically: false
            });
            
            console.log('iOS significant location changes restarted for background mode');
          } catch (error) {
            console.error('Error restarting iOS significant location changes:', error);
          }
        }
      }
    }
  }, [trackingStatus, backgroundTrackingEnabled, deviceInfo]);
  
  const checkTrackingStatus = useCallback(async (): Promise<boolean> => {
    try {
      // Check if background task is registered and active
      const isActive = await isBackgroundLocationTrackingActive();
      console.log(`Background tracking active: ${isActive}`);

      // Check if tracking task exists
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      console.log(`Background task registered: ${isTaskRegistered}`);
      
      // Check permissions status as well
      const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
      const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
      
      console.log(`Background permission status: ${bgStatus}, Foreground permission status: ${fgStatus}`);
      
      // Also verify location services
      const locationServicesEnabled = await Location.hasServicesEnabledAsync();
      console.log(`Location services enabled: ${locationServicesEnabled}`);

      // Only return true if all conditions are met
      const fullyActive = isActive && isTaskRegistered && locationServicesEnabled;
      
      if (!fullyActive) {
        console.warn('Background tracking is only partially active or inactive');
        
        // Find the specific issue for better diagnostics
        if (!isTaskRegistered) {
          console.warn('Task is not registered in TaskManager');
        } else if (!isActive) {
          console.warn('Task is registered but location updates are not active');
        } else if (!locationServicesEnabled) {
          console.warn('Location services are disabled on the device');
        }
      }
      
      return fullyActive;
    } catch (error) {
      console.error('Error checking tracking status:', error);
      return false;
    }
  }, []);
  
  // Add configureAdaptiveTracking function
  const configureAdaptiveTracking = useCallback(async (options: {
    battery: boolean;
    activity: boolean;
    stationary: boolean;
  }): Promise<boolean> => {
    try {
      await toggleAdaptiveTracking('battery', options.battery);
      await toggleAdaptiveTracking('activity', options.activity);
      await toggleAdaptiveTracking('stationary', options.stationary);
      
      console.log(`Adaptive tracking configured: battery=${options.battery}, activity=${options.activity}, stationary=${options.stationary}`);
      return true;
    } catch (error) {
      console.error('Error configuring adaptive tracking:', error);
      return false;
    }
  }, []);
  
  // Add openBatterySettings function for manufacturer-specific battery settings
  const openBatterySettings = useCallback(async (): Promise<void> => {
    // Check for Android
    if (Platform.OS !== 'android') {
      Alert.alert(
        'Not Supported',
        'Battery optimization settings are only available on Android devices.'
      );
      return;
    }
    
    // Use the BatteryOptimizationHelper
    await BatteryOptimizationHelper.promptForBatteryOptimizationDisable();
  }, []);
  
  // Modify restartBackgroundTracking for platform-specific improvements
  const restartBackgroundTracking = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Attempting to restart background tracking...');
      
      // First check if task is already running, stop it if needed
      const isActive = await isBackgroundLocationTrackingActive();
      if (isActive) {
        console.log('Stopping current background tracking session before restart');
        await stopBackgroundLocationTracking();
        
        // Small delay to ensure everything is cleaned up
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // For Android, check battery optimization
      if (Platform.OS === 'android') {
        if (deviceInfo.needsBatteryOptimization) {
          // For device manufacturers with aggressive battery optimization, show an alert
          const hasAsked = await BatteryOptimizationHelper.hasAskedForBatteryOptimization();
          
          if (!hasAsked) {
            await BatteryOptimizationHelper.promptForBatteryOptimizationDisable();
          }
        } else {
          // For standard Android devices, just check normally
          await BatteryOptimizationHelper.promptForBatteryOptimizationDisable();
        }
      }
      
      // Check necessary permissions before starting
      const { status: bgPermission } = await Location.getBackgroundPermissionsAsync();
      if (bgPermission !== 'granted') {
        console.warn('Background location permission not granted, requesting...');
        const { status } = await Location.requestBackgroundPermissionsAsync();
        if (status !== 'granted') {
          console.error('Background location permission denied after request');
          return false;
        }
      }
      
      // For iOS, ensure both background and foreground permissions
      if (Platform.OS === 'ios') {
        const { status: fgPermission } = await Location.getForegroundPermissionsAsync();
        if (fgPermission !== 'granted') {
          console.warn('Foreground location permission not granted, requesting...');
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            console.error('Foreground location permission denied after request');
            return false;
          }
        }
      }
      
      // Try multiple times with dynamic timeouts
      let success = false;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!success && attempts < maxAttempts) {
        attempts++;
        
        try {
          // Start background tracking with slightly different settings for each attempt
          success = await startBackgroundLocationTracking({
            timeInterval: 30000 - (attempts * 1000), // Slightly decrease interval with each attempt
            distanceInterval: 10,
            accuracy: attempts === 3 
              ? Location.Accuracy.BestForNavigation 
              : Location.Accuracy.Balanced
          });
          
          if (success) {
            console.log(`Background tracking restarted successfully (attempt ${attempts})`);
            
            // Verify that it's actually running
            const isRunning = await isBackgroundLocationTrackingActive();
            if (!isRunning) {
              console.warn('Background tracking appeared to start but is not active, retry');
              success = false;
            }
          }
        } catch (attemptError) {
          console.error(`Error in restart attempt ${attempts}:`, attemptError);
        }
        
        if (!success && attempts < maxAttempts) {
          console.log(`Waiting before retry ${attempts+1} of ${maxAttempts}...`);
          await new Promise(resolve => setTimeout(resolve, attempts * 500)); // Increasing delay
        }
      }
      
      if (success) {
        console.log('Background tracking restarted successfully');
        setTrackingStatus(TrackingStatus.ACTIVE);
        await AsyncStorage.setItem('trackingStatus', TrackingStatus.ACTIVE);
        
        // Update tracking state in storage for persistence
        await AsyncStorage.setItem('backgroundTrackingEnabled', 'true');
        
        // Generate new session ID if needed
        const sessionId = await AsyncStorage.getItem('trackingSessionId');
        if (!sessionId) {
          const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          await AsyncStorage.setItem('trackingSessionId', newSessionId);
        }
        
        // Emit event that tracking was restarted
        EventEmitter.emit('backgroundTrackingRestarted');
        
        return true;
      } else {
        console.error(`Failed to restart background tracking after ${maxAttempts} attempts`);
        return false;
      }
    } catch (error) {
      console.error('Error restarting background tracking:', error);
      return false;
    }
  }, [deviceInfo]);
  
  const toggleBackgroundTracking = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      if (enabled) {
        // Enable background tracking
        const success = await startBackgroundLocationTracking({
          timeInterval: 30000,
          distanceInterval: 10,
          accuracy: Location.Accuracy.Balanced
        });
        
        if (success) {
          setBackgroundTrackingEnabled(true);
          await AsyncStorage.setItem('backgroundTrackingEnabled', 'true');
          
          // If we're currently tracking, update the status
          if (trackingStatus === TrackingStatus.ACTIVE) {
            await AsyncStorage.setItem('trackingStatus', TrackingStatus.ACTIVE);
          }
          
          console.log('Background tracking enabled successfully');
          return true;
        } else {
          console.error('Failed to enable background tracking');
          return false;
        }
      } else {
        // Disable background tracking
        const success = await stopBackgroundLocationTracking();
        
        if (success) {
          setBackgroundTrackingEnabled(false);
          await AsyncStorage.setItem('backgroundTrackingEnabled', 'false');
          console.log('Background tracking disabled successfully');
          return true;
        } else {
          console.error('Failed to disable background tracking');
          return false;
        }
      }
    } catch (error) {
      console.error('Error toggling background tracking:', error);
      return false;
    }
  }, [trackingStatus, setBackgroundTrackingEnabled]);
  
  return (
    <TrackingContext.Provider 
      value={{ 
        isInitialized,
        checkTrackingStatus,
        restartBackgroundTracking,
        toggleBackgroundTracking,
        isForegroundActive,
        configureAdaptiveTracking,
        openBatterySettings,
        deviceInfo
      }}
    >
      {children}
    </TrackingContext.Provider>
  );
}

export const useTracking = () => useContext(TrackingContext); 