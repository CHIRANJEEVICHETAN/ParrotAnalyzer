import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';

/**
 * Initialize Sentry with additional context information
 */
export const initSentry = () => {
  // Only initialize if DSN is available
  if (!Constants.expoConfig?.extra?.sentryDsn) {
    console.log('Sentry DSN not available, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: Constants.expoConfig.extra.sentryDsn,
    debug: __DEV__,
    enabled: !__DEV__, // Disable in development by default
    tracesSampleRate: 0.2, // Capture 20% of transactions
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000, // 30 seconds
  });

  // Add device context
  addDeviceContext();
};

/**
 * Add device and app context to Sentry
 */
const addDeviceContext = async () => {
  try {
    // Add device info
    Sentry.setTag('platform', Platform.OS);
    Sentry.setTag('platformVersion', Platform.Version.toString());
    
    if (Platform.OS !== 'web') {
      const deviceType = Device.DeviceType[await Device.getDeviceTypeAsync()];
      
      Sentry.setTag('deviceName', Device.modelName || 'unknown');
      Sentry.setTag('deviceType', deviceType);
      Sentry.setTag('deviceBrand', Device.brand);
      Sentry.setTag('deviceModel', Device.modelName);
      
      // App info
      Sentry.setTag('appVersion', Application.nativeApplicationVersion);
      Sentry.setTag('appBuild', Application.nativeBuildVersion);
    }
    
    // Expo info
    if (typeof Constants.expoConfig?.runtimeVersion === 'string') {
      Sentry.setTag('expoRuntimeVersion', Constants.expoConfig.runtimeVersion);
    }
    Sentry.setTag('expoSdkVersion', Constants.expoConfig?.sdkVersion || 'unknown');
    
    // Add user agent for web
    if (Platform.OS === 'web' && navigator.userAgent) {
      Sentry.setTag('userAgent', navigator.userAgent);
    }
  } catch (error) {
    console.error('Error setting Sentry context:', error);
  }
};

/**
 * Report an error to Sentry
 * @param error Error object
 * @param context Additional context information
 */
export const reportError = (error: Error, context?: Record<string, any>) => {
  if (!Constants.expoConfig?.extra?.sentryDsn) {
    console.error('Error:', error);
    return;
  }
  
  try {
    if (context) {
      Sentry.setContext('errorContext', context);
    }
    
    Sentry.captureException(error);
  } catch (sentryError) {
    console.error('Error reporting to Sentry:', sentryError);
    console.error('Original error:', error);
  }
};

/**
 * Report a message to Sentry
 * @param message Message to report
 * @param level Severity level
 * @param context Additional context information
 */
export const reportMessage = (
  message: string, 
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>
) => {
  if (!Constants.expoConfig?.extra?.sentryDsn) {
    console.log(`[${level}] ${message}`);
    return;
  }
  
  try {
    if (context) {
      Sentry.setContext('messageContext', context);
    }
    
    Sentry.captureMessage(message, level);
  } catch (sentryError) {
    console.error('Error reporting to Sentry:', sentryError);
    console.log(`[${level}] ${message}`);
  }
};

/**
 * Set user information in Sentry
 * @param user User information
 */
export const setUserContext = (user: {
  id?: string;
  email?: string;
  username?: string;
  [key: string]: any;
}) => {
  if (!Constants.expoConfig?.extra?.sentryDsn) return;
  
  try {
    Sentry.setUser(user);
  } catch (error) {
    console.error('Error setting user context:', error);
  }
};

/**
 * Clear user information from Sentry
 */
export const clearUserContext = () => {
  if (!Constants.expoConfig?.extra?.sentryDsn) return;
  
  try {
    Sentry.setUser(null);
  } catch (error) {
    console.error('Error clearing user context:', error);
  }
};

export default {
  initSentry,
  reportError,
  reportMessage,
  setUserContext,
  clearUserContext,
}; 