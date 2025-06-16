import React, { useEffect, useState } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ThemeContext from './context/ThemeContext';
import AuthContext from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { logStorageState } from './utils/tokenDebugger';
import errorReporting from './utils/errorReporting';
import '../global.css';
import * as Location from 'expo-location';
import { NotificationProvider } from './context/NotificationContext';
import { TrackingProvider } from './context/TrackingContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Network from 'expo-network';

// Note: The background location task is defined in app/utils/backgroundLocationTask.ts
// We don't define it here to avoid duplicate task definitions which can cause issues

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Initialize Sentry for error reporting
errorReporting.initSentry();

// Simple component to hide splash screen after authentication is ready
function SplashScreenController() {
  const { isLoading } = AuthContext.useAuth();
  
  // Hide splash screen once auth loading is done
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(err => {
        console.warn('Error hiding splash screen:', err);
      });
    }
  }, [isLoading]);
  
  return null;
}

// Handle unhandled JS promise rejections
const handlePromiseRejection = (event: PromiseRejectionEvent) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  // Log to Sentry
  errorReporting.reportError(
    event.reason instanceof Error ? event.reason : new Error(String(event.reason)), 
    { type: 'unhandled_promise_rejection' }
  );
};

// Handle global errors
const handleGlobalError = (event: ErrorEvent) => {
  console.error('Global error:', event.error);
  
  // Log to Sentry
  errorReporting.reportError(
    event.error instanceof Error ? event.error : new Error(String(event.error)),
    { type: 'global_error' }
  );
};

function RootLayout() {
  const [networkStatus, setNetworkStatus] = useState({
    isConnected: true,
    isInternetReachable: true 
  });
  
  // Set up network monitoring
  useEffect(() => {
    const checkNetworkConnectivity = async () => {
      try {
        const status = await Network.getNetworkStateAsync();
        setNetworkStatus({
          isConnected: !!status.isConnected,
          isInternetReachable: !!status.isInternetReachable
        });
      } catch (error) {
        console.error("Error checking network connectivity:", error);
      }
    };
    
    // Check network on mount and app state changes
    checkNetworkConnectivity();
    
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        checkNetworkConnectivity();
      }
    });
    
    // Check network status periodically
    const intervalId = setInterval(() => {
      checkNetworkConnectivity();
    }, 30000); // every 30 seconds
    
    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, []);
  
  // Set up global error handlers
  useEffect(() => {
    if (Platform.OS === 'web') {
      window.addEventListener('unhandledrejection', handlePromiseRejection);
      window.addEventListener('error', handleGlobalError);
      
      return () => {
        window.removeEventListener('unhandledrejection', handlePromiseRejection);
        window.removeEventListener('error', handleGlobalError);
      };
    }
    
    // Debug token storage on app start (only in dev)
    if (__DEV__) {
      logStorageState().catch(err => console.error('Failed to log storage state:', err));
    }
  }, []);
  
  // Error handler for the ErrorBoundary
  const handleError = (error: Error) => {
    console.error('Application error caught by root ErrorBoundary:', error);
    
    // Log to Sentry
    errorReporting.reportError(error, { 
      source: 'ErrorBoundary',
      component: 'RootLayout',
      networkStatus: `${networkStatus.isConnected ? 'Connected' : 'Disconnected'}, Internet: ${networkStatus.isInternetReachable ? 'Reachable' : 'Unreachable'}`
    });
  };

  // Initialize location store when app starts
  useEffect(() => {
    const initLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Location permission denied');
        }
      } catch (error) {
        console.error('Error initializing location:', error);
      }
    };

    initLocation();
  }, []);
    
  return (
    <ErrorBoundary onError={handleError}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeContext.ThemeProvider>
          <AuthContext.AuthProvider>
            <SplashScreenController />
            <NotificationProvider>
              <TrackingProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                  }}
                >
                  <Stack.Screen
                    name="index"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="welcome"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="(auth)"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="(dashboard)"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="(dashboard)/employee/notifications"
                    options={{
                      title: "Notifications",
                    }}
                  />
                  <Stack.Screen
                    name="(dashboard)/Group-Admin/notifications"
                    options={{
                      title: "Notifications",
                    }}
                  />
                  <Stack.Screen
                    name="(dashboard)/management/notifications"
                    options={{
                      title: "Notifications",
                    }}
                  />
                  <Stack.Screen
                    name="(dashboard)/test-notifications"
                    options={{
                      title: "Test Notifications",
                    }}
                  />
                </Stack>
              </TrackingProvider>
            </NotificationProvider>
          </AuthContext.AuthProvider>
        </ThemeContext.ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);