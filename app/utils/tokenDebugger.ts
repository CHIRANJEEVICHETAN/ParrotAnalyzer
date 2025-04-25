import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// Constants for storage keys (must match those in AuthContext)
const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_DATA_KEY = 'user_data';

/**
 * Decodes a JWT token without verification
 * @param token The JWT token string
 * @returns The decoded payload or null if invalid
 */
export const decodeToken = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
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
export const isTokenExpired = (token: string) => {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return null;
    
    const currentTime = Date.now() / 1000; // Convert to seconds
    return decoded.exp < currentTime;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return null;
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
      secureAccessToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      secureRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
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
    
    return {
      asyncStorage: {
        accessToken: asyncAccessToken ? {
          token: asyncAccessToken,
          decoded: asyncAccessDecoded,
          expired: isTokenExpired(asyncAccessToken)
        } : null,
        refreshToken: asyncRefreshToken ? {
          token: asyncRefreshToken,
          decoded: asyncRefreshDecoded,
          expired: isTokenExpired(asyncRefreshToken)
        } : null
      },
      secureStore: {
        accessToken: secureAccessToken ? {
          token: secureAccessToken,
          decoded: secureAccessDecoded,
          expired: isTokenExpired(secureAccessToken)
        } : null,
        refreshToken: secureRefreshToken ? {
          token: secureRefreshToken,
          decoded: secureRefreshDecoded,
          expired: isTokenExpired(secureRefreshToken)
        } : null
      },
      issues: {
        accessTokenMismatch,
        refreshTokenMismatch,
        asyncAccessMissing: !asyncAccessToken,
        asyncRefreshMissing: !asyncRefreshToken,
        secureAccessMissing: !secureAccessToken,
        secureRefreshMissing: !secureRefreshToken
      }
    };
  } catch (error) {
    console.error('Error generating token debug info:', error);
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
  
  message += secureStore.accessToken
    ? `SecureStore: Valid (exp: ${new Date(secureStore.accessToken.decoded.exp * 1000).toLocaleString()})\n`
    : 'SecureStore: Missing\n';
  
  // Refresh Token Info
  message += '\nREFRESH TOKEN:\n';
  message += asyncStorage.refreshToken
    ? `AsyncStorage: Valid (exp: ${new Date(asyncStorage.refreshToken.decoded.exp * 1000).toLocaleString()})\n` 
    : 'AsyncStorage: Missing\n';
  
  message += secureStore.refreshToken
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
    
    // Fix access token issues
    if (asyncStorage.accessToken && !secureStore.accessToken) {
      // Copy from AsyncStorage to SecureStore
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, asyncStorage.accessToken.token);
      console.log('Copied access token from AsyncStorage to SecureStore');
    } else if (!asyncStorage.accessToken && secureStore.accessToken) {
      // Copy from SecureStore to AsyncStorage
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, secureStore.accessToken.token);
      console.log('Copied access token from SecureStore to AsyncStorage');
    } else if (asyncStorage.accessToken && secureStore.accessToken &&
               asyncStorage.accessToken.token !== secureStore.accessToken.token) {
      // Use SecureStore version as the source of truth
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, secureStore.accessToken.token);
      console.log('Synchronized access tokens using SecureStore as source of truth');
    }
    
    // Fix refresh token issues
    if (asyncStorage.refreshToken && !secureStore.refreshToken) {
      // Copy from AsyncStorage to SecureStore
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, asyncStorage.refreshToken.token);
      console.log('Copied refresh token from AsyncStorage to SecureStore');
    } else if (!asyncStorage.refreshToken && secureStore.refreshToken) {
      // Copy from SecureStore to AsyncStorage
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, secureStore.refreshToken.token);
      console.log('Copied refresh token from SecureStore to AsyncStorage');
    } else if (asyncStorage.refreshToken && secureStore.refreshToken &&
               asyncStorage.refreshToken.token !== secureStore.refreshToken.token) {
      // Use SecureStore version as the source of truth
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, secureStore.refreshToken.token);
      console.log('Synchronized refresh tokens using SecureStore as source of truth');
    }
    
    return true;
  } catch (error) {
    console.error('Error repairing token issues:', error);
    return false;
  }
};

export default {
  decodeToken,
  isTokenExpired,
  getTokenDebugInfo,
  showTokenDebugAlert,
  repairTokenIssues
}; 