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
        },
        animation: 'fade'
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="employee" 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="Group-Admin" 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="management" 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="super-admin" 
        options={{ headerShown: false }} 
      />
      
      <Stack.Screen 
        name="management/group-admin-management" 
        options={{
          headerShown: true,
          title: 'Group Admin Management',
          headerTintColor: theme === 'dark' ? '#F9FAFB' : '#111827',
          headerStyle: {
            backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
          },
          headerShadowVisible: false,
          presentation: 'modal',
          animation: 'slide_from_right'
        }}
      />
    </Stack>
  );
}