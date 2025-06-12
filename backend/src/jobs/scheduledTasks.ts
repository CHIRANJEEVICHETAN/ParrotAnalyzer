import { CronJob } from 'cron';
import { ErrorLoggingService } from '../services/ErrorLoggingService';
import { ShiftTrackingService } from '../services/ShiftTrackingService';
import { pool } from '../config/database';

const errorLogger = new ErrorLoggingService();
const shiftService = new ShiftTrackingService();

// Run cleanup at 2 AM every day
const errorLogCleanup = new CronJob('0 2 * * *', async () => {
    try {
        console.log('Starting error log cleanup job...');
        await errorLogger.cleanupOldLogs(30); // Keep logs for 30 days
        console.log('Error log cleanup completed successfully');
    } catch (error) {
        console.error('Error during log cleanup:', error);
    }
});

// Process shift timers every minute with retry and exponential backoff
const shiftTimerProcessor = new CronJob('*/1 * * * *', async () => {
    let attempt = 0;
    const maxAttempts = 3;
    const baseDelay = 1000; // 1 second initial delay
    
    const processWithRetry = async () => {
        try {
            // Set timezone to IST for consistent handling
            await pool.query("SET timezone = 'Asia/Kolkata'");
            
            const currentTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
            console.log(`[${currentTime}] Processing shift timers (attempt ${attempt + 1}/${maxAttempts})...`);
            
            // Process pending timers
            const endedShifts = await shiftService.processPendingTimers();
            
            if (endedShifts > 0) {
                console.log(`[${currentTime}] Successfully auto-ended ${endedShifts} shifts based on timer settings`);
            } else {
                console.log(`[${currentTime}] No shifts to auto-end at this time`);
            }
            
            return true; // Success
        } catch (error) {
            attempt++;
            const currentTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
            console.error(`[${currentTime}] Error processing shift timers (attempt ${attempt}/${maxAttempts}):`, error);
            
            // If we have exhausted retries, log the error but don't retry anymore
            if (attempt >= maxAttempts) {
                errorLogger.logError(error, 'ShiftTimerProcessor');
                return false;
            }
            
            // Calculate exponential backoff delay
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.log(`Retrying in ${delay}ms...`);
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
            return processWithRetry(); // Retry recursively
        }
    };
    
    await processWithRetry();
});

// Send timer reminder notifications every minute (5-minute reminder before shift ends)
const shiftReminderSender = new CronJob('*/1 * * * *', async () => {
    try {
        // Set timezone to IST for consistent handling
        await pool.query("SET timezone = 'Asia/Kolkata'");
        
        console.log(`[${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}] Sending shift timer reminders...`);
        const sentReminders = await shiftService.sendTimerReminders(5);
        
        if (sentReminders > 0) {
            console.log(`[${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}] Successfully sent ${sentReminders} shift ending reminders`);
        }
    } catch (error) {
        console.error(`[${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}] Error sending shift reminders:`, error);
        errorLogger.logError(error, 'ShiftReminderSender');
    }
});

// Export jobs to be started by the application
export const startScheduledJobs = () => {
    errorLogCleanup.start();
    shiftTimerProcessor.start();
    shiftReminderSender.start();
    console.log('Scheduled jobs started: Error Log Cleanup, Shift Timer Processor, Shift Reminder Sender');
}; 