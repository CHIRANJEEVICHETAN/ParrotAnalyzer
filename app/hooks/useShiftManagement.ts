import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Location as AppLocation, ShiftLocation } from '../types/liveTracking';
import { useLocationTracking } from './useLocationTracking';
import { useSocket } from './useSocket';
import { useGeofencing } from './useGeofencing';
import * as ExpoLocation from 'expo-location';

interface UseShiftManagementOptions {
  onShiftStart?: (shiftData: ShiftLocation) => void;
  onShiftEnd?: (shiftData: ShiftLocation) => void;
  onError?: (error: string) => void;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Helper function to convert from Expo LocationObject to our Location type
const convertLocation = (location: ExpoLocation.LocationObject): AppLocation => {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy || undefined,
    altitude: location.coords.altitude || undefined,
    heading: location.coords.heading || undefined,
    speed: location.coords.speed || undefined,
    timestamp: location.timestamp,
  };
};

export function useShiftManagement({
  onShiftStart,
  onShiftEnd,
  onError
}: UseShiftManagementOptions = {}) {
  const { token, user } = useAuth();
  const [currentShift, setCurrentShift] = useState<ShiftLocation | null>(null);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { isConnected, emitLocation, socket } = useSocket();
  const { getCurrentLocation } = useLocationTracking();
  const { isLocationInAnyGeofence } = useGeofencing();

  // Fetch current shift status on mount
  useEffect(() => {
    const fetchCurrentShift = async () => {
      if (!token || !user) return;
      
      setIsLoading(true);
      try {
        const response = await axios.get(
          `${API_URL}/api/employee-tracking/current-shift`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        
        if (response.data && response.data.id) {
          setCurrentShift(response.data);
          setIsShiftActive(true);
        } else {
          setCurrentShift(null);
          setIsShiftActive(false);
        }
      } catch (error: any) {
        console.error('Error fetching current shift:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCurrentShift();
  }, [token, user]);

  // Start a new shift
  const startShift = useCallback(async (): Promise<boolean> => {
    if (isShiftActive) {
      Alert.alert('Shift Already Active', 'You already have an active shift.');
      return false;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      // Get current location
      const expoLocation = await getCurrentLocation();
      
      if (!expoLocation) {
        throw new Error('Unable to get current location. Please check your location settings.');
      }
      
      // Convert to our Location type
      const currentLocation = convertLocation(expoLocation);
      
      // Check if in geofence
      const inGeofence = isLocationInAnyGeofence(currentLocation);
      
      // Confirm if not in geofence
      if (!inGeofence) {
        return new Promise<boolean>(resolve => {
          Alert.alert(
            'Start Shift',
            'You are not currently within a registered geofence. Are you sure you want to start your shift?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  setIsLoading(false);
                  resolve(false);
                }
              },
              {
                text: 'Start Anyway',
                onPress: async () => {
                  try {
                    await completeShiftStart(currentLocation);
                    resolve(true);
                  } catch (error: any) {
                    const errorMsg = error.message || 'Failed to start shift';
                    setError(errorMsg);
                    onError?.(errorMsg);
                    resolve(false);
                  } finally {
                    setIsLoading(false);
                  }
                }
              }
            ]
          );
        });
      }
      
      // Complete shift start
      await completeShiftStart(currentLocation);
      return true;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to start shift';
      setError(errorMsg);
      onError?.(errorMsg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isShiftActive, getCurrentLocation, isLocationInAnyGeofence, onError]);

  // Helper function to complete shift start
  const completeShiftStart = useCallback(async (location: AppLocation): Promise<void> => {
    // Send to socket
    if (socket && isConnected) {
      socket.emit('shift:start', {
        latitude: location.latitude,
        longitude: location.longitude
      });
    }
    
    // Also send to REST API for redundancy
    try {
      const response = await axios.post(
        `${API_URL}/api/employee-tracking/start-shift`,
        {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: location.timestamp || new Date().toISOString(),
          batteryLevel: location.batteryLevel,
          speed: location.speed,
          isMoving: location.isMoving || false,
          altitude: location.altitude
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data) {
        setCurrentShift(response.data);
        setIsShiftActive(true);
        onShiftStart?.(response.data);
        
        Alert.alert(
          'Shift Started',
          'Your shift has been started successfully.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Error starting shift via API:', error);
      throw error;
    }
  }, [token, socket, isConnected, onShiftStart]);

  // End the current shift
  const endShift = useCallback(async (): Promise<boolean> => {
    if (!isShiftActive) {
      Alert.alert('No Active Shift', 'You don\'t have an active shift to end.');
      return false;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      // Get current location
      const expoLocation = await getCurrentLocation();
      
      if (!expoLocation) {
        throw new Error('Unable to get current location. Please check your location settings.');
      }
      
      // Convert to our Location type
      const currentLocation = convertLocation(expoLocation);
      
      // Check if in geofence
      const inGeofence = isLocationInAnyGeofence(currentLocation);
      
      // Confirm if not in geofence
      if (!inGeofence) {
        return new Promise<boolean>(resolve => {
          Alert.alert(
            'End Shift',
            'You are not currently within a registered geofence. Are you sure you want to end your shift?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  setIsLoading(false);
                  resolve(false);
                }
              },
              {
                text: 'End Anyway',
                onPress: async () => {
                  try {
                    await completeShiftEnd(currentLocation);
                    resolve(true);
                  } catch (error: any) {
                    const errorMsg = error.message || 'Failed to end shift';
                    setError(errorMsg);
                    onError?.(errorMsg);
                    resolve(false);
                  } finally {
                    setIsLoading(false);
                  }
                }
              }
            ]
          );
        });
      }
      
      // Complete shift end
      await completeShiftEnd(currentLocation);
      return true;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to end shift';
      setError(errorMsg);
      onError?.(errorMsg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isShiftActive, getCurrentLocation, isLocationInAnyGeofence, onError]);

  // Helper function to complete shift end
  const completeShiftEnd = useCallback(async (location: AppLocation): Promise<void> => {
    // Send to socket
    if (socket && isConnected) {
      socket.emit('shift:end', {
        latitude: location.latitude,
        longitude: location.longitude
      });
    }
    
    // Also send to REST API for redundancy
    try {
      const response = await axios.post(
        `${API_URL}/api/employee-tracking/end-shift`,
        {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: location.timestamp || new Date().toISOString(),
          batteryLevel: location.batteryLevel,
          speed: location.speed,
          isMoving: location.isMoving || false,
          altitude: location.altitude
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data) {
        setCurrentShift(response.data);
        setIsShiftActive(false);
        onShiftEnd?.(response.data);
        
        // Show shift summary
        const startTime = new Date(response.data.startTimestamp);
        const endTime = new Date(response.data.endTimestamp);
        const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // minutes
        
        Alert.alert(
          'Shift Ended',
          `Your shift has been ended successfully.\n\nDuration: ${duration} minutes\nDistance: ${Math.round(response.data.totalDistance || 0)} meters`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Error ending shift via API:', error);
      throw error;
    }
  }, [token, socket, isConnected, onShiftEnd]);

  // Get shift history
  const getShiftHistory = useCallback(async (
    startDate: string,
    endDate: string
  ): Promise<ShiftLocation[]> => {
    setIsLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/api/employee-tracking/shift-history`,
        {
          params: { start_date: startDate, end_date: endDate },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      return response.data || [];
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to fetch shift history';
      setError(errorMsg);
      onError?.(errorMsg);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [token, onError]);

  return {
    currentShift,
    isShiftActive,
    isLoading,
    error,
    startShift,
    endShift,
    getShiftHistory
  };
} 