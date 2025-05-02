import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import * as Network from 'expo-network';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { processQueue } from '../utils/httpBatchManager';
import EventEmitter from '../utils/EventEmitter';
import useSocketStore from '../store/socketStore';
import { Location, GeofenceTransitionEvent } from '../types/liveTracking';
import useLocationStore from '../store/locationStore';

interface UseSocketOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onLocationUpdate?: (data: any) => void;
  onGeofenceTransition?: (data: any) => void;
  onError?: (error: string) => void;
}

export function useSocket({
  onConnect,
  onDisconnect,
  onLocationUpdate,
  onGeofenceTransition,
  onError,
}: UseSocketOptions = {}) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const disconnectTimeRef = useRef<number | null>(null);
  const connectionAttempts = useRef<number>(0);

  // Add state to track if reconnection is in progress
  const isReconnectingRef = useRef<boolean>(false);
    
  // Reference to keep track of the last network state
  const lastNetworkStateRef = useRef<boolean | null>(null);

  // Additional state for reporting socket issues to UI
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastReconnectTime, setLastReconnectTime] = useState<Date | null>(null);
  
  // Enhanced connection setup with retries and error handling
  const setupConnection = useCallback(async () => {
    if (!token || isReconnectingRef.current) return;
    
    try {
      isReconnectingRef.current = true;
      connectionAttempts.current += 1;
      
      // Clean up existing socket if one exists
      if (socketRef.current && socketRef.current.connected) {
        console.log('Closing existing socket connection before reconnect');
        socketRef.current.close();
      }
      
      // Set up socket connection
      const API_URL = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || '';
      
      console.log(`[useSocket] Connecting to socket server at ${API_URL}`);
      
      const socketInstance = io(API_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
        autoConnect: true,
        forceNew: true,
      });
      
      // Setup event handlers
      socketInstance.on('connect', () => {
        console.log(`[useSocket] Connected to socket server with ID: ${socketInstance.id}`);
        setIsConnected(true);
        setConnectionError(null);
        connectionAttempts.current = 0;
        isReconnectingRef.current = false;
    
        // Set the socket reference
        socketRef.current = socketInstance;
        setSocket(socketInstance);
        
        // Store connection time
        AsyncStorage.setItem('lastSocketConnectTime', Date.now().toString());
        
        if (onConnect) onConnect();
        
        // Process any queued updates that failed while offline
        processQueuedUpdates();
      });
      
      socketInstance.on('disconnect', (reason) => {
        console.log(`[useSocket] Disconnected from socket server: ${reason}`);
        setIsConnected(false);
        disconnectTimeRef.current = Date.now();
        
        if (onDisconnect) onDisconnect();
        
        // Store the disconnect reason for diagnostics
        AsyncStorage.setItem('lastSocketDisconnectReason', reason);
        
        // Don't attempt to auto-reconnect if the app is in the background
        if (appStateRef.current === 'active') {
          // Only handle if we're still mounted
          scheduleReconnect();
        }
      });
      
      socketInstance.on('connect_error', (error) => {
        isReconnectingRef.current = false;
        console.error(`[useSocket] Connection error: ${error.message}`);
        setConnectionError(error.message);
        
        // Store the connection error for diagnostics
        AsyncStorage.setItem('lastSocketConnectionError', error.message);
        
        // Update UI state for reporting
        setReconnectAttempts(prev => prev + 1);
        setLastReconnectTime(new Date());
        
        if (onError) onError(error.message);
        
        // Schedule reconnect with backoff
        scheduleReconnect();
      });
      
      // Handle location updates from server
      if (onLocationUpdate) {
        socketInstance.on('location:update', onLocationUpdate);
      }
      
      // Handle geofence transitions from server
      if (onGeofenceTransition) {
        socketInstance.on('geofence:transition', onGeofenceTransition);
      }
      
      // Return the socket instance
      return socketInstance;
    } catch (error: any) {
      isReconnectingRef.current = false;
      const errorMessage = error.message || 'Failed to connect to socket server';
      console.error(`[useSocket] Error setting up connection: ${errorMessage}`);
      setConnectionError(errorMessage);
      
      if (onError) onError(errorMessage);
      
      // Schedule reconnect with backoff
      scheduleReconnect();
      
      return null;
    }
  }, [token, onConnect, onDisconnect, onLocationUpdate, onGeofenceTransition, onError]);
  
  // Schedule reconnect with exponential backoff
  const scheduleReconnect = useCallback(() => {
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      }
      
    // Calculate backoff time (max 30 seconds)
    const backoffTime = Math.min(1000 * Math.pow(2, connectionAttempts.current), 30000);
    console.log(`[useSocket] Scheduling reconnect in ${backoffTime}ms (attempt ${connectionAttempts.current})`);
    
    // Schedule reconnect
    reconnectTimeoutRef.current = setTimeout(async () => {
      // Check if we're online before attempting to reconnect
      try {
        const networkState = await Network.getNetworkStateAsync();
        if (networkState.isConnected && networkState.isInternetReachable) {
          console.log('[useSocket] Network available, attempting to reconnect...');
          setupConnection();
        } else {
          console.log('[useSocket] Network unavailable, skipping reconnect attempt');
          scheduleReconnect(); // Reschedule for later
        }
      } catch (error) {
        console.error('[useSocket] Error checking network state:', error);
        setupConnection(); // Try anyway
      }
    }, backoffTime);
  }, [setupConnection]);
  
  // Process any queued updates that failed while offline
  const processQueuedUpdates = useCallback(async () => {
    try {
      // Get auth token for HTTP requests
      const token = await SecureStore.getItemAsync('auth_token');
      if (!token) {
        console.warn('[useSocket] No auth token available for processing queued updates');
        return;
      }
      
      // Process the queue
      await processQueue(token);
      
      // Emit event that queue was processed on reconnect
      EventEmitter.emit('socketReconnected');
    } catch (error) {
      console.error('[useSocket] Error processing queued updates:', error);
          }
  }, []);
  
  // Get optimal update interval based on battery level and charging state
  const getOptimalUpdateInterval = useCallback(
    async (batteryLevel: number, isCharging: boolean): Promise<number> => {
      try {
        // Default intervals
        const defaultInterval = 30000; // 30 seconds
        
        // Adjust based on battery level and charging state
        if (isCharging) {
          return 15000; // 15 seconds when charging
        } else if (batteryLevel <= 20) {
          return 60000; // 1 minute when battery is low
        } else if (batteryLevel <= 50) {
          return 45000; // 45 seconds when battery is moderate
        }
        
        return defaultInterval;
      } catch (error) {
        console.error('[useSocket] Error getting optimal update interval:', error);
        return 30000; // Default to 30 seconds on error
      }
    },
    []
  );
  
  // Initialize socket connection
  useEffect(() => {
    if (token) {
      setupConnection();
    }
    
    // Cleanup socket on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Store connection state for potential recovery
      AsyncStorage.setItem('socketWasConnected', socketRef.current?.connected ? 'true' : 'false');
      
      if (socketRef.current) {
        console.log('[useSocket] Cleaning up socket connection');
        socketRef.current.off('connect');
        socketRef.current.off('disconnect');
        socketRef.current.off('connect_error');
        
        // Don't disconnect if this is just a component unmount
        // The socket should persist across navigation
        // socketRef.current.disconnect();
      }
    };
  }, [token, setupConnection]);
  
  // Monitor app state changes
  useEffect(() => {
    // Function to handle app state changes
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // Skip if no real change
      if (appStateRef.current === nextAppState) return;
      
      console.log(`[useSocket] App state changed: ${appStateRef.current} -> ${nextAppState}`);
      
      // App came to foreground
      if (nextAppState === 'active') {
        // Check if we were previously disconnected
        const disconnectDuration = disconnectTimeRef.current
          ? Date.now() - disconnectTimeRef.current
          : null;
        
        if (disconnectDuration && disconnectDuration > 60000) {
          console.log(`[useSocket] App was inactive for ${disconnectDuration / 1000}s, checking connection...`);
        }
        
        // Check if socket is connected, reconnect if needed
        if (socketRef.current && !socketRef.current.connected) {
          console.log('[useSocket] Socket disconnected while app was inactive, reconnecting...');
          setupConnection();
        } else if (!socketRef.current) {
          console.log('[useSocket] No socket instance, creating new connection...');
          setupConnection();
        } else {
          console.log('[useSocket] Socket already connected after app became active');
          
          // Process queued updates anyway in case we have pending data
          processQueuedUpdates();
        }
      }
      // App went to background
      else if (nextAppState.match(/inactive|background/)) {
        // Store the fact that we're going to background
        AsyncStorage.setItem('lastSocketBackgroundTime', Date.now().toString());
        
        // Don't disconnect the socket when going to background
        // This allows background tracking to continue using the socket
        console.log('[useSocket] App going to background, socket will be maintained');
      }
      
      // Update state reference
      appStateRef.current = nextAppState;
    };
    
    // Register app state change listener
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Clean up listener
    return () => {
      subscription.remove();
    };
  }, [setupConnection, processQueuedUpdates]);
  
  // Monitor network connectivity changes
  useEffect(() => {
    let isMonitoring = true;
    
    // Function to check network state periodically
    const checkNetworkState = async () => {
      if (!isMonitoring) return;
      
      try {
        const networkState = await Network.getNetworkStateAsync();
        const isConnected = networkState.isConnected && networkState.isInternetReachable;

        // Skip if no real change in connectivity
        if (lastNetworkStateRef.current === isConnected) {
          // Schedule next check
          setTimeout(checkNetworkState, 5000);
      return;
    }
    
        lastNetworkStateRef.current = isConnected ?? false;
        
        if (isConnected) {
          console.log('[useSocket] Network connection restored');
          
          // Check if socket is connected, reconnect if needed
          if (socketRef.current && !socketRef.current.connected) {
            console.log('[useSocket] Socket disconnected, reconnecting after network restoration...');
            setupConnection();
          } else if (!socketRef.current) {
            console.log('[useSocket] No socket instance, creating new connection after network restoration...');
            setupConnection();
          }
        } else {
          console.log('[useSocket] Network connection lost');
          // Just log, we'll automatically try to reconnect when network is available again
        }
        
        // Schedule next check
        if (isMonitoring) {
          setTimeout(checkNetworkState, 5000);
        }
      } catch (error) {
        console.error('[useSocket] Error checking network state:', error);
        // Schedule next check even on error
        if (isMonitoring) {
          setTimeout(checkNetworkState, 10000); // Longer delay on error
        }
      }
    };
    
    // Start monitoring
    checkNetworkState();
    
    // Clean up function
    return () => {
      isMonitoring = false;
    };
  }, [setupConnection]);
  
  // Function to emit location update
  const emitLocation = useCallback(
    (location: any) => {
      if (!socketRef.current || !socketRef.current.connected) {
        console.warn('[useSocket] Socket not connected, queueing location update');
        // Signal that the update will be queued
      return false;
    }
    
      try {
        // Add user ID to the location data
        const locationWithUser = { ...location, userId: user?.id };
        socketRef.current.emit('location:update', locationWithUser);
        return true;
      } catch (error) {
        console.error('[useSocket] Error emitting location:', error);
        return false;
      }
    },
    [user?.id]
  );
  
  // Function to force reconnect
  const forceReconnect = useCallback(() => {
    console.log('[useSocket] Forcing socket reconnection...');
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    connectionAttempts.current = 0; // Reset attempt counter for immediate reconnect
    setupConnection();
  }, [setupConnection]);

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    emitLocation,
    getOptimalUpdateInterval,
    forceReconnect,
    reconnectAttempts,
    lastReconnectTime
  };
} 