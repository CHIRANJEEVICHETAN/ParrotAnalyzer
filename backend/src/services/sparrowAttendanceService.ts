import axios from 'axios';
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
}

/**
 * Sends attendance data to Sparrow API
 * @param employeeCodes Array of employee codes to mark attendance
 * @returns Promise with the API response
 */
export const sendAttendanceToSparrow = async (employeeCodes: string[]): Promise<SparrowResponse> => {
    try {
        const payload: SparrowAttendancePayload = {
            EmpCodes: employeeCodes
        };

        const response = await axios.post(
            `${process.env.SPARROW_ENDPOINT}/HumanResource/PunchInOut`,
            payload,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        await errorLogger.logError(
            error,
            'sparrowAttendanceService',
            undefined,
            { employeeCodes }
        );

        return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to send attendance data'
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