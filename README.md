# ParrotAnalyzer

![React Native](https://img.shields.io/badge/react_native-%23282C34.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Expo](https://img.shields.io/badge/expo-%23000020.svg?style=for-the-badge&logo=expo&logoColor=#D04A37)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![Microsoft Azure](https://img.shields.io/badge/azure-%230072C6.svg?style=for-the-badge&logo=microsoftazure&logoColor=white)
![Google Gemini](https://img.shields.io/badge/google%20gemini-8E75B2?style=for-the-badge&logo=google%20gemini&logoColor=white)
![Firebase](https://img.shields.io/badge/firebase-a08021?style=for-the-badge&logo=firebase&logoColor=ffcd34)
![Azure](https://img.shields.io/badge/azure-%230072C6.svg?style=for-the-badge&logo=microsoftazure&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=JSON%20web%20tokens)

A mobile application for real-time employee tracking, attendance, leave, and expense management with live chatbot support.

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Core Features](#core-features)
  - [1. Real-Time Employee Tracking](#1-real-time-employee-tracking)
  - [2. Attendance Management](#2-attendance-management)
  - [3. Leave Management System](#3-leave-management-system)
    - [For Employees](#for-employees)
    - [For Group Admins](#for-group-admins)
    - [For Management Personnel](#for-management-personnel)
  - [4. Expense Management System](#4-expense-management-system)
  - [5. Role-Based Access Control (RBAC)](#5-role-based-access-control-rbac)
  - [6. Live Chatbot Support (Gemini AI)](#6-live-chatbot-support-gemini-ai)
  - [7. Push Notifications & Alerts](#7-push-notifications--alerts)
  - [8. Analytics & Reporting](#8-analytics--reporting)
- [Role-Based Access and Responsibilities](#role-based-access-and-responsibilities-in-parrot-analyzer)
  - [1. Employee](#1-employee)
  - [2. Group Admin](#2-group-admin)
  - [3. Management Personnel](#3-management-personnel)
  - [4. Super Admin](#4-super-admin)
- [Tech Stack](#tech-stack)
  - [Frontend](#frontend)
  - [Backend](#backend)
  - [External APIs & Services](#external-apis--services)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
  - [Frontend](#frontend-1)
  - [Backend](#backend-1)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [License](#license)

## 🌟 Overview

ParrotAnalyzer is a multi-tenant mobile platform designed to streamline workforce management for organizations. It enables real-time tracking of employees through GPS, automated attendance logging, detailed travel analytics (with indoor movements excluded via geofencing), comprehensive expense management, and a robust leave management system with multi-level approval workflows. The platform provides role-specific dashboards for Employees, Group Admins, Management Personnel, and Super Admins. Additionally, Gemini AI is integrated as a live chatbot support tool to assist employees with real-time queries, ensuring a responsive and user-friendly experience across both Android and iOS devices.

## 🎯 Key Features

- **Real-Time Tracking:** Capture and update employee locations via GPS and display live data on Google Maps
- **Attendance Management:** Automate shift logging with start/end tracking and accurate work hour computation
- **Expense Reporting:** Facilitate expense submission and processing through an intuitive interface
- **Leave Management:** Allow employees to apply for leave and track leave balances
- **Live Chatbot Support:** Real-time support using Gemini AI for live chat assistance
- **Enhanced User Experience:** Responsive and intuitive UI with real-time notifications
- **Role-Based Access:** Specific dashboards for different user roles

## 🔧 Core Features

### 1. Real-Time Employee Tracking
- **GPS-Based Live Tracking:**  
  - Continuously captures and updates employee locations via device GPS.
  - Uses Socket.io to transmit live data to the backend and display on an interactive Google Maps interface.
- **Geofencing Implementation:**  
  - Establishes geofence boundaries around office premises to filter out indoor movements.
  - Ensures only outdoor travel is computed, thereby enhancing accuracy in tracking travel distance and time.
- **Travel Metrics Calculation:**  
  - Calculates total kilometers traveled and total travel time based on outdoor movement.
  - Applies filtering algorithms to ignore insignificant movements caused by GPS drift.
- **Group Admin Monitoring:**  
  - Group Admins can view live tracking data for employees in their assigned group via a dynamic map with markers indicating employee locations and status.

### 2. Attendance Management
- **Shift Logging & Tracking:**  
  - Employees can initiate and end shifts directly within the app.
  - The system automatically records timestamps along with GPS location data to verify attendance.
- **Work Hours Calculation:**  
  - Accurately computes total work hours per shift by processing start and end timestamps.
  - Provides detailed reports for payroll processing and productivity analysis.
- **Dashboard Insights:**  
  - Group Admins and Management Personnel can access real-time and historical attendance records.
  - Offers visual summaries and trends that help identify attendance patterns and anomalies.

### 3. Leave Management System
#### For Employees:
- **Leave Application:**  
  - Employees can apply for leave by selecting a leave type, choosing start and end dates, and providing a reason.
  - Optionally, employees may upload supporting documents (e.g., medical certificates).
  - Displays current leave balance to prevent over-application.
- **Leave Status & History:**  
  - Users can track the status of their leave requests (Pending, Approved, Rejected, or Escalated).
  - A detailed history of leave applications is available, with filtering options by date range and leave type.
- **Leave Policies View:**  
  - A dedicated section shows all active leave types, each with an expandable dropdown that details:
    - Default leave entitlement (days per year)
    - Carry forward rules (if applicable)
    - Eligibility criteria (e.g., minimum service period)
    - Maximum consecutive leave allowed
    - Any special conditions (e.g., required supporting documents)

#### For Group Admins:
- **Leave Request Dashboard:**  
  - Lists all leave requests submitted by employees within their group.
  - Provides filtering and sorting options (by employee name, leave type, submission date).
- **Approval & Rejection Workflow:**  
  - Allows direct approval or rejection of leave requests with options to add feedback or comments.
  - Offers an escalation feature to forward complex or exceptional cases to Management Personnel.
- **Record Keeping & Reporting:**  
  - Automatically logs decisions and updates leave records in the database for audit and analysis.
  - Displays summary metrics (e.g., total pending requests, approvals, rejections) for quick oversight.

#### For Management Personnel:
- **Leave Policy Configuration:**  
  - Enables creation and modification of leave types and their associated policies.
  - Allows setting of entitlements, carry-forward rules, eligibility, and other policy criteria.
- **Analytics & Reporting:**  
  - Provides high-level insights into leave trends and overall employee leave utilization.
  - Generates exportable reports for compliance tracking and strategic decision-making.

### 4. Expense Management System
- **Expense Submission:**  
  - Employees can submit travel-related expenses by selecting a category, entering amounts, and uploading receipts.
- **Expense Approval Workflow:**  
  - Group Admins review submitted expense reports and either approve or reject them.
  - Decision logs are maintained for audit purposes.
- **Expense History & Insights:**  
  - Employees can view a detailed history of their expense submissions.
  - Group Admins can analyze expense trends within their group to track overall spending.

### 5. Role-Based Access Control (RBAC)
- **Employee Access:**  
  - Access to personal attendance, leave, and expense submission functionalities.
- **Group Admin Access:**  
  - Tools to monitor and manage leave and expense requests, live tracking, and attendance of employees within their group.
- **Management Personnel Access:**  
  - Capabilities to configure leave policies, analyze system-wide leave trends, and manage escalated cases.
- **Super Admin Access:**  
  - Comprehensive control over user accounts, system settings, and backend data management.

### 6. Live Chatbot Support (Gemini AI)
- **Real-Time Employee Assistance:**  
  - Gemini AI is integrated as a live chatbot to provide instant support.
  - The chatbot can answer queries related to leave balances, attendance records, expense submission, and system navigation.
- **Automated Guidance:**  
  - Offers interactive help through an intelligent FAQ system, reducing the need for direct HR intervention.

### 7. Push Notifications & Alerts
- **Real-Time Alerts:**  
  - The system is designed to send notifications for key events such as leave request updates, expense approvals, and shift reminders (to be implemented as a separate enhancement).
- **User Engagement:**  
  - Notifications ensure that employees and administrators receive timely updates, improving communication and responsiveness.

### 8. Analytics & Reporting
- **Dynamic Dashboards:**  
  - Interactive dashboards display real-time metrics for attendance, leave, expense, and tracking data.
- **Customizable Reports:**  
  - Users can generate and export reports in formats like PDF or Excel.
- **Trend Analysis:**  
  - Aggregated data helps identify patterns in employee behavior, leave utilization, and expense trends, supporting informed decision-making.

## 👥 Role-Based Access and Responsibilities in Parrot Analyzer

Parrot Analyzer is built with a robust role-based access control system. Each role—Employee, Group Admin, Management Personnel, and Super Admin—has a specific set of responsibilities and features that allow for streamlined workforce management. Below is a detailed breakdown of each role along with the key functionalities they control.

### 1. Employee

#### **Responsibilities & Features**
- **Schedule & Self-Tracking:**
  - View and add personal schedules using an editable calendar.
  - Maintain a proper schedule plan with date-specific entries.

- **Expense Management:**
  - Submit expense reports including details such as:
    - **Company Name, Form Code, and Employee Details:** (Name, Employee Number, Department, Designation, Location, Date)
    - **Travel Details:** (Vehicle Type, Vehicle Number, Total Distance, Start & End Date/Time, Total Travel Time, Average Speed, Route Details)
    - **Expense Details:** (Lodging Expenses, Daily Allowance/Food, Diesel, Toll Charges, Other Expenses)
    - **Financial Summary:** (Total Expenses, Advance Taken, Amount Payable)
  - Upload supporting documents via camera or file uploads.
  - View a dedicated "My Expenses" section with filtering and overviews (Total Claimed, Total Approved).

- **Leave Insights:**
  - Access a section to view leave policies (active leave types with dropdown details) and submit leave requests.
  - Monitor leave balance and leave history.

- **Task Management:**
  - View "My Tasks" on the home screen dashboard with status updates ("In Progress, Pending, Completed").
  - Use a task progress bar to track completion.

- **Profile & Personal Dashboard:**
  - Access a profile section showing profile photo, personal details (Name, Email, Phone, Role), reporting hierarchy (Reports to: Group Admin), and statistics (Total Hours Worked, Expenses, Attendance, Tasks).
  - View a monthly progress bar covering working hours, expense claims, attendance rate, and completed tasks.
  - See Recent Activities and have options to edit profile, change password, toggle theme, and access support (Help Center, Contact Support, Terms & Privacy).
  - Contact Support includes a live chat option powered by Google Gemini AI (24-hour support) and a form to submit Subject and Message (sent via email using nodemailer).

### 2. Group Admin

#### **Responsibilities & Features**
- **Employee Management:**
  - Add individual employees or import bulk employee data via CSV.
  - Search, view, and delete employee records.
  - Access detailed employee profiles.

- **Expense Management:**
  - View an overview showing Total Expenses, Average Expenses, Pending, and Approved amounts.
  - Access a dedicated page to review employee expense requests and approve or reject them.

- **Task Management:**
  - Create and assign tasks to employees with a form capturing:
    - Task Title, Description, Employee assignment, Priority, and Due Date.
  - View and filter task statuses (e.g., In Progress, Pending, Completed) for tasks assigned to employees.
  - Monitor a task progress bar indicating completion status.

- **Attendance Management:**
  - View an overview with metrics such as Total Employees, Total Shifts, Average Hours per Day, and Total Expenses.
  - Use a calendar to track attendance by specific dates.
  - Filter attendance records by employee or view all employees.

- **Live Tracking & Shift Tracking:**
  - Access live tracking features to monitor real-time employee locations.
  - Oversee shift tracking and attendance management for employees.

- **Reports & Analytics:**
  - Generate detailed reports (Expense, Attendance, Task, Travel, Performance, and Leave Reports).
  - Use filters and export reports in PDF format.
  - Visualize data using line, bar, and pie charts.

- **Leave Management:**
  - Manage a leave section that displays Leave Types, Leave Policies, and Leave Balances.
  - Approve or reject leave requests from employees.
  - Access a "Leave Insights" section to track and submit leave requests for Group Admins (which are approved or rejected by Management Personnel) and view leave balances.

- **Profile & Personal Dashboard:**
  - View personal profile details including management settings and a dark mode switch.
  - Access a "Recent Activities" dashboard for updates.

### 3. Management Personnel

#### **Responsibilities & Features**
- **Dashboard & Quick Actions:**
  - View an overview dashboard showing Total Teams and Total Users Allowed for their organization (as set by Super Admin).
  - Quick actions include a Shift Tracker for attendance and a Leave Insights section for applying for leave and tracking leave balances.

- **Group Analytics:**
  - Access detailed analytics on Team Performance, Attendance Rate, Travel Efficiency, and Expense Overview.
  - Generate and review aggregated reports with key performance metrics (displayed as percentages, charts, etc.).

- **Leave Management:**
  - Configure leave policies by setting up various leave types (e.g., EL, SL, ML, CL, etc.), including eligibility criteria, entitlements, and carry-forward rules.
  - Monitor leave requests across the organization, reviewing pending, approved, and active leaves.
  - Approve or reject leave requests escalated by Group Admins and handle your own leave requests.
  - Maintain a comprehensive leave balance tracker for all users.

- **Group Admin Management:**
  - View and manage all Group Admins and the employees under them.
  - Create new Group Admin accounts individually or in bulk (via CSV import).

- **Analytics & Reporting:**
  - Access an Analytics page to track overall Team Performance, Attendance Overview, and other key metrics.
  - Generate exportable reports for compliance and performance monitoring.

- **Personal & System Settings:**
  - Manage personal information (profile, password, theme switch).
  - Access a support section for help and inquiries.

### 4. Super Admin

#### **Responsibilities & Features**
- **Company & User Management:**
  - Add or manage companies with options to revoke access, set user limits, and mark companies as active or inactive.
  - Specify detailed Company Information and assign Management Personnel during company setup.
  - Oversee all user accounts across companies, including creation, deletion, and role assignment.

- **Subscription & Access Control:**
  - Manage overall user limits and control system-wide configurations.
  - Oversee subscription plans and financial records (not implemented yet).

- **System Administration & Security:**
  - Implement role-based access control across the platform.
  - Configure global system settings including geofencing parameters, shift timings, and notification rules (not implemented yet).

- **Reporting & Analytics:**
  - Access comprehensive dashboards displaying key metrics for all companies.
  - Generate detailed reports on attendance, leave, expenses, and overall system performance (not implemented yet).

- **Personal Profile Management:**
  - Change personal details and password.
  - Access an administrative profile dashboard.

## 💻 Tech Stack

### Frontend
- React Native with Expo
- NativeWind (TailwindCSS) for styling
- TypeScript
- Socket.io Client for real-time communication

### Backend
- Node.js with Express.js
- TypeScript
- Socket.io for real-time updates
- PostgreSQL Database
- JWT for authentication

### External APIs & Services
- Google Maps API for location visualization
- Firebase Cloud Messaging for push notifications
- Gemini AI for chatbot support
- Azure for deployment

## 📝 Prerequisites

- Node.js (Latest LTS version)
- npm or yarn package manager
- Expo CLI
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)
- PostgreSQL

## 🛠️ Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd ParrotAnalyzer
   ```

2. Install dependencies for the frontend:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Install dependencies for the backend:
   ```bash
   cd backend
   npm install
   # or
   yarn install
   ```

4. Configure environment variables:

   Frontend (.env):
   ```env
   EXPO_PROJECT_ID=your_expo_project_id
   EXPO_PUBLIC_API_URL=your_api_url
   ```

   Backend (.env):
   ```env
   DATABASE_URL=your_postgresql_url
   JWT_SECRET=your_jwt_secret
   PORT=3000
   EMAIL_USER=your_email
   EMAIL_PASS=your_email_password
   GOOGLE_GEMINI_API_KEY=your_gemini_api_key
   ```

## 🏃‍♂️ Running the Application

### Frontend

1. Start the Expo development server:
   ```bash
    npx expo start
   ```

2. Choose your platform:
   - Press 'a' for Android
   - Press 'i' for iOS
   - Press 'w' for web

### Backend

1. Start the backend server:
```bash
   cd backend
   npm run dev
   # or
   yarn dev
   ```

## 📂 Project Structure

```
ParrotAnalyzer
├──app
│   ├──(auth)
│   │   ├──_layout.tsx
│   │   │   ├──forgot-password.tsx
│   │   │   └──signin.tsx
│   │   ├──(dashboard)
│   │   │   ├──employee
│   │   │   │   ├──components
│   │   │   │   │   ├──AddEventModal.tsx
│   │   │   │   │   ├──AddScheduleModal.tsx
│   │   │   │   │   ├──EditScheduleModal.tsx
│   │   │   │   │   └──TaskList.tsx
│   │   │   │   ├──leave-insights
│   │   │   │   │   ├──components
│   │   │   │   │   │   ├──LeaveApprovals.tsx
│   │   │   │   │   │   ├──LeaveBalances.tsx
│   │   │   │   │   │   ├──LeavePolicies.tsx
│   │   │   │   │   │   ├──LeaveRequests.tsx
│   │   │   │   │   │   └──RequestLeaveModal.tsx
│   │   │   │   │   └──index.tsx
│   │   │   │   ├──settings
│   │   │   │   │   ├──LiveChat
│   │   │   │   │   │   ├──components
│   │   │   │   │   │   │   └──ChatMessage.tsx
│   │   │   │   │   │   └──index.tsx
│   │   │   │   │   ├──changePassword.tsx
│   │   │   │   │   ├──editProfile.tsx
│   │   │   │   │   ├──help.tsx
│   │   │   │   │   ├──support.tsx
│   │   │   │   │   └──terms.tsx
│   │   │   │   ├──utils
│   │   │   │   │   └──navigationItems.ts
│   │   │   │   ├──attendanceManagement.tsx
│   │   │   │   ├──employee.tsx
│   │   │   │   ├──employeeExpenses.tsx
│   │   │   │   ├──employeeSchedule.tsx
│   │   │   │   ├──employeeSettings.tsx
│   │   │   │   ├──employeeShiftTracker.tsx
│   │   │   │   ├──myExpenses.tsx
│   │   │   │   ├──notifications.tsx
│   │   │   │   ├──profile.tsx
│   │   │   │   └──types.ts
│   │   │   ├──Group-Admin
│   │   │   │   ├──attendance-management
│   │   │   │   │   └──index.tsx
│   │   │   │   ├──components
│   │   │   │   │   ├──ChangePasswordForm.tsx
│   │   │   │   │   ├──DocumentViewer.tsx
│   │   │   │   │   ├──RejectModal.tsx
│   │   │   │   │   └──TaskCard.tsx
│   │   │   │   ├──employee-management
│   │   │   │   │   ├──bulk.tsx
│   │   │   │   │   ├──index.tsx
│   │   │   │   │   └──individual.tsx
│   │   │   │   ├──expense-management
│   │   │   │   │   ├──[id].tsx
│   │   │   │   │   └──index.tsx
│   │   │   │   ├──leave-insights
│   │   │   │   │   ├──components
│   │   │   │   │   │   ├──LeaveBalance.tsx
│   │   │   │   │   │   └──LeaveRequests.tsx
│   │   │   │   │   └──index.tsx
│   │   │   │   ├──leave-management
│   │   │   │   │   ├──components
│   │   │   │   │   │   ├──LeaveApprovals.tsx
│   │   │   │   │   │   ├──LeaveBalances.tsx
│   │   │   │   │   │   ├──LeavePolicies.tsx
│   │   │   │   │   │   ├──LeaveRequests.tsx
│   │   │   │   │   │   └──LeaveTypes.tsx
│   │   │   │   │   └──index.tsx
│   │   │   │   ├──reports
│   │   │   │   │   ├──components
│   │   │   │   │   │   ├──pdf-templates
│   │   │   │   │   │   │   ├──AttendanceTemplate.tsx
│   │   │   │   │   │   │   ├──BaseTemplate.tsx
│   │   │   │   │   │   │   ├──ExpenseTemplate.tsx
│   │   │   │   │   │   │   ├──LeaveTemplate.tsx
│   │   │   │   │   │   │   ├──PerformanceTemplate.tsx
│   │   │   │   │   │   │   ├──TaskTemplate.tsx
│   │   │   │   │   │   │   └──TravelTemplate.tsx
│   │   │   │   │   │   ├──AttendanceReports.tsx
│   │   │   │   │   │   ├──ExpenseReports.tsx
│   │   │   │   │   │   ├──GraphSelector.tsx
│   │   │   │   │   │   ├──LeaveReports.tsx
│   │   │   │   │   │   ├──PerformanceReports.tsx
│   │   │   │   │   │   ├──ReportCard.tsx
│   │   │   │   │   │   ├──TaskReports.tsx
│   │   │   │   │   │   └──TravelReports.tsx
│   │   │   │   │   ├──services
│   │   │   │   │   │   └──PDFGenerator.ts
│   │   │   │   │   └──types.ts
│   │   │   │   ├──settings
│   │   │   │   │   ├──About.tsx
│   │   │   │   │   ├──ChangePassword.tsx
│   │   │   │   │   ├──ExpenseApprovalRules.tsx
│   │   │   │   │   ├──HelpSupport.tsx
│   │   │   │   │   ├──Notifications.tsx
│   │   │   │   │   ├──PrivacySecurity.tsx
│   │   │   │   │   ├──ProfileSettings.tsx
│   │   │   │   │   ├──TrackingSettings.tsx
│   │   │   │   │   └──UserPermissions.tsx
│   │   │   │   ├──utils
│   │   │   │   │   └──navigationItems.ts
│   │   │   │   ├──group-admin.tsx
│   │   │   │   ├──reports.tsx
│   │   │   │   ├──settings.tsx
│   │   │   │   └──task-management.tsx
│   │   │   ├──management
│   │   │   │   ├──group-admin-management
│   │   │   │   │   ├──_layout.tsx
│   │   │   │   │   ├──bulk.tsx
│   │   │   │   │   ├──index.tsx
│   │   │   │   │   └──individual.tsx
│   │   │   │   ├──leave-insights
│   │   │   │   │   ├──components
│   │   │   │   │   │   ├──LeaveBalanceTracker.tsx
│   │   │   │   │   │   └──LeaveRequests.tsx
│   │   │   │   │   └──index.tsx
│   │   │   │   ├──leave-management
│   │   │   │   │   ├──components
│   │   │   │   │   │   ├──LeaveAnalytics.tsx
│   │   │   │   │   │   ├──LeaveApprovals.tsx
│   │   │   │   │   │   ├──LeaveBalances.tsx
│   │   │   │   │   │   ├──LeavePolicies.tsx
│   │   │   │   │   │   └──LeaveTypes.tsx
│   │   │   │   │   └──index.tsx
│   │   │   │   ├──settings
│   │   │   │   │   ├──about.tsx
│   │   │   │   │   ├──change-password.tsx
│   │   │   │   │   ├──help.tsx
│   │   │   │   │   ├──notifications.tsx
│   │   │   │   │   ├──privacy.tsx
│   │   │   │   │   ├──profile.tsx
│   │   │   │   │   ├──reports.tsx
│   │   │   │   │   └──team.tsx
│   │   │   │   ├──analytics.tsx
│   │   │   │   ├──approvals.tsx
│   │   │   │   ├──group-admins.tsx
│   │   │   │   ├──index.tsx
│   │   │   │   ├──management.tsx
│   │   │   │   ├──profile.tsx
│   │   │   │   └──settings.tsx
│   │   │   ├──super-admin
│   │   │   │   ├──company
│   │   │   │   │   └──[id].tsx
│   │   │   │   ├──settings
│   │   │   │   │   ├──change-passwordSettings.tsx
│   │   │   │   │   ├──subscriptionsSettings.tsx
│   │   │   │   │   └──usersSettings.tsx
│   │   │   │   ├──add-company.tsx
│   │   │   │   ├──company_management.tsx
│   │   │   │   ├──create-user.tsx
│   │   │   │   ├──index.tsx
│   │   │   │   ├──reports.tsx
│   │   │   │   ├──security.tsx
│   │   │   │   ├──settings.tsx
│   │   │   │   ├──super-admin.tsx
│   │   │   │   └──system-config.tsx
│   │   │   └──_layout.tsx
│   │   ├──components
│   │   │   ├──BottomNav.tsx
│   │   │   └──ThemeToggle.tsx
│   │   ├──context
│   │   │   ├──AuthContext.tsx
│   │   │   └──ThemeContext.tsx
│   │   ├──types
│   │   │   ├──common.ts
│   │   │   ├──index.ts
│   │   │   ├──nav.ts
│   │   │   └──react-native-modal.d.ts
│   │   ├──utils
│   │   │   ├──requireAuth.tsx
│   │   │   └──storage.ts
│   │   ├──_layout.tsx
│   │   ├──index.tsx
│   │   └──welcome.tsx
│   ├──assets
│   │   ├──fonts
│   │   │   └──SpaceMono-Regular.ttf
│   │   └──images
│   │   │   ├──favicon.png
│   │   │   ├──icon.png
│   │   │   ├──ParrotAnalyzerSplash.png
│   │   │   └──SplashScreen.png
│   ├──backend
│   │   ├──src
│   │   │   ├──config
│   │   │   │   └──database.ts
│   │   │   ├──middleware
│   │   │   │   ├──auth.ts
│   │   │   │   └──errorHandler.ts
│   │   │   ├──routes
│   │   │   │   ├──auth.ts
│   │   │   │   ├──chat.ts
│   │   │   │   ├──companies.ts
│   │   │   │   ├──employee.ts
│   │   │   │   ├──expenses.ts
│   │   │   │   ├──group-admin-leave.ts
│   │   │   │   ├──group-admin.ts
│   │   │   │   ├──group-admins.ts
│   │   │   │   ├──index.ts
│   │   │   │   ├──leave-management.ts
│   │   │   │   ├──leave.ts
│   │   │   │   ├──management.ts
│   │   │   │   ├──notifications.ts
│   │   │   │   ├──pdf-reports.ts
│   │   │   │   ├──reports.ts
│   │   │   │   ├──schedule.ts
│   │   │   │   ├──super.ts
│   │   │   │   ├──tasks.ts
│   │   │   │   └──users.ts
│   │   │   └──types
│   │   │   │   ├──index.ts
│   │   │   │   └──leave.ts
│   │   │   ├──Dockerfile
│   │   │   ├──package-lock.json
│   │   │   ├──package.json
│   │   │   ├──server.ts
│   │   │   ├──tsconfig.json
│   │   │   └──.env.example
│   │   ├──database
│   │   │   └──database.bak
│   │   └──.github
│   │   │   └──workflows
│   │   │   │   └──main_parrotanalyzerserver.yml
│   ├──app.json
│   ├──babel.config.js
│   ├──eas.json
│   ├──global.css
│   ├──LICENSE
│   ├──metro.config.js
│   ├──nativewind-env.d.ts
│   ├──package.json
│   ├──README.md
│   ├──tailwind.config.js
│   ├──tsconfig.json
│   ├──yarn.lock
│   └──.env.example
└──.gitignore
```

## 📚 API Documentation

For detailed API documentation, please click on [API-DOCUMENTATION](./documentation/API-DOCUMENTATION.md). The documentation covers:
- Authentication endpoints
- User management
- Expense management
- Leave management
- Task management
- Chat functionality
- Report generation
- Company management

Click the link above to view the complete API documentation with request/response formats, authentication requirements, and error handling details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
