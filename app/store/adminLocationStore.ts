import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Region } from 'react-native-maps';

// Default map settings
const BANGALORE_REGION: Region = {
  // Default to Bangalore, Karnataka
  latitude: 12.9716,
  longitude: 77.5946,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

// Debug logging function
const log = (action: string, data?: any) => {
  console.log(`[AdminLocationStore] ${action}`, data || '');
};

interface AdminLocationState {
  // Admin's current location
  adminLocation: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: number;
  } | null;
  
  // Map region for initialRegion props
  mapInitialRegion: Region;
  
  // Status flags
  isLoading: boolean;
  hasLoadedLocation: boolean;
  error: string | null;
  
  // Actions
  setAdminLocation: (location: { latitude: number; longitude: number; accuracy?: number }) => void;
  fetchAdminLocation: () => Promise<void>;
  resetLocationError: () => void;
}

const useAdminLocationStore = create(
  persist<AdminLocationState>(
    (set, get) => ({
      adminLocation: null,
      mapInitialRegion: BANGALORE_REGION,
      isLoading: false,
      hasLoadedLocation: false,
      error: null,
      
      setAdminLocation: (location: { latitude: number; longitude: number; accuracy?: number }) => {
        log('Setting admin location', location);
        
        // Create the region object suitable for map initialRegion prop
        const mapRegion: Region = {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01, // Zoomed in for better visibility
          longitudeDelta: 0.01,
        };
        
        set({ 
          adminLocation: {
            ...location,
            timestamp: Date.now(),
          },
          mapInitialRegion: mapRegion,
          hasLoadedLocation: true,
          isLoading: false
        });
      },
      
      fetchAdminLocation: async () => {
        const state = get();
        
        // Don't refetch if we're already loading
        if (state.isLoading) {
          log('Already fetching location, skipping');
          return;
        }
        
        set({ isLoading: true, error: null });
        log('Fetching admin location...');
        
        try {
          // First check for location permissions
          const { status } = await Location.requestForegroundPermissionsAsync();
          
          if (status !== 'granted') {
            log('Location permission denied');
            set({ 
              error: 'Location permission denied', 
              isLoading: false,
              // Keep using Bangalore as fallback
              mapInitialRegion: BANGALORE_REGION
            });
            return;
          }
          
          // Get current position with high accuracy
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });
          
          log('Location obtained successfully', location.coords);
          
          // Format the location and update state
          const adminLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
          };
          
          get().setAdminLocation(adminLocation);
          
        } catch (error) {
          log('Error fetching location', error);
          set({ 
            error: `Location error: ${error instanceof Error ? error.message : String(error)}`,
            isLoading: false,
            // Keep using Bangalore as fallback
            mapInitialRegion: BANGALORE_REGION
          });
        }
      },
      
      resetLocationError: () => set({ error: null }),
    }),
    {
      name: 'admin-location-storage',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);

export default useAdminLocationStore; 