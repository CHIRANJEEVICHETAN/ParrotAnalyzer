import { create } from 'zustand';
import { SocketConnectionStatus } from '../types/liveTracking';

interface SocketState {
  // Connection state
  status: SocketConnectionStatus;
  socketId: string | null;
  connectedAt: string | null;
  
  // Actions
  setConnected: (socketId: string) => void;
  setDisconnected: () => void;
  setReconnecting: () => void;
  resetRetryCount: () => void;
  incrementRetryCount: () => void;
}

const useSocketStore = create<SocketState>((set, get) => ({
  // Initial state
  status: {
    isConnected: false,
    reconnectAttempts: 0
  },
  socketId: null,
  connectedAt: null,
  
  // Actions
  setConnected: (socketId: string) => set({
    status: {
      isConnected: true,
      lastConnected: new Date().toISOString(),
      reconnectAttempts: 0
    },
    socketId,
    connectedAt: new Date().toISOString()
  }),
  
  setDisconnected: () => set({
    status: {
      ...get().status,
      isConnected: false
    },
    socketId: null
  }),
  
  setReconnecting: () => set({
    status: {
      ...get().status,
      isConnected: false
    }
  }),
  
  resetRetryCount: () => set({
    status: {
      ...get().status,
      reconnectAttempts: 0
    }
  }),
  
  incrementRetryCount: () => set({
    status: {
      ...get().status,
      reconnectAttempts: get().status.reconnectAttempts + 1
    }
  })
}));

export default useSocketStore; 