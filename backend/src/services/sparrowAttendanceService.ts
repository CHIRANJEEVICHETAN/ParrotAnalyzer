import axios, { AxiosError } from 'axios';
import { ErrorLoggingService } from './ErrorLoggingService';
import { pool } from '../config/database';

const errorLogger = new ErrorLoggingService();

interface SparrowAttendancePayload {
    EmpCodes: string[];
}

interface SparrowResponse {
    success: boolean;
    message?: string;
    data?: any;
    shouldRetry?: boolean;
    sparrowErrors?: string[];
    errorType?: string;
    statusCode?: number;
}

// Custom error types for Sparrow service
type SparrowErrorType = 
    | 'SPARROW_NETWORK_ERROR'
    | 'SPARROW_API_ERROR'
    | 'SPARROW_VALIDATION_ERROR'
    | 'SPARROW_ROSTER_ERROR'
    | 'SPARROW_SCHEDULE_ERROR'
    | 'SPARROW_COOLDOWN_ERROR'
    | 'SPARROW_UNKNOWN_ERROR';

const SPARROW_ERROR_TYPES: Record<string, SparrowErrorType> = {
    NETWORK: 'SPARROW_NETWORK_ERROR',
    API: 'SPARROW_API_ERROR',
    VALIDATION: 'SPARROW_VALIDATION_ERROR',
    ROSTER: 'SPARROW_ROSTER_ERROR',
    SCHEDULE: 'SPARROW_SCHEDULE_ERROR',
    COOLDOWN: 'SPARROW_COOLDOWN_ERROR',
    UNKNOWN: 'SPARROW_UNKNOWN_ERROR'
};

/**
 * Retry function with exponential backoff
 */
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Makes HTTP request to Sparrow API with retry logic
 */
const makeSparrowRequest = async (payload: SparrowAttendancePayload, attempt: number = 1): Promise<any> => {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    try {
        console.log(`[Sparrow API] Attempt ${attempt}/${maxRetries} - Posting to: ${process.env.SPARROW_ENDPOINT}/HumanResource/PunchInOut`);
        
        const response = await axios.post(
            `${process.env.SPARROW_ENDPOINT}/HumanResource/PunchInOut`,
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                },
                timeout: attempt === 1 ? 15000 : 20000, // Increase timeout for retries
                validateStatus: (status) => status < 500, // Don't throw on 4xx errors, only 5xx
            }
        );

        return response;
    } catch (error) {
        const axiosError = error as AxiosError;
        
        // Check if this is a retryable error
        const isRetryable = axiosError.code === 'ECONNABORTED' || 
                           axiosError.code === 'ENOTFOUND' ||
                           axiosError.code === 'ECONNRESET' ||
                           (axiosError.response?.status && axiosError.response.status >= 500);

        if (isRetryable && attempt < maxRetries) {
            const delayMs = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
            console.log(`[Sparrow API] Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
            await delay(delayMs);
            return makeSparrowRequest(payload, attempt + 1);
        }

        // If we've exhausted retries or it's not retryable, throw the error
        throw error;
    }
};

/**
 * Sends attendance data to Sparrow API
 * @param employeeCodes Array of employee codes to mark attendance
 * @returns Promise with the API response
 */
export const sendAttendanceToSparrow = async (employeeCodes: string[]): Promise<SparrowResponse> => {
    const startTime = Date.now();
    
    try {
        if (!employeeCodes?.length) {
            throw new Error('No employee codes provided');
        }

        const payload: SparrowAttendancePayload = {
            EmpCodes: employeeCodes,
        };

        console.log("[Sparrow API] Sending payload:", JSON.stringify(payload, null, 2));

        const response = await makeSparrowRequest(payload);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`[Sparrow API] Request completed in ${duration}ms with status: ${response.status}`);

        // Check for errors even in successful (200) responses
        // Some Sparrow errors come with status 200 but have errors in the response body
        if (response.data?.Errors && response.data.Errors.length > 0) {
            console.log("Sparrow returned errors with status 200:", response.data.Errors);
            
            const errorMessages = response.data.Errors.map((err: any) => 
                typeof err === 'string' ? err : JSON.stringify(err)
            );
            
            // Determine error type based on error messages
            let errorType = SPARROW_ERROR_TYPES.UNKNOWN;
            if (errorMessages.some((msg: string) => msg.toLowerCase().includes('try again after'))) {
                errorType = SPARROW_ERROR_TYPES.COOLDOWN;
            } else if (errorMessages.some((msg: string) => msg.toLowerCase().includes('schedule'))) {
                errorType = SPARROW_ERROR_TYPES.SCHEDULE_ERROR;
            } else if (errorMessages.some((msg: string) => msg.toLowerCase().includes('roster'))) {
                errorType = SPARROW_ERROR_TYPES.ROSTER_ERROR;
            }
            
            await errorLogger.logError(
                new Error(`Sparrow API returned errors: ${errorMessages.join(', ')}`),
                "sparrowAttendanceService",
                undefined,
                {
                    employeeCodes,
                    errorType,
                    sparrowErrors: errorMessages,
                    statusCode: 200,
                    responseData: response.data
                }
            );
            
            return {
                success: false,
                message: "Attendance could not be processed",
                sparrowErrors: errorMessages,
                errorType,
                statusCode: 200,
                data: response.data
            };
        }

        return {
            success: true,
            data: response.data,
        };
    } catch (error) {
        let errorType = SPARROW_ERROR_TYPES.UNKNOWN;
        let shouldRetry = false;
        let sparrowErrors: string[] = [];
        let statusCode = 500;
        let userMessage = "Failed to send attendance data";

        const axiosError = error as AxiosError;
        
        if (axiosError.isAxiosError) {
            statusCode = axiosError.response?.status || 500;
            
            // Handle specific error responses from Sparrow API
            if (axiosError.response?.data) {
                const errorData = axiosError.response.data as any;
                
                // Handle case where error is in the Message field (usually 400 responses)
                if (errorData.Message) {
                    userMessage = errorData.Message;
                    sparrowErrors = [errorData.Message];
                    
                    if (userMessage.toLowerCase().includes('try again after')) {
                        errorType = SPARROW_ERROR_TYPES.COOLDOWN;
                    } else if (userMessage.toLowerCase().includes('roster')) {
                        errorType = SPARROW_ERROR_TYPES.ROSTER_ERROR;
                    } else if (userMessage.toLowerCase().includes('schedule')) {
                        errorType = SPARROW_ERROR_TYPES.SCHEDULE_ERROR;
                    }
                } 
                // Handle case where errors are in the Errors array
                else if (errorData.Errors && Array.isArray(errorData.Errors) && errorData.Errors.length > 0) {
                    sparrowErrors = errorData.Errors.map((err: any) => 
                        typeof err === 'string' ? err : JSON.stringify(err)
                    );
                    userMessage = sparrowErrors.join(', ');
                    
                    if (sparrowErrors.some(msg => msg.toLowerCase().includes('try again after'))) {
                        errorType = SPARROW_ERROR_TYPES.COOLDOWN;
                    } else if (sparrowErrors.some(msg => msg.toLowerCase().includes('roster'))) {
                        errorType = SPARROW_ERROR_TYPES.ROSTER_ERROR;
                    } else if (sparrowErrors.some(msg => msg.toLowerCase().includes('schedule'))) {
                        errorType = SPARROW_ERROR_TYPES.SCHEDULE_ERROR;
                    }
                }
            }
            
            // Determine general error type and retry strategy
            if (!axiosError.response) {
                // Network error or timeout
                errorType = SPARROW_ERROR_TYPES.NETWORK;
                shouldRetry = true;
            } else if (axiosError.response.status >= 500) {
                // Server error
                errorType = SPARROW_ERROR_TYPES.API;
                shouldRetry = true;
            } else if (axiosError.response.status >= 400) {
                // Client error - these are generally not retryable
                errorType = errorType || SPARROW_ERROR_TYPES.VALIDATION;
                shouldRetry = false;
            }
        }

        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const errorDetails = {
            status: axiosError.response?.status,
            statusText: axiosError.response?.statusText,
            data: axiosError.response?.data,
            requestData: employeeCodes,
            endpoint: process.env.SPARROW_ENDPOINT,
            timestamp: new Date().toISOString(),
            duration: `${duration}ms`,
            axiosCode: axiosError.code,
            sparrowErrors
        };

        console.error(`[Sparrow API] ${errorType} after ${duration}ms:`, errorDetails);

        // Check if error is recoverable
        const isRecoverable = errorLogger.isRecoverableError(error);

        await errorLogger.logError(
            error,
            "sparrowAttendanceService",
            undefined,
            {
                ...errorDetails,
                errorType,
                isRecoverable,
                shouldRetry
            }
        );

        return {
            success: false,
            message: userMessage || axiosError.message || "Failed to send attendance data",
            shouldRetry,
            sparrowErrors,
            errorType,
            statusCode
        };
    }
};

/**
 * Helper function to get employee code from user ID
 * @param userId User ID to lookup
 * @returns Promise with the employee code
 */
export const getEmployeeCode = async (userId: number): Promise<string | null> => {
    try {
        const client = await pool.connect();

        try {
            const result = await client.query(
                'SELECT employee_number FROM users WHERE id = $1',
                [userId]
            );

            return result.rows[0]?.employee_number || null;
        } finally {
            client.release();
        }
    } catch (error) {
        await errorLogger.logError(
            error,
            'sparrowAttendanceService',
            userId,
            { action: 'getEmployeeCode' }
        );
        return null;
    }
}; 