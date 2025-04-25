import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import useSocketStore from '../store/socketStore';
import { Location, GeofenceTransitionEvent } from '../types/liveTracking';
import useLocationStore from '../store/locationStore';
import { AppState, AppStateStatus } from 'react-native';

interface UseSocketProps {
  onLocationUpdate?: (location: Location) => void;
  onGeofenceTransition?: (event: GeofenceTransitionEvent) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useSocket({
  onLocationUpdate,
  onGeofenceTransition,
  onError,
  onConnect,
  onDisconnect
}: UseSocketProps = {}) {
  const socket = useRef<Socket | null>(null);
  const { token } = useAuth();
  const { 
    setConnected, 
    setDisconnected, 
    setReconnecting, 
    incrementRetryCount, 
    status 
  } = useSocketStore();
  const { setError, setIsInGeofence } = useLocationStore();
  
  // Add a ref to track if the socket is already initialized
  const isInitialized = useRef(false);
  const appState = useRef(AppState.currentState);

  // Handle Socket Connect
  const handleConnect = useCallback(() => {
    if (!socket.current || !socket.current.id) return;
    
    console.log('Socket connected with ID:', socket.current.id);
    setConnected(socket.current.id);
    onConnect?.();
  }, [setConnected, onConnect]);

  // Handle Socket Disconnect
  const handleDisconnect = useCallback((reason: string) => {
    console.log('Socket disconnected. Reason:', reason);
    setDisconnected();
    onDisconnect?.();
    
    // Set reconnecting state if disconnect was unexpected
    if (reason !== 'io client disconnect') {
      setReconnecting();
    }
  }, [setDisconnected, onDisconnect, setReconnecting]);

  // Handle Socket Error
  const handleError = useCallback((error: Error) => {
    console.error('Socket error:', error);
    const errorMessage = error.message || 'Socket connection error';
    setError(errorMessage);
    onError?.(errorMessage);
    incrementRetryCount();
  }, [setError, onError, incrementRetryCount]);

  // Handle Location Update
  const handleLocationUpdate = useCallback((data: any) => {
    if (!data || !data.location) return;
    
    console.log('Received location update:', data);
    
    const location: Location = {
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      timestamp: data.location.timestamp,
      accuracy: data.location.accuracy,
      speed: data.location.speed,
      batteryLevel: data.location.batteryLevel,
      isMoving: data.location.isMoving
    };
    
    onLocationUpdate?.(location);
  }, [onLocationUpdate]);

  // Handle Geofence Transition
  const handleGeofenceTransition = useCallback((data: GeofenceTransitionEvent) => {
    console.log('Geofence transition:', data);
    
    // Update geofence state
    setIsInGeofence(data.isInside, data.geofenceId);
    
    // Call the callback if provided
    onGeofenceTransition?.(data);
  }, [setIsInGeofence, onGeofenceTransition]);

  // Optimize Socket Connection Management
  useEffect(() => {
    // Don't connect if no token
    if (!token) return;
    
    let debounceTimeout: NodeJS.Timeout | null = null;
    
    // Create socket instance only once
    if (!socket.current) {
      console.log('Creating new socket connection');
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      
      socket.current = io(API_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });
      
      isInitialized.current = true;
    
      // Set up event listeners
      socket.current.on('connect', handleConnect);
      socket.current.on('disconnect', handleDisconnect);
      socket.current.on('connect_error', handleError);
      socket.current.on('location:update', handleLocationUpdate);
      socket.current.on('geofence:transition', handleGeofenceTransition);
      socket.current.on('location:error', (data) => {
        const errorMessage = data.message || 'Location tracking error';
        setError(errorMessage);
        onError?.(errorMessage);
      });
    }
    
    // Connect if needed
    if (socket.current && !socket.current.connected) {
      socket.current.connect();
    }
    
    // Handle app state changes with debouncing to prevent excessive reconnections
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // Clear any pending debounce
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      
      // Debounce the AppState change handling
      debounceTimeout = setTimeout(() => {
        if (appState.current === 'background' && nextAppState === 'active') {
          // App coming to foreground - check connection state before attempting reconnect
          if (socket.current && !socket.current.connected) {
            console.log('Reconnecting socket after app comes to foreground');
            socket.current.connect();
          }
        }
        
        appState.current = nextAppState;
      }, 300); // 300ms debounce
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Cleanup
    return () => {
      subscription.remove();
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      
      if (socket.current) {
        socket.current.off('connect', handleConnect);
        socket.current.off('disconnect', handleDisconnect);
        socket.current.off('connect_error', handleError);
        socket.current.off('location:update', handleLocationUpdate);
        socket.current.off('geofence:transition', handleGeofenceTransition);
        socket.current.off('location:error');
      }
    };
  }, [
    token, 
    handleConnect, 
    handleDisconnect, 
    handleError, 
    handleLocationUpdate, 
    handleGeofenceTransition, 
    setError, 
    onError
  ]);
  
  // Clean up socket on unmount (separate effect for proper cleanup)
  useEffect(() => {
    return () => {
      if (socket.current) {
        console.log('Component unmounting, disconnecting socket');
        socket.current.disconnect();
        socket.current = null;
        isInitialized.current = false;
      }
    };
  }, []);

  // Emit location update
  const emitLocation = useCallback((locationData: Location) => {
    if (!socket.current || !socket.current.connected) {
      console.warn("Socket not connected. Cannot emit location update.");
      return false;
    }

    // Get tracking status from location store to always include it
    const trackingStatus = useLocationStore.getState().trackingStatus;
    const batteryLevel = useLocationStore.getState().batteryLevel;

    socket.current.emit("location:update", {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      accuracy: locationData.accuracy,
      timestamp: locationData.timestamp,
      batteryLevel: locationData.batteryLevel || batteryLevel,
      isMoving: locationData.isMoving,
      altitude: locationData.altitude,
      speed: locationData.speed,
      heading: locationData.heading,
      trackingStatus: trackingStatus,
      is_tracking_active: trackingStatus === "active",
    });

    return true;
  }, []);

  // Get optimal update interval based on battery level
  const getOptimalUpdateInterval = useCallback(async (
    batteryLevel: number, 
    isCharging: boolean
  ): Promise<number> => {
    if (!socket.current || !socket.current.connected) {
      console.warn('Socket not connected. Using default interval.');
      return batteryLevel < 20 ? 60000 : 30000; // Default fallback values
    }
    
    return new Promise((resolve) => {
      // Create a one-time listener for the response
      socket.current!.once('location:update_interval', (data: { interval: number }) => {
        resolve(data.interval);
      });
      
      // Set a timeout in case no response is received
      const timeout = setTimeout(() => {
        socket.current!.off('location:update_interval');
        resolve(batteryLevel < 20 ? 60000 : 30000); // Default fallback values
      }, 5000);
      
      // Request the optimal interval
      socket.current!.emit('location:get_interval', { 
        batteryLevel,
        isCharging
      });
    });
  }, []);

  // Request failed updates
  const getFailedUpdates = useCallback(() => {
    if (!socket.current || !socket.current.connected) {
      console.warn('Socket not connected. Cannot get failed updates.');
      return;
    }
    
    socket.current.emit('location:get_failed');
  }, []);

  // Process shift events
  const startShift = useCallback((location: Pick<Location, 'latitude' | 'longitude'>) => {
    if (!socket.current || !socket.current.connected) {
      console.warn('Socket not connected. Cannot start shift.');
      return false;
    }
    
    socket.current.emit('shift:start', {
      latitude: location.latitude,
      longitude: location.longitude
    });
    
    return true;
  }, []);

  const endShift = useCallback((location: Pick<Location, 'latitude' | 'longitude'>) => {
    if (!socket.current || !socket.current.connected) {
      console.warn('Socket not connected. Cannot end shift.');
      return false;
    }
    
    socket.current.emit('shift:end', {
      latitude: location.latitude,
      longitude: location.longitude
    });
    
    return true;
  }, []);

  return {
    socket: socket.current,
    isConnected: status.isConnected,
    reconnectAttempts: status.reconnectAttempts,
    emitLocation,
    getOptimalUpdateInterval,
    getFailedUpdates,
    startShift,
    endShift
  };
} 