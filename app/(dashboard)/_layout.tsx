import { Stack } from 'expo-router';
import ThemeContext from './../context/ThemeContext';

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
      <Stack.Screen name="Group-Admin" />
      <Stack.Screen name="management" />
      <Stack.Screen name="super-admin" />
      
      <Stack.Screen name="employee/employee" />
      <Stack.Screen name="employee/employeeExpenses" />
      <Stack.Screen name="employee/employeeLeave" />
      <Stack.Screen name="employee/employeeSchedule" />
      <Stack.Screen name="employee/employeeSettings" />
      <Stack.Screen name="employee/employeeShiftTracker" />
      <Stack.Screen name="employee/notifications" />
      <Stack.Screen name="employee/profile" />
      
      <Stack.Screen name="Group-Admin/group-admin" />
      <Stack.Screen name="Group-Admin/settings" />
      
      <Stack.Screen name="management/analytics" />
      <Stack.Screen name="management/approvals" />
      <Stack.Screen name="management/management" />
      <Stack.Screen name="management/profile" />
      <Stack.Screen name="management/settings" />
      
      <Stack.Screen name="super-admin/create-user" />
      <Stack.Screen name="super-admin/reports" />
      <Stack.Screen name="super-admin/security" />
      <Stack.Screen name="super-admin/settings" />
      <Stack.Screen name="super-admin/super-admin" />
      <Stack.Screen name="super-admin/system-config" />
    </Stack>
  );
} 