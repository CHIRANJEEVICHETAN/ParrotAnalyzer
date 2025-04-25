import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import useGeofenceStore from '../store/geofenceStore';
import { useSocket } from './useSocket';
import { Geofence, GeoCoordinates, Location, GeofenceTransitionEvent } from '../types/liveTracking';
import useLocationStore from '../store/locationStore';

interface UseGeofencingOptions {
  onGeofenceEnter?: (geofence: Geofence) => void;
  onGeofenceExit?: (geofence: Geofence) => void;
  onGeofenceCreated?: (geofence: Geofence) => void;
  onGeofenceUpdated?: (geofence: Geofence) => void;
  onGeofenceDeleted?: (id: number) => void;
  onError?: (error: string) => void;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export function useGeofencing({
  onGeofenceEnter,
  onGeofenceExit,
  onGeofenceCreated,
  onGeofenceUpdated,
  onGeofenceDeleted,
  onError
}: UseGeofencingOptions = {}) {
  const { token, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  
  const { 
    fetchGeofences, 
    geofences, 
    selectedGeofence,
    createGeofence,
    updateGeofence,
    deleteGeofence,
    selectGeofence,
    setError,
    startEditing,
    startCreating,
    cancelEdit,
    updateEditCoordinates
  } = useGeofenceStore();
  
  const { currentGeofenceId, isInGeofence } = useLocationStore();
  
  // Socket connection with geofence transition handler
  const { socket } = useSocket({
    onGeofenceTransition: (event: GeofenceTransitionEvent) => {
      const geofence = geofences.find(g => g.id === event.geofenceId);
      
      if (!geofence) return;
      
      // Call appropriate callback based on transition direction
      if (event.isInside) {
        onGeofenceEnter?.(geofence);
      } else {
        onGeofenceExit?.(geofence);
      }
    }
  });

  // Initialize - fetch geofences on mount
  useEffect(() => {
    const init = async () => {
      if (!token || initialized) return;
      
      setIsLoading(true);
      try {
        await fetchGeofences();
        setInitialized(true);
      } catch (error: any) {
        setError(error.message || 'Failed to fetch geofences');
        onError?.(error.message || 'Failed to fetch geofences');
      } finally {
        setIsLoading(false);
      }
    };
    
    init();
  }, [token, initialized, fetchGeofences, setError, onError]);

  // Get the current geofence that the user is in
  const getCurrentGeofence = useCallback((): Geofence | null => {
    if (!currentGeofenceId || !isInGeofence) return null;
    
    return geofences.find(g => g.id === currentGeofenceId) || null;
  }, [geofences, currentGeofenceId, isInGeofence]);

  // Check if a location is inside any geofence
  const isLocationInAnyGeofence = useCallback((location: Location): boolean => {
    if (!geofences.length) return false;
    
    // Simple point-in-circle check
    return geofences.some(geofence => {
      // Only support circle geofences for client-side checking
      if (geofence.coordinates.type !== 'Point') return false;
      
      const [longitude, latitude] = geofence.coordinates.coordinates as number[];
      
      // Ensure radius is a number
      const radius = typeof geofence.radius === 'string' 
        ? parseFloat(geofence.radius) 
        : geofence.radius;
      
      if (isNaN(radius) || radius <= 0) {
        console.warn('Invalid geofence radius:', radius, geofence.id);
        return false;
      }
      
      // Calculate distance using Haversine formula
      const R = 6371e3; // Earth radius in meters
      const φ1 = (location.latitude * Math.PI) / 180;
      const φ2 = (latitude * Math.PI) / 180;
      const Δφ = ((latitude - location.latitude) * Math.PI) / 180;
      const Δλ = ((longitude - location.longitude) * Math.PI) / 180;
      
      const a = 
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      
      // Check if inside radius
      return distance <= radius;
    });
  }, [geofences]);

  // Check if a location is inside a specific geofence
  const isLocationInGeofence = useCallback((
    location: Location, 
    geofenceId: number
  ): boolean => {
    const geofence = geofences.find(g => g.id === geofenceId);
    
    if (!geofence) return false;
    
    // Only support circle geofences for client-side checking
    if (geofence.coordinates.type !== 'Point') return false;
    
    const [longitude, latitude] = geofence.coordinates.coordinates as number[];
    
    // Ensure radius is a number
    const radius = typeof geofence.radius === 'string' 
      ? parseFloat(geofence.radius) 
      : geofence.radius;
    
    if (isNaN(radius) || radius <= 0) {
      console.warn('Invalid geofence radius:', radius, geofence.id);
      return false;
    }
    
    // Calculate distance using Haversine formula
    const R = 6371e3; // Earth radius in meters
    const φ1 = (location.latitude * Math.PI) / 180;
    const φ2 = (latitude * Math.PI) / 180;
    const Δφ = ((latitude - location.latitude) * Math.PI) / 180;
    const Δλ = ((longitude - location.longitude) * Math.PI) / 180;
    
    const a = 
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    // Check if inside radius
    return distance <= radius;
  }, [geofences]);

  // Create a new geofence with confirmation
  const createGeofenceWithConfirmation = useCallback(async (
    name: string, 
    coordinates: GeoCoordinates, 
    radius: number
  ): Promise<Geofence | null> => {
    try {
      setIsLoading(true);
      
      // Call the store action
      await createGeofence(name, coordinates, radius);
      
      // Get the created geofence (assuming it's the last in the array)
      const newGeofence = geofences[geofences.length - 1];
      
      // Call callback if provided
      if (newGeofence) {
        onGeofenceCreated?.(newGeofence);
        
        // Show success message
        Alert.alert(
          'Geofence Created',
          `Geofence "${name}" has been created successfully.`,
          [{ text: 'OK' }]
        );
      }
      
      return newGeofence || null;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to create geofence';
      setError(errorMsg);
      onError?.(errorMsg);
      
      Alert.alert(
        'Error',
        `Failed to create geofence: ${errorMsg}`,
        [{ text: 'OK' }]
      );
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [createGeofence, geofences, setError, onError, onGeofenceCreated]);

  // Update a geofence with confirmation
  const updateGeofenceWithConfirmation = useCallback(async (
    id: number, 
    data: Partial<Omit<Geofence, 'id'>>
  ): Promise<Geofence | null> => {
    try {
      setIsLoading(true);
      
      // Call the store action
      await updateGeofence(id, data);
      
      // Get the updated geofence
      const updatedGeofence = geofences.find(g => g.id === id);
      
      // Call callback if provided
      if (updatedGeofence) {
        onGeofenceUpdated?.(updatedGeofence);
        
        // Show success message
        Alert.alert(
          'Geofence Updated',
          `Geofence "${updatedGeofence.name}" has been updated successfully.`,
          [{ text: 'OK' }]
        );
      }
      
      return updatedGeofence || null;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to update geofence';
      setError(errorMsg);
      onError?.(errorMsg);
      
      Alert.alert(
        'Error',
        `Failed to update geofence: ${errorMsg}`,
        [{ text: 'OK' }]
      );
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [updateGeofence, geofences, setError, onError, onGeofenceUpdated]);

  // Delete a geofence with confirmation
  const deleteGeofenceWithConfirmation = useCallback(async (
    id: number
  ): Promise<boolean> => {
    return new Promise(resolve => {
      // Ask for confirmation first
      Alert.alert(
        'Delete Geofence',
        'Are you sure you want to delete this geofence? This action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false)
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                setIsLoading(true);
                
                // Call the store action
                await deleteGeofence(id);
                
                // Call callback if provided
                onGeofenceDeleted?.(id);
                
                // Show success message
                Alert.alert(
                  'Geofence Deleted',
                  'Geofence has been deleted successfully.',
                  [{ text: 'OK' }]
                );
                
                resolve(true);
              } catch (error: any) {
                const errorMsg = error.message || 'Failed to delete geofence';
                setError(errorMsg);
                onError?.(errorMsg);
                
                Alert.alert(
                  'Error',
                  `Failed to delete geofence: ${errorMsg}`,
                  [{ text: 'OK' }]
                );
                
                resolve(false);
              } finally {
                setIsLoading(false);
              }
            }
          }
        ]
      );
    });
  }, [deleteGeofence, setError, onError, onGeofenceDeleted]);

  // Calculate coordinate for a circle geofence at a specific radius from center point
  const calculateCoordinateAtRadius = useCallback((
    center: [number, number], 
    radiusInMeters: number,
    angleInDegrees: number
  ): [number, number] => {
    // Convert degrees to radians
    const angleInRadians = (angleInDegrees * Math.PI) / 180;
    
    // Earth's radius in meters
    const R = 6371e3;
    
    // Extract center coordinates
    const [centerLng, centerLat] = center;
    
    // Convert to radians
    const centerLatRad = (centerLat * Math.PI) / 180;
    const centerLngRad = (centerLng * Math.PI) / 180;
    
    // Convert radius to angular distance in radians
    const angularDistance = radiusInMeters / R;
    
    // Calculate new latitude
    const newLatRad = Math.asin(
      Math.sin(centerLatRad) * Math.cos(angularDistance) +
      Math.cos(centerLatRad) * Math.sin(angularDistance) * Math.cos(angleInRadians)
    );
    
    // Calculate new longitude
    const newLngRad = centerLngRad + Math.atan2(
      Math.sin(angleInRadians) * Math.sin(angularDistance) * Math.cos(centerLatRad),
      Math.cos(angularDistance) - Math.sin(centerLatRad) * Math.sin(newLatRad)
    );
    
    // Convert back to degrees
    const newLat = (newLatRad * 180) / Math.PI;
    const newLng = (newLngRad * 180) / Math.PI;
    
    return [newLng, newLat];
  }, []);

  // Create a circular geofence boundary
  const createCircularBoundary = useCallback((
    center: [number, number], 
    radiusInMeters: number,
    numPoints: number = 32
  ): GeoCoordinates => {
    // Generate points around the circle
    const coordinates: number[][] = [];
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i * 360) / numPoints;
      coordinates.push(calculateCoordinateAtRadius(center, radiusInMeters, angle));
    }
    
    // Close the polygon
    coordinates.push(coordinates[0]);
    
    return {
      type: 'Polygon',
      coordinates: coordinates as number[][] // Cast to the expected type
    };
  }, [calculateCoordinateAtRadius]);

  // Update the center of a geofence being edited
  const updateGeofenceCenter = useCallback((
    center: [number, number],
    radius?: number
  ) => {
    updateEditCoordinates({
      type: 'Point',
      coordinates: center
    });
  }, [updateEditCoordinates]);

  return {
    geofences,
    selectedGeofence,
    isLoading,
    isLocationInAnyGeofence,
    isLocationInGeofence,
    getCurrentGeofence,
    createGeofence: createGeofenceWithConfirmation,
    updateGeofence: updateGeofenceWithConfirmation,
    deleteGeofence: deleteGeofenceWithConfirmation,
    selectGeofence,
    startEditing,
    startCreating,
    cancelEdit,
    createCircularBoundary,
    updateGeofenceCenter
  };
}
