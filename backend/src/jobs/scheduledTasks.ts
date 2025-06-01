import { CronJob } from 'cron';
import { ErrorLoggingService } from '../services/ErrorLoggingService';
import { ShiftTrackingService } from '../services/ShiftTrackingService';

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

// Process shift timers every minute
const shiftTimerProcessor = new CronJob('*/1 * * * *', async () => {
    try {
        console.log('Processing shift timers...');
        const endedShifts = await shiftService.processPendingTimers();
        
        if (endedShifts > 0) {
            console.log(`Auto-ended ${endedShifts} shifts based on timer settings`);
        }
    } catch (error) {
        console.error('Error processing shift timers:', error);
        errorLogger.logError(error, 'ShiftTimerProcessor');
    }
});

// Send timer reminder notifications every minute (5-minute reminder before shift ends)
const shiftReminderSender = new CronJob('*/1 * * * *', async () => {
    try {
        console.log('Sending shift timer reminders...');
        const sentReminders = await shiftService.sendTimerReminders(5);
        
        if (sentReminders > 0) {
            console.log(`Sent ${sentReminders} shift ending reminders`);
        }
    } catch (error) {
        console.error('Error sending shift reminders:', error);
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