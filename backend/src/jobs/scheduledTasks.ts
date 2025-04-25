import { CronJob } from 'cron';
import { ErrorLoggingService } from '../services/ErrorLoggingService';

const errorLogger = new ErrorLoggingService();

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

// Export jobs to be started by the application
export const startScheduledJobs = () => {
    errorLogCleanup.start();
    console.log('Scheduled jobs started');
}; 