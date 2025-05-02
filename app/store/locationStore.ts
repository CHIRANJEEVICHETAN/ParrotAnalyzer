import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Location, 
  LocationHistory, 
  TrackingStatus, 
  LocationAccuracy,
  TrackingUser,
  GeofenceRegion
} from '../types/liveTracking';
import { LocationObject } from 'expo-location';

// Extended interface to include LiveTracking state
interface LocationState {
  // Current state
  currentLocation: EnhancedLocation | null;
  locationHistory: EnhancedLocation[];
  trackingStatus: TrackingStatus;
  locationAccuracy: LocationAccuracy;
  batteryLevel: number;
  isInGeofence: boolean;
  currentGeofenceId: number | null;
  lastUpdated: string | null;
  error: string | null;
  
  // Settings
  backgroundTrackingEnabled: boolean;
  batteryOptimizationEnabled: boolean;
  updateIntervalSeconds: number;
  maxHistoryItems: number;
  
  // Metrics
  todayDistance: number;
  todayTimeTracked: number;
  todayTimeInGeofence: number;
  
  // Live tracking state (added for compatibility)
  trackedUsers: TrackingUser[];
  geofences: GeofenceRegion[];
  userPaths: Record<string, any>;
  lastKnownUserLocations: Record<string, Location>;
  selectedUser: TrackingUser | null;
  
  // Actions
  setCurrentLocation: (location: EnhancedLocation) => void;
  addLocationToHistory: (location: EnhancedLocation) => void;
  clearLocationHistory: () => void;
  setTrackingStatus: (status: TrackingStatus) => void;
  setLocationAccuracy: (accuracy: LocationAccuracy) => void;
  setBatteryLevel: (level: number) => void;
  setError: (error: string | null) => void;
  setIsInGeofence: (isInGeofence: boolean, geofenceId?: number) => void;
  setBackgroundTrackingEnabled: (enabled: boolean) => void;
  setBatteryOptimizationEnabled: (enabled: boolean) => void;
  setUpdateIntervalSeconds: (seconds: number) => void;
  updateTodayMetrics: (distance: number, timeTracked: number, timeInGeofence: number) => void;
  resetTodayMetrics: () => void;
  
  // Live tracking actions (added for compatibility)
  setSelectedUser: (user: TrackingUser) => void;
  setTrackedUsers: (users: TrackingUser[]) => void;
  
  // Queue management
  pendingLocations: EnhancedLocation[];
  addPendingLocation: (location: EnhancedLocation) => void;
  removePendingLocations: (locations: EnhancedLocation[]) => void;
  clearPendingLocations: () => void;
  
  // Error tracking
  lastError: string | null;
  setLastError: (error: string | null) => void;
  
  // Stats
  totalLocationsRecorded: number;
  totalLocationsSent: number;
  incrementTotalLocationsRecorded: () => void;
  incrementTotalLocationsSent: (count: number) => void;
  resetStats: () => void;
}

export interface EnhancedLocation extends LocationObject {
  // Add standard location properties for direct access (backwards compatibility)
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  // Additional properties
  batteryLevel?: number;
  isMoving?: boolean;
  address?: string;
  recordedAt?: string;
}

const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentLocation: null,
      locationHistory: [],
      trackingStatus: TrackingStatus.INACTIVE,
      locationAccuracy: 'balanced',
      batteryLevel: 100,
      isInGeofence: false,
      currentGeofenceId: null,
      lastUpdated: null,
      error: null,
      
      // Settings with defaults
      backgroundTrackingEnabled: false,
      batteryOptimizationEnabled: true,
      updateIntervalSeconds: 30,
      maxHistoryItems: 100,
      
      // Metrics
      todayDistance: 0,
      todayTimeTracked: 0,
      todayTimeInGeofence: 0,
      
      // Live tracking state (added for compatibility)
      trackedUsers: [],
      geofences: [],
      userPaths: {},
      lastKnownUserLocations: {},
      selectedUser: null,
      
      // Actions
      setCurrentLocation: (location) => {
        set({
          currentLocation: location,
          lastUpdated: new Date().toISOString(),
        });
      },
      
      addLocationToHistory: (location) => {
        const history = [...get().locationHistory];
        
        // Add to beginning of array
        history.unshift(location);
        
        // Limit history size
        if (history.length > get().maxHistoryItems) {
          history.pop();
        }
        
        set({ locationHistory: history });
      },
      
      clearLocationHistory: () => set({ locationHistory: [] }),
      
      setTrackingStatus: (status) => {
        set({ trackingStatus: status });
        
        // Reset error when tracking is started
        if (status === TrackingStatus.ACTIVE && get().error !== null) {
          set({ error: null });
        }
      },
      
      setLocationAccuracy: (accuracy: LocationAccuracy) => 
        set({ locationAccuracy: accuracy }),
      
      setBatteryLevel: (level: number) => 
        set({ batteryLevel: level }),
      
      setError: (error: string | null) => 
        set({ error }),
      
      setIsInGeofence: (isInGeofence: boolean, geofenceId?: number) => 
        set({ 
          isInGeofence, 
          currentGeofenceId: isInGeofence ? (geofenceId || get().currentGeofenceId) : null 
        }),
        
      setBackgroundTrackingEnabled: (enabled: boolean) => 
        set({ backgroundTrackingEnabled: enabled }),
        
      setBatteryOptimizationEnabled: (enabled: boolean) => 
        set({ batteryOptimizationEnabled: enabled }),
        
      setUpdateIntervalSeconds: (seconds: number) => 
        set({ updateIntervalSeconds: seconds }),
      
      updateTodayMetrics: (distance: number, timeTracked: number, timeInGeofence: number) => {
        const { todayDistance, todayTimeTracked, todayTimeInGeofence } = get();
        
        set({
          todayDistance: todayDistance + distance,
          todayTimeTracked: todayTimeTracked + timeTracked,
          todayTimeInGeofence: todayTimeInGeofence + timeInGeofence
        });
      },
      
      resetTodayMetrics: () => set({
        todayDistance: 0,
        todayTimeTracked: 0,
        todayTimeInGeofence: 0
      }),
      
      // Added for compatibility
      setSelectedUser: (user: TrackingUser) => set({ selectedUser: user }),
      setTrackedUsers: (users: TrackingUser[]) => set({ trackedUsers: users }),
      
      // Queue management
      pendingLocations: [],
      addPendingLocation: (location) => {
        const pending = get().pendingLocations;
        set({ 
          pendingLocations: [...pending, location],
          totalLocationsRecorded: get().totalLocationsRecorded + 1
        });
      },
      removePendingLocations: (locations) => {
        const pending = get().pendingLocations;
        const locationTimestamps = locations.map(l => l.timestamp);
        set({ 
          pendingLocations: pending.filter(loc => !locationTimestamps.includes(loc.timestamp))
        });
      },
      clearPendingLocations: () => set({ pendingLocations: [] }),
      
      // Error tracking
      lastError: null,
      setLastError: (error) => set({ lastError: error }),
      
      // Stats
      totalLocationsRecorded: 0,
      totalLocationsSent: 0,
      incrementTotalLocationsRecorded: () => 
        set({ totalLocationsRecorded: get().totalLocationsRecorded + 1 }),
      incrementTotalLocationsSent: (count) => 
        set({ totalLocationsSent: get().totalLocationsSent + count }),
      resetStats: () => set({ 
        totalLocationsRecorded: 0, 
        totalLocationsSent: 0 
      }),
    }),
    {
      name: 'location-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist these fields
        locationHistory: state.locationHistory,
        backgroundTrackingEnabled: state.backgroundTrackingEnabled,
        batteryOptimizationEnabled: state.batteryOptimizationEnabled,
        updateIntervalSeconds: state.updateIntervalSeconds,
        maxHistoryItems: state.maxHistoryItems,
        todayDistance: state.todayDistance,
        todayTimeTracked: state.todayTimeTracked,
        todayTimeInGeofence: state.todayTimeInGeofence,
        totalLocationsRecorded: state.totalLocationsRecorded,
        totalLocationsSent: state.totalLocationsSent
      }),
    }
  )
);

// Add this alias for backward compatibility
export const useLocationTrackingStore = useLocationStore;

export default useLocationStore; 