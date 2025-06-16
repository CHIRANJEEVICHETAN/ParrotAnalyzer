import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

// Constants for storage keys (must match those in AuthContext)
const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_DATA_KEY = 'user_data';

/**
 * Decodes a JWT token without verification
 * @param token The JWT token string
 * @returns The decoded payload or null if invalid
 */
export const decodeToken = (token: string): any => {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

/**
 * Checks if a token has expired
 * @param token The JWT token string
 * @returns True if expired, false if valid, null if error
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    // Compare expiration timestamp with current time
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true; // Consider expired if there's an error
  }
};

/**
 * Gets all tokens from storage and returns them with decoded information
 */
export const getTokenDebugInfo = async () => {
  try {
    // Get tokens from AsyncStorage
    const asyncAccessToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    const asyncRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    
    // Get tokens from SecureStore
    let secureAccessToken = null;
    let secureRefreshToken = null;
    
    try {
      // Only try SecureStore on native platforms
      if (Platform.OS !== 'web') {
        secureAccessToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        secureRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      }
    } catch (error) {
      console.error('Error accessing SecureStore:', error);
    }
    
    // Decode tokens
    const asyncAccessDecoded = asyncAccessToken ? decodeToken(asyncAccessToken) : null;
    const asyncRefreshDecoded = asyncRefreshToken ? decodeToken(asyncRefreshToken) : null;
    const secureAccessDecoded = secureAccessToken ? decodeToken(secureAccessToken) : null;
    const secureRefreshDecoded = secureRefreshToken ? decodeToken(secureRefreshToken) : null;
    
    // Check for mismatches
    const accessTokenMismatch = asyncAccessToken !== secureAccessToken && 
      asyncAccessToken && secureAccessToken;
    const refreshTokenMismatch = asyncRefreshToken !== secureRefreshToken && 
      asyncRefreshToken && secureRefreshToken;
    
    // Check for missing tokens
    const asyncAccessMissing = !asyncAccessToken && !!secureAccessToken;
    const secureAccessMissing = !!asyncAccessToken && !secureAccessToken && Platform.OS !== 'web';
    const asyncRefreshMissing = !asyncRefreshToken && !!secureRefreshToken;
    const secureRefreshMissing = !!asyncRefreshToken && !secureRefreshToken && Platform.OS !== 'web';
    
    // Check if any token is expired
    const asyncAccessExpired = asyncAccessToken ? isTokenExpired(asyncAccessToken) : false;
    const secureAccessExpired = secureAccessToken ? isTokenExpired(secureAccessToken) : false;
    const asyncRefreshExpired = asyncRefreshToken ? isTokenExpired(asyncRefreshToken) : false;
    const secureRefreshExpired = secureRefreshToken ? isTokenExpired(secureRefreshToken) : false;
    
    // Missing refresh token is a critical issue
    const refreshTokenMissing = !asyncRefreshToken && !secureRefreshToken;
    
    return {
      // Token objects with decoded data
      asyncStorage: {
        accessToken: asyncAccessToken ? { 
          token: asyncAccessToken,
          decoded: asyncAccessDecoded,
          expired: asyncAccessExpired 
        } : null,
        refreshToken: asyncRefreshToken ? { 
          token: asyncRefreshToken,
          decoded: asyncRefreshDecoded,
          expired: asyncRefreshExpired 
        } : null,
      },
      secureStore: Platform.OS !== 'web' ? {
        accessToken: secureAccessToken ? { 
          token: secureAccessToken,
          decoded: secureAccessDecoded,
          expired: secureAccessExpired 
        } : null,
        refreshToken: secureRefreshToken ? { 
          token: secureRefreshToken,
          decoded: secureRefreshDecoded,
          expired: secureRefreshExpired 
        } : null,
      } : null,
      // Issues summary
      issues: {
        accessTokenMismatch,
        refreshTokenMismatch,
        asyncAccessMissing,
        secureAccessMissing,
        asyncRefreshMissing,
        secureRefreshMissing,
        asyncAccessExpired,
        secureAccessExpired,
        asyncRefreshExpired, 
        secureRefreshExpired,
        refreshTokenMissing,
      }
    };
  } catch (error) {
    console.error('Error in getTokenDebugInfo:', error);
    return null;
  }
};

/**
 * Shows an alert with token debug information for troubleshooting
 */
export const showTokenDebugAlert = async () => {
  const debugInfo = await getTokenDebugInfo();
  if (!debugInfo) {
    Alert.alert('Error', 'Failed to get token debug information');
    return;
  }

  const { asyncStorage, secureStore, issues } = debugInfo;
  
  let message = 'Token Debug Information:\n\n';
  
  // Access Token Info
  message += 'ACCESS TOKEN:\n';
  message += asyncStorage.accessToken 
    ? `AsyncStorage: Valid (exp: ${new Date(asyncStorage.accessToken.decoded.exp * 1000).toLocaleString()})\n`
    : 'AsyncStorage: Missing\n';
  
  message += secureStore?.accessToken
    ? `SecureStore: Valid (exp: ${new Date(secureStore.accessToken.decoded.exp * 1000).toLocaleString()})\n`
    : 'SecureStore: Missing\n';
  
  // Refresh Token Info
  message += '\nREFRESH TOKEN:\n';
  message += asyncStorage.refreshToken
    ? `AsyncStorage: Valid (exp: ${new Date(asyncStorage.refreshToken.decoded.exp * 1000).toLocaleString()})\n` 
    : 'AsyncStorage: Missing\n';
  
  message += secureStore?.refreshToken
    ? `SecureStore: Valid (exp: ${new Date(secureStore.refreshToken.decoded.exp * 1000).toLocaleString()})\n`
    : 'SecureStore: Missing\n';
  
  // Issues
  message += '\nISSUES:\n';
  const issuesList = [];
  if (issues.accessTokenMismatch) issuesList.push('- Access tokens mismatch between storages');
  if (issues.refreshTokenMismatch) issuesList.push('- Refresh tokens mismatch between storages');
  if (issues.asyncAccessMissing) issuesList.push('- AsyncStorage access token missing');
  if (issues.asyncRefreshMissing) issuesList.push('- AsyncStorage refresh token missing');
  if (issues.secureAccessMissing) issuesList.push('- SecureStore access token missing');
  if (issues.secureRefreshMissing) issuesList.push('- SecureStore refresh token missing');
  
  message += issuesList.length ? issuesList.join('\n') : 'No issues detected';
  
  Alert.alert('Token Debug', message, [
    { text: 'OK' },
    { 
      text: 'Copy to Clipboard',
      onPress: () => {
        // Copy to clipboard functionality would be here
        Alert.alert('Not Implemented', 'Copy to clipboard not implemented in this version');
      }
    }
  ]);
};

/**
 * Repairs common token issues by copying tokens between storage systems
 * and forcing consistency between AsyncStorage and SecureStore
 */
export const repairTokenIssues = async () => {
  try {
    const debugInfo = await getTokenDebugInfo();
    if (!debugInfo) return false;
    
    const { asyncStorage, secureStore } = debugInfo;
    
    // Skip secure store operations on web
    if (Platform.OS === 'web') {
      return true;
    }
    
    // Fix access token issues
    if (asyncStorage.accessToken && !secureStore?.accessToken) {
      // Copy from AsyncStorage to SecureStore
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, asyncStorage.accessToken.token);
      console.log('Copied access token from AsyncStorage to SecureStore');
    } else if (!asyncStorage.accessToken && secureStore?.accessToken) {
      // Copy from SecureStore to AsyncStorage
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, secureStore.accessToken.token);
      console.log('Copied access token from SecureStore to AsyncStorage');
    } else if (asyncStorage.accessToken && secureStore?.accessToken &&
               asyncStorage.accessToken.token !== secureStore.accessToken.token) {
      // Use SecureStore version as the source of truth
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, secureStore.accessToken.token);
      console.log('Synchronized access tokens using SecureStore as source of truth');
    }
    
    // Fix refresh token issues
    if (asyncStorage.refreshToken && !secureStore?.refreshToken) {
      // Copy from AsyncStorage to SecureStore
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, asyncStorage.refreshToken.token);
      console.log('Copied refresh token from AsyncStorage to SecureStore');
    } else if (!asyncStorage.refreshToken && secureStore?.refreshToken) {
      // Copy from SecureStore to AsyncStorage
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, secureStore.refreshToken.token);
      console.log('Copied refresh token from SecureStore to AsyncStorage');
    } else if (asyncStorage.refreshToken && secureStore?.refreshToken &&
               asyncStorage.refreshToken.token !== secureStore.refreshToken.token) {
      // Use SecureStore version as the source of truth
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, secureStore.refreshToken.token);
      console.log('Synchronized refresh tokens using SecureStore as source of truth');
    }
    
    // Copy user data
    try {
      const asyncUserData = await AsyncStorage.getItem(USER_DATA_KEY);
      const secureUserData = await SecureStore.getItemAsync(USER_DATA_KEY);
      
      if (asyncUserData && !secureUserData) {
        await SecureStore.setItemAsync(USER_DATA_KEY, asyncUserData);
      } else if (!asyncUserData && secureUserData) {
        await AsyncStorage.setItem(USER_DATA_KEY, secureUserData);
      }
    } catch (error) {
      console.error('Error syncing user data:', error);
    }
    
    return true;
  } catch (error) {
    console.error('Error repairing token issues:', error);
    return false;
  }
};

// Helper function to clear all tokens from storage
export const clearAllTokens = async () => {
  try {
    // Clear from AsyncStorage
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
      AsyncStorage.removeItem(USER_DATA_KEY)
    ]);
    
    // Clear from SecureStore on native platforms
    if (Platform.OS !== 'web') {
      await Promise.all([
        SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.deleteItemAsync(USER_DATA_KEY)
      ]);
    }
    
    return true;
  } catch (error) {
    console.error('Error clearing all tokens:', error);
    return false;
  }
};

// Add a diagnostic logging function for debugging
export const logStorageState = async () => {
  try {
    const debugInfo = await getTokenDebugInfo();
    
    console.log('=== TOKEN STORAGE DIAGNOSTIC ===');
    console.log('Platform:', Platform.OS);
    
    if (debugInfo) {
      // AsyncStorage tokens
      console.log('\nAsyncStorage:');
      console.log('- Access token:', debugInfo.asyncStorage.accessToken ? 
        (debugInfo.asyncStorage.accessToken.expired ? 'EXPIRED' : 'VALID') : 'NOT FOUND');
      console.log('- Refresh token:', debugInfo.asyncStorage.refreshToken ? 
        (debugInfo.asyncStorage.refreshToken.expired ? 'EXPIRED' : 'VALID') : 'NOT FOUND');
      
      // SecureStore tokens (not available on web)
      if (Platform.OS !== 'web') {
        console.log('\nSecureStore:');
        console.log('- Access token:', debugInfo.secureStore?.accessToken ? 
          (debugInfo.secureStore.accessToken.expired ? 'EXPIRED' : 'VALID') : 'NOT FOUND');
        console.log('- Refresh token:', debugInfo.secureStore?.refreshToken ? 
          (debugInfo.secureStore.refreshToken.expired ? 'EXPIRED' : 'VALID') : 'NOT FOUND');
      }
      
      // Issues
      const issues = debugInfo.issues;
      const issuesList = Object.entries(issues)
        .filter(([_, hasIssue]) => hasIssue)
        .map(([issue]) => issue);
      
      console.log('\nDetected Issues:', issuesList.length ? issuesList.join(', ') : 'None');
    } else {
      console.log('Failed to get token debug info');
    }
    
    console.log('==============================');
    return debugInfo;
  } catch (error) {
    console.error('Error logging storage state:', error);
    return null;
  }
};

export default {
  decodeToken,
  isTokenExpired,
  getTokenDebugInfo,
  showTokenDebugAlert,
  repairTokenIssues,
  clearAllTokens,
  logStorageState
}; 