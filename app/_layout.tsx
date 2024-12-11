import { Slot } from 'expo-router';
import ThemeContext from './context/ThemeContext';
import AuthContext from './context/AuthContext';
import { View } from 'react-native';
import '../global.css';

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