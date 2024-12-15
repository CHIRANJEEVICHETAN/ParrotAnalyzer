import { Stack } from 'expo-router';
import { View } from 'react-native';
import '../global.css';
import AuthContext from './context/AuthContext';
import ThemeContext from './context/ThemeContext';

export default function RootLayout() {
  return (
    <ThemeContext.ThemeProvider>
      <AuthContext.AuthProvider>
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
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
          </Stack>
        </View>
      </AuthContext.AuthProvider>
    </ThemeContext.ThemeProvider>
  );
}