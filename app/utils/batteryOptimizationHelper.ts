import { Alert, Linking, Platform } from 'react-native';
import { openSettings } from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BATTERY_OPT_ASKED_KEY = 'battery_optimization_asked';

/**
 * Utility to help handle battery optimization settings for Android
 * to ensure background tracking works reliably
 */
export default class BatteryOptimizationHelper {
  /**
   * Show a dialog prompting the user to disable battery optimization
   * for the app (Android only)
   */
  static async promptForBatteryOptimizationDisable(): Promise<boolean> {
    // Only relevant for Android
    if (Platform.OS !== 'android') {
      return true;
    }
    
    try {
      // Check if we've already asked
      const hasAsked = await AsyncStorage.getItem(BATTERY_OPT_ASKED_KEY);
      if (hasAsked === 'true') {
        return true;
      }
      
      return new Promise((resolve) => {
        Alert.alert(
          'Improve Background Tracking',
          'For reliable background location tracking, please disable battery optimization for this app in your device settings.',
          [
            {
              text: 'Not Now',
              onPress: () => {
                AsyncStorage.setItem(BATTERY_OPT_ASKED_KEY, 'true');
                resolve(false);
              },
              style: 'cancel',
            },
            {
              text: 'Open Settings',
              onPress: async () => {
                try {
                  // Try to open battery optimization settings directly
                  await Linking.openSettings();
                  AsyncStorage.setItem(BATTERY_OPT_ASKED_KEY, 'true');
                  resolve(true);
                } catch (error) {
                  console.error('Error opening battery settings:', error);
                  resolve(false);
                }
              },
            },
          ],
          { cancelable: false }
        );
      });
    } catch (error) {
      console.error('Error checking battery optimization status:', error);
      return false;
    }
  }
  
  /**
   * Reset the flag to show battery optimization dialog again
   */
  static async resetBatteryOptimizationPrompt(): Promise<void> {
    await AsyncStorage.removeItem(BATTERY_OPT_ASKED_KEY);
  }
  
  /**
   * Check if we've already asked the user about battery optimization
   */
  static async hasAskedForBatteryOptimization(): Promise<boolean> {
    try {
      const hasAsked = await AsyncStorage.getItem(BATTERY_OPT_ASKED_KEY);
      return hasAsked === 'true';
    } catch (error) {
      console.error('Error checking if battery optimization was asked:', error);
      return false;
    }
  }
} 