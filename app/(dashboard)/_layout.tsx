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
      {/* Remove explicit route definitions - let file structure handle routing */}
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