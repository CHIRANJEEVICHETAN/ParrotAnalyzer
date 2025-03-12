# Push Notifications Implementation

This document outlines the implementation of push notifications in the ParrotAnalyzer application.

## Overview

The push notification system enables real-time alerts to be sent to users based on their roles (employee, group-admin, management). The implementation includes both frontend and backend components, allowing for targeted notifications to specific users or groups.

## Database Structure

Two tables were created to support push notifications:

1. **device_tokens**
   - `id`: Primary key
   - `user_id`: Foreign key to users table
   - `token`: Device token for push notifications
   - `device_type`: Type of device (iOS, Android)
   - `device_name`: Name of the device
   - `created_at`: Timestamp of token creation
   - `updated_at`: Timestamp of token update
   - `last_used_at`: Timestamp of last token usage
   - `is_active`: Boolean indicating if the token is active

2. **push_notifications**
   - `id`: Primary key
   - `user_id`: Foreign key to users table (nullable for group notifications)
   - `title`: Notification title
   - `message`: Notification content
   - `data`: JSON data for additional notification information
   - `type`: Type of notification (employee, group-admin, management, general, test)
   - `priority`: Priority level (high, default, low)
   - `category`: Category for notification grouping
   - `action_url`: URL to navigate to when notification is tapped
   - `sent`: Boolean indicating if notification was sent
   - `sent_at`: Timestamp when notification was sent
   - `created_at`: Timestamp of notification creation

## Frontend Implementation

### Push Notification Service

Located at `app/utils/pushNotificationService.ts`, this service handles:

- Requesting notification permissions
- Registering device tokens with the backend
- Setting up notification handlers
- Managing notification responses
- Creating notification channels for Android

The service directly uses the environment variable `process.env.EXPO_PUBLIC_API_URL` for API endpoints.

### App Root Component

The app's root component (`app/_layout.tsx`) initializes push notifications on app startup, ensuring that:

- Permissions are requested
- Device tokens are registered
- Notification handlers are set up
- Tokens are only registered when the user is logged in

### Notification Components

1. **PushNotificationsList Component** (`app/components/PushNotificationsList.tsx`)
   - Displays push notifications for the current user
   - Fetches notifications from the appropriate endpoint based on user role
   - Handles loading states and empty states
   - Formats notifications with appropriate icons and timestamps
   - Uses direct environment variable references for API endpoints
   - Implements pull-to-refresh functionality
   - Provides error handling with retry options

2. **Role-specific Notification Pages**
   - Employee: `app/(dashboard)/employee/notifications.tsx`
   - Group Admin: `app/(dashboard)/Group-Admin/notifications.tsx`
   - Management: `app/(dashboard)/management/notifications.tsx`
   
   Each page includes:
   - Tab navigation between in-app and push notifications
   - Filtering options for different notification types
   - Actions for managing notifications (mark as read, etc.)
   - Integration with the PushNotificationsList component

3. **Test Push Notifications Screen** (`app/screens/TestPushNotifications.tsx`)
   - Allows testing of push notifications
   - Provides options based on user role
   - Sends test notifications to appropriate endpoints
   - Uses direct environment variable references for API endpoints
   - Includes role-specific options:
     - Employees: Send test to self
     - Group Admins: Send to self or group
     - Management: Send to self, all users, or by role (employees/group-admins)

4. **Notification Settings Pages**
   - Group Admin: `app/(dashboard)/Group-Admin/settings/notifications.tsx`
   - Management: `app/(dashboard)/management/settings/notifications.tsx`
   
   These pages manage notification permissions and settings rather than displaying notifications, including:
   - Toggle for enabling/disabling push notifications
   - Permission management
   - Settings for different notification types
   - Integration with device notification settings

## Backend Implementation

### Device Token Management

Endpoints for managing device tokens:

- `POST /api/device-tokens`: Register a new device token
- `DELETE /api/device-tokens/:token`: Delete a device token (for logout)

The implementation includes:
- Checking for existing tokens
- Updating tokens when they already exist
- Storing device information (type, name)
- Marking tokens as active/inactive

### Push Notification Service

Backend service for sending push notifications:

- Handles sending to specific users or groups
- Manages notification delivery through Expo Push Notification Service
- Stores notification history in the database
- Creates corresponding in-app notifications
- Supports different notification priorities and categories

### Role-specific Notification Routes

1. **Employee Notifications**
   - `GET /api/employee-push-notifications`: Get notifications for the current employee
   - `POST /api/employee-push-notifications/test`: Send a test notification to the current employee

2. **Group Admin Notifications**
   - `GET /api/group-admin-push-notifications`: Get notifications for the current group admin
   - `POST /api/group-admin-push-notifications/test`: Send a test notification to the current group admin
   - `POST /api/group-admin-push-notifications/notify-group`: Send a notification to all employees in the admin's group

3. **Management Notifications**
   - `GET /api/management-push-notifications`: Get notifications for the current management user
   - `POST /api/management-push-notifications/test`: Send a test notification to the current management user
   - `POST /api/management-push-notifications/notify-all`: Send a notification to all users
   - `POST /api/management-push-notifications/notify-by-role`: Send a notification to all users with a specific role

## API Endpoints

All API endpoints use the environment variable `EXPO_PUBLIC_API_URL` directly for the base URL.

### Device Tokens

- `${process.env.EXPO_PUBLIC_API_URL}/api/device-tokens` (POST): Register a device token
- `${process.env.EXPO_PUBLIC_API_URL}/api/device-tokens/:token` (DELETE): Delete a device token

### Employee Endpoints

- `${process.env.EXPO_PUBLIC_API_URL}/api/employee-push-notifications` (GET): Get employee notifications
- `${process.env.EXPO_PUBLIC_API_URL}/api/employee-push-notifications/test` (POST): Test employee notification

### Group Admin Endpoints

- `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-push-notifications` (GET): Get group admin notifications
- `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-push-notifications/test` (POST): Test group admin notification
- `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-push-notifications/notify-group` (POST): Notify all employees in a group

### Management Endpoints

- `${process.env.EXPO_PUBLIC_API_URL}/api/management-push-notifications` (GET): Get management notifications
- `${process.env.EXPO_PUBLIC_API_URL}/api/management-push-notifications/test` (POST): Test management notification
- `${process.env.EXPO_PUBLIC_API_URL}/api/management-push-notifications/notify-all` (POST): Notify all users
- `${process.env.EXPO_PUBLIC_API_URL}/api/management-push-notifications/notify-by-role` (POST): Notify users by role

## Testing

The application includes a dedicated test screen (`app/screens/TestPushNotifications.tsx`) that allows users to:

1. Send test notifications to themselves
2. For group admins: Send notifications to their group
3. For management: Send notifications to all users or specific roles (employees or group-admins)

## Integration with In-App Notifications

The push notification system works alongside the existing in-app notification system. When a push notification is sent, a corresponding entry is created in the `notifications` table for in-app visibility, ensuring users can see their notifications regardless of how they access the application.

## Configuration

The application uses environment variables for configuration:
- `EXPO_PUBLIC_API_URL`: The base URL for API endpoints
- `EXPO_PROJECT_ID`: The Expo project ID used for push notifications

These are defined in the `.env` file and accessed directly in the code using `process.env.EXPO_PUBLIC_API_URL`.

## Future Enhancements

Potential future enhancements to the push notification system:

1. **Notification Preferences**: Allow users to set preferences for which notifications they receive
2. **Rich Notifications**: Support for images and action buttons in notifications
3. **Scheduled Notifications**: Allow scheduling notifications for future delivery
4. **Analytics**: Track notification open rates and engagement
5. **Topic-based Notifications**: Allow users to subscribe to specific notification topics
6. **Notification History**: Implement a more comprehensive notification history view with search and filtering
7. **Batch Notifications**: Group similar notifications to reduce notification fatigue 