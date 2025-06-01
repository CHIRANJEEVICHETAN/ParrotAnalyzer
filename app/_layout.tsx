import { Stack } from 'expo-router';
import '../global.css';
import * as Location from 'expo-location';
import AuthContext from './context/AuthContext';
import ThemeContext from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { TrackingProvider } from './context/TrackingContext';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Note: The background location task is defined in app/utils/backgroundLocationTask.ts
// We don't define it here to avoid duplicate task definitions which can cause issues

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