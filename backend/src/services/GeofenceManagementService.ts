import { pool } from '../config/database';

interface GeofenceInput {
    name: string;
    coordinates: any;
    radius: number;
    companyId: number;
    createdBy: number;
}

export class GeofenceManagementService {
    async createGeofence(input: GeofenceInput): Promise<any> {
        try {
            // Validate company exists
            const company = await pool.query(
                'SELECT id FROM companies WHERE id = $1',
                [input.companyId]
            );

            if (!company.rows.length) {
                throw new Error('Company not found');
            }

            // Create geofence
            const result = await pool.query(
                `INSERT INTO company_geofences 
                (company_id, name, coordinates, radius, created_by)
                VALUES ($1, $2, ST_GeomFromGeoJSON($3), $4, $5)
                RETURNING *`,
                [
                    input.companyId,
                    input.name,
                    JSON.stringify(input.coordinates),
                    input.radius,
                    input.createdBy
                ]
            );

            return result.rows[0];
        } catch (error) {
            console.error('Error creating geofence:', error);
            throw error;
        }
    }

    async updateGeofence(
        id: number,
        companyId: number,
        updates: Partial<GeofenceInput>
    ): Promise<any> {
        try {
            // Verify geofence belongs to company
            const geofence = await pool.query(
                'SELECT id FROM company_geofences WHERE id = $1 AND company_id = $2',
                [id, companyId]
            );

            if (!geofence.rows.length) {
                throw new Error('Geofence not found or unauthorized');
            }

            // Build update query
            const updateFields = [];
            const values: any[] = [id];
            let paramCount = 2;

            if (updates.name) {
                updateFields.push(`name = $${paramCount}`);
                values.push(updates.name);
                paramCount++;
            }

            if (updates.coordinates) {
                updateFields.push(`coordinates = ST_GeomFromGeoJSON($${paramCount})`);
                values.push(JSON.stringify(updates.coordinates));
                paramCount++;
            }

            if (updates.radius) {
                updateFields.push(`radius = $${paramCount}`);
                values.push(updates.radius);
                paramCount++;
            }

            if (updateFields.length === 0) {
                return geofence.rows[0];
            }

            const result = await pool.query(
                `UPDATE company_geofences 
                SET ${updateFields.join(', ')},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *`,
                values
            );

            return result.rows[0];
        } catch (error) {
            console.error('Error updating geofence:', error);
            throw error;
        }
    }

    async deleteGeofence(id: number, companyId: number): Promise<void> {
        try {
            const result = await pool.query(
                'DELETE FROM company_geofences WHERE id = $1 AND company_id = $2',
                [id, companyId]
            );

            if (result.rowCount === 0) {
                throw new Error('Geofence not found or unauthorized');
            }
        } catch (error) {
            console.error('Error deleting geofence:', error);
            throw error;
        }
    }

    async getCompanyGeofences(companyId: number): Promise<any[]> {
        try {
            const result = await pool.query(
                `SELECT id, name, ST_AsGeoJSON(coordinates) as coordinates, 
                radius, created_at, updated_at
                FROM company_geofences 
                WHERE company_id = $1`,
                [companyId]
            );

            return result.rows.map(row => ({
                ...row,
                coordinates: JSON.parse(row.coordinates)
            }));
        } catch (error) {
            console.error('Error fetching company geofences:', error);
            throw error;
        }
    }

    async validateLocationInGeofence(
        latitude: number,
        longitude: number,
        companyId: number
    ): Promise<boolean> {
        try {
            const result = await pool.query(
                `SELECT EXISTS (
                    SELECT 1 FROM company_geofences
                    WHERE company_id = $1
                    AND ST_DWithin(
                        ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                        coordinates::geography,
                        radius
                    )
                )`,
                [companyId, longitude, latitude]
            );

            return result.rows[0].exists;
        } catch (error) {
            console.error('Error validating location in geofence:', error);
            throw error;
        }
    }

    async validateShiftLocation(
        userId: number,
        latitude: number,
        longitude: number
    ): Promise<{ isValid: boolean; message?: string }> {
        try {
            // Get user's company and permissions
            const userResult = await pool.query(
                `SELECT u.company_id, utp.can_override_geofence 
                FROM users u
                LEFT JOIN user_tracking_permissions utp ON u.id = utp.user_id
                WHERE u.id = $1`,
                [userId]
            );

            if (!userResult.rows.length) {
                return { isValid: false, message: 'User not found' };
            }

            const { company_id, can_override_geofence } = userResult.rows[0];

            // Users with override permission can start/end shift anywhere
            if (can_override_geofence) {
                return { isValid: true };
            }

            // Check if location is within any company geofence
            const isInGeofence = await this.validateLocationInGeofence(
                latitude,
                longitude,
                company_id
            );

            return {
                isValid: isInGeofence,
                message: isInGeofence ? undefined : 'Location is outside company geofence'
            };
        } catch (error) {
            console.error('Error validating shift location:', error);
            throw error;
        }
    }
} 