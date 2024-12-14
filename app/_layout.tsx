import { Slot } from 'expo-router';
import { View } from 'react-native';
import '../global.css';
import AuthContext from './context/AuthContext';
import ThemeContext from './context/ThemeContext';

export default function RootLayout() {
  return (
    <ThemeContext.ThemeProvider>
      <AuthContext.AuthProvider>
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
      </AuthContext.AuthProvider>
    </ThemeContext.ThemeProvider>
  );
}