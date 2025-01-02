import { Platform, StatusBar } from 'react-native';

export const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight ?? 19) + 10;
export const getHeaderPaddingTop = () => {
  return Platform.OS === 'ios' ? STATUSBAR_HEIGHT : STATUSBAR_HEIGHT;
}; 