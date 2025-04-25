import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Geofence, GeofenceType, GeoCoordinates } from '../types/liveTracking';
import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import EventEmitter from '../utils/EventEmitter';
import { router } from 'expo-router';

// Debug function to check token storage
const debugTokenStorage = async () => {
  try {
    // Import the token debugger utility to check for token issues
    const { getTokenDebugInfo, repairTokenIssues } = await import('../utils/tokenDebugger');
    
    // First, check if AsyncStorage has auth_token
    const asyncAuth = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    console.log('AsyncStorage auth_token:', asyncAuth ? 'Found token' : 'No token found');
    
    // Get all AsyncStorage keys
    const allKeys = await AsyncStorage.getAllKeys();
    console.log('All AsyncStorage keys:', JSON.stringify(allKeys));
    
    // Log detailed info about tokens
    console.log('AsyncStorage auth_token:', asyncAuth ? 'Has value' : 'No value');
    console.log('AsyncStorage refresh_token:', await AsyncStorage.getItem(REFRESH_TOKEN_KEY) ? 'Has value' : 'No value');
    
    // Check SecureStore
    try {
      const secureAuth = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      console.log('SecureStore auth_token:', secureAuth ? 'Found token' : 'No token found');
      
      // Get detailed token debug info
      const tokenDebugInfo = await getTokenDebugInfo();
      
      // Auto-repair token storage inconsistencies
      if (tokenDebugInfo && (
        tokenDebugInfo.issues.accessTokenMismatch || 
        tokenDebugInfo.issues.refreshTokenMismatch ||
        (tokenDebugInfo.issues.asyncAccessMissing && !tokenDebugInfo.issues.secureAccessMissing) ||
        (tokenDebugInfo.issues.secureAccessMissing && !tokenDebugInfo.issues.asyncAccessMissing)
      )) {
        console.log('Detected token storage inconsistencies, attempting repair...');
        await repairTokenIssues();
      }
    } catch (secureError) {
      console.error('Error accessing SecureStore:', secureError);
    }
    
    return true;
  } catch (error) {
    console.error('Error in debugTokenStorage:', error);
    return false;
  }
};

interface GeofenceState {
  // Geofence data
  geofences: Geofence[];
  selectedGeofence: Geofence | null;
  isEditing: boolean;
  isCreating: boolean;
  error: string | null;
  isLoading: boolean;
  
  // Edit state
  editName: string;
  editType: GeofenceType;
  editCoordinates: GeoCoordinates;
  editRadius: number;
  
  // Actions - Fetch
  fetchGeofences: () => Promise<void>;
  
  // Actions - Selection
  selectGeofence: (id: number | null) => void;
  
  // Actions - CRUD
  createGeofence: (name: string, coordinates: GeoCoordinates, radius: number) => Promise<void>;
  updateGeofence: (id: number, data: Partial<Omit<Geofence, 'id'>>) => Promise<void>;
  deleteGeofence: (id: number) => Promise<void>;
  
  // Actions - Edit state
  startEditing: (geofence: Geofence) => void;
  startCreating: (type: GeofenceType) => void;
  cancelEdit: () => void;
  updateEditName: (name: string) => void;
  updateEditType: (type: GeofenceType) => void;
  updateEditCoordinates: (coordinates: GeoCoordinates) => void;
  updateEditRadius: (radius: number) => void;
  
  // Actions - Local state
  setError: (error: string | null) => void;
  clearGeofences: () => void;
}

// Constants for storage keys (must match those in AuthContext)
const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_DATA_KEY = 'user_data';

// Add function to refresh the token
const refreshToken = async (): Promise<string | null> => {
  try {
    // Get refresh token from storage
    let refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    console.log('refreshToken in geofenceStore', refreshToken);
    
    if (!refreshToken) {
      try {
        refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      } catch (secureError) {
        console.error('Error accessing refresh token from SecureStore:', secureError);
      }
    }
    
    if (!refreshToken) {
      console.error('No refresh token available for token refresh');
      return null;
    }
    
    console.log('Attempting to refresh token...');
    
    // Make a refresh token request
    const API_URL = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';
    const response = await axios.post(`${API_URL}/auth/refresh`, {
      refreshToken
    });
    
    if (response.status === 200) {
      const { accessToken, user: userData } = response.data;
      
      // Store the new token in both storage systems
      await Promise.all([
        AsyncStorage.setItem(AUTH_TOKEN_KEY, accessToken),
        AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData)),
        SecureStore.setItemAsync(AUTH_TOKEN_KEY, accessToken),
        SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(userData))
      ]);
      
      console.log('Token refreshed successfully');
      return accessToken;
    }
    
    return null;
  } catch (error) {
    console.error('Token refresh failed:', error);
    // If refresh fails, notify the app to log out
    EventEmitter.emit('AUTH_TOKEN_EXPIRED');
    return null;
  }
};

// Updated getToken function to check both SecureStore and AsyncStorage for the auth_token key
const getToken = async (): Promise<string | null> => {
  try {
    // Try SecureStore first (more secure)
    try {
      const secureToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      if (secureToken) {
        console.log('Using token from SecureStore', secureToken);
        return secureToken;
      }
    } catch (secureError) {
      console.error('Error accessing SecureStore:', secureError);
    }
    
    // Then try AsyncStorage (fallback)
    const asyncToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (asyncToken) {
      console.log('Using token from AsyncStorage', asyncToken);
      return asyncToken;
    }
    
    console.warn('No auth token found in any storage');
    return null;
  } catch (error) {
    console.error('Error getting token from storage:', error);
    return null;
  }
};

const useGeofenceStore = create<GeofenceState>()(
  persist(
    (set, get) => ({
      // Initial state
      geofences: [],
      selectedGeofence: null,
      isEditing: false,
      isCreating: false,
      error: null,
      isLoading: false,
      
      // Edit state with defaults
      editName: '',
      editType: 'circle',
      editCoordinates: { type: 'Point', coordinates: [0, 0] },
      editRadius: 100,
      
      // Fetch geofences from API with token refresh
      fetchGeofences: async () => {
        try {
          set({ isLoading: true, error: null });
          
          // Run debug function to check token storage
          await debugTokenStorage();
          
          let token = await getToken();
          console.log('Got the token:', token ? 'Token found' : 'No token found');
          
          if (!token) {
            console.warn('No auth token found for geofence fetch');
            set({ error: 'Authentication required' });
            set({ isLoading: false });
            return;
          }
          
          const API_URL = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';
          
          try {
            // First attempt with current token
            const response = await axios.get(`${API_URL}/api/group-admin-tracking/geofences`, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
            
            if (response.status === 200) {
              console.log('Successfully fetched geofences:', response.data.length);
              set({ geofences: response.data });
            }
          } catch (requestError: any) {
            const status = requestError.response?.status;
            const errorData = requestError.response?.data || {};
            
            // Handle specific error types
            if (status === 401) {
              console.log(`Received 401 with message: ${errorData.error || 'No error message'}`);
              
              // Handle "User not found" error - this usually indicates the user has been deleted or the token is for an invalid user
              if (errorData.error === 'User not found') {
                console.log('User not found error detected, forcing logout');
                // Clear local token storage
                await Promise.all([
                  AsyncStorage.removeItem(AUTH_TOKEN_KEY),
                  AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
                  AsyncStorage.removeItem(USER_DATA_KEY),
                  SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
                  SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
                  SecureStore.deleteItemAsync(USER_DATA_KEY)
                ]);
                
                // Redirect to login
                set({ error: 'Your account was not found. Please log in again.' });
                router.replace('/(auth)/signin');
                return;
              }
              
              // For other 401 errors, try token refresh
              console.log('Attempting token refresh');
              token = await refreshToken();
              
              if (token) {
                // Validate token before retry - parse and check expiry
                try {
                  const tokenParts = token.split('.');
                  if (tokenParts.length !== 3) throw new Error('Invalid token format');
                  
                  const payload = JSON.parse(atob(tokenParts[1]));
                  const expiryTime = payload.exp * 1000; // Convert to milliseconds
                  
                  if (expiryTime < Date.now()) {
                    throw new Error('Token already expired');
                  }
                  
                  // Only retry if token passes basic validation
                  const retryResponse = await axios.get(`${API_URL}/api/group-admin-tracking/geofences`, {
                    headers: {
                      Authorization: `Bearer ${token}`
                    }
                  });
                  
                  if (retryResponse.status === 200) {
                    console.log('Successfully fetched geofences after token refresh:', retryResponse.data.length);
                    set({ geofences: retryResponse.data });
                    return;
                  }
                } catch (tokenValidationError) {
                  console.error('Token validation failed:', tokenValidationError);
                  throw new Error('Invalid or expired token after refresh');
                }
              } else {
                // If refresh failed, redirect to login
                console.log('Token refresh failed, redirecting to login');
                router.replace('/(auth)/signin');
                set({ error: 'Your session has expired. Please log in again.' });
                throw new Error('Token refresh failed');
              }
            }
            
            // If not a 401 or retry failed, re-throw the error
            throw requestError;
          }
        } catch (error: any) {
          console.error('Error fetching geofences:', error);
          console.log('Response status:', error.response?.status);
          console.log('Response data:', error.response?.data);
          
          if (error.response?.status === 401) {
            set({ error: 'Authentication failed. Please log in again.' });
          } else {
            set({ error: error.response?.data?.error || 'Failed to fetch geofences' });
          }
        } finally {
          set({ isLoading: false });
        }
      },
      
      // Select a geofence by ID
      selectGeofence: (id: number | null) => {
        if (id === null) {
          set({ selectedGeofence: null });
          return;
        }
        
        const geofence = get().geofences.find(g => g.id === id) || null;
        set({ selectedGeofence: geofence });
      },
      
      // Create a new geofence with token refresh
      createGeofence: async (name: string, coordinates: GeoCoordinates, radius: number) => {
        try {
          set({ isLoading: true, error: null });
          
          let token = await getToken();
          
          if (!token) {
            console.warn('No auth token found for geofence creation');
            set({ error: 'Authentication required' });
            set({ isLoading: false });
            return;
          }
          
          // Validate coordinates format
          if (!coordinates || 
              coordinates.type !== 'Point' || 
              !Array.isArray(coordinates.coordinates) || 
              coordinates.coordinates.length !== 2) {
            const error = 'Invalid coordinates format. Must be a GeoJSON Point with [longitude, latitude] array';
            console.error(error, coordinates);
            set({ error });
            set({ isLoading: false });
            return;
          }
          
          // Ensure we're using the Point type
          const pointCoordinates = {
            type: 'Point',
            coordinates: coordinates.coordinates
          };
          
          // Log the data being sent for debugging
          console.log('Creating geofence with data:', { 
            name, 
            coordinates: pointCoordinates, 
            radius 
          });
          
          const API_URL = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';
          
          try {
            // First attempt with current token
            const response = await axios.post(`${API_URL}/api/group-admin-tracking/geofence`, {
              name,
              coordinates: pointCoordinates,
              radius
            }, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
            
            if (response.status === 200) {
              const newGeofence = response.data;
              console.log('Geofence created successfully:', newGeofence);
              set({ 
                geofences: [...get().geofences, newGeofence],
                isCreating: false
              });
            }
          } catch (requestError: any) {
            console.log('Error response:', requestError.response);
            
            // If 401 error, try to refresh token and retry
            if (requestError.response?.status === 401) {
              // Try to refresh token
              token = await refreshToken();
              
              if (token) {
                // Retry with new token
                const retryResponse = await axios.post(`${API_URL}/api/group-admin-tracking/geofence`, {
                  name,
                  coordinates: pointCoordinates, // Use the validated point coordinates
                  radius
                }, {
                  headers: {
                    Authorization: `Bearer ${token}`
                  }
                });
                
                if (retryResponse.status === 200) {
                  const newGeofence = retryResponse.data;
                  set({ 
                    geofences: [...get().geofences, newGeofence],
                    isCreating: false
                  });
                  return;
                }
              } else {
                // If refresh failed, redirect to login
                router.replace('/(auth)/signin');
                set({ error: 'Your session has expired. Please log in again.' });
                throw new Error('Token refresh failed');
              }
            }
            
            // Check for validation errors (400)
            if (requestError.response?.status === 400) {
              const errorMessage = requestError.response.data?.error || 'Invalid geofence data';
              set({ error: errorMessage });
              throw new Error(errorMessage);
            }
            
            // Check for server errors (500)
            if (requestError.response?.status === 500) {
              const errorData = requestError.response.data;
              const errorMessage = errorData?.message || errorData?.error || 'Server error creating geofence';
              const errorDetails = errorData?.details || errorData?.hint || '';
              
              console.error('Server error details:', errorData);
              
              // Set a detailed error message
              set({ 
                error: `${errorMessage}${errorDetails ? ': ' + errorDetails : ''}` 
              });
              
              throw new Error(errorMessage);
            }
            
            // If not handled above, re-throw the error
            throw requestError;
          }
        } catch (error: any) {
          console.error('Error creating geofence:', error);
          
          // Set error message using detailed information if available
          if (!get().error) {
            if (error.response?.data) {
              const errorData = error.response.data;
              const errorMessage = errorData.error || errorData.message || 'Failed to create geofence';
              const errorDetails = errorData.details || errorData.hint || '';
              set({ error: `${errorMessage}${errorDetails ? ': ' + errorDetails : ''}` });
            } else {
              set({ error: error.message || 'Failed to create geofence' });
            }
          }
        } finally {
          set({ isLoading: false });
        }
      },
      
      // Update a geofence with token refresh handling
      updateGeofence: async (id: number, data: Partial<Omit<Geofence, 'id'>>) => {
        try {
          set({ isLoading: true, error: null });
          
          let token = await getToken();
          
          if (!token) {
            console.warn('No auth token found for geofence update');
            set({ error: 'Authentication required' });
            set({ isLoading: false });
            return;
          }
          
          // Validate and process coordinates if present
          let processedData = { ...data };
          
          // Ensure radius is a number
          if (data.radius !== undefined) {
            processedData.radius = Number(data.radius);
            
            if (isNaN(processedData.radius)) {
              const error = 'Invalid radius value. Must be a number.';
              console.error(error, data.radius);
              set({ error });
              set({ isLoading: false });
              return;
            }
          }
          
          if (data.coordinates) {
            if (data.coordinates.type !== 'Point' || 
                !Array.isArray(data.coordinates.coordinates) || 
                data.coordinates.coordinates.length !== 2) {
              const error = 'Invalid coordinates format. Must be a GeoJSON Point with [longitude, latitude] array';
              console.error(error, data.coordinates);
              set({ error });
              set({ isLoading: false });
              return;
            }
            
            // Ensure coordinate values are numbers
            const [longitude, latitude] = data.coordinates.coordinates;
            const lng = Number(longitude);
            const lat = Number(latitude);
            
            if (isNaN(lng) || isNaN(lat)) {
              const error = 'Invalid coordinate values. Must be valid numbers.';
              console.error(error, data.coordinates.coordinates);
              set({ error });
              set({ isLoading: false });
              return;
            }
            
            // Ensure we're using the Point type with numeric coordinates
            processedData.coordinates = {
              type: 'Point',
              coordinates: [lng, lat]
            };
          }
          
          // Log update data for debugging
          console.log(`Updating geofence ${id} with data:`, processedData);
          
          const API_URL = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';
          
          try {
            // First attempt with current token
            const response = await axios.put(`${API_URL}/api/group-admin-tracking/geofence/${id}`, processedData, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
            
            if (response.status === 200) {
              const updatedGeofence = response.data;
              
              // Ensure the returned geofence has properly formatted data
              if (updatedGeofence.coordinates) {
                // Handle string format (WKB or stringified JSON)
                if (typeof updatedGeofence.coordinates === 'string') {
                  try {
                    // Try parsing as JSON
                    const parsed = JSON.parse(updatedGeofence.coordinates);
                    if (parsed && parsed.type === 'Point' && Array.isArray(parsed.coordinates)) {
                      updatedGeofence.coordinates = parsed;
                    }
                  } catch (jsonError) {
                    // If not JSON, it's likely WKB - trigger a fresh fetch
                    console.log('Received WKB format coordinates, refreshing data...');
                    await get().fetchGeofences();
                    return;
                  }
                }
                
                // Validate Point format
                if (
                  typeof updatedGeofence.coordinates === 'object' &&
                  updatedGeofence.coordinates.type === 'Point' &&
                  Array.isArray(updatedGeofence.coordinates.coordinates)
                ) {
                  // Ensure coordinate values are numbers
                  const [longitude, latitude] = updatedGeofence.coordinates.coordinates;
                  updatedGeofence.coordinates = {
                    type: 'Point',
                    coordinates: [Number(longitude), Number(latitude)]
                  };
                }
              }
              
              // Make sure radius is stored as a number
              if (updatedGeofence.radius) {
                updatedGeofence.radius = Number(updatedGeofence.radius);
              }
              
              set({ 
                geofences: get().geofences.map(g => g.id === id ? updatedGeofence : g),
                isEditing: false,
                selectedGeofence: null
              });
            }
          } catch (requestError: any) {
            // If 401 error, try to refresh token and retry
            if (requestError.response?.status === 401) {
              // Try to refresh token
              token = await refreshToken();
              
              if (token) {
                // Retry with new token
                const retryResponse = await axios.put(`${API_URL}/api/group-admin-tracking/geofence/${id}`, processedData, {
                  headers: {
                    Authorization: `Bearer ${token}`
                  }
                });
                
                if (retryResponse.status === 200) {
                  const updatedGeofence = retryResponse.data;
                  set({ 
                    geofences: get().geofences.map(g => g.id === id ? updatedGeofence : g),
                    isEditing: false,
                    selectedGeofence: null
                  });
                  return;
                }
              } else {
                // If refresh failed, redirect to login
                router.replace('/(auth)/signin');
                set({ error: 'Your session has expired. Please log in again.' });
                throw new Error('Token refresh failed');
              }
            }
            
            // Check for validation errors (400)
            if (requestError.response?.status === 400) {
              const errorMessage = requestError.response.data?.error || 'Invalid geofence data';
              set({ error: errorMessage });
              throw new Error(errorMessage);
            }
            
            // Check for server errors (500)
            if (requestError.response?.status === 500) {
              const errorData = requestError.response.data;
              const errorMessage = errorData?.message || errorData?.error || 'Server error updating geofence';
              const errorDetails = errorData?.details || errorData?.hint || '';
              
              console.error('Server error details:', errorData);
              
              // Set a detailed error message
              set({ 
                error: `${errorMessage}${errorDetails ? ': ' + errorDetails : ''}` 
              });
              
              throw new Error(errorMessage);
            }
            
            // If not handled above, re-throw the error
            throw requestError;
          }
        } catch (error: any) {
          console.error('Error updating geofence:', error);
          
          // Set error message using detailed information if available
          if (!get().error) {
            if (error.response?.data) {
              const errorData = error.response.data;
              const errorMessage = errorData.error || errorData.message || 'Failed to update geofence';
              const errorDetails = errorData.details || errorData.hint || '';
              set({ error: `${errorMessage}${errorDetails ? ': ' + errorDetails : ''}` });
            } else {
              set({ error: error.message || 'Failed to update geofence' });
            }
          }
        } finally {
          set({ isLoading: false });
        }
      },
      
      // Delete a geofence with token refresh handling
      deleteGeofence: async (id: number) => {
        try {
          set({ isLoading: true, error: null });
          
          let token = await getToken();
          
          if (!token) {
            console.warn('No auth token found for geofence deletion');
            set({ error: 'Authentication required' });
            set({ isLoading: false });
            return;
          }
          
          const API_URL = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';
          
          try {
            // First attempt with current token
            const response = await axios.delete(`${API_URL}/api/group-admin-tracking/geofence/${id}`, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
            
            if (response.status === 200) {
              set({ 
                geofences: get().geofences.filter(g => g.id !== id),
                selectedGeofence: null
              });
            }
          } catch (requestError: any) {
            // If 401 error, try to refresh token and retry
            if (requestError.response?.status === 401) {
              // Try to refresh token
              token = await refreshToken();
              
              if (token) {
                // Retry with new token
                const retryResponse = await axios.delete(`${API_URL}/api/group-admin-tracking/geofence/${id}`, {
                  headers: {
                    Authorization: `Bearer ${token}`
                  }
                });
                
                if (retryResponse.status === 200) {
                  set({ 
                    geofences: get().geofences.filter(g => g.id !== id),
                    selectedGeofence: null
                  });
                  return;
                }
              } else {
                // If refresh failed, redirect to login
                router.replace('/(auth)/signin');
                set({ error: 'Your session has expired. Please log in again.' });
                throw new Error('Token refresh failed');
              }
            }
            
            // If not a 401 or retry failed, re-throw the error
            throw requestError;
          }
        } catch (error: any) {
          console.error('Error deleting geofence:', error);
          if (error.response?.status === 401) {
            set({ error: 'Authentication failed. Please log in again.' });
          } else {
            set({ error: error.response?.data?.error || 'Failed to delete geofence' });
          }
        } finally {
          set({ isLoading: false });
        }
      },
      
      // Start editing a geofence
      startEditing: (geofence: Geofence) => {
        // Ensure radius is a number 
        const radius = typeof geofence.radius === 'string' ? 
          Number(geofence.radius) : 
          Number(geofence.radius);

        console.log('Starting editing geofence with radius:', radius, typeof radius);
        
        set({
          isEditing: true,
          isCreating: false,
          selectedGeofence: geofence,
          editName: geofence.name,
          editCoordinates: geofence.coordinates,
          editRadius: radius,
          editType: geofence.coordinates.type === 'Point' ? 'circle' : 'polygon'
        });
      },
      
      // Start creating a new geofence
      startCreating: (type: GeofenceType) => {
        set({
          isCreating: true,
          isEditing: false,
          selectedGeofence: null,
          editName: 'New Geofence',
          editType: type,
          editCoordinates: type === 'circle' 
            ? { type: 'Point', coordinates: [0, 0] }
            : { type: 'Polygon', coordinates: [[]] },
          editRadius: 100
        });
      },
      
      // Cancel editing/creating
      cancelEdit: () => {
        set({
          isEditing: false,
          isCreating: false
        });
      },
      
      // Update edit state properties
      updateEditName: (name: string) => set({ editName: name }),
      updateEditType: (type: GeofenceType) => {
        // Convert coordinates if type changes
        const newCoordinates: GeoCoordinates = type === 'circle'
          ? { type: 'Point', coordinates: get().editCoordinates.type === 'Point' 
              ? get().editCoordinates.coordinates as number[]
              : [0, 0] }
          : { type: 'Polygon', coordinates: get().editCoordinates.type === 'Polygon'
              ? get().editCoordinates.coordinates as number[][]
              : [[]] };
              
        set({ 
          editType: type,
          editCoordinates: newCoordinates
        });
      },
      updateEditCoordinates: (coordinates: GeoCoordinates) => set({ editCoordinates: coordinates }),
      updateEditRadius: (radius: number) => set({ editRadius: radius }),
      
      // Utility actions
      setError: (error: string | null) => set({ error }),
      clearGeofences: () => set({ geofences: [] })
    }),
    {
      name: 'geofence-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist these fields
        geofences: state.geofences
      }),
    }
  )
);

export default useGeofenceStore; 