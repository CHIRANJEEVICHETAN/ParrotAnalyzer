import { Request, Response } from 'express';
import { ShiftTrackingService } from '../services/ShiftTrackingService';

const shiftService = new ShiftTrackingService();

// Define a type for the user property
type AuthUser = {
  id: string | number;
  role: string;
  [key: string]: any;
};

export const shiftTimerController = {
    // Set an auto-end timer for the current shift (works for all roles: employee, group-admin, management)
    async setTimer(req: Request, res: Response): Promise<void> {
        try {
            // Type assertion for user
            const user = (req as any).user as AuthUser;
            const userId = Number(user.id);
            const { durationHours } = req.body;

            // Validate input
            if (!durationHours || typeof durationHours !== 'number') {
                res.status(400).json({ success: false, error: 'Duration in hours is required and must be a number' });
                return;
            }

            if (durationHours <= 0 || durationHours > 24) {
                res.status(400).json({ success: false, error: 'Duration must be between 0 and 24 hours' });
                return;
            }

            // First check if user has an active shift
            try {
                const timer = await shiftService.setShiftTimer(userId, durationHours);
                
                // Return the timer information with timezone preserved
                res.status(200).json({
                    success: true,
                    message: `Auto-end timer set successfully for ${durationHours} hours`,
                    timer: {
                        id: timer.id,
                        userId: userId,
                        durationHours: durationHours,
                        endTime: timer.end_time, // Timezone info preserved from database
                        role: user.role
                    }
                });
            } catch (error: any) {
                // Check for specific error messages
                if (error.message === 'No active shift found') {
                    res.status(400).json({ 
                        success: false, 
                        error: 'No active shift found. You must start a shift before setting an auto-end timer.' 
                    });
                    return;
                }
                
                console.error(`Error setting shift timer for user ${userId}:`, error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to set timer. Please ensure you have an active shift and try again.' 
                });
            }
        } catch (error: any) {
            console.error('Unexpected error in setTimer:', error);
            res.status(500).json({ success: false, error: 'An unexpected error occurred' });
        }
    },

    // Cancel the auto-end timer for the current shift (works for all roles)
    async cancelTimer(req: Request, res: Response): Promise<void> {
        try {
            // Type assertion for user
            const user = (req as any).user as AuthUser;
            const userId = Number(user.id);

            // Cancel the timer - ShiftTrackingService will handle the role-specific logic
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
            console.error(`Error cancelling shift timer for user ${(req as any).user?.id}:`, error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Failed to cancel shift timer' 
            });
        }
    },

    // Get the current auto-end timer for the active shift (works for all roles)
    async getTimer(req: Request, res: Response): Promise<void> {
        try {
            // Type assertion for user
            const user = (req as any).user as AuthUser;
            const userId = Number(user.id);

            // Get the timer - ShiftTrackingService will handle the role-specific logic
            const timer = await shiftService.getCurrentShiftTimer(userId);

            if (timer) {
                // Timer data with timezone info preserved
                res.status(200).json({
                    success: true,
                    timer: {
                        id: timer.id,
                        shiftId: timer.shift_id,
                        durationHours: timer.timer_duration_hours,
                        endTime: timer.end_time, // Timezone info preserved from database
                        startTime: timer.start_time, // Timezone info preserved from database
                        roleType: timer.role_type
                    }
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'No active timer found'
                });
            }
        } catch (error: any) {
            console.error(`Error getting shift timer for user ${(req as any).user?.id}:`, error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Failed to retrieve shift timer' 
            });
        }
    }
}; 