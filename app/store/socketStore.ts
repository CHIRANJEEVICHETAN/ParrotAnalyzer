import { create } from 'zustand';
import { SocketConnectionStatus } from '../types/liveTracking';

interface SocketState {
  // Connection state
  status: SocketConnectionStatus;
  socketId: string | null;
  connectedAt: string | null;
  
  // Connection management
  referenceCount: number;
  sessionId: string | null;
  lastNetworkState: boolean | null;
  
  // Actions
  setConnected: (socketId: string) => void;
  setDisconnected: () => void;
  setReconnecting: () => void;
  resetRetryCount: () => void;
  incrementRetryCount: () => void;
  
  // Reference counting
  addReference: () => number;
  removeReference: () => number;
  
  // Network management
  setNetworkState: (isAvailable: boolean) => void;
  
  // Session management
  setSessionId: (sessionId: string) => void;
}

const useSocketStore = create<SocketState>((set, get) => ({
  // Initial state
  status: {
    isConnected: false,
    reconnectAttempts: 0
  },
  socketId: null,
  connectedAt: null,
  
  // Connection management
  referenceCount: 0,
  sessionId: null,
  lastNetworkState: null,
  
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
  }),
  
  // Reference counting methods
  addReference: () => {
    const newCount = get().referenceCount + 1;
    set({ referenceCount: newCount });
    return newCount;
  },
  
  removeReference: () => {
    const current = get().referenceCount;
    const newCount = Math.max(0, current - 1);
    set({ referenceCount: newCount });
    return newCount;
  },
  
  // Network management
  setNetworkState: (isAvailable: boolean) => {
    set({ lastNetworkState: isAvailable });
  },
  
  // Session management
  setSessionId: (sessionId: string) => {
    set({ sessionId });
  }
}));

export default useSocketStore; 