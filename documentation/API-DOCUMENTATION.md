# Parrot Analyzer API Documentation

This document provides a comprehensive overview of the Parrot Analyzer API. It covers everything from general API information and authentication to detailed endpoint descriptions for user management, expense management, leave management, task management, chat, reports, company management, and additional administrative functions. It also details error handling and middleware configurations.

---

## Table of Contents

1. [General API Information](#1-general-api-information)
2. [Authentication Details](#2-authentication-details)
3. [User Management Endpoints](#3-user-management-endpoints)
4. [Expense Management Endpoints](#4-expense-management-endpoints)
5. [Leave Management Endpoints](#5-leave-management-endpoints)
6. [Task Management Endpoints](#6-task-management-endpoints)
7. [Chat Endpoints](#7-chat-endpoints)
8. [Report Endpoints](#8-report-endpoints)
9. [Company Management Endpoints](#9-company-management-endpoints)
10. [Error Handling](#10-error-handling)
11. [Test Endpoints](#11-test-endpoints)
12. [Middleware and Global Configurations](#12-middleware-and-global-configurations)
13. [Additional Endpoints](#13-additional-endpoints)
    - [Schedule Management](#schedule-management)
    - [Notifications](#notifications)
      - [General Notifications](#notifications)
      - [Group Admin Notifications](#group-admin-notifications)
        - [Task Assignment Notifications](#send-task-assignment-notification)
        - [Leave Status Notifications](#send-leave-status-notification)
        - [Management Notifications](#send-notification-to-management)
      - [Management Notifications](#management-notifications)
        - [User Notifications](#send-user-notifications)
        - [Device Token Management](#device-token-management)
        - [Notification Counts](#get-unread-notification-count)
    - [Super Admin Management](#super-admin-management)
    - [Group Admin Management](#group-admin-management)
    - [Employee Management](#employee-management)
    - [Group Admin Leave Management](#group-admin-leave-management)
    - [Leave Management Balance and History](#leave-management-balance-and-history)
14. [Updated Error Handling and Middleware](#14-updated-error-handling-and-middleware)

---

## 1. General API Information

### Base URL
- *Base URL:* http://your-server-ip:3000

### API Versioning
- The API does not use explicit versioning in the URL paths.
- All API endpoints are prefixed with /api except for authentication endpoints.

### Authentication
- *Method:* JWT (JSON Web Token)
- *Token Format:* Bearer token in the Authorization header
- *Token Expiration:* 24 hours
- *Token Refresh:* Available via the /auth/refresh endpoint

---

## 2. Authentication Details

### Authentication Method
The API uses JWT (JSON Web Token) for authentication. After a successful login, a token is provided that must be included in the Authorization header for subsequent requests.

### Header Format

Authorization: Bearer <token>


### Authentication Endpoints

#### Login
- *URL:* /auth/login  
- *Method:* POST  
- *Description:* Authenticates a user and returns a JWT token  
- *Request Body:*
  json
  {
    "identifier": "user@example.com", // Email or phone number
    "password": "yourpassword"
  }
  
- *Response:*
  json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "123",
      "name": "John Doe",
      "email": "user@example.com",
      "phone": "1234567890",
      "role": "employee",
      "company_id": "456"
    }
  }
  
- *Error Responses:*
  - 401: Invalid credentials
  - 403: Company access disabled
  - 500: Failed to login

#### Forgot Password
- *URL:* /auth/forgot-password  
- *Method:* POST  
- *Description:* Sends a password reset OTP to the user's email  
- *Request Body:*
  json
  {
    "email": "user@example.com"
  }
  
- *Response:*
  json
  {
    "message": "Reset code sent successfully"
  }
  
- *Error Responses:*
  - 404: User not found
  - 500: Failed to process request

#### Verify OTP
- *URL:* /auth/verify-otp  
- *Method:* POST  
- *Description:* Verifies the OTP sent to the user's email  
- *Request Body:*
  json
  {
    "email": "user@example.com",
    "otp": "123456"
  }
  
- *Response:*
  json
  {
    "message": "Code verified successfully"
  }
  
- *Error Responses:*
  - 400: Invalid or expired code
  - 500: Failed to verify code

#### Reset Password
- *URL:* /auth/reset-password  
- *Method:* POST  
- *Description:* Resets the user's password using the OTP  
- *Request Body:*
  json
  {
    "email": "user@example.com",
    "otp": "123456",
    "newPassword": "newpassword"
  }
  
- *Response:*
  json
  {
    "message": "Password reset successfully"
  }
  
- *Error Responses:*
  - 400: Invalid or expired code
  - 500: Failed to reset password

#### Refresh Token
- *URL:* /auth/refresh  
- *Method:* POST  
- *Description:* Refreshes the JWT token  
- *Authentication:* Required  
- *Response:*
  json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "123",
      "name": "John Doe",
      "email": "user@example.com",
      "phone": "1234567890",
      "role": "employee",
      "company_id": "456"
    }
  }
  
- *Error Responses:*
  - 401: User not found
  - 403: Company access disabled
  - 500: Internal server error

---

## 3. User Management Endpoints

### User Profile

#### Get User Profile
- *URL:* /api/users/profile  
- *Method:* GET  
- *Description:* Retrieves the authenticated user's profile  
- *Authentication:* Required  
- *Response:*
  json
  {
    "id": "123",
    "name": "John Doe",
    "email": "user@example.com",
    "phone": "1234567890",
    "role": "employee"
  }
  
- *Error Responses:*
  - 401: Authentication required
  - 500: Error fetching user profile

#### Update User Profile
- *URL:* /api/users/profile  
- *Method:* PUT  
- *Description:* Updates the authenticated user's profile  
- *Authentication:* Required  
- *Request Body:* Form data with fields:
  - name: User's name
  - phone: User's phone number
  - profileImage: (Optional) Profile image file (JPEG/PNG, max 5MB)
- *Response:*
  json
  {
    "id": "123",
    "name": "John Doe",
    "email": "user@example.com",
    "phone": "1234567890",
    "profile_image": "base64encodedimage"
  }
  
- *Error Responses:*
  - 400: Image size should be less than 5MB
  - 400: Only JPEG and PNG images are allowed
  - 401: Authentication required
  - 404: User not found
  - 500: Failed to update profile

#### Change Password
- *URL:* /api/users/change-password  
- *Method:* POST  
- *Description:* Changes the authenticated user's password  
- *Authentication:* Required  
- *Request Body:*
  json
  {
    "currentPassword": "oldpassword",
    "newPassword": "newpassword"
  }
  
- *Response:*
  json
  {
    "message": "Password updated successfully"
  }
  
- *Error Responses:*
  - 400: Current password is incorrect
  - 401: Authentication required
  - 404: User not found
  - 500: Failed to change password

#### Get Profile Image
- *URL:* /api/users/profile-image/:id  
- *Method:* GET  
- *Description:* Retrieves a user's profile image  
- *Parameters:*
  - id: User ID  
- *Response:*
  json
  {
    "image": "base64encodedimage"
  }
  
- *Error Responses:*
  - 500: Failed to fetch profile image

### User Registration and Management

#### Register New User
- *URL:* /api/users/register  
- *Method:* POST  
- *Description:* Registers a new user (requires admin privileges)  
- *Authentication:* Required  
- *Request Body:*
  json
  {
    "name": "John Doe",
    "email": "user@example.com",
    "password": "password",
    "role": "employee",
    "company_id": "456"
  }
  
- *Response:*
  json
  {
    "user": {
      "id": "123",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "employee"
    },
    "needsApproval": false
  }
  
- *Error Responses:*
  - 403: Company is disabled
  - 500: Failed to create user

#### Approve User
- *URL:* /api/users/approve/:id  
- *Method:* POST  
- *Description:* Approves a pending user (super admin only)  
- *Authentication:* Required (Super Admin)  
- *Parameters:*
  - id: User ID to approve  
- *Response:*
  json
  {
    "message": "User approved successfully"
  }
  
- *Error Responses:*
  - 401: Authentication required
  - 403: Access denied. Super admin only.
  - 500: Failed to approve user

#### Send Support Message
- *URL:* /api/users/support-message  
- *Method:* POST  
- *Description:* Sends a support message  
- *Authentication:* Required  
- *Request Body:*
  json
  {
    "subject": "Help needed",
    "message": "I'm having trouble with..."
  }
  
- *Response:*
  json
  {
    "message": "Support message sent successfully"
  }
  
- *Error Responses:*
  - 401: Authentication required
  - 500: Failed to send support message

---

## 4. Expense Management Endpoints

### Employee Expenses

#### Get My Expenses
- *URL:* /api/expenses/employee/my-expenses  
- *Method:* GET  
- *Description:* Retrieves the authenticated employee's expenses  
- *Authentication:* Required  
- *Response:*
  json
  [
    {
      "id": "123",
      "date": "2023-01-01",
      "total_amount": 1000,
      "amount_payable": 900,
      "status": "pending",
      "rejection_reason": null,
      "created_at": "2023-01-01T12:00:00Z",
      "vehicle_type": "car",
      "vehicle_number": "ABC123",
      "total_kilometers": "100",
      "route_taken": "City A to City B",
      "lodging_expenses": "200",
      "daily_allowance": "100",
      "diesel": "300",
      "toll_charges": "50",
      "other_expenses": "50",
      "advance_taken": "100"
    }
  ]
  
- *Error Responses:*
  - 401: Authentication required
  - 500: Failed to fetch expenses

#### Submit Expense
- *URL:* /api/expenses/submit  
- *Method:* POST  
- *Description:* Submits a new expense  
- *Authentication:* Required  
- *Request Body:* Form data with fields:
  - employeeName: Employee name
  - employeeNumber: Employee number
  - department: Department
  - designation: Designation
  - location: Location
  - date: Date of expense
  - vehicleType: Type of vehicle
  - vehicleNumber: Vehicle number
  - totalKilometers: Total kilometers
  - startTime: Start time
  - endTime: End time
  - routeTaken: Route taken
  - lodgingExpenses: Lodging expenses
  - dailyAllowance: Daily allowance
  - diesel: Diesel expenses
  - tollCharges: Toll charges
  - otherExpenses: Other expenses
  - advanceTaken: Advance taken
  - supportingDocs: (Optional) Supporting documents (images/PDFs)
- *Response:*
  json
  {
    "id": "123",
    "message": "Expense submitted successfully"
  }
  
- *Error Responses:*
  - 400: Invalid input data
  - 401: Authentication required
  - 500: Failed to submit expense

---

## 5. Leave Management Endpoints

### Employee Leave

#### Request Leave
- *URL:* /api/leave/request  
- *Method:* POST  
- *Description:* Submits a leave request  
- *Authentication:* Required  
- *Request Body:*
  json
  {
    "start_date": "2023-01-01",
    "end_date": "2023-01-05",
    "reason": "Vacation",
    "leave_type": "annual"
  }
  
- *Response:*
  json
  {
    "id": "123",
    "message": "Leave request submitted successfully"
  }
  
- *Error Responses:*
  - 400: Invalid input data
  - 401: Authentication required
  - 500: Failed to submit leave request

#### Get My Leave Requests
- *URL:* /api/leave/my-requests  
- *Method:* GET  
- *Description:* Retrieves the authenticated employee's leave requests  
- *Authentication:* Required  
- *Response:*
  json
  [
    {
      "id": "123",
      "start_date": "2023-01-01",
      "end_date": "2023-01-05",
      "reason": "Vacation",
      "status": "pending",
      "leave_type": "annual",
      "created_at": "2022-12-25T12:00:00Z"
    }
  ]
  
- *Error Responses:*
  - 401: Authentication required
  - 500: Failed to fetch leave requests

---

## 6. Task Management Endpoints

### Tasks

#### Get My Tasks
- *URL:* /api/tasks/my-tasks  
- *Method:* GET  
- *Description:* Retrieves the authenticated user's tasks  
- *Authentication:* Required  
- *Response:*
  json
  [
    {
      "id": "123",
      "title": "Complete report",
      "description": "Finish the quarterly report",
      "due_date": "2023-01-15",
      "priority": "high",
      "status": "in_progress",
      "created_at": "2023-01-01T12:00:00Z"
    }
  ]
  
- *Error Responses:*
  - 401: Authentication required
  - 500: Failed to fetch tasks

#### Create Task
- *URL:* /api/tasks/create  
- *Method:* POST  
- *Description:* Creates a new task  
- *Authentication:* Required  
- *Request Body:*
  json
  {
    "title": "Complete report",
    "description": "Finish the quarterly report",
    "due_date": "2023-01-15",
    "priority": "high",
    "assigned_to": "456"
  }
  
- *Response:*
  json
  {
    "id": "123",
    "message": "Task created successfully"
  }
  
- *Error Responses:*
  - 400: Invalid input data
  - 401: Authentication required
  - 500: Failed to create task

---

## 7. Chat Endpoints

### Chat

#### Get Conversations
- *URL:* /api/chat/conversations  
- *Method:* GET  
- *Description:* Retrieves the authenticated user's conversations  
- *Authentication:* Required  
- *Response:*
  json
  [
    {
      "id": "123",
      "participants": [
        {
          "id": "456",
          "name": "John Doe"
        },
        {
          "id": "789",
          "name": "Jane Smith"
        }
      ],
      "last_message": {
        "content": "Hello there!",
        "sent_at": "2023-01-01T12:00:00Z"
      },
      "unread_count": 2
    }
  ]
  
- *Error Responses:*
  - 401: Authentication required
  - 500: Failed to fetch conversations

#### Get Messages
- *URL:* /api/chat/messages/:conversationId  
- *Method:* GET  
- *Description:* Retrieves messages for a specific conversation  
- *Authentication:* Required  
- *Parameters:*
  - conversationId: Conversation ID  
- *Response:*
  json
  [
    {
      "id": "123",
      "sender_id": "456",
      "content": "Hello there!",
      "sent_at": "2023-01-01T12:00:00Z",
      "read": true
    }
  ]
  
- *Error Responses:*
  - 401: Authentication required
  - 403: Access denied
  - 500: Failed to fetch messages

#### Send Message
- *URL:* /api/chat/send  
- *Method:* POST  
- *Description:* Sends a message  
- *Authentication:* Required  
- *Request Body:*
  json
  {
    "conversation_id": "123",
    "content": "Hello there!"
  }
  
- *Response:*
  json
  {
    "id": "456",
    "message": "Message sent successfully"
  }
  
- *Error Responses:*
  - 400: Invalid input data
  - 401: Authentication required
  - 500: Failed to send message

---

## 8. Report Endpoints

### Reports

#### Generate Report
- *URL:* /api/reports/generate  
- *Method:* POST  
- *Description:* Generates a report  
- *Authentication:* Required  
- *Request Body:*
  json
  {
    "report_type": "expense",
    "start_date": "2023-01-01",
    "end_date": "2023-01-31",
    "filters": {
      "department": "sales",
      "status": "approved"
    }
  }
  
- *Response:*
  json
  {
    "report_id": "123",
    "data": [
      // Report data
    ]
  }
  
- *Error Responses:*
  - 400: Invalid input data
  - 401: Authentication required
  - 500: Failed to generate report

#### Download PDF Report
- *URL:* /pdf-reports/download/:reportId  
- *Method:* GET  
- *Description:* Downloads a PDF report  
- *Authentication:* Required  
- *Parameters:*
  - reportId: Report ID  
- *Response:* PDF file  
- *Error Responses:*
  - 401: Authentication required
  - 404: Report not found
  - 500: Failed to generate PDF

---

## 9. Company Management Endpoints

### Companies

#### Get Companies
- *URL:* /api/companies  
- *Method:* GET  
- *Description:* Retrieves all companies (super admin only)  
- *Authentication:* Required (Super Admin)  
- *Response:*
  json
  [
    {
      "id": "123",
      "name": "Acme Inc",
      "status": "active",
      "created_at": "2023-01-01T12:00:00Z",
      "user_limit": 50
    }
  ]
  
- *Error Responses:*
  - 401: Authentication required
  - 403: Access denied. Super admin only.
  - 500: Failed to fetch companies

#### Create Company
- *URL:* /api/companies/create  
- *Method:* POST  
- *Description:* Creates a new company (super admin only)  
- *Authentication:* Required (Super Admin)  
- *Request Body:*
  json
  {
    "name": "Acme Inc",
    "user_limit": 50
  }
  
- *Response:*
  json
  {
    "id": "123",
    "name": "Acme Inc",
    "status": "active",
    "created_at": "2023-01-01T12:00:00Z",
    "user_limit": 50
  }
  
- *Error Responses:*
  - 400: Invalid input data
  - 401: Authentication required
  - 403: Access denied. Super admin only.
  - 500: Failed to create company

---

## 10. Error Handling

### Common Error Responses

#### Authentication Errors
- *401 Unauthorized:*
  json
  {
    "error": "Authentication required",
    "details": "No valid authorization header found"
  }
  

- *403 Forbidden:*
  json
  {
    "error": "Access denied",
    "details": "Insufficient permissions"
  }
  

#### Validation Errors
- *400 Bad Request:*
  json
  {
    "error": "Invalid input data",
    "details": "Field 'email' is required"
  }
  

#### Resource Errors
- *404 Not Found:*
  json
  {
    "error": "Resource not found",
    "details": "The requested resource does not exist"
  }
  

#### Server Errors
- *500 Internal Server Error:*
  json
  {
    "error": "Internal server error",
    "details": "An unexpected error occurred"
  }
  

---

## 11. Test Endpoints

### Test API
- *URL:* /api/test  
- *Method:* GET  
- *Description:* Tests if the API is working  
- *Response:*
  json
  {
    "message": "API is working"
  }
  

### Welcome
- *URL:* /  
- *Method:* GET  
- *Description:* Welcome message  
- *Response:*  
  "Welcome to Parrot Analyzer API"

---

## 12. Middleware and Global Configurations

### Middleware
- *CORS:* Enabled for all origins  
- *JSON Body Parser:* Limit set to 10MB  
- *URL Encoded Parser:* Limit set to 10MB, extended mode enabled  
- *Request Logging:* All requests are logged with timestamp, method, and URL  
- *Error Handling:* Comprehensive error handling middleware

### Authentication Middleware
- *verifyToken:* Verifies JWT token and attaches user to request  
- *requireSuperAdmin:* Ensures user has super-admin role  
- *adminMiddleware:* Ensures user has group-admin role  
- *managementMiddleware:* Ensures user has management role

---

## 13. Additional Endpoints

### Schedule Management

#### Get Employee Schedules
- *URL:* /api/schedule  
- *Method:* GET  
- *Description:* Retrieves all schedules for the authenticated employee  
- *Authentication:* Required  
- *Response:*
  json
  [
    {
      "id": "123",
      "title": "Team Meeting",
      "description": "Weekly team sync",
      "date": "2023-01-15",
      "time": "14:30",
      "location": "Conference Room A",
      "user_id": "456",
      "created_at": "2023-01-01T12:00:00Z"
    }
  ]
  
- *Error Responses:*
  - 401: Authentication required
  - 500: Failed to fetch schedules

#### Add Schedule
- *URL:* /api/schedule  
- *Method:* POST  
- *Description:* Adds a new schedule for an employee  
- *Authentication:* Required  
- *Request Body:*
  json
  {
    "title": "Team Meeting",
    "description": "Weekly team sync",
    "date": "2023-01-15",
    "time": "14:30",
    "location": "Conference Room A"
  }
  
- *Response:*
  json
  {
    "id": "123",
    "message": "Schedule created successfully"
  }
  
- *Error Responses:*
  - 400: Title, date, and time are required
  - 401: Authentication required
  - 500: Failed to create schedule

---

### Notifications

#### Get User Notifications
- *URL:* /api/notifications  
- *Method:* GET  
- *Description:* Retrieves all notifications for the authenticated user  
- *Authentication:* Required  
- *Response:*
  json
  [
    {
      "id": "123",
      "title": "Expense Approved",
      "message": "Your expense report has been approved",
      "type": "expense_approval",
      "read": false,
      "created_at": "2023-01-01T12:00:00Z"
    }
  ]
  
- *Error Responses:*
  - 401: Authentication required
  - 500: Failed to fetch notifications

#### Mark Notification as Read
- *URL:* /api/notifications/:id/read  
- *Method:* PATCH  
- *Description:* Marks a notification as read  
- *Authentication:* Required  
- *Parameters:*
  - id: Notification ID  
- *Response:*
  json
  {
    "message": "Notification marked as read"
  }
  
- *Error Responses:*
  - 401: Authentication required
  - 404: Notification not found
  - 500: Failed to update notification

### Group Admin Notifications

#### Send Task Assignment Notification
- *URL:* /api/group-admin-notifications/notify-task-assignment  
- *Method:* POST  
- *Description:* Sends a notification to an employee about a task assignment  
- *Authentication:* Required (Group Admin)  
- *Request Body:*
  json
  {
    "employeeId": 123,
    "taskDetails": {
      "taskId": "456",
      "title": "Complete Report",
      "description": "Quarterly sales report",
      "priority": "high",
      "dueDate": "2024-03-30",
      "isReassignment": false,
      "formattedDueDate": "Mar 30, 2024"
    }
  }
- *Response:*
  json
  {
    "success": true,
    "notificationId": 789
  }
- *Error Responses:*
  - 400: Missing required parameters
  - 401: Authentication required
  - 403: Access restricted to group admins
  - 500: Failed to send notification

#### Send Leave Status Notification
- *URL:* /api/group-admin-notifications/notify-leave-status  
- *Method:* POST  
- *Description:* Sends a notification about leave request status updates  
- *Authentication:* Required (Group Admin)  
- *Request Body:*
  json
  {
    "employeeId": 123,
    "status": "approved",
    "leaveDetails": {
      "start_date": "2024-03-25",
      "end_date": "2024-03-27",
      "leave_type_name": "Annual Leave",
      "days_requested": 3
    },
    "reason": "Optional rejection reason"
  }
- *Response:*
  json
  {
    "success": true,
    "notificationId": 789
  }
- *Error Responses:*
  - 400: Missing required parameters
  - 401: Authentication required
  - 403: Access restricted to group admins
  - 500: Failed to send notification

#### Send Notification to Management
- *URL:* /api/group-admin-notifications/notify-admin  
- *Method:* POST  
- *Description:* Sends a notification to management personnel  
- *Authentication:* Required (Group Admin)  
- *Request Body:*
  json
  {
    "title": "Leave Request Escalation",
    "message": "Leave request requires your attention",
    "type": "leave-escalation"
  }
- *Response:*
  json
  {
    "success": true
  }
- *Error Responses:*
  - 400: Missing required parameters
  - 401: Authentication required
  - 403: Access restricted to group admins
  - 404: No management user found
  - 500: Failed to send notification

### Management Notifications

#### Send User Notifications
- *URL:* /api/management-notifications/send-users  
- *Method:* POST  
- *Description:* Sends notifications to specific users  
- *Authentication:* Required (Management)  
- *Request Body:*
  json
  {
    "title": "Leave Request Status",
    "message": "Your leave request has been processed",
    "userIds": [123, 456],
    "type": "leave-request-resolution",
    "priority": "high",
    "data": {
      "screen": "/(dashboard)/employee/leave-insights",
      "action": "approve",
      "leaveId": 789
    }
  }
- *Response:*
  json
  {
    "success": true
  }
- *Error Responses:*
  - 400: Missing required parameters
  - 401: Authentication required
  - 403: Access restricted to management
  - 500: Failed to send notification

#### Device Token Management

##### Register Device Token
- *URL:* /api/management-notifications/register-device  
- *Method:* POST  
- *Description:* Registers a device token for push notifications  
- *Authentication:* Required  
- *Request Body:*
  json
  {
    "token": "expo-push-token",
    "deviceType": "ios",
    "deviceName": "iPhone 12"
  }
- *Response:*
  json
  {
    "success": true,
    "device": {
      "id": 123,
      "token": "expo-push-token",
      "device_type": "ios",
      "device_name": "iPhone 12"
    }
  }
- *Error Responses:*
  - 400: Token is required
  - 401: Authentication required
  - 500: Failed to register device

##### Unregister Device Token
- *URL:* /api/management-notifications/unregister-device  
- *Method:* DELETE  
- *Description:* Removes a device token from push notifications  
- *Authentication:* Required  
- *Request Body:*
  json
  {
    "token": "expo-push-token"
  }
- *Response:*
  json
  {
    "success": true
  }
- *Error Responses:*
  - 400: Token is required
  - 401: Authentication required
  - 500: Failed to unregister device

#### Get Unread Notification Count
- *URL:* /api/management-notifications/unread-count  
- *Method:* GET  
- *Description:* Gets the count of unread notifications  
- *Authentication:* Required  
- *Response:*
  json
  {
    "count": 5
  }
- *Error Responses:*
  - 401: Authentication required
  - 500: Failed to get unread count

---

### Super Admin Management

#### Get All Users (Super Admin)
- *URL:* /api/super-admin/users  
- *Method:* GET  
- *Description:* Retrieves all users with company details (super admin only)  
- *Authentication:* Required (Super Admin)  
- *Response:*
  json
  [
    {
      "id": "123",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "employee",
      "company": "Acme Inc",
      "status": "active"
    }
  ]
- *Error Responses:*
  - 401: Authentication required
  - 403: Access denied. Super admin only.
  - 500: Failed to fetch users

#### Toggle User Status (Super Admin)
- *URL:* /api/super-admin/users/:id/toggle-status  
- *Method:* PATCH  
- *Description:* Toggles a user's status between active and disabled (super admin only)  
- *Authentication:* Required (Super Admin)  
- *Parameters:*
  - id: User ID  
- *Response:*
  json
  {
    "message": "User status updated successfully"
  }
- *Error Responses:*
  - 401: Authentication required
  - 403: Access denied. Super admin only.
  - 404: User not found
  - 500: Failed to update user status

---

### Group Admin Management

#### Get Employees (Group Admin)
- *URL:* /api/group-admin/employees  
- *Method:* GET  
- *Description:* Retrieves all employees managed by the authenticated group admin  
- *Authentication:* Required (Group Admin)  
- *Response:*
  json
  [
    {
      "id": "123",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "1234567890",
      "employee_number": "EMP001",
      "department": "Sales",
      "designation": "Sales Representative",
      "created_at": "2023-01-01T12:00:00Z",
      "can_submit_expenses_anytime": true,
      "shift_status": "active"
    }
  ]
- *Error Responses:*
  - 401: Authentication required
  - 403: Access denied. Group admin only.
  - 500: Failed to fetch employees

#### Create Employee (Group Admin)
- *URL:* /api/group-admin/employees  
- *Method:* POST  
- *Description:* Creates a new employee under the authenticated group admin  
- *Authentication:* Required (Group Admin)  
- *Request Body:*
  json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "password": "password",
    "employee_number": "EMP001",
    "department": "Sales",
    "designation": "Sales Representative",
    "can_submit_expenses_anytime": true
  }
- *Response:*
  json
  {
    "id": "123",
    "message": "Employee created successfully"
  }
- *Error Responses:*
  - 400: Invalid input data
  - 401: Authentication required
  - 403: Access denied. Group admin only.
  - 500: Failed to create employee

---

### Employee Management

#### Get Employee Details
- *URL:* /api/employee/details  
- *Method:* GET  
- *Description:* Retrieves the authenticated employee's details  
- *Authentication:* Required (Employee)  
- *Response:*
  json
  {
    "name": "John Doe",
    "employee_number": "EMP001",
    "department": "Sales",
    "designation": "Sales Representative",
    "company_name": "Acme Inc"
  }
- *Error Responses:*
  - 401: Authentication required
  - 403: Access denied. Employee only.
  - 404: Employee details not found
  - 500: Database error

---

### Group Admin Leave Management

#### Get Leave Requests (Group Admin)
- *URL:* /api/group-admin-leave/requests  
- *Method:* GET  
- *Description:* Retrieves all leave requests for employees under the authenticated group admin  
- *Authentication:* Required (Group Admin)  
- *Response:*
  json
  [
    {
      "id": "123",
      "employee_name": "John Doe",
      "employee_id": "456",
      "start_date": "2023-01-01",
      "end_date": "2023-01-05",
      "reason": "Vacation",
      "status": "pending",
      "leave_type": "annual",
      "created_at": "2022-12-25T12:00:00Z"
    }
  ]
- *Error Responses:*
  - 401: Authentication required
  - 403: Access denied. Group admin only.
  - 500: Failed to fetch leave requests

#### Approve/Reject Leave Request (Group Admin)
- *URL:* /api/group-admin-leave/requests/:id/status  
- *Method:* PATCH  
- *Description:* Updates the status of a leave request (approve/reject)  
- *Authentication:* Required (Group Admin)  
- *Parameters:*
  - id: Leave request ID  
- *Request Body:*
  json
  {
    "status": "approved", // or "rejected"
    "rejection_reason": "Optional reason for rejection"
  }
- *Response:*
  json
  {
    "message": "Leave request status updated successfully"
  }
- *Error Responses:*
  - 400: Invalid status
  - 401: Authentication required
  - 403: Access denied. Group admin only.
  - 404: Leave request not found
  - 500: Failed to update leave request status

---

### Leave Management (Balance and History)

#### Get Leave Balance
- *URL:* /api/leave-management/balance  
- *Method:* GET  
- *Description:* Retrieves the authenticated employee's leave balance  
- *Authentication:* Required  
- *Response:*
  json
  {
    "annual": 20,
    "sick": 10,
    "casual": 5,
    "used_annual": 5,
    "used_sick": 2,
    "used_casual": 1
  }
- *Error Responses:*
  - 401: Authentication required
  - 500: Failed to fetch leave balance

#### Get Leave History
- *URL:* /api/leave-management/history  
- *Method:* GET  
- *Description:* Retrieves the authenticated employee's leave history  
- *Authentication:* Required  
- *Response:*
  json
  [
    {
      "id": "123",
      "start_date": "2023-01-01",
      "end_date": "2023-01-05",
      "reason": "Vacation",
      "status": "approved",
      "leave_type": "annual",
      "created_at": "2022-12-25T12:00:00Z"
    }
  ]
- *Error Responses:*
  - 401: Authentication required
  - 500: Failed to fetch leave history

---

## 14. Updated Error Handling and Middleware

### Additional Error Responses

#### Business Logic Errors
- *409 Conflict:*
  json
  {
    "error": "Resource conflict",
    "details": "A resource with this identifier already exists"
  }
  

#### Rate Limiting Errors
- *429 Too Many Requests:*
  json
  {
    "error": "Rate limit exceeded",
    "details": "Please try again later"
  }
  

### Updated Middleware and Global Configurations

#### File Upload Middleware
- *Multer:* Used for handling multipart/form-data  
- *File Size Limit:* 5MB for images and documents  
- *Allowed File Types:* JPEG, PNG, PDF

---

This document includes all API endpoints along with their request/response formats, error responses, and middleware configurations. It is designed to help developers integrate with the Parrot Analyzer API seamlessly while ensuring clear guidelines for authentication, user operations, administrative tasks, and more.