import { Request, Response } from 'express';
import { ShiftTrackingService } from '../services/ShiftTrackingService';

const shiftService = new ShiftTrackingService();

// Define a type for the user property
type AuthUser = {
  id: string | number;
  [key: string]: any;
};

export const shiftTimerController = {
    // Set an auto-end timer for the current shift
    async setTimer(req: Request, res: Response): Promise<void> {
        try {
            // Type assertion for user
            const user = (req as any).user as AuthUser;
            const userId = Number(user.id);
            const { durationHours } = req.body;

            // Validate input
            if (!durationHours || typeof durationHours !== 'number' || durationHours <= 0 || durationHours > 24) {
                res.status(400).json({ 
                    success: false, 
                    error: 'Duration must be a positive number between 0 and 24 hours' 
                });
                return;
            }

            // Set the timer
            const timer = await shiftService.setShiftTimer(userId, durationHours);

            res.status(200).json({
                success: true,
                message: 'Auto-end timer set successfully',
                timer: {
                    duration: timer.timer_duration_hours,
                    endTime: timer.end_time
                }
            });
        } catch (error: any) {
            console.error('Error setting shift timer:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Failed to set shift timer' 
            });
        }
    },

    // Cancel the auto-end timer for the current shift
    async cancelTimer(req: Request, res: Response): Promise<void> {
        try {
            // Type assertion for user
            const user = (req as any).user as AuthUser;
            const userId = Number(user.id);

            // Cancel the timer
            const cancelled = await shiftService.cancelShiftTimer(userId);

            if (cancelled) {
                res.status(200).json({
                    success: true,
                    message: 'Auto-end timer cancelled successfully'
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'No active timer found'
                });
            }
        } catch (error: any) {
            console.error('Error cancelling shift timer:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Failed to cancel shift timer' 
            });
        }
    },

    // Get the current auto-end timer for the active shift
    async getTimer(req: Request, res: Response): Promise<void> {
        try {
            // Type assertion for user
            const user = (req as any).user as AuthUser;
            const userId = Number(user.id);

            // Get the timer
            const timer = await shiftService.getCurrentShiftTimer(userId);

            if (timer) {
                res.status(200).json({
                    success: true,
                    timer: {
                        id: timer.id,
                        shiftId: timer.shift_id,
                        durationHours: timer.timer_duration_hours,
                        endTime: timer.end_time,
                        startTime: timer.start_time
                    }
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'No active timer found'
                });
            }
        } catch (error: any) {
            console.error('Error getting shift timer:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Failed to retrieve shift timer' 
            });
        }
    }
}; 