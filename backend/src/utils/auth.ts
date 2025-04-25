import jwt from 'jsonwebtoken';
import { pool } from '../config/database';

export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const verifySocketToken = async (token: string) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        
        const result = await pool.query(
            `SELECT id, name, email, role, company_id, group_admin_id 
             FROM users WHERE id = $1`,
            [decoded.id]
        );

        if (!result.rows.length) {
            throw new Error('User not found');
        }

        return result.rows[0];
    } catch (error) {
        throw new Error('Invalid token');
    }
}; 