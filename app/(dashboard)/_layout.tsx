import { Stack } from 'expo-router';
import ThemeContext from '../context/ThemeContext';

export default function DashboardLayout() {
  const { theme } = ThemeContext.useTheme();

  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        contentStyle: {
          backgroundColor: theme === 'dark' ? '#111827' : '#ffffff'
        }
      }}
    >
      <Stack.Screen name="employee" />
      <Stack.Screen name="group-admin" />
      <Stack.Screen name="management" />
      <Stack.Screen name="super-admin" />
    </Stack>
  );
} 