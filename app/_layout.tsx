import { Stack } from 'expo-router';
import '../global.css';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { BACKGROUND_LOCATION_TASK } from '../app/utils/backgroundLocationTask';
import { sendHttpBatch } from '../app/utils/httpBatchManager';
import { createEnhancedLocation } from '../app/utils/locationUtils';
import EventEmitter from '../app/utils/EventEmitter';
import AuthContext from './context/AuthContext';
import ThemeContext from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { TrackingProvider } from './context/TrackingContext';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from 'react';
import Constants from 'expo-constants';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Define background task at app initialization
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background task error:', error);
    await AsyncStorage.setItem('lastTrackingError', JSON.stringify({
      message: error.message,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  if (!data) {
    console.warn('No data received in background task');
    return;
  }
  
  try {
    const { locations } = data as { locations: Location.LocationObject[] };
    console.log(`Background task received ${locations.length} locations`);
    
    // Get auth token
    const token = await AsyncStorage.getItem('accessToken');
    
    // Get user data
    const userDataStr = await AsyncStorage.getItem('user_data');
    const userData = userDataStr ? JSON.parse(userDataStr) : null;
    
    if (!token || !userData) {
      console.warn('No auth token or user data available, cannot send location updates');
      return;
    }
    
    // Process each location
    for (const location of locations) {
      // Store the latest location for UI updates
      await AsyncStorage.setItem('lastLocation', JSON.stringify({
        ...createEnhancedLocation(location),
        timestamp: new Date().toISOString()
      }));
      
      // Send location update via HTTP
      const locationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: location.timestamp,
        isBackground: true,
        userId: userData.id,
        sessionId: await AsyncStorage.getItem('trackingSessionId')
      };
      
      // Get API endpoint
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 
                   Constants.expoConfig?.extra?.apiUrl || 
                   'http://localhost:8080';
      
      // Send the update via HTTP
      await sendHttpBatch(
        `${apiUrl}/api/employee-tracking/update`,
        locationData,
        token
      );
    }
    
    // Emit event that locations were processed
    EventEmitter.emit('backgroundLocationsProcessed', { count: locations.length });
  } catch (err: any) {
    console.error('Error processing background location:', err);
    await AsyncStorage.setItem('lastTrackingError', JSON.stringify({
      message: err.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }));
  }
});

export default function RootLayout() {
  // Initialize location store when app starts
  useEffect(() => {
    // Check for necessary permissions
    const checkPermissions = async () => {
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
      const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
      
      console.log(`Location permissions - Foreground: ${foregroundStatus}, Background: ${backgroundStatus}`);
    };
    
    checkPermissions();
  }, []);
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeContext.ThemeProvider>
        <AuthContext.AuthProvider>
          <NotificationProvider>
            <TrackingProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "fade",
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
  );
}