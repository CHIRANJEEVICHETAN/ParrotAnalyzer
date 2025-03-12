# Live Tracking Implementation Plan

## Overview
This document outlines the implementation plan for adding real-time live tracking functionality to the Parrot Analyzer application. The system will enable Group Admins to monitor employee locations in real-time, calculate travel metrics, and enforce geo-fencing rules.

## 1. Database Schema Updates

### New Tables

#### 1.1 `employee_locations`
```sql
CREATE TABLE employee_locations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(10, 2),
    is_moving BOOLEAN DEFAULT false,
    battery_level INTEGER,
    shift_id INTEGER REFERENCES employee_shifts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX idx_employee_locations_user_timestamp ON employee_locations(user_id, timestamp);
```

#### 1.2 `company_geofences`
```sql
CREATE TABLE company_geofences (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    coordinates GEOGRAPHY(POLYGON) NOT NULL,
    radius DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Spatial index for faster geo queries
CREATE INDEX idx_company_geofences_coordinates ON company_geofences USING GIST(coordinates);
```

### Schema Updates

#### 1.3 Update `employee_shifts` table
```sql
ALTER TABLE employee_shifts
ADD COLUMN location_history GEOGRAPHY(LINESTRING),
ADD COLUMN total_distance_km DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN travel_time_minutes INTEGER DEFAULT 0,
ADD COLUMN last_location_update TIMESTAMP;
```

#### 1.4 Enhance `employee_locations` table
```sql
ALTER TABLE employee_locations
ADD COLUMN is_outdoor BOOLEAN DEFAULT false,
ADD COLUMN geofence_status VARCHAR(20),
ADD COLUMN movement_type VARCHAR(20),
ADD COLUMN location_accuracy INTEGER;
```

#### 1.5 Add `user_tracking_permissions` table
```sql
CREATE TABLE user_tracking_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    can_override_geofence BOOLEAN DEFAULT false,
    tracking_precision VARCHAR(20) DEFAULT 'high',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 1.6 Add `company_tracking_settings` table
```sql
CREATE TABLE company_tracking_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    min_location_accuracy INTEGER DEFAULT 50,
    update_interval_seconds INTEGER DEFAULT 30,
    battery_saving_enabled BOOLEAN DEFAULT true,
    indoor_tracking_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 1.7 Add `tracking_analytics` table
```sql
CREATE TABLE tracking_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_distance_km DECIMAL(10, 2) DEFAULT 0,
    total_travel_time_minutes INTEGER DEFAULT 0,
    outdoor_time_minutes INTEGER DEFAULT 0,
    indoor_time_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 2. Backend Implementation

### 2.1 Socket.IO Integration
- Location: `backend/src/services/socket.ts`
- Purpose: Handle real-time location updates and broadcasting

### 2.1 Socket.IO Implementation Details

```typescript
// backend/src/services/socket.ts

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/postgres-adapter';
import { Pool } from 'pg';
import { RetryStrategy } from './utils/RetryStrategy';
import { LocationValidator } from './utils/LocationValidator';
import { RedisCache } from './utils/RedisCache';

interface LocationUpdate {
    userId: number;
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: string;
    batteryLevel: number;
    isMoving: boolean;
    retryCount?: number;
    lastSuccessfulUpdate?: string;
}

class LocationSocketService {
    private io: Server;
    private pool: Pool;
    private redisCache: RedisCache;
    private retryStrategy: RetryStrategy;
    private locationValidator: LocationValidator;
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000; // ms

    constructor(httpServer: any, pool: Pool) {
        this.pool = pool;
        this.redisCache = new RedisCache();
        this.retryStrategy = new RetryStrategy();
        this.locationValidator = new LocationValidator();

        this.io = new Server(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL,
                methods: ["GET", "POST"],
                credentials: true
            },
            adapter: createAdapter(pool),
            perMessageDeflate: {
                threshold: 1024, // Only compress data larger than 1KB
                zlibInflateOptions: {
                    chunkSize: 10 * 1024
                },
                zlibDeflateOptions: {
                    level: 6 // Balance between compression and CPU usage
                }
            }
        });

        this.setupMiddleware();
        this.setupEventHandlers();
    }

    private setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                const user = await verifyToken(token);
                socket.data.user = user;
                next();
            } catch (error) {
                next(new Error('Authentication failed'));
            }
        });
    }

    private setupEventHandlers() {
        this.io.on('connection', (socket) => {
            const user = socket.data.user;
            
            // Join appropriate rooms based on user role
            if (user.role === 'employee') {
                socket.join(`employee:${user.id}`);
            } else if (user.role === 'group-admin') {
                socket.join(`group:${user.group_id}`);
            }

            // Handle location updates
            socket.on('location:update', async (data: LocationUpdate) => {
                try {
                    await this.handleLocationUpdate(socket, data);
                } catch (error) {
                    console.error('Location update error:', error);
                }
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                this.handleDisconnection(socket);
            });
        });
    }

    private async handleLocationUpdate(socket: Socket, data: LocationUpdate) {
        try {
            // Validate location data
            if (!this.locationValidator.isValid(data)) {
                throw new Error('Invalid location data');
            }

            // Try to get from cache first
            const cachedLocation = await this.redisCache.get(`location:${data.userId}`);
            if (cachedLocation) {
                // Use cached data if recent enough
                return this.processLocationUpdate(cachedLocation);
            }

            const processedLocation = await this.processLocationUpdate(data);
            
            // Cache the processed location
            await this.redisCache.set(
                `location:${data.userId}`,
                processedLocation,
                60 * 5 // Cache for 5 minutes
            );

            if (processedLocation.isOutdoor) {
                await this.broadcastLocation(processedLocation);
                await this.sendNotifications(processedLocation);
            }

        } catch (error) {
            console.error('Location update error:', error);
            
            // Implement retry mechanism
            if ((data.retryCount || 0) < this.MAX_RETRIES) {
                await this.retryStrategy.retry(
                    () => this.handleLocationUpdate(socket, {
                        ...data,
                        retryCount: (data.retryCount || 0) + 1
                    }),
                    this.RETRY_DELAY
                );
            } else {
                // Log failed attempts and notify admins
                await this.handleFailedUpdates(data);
            }
        }
    }

    private async sendNotifications(location: ProcessedLocation) {
        const notifications = new NotificationService();
        
        // Check geofence violations
        if (location.geofenceStatus === 'violated') {
            await notifications.sendToGroupAdmin({
                type: 'GEOFENCE_VIOLATION',
                employeeId: location.userId,
                location: location
            });
        }

        // Check if employee is stationary for too long
        if (location.isStationary && location.stationaryDuration > 30) {
            await notifications.sendToGroupAdmin({
                type: 'EMPLOYEE_STATIONARY',
                employeeId: location.userId,
                duration: location.stationaryDuration
            });
        }
    }

    private async handleDisconnection(socket: Socket) {
        // Update user status
        // Clean up resources
    }
}

export default LocationSocketService;
```

### 2.2 New API Endpoints

#### Location Management
- `POST /api/location/update`: Update employee location
- `GET /api/location/current/:userId`: Get employee's current location
- `GET /api/location/history/:userId`: Get location history
- `GET /api/admin/locations/active`: Get all active employee locations

#### Geofencing
- `POST /api/geofence/create`: Create new geofence
- `PUT /api/geofence/update/:id`: Update geofence
- `DELETE /api/geofence/delete/:id`: Delete geofence
- `GET /api/geofence/list`: List all geofences
- `POST /api/geofence/validate`: Validate location against geofence

#### Shift Management
- `POST /api/shift/start`: Start employee shift with location validation
- `POST /api/shift/end`: End employee shift with location validation
- `GET /api/shift/status/:userId`: Get current shift status and permissions
- `PUT /api/employee/permissions`: Update employee shift permissions

### 2.3 Services

Create new service files:
- `backend/src/services/LocationService.ts`
- `backend/src/services/GeofenceService.ts`
- `backend/src/services/DistanceCalculationService.ts`

## 3. Frontend Implementation

### 3.1 New Components

#### Employee App
Location: `app/(dashboard)/employee/components/`
- `LocationTracker.tsx`: Background location tracking
- `GeofenceAlert.tsx`: Geofence entry/exit notifications
- `LocationPermissionHandler.tsx`: Location permission management

#### Group Admin Dashboard
Location: `app/(dashboard)/Group-Admin/components/`
- `LiveMap.tsx`: Real-time employee location map
- `EmployeeLocationList.tsx`: List view of employee locations
- `GeofenceEditor.tsx`: Geofence creation/editing interface
- `TrackingMetrics.tsx`: Distance and time analytics

#### Management Dashboard
- `EmployeePermissions.tsx`: Interface for managing employee shift permissions
- `GeofencePermissionOverview.tsx`: Overview of employee permissions and geofence settings

### 3.2 New Screens

#### Employee Screens
- Update `app/(dashboard)/employee/employeeShiftTracker.tsx`
- Add location tracking integration to shift management

#### Group Admin Screens
- Add `app/(dashboard)/Group-Admin/live-tracking/index.tsx`
- Add `app/(dashboard)/Group-Admin/live-tracking/geofence-management.tsx`

### 3.3 Context and Hooks
Create new hooks:
- `useLocationTracking.ts`
- `useGeofencing.ts`
- `useTrackingPermissions.ts`

### 3.4 Management Personnel Components

```typescript
// app/(dashboard)/management/components/GeofenceManagement.tsx
interface GeofenceManagementProps {
    companyId: number;
    onGeofenceUpdate: (geofence: Geofence) => void;
}

// app/(dashboard)/management/components/TrackingPermissions.tsx
interface TrackingPermissionsProps {
    companyId: number;
    employees: Employee[];
}

// app/(dashboard)/management/components/TrackingAnalytics.tsx
interface TrackingAnalyticsProps {
    companyId: number;
    dateRange: DateRange;
}
```

### 3.5 Utility Components

#### GPS Data Processing
```typescript
// app/utils/KalmanFilter.ts
export class KalmanFilter {
    private Q_metres_per_second: number;
    private R_metres: number;
    private time_step: number;
    private variance: number;
    
    constructor() {
        this.Q_metres_per_second = 3;
        this.R_metres = 1;
        this.time_step = 1;
        this.variance = -1;
    }

    // Filter implementation methods
}
```

#### Geofence Validation
```typescript
// backend/src/services/GeofenceService.ts
class GeofenceService {
    private readonly HYSTERESIS_BUFFER_METERS = 10;
    private readonly CONSECUTIVE_READINGS_REQUIRED = 3;
    
    async validateLocation(location: Location, geofence: Geofence) {
        // Hysteresis logic implementation
    }
}
```

## 4. Mobile-Specific Implementation

### 4.1 Background Location Tracking
- Implement using Expo Location
- Configure background task for location updates
- Optimize battery usage with intelligent polling

### 4.2 Geofencing Implementation
- Use native geofencing capabilities
- Implement entry/exit detection
- Handle background notifications

## 5. Integration Points

### 5.1 Database Integration
- PostGIS functions for distance calculations
- Spatial queries for geofence validation
- Efficient location data storage and retrieval

### 5.2 Real-time Updates
- Socket.IO for live location broadcasting
- Redis for caching current locations
- Efficient data structures for real-time updates

## 6. Security Considerations

### 6.1 Data Protection
- Encrypt location data in transit and at rest
- Implement access control for location data
- Add audit logging for location access

### 6.2 Privacy Controls
- Allow employees to control tracking precision
- Implement data retention policies
- Provide transparency in location usage

## 7. Performance Optimization

### 7.1 Backend Optimization
- Implement location data batching
- Use efficient spatial indexes
- Optimize query performance

### 7.2 Frontend Optimization
- Implement map clustering
- Use WebSocket compression
- Optimize render performance

## 8. Testing Strategy

### 8.1 Unit Tests
```typescript
// tests/unit/location/LocationValidator.test.ts
describe('LocationValidator', () => {
    it('should validate location accuracy', () => {
        const validator = new LocationValidator();
        const location = {
            accuracy: 50,
            latitude: 12.34,
            longitude: 56.78
        };
        expect(validator.validateLocation(location).isValid).toBe(true);
    });
});

// tests/unit/geofence/GeofenceValidator.test.ts
describe('GeofenceValidator', () => {
    it('should validate geofence polygon', () => {
        const validator = new GeofenceValidator();
        const geofence = {
            coordinates: [
                [0, 0],
                [0, 1],
                [1, 1],
                [1, 0],
                [0, 0]
            ]
        };
        expect(validator.validateGeofence(geofence).isValid).toBe(true);
    });
});

// tests/unit/shift/ShiftPermissionService.test.ts
describe('ShiftPermissionService', () => {
    it('should allow shift start within geofence for regular employees', async () => {
        const service = new ShiftPermissionService();
        const result = await service.canStartShift(
            regularEmployeeId,
            validLocationWithinGeofence
        );
        expect(result.allowed).toBe(true);
    });

    it('should allow shift start anywhere for employees with override permission', async () => {
        const service = new ShiftPermissionService();
        const result = await service.canStartShift(
            employeeWithOverrideId,
            locationOutsideGeofence
        );
        expect(result.allowed).toBe(true);
    });

    it('should require location access for all employees', async () => {
        const service = new ShiftPermissionService();
        const result = await service.canStartShift(
            employeeId,
            null
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Location access is required to start shift');
    });
});
```

### 8.2 Integration Tests
```typescript
// tests/integration/location/LocationTracking.test.ts
describe('Location Tracking Integration', () => {
    it('should track location updates end-to-end', async () => {
        const socket = await createTestSocket();
        const location = createTestLocation();
        
        await socket.emit('location:update', location);
        
        // Verify database update
        const savedLocation = await getLastLocation(location.userId);
        expect(savedLocation).toBeDefined();
        
        // Verify cache update
        const cachedLocation = await redisCache.get(`location:${location.userId}`);
        expect(cachedLocation).toBeDefined();
        
        // Verify notification
        const notification = await getLastNotification(location.userId);
        expect(notification).toBeDefined();
    });
});
```

### 8.3 Performance Tests
```typescript
// tests/performance/LocationTracking.test.ts
describe('Location Tracking Performance', () => {
    it('should handle high volume of concurrent updates', async () => {
        const CONCURRENT_USERS = 1000;
        const UPDATES_PER_USER = 10;
        
        const startTime = Date.now();
        await simulateConcurrentUpdates(CONCURRENT_USERS, UPDATES_PER_USER);
        const endTime = Date.now();
        
        expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30s
    });
});
```

### 8.4 Security Tests
```typescript
// tests/security/LocationAccess.test.ts
describe('Location Access Security', () => {
    it('should prevent unauthorized access to location data', async () => {
        const unauthorizedUser = await createTestUser('employee');
        const locationData = await getLocationData(1); // Another user's location
        
        expect(locationData).toBeNull();
    });
});
```

## 9. Notification System

### 9.1 Push Notification Service
```typescript
// backend/src/services/NotificationService.ts
export class NotificationService {
    async sendToGroupAdmin(notification: AdminNotification) {
        switch (notification.type) {
            case 'GEOFENCE_VIOLATION':
                await this.sendGeofenceViolationNotification(notification);
                break;
            case 'EMPLOYEE_STATIONARY':
                await this.sendStationaryNotification(notification);
                break;
            // ... other notification types
        }
    }

    private async sendGeofenceViolationNotification(notification: GeofenceViolationNotification) {
        const { employeeId, location } = notification;
        const employee = await getUserDetails(employeeId);
        const admins = await getGroupAdmins(employee.groupId);
        
        for (const admin of admins) {
            await expo.sendPushNotification({
                to: admin.expoPushToken,
                title: 'Geofence Violation Alert',
                body: `${employee.name} has left the designated area`,
                data: { location, type: 'GEOFENCE_VIOLATION' }
            });
        }
    }
}
```

### 9.2 Notification Types
```typescript
// types/notifications.ts
export interface BaseNotification {
    type: NotificationType;
    employeeId: number;
    timestamp: string;
}

export interface GeofenceViolationNotification extends BaseNotification {
    type: 'GEOFENCE_VIOLATION';
    location: Location;
    geofenceId: number;
}

export interface StationaryNotification extends BaseNotification {
    type: 'EMPLOYEE_STATIONARY';
    duration: number;
    location: Location;
}
```

## 10. Monitoring and Maintenance

### 10.1 Monitoring
- Track socket connections
- Monitor location accuracy
- Track battery impact
- Monitor data usage

### 10.2 Maintenance
- Regular performance reviews
- Data cleanup routines
- Battery optimization updates
- Security updates

## Implementation Timeline

1. **Week 1**: Database schema updates and backend foundation
2. **Week 2**: Socket.IO implementation and basic location tracking
3. **Week 3**: Geofencing implementation and location history
4. **Week 4**: Frontend components and real-time map
5. **Week 5**: Mobile background tracking and notifications
6. **Week 6**: Testing, optimization, and deployment

## Success Criteria

1. Real-time location updates with < 1s delay
2. Battery impact < 5% per hour
3. Location accuracy within 10 meters
4. Geofence detection within 30 seconds
5. Smooth map performance with 100+ markers
6. Background tracking reliability > 99%

## Dependencies

1. PostGIS extension for PostgreSQL
2. Socket.IO for real-time communication
3. Expo Location for mobile tracking
4. Google Maps API for visualization
5. Redis for caching (optional)

## Risk Mitigation

1. **Battery Drain**
   - Implement adaptive polling
   - Use geofencing to reduce updates
   - Monitor battery impact

2. **Data Privacy**
   - Implement strict access controls
   - Add data encryption
   - Regular security audits

3. **Performance**
   - Use efficient data structures
   - Implement caching
   - Regular optimization

4. **Reliability**
   - Implement offline support
   - Add retry mechanisms
   - Monitor system health

## 11. Deployment Strategy

### 11.1 Database Migration Plan
```sql
-- Create migration script: migrations/001_live_tracking.sql
BEGIN;

-- Create extensions if not exists
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create tables in order of dependencies
CREATE TABLE IF NOT EXISTS company_tracking_settings;
CREATE TABLE IF NOT EXISTS user_tracking_permissions;
CREATE TABLE IF NOT EXISTS company_geofences;
CREATE TABLE IF NOT EXISTS employee_locations;

-- Add foreign key constraints
ALTER TABLE employee_locations 
    ADD CONSTRAINT fk_employee_shift 
    FOREIGN KEY (shift_id) 
    REFERENCES employee_shifts(id);

-- Create indexes
CREATE INDEX idx_employee_locations_timestamp ON employee_locations(timestamp);
CREATE INDEX idx_geofence_company ON company_geofences(company_id);

COMMIT;
```

### 11.2 Backend Deployment

#### 11.2.1 Socket.IO Service Deployment
```bash
# Docker configuration for Socket.IO service
# docker-compose.socket.yml
version: '3.8'
services:
  socket-service:
    build:
      context: ./backend
      dockerfile: Dockerfile.socket
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - DB_CONNECTION_STRING=${DB_CONNECTION_STRING}
    ports:
      - "3001:3001"
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

#### 11.2.2 API Service Deployment
```bash
# Docker configuration for API service
# docker-compose.api.yml
version: '3.8'
services:
  api-service:
    build:
      context: ./backend
      dockerfile: Dockerfile.api
    environment:
      - NODE_ENV=production
      - SOCKET_SERVICE_URL=http://socket-service:3001
    ports:
      - "3000:3000"
    depends_on:
      - socket-service
```

### 11.3 Frontend Deployment

#### 11.3.1 Mobile App Build
```bash
# Build configuration for Expo
eas.json
{
  "build": {
    "production": {
      "env": {
        "SOCKET_URL": "wss://your-socket-service.com",
        "API_URL": "https://your-api.com"
      },
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "buildConfiguration": "Release"
      }
    }
  }
}
```

## 12. Testing Strategy

### 12.1 Unit Testing
- Test individual components and services
- Test data validation and processing
- Test geofence calculations
- Test notification logic

### 12.2 Integration Testing
- Test Socket.IO connections and events
- Test database operations
- Test API endpoints
- Test real-time updates

### 12.3 End-to-End Testing
- Test complete user flows
- Test background tracking
- Test geofence notifications
- Test admin dashboard features

### 12.4 Performance Testing
- Load testing with simulated users
- Stress testing socket connections
- Database query performance
- Mobile app battery consumption

### 12.5 Security Testing
- Penetration testing
- Authentication testing
- Authorization testing
- Data encryption testing

## 13. Monitoring and Alerting

### 13.1 System Monitoring
```yaml
# Prometheus configuration
scrape_configs:
  - job_name: 'socket-service'
    static_configs:
      - targets: ['socket-service:3001']
  - job_name: 'api-service'
    static_configs:
      - targets: ['api-service:3000']
```

### 13.2 Alert Rules
```yaml
# Alert configuration
groups:
  - name: location_tracking
    rules:
      - alert: HighLocationUpdateLatency
        expr: location_update_latency_seconds > 5
        for: 5m
        labels:
          severity: warning
      - alert: GeofenceProcessingDelay
        expr: geofence_processing_delay_seconds > 10
        for: 5m
        labels:
          severity: critical
```

## 14. Rollback Strategy

### 14.1 Database Rollback
```sql
-- Rollback script: migrations/001_live_tracking_rollback.sql
BEGIN;

DROP TABLE IF EXISTS tracking_analytics;
DROP TABLE IF EXISTS employee_locations;
DROP TABLE IF EXISTS company_geofences;
DROP TABLE IF EXISTS user_tracking_permissions;
DROP TABLE IF EXISTS company_tracking_settings;

-- Remove columns from employee_shifts
ALTER TABLE employee_shifts
    DROP COLUMN IF EXISTS location_history,
    DROP COLUMN IF EXISTS total_distance_km,
    DROP COLUMN IF EXISTS travel_time_minutes,
    DROP COLUMN IF EXISTS last_location_update;

COMMIT;
```

### 14.2 Service Rollback
```bash
# Rollback script
#!/bin/bash
# rollback.sh

# Stop new services
docker-compose -f docker-compose.socket.yml down
docker-compose -f docker-compose.api.yml down

# Start previous version
docker-compose -f docker-compose.previous.yml up -d

# Execute database rollback
psql -U $DB_USER -d $DB_NAME -f migrations/001_live_tracking_rollback.sql
```

## 15. Documentation Requirements

### 15.1 Technical Documentation
- API documentation
- Database schema documentation
- Socket event documentation
- Deployment guides

### 15.2 User Documentation
- Employee app user guide
- Admin dashboard guide
- Troubleshooting guide
- Privacy policy updates

## 16. Shift Management and Permissions

### 16.1 Shift Start/End Validation

#### Database Updates
```sql
-- Add columns to users table if not exists
ALTER TABLE users
ADD COLUMN IF NOT EXISTS can_submit_expenses_anytime BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shift_status VARCHAR(20) DEFAULT 'inactive';

-- Create index for faster permission checks
CREATE INDEX idx_user_shift_permissions ON users(id, can_submit_expenses_anytime, shift_status);
```

#### Permission Service
```typescript
// backend/src/services/ShiftPermissionService.ts
export class ShiftPermissionService {
    constructor(
        private geofenceService: GeofenceService,
        private locationService: LocationService
    ) {}

    async canStartShift(userId: number, location: Location): Promise<ValidationResult> {
        const user = await this.getUserWithPermissions(userId);
        
        // Check if location access is enabled
        if (!await this.locationService.hasLocationAccess(userId)) {
            return {
                allowed: false,
                reason: 'Location access is required to start shift'
            };
        }

        // Users with override permission can start shift anywhere
        if (user.can_submit_expenses_anytime && user.shift_status === 'active') {
            return { allowed: true };
        }

        // For users without override permission, validate location
        const companyGeofence = await this.geofenceService.getCompanyGeofence(user.company_id);
        if (!companyGeofence) {
            return { allowed: true }; // No geofence set
        }

        const isWithinGeofence = await this.geofenceService.isLocationWithinGeofence(
            location,
            companyGeofence
        );

        return {
            allowed: isWithinGeofence,
            reason: isWithinGeofence ? null : 'Must be within company geofence to start shift'
        };
    }

    async canEndShift(userId: number, location: Location): Promise<ValidationResult> {
        // Similar logic to canStartShift
        // Additional validation specific to shift end
    }

    private async getUserWithPermissions(userId: number) {
        const user = await db.users.findFirst({
            where: { id: userId },
            select: {
                id: true,
                company_id: true,
                can_submit_expenses_anytime: true,
                shift_status: true
            }
        });
        return user;
    }
}
```

### 16.2 API Endpoints

```typescript
// backend/src/routes/shift.ts
router.post('/api/shift/start', async (req, res) => {
    const { userId, location } = req.body;
    
    const permissionService = new ShiftPermissionService(
        new GeofenceService(),
        new LocationService()
    );

    const validationResult = await permissionService.canStartShift(userId, location);
    
    if (!validationResult.allowed) {
        return res.status(403).json({
            error: validationResult.reason
        });
    }

    // Proceed with shift start logic
});

router.post('/api/shift/end', async (req, res) => {
    // Similar logic to shift start
});
```

### 16.3 Management Interface

```typescript
// app/(dashboard)/management/components/EmployeePermissions.tsx
interface EmployeePermissionsProps {
    companyId: number;
}

const EmployeePermissions: React.FC<EmployeePermissionsProps> = ({ companyId }) => {
    const updateEmployeePermissions = async (
        employeeId: number,
        canSubmitExpensesAnytime: boolean
    ) => {
        await fetch('/api/employee/permissions', {
            method: 'PUT',
            body: JSON.stringify({
                employeeId,
                canSubmitExpensesAnytime,
                shiftStatus: canSubmitExpensesAnytime ? 'active' : 'inactive'
            })
        });
    };

    return (
        // Permission management UI
    );
};
```

### 16.4 Frontend Integration

```typescript
// app/(dashboard)/employee/components/ShiftControls.tsx
const ShiftControls: React.FC = () => {
    const startShift = async () => {
        // Get current location
        const location = await getCurrentLocation();
        
        // Check location access
        if (!await hasLocationPermission()) {
            requestLocationPermission();
            return;
        }

        try {
            const response = await fetch('/api/shift/start', {
                method: 'POST',
                body: JSON.stringify({ location })
            });

            if (!response.ok) {
                const error = await response.json();
                showError(error.reason);
                return;
            }

            // Handle successful shift start
        } catch (error) {
            handleError(error);
        }
    };

    return (
        // Shift control UI
    );
};
``` 