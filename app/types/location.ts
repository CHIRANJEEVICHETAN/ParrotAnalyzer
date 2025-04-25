import * as Location from "expo-location";

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export interface LocationObject {
  coords: LocationCoords;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

// Re-export Location types for convenience
export type { LocationSubscription } from "expo-location";
