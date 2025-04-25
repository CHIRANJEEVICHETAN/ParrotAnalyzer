/**
 * Live Tracking Types
 */

export interface Location {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number | string | null;
  batteryLevel?: number;
  isMoving?: boolean;
  userId?: string | number; // User ID for background tracking
  isBackground?: boolean; // Flag to indicate background update
  sessionId?: string; // Tracking session ID
  trackingStatus?: string; // Current tracking status
  is_tracking_active?: boolean; // Flag for backend compatibility
}

export interface TrackingUser {
  id: string;
  name: string;
  location: Location;
  deviceInfo?: string;
  lastUpdated: number; // timestamp
  isActive: boolean;
  batteryLevel?: number;
  groupId?: string;
  isInGeofence?: boolean; // Add geofence status for UI display
  currentGeofenceId?: number | string; // Add ID of current geofence if in one
  // Additional employee fields
  employeeNumber?: string;
  employeeLabel?: string;
  department?: string;
  designation?: string;
  source?: string;
}

export interface DeviceInfo {
  deviceId?: string;
  deviceModel?: string;
  deviceName?: string;
  deviceType?: string; // mobile, tablet, etc.
  operatingSystem?: string;
  osVersion?: string;
  batteryLevel?: number;
  connectionType?: string; // wifi, cellular, etc.
}

export interface GeofenceRegion {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  identifier: string;
  notifyOnEntry?: boolean;
  notifyOnExit?: boolean;
  notifyOnDwell?: boolean;
  dwellTime?: number; // in milliseconds
  color?: string;
}

export interface GeofenceEvent {
  type: "enter" | "exit" | "dwell";
  region: GeofenceRegion;
  timestamp: number;
  userId?: string;
}

export interface LiveTrackingSession {
  id: string;
  name?: string;
  startTime: number;
  endTime?: number;
  isActive: boolean;
  users: TrackingUser[];
  geofences?: GeofenceRegion[];
  groupId?: string;
  createdBy: string;
}

export interface TrackingGroup {
  id: string;
  name: string;
  users: string[]; // user IDs
  admin: string; // admin user ID
  isActive: boolean;
  createdAt: number;
  description?: string;
}

export interface LocationHistory extends Location {
  id: number;
  userId: number;
  sessionId?: string;
  startTime?: number;
  locations?: Location[];
}

export interface TrackingPermissions {
  location: boolean;
  backgroundLocation: boolean;
  notifications: boolean;
}

export enum TrackingStatus {
  INACTIVE = "inactive",
  ACTIVE = "active",
  PAUSED = "paused",
  ERROR = "error",
}

export interface Geofence {
  id: number;
  name: string;
  coordinates: GeoCoordinates;
  radius: number;
  createdAt: string;
  updatedAt: string;
  companyId: number;
  createdBy: number;
}

export interface GeoCoordinates {
  type: "Point" | "Polygon";
  coordinates: number[] | number[][];
}

export interface CompanyTrackingSettings {
  companyId: number;
  minLocationAccuracy: number;
  updateIntervalSeconds: number;
  batteryOptimizationEnabled: boolean;
  geofenceDetectionEnabled: boolean;
  updatedAt: string;
}

export interface TrackingAnalytics {
  id: number;
  userId: number;
  date: string;
  totalDistance: number;
  totalTime: number;
  timeInGeofence: number;
  timeOutOfGeofence: number;
  batteryConsumption: number;
  averageSpeed: number;
}

export interface ShiftLocation {
  shiftId: number;
  startLatitude: number;
  startLongitude: number;
  endLatitude?: number;
  endLongitude?: number;
  startTimestamp: string;
  endTimestamp?: string;
  totalDistance?: number;
  isInGeofence: boolean;
}

export interface SocketConnectionStatus {
  isConnected: boolean;
  lastConnected?: string;
  reconnectAttempts: number;
}

export interface LocationUpdateRequest {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  batteryLevel?: number;
  isMoving?: boolean;
  altitude?: number;
  speed?: number;
  heading?: number;
}

export interface GeofenceTransitionEvent {
  geofenceId: number;
  isInside: boolean;
  timestamp: string;
  latitude: number;
  longitude: number;
}

export interface EmployeeLocationData {
  employeeId: number;
  userId?: number | string; // Add userId as an alternative identifier
  name: string;
  location: Location;
  lastUpdated: string;
  batteryLevel?: number;
  isActive: boolean;
  is_tracking_active?: boolean; // Add for compatibility with existing code
  trackingStatus?: string; // Add for compatibility with existing code
  isInGeofence?: boolean;
  currentGeofenceId?: number | string;
  shiftActive?: boolean;
}

export type LocationAccuracy = 'high' | 'balanced' | 'low' | 'passive';

export type GeofenceType = 'circle' | 'polygon';

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export type TrackingPrecision = 'low' | 'medium' | 'high'; 