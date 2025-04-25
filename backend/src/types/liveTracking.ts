export interface Location {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  batteryLevel?: number;
  altitude?: number;
  heading?: number;
  isMoving?: boolean;
  is_tracking_active?: boolean;
  trackingStatus?: string;
}

export interface EmployeeLocation extends Location {
    id: number;
    userId: number;
    shiftId?: number;
    isOutdoor: boolean;
    geofenceStatus?: string;
    movementType?: string;
    locationAccuracy?: number;
    createdAt: string;
}

export interface CompanyGeofence {
    id: number;
    companyId: number;
    name: string;
    coordinates: any; // PostGIS GEOGRAPHY(POLYGON) type
    radius?: number;
    createdBy: number;
    createdAt: string;
    updatedAt: string;
}

export interface UserTrackingPermissions {
    id: number;
    userId: number;
    canOverrideGeofence: boolean;
    trackingPrecision: 'high' | 'medium' | 'low';
    createdAt: string;
    updatedAt: string;
}

export interface CompanyTrackingSettings {
    id: number;
    companyId: number;
    minLocationAccuracy: number;
    updateIntervalSeconds: number;
    batterySavingEnabled: boolean;
    indoorTrackingEnabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface TrackingAnalytics {
    shiftId: number;
    totalDistance: number;
    indoorTime: number;
    outdoorTime: number;
    lastUpdate: string;
}

export interface LocationUpdate extends Location {
    userId: number;
}

export interface GeofenceValidationResult {
    isInside: boolean;
    geofenceId?: number;
    entryTime?: string;
    exitTime?: string;
}

export interface TrackingPermissionValidation {
    allowed: boolean;
    reason?: string;
}

export interface GeofenceEvent {
    userId: number;
    geofenceId: number;
    shiftId: number;
    eventType: 'entry' | 'exit';
    timestamp: string;
} 