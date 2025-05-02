import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDB } from "./src/config/database";
import authRoutes from "./src/routes/auth";
import expenseRoutes from "./src/routes/expenses";
import companyRoutes from "./src/routes/companies";
import scheduleRoutes from "./src/routes/schedule";
import groupAdminRoutes from "./src/routes/group-admin";
import userRoutes from "./src/routes/users";
import employeeRoutes from "./src/routes/employee";
import groupAdminsRoutes from "./src/routes/group-admins";
import tasksRoutes from "./src/routes/tasks";
import notificationsRouter from "./src/routes/notifications";
import leaveRoutes from "./src/routes/leave";
import reportsRoutes from "./src/routes/reports";
import managementRoutes from "./src/routes/management";
import { errorLogger, errorHandler } from "./src/middleware/errorHandler";
import pdfReportRoutes from "./src/routes/pdf-reports";
import superAdminRoutes from "./src/routes/super";
import chatRoutes from "./src/routes/chat";
import leaveManagementRoutes from "./src/routes/leave-management";
import groupAdminLeaveRouter from "./src/routes/group-admin-leave";
import employeeNotifications from "./src/routes/employeeNotifications";
import groupAdminNotifications from "./src/routes/groupAdminNotifications";
import managementNotifications from "./src/routes/managementNotifications";
import employeeLiveTracking from "./src/routes/employeeLiveTracking";
import groupAdminLiveTracking from "./src/routes/groupAdminLiveTracking";
import LocationSocketService from "./src/services/socketService";
import { createServer } from "http";
import { startScheduledJobs } from "./src/jobs/scheduledTasks";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO service
export const socketService = new LocationSocketService(httpServer);

console.log("Socket service initialized");

// Start scheduled jobs
startScheduledJobs();

app.use(cors());

// Increase JSON payload limit to 10MB
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  console.log("Headers:", req.headers);
  next();
});

// Routes
app.use("/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/group-admin", groupAdminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/group-admins", groupAdminsRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/notifications", notificationsRouter);
app.use("/api/leave", leaveRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/management", managementRoutes);
app.use("/pdf-reports", pdfReportRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/leave-management", leaveManagementRoutes);
app.use("/api/group-admin-leave", groupAdminLeaveRouter);
app.use("/api/employee-notifications", employeeNotifications);
app.use("/api/group-admin-notifications", groupAdminNotifications);
app.use("/api/management-notifications", managementNotifications);
app.use("/api/employee-tracking", employeeLiveTracking);
app.use("/api/group-admin-tracking", groupAdminLiveTracking);

// Test route at root level
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working" });
});

app.get("/", (req, res) => {
  res.send("Welcome to Parrot Analyzer API");
});

// Route not found handler
app.use((req, res, next) => {
  console.log("Route not found:", req.method, req.path);
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method,
  });
});

// Basic error handling
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
);

// Add error handling middleware last
app.use(errorLogger);
app.use(errorHandler);

const PORT = parseInt(process.env.PORT ?? "8080", 10);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

// Initialize database and start server
initDB()
  .then(() => {
    console.log("Available routes:");
    console.log("- /auth/*");
    console.log("- /api/expenses/*");
    console.log("- /api/companies/*");
    console.log("- /api/schedule/*");
    console.log("- /api/group-admin/*");
    console.log("- /api/users/*");
    console.log("- /api/employee/*");
    console.log("- /api/group-admins/*");
    console.log("- /api/tasks/*");
    console.log("- /api/notifications/*");
    console.log("- /api/leave/*");
    console.log("- /api/reports/*");
    console.log("- /api/management/*");
    console.log("- /pdf-reports/*");
    console.log("- /api/chat/*");
    console.log("- /api/leave-management/*");
    console.log("- /api/group-admin-leave/*");
    console.log("- /api/employee-notifications/*");
    console.log("- /api/group-admin-notifications/*");
    console.log("- /api/management-notifications/*");
    console.log("- /api/employee-tracking/*");
    console.log("- /api/group-admin-tracking/*");
  })
  .catch((error) => {
    console.error("Failed to initialize:", error);
    process.exit(1);
  });
