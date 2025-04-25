import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Region, MapType } from 'react-native-maps';
import { Dimensions } from 'react-native';

// Default map settings
const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

interface MapUIOptions {
  showsUserLocation: boolean;
  followsUserLocation: boolean;
  showsCompass: boolean;
  showsScale: boolean;
  showsTraffic: boolean;
  showsIndoors: boolean;
  showsBuildings: boolean;
  showsPointsOfInterest: boolean;
  zoomEnabled: boolean;
  rotateEnabled: boolean;
  scrollEnabled: boolean;
  pitchEnabled: boolean;
  toolbarEnabled: boolean;
  showControls: boolean;
  showUserPaths: boolean;
  showGeofences: boolean;
}

interface MapStore {
  // Map region and type
  currentRegion: Region;
  defaultRegion: Region;
  mapType: MapType;
  customMapStyle: MapStyle[];
  
  // User location management
  userLocation: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: number; // When this location was last updated
  } | null;
  isLoadingLocation: boolean;
  
  // UI options
  uiOptions: MapUIOptions;
  
  // Map view history
  recentRegions: Region[];
  
  // Actions
  setCurrentRegion: (region: Region) => void;
  setDefaultRegion: (region: Region) => void;
  setMapType: (mapType: MapType) => void;
  setCustomMapStyle: (style: MapStyle[] | undefined) => void;
  toggleMapOption: (option: keyof MapUIOptions) => void;
  updateMapOptions: (options: Partial<MapUIOptions>) => void;
  resetToDefaultRegion: () => void;
  addToRecentRegions: (region: Region) => void;
  clearRecentRegions: () => void;
  
  // User location actions
  setUserLocation: (location: { latitude: number; longitude: number; accuracy?: number }) => void;
  setIsLoadingLocation: (isLoading: boolean) => void;
  getUserLocation: () => { latitude: number; longitude: number; accuracy?: number; isCached: boolean; timestamp: number } | null;
}

type MapStyle = { [key: string]: any };

const DEFAULT_UI_OPTIONS: MapUIOptions = {
  showsUserLocation: true,
  followsUserLocation: false,
  showsCompass: true,
  showsScale: true,
  showsTraffic: false,
  showsIndoors: false,
  showsBuildings: false,
  showsPointsOfInterest: false,
  zoomEnabled: true,
  rotateEnabled: true,
  scrollEnabled: true,
  pitchEnabled: true,
  toolbarEnabled: true,
  showControls: true,
  showUserPaths: true,
  showGeofences: true,
};

// Default region (can be updated based on user's location)
const DEFAULT_REGION: Region = {
  // Default to Bangalore, Karnataka instead of 0,0
  latitude: 12.9716,
  longitude: 77.5946,
  latitudeDelta: LATITUDE_DELTA,
  longitudeDelta: LONGITUDE_DELTA,
};

// Add debug logging function
const logMapAction = (action: string, data?: any) => {
  console.log(`[MapStore] ${action}`, data || '');
};

const useMapStore = create(
  persist<MapStore>(
    (set, get) => ({
      currentRegion: DEFAULT_REGION,
      defaultRegion: DEFAULT_REGION,
      mapType: 'standard',
      customMapStyle: [],
      uiOptions: DEFAULT_UI_OPTIONS,
      recentRegions: [],
      
      // User location state
      userLocation: null,
      isLoadingLocation: false,
      
      setCurrentRegion: (region: Region) => {
        logMapAction('Setting current region', region);
        set({ currentRegion: region });
      },
      
      setDefaultRegion: (region: Region) => {
        logMapAction('Setting default region', region);
        set({ defaultRegion: region });
      },
      
      setMapType: (mapType: MapType) => 
        set({ mapType }),
      
      setCustomMapStyle: (style: MapStyle[] | undefined) => 
        set({ customMapStyle: style }),
      
      toggleMapOption: (option: keyof MapUIOptions) => 
        set((state: MapStore) => ({
          uiOptions: {
            ...state.uiOptions,
            [option]: !state.uiOptions[option],
          },
        })),
      
      updateMapOptions: (options: Partial<MapUIOptions>) => 
        set((state: MapStore) => ({
          uiOptions: {
            ...state.uiOptions,
            ...options,
          },
        })),
      
      resetToDefaultRegion: () => 
        set((state: MapStore) => ({
          currentRegion: state.defaultRegion,
        })),
      
      addToRecentRegions: (region: Region) => 
        set((state: MapStore) => {
          const regions = [region, ...state.recentRegions.slice(0, 4)];
          return { recentRegions: regions };
        }),
      
      clearRecentRegions: () => 
        set({ recentRegions: [] }),
        
      // User location actions
      setUserLocation: (location: { latitude: number; longitude: number; accuracy?: number }) => {
        logMapAction('Setting user location', location);
        set({ 
          userLocation: {
            ...location,
            timestamp: Date.now(),
          },
          isLoadingLocation: false
        });
      },
        
      setIsLoadingLocation: (isLoading: boolean) => 
        set({ isLoadingLocation: isLoading }),
        
      getUserLocation: () => {
        const { userLocation } = get();
        if (!userLocation) {
          logMapAction('getUserLocation returning null');
          return null;
        }
        
        logMapAction('getUserLocation returning cached location', userLocation);
        return {
          ...userLocation,
          isCached: true, // To indicate this is from cache
        };
      },
    }),
    {
      name: 'map-storage',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);

export default useMapStore; 