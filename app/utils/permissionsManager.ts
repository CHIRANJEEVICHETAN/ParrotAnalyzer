import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Platform, Linking, Alert } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';

/**
 * Utility class to manage app permissions
 */
class PermissionsManager {
  /**
   * Check if permissions have been requested previously
   */
  static async havePermissionsBeenRequested(): Promise<boolean> {
    try {
      const permissionsRequested = await AsyncStorage.getItem('permissionsRequested');
      return permissionsRequested === 'true';
    } catch (error) {
      console.error('Error checking if permissions have been requested:', error);
      return false;
    }
  }

  /**
   * Mark permissions as having been requested
   */
  static async markPermissionsAsRequested(): Promise<void> {
    try {
      await AsyncStorage.setItem('permissionsRequested', 'true');
    } catch (error) {
      console.error('Error marking permissions as requested:', error);
    }
  }

  /**
   * Check notification permission status
   */
  static async checkNotificationPermissions(): Promise<'granted' | 'denied' | 'undetermined'> {
    try {
      if (Platform.OS === 'web') {
        if (!('Notification' in window)) {
          return 'denied';
        }
        // Map browser permissions to our format
        const browserPermission = Notification.permission;
        if (browserPermission === 'granted') return 'granted';
        if (browserPermission === 'denied') return 'denied';
        return 'undetermined'; // 'default' in browser terms
      }

      const { status } = await Notifications.getPermissionsAsync();
      return status;
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      return 'undetermined';
    }
  }

  /**
   * Check location permission status
   */
  static async checkLocationPermissions(): Promise<'granted' | 'denied' | 'undetermined'> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status;
    } catch (error) {
      console.error('Error checking location permissions:', error);
      return 'undetermined';
    }
  }

  /**
   * Check background location permission status
   */
  static async checkBackgroundLocationPermissions(): Promise<'granted' | 'denied' | 'undetermined'> {
    try {
      const { status } = await Location.getBackgroundPermissionsAsync();
      return status;
    } catch (error) {
      console.error('Error checking background location permissions:', error);
      return 'undetermined';
    }
  }

  /**
   * Request notification permissions
   */
  static async requestNotificationPermissions(): Promise<'granted' | 'denied'> {
    try {
      if (Platform.OS === 'web') {
        if (!('Notification' in window)) {
          return 'denied';
        }
        const permission = await Notification.requestPermission();
        return permission === 'granted' ? 'granted' : 'denied';
      }

      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted' ? 'granted' : 'denied';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return 'denied';
    }
  }

  /**
   * Request location permissions
   */
  static async requestLocationPermissions(): Promise<'granted' | 'denied'> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted' ? 'granted' : 'denied';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return 'denied';
    }
  }

  /**
   * Request background location permissions (after foreground is granted)
   */
  static async requestBackgroundLocationPermissions(): Promise<'granted' | 'denied'> {
    try {
      // First check if foreground permissions are granted
      const foregroundStatus = await PermissionsManager.checkLocationPermissions();
      
      if (foregroundStatus !== 'granted') {
        console.warn('Foreground location permission must be granted before requesting background location');
        return 'denied';
      }
      
      const { status } = await Location.requestBackgroundPermissionsAsync();
      return status === 'granted' ? 'granted' : 'denied';
    } catch (error) {
      console.error('Error requesting background location permissions:', error);
      return 'denied';
    }
  }

  /**
   * Open app settings to allow the user to manually enable permissions
   */
  static async openAppSettings(): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else if (Platform.OS === 'android') {
        // For Android 9 (Pie) and above
        if (Platform.Version >= 28) {
          const pkg = Constants.expoConfig?.android?.package;
          if (!pkg) {
            console.error('Package name not found');
            return;
          }
          
          await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
            { data: 'package:' + pkg }
          );
        } else {
          // For older Android versions
          await Linking.openSettings();
        }
      } else if (Platform.OS === 'web') {
        Alert.alert(
          'Permission Settings',
          'Please check your browser settings to modify permissions for this website.'
        );
      }
    } catch (error) {
      console.error('Error opening app settings:', error);
      Alert.alert(
        'Cannot Open Settings',
        'Please manually open your device settings and enable permissions for this app.'
      );
    }
  }

  /**
   * Determine if permissions need to be requested from settings
   * This happens when a permission is permanently denied
   */
  static async shouldRequestFromSettings(
    permissionType: 'location' | 'notification'
  ): Promise<boolean> {
    try {
      // Get stored permission request count
      const key = `${permissionType}_request_count`;
      const countStr = await AsyncStorage.getItem(key);
      const count = countStr ? parseInt(countStr) : 0;
      
      // After 2 rejections, suggest settings
      if (count >= 2) {
        return true;
      }
      
      // Increment and store the count
      await AsyncStorage.setItem(key, (count + 1).toString());
      return false;
    } catch (error) {
      console.error(`Error checking if ${permissionType} should be requested from settings:`, error);
      return false;
    }
  }

  /**
   * Initialize notification channel for Android
   */
  static async setupNotificationChannel(): Promise<void> {
    if (Platform.OS === 'android') {
      // Default notification channel
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });

      // High priority notification channel
      await Notifications.setNotificationChannelAsync("high_priority", {
        name: "Urgent Notifications",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250, 250, 250],
        lightColor: "#FF231F7C",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });
    }
  }
}

export default PermissionsManager; 