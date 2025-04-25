import { useColorScheme as useNativeColorScheme } from 'react-native';
import ThemeContextDefault from '../context/ThemeContext';

type ColorSchemeType = 'light' | 'dark';

/**
 * Hook to get the current color scheme (dark or light mode).
 * First checks if there's a user-selected theme in ThemeContext,
 * If not, falls back to the system color scheme.
 */
export function useColorScheme(): ColorSchemeType {
  const { useTheme } = ThemeContextDefault;
  const { theme } = useTheme();
  const systemColorScheme = useNativeColorScheme() as ColorSchemeType;
  
  // If theme context is available, use it; otherwise fall back to system
  return theme || systemColorScheme || 'light';
}

/**
 * Returns the appropriate color value based on the current theme.
 * 
 * @param lightColor - Color to use in light mode
 * @param darkColor - Color to use in dark mode
 * @returns The appropriate color based on the current theme
 */
export function useThemeColor(
  lightColor: string,
  darkColor: string
): string {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkColor : lightColor;
}

export default useColorScheme; 