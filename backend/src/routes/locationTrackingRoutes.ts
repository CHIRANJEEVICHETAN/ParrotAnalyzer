import { Router, Request, Response, NextFunction } from "express";
import locationTrackingController from "../controllers/locationTrackingController";
import { authMiddleware } from "../middleware/auth";
import { User } from "../types/user";

const router = Router();

// Custom Request interface extension
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Employee endpoints
router.post(
  "/employee-tracking/location",
  authMiddleware,
  locationTrackingController.storeLocation
);
router.post(
  "/employee-tracking/start-shift",
  authMiddleware,
  locationTrackingController.startShift
);
router.post(
  "/employee-tracking/end-shift",
  authMiddleware,
  locationTrackingController.endShift
);
router.get(
  "/employee-tracking/current-shift",
  authMiddleware,
  locationTrackingController.getCurrentShift
);
router.get(
  "/employee-tracking/shift-history",
  authMiddleware,
  locationTrackingController.getShiftHistory
);
router.get(
  "/employee-tracking/analytics",
  authMiddleware,
  locationTrackingController.getAnalytics
);

// Function to check roles for route access
const checkRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
};

// Group Admin endpoints
router.get(
  "/group-admin-tracking/active-locations",
  authMiddleware,
  checkRole(["GroupAdmin", "Admin"]),
  locationTrackingController.getActiveEmployeeLocations
);

router.get(
  "/group-admin-tracking/employee-history",
  authMiddleware,
  checkRole(["GroupAdmin", "Admin"]),
  locationTrackingController.getEmployeeLocationHistory
);

router.get(
  "/group-admin-tracking/analytics",
  authMiddleware,
  checkRole(["GroupAdmin", "Admin"]),
  locationTrackingController.getAnalytics
);

export default router;
