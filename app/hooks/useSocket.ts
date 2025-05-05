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

// Add a singleton socket instance to prevent multiple connections
let globalSocket: Socket | null = null;
let socketRefCount = 0;
let lastConnectionAttempt = 0;
const CONNECTION_THROTTLE_TIME = 1000; // Limit connections to once per second

export function useSocket({
  onConnect,
  onDisconnect,
  onLocationUpdate,
  onGeofenceTransition,
  onError,
}: UseSocketOptions = {}) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(globalSocket);
  const [isConnected, setIsConnected] = useState(globalSocket?.connected || false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(globalSocket);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const disconnectTimeRef = useRef<number | null>(null);
  const connectionAttempts = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Add state to track if reconnection is in progress
  const isReconnectingRef = useRef<boolean>(false);
    
  // Reference to keep track of the last network state
  const lastNetworkStateRef = useRef<boolean | null>(null);

  // Additional state for reporting socket issues to UI
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastReconnectTime, setLastReconnectTime] = useState<Date | null>(null);
  
  // Enhanced connection setup with retries and error handling
  const setupConnection = useCallback(async () => {
    if (!token || isReconnectingRef.current || !isMountedRef.current) return;
    
    // Throttle connection attempts
    const now = Date.now();
    if (now - lastConnectionAttempt < CONNECTION_THROTTLE_TIME) {
      console.log('[useSocket] Throttling connection attempt, too many requests');
      return;
    }
    lastConnectionAttempt = now;
    
    try {
      isReconnectingRef.current = true;
      connectionAttempts.current += 1;
      
      // If we already have a global socket and it's connected, use that
      if (globalSocket && globalSocket.connected) {
        console.log('[useSocket] Reusing existing global socket connection');
        socketRef.current = globalSocket;
        if (isMountedRef.current) {
          setSocket(globalSocket);
          setIsConnected(true);
          setConnectionError(null);
        }
        isReconnectingRef.current = false;
        if (onConnect) onConnect();
        return globalSocket;
      }
      
      // Clean up existing socket if one exists
      if (globalSocket) {
        console.log('[useSocket] Closing existing socket connection before reconnect');
        globalSocket.removeAllListeners();
        globalSocket.close();
        globalSocket = null;
      }
      
      // Set up socket connection
      const API_URL = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || '';
      
      console.log(`[useSocket] Connecting to socket server at ${API_URL}`);
      
      const socketInstance = io(API_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
        autoConnect: true,
        forceNew: true,
      });
      
      // Store as global singleton
      globalSocket = socketInstance;
      socketRefCount++;
      
      // Setup event handlers
      socketInstance.on('connect', () => {
        console.log(`[useSocket] Connected to socket server with ID: ${socketInstance.id}`);
        if (isMountedRef.current) {
          setIsConnected(true);
          setConnectionError(null);
        }
        connectionAttempts.current = 0;
        isReconnectingRef.current = false;
    
        // Set the socket reference
        socketRef.current = socketInstance;
        if (isMountedRef.current) {
          setSocket(socketInstance);
        }
        
        // Store connection time
        AsyncStorage.setItem('lastSocketConnectTime', Date.now().toString());
        
        if (onConnect && isMountedRef.current) onConnect();
        
        // Process any queued updates that failed while offline
        processQueuedUpdates();
      });
      
      socketInstance.on('disconnect', (reason) => {
        console.log(`[useSocket] Disconnected from socket server: ${reason}`);
        if (isMountedRef.current) {
          setIsConnected(false);
        }
        disconnectTimeRef.current = Date.now();
        
        if (onDisconnect && isMountedRef.current) onDisconnect();
        
        // Store the disconnect reason for diagnostics
        AsyncStorage.setItem('lastSocketDisconnectReason', reason);
        
        // Don't attempt to auto-reconnect if the app is in the background
        if (appStateRef.current === 'active' && isMountedRef.current) {
          // Only handle if we're still mounted
          scheduleReconnect();
        }
      });
      
      socketInstance.on('connect_error', (error) => {
        isReconnectingRef.current = false;
        console.error(`[useSocket] Connection error: ${error.message}`);
        if (isMountedRef.current) {
          setConnectionError(error.message);
          // Update UI state for reporting
          setReconnectAttempts(prev => prev + 1);
          setLastReconnectTime(new Date());
          if (onError) onError(error.message);
        }
        
        // Store the connection error for diagnostics
        AsyncStorage.setItem('lastSocketConnectionError', error.message);
        
        // Schedule reconnect with backoff if still mounted
        if (isMountedRef.current) {
          scheduleReconnect();
        }
      });
      
      // Handle location updates from server
      if (onLocationUpdate) {
        socketInstance.on('location:update', (data) => {
          if (isMountedRef.current && onLocationUpdate) {
            onLocationUpdate(data);
          }
        });
      }
      
      // Handle geofence transitions from server
      if (onGeofenceTransition) {
        socketInstance.on('geofence:transition', (data) => {
          if (isMountedRef.current && onGeofenceTransition) {
            onGeofenceTransition(data);
          }
        });
      }
      
      // Return the socket instance
      return socketInstance;
    } catch (error: any) {
      isReconnectingRef.current = false;
      const errorMessage = error.message || 'Failed to connect to socket server';
      console.error(`[useSocket] Error setting up connection: ${errorMessage}`);
      if (isMountedRef.current) {
        setConnectionError(errorMessage);
        if (onError) onError(errorMessage);
      }
      
      // Schedule reconnect with backoff if still mounted
      if (isMountedRef.current) {
        scheduleReconnect();
      }
      
      return null;
    }
  }, [token, onConnect, onDisconnect, onLocationUpdate, onGeofenceTransition, onError]);
  
  // Schedule reconnect with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (!isMountedRef.current) return;
    
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
      
    // Calculate backoff time (max 30 seconds)
    const backoffTime = Math.min(1000 * Math.pow(2, connectionAttempts.current), 30000);
    console.log(`[useSocket] Scheduling reconnect in ${backoffTime}ms (attempt ${connectionAttempts.current})`);
    
    // Schedule reconnect
    reconnectTimeoutRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      
      // Check if we're online before attempting to reconnect
      try {
        const networkState = await Network.getNetworkStateAsync();
        if (networkState.isConnected && networkState.isInternetReachable) {
          console.log('[useSocket] Network available, attempting to reconnect...');
          setupConnection();
        } else {
          console.log('[useSocket] Network unavailable, skipping reconnect attempt');
          if (isMountedRef.current) {
            scheduleReconnect(); // Reschedule for later
          }
        }
      } catch (error) {
        if (isMountedRef.current) {
          console.error('[useSocket] Error checking network state:', error);
          setupConnection(); // Try anyway
        }
      }
    }, backoffTime);
  }, [setupConnection]);
  
  // Process any queued updates that failed while offline
  const processQueuedUpdates = useCallback(async () => {
    if (!isMountedRef.current) return;
    
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
    isMountedRef.current = true;
    
    if (token && !socket) {
      setupConnection();
    } else if (socket) {
      // If we already have a socket, ensure we're properly connected to it
      setIsConnected(socket.connected);
    }
    
    // Handle app state changes for this component
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // Only process if component is still mounted
      if (!isMountedRef.current) return;
      
      // When app comes back to foreground
      if (
        appStateRef.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        console.log('App returned to foreground, checking socket connection status');
        
        // Check if socket is connected
        if (socketRef.current && !socketRef.current.connected) {
          setupConnection();
        }
      }
      
      // Update app state reference
      appStateRef.current = nextAppState;
    };
    
    // Network state check function
    const checkNetworkState = async () => {
      if (!isMountedRef.current) return;
      
      try {
        const networkState = await Network.getNetworkStateAsync();
        const isNetworkAvailable = Boolean(
          networkState.isConnected && networkState.isInternetReachable
        );
        
        // Only act if network state has changed
        if (lastNetworkStateRef.current !== isNetworkAvailable) {
          lastNetworkStateRef.current = isNetworkAvailable;
          
          console.log(`[useSocket] Network state changed: ${isNetworkAvailable ? 'available' : 'unavailable'}`);
          
          // If network becomes available but socket is disconnected, try to reconnect
          if (isNetworkAvailable && socketRef.current && !socketRef.current.connected) {
            setupConnection();
          }
        }
      } catch (error) {
        console.error('[useSocket] Error checking network state:', error);
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Set up network state monitoring
    const checkNetworkInterval = setInterval(() => {
      if (isMountedRef.current) {
        checkNetworkState();
      }
    }, 30000); // Check every 30 seconds
    
    // Cleanup socket on unmount
    return () => {
      console.log('[useSocket] Cleaning up socket connection');
      isMountedRef.current = false;
      
      subscription.remove();
      clearInterval(checkNetworkInterval);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Decrement reference count and only remove listeners when no components use the socket
      socketRefCount--;
      if (socketRefCount <= 0) {
        socketRefCount = 0;
        
        // Don't close the socket on component unmount, just clean up component-specific listeners
        // The socket will be reused by other components or cleaned up when the app is terminated
        if (socketRef.current) {
          if (onConnect) socketRef.current.off('connect', onConnect);
          if (onDisconnect) socketRef.current.off('disconnect', onDisconnect);
          if (onLocationUpdate) socketRef.current.off('location:update', onLocationUpdate);
          if (onGeofenceTransition) socketRef.current.off('geofence:transition', onGeofenceTransition);
        }
      }
    };
  }, [token, setupConnection, socket]);
  
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