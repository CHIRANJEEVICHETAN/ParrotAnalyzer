import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme, AppState, AppStateStatus } from 'react-native';

type Theme = 'light' | 'dark';
type ThemePreference = Theme | 'system';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@app_theme';

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Compute the actual theme based on preference and system theme
  const theme: Theme = themePreference === 'system' 
    ? (systemColorScheme || 'light') as Theme 
    : themePreference;

  // Handle app state and system theme changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // When app becomes active, it will automatically trigger a re-render
      // which will get the latest system color scheme
      if (nextAppState === 'active') {
        // Force a re-render by updating state
        setThemePreference(prev => prev);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Watch for system color scheme changes
  useEffect(() => {
    if (themePreference === 'system') {
      // Update theme when system colors change
      setThemePreference('system');
    }
  }, [systemColorScheme]);

  // Load saved theme when app starts
  useEffect(() => {
    loadSavedTheme();
  }, []);

  const loadSavedTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme) {
        setThemePreference(savedTheme as ThemePreference);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    try {
      let newTheme: ThemePreference;
      
      // If current preference is system, switch to explicit light/dark
      if (themePreference === 'system') {
        newTheme = theme === 'light' ? 'dark' : 'light';
      } else {
        // If current preference is light/dark, toggle between them
        newTheme = themePreference === 'light' ? 'dark' : 'light';
      }

      setThemePreference(newTheme);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default {
  ThemeProvider,
  useTheme,
}; 