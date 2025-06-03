import { Router } from 'express';
import { shiftTimerController } from '../controllers/shiftTimerController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Auth middleware applies to all routes in this file
router.use(authMiddleware);

// Shift timer routes - accessible to all roles (employee, group-admin, management)
router.post('/shift/timer', shiftTimerController.setTimer);
router.delete('/shift/timer', shiftTimerController.cancelTimer);
router.get('/shift/timer', shiftTimerController.getTimer);

export default router; 