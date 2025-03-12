import { Stack } from 'expo-router';
import { View } from 'react-native';
import '../global.css';
import AuthContext from './context/AuthContext';
import ThemeContext from './context/ThemeContext';
import { NotificationProvider } from "./context/NotificationContext";

export default function RootLayout() {
  return (
    <ThemeContext.ThemeProvider>
      <AuthContext.AuthProvider>
        <NotificationProvider>
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
        </NotificationProvider>
      </AuthContext.AuthProvider>
    </ThemeContext.ThemeProvider>
  );
}