import { Stack } from 'expo-router';
import ThemeContext from '../context/ThemeContext';

export default function AuthLayout() {
  const { theme } = ThemeContext.useTheme();
  
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        contentStyle: {
          backgroundColor: theme === 'dark' ? '#111827' : '#ffffff'
        }
      }}
    />
  );
}