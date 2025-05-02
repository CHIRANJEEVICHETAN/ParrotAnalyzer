import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Platform, TouchableOpacity, Text, ActivityIndicator, StatusBar as RNStatusBar } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region, MapType, LatLng, Polyline, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '../../../../hooks/useColorScheme';
import { StatusBar } from 'expo-status-bar';
import LocationMarker from './LocationMarker';
import useLocationStore, { useLocationTrackingStore } from '../../../../store/locationStore';
import {
  TrackingUser,
  GeofenceRegion,
  TrackingStatus,
  Geofence,
} from "../../../../types/liveTracking";
import * as Location from 'expo-location';
import useMapStore from '../../../../store/useMapStore';
import useAdminLocationStore from '../../../../store/adminLocationStore';
import { useAuth } from '../../../../context/AuthContext';
import useGeofenceStore from '../../../../store/geofenceStore';
import { useColorScheme } from '../../../../hooks/useColorScheme';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

// How old a cached location can be (in milliseconds) before we consider it too old
const LOCATION_CACHE_MAX_AGE = 2 * 60 * 1000; // 2 minutes

interface UserLocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

interface LiveTrackingMapProps {
  initialRegion?: Region;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  followsUserLocation?: boolean;
  showsCompass?: boolean;
  showsScale?: boolean;
  showsTraffic?: boolean;
  showsIndoors?: boolean;
  showsBuildings?: boolean;
  showsPointsOfInterest?: boolean;
  zoomEnabled?: boolean;
  zoomControlEnabled?: boolean;
  rotateEnabled?: boolean;
  scrollEnabled?: boolean;
  pitchEnabled?: boolean;
  toolbarEnabled?: boolean;
  mapType?: MapType;
  minZoomLevel?: number;
  maxZoomLevel?: number;
  onRegionChange?: (region: Region) => void;
  onRegionChangeComplete?: (region: Region) => void;
  onPress?: (e: any) => void;
  onLongPress?: (e: any) => void;
  onMarkerPress?: (user: TrackingUser) => void;
  renderCustomMarker?: (user: TrackingUser) => React.ReactNode;
  customMapStyle?: any[];
  showUserPaths?: boolean;
  showGeofences?: boolean;
  pathStrokeColors?: Record<string, string>;
  geofenceColors?: Record<string, string>;
  selectedUserId?: string;
  showControls?: boolean;
  containerStyle?: any;
  customGeofences?: GeofenceRegion[];
  geofences?: Geofence[];
  currentGeofence?: Geofence | null;
  userRoutes?: Record<string, Array<{latitude: number, longitude: number}>>;
  routeCoordinates?: Array<{latitude: number, longitude: number}>;
  markerRefreshToggle?: boolean;
}

/**
 * LiveTrackingMap component for displaying real-time user locations
 * It uses react-native-maps and optimizes rendering with useMemo and useCallback
 */
const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  initialRegion,
  showsUserLocation = true,
  showsMyLocationButton = false,
  followsUserLocation = true,
  showsCompass = true,
  showsScale = true,
  showsTraffic = false,
  showsIndoors = false,
  showsBuildings = false,
  showsPointsOfInterest = false,
  zoomEnabled = true,
  zoomControlEnabled = false,
  rotateEnabled = true,
  scrollEnabled = true,
  pitchEnabled = true,
  toolbarEnabled = true,
  mapType = 'standard',
  onRegionChange,
  onRegionChangeComplete,
  onPress,
  onLongPress,
  onMarkerPress,
  renderCustomMarker,
  customMapStyle,
  showUserPaths = true,
  showGeofences = true,
  pathStrokeColors,
  geofenceColors,
  selectedUserId,
  showControls = true,
  containerStyle,
  customGeofences,
  geofences,
  currentGeofence,
  userRoutes,
  routeCoordinates,
  markerRefreshToggle,
}) => {
  // Theming
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor('#ffffff', '#121212');
  const textColor = useThemeColor('#333333', '#ffffff');
  const primaryColor = useThemeColor('#3498db', '#5dabf0');
  const secondaryColor = useThemeColor('#2ecc71', '#4ade80');
  const cardColor = useThemeColor('#ffffff', '#1e293b');
  const borderColor = useThemeColor('rgba(0, 0, 0, 0.1)', 'rgba(255, 255, 255, 0.1)');
  
  // Map ref to control the map programmatically
  const mapRef = useRef<MapView>(null);
  
  // Get map store values and actions
  const { 
    currentRegion: storedRegion, 
    setCurrentRegion, 
    getUserLocation,
    setUserLocation,
    setIsLoadingLocation,
    isLoadingLocation,
    userLocation: cachedUserLocation,
    mapType: storedMapType,
    setMapType: setStoredMapType
  } = useMapStore();
  
  // Replace the store code with individual selectors for better performance and type safety
  const trackedUsers = useLocationTrackingStore((state: any) => state.trackedUsers || []);
  const storeGeofences = useLocationTrackingStore((state: any) => state.geofences || []);
  const userPaths = useLocationTrackingStore((state: any) => state.userPaths || {});
  const lastKnownUserLocations = useLocationTrackingStore((state: any) => state.lastKnownUserLocations || {});
  const selectedUser = useLocationTrackingStore((state: any) => state.selectedUser);
  const setSelectedUser = useLocationTrackingStore((state: any) => state.setSelectedUser);
  
  // Get user role from auth context for role-specific behavior
  const { user } = useAuth();
  
  // Get geofence presence status for employee view
  const isInGeofence = useLocationStore(state => state.isInGeofence);
  const currentGeofenceId = useLocationStore(state => state.currentGeofenceId);
  
  // Get geofences from GeofenceStore for the employee role functionality
  const availableGeofences = useGeofenceStore(state => state.geofences);
  
  // Add state to track current geofence index for cycling through geofences
  const [currentGeofenceIndex, setCurrentGeofenceIndex] = useState(0);
  
  // Use either custom geofences passed from props or store geofences
  const displayGeofences = useMemo(() => {
    // Only log in development mode and not on every render
    if (__DEV__) {
      console.log('Geofence data computed:', { 
        customCount: customGeofences?.length || 0,
        storeCount: storeGeofences?.length || 0,
        propCount: geofences?.length || 0
      });
    }
    
    // Prioritize geofences from props, then custom geofences, then store geofences
    return geofences || customGeofences || storeGeofences || [];
  }, [geofences, customGeofences, storeGeofences]);
  
  // For employee role, use geofences from GeofenceStore or props
  const employeeGeofences = useMemo(() => {
    return geofences || availableGeofences || [];
  }, [geofences, availableGeofences]);
  
  // Handle selection and check if any user is selected
  const isUserSelected = !!selectedUser;
  const currentSelectedUserId = selectedUser?.id || selectedUserId;
  
  // Request current location from the device
  const requestCurrentLocation = useCallback(async (options?: any) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission not granted');
        return null;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        ...options
      });
      
      // Create location object with proper typing
      const userLocation: UserLocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: location.timestamp,
      };
      
      // Update location in store
      setUserLocation(userLocation);
      
      return userLocation;
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  }, [setUserLocation]);
  
  // Function to get the current location and center the map on it
  const getCurrentLocation = useCallback(async () => {
    try {
      // Indicate we are loading
      setIsLoadingLocation(true);

      // Check if we have a cached location that's recent enough
      const cachedLocation = getUserLocation();
      let shouldUpdateWithFresh = true;
      
      // First try to immediately center on cached location
      if (cachedLocation && cachedLocation.latitude && cachedLocation.longitude) {
        const now = Date.now();
        const locationAge = now - (cachedLocation.timestamp || 0);
        
        // If cache is fresh enough, use it immediately
        if (locationAge < LOCATION_CACHE_MAX_AGE) {
          mapRef.current?.animateToRegion({
            latitude: cachedLocation.latitude,
            longitude: cachedLocation.longitude,
            latitudeDelta: LATITUDE_DELTA / 4,
            longitudeDelta: LONGITUDE_DELTA / 4,
          }, 1000);
          
          // Still get a fresh location but don't animate to it
          if (locationAge < 5000) { // If very fresh (< 5 seconds)
            shouldUpdateWithFresh = false;
          }
        }
      }
      
      // Then get a fresh location in the background
      const freshLocation = await requestCurrentLocation({
        accuracy: Location.Accuracy.Balanced,
        maximumAge: 10000,
      });
      
      if (!freshLocation) {
        throw new Error('Could not get current location');
      }
      
      if (shouldUpdateWithFresh && mapRef.current) {
        console.log('Updating map with fresh location');
        
        mapRef.current.animateToRegion({
          latitude: freshLocation.latitude,
          longitude: freshLocation.longitude,
          latitudeDelta: LATITUDE_DELTA / 8,
          longitudeDelta: LONGITUDE_DELTA / 8,
        }, 1000);
      }
    } catch (error) {
      console.error('Error in getCurrentLocation:', error);
    } finally {
      setIsLoadingLocation(false);
    }
  }, [getUserLocation, requestCurrentLocation, setIsLoadingLocation]);
  
  // Calculate appropriate region to fit all tracked users
  const fitToUsers = useCallback(() => {
    // If there are no tracked users, try to find the device's location
    if (!trackedUsers.length) {
      console.log('No tracked users - trying to find device location');
      getCurrentLocation();
      return;
    }
    
    const locations = trackedUsers.map((user: TrackingUser) => ({
      latitude: user.location.latitude,
      longitude: user.location.longitude,
    }));
    
    // Improved validation to check for INVALID coordinates:
    // 1. Coordinates exactly at 0,0 (mid-Atlantic) are likely invalid defaults
    // 2. Coordinates exactly matching the React Native Maps default in San Francisco are likely invalid
    // 3. Any coordinates where either lat or lng is NaN, undefined, or null are invalid
    const validLocations = locations.filter((loc: LatLng) => {
      // Check for null or undefined
      if (loc.latitude == null || loc.longitude == null) {
        return false;
      }
      
      // Check for NaN values
      if (isNaN(loc.latitude) || isNaN(loc.longitude)) {
        return false;
      }
      
      // Check for exact 0,0 coordinates (likely default/uninitialized)
      if (loc.latitude === 0 && loc.longitude === 0) {
        return false;
      }
      
      // Check for React Native Maps default coordinates
      if (loc.latitude === 37.78825 && loc.longitude === -122.4324) {
        return false;
      }
      
      // If we pass all checks, this is likely a valid coordinate
      return true;
    });
    
    console.log(`Found ${validLocations.length} valid locations out of ${locations.length} total locations`);
    
    // If no valid locations after filtering, try device location
    if (validLocations.length === 0) {
      console.log('No valid tracked locations - trying to find device location');
      getCurrentLocation();
      return;
    }
    
    if (validLocations.length === 1) {
      // If only one user, center on that user with default zoom
      mapRef.current?.animateToRegion({
        latitude: validLocations[0].latitude,
        longitude: validLocations[0].longitude,
        latitudeDelta: LATITUDE_DELTA / 2,
        longitudeDelta: LONGITUDE_DELTA / 2,
      }, 500); // Faster animation (500ms instead of default)
      return;
    }
    
    // Find min and max coordinates to create a bounding box
    const minLat = Math.min(...validLocations.map((loc: LatLng) => loc.latitude));
    const maxLat = Math.max(...validLocations.map((loc: LatLng) => loc.latitude));
    const minLng = Math.min(...validLocations.map((loc: LatLng) => loc.longitude));
    const maxLng = Math.max(...validLocations.map((loc: LatLng) => loc.longitude));
    
    // Add padding to the bounding box
    const paddingFactor = 1.2; // Slightly more padding (1.2 instead of 1.1)
    const latDelta = (maxLat - minLat) * paddingFactor;
    const lngDelta = (maxLng - minLng) * paddingFactor;
    
    // Ensure minimum visible area even for nearby points
    const minDelta = 0.02; // Minimum delta to ensure enough context is visible
    
    mapRef.current?.animateToRegion({
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(latDelta, minDelta),
      longitudeDelta: Math.max(lngDelta, minDelta),
    }, 500); // Faster animation (500ms instead of default)
    
    console.log('Fit to users completed with region:', {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(latDelta, minDelta),
      longitudeDelta: Math.max(lngDelta, minDelta),
    });
  }, [trackedUsers, getCurrentLocation]);
  
  // Add a function to cycle through geofences for employees
  const cycleToNextGeofence = useCallback(() => {
    if (!employeeGeofences || employeeGeofences.length === 0) {
      console.log('No geofences available');
      getCurrentLocation();
      return;
    }

    // Get the next geofence index
    const nextIndex = (currentGeofenceIndex + 1) % employeeGeofences.length;
    setCurrentGeofenceIndex(nextIndex);
    
    const geofence = employeeGeofences[nextIndex];
    
    if (!geofence || !geofence.coordinates) {
      console.log('Invalid geofence data', geofence);
      return;
    }

    // Check geofence type and extract coordinates
    if (geofence.coordinates.type === 'Point') {
      const [longitude, latitude] = geofence.coordinates.coordinates as number[];
      
      // Convert radius to a number if it's a string
      const radius = typeof geofence.radius === 'string' 
        ? parseFloat(geofence.radius) 
        : geofence.radius || 100;
      
      // Calculate appropriate delta based on radius (to ensure geofence is visible)
      const latLngDelta = Math.max(radius / 111000 * 2, 0.005); // minimum 500m view
      
      // Animate to the geofence location
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: latLngDelta,
        longitudeDelta: latLngDelta * ASPECT_RATIO,
      }, 1000);
      
      console.log(`Navigated to geofence: ${geofence.name}`);
    }
  }, [employeeGeofences, currentGeofenceIndex, getCurrentLocation]);
  
  // Role-based handler for the locate button
  const handleLocatePress = useCallback(() => {
    console.log(`handleLocatePress called with user role: ${user?.role}`);
    
    // For employees, cycle through geofences
    if (user?.role === 'employee') {
      console.log('Employee role detected, cycling to next geofence');
      cycleToNextGeofence();
    } else {
      // For admins and other roles, use the original fit-to-users functionality
      console.log('Admin role detected, fitting to all users');
      console.log(`Current tracked users: ${trackedUsers.length}`);
      
      // If no tracked users are available, try to get current location
      if (!trackedUsers.length) {
        console.log('No tracked users available, using current location instead');
        getCurrentLocation();
      } else {
        fitToUsers();
      }
    }
  }, [user?.role, cycleToNextGeofence, fitToUsers, trackedUsers.length, getCurrentLocation]);
  
  // State management
  const region = useMemo<Region>(() => {
    console.log('LiveTrackingMap - initializing region state');
    console.log('LiveTrackingMap - initialRegion prop:', initialRegion);
    
    // Use the initial region passed from props if available
    if (initialRegion && 
        initialRegion.latitude !== 0 && 
        initialRegion.longitude !== 0) {
      console.log('LiveTrackingMap - USING initialRegion from props:', initialRegion);
      return initialRegion;
    }
    
    // Second, try to use the admin location from adminLocationStore
    const { adminLocation, mapInitialRegion } = useAdminLocationStore.getState();
    console.log('LiveTrackingMap - adminLocationStore state:', { adminLocation, mapInitialRegion });
    
    if (adminLocation && 
        adminLocation.latitude !== 0 && 
        adminLocation.longitude !== 0) {
      console.log('LiveTrackingMap - USING adminLocation from adminLocationStore:', adminLocation);
      return {
        latitude: adminLocation.latitude,
        longitude: adminLocation.longitude,
        latitudeDelta: LATITUDE_DELTA / 4, // More zoomed in
        longitudeDelta: LONGITUDE_DELTA / 4,
      };
    }
    
    // If we have a valid mapInitialRegion in the adminLocationStore, use that
    if (mapInitialRegion && 
        mapInitialRegion.latitude !== 0 && 
        mapInitialRegion.longitude !== 0) {
      console.log('LiveTrackingMap - USING mapInitialRegion from adminLocationStore:', mapInitialRegion);
      return mapInitialRegion;
    }
    
    // Third, try to use the device's current location from the cache
    if (cachedUserLocation && 
        cachedUserLocation.latitude !== 0 && 
        cachedUserLocation.longitude !== 0) {
      
      const now = Date.now();
      const cacheAge = now - cachedUserLocation.timestamp;
      
      // Only use cache if it's fresh enough
      if (cacheAge < LOCATION_CACHE_MAX_AGE) {
        console.log('LiveTrackingMap - USING cached location from Zustand:', cachedUserLocation);
        return {
          latitude: cachedUserLocation.latitude,
          longitude: cachedUserLocation.longitude,
          latitudeDelta: LATITUDE_DELTA / 4,
          longitudeDelta: LONGITUDE_DELTA / 4,
        };
      } else {
        console.log('LiveTrackingMap - cached location too old, age:', cacheAge);
      }
    }
    
    // Default fallback region - use Bangalore coordinates
    const bangaloreRegion = {
      latitude: 12.9716,
      longitude: 77.5946,
      latitudeDelta: LATITUDE_DELTA,
      longitudeDelta: LONGITUDE_DELTA,
    };
    
    console.log('LiveTrackingMap - USING Bangalore as fallback location:', bangaloreRegion);
    // Try to get current location in background
    requestCurrentLocation();
    
    return bangaloreRegion;
  }, [initialRegion, cachedUserLocation, requestCurrentLocation]);
  
  // Use saved map type from store if no specific type is provided
  const [selectedMapType, setSelectedMapType] = useState<MapType>(mapType || storedMapType);
  
  // Go to a specific user's location
  const goToUser = useCallback((user: TrackingUser) => {
    mapRef.current?.animateToRegion({
      latitude: user.location.latitude,
      longitude: user.location.longitude,
      latitudeDelta: LATITUDE_DELTA / 4,
      longitudeDelta: LONGITUDE_DELTA / 4,
    });
    
    // Select the user
    setSelectedUser(user);
  }, [setSelectedUser]);
  
  // Cycle through map types (standard, satellite, hybrid, terrain)
  const toggleMapType = useCallback(() => {
    const mapTypes: MapType[] = ['standard', 'satellite', 'hybrid', 'terrain'];
    const currentIndex = mapTypes.indexOf(selectedMapType);
    const nextIndex = (currentIndex + 1) % mapTypes.length;
    const newMapType = mapTypes[nextIndex];
    
    setSelectedMapType(newMapType);
    // Also update in the store
    setStoredMapType(newMapType);
  }, [selectedMapType, setStoredMapType]);
  
  // Handle marker press
  const handleMarkerPress = useCallback((user: TrackingUser) => {
    if (onMarkerPress) {
      onMarkerPress(user);
    } else {
      goToUser(user);
    }
  }, [goToUser, onMarkerPress]);
  
  // Memoize the custom map style to prevent unnecessary re-renders
  const mapStyle = useMemo(() => customMapStyle, [customMapStyle]);
  
  // Find a map center if no user is being tracked
  useEffect(() => {
    if (trackedUsers.length > 0) {
      fitToUsers();
    }
  }, [fitToUsers, trackedUsers.length]);
  
  // If initial map region is around 0,0 (South Atlantic) or San Francisco, override it
  useEffect(() => {
    // Check for coordinates near (0,0)
    const isNearZeroCoordinates = 
      Math.abs(region.latitude) < 0.1 && 
      Math.abs(region.longitude) < 0.1;
      
    // Check for San Francisco coordinates (react-native-maps default)
    const isNearSanFrancisco =
      Math.abs(region.latitude - 37.78) < 0.1 && 
      Math.abs(region.longitude + 122.42) < 0.1;
    
    if (isNearZeroCoordinates || isNearSanFrancisco) {
      console.log(`LiveTrackingMap - detected coordinates near ${isNearZeroCoordinates ? '(0,0)' : 'San Francisco'}, attempting to get actual location`);
      
      // First check the adminLocationStore
      const { adminLocation } = useAdminLocationStore.getState();
      if (adminLocation && 
          adminLocation.latitude !== 0 && 
          adminLocation.longitude !== 0) {
        
        console.log('LiveTrackingMap - using admin location from store:', adminLocation);
        mapRef.current?.animateToRegion({
          latitude: adminLocation.latitude,
          longitude: adminLocation.longitude,
          latitudeDelta: LATITUDE_DELTA / 8,
          longitudeDelta: LONGITUDE_DELTA / 8,
        });
        return;
      }
      
      // If adminLocation is not available, try to get the current location
      requestCurrentLocation({
        accuracy: Location.Accuracy.Balanced
      }).then(location => {
        if (location) {
          console.log('LiveTrackingMap - found actual location, updating map:', location);
          mapRef.current?.animateToRegion({
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: LATITUDE_DELTA / 8, // More zoomed in
            longitudeDelta: LONGITUDE_DELTA / 8,
          });
        } else {
          // If we still can't get location, use Bangalore as fallback
          console.log('LiveTrackingMap - could not get location, using Bangalore fallback');
          mapRef.current?.animateToRegion({
            latitude: 12.9716,
            longitude: 77.5946,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA,
          });
        }
      });
    }
  }, [region.latitude, region.longitude, requestCurrentLocation]);
  
  // Save region changes to store for persistence
  const handleRegionChangeComplete = useCallback((newRegion: Region) => {
    // First call the callback if provided
    if (onRegionChangeComplete) {
      onRegionChangeComplete(newRegion);
    }
    
    // Then save to store (delayed to avoid excessive updates)
    setCurrentRegion(newRegion);
  }, [onRegionChangeComplete, setCurrentRegion]);
  
  // Memoize the rendering of geofences to prevent unnecessary re-renders
  const memoizedGeofences = useMemo(() => {
    try {
      if (!showGeofences || !displayGeofences || displayGeofences.length === 0) {
        if (__DEV__) {
          console.log('No geofences to render', { showGeofences, geofenceCount: displayGeofences?.length || 0 });
        }
        return null;
      }
      
      return displayGeofences.map((geofence: Geofence) => {
        try {
          // First, check if the geofence object is complete with all required properties
          if (!geofence || !geofence.coordinates) {
            console.warn('Invalid geofence data (missing coordinates):', geofence?.id || 'unknown');
            return null;
          }

          const isCurrent = currentGeofence?.id === geofence.id;
          const fillColor = isCurrent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.1)';
          const strokeColor = isCurrent ? '#10b981' : '#f59e0b';
          
          // Only support 'Point' type for now (circle geofences)
          if (geofence.coordinates.type === 'Point') {
            try {
              // Verify that coordinates array exists and has enough elements
              if (!Array.isArray(geofence.coordinates.coordinates) || 
                  geofence.coordinates.coordinates.length < 2) {
                console.warn('Invalid geofence coordinates array:', 
                  geofence.id, geofence.coordinates.coordinates);
                return null;
              }
              
              const [longitude, latitude] = geofence.coordinates.coordinates as number[];
              
              // Enhanced validation - check that coordinates are valid numbers
              if (isNaN(latitude) || isNaN(longitude)) {
                console.warn('Invalid geofence coordinates (NaN values):', geofence.id);
                return null;
              }

              // Ensure radius is a number
              const radius = typeof geofence.radius === 'string' 
                ? parseFloat(geofence.radius) 
                : geofence.radius;
              
              if (isNaN(radius) || radius <= 0) {
                console.warn('Invalid geofence radius:', radius, geofence.id);
                return null;
              }
              
              // Use geofence color from props if available
              const geofenceColor = geofenceColors && geofence.id 
                ? geofenceColors[geofence.id.toString()] 
                : null;
              
              return (
                <Circle
                  key={`geofence-${geofence.id}`}
                  center={{
                    latitude,
                    longitude
                  }}
                  radius={radius}
                  fillColor={geofenceColor || fillColor}
                  strokeColor={geofenceColor || strokeColor}
                  strokeWidth={2}
                />
              );
            } catch (innerError) {
              console.error('Error processing circle geofence:', innerError, geofence?.id);
              return null;
            }
          }
          
          // Add support for polygon geofences in the future
          
          return null;
        } catch (innerError) {
          console.error('Error processing individual geofence:', innerError, geofence?.id);
          return null;
        }
      });
    } catch (error) {
      console.error('Critical error in geofence rendering:', error);
      return null;
    }
  }, [showGeofences, displayGeofences, currentGeofence, geofenceColors]);
  
  // Add state for button feedback
  const [activeButton, setActiveButton] = useState<string | null>(null);

  // Enhanced button press handlers with feedback
  const handleMapTypePress = useCallback(() => {
    setActiveButton('mapType');
    toggleMapType();
    setTimeout(() => setActiveButton(null), 300);
  }, [toggleMapType]);

  const handleLocatePressWithFeedback = useCallback(() => {
    console.log('Locate button pressed with feedback');
    setActiveButton('locate');
    
    // For locate button, ensure we have the latest tracked users
    handleLocatePress();
    
    setTimeout(() => setActiveButton(null), 300);
  }, [handleLocatePress]);

  const handleMyLocationPress = useCallback(() => {
    setActiveButton('myLocation');
    getCurrentLocation();
    setTimeout(() => setActiveButton(null), 300);
  }, [getCurrentLocation]);

  // Add this state for the fullscreen toggle
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Add state for fullscreen mode related adjustments
  const [headerHeight, setHeaderHeight] = useState(0);

  // Toggle fullscreen mode with proper adjustments
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => {
      const newValue = !prev;
      
      // Adjust any other UI elements or notify parent components if needed
      console.log(`Toggling fullscreen mode: ${newValue ? 'ON' : 'OFF'}`);
      
      // Hide status bar in fullscreen mode on Android
      if (Platform.OS === 'android') {
        if (newValue) {
          RNStatusBar.setHidden(true);
        } else {
          RNStatusBar.setHidden(false);
        }
      }
      
      return newValue;
    });
  }, []);

  // Measure header height for smoother transitions
  const onHeaderLayout = useCallback((event: { nativeEvent: { layout: { height: number } } }) => {
    const { height } = event.nativeEvent.layout;
    setHeaderHeight(height);
  }, []);

  // Helper function to format user details
  const formatCoordinate = (coord: number) => {
    return coord.toFixed(6);
  };

  const formatBatteryLevel = (level?: number) => {
    if (level === undefined || level === null) return 'Unknown';
    return `${Math.round(level * 100)}%`;
  };

  const formatTimeSince = (timestamp: number) => {
    const now = Date.now();
    const diffMs = now - timestamp;
    
    // Less than a minute
    if (diffMs < 60000) {
      return 'Just now';
    }
    
    // Less than an hour
    if (diffMs < 3600000) {
      const minutes = Math.floor(diffMs / 60000);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    
    // Less than a day
    if (diffMs < 86400000) {
      const hours = Math.floor(diffMs / 3600000);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    // More than a day
    const days = Math.floor(diffMs / 86400000);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  };

  // Process user routes for polylines
  const routesForDisplay = useMemo(() => {
    try {
      // Start with the routes passed directly via props
      let routes: Record<string, Array<LatLng>> = {};
      
      // If routeCoordinates prop is provided (for employee view), create a route for current user
      if (routeCoordinates && routeCoordinates.length > 1) {
        // Validate coordinates before adding
        const validCoordinates = routeCoordinates.filter(coord => 
          coord && 
          typeof coord.latitude === 'number' && 
          typeof coord.longitude === 'number' &&
          !isNaN(coord.latitude) && 
          !isNaN(coord.longitude) &&
          // Exclude points at 0,0 (likely defaults)
          !(coord.latitude === 0 && coord.longitude === 0)
        );
        
        if (validCoordinates.length > 1) {
          routes['currentUser'] = validCoordinates;
        }
      }
      
      // If userRoutes is provided (for admin view), use those
      if (userRoutes) {
        // Process each user route to ensure valid coordinates
        Object.keys(userRoutes).forEach(userId => {
          const route = userRoutes[userId];
          if (route && route.length > 1) {
            // Validate coordinates
            const validRoute = route.filter(coord => 
              coord && 
              typeof coord.latitude === 'number' && 
              typeof coord.longitude === 'number' &&
              !isNaN(coord.latitude) && 
              !isNaN(coord.longitude) &&
              // Exclude points at 0,0 (likely defaults)
              !(coord.latitude === 0 && coord.longitude === 0)
            );
            
            if (validRoute.length > 1) {
              routes[userId] = validRoute;
            }
          }
        });
      }
      
      // If we don't have explicit routes but have userPaths from the store, use those
      if (Object.keys(routes).length === 0 && userPaths && showUserPaths) {
        // Transform userPaths to the format needed for polylines
        Object.keys(userPaths).forEach(userId => {
          const path = userPaths[userId];
          if (path && path.length > 1) {
            // Validate coordinates
            const validPath = path
              .filter((point: any) => 
                point && 
                typeof point.latitude === 'number' && 
                typeof point.longitude === 'number' &&
                !isNaN(point.latitude) && 
                !isNaN(point.longitude) &&
                // Exclude points at 0,0 (likely defaults)
                !(point.latitude === 0 && point.longitude === 0)
              )
              .map((point: any) => ({
                latitude: point.latitude, 
                longitude: point.longitude
              }));
              
            if (validPath.length > 1) {
              routes[userId] = validPath;
            }
          }
        });
      }
      
      // Apply route simplification to avoid having too many points on longer routes
      // Only keep every nth point for routes with many points (improves performance)
      Object.keys(routes).forEach(userId => {
        const route = routes[userId];
        if (route && route.length > 100) {
          const simplifyFactor = Math.floor(route.length / 100);
          if (simplifyFactor > 1) {
            const simplified = route.filter((_, index) => index % simplifyFactor === 0 || index === route.length - 1);
            routes[userId] = simplified;
          }
        }
      });
      
      return routes;
    } catch (error) {
      console.error('Error processing routes for display:', error);
      return {};
    }
  }, [routeCoordinates, userRoutes, userPaths, showUserPaths]);

  // Select colors for routes
  const getRouteColor = useCallback((userId: string) => {
    // If this is the selected user or the current user's route, use a highlighted color
    if (userId === currentSelectedUserId || userId === 'currentUser') {
      return '#3b82f6'; // bright blue
    }
    
    // If colors are provided via props, use those
    if (pathStrokeColors && pathStrokeColors[userId]) {
      return pathStrokeColors[userId];
    }
    
    // Default colors based on user ID (generates consistent colors for the same user)
    const colors = [
      '#3b82f6', // blue
      '#ef4444', // red
      '#10b981', // green
      '#f59e0b', // orange
      '#8b5cf6', // purple
      '#ec4899', // pink
    ];
    
    // Hash the userId to get a consistent index
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }, [currentSelectedUserId, pathStrokeColors]);

  // Add helper to get stroke width based on selection state
  const getRouteStrokeWidth = useCallback((userId: string) => {
    // If this is the selected user or current user's route, make it thicker
    if (userId === currentSelectedUserId || userId === 'currentUser') {
      return 5; // Thicker line for selected routes
    }
    return 3; // Default line thickness
  }, [currentSelectedUserId]);

  // Add helper to get z-index for routes
  const getRouteZIndex = useCallback((userId: string) => {
    // Higher z-index for selected routes ensures they appear on top
    if (userId === currentSelectedUserId || userId === 'currentUser') {
      return 10;
    }
    return 5;
  }, [currentSelectedUserId]);

  return (
    <View style={[
      styles.container, 
      containerStyle,
      isFullscreen && styles.fullscreenContainer
    ]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} hidden={isFullscreen} />
      
      <View 
        style={[
          styles.mapHeader,
          isFullscreen && styles.hidden,
          colorScheme === 'dark' 
            ? styles.mapHeaderDark 
            : styles.mapHeaderLight,
          { borderColor }
        ]}
        onLayout={onHeaderLayout}
      >
        <View style={styles.mapHeaderContent}>
          <View style={styles.mapInfoSection}>
            <Text style={[styles.mapInfoTitle, { color: textColor }]}>
              {user?.role === 'employee' ? 'My Areas' : 'Tracked Users'}
            </Text>
            <View style={styles.mapInfoDetail}>
              <Ionicons 
                name={user?.role === 'employee' ? 'map-outline' : 'people-outline'} 
                size={16} 
                color={primaryColor} 
                style={styles.mapInfoIcon}
              />
              <Text style={[styles.mapInfoValue, { color: textColor }]}>
                {user?.role === 'employee' 
                  ? `${employeeGeofences.length} ${employeeGeofences.length === 1 ? 'area' : 'areas'}`
                  : `${trackedUsers.length} ${trackedUsers.length === 1 ? 'user' : 'users'}`}
              </Text>
            </View>
          </View>
          
          <View style={styles.mapInfoDivider} />
          
          <View style={styles.mapInfoSection}>
            <Text style={[styles.mapInfoTitle, { color: textColor }]}>
              {user?.role === 'employee' ? 'My Status' : 'Active Users'}
            </Text>
            <View style={styles.mapInfoDetail}>
              <View style={[
                styles.statusIndicator, 
                { backgroundColor: user?.role === 'employee' ? (isInGeofence ? '#10b981' : '#ef4444') : '#10b981' }
              ]} />
              <Text style={[styles.mapInfoValue, { color: textColor }]}>
                {user?.role === 'employee' 
                  ? (isInGeofence ? 'In Geofence' : 'Outside Geofence')
                  : `${trackedUsers.filter((u: TrackingUser) => u.isActive).length} Active`}
              </Text>
            </View>
          </View>
        </View>
      </View>
      
      <MapView
        ref={mapRef}
        style={[styles.map, isFullscreen && styles.fullscreenMap]}
        provider={PROVIDER_GOOGLE}
        region={region}
        onRegionChange={onRegionChange}
        onRegionChangeComplete={(newRegion) => {
          // Call the original handler if provided
          if (onRegionChangeComplete) {
            onRegionChangeComplete(newRegion);
          }
          
          // Only update stored region if this was a user-initiated change
          // This prevents the map from defaulting to San Francisco coordinates
          const isSanFrancisco = 
            Math.abs(newRegion.latitude - 37.78) < 0.1 && 
            Math.abs(newRegion.longitude + 122.42) < 0.1;
            
          if (!isSanFrancisco) {
            handleRegionChangeComplete(newRegion);
          } else {
            console.log('Prevented update to San Francisco coordinates');
            // Re-center to our region to override the default
            mapRef.current?.animateToRegion(region, 100);
          }
        }}
        onPress={onPress}
        onLongPress={onLongPress}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={showsMyLocationButton}
        followsUserLocation={followsUserLocation}
        showsCompass={showsCompass}
        showsScale={showsScale}
        showsTraffic={showsTraffic}
        showsIndoors={showsIndoors}
        showsBuildings={showsBuildings}
        showsPointsOfInterest={showsPointsOfInterest}
        zoomEnabled={zoomEnabled}
        zoomControlEnabled={zoomControlEnabled}
        rotateEnabled={rotateEnabled}
        scrollEnabled={scrollEnabled}
        pitchEnabled={pitchEnabled}
        toolbarEnabled={toolbarEnabled}
        mapType={selectedMapType}
        customMapStyle={mapStyle}
      >
        {/* Render user markers */}
        {trackedUsers.map((user: TrackingUser) => {
          if (renderCustomMarker) {
            return renderCustomMarker(user);
          }
          
          // Skip users with invalid coordinates
          if (!user.location || 
              typeof user.location.latitude !== 'number' ||
              typeof user.location.longitude !== 'number' ||
              isNaN(user.location.latitude) || 
              isNaN(user.location.longitude) ||
              (user.location.latitude === 0 && user.location.longitude === 0)) {
            console.warn('Skipping marker for user with invalid location:', user.id);
            return null;
          }
          
          // Enhanced marker size for better visibility
          const markerSize = user.id === currentSelectedUserId ? 42 : 36; 
          
          // Enhanced marker color based on status
          const markerColor = user.id === currentSelectedUserId ? 
              '#f97316' : // Orange for selected
              (user.isActive ? '#3b82f6' : '#9ca3af'); // Blue for active, gray for inactive
          
          return (
            <LocationMarker
              key={`user-${user.id}`}
              location={user.location}
              title={user.name}
              description={`Last updated: ${new Date(
                user.lastUpdated
              ).toLocaleTimeString()}`}
              isActive={user.isActive}
              batteryLevel={user.batteryLevel}
              showBatteryIndicator={true}
              trackedUserId={user.id}
              isSelected={user.id === currentSelectedUserId}
              onPress={() => handleMarkerPress(user)}
              zIndex={user.id === currentSelectedUserId ? 5 : 1}
              employeeLabel={user.employeeLabel || user.name}
              employeeNumber={user.employeeNumber}
              deviceInfo={user.deviceInfo}
              size={markerSize}
              color={markerColor}
            />
          );
        })}
        
        {/* Render user paths if enabled */}
        {showUserPaths && Object.keys(routesForDisplay).map(userId => {
          const route = routesForDisplay[userId];
          if (route && route.length > 1) {
            const isSelected = userId === currentSelectedUserId || userId === 'currentUser';
            return (
              <Polyline
                key={`path-${userId}-${route.length}`}
                coordinates={route}
                strokeWidth={getRouteStrokeWidth(userId)}
                strokeColor={getRouteColor(userId)}
                lineCap="round"
                lineJoin="round"
                zIndex={getRouteZIndex(userId)}
              />
            );
          }
          return null;
        })}
        
        {/* Render geofences if enabled */}
        {showGeofences && memoizedGeofences}
      </MapView>
      
      {/* Map controls */}
      {showControls && (
        <View style={[styles.controlsContainer, isFullscreen && styles.controlsContainerFullscreen]}>
          {/* Fullscreen toggle button */}
          <View style={styles.controlWithLabel}>
            <TouchableOpacity
              style={[
                styles.controlButton, 
                { backgroundColor: cardColor },
                activeButton === 'fullscreen' && styles.activeButton
              ]}
              onPress={() => {
                setActiveButton('fullscreen');
                toggleFullscreen();
                setTimeout(() => setActiveButton(null), 300);
              }}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={isFullscreen ? "contract" : "expand"} 
                size={24} 
                color={activeButton === 'fullscreen' ? primaryColor : textColor}
              />
            </TouchableOpacity>
            <Text style={[styles.controlLabel, { color: textColor }]}>
              {isFullscreen ? 'Exit Full' : 'Fullscreen'}
            </Text>
          </View>
          
          {/* Map type toggle button */}
          <View style={styles.controlWithLabel}>
            <TouchableOpacity
              style={[
                styles.controlButton, 
                { backgroundColor: cardColor },
                activeButton === 'mapType' && styles.activeButton
              ]}
              onPress={handleMapTypePress}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="map" 
                size={24} 
                color={activeButton === 'mapType' ? primaryColor : textColor}
              />
            </TouchableOpacity>
            <Text style={[styles.controlLabel, { color: textColor }]}>Map Type</Text>
          </View>
          
          {/* Modified locate button with user-role specific behavior */}
          <View style={styles.controlWithLabel}>
            <TouchableOpacity
              style={[
                styles.controlButton, 
                { backgroundColor: cardColor, marginTop: 10 },
                activeButton === 'locate' && styles.activeButton,
                (user?.role === 'employee' ? employeeGeofences.length === 0 : !trackedUsers.length) && styles.disabledButton
              ]}
              onPress={handleLocatePressWithFeedback}
              disabled={user?.role === 'employee' ? employeeGeofences.length === 0 : !trackedUsers.length}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="locate" 
                size={24} 
                color={(user?.role === 'employee' ? employeeGeofences.length > 0 : trackedUsers.length > 0) 
                  ? (activeButton === 'locate' ? primaryColor : textColor) 
                  : borderColor}
              />
            </TouchableOpacity>
            <Text style={[
              styles.controlLabel, 
              { color: textColor, marginTop: 4 },
              (user?.role === 'employee' ? employeeGeofences.length === 0 : !trackedUsers.length) && { opacity: 0.5 }
            ]}>
              {user?.role === 'employee' ? 'Find Areas' : 'Find All'}
            </Text>
          </View>

          {/* Current location button */}
          <View style={styles.controlWithLabel}>
            <TouchableOpacity
              style={[
                styles.controlButton, 
                { backgroundColor: cardColor, marginTop: 10 },
                activeButton === 'myLocation' && styles.activeButton,
                isLoadingLocation && styles.loadingButton
              ]}
              onPress={handleMyLocationPress}
              disabled={isLoadingLocation}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="navigate" 
                size={24} 
                color={isLoadingLocation ? borderColor : (activeButton === 'myLocation' ? primaryColor : textColor)}
              />
              {isLoadingLocation && (
                <ActivityIndicator 
                  size="small" 
                  color={primaryColor} 
                  style={styles.loader} 
                />
              )}
            </TouchableOpacity>
            <Text style={[styles.controlLabel, { color: textColor, marginTop: 4 }]}>My Location</Text>
          </View>
        </View>
      )}

      {/* User detail panel */}
      {user?.role !== 'employee' && selectedUser && (
        <View style={[
          styles.userDetailPanel,
          isFullscreen && styles.userDetailPanelFullscreen,
          { backgroundColor: cardColor }
        ]}>
          <View style={styles.userDetailHeader}>
            <Text style={[styles.userDetailName, { color: textColor }]}>
              {selectedUser.name || 'Unknown User'}
            </Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setSelectedUser(null)}
            >
              <Ionicons name="close" size={20} color={textColor} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.userDetailContent}>
            <View style={styles.userDetailRow}>
              <View style={styles.userDetailItem}>
                <Ionicons name="time-outline" size={16} color={primaryColor} style={styles.userDetailIcon} />
                <Text style={[styles.userDetailLabel, { color: textColor }]}>Last Update:</Text>
                <Text style={[styles.userDetailValue, { color: textColor }]}>
                  {selectedUser.lastUpdated ? formatTimeSince(selectedUser.lastUpdated) : 'Unknown'}
                </Text>
              </View>
              
              <View style={styles.userDetailItem}>
                <Ionicons name="battery-half-outline" size={16} color={primaryColor} style={styles.userDetailIcon} />
                <Text style={[styles.userDetailLabel, { color: textColor }]}>Battery:</Text>
                <Text style={[styles.userDetailValue, { color: textColor }]}>
                  {formatBatteryLevel(selectedUser.batteryLevel)}
                </Text>
              </View>
            </View>
            
            <View style={styles.userDetailRow}>
              <View style={styles.userDetailItem}>
                <Ionicons name="locate-outline" size={16} color={primaryColor} style={styles.userDetailIcon} />
                <Text style={[styles.userDetailLabel, { color: textColor }]}>Location:</Text>
                <Text style={[styles.userDetailValue, { color: textColor }]}>
                  {selectedUser.location && selectedUser.location.latitude && selectedUser.location.longitude
                    ? `${formatCoordinate(selectedUser.location.latitude)}, ${formatCoordinate(selectedUser.location.longitude)}`
                    : 'Unknown location'
                  }
                </Text>
              </View>
            </View>
            
            {selectedUser.location && selectedUser.location.accuracy && (
              <View style={styles.userDetailRow}>
                <View style={styles.userDetailItem}>
                  <Ionicons name="radio-outline" size={16} color={primaryColor} style={styles.userDetailIcon} />
                  <Text style={[styles.userDetailLabel, { color: textColor }]}>Accuracy:</Text>
                  <Text style={[styles.userDetailValue, { color: textColor }]}>
                    {Math.round(selectedUser.location.accuracy)} meters
                  </Text>
                </View>
              </View>
            )}
            
            <TouchableOpacity 
              style={[styles.centerButton, { backgroundColor: primaryColor }]}
              onPress={() => selectedUser && goToUser(selectedUser)}
              disabled={!selectedUser || !selectedUser.location}
            >
              <Ionicons name="navigate" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.centerButtonText}>Center on User</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    paddingTop: Platform.OS === 'ios' ? 60 : RNStatusBar.currentHeight || 0,
  },
  fullscreenContainer: {
    paddingTop: 0, // Remove padding in fullscreen mode
  },
  map: {
    width: '100%',
    height: '100%',
  },
  fullscreenMap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  controlsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : RNStatusBar.currentHeight ? RNStatusBar.currentHeight + 10 : 40,
    right: 16,
    zIndex: 10,
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  controlsContainerFullscreen: {
    top: Platform.OS === 'ios' ? 40 : 20, // Adjust position in fullscreen mode
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  activeButton: {
    transform: [{ scale: 0.95 }],
    shadowOpacity: 0.1,
  },
  disabledButton: {
    opacity: 0.5,
  },
  loadingButton: {
    opacity: 0.8,
  },
  controlWithLabel: {
    alignItems: 'center',
    marginBottom: 16,
  },
  controlLabel: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  userButtonsContainer: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    zIndex: 10,
  },
  button: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 4,
  },
  buttonText: {
    fontWeight: 'bold',
  },
  loadingIndicator: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
    right: 6,
    top: 6,
  },
  loader: {
    position: 'absolute',
  },
  mapHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : RNStatusBar.currentHeight || 0,
    left: 16,
    right: 16,
    zIndex: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
    overflow: 'hidden',
    borderWidth: 1,
  },
  mapHeaderLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  mapHeaderDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  hidden: {
    display: 'none',
  },
  mapHeaderContent: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapInfoSection: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  mapInfoTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.7,
  },
  mapInfoDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapInfoIcon: {
    marginRight: 6,
  },
  mapInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 10,
  },
  mapInfoDivider: {
    width: 1,
    height: '80%',
    marginHorizontal: 12,
    backgroundColor: 'rgba(150, 150, 150, 0.3)',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  userDetailPanel: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    overflow: 'hidden',
    zIndex: 10,
  },
  userDetailPanelFullscreen: {
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 0,
  },
  userDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  userDetailName: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  userDetailContent: {
    padding: 12,
  },
  userDetailRow: {
    marginBottom: 12,
  },
  userDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  userDetailIcon: {
    marginRight: 6,
  },
  userDetailLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 6,
  },
  userDetailValue: {
    fontSize: 14,
  },
  centerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  centerButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default React.memo(LiveTrackingMap); 