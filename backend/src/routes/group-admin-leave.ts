import { Router, Response } from 'express';
import { pool } from '../config/database';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { CustomRequest } from '../types';

const router = Router();

// Get all leave requests for employees under a group admin
router.get('/leave-requests', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id: groupAdminId } = req.user!;

    const result = await client.query(`
      SELECT 
        lr.*,
        u.name as user_name,
        u.employee_number,
        u.department,
        lt.name as leave_type_name,
        lt.requires_documentation,
        ld.id as document_id,
        ld.file_name,
        ld.file_type,
        ld.file_data,
        ld.upload_method
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN leave_documents ld ON lr.id = ld.request_id
      WHERE u.group_admin_id = $1
      ORDER BY lr.created_at DESC
    `, [groupAdminId]);

    // Group documents by request
    const requests = result.rows.reduce((acc: any[], row) => {
      const existingRequest = acc.find(r => r.id === row.id);
      if (existingRequest) {
        if (row.document_id) {
          existingRequest.documents.push({
            id: row.document_id,
            file_name: row.file_name,
            file_type: row.file_type,
            file_data: row.file_data,
            upload_method: row.upload_method
          });
        }
        return acc;
      }

      const documents = row.document_id ? [{
        id: row.document_id,
        file_name: row.file_name,
        file_type: row.file_type,
        file_data: row.file_data,
        upload_method: row.upload_method
      }] : [];

      const {
        document_id, file_name, file_type, file_data, upload_method,
        ...requestData
      } = row;

      return [...acc, { ...requestData, documents }];
    }, []);

    res.json(requests);
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({
      error: 'Failed to fetch leave requests',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Get leave request statistics
router.get('/leave-statistics', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id: groupAdminId } = req.user!;

    const result = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE lr.status = 'pending') as pending_requests,
        COUNT(*) FILTER (WHERE lr.status = 'approved') as approved_requests,
        COUNT(*) FILTER (WHERE lr.status = 'rejected') as rejected_requests
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE u.group_admin_id = $1
      AND lr.created_at >= NOW() - INTERVAL '30 days'
    `, [groupAdminId]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching leave statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch leave statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Process leave request (approve/reject)
router.post('/leave-requests/:requestId/:action', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { requestId, action } = req.params;
    const { rejection_reason } = req.body;
    const { id: groupAdminId } = req.user!;

    // Verify the request belongs to an employee under this group admin
    const verifyResult = await client.query(`
      SELECT lr.* 
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.id = $1 AND u.group_admin_id = $2
    `, [requestId, groupAdminId]);

    if (!verifyResult.rows.length) {
      return res.status(404).json({ error: 'Leave request not found or unauthorized' });
    }

    const request = verifyResult.rows[0];
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Can only process pending requests' });
    }

    if (action === 'reject' && !rejection_reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    // Begin transaction
    await client.query('BEGIN');

    // Update request status
    await client.query(`
      UPDATE leave_requests 
      SET 
        status = $1,
        rejection_reason = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [
      action === 'approve' ? 'approved' : 
      action === 'reject' ? 'rejected' : 
      action === 'escalate' ? 'escalated' : action, 
      rejection_reason || null, 
      requestId
    ]);

    // If approved, update leave balance
    if (action === 'approve') {
      await client.query(`
        UPDATE leave_balances
        SET 
          used_days = used_days + $1,
          pending_days = pending_days - $1,
          updated_at = NOW()
        WHERE user_id = $2 AND leave_type_id = $3 AND year = EXTRACT(YEAR FROM NOW())
      `, [request.days_requested, request.user_id, request.leave_type_id]);
    }

    // If escalated, create escalation record
    if (action === 'escalate') {
      const { escalation_reason, escalated_to } = req.body;
      if (!escalation_reason) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Escalation reason is required' });
      }

      // If escalated_to is not provided, find a management user
      let targetManagerId = escalated_to;
      if (!targetManagerId) {
        const managementResult = await client.query(`
          SELECT id 
          FROM users 
          WHERE role = 'management' 
          AND company_id = (
            SELECT company_id 
            FROM users 
            WHERE id = $1
          )
          LIMIT 1
        `, [request.user_id]);

        if (!managementResult.rows.length) {
          await client.query('ROLLBACK');
          return res.status(500).json({ error: 'No management user found to escalate to' });
        }

        targetManagerId = managementResult.rows[0].id;
      }

      await client.query(`
        INSERT INTO leave_escalations (
          request_id,
          escalated_by,
          escalated_to,
          reason,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, 'pending', NOW())
      `, [requestId, groupAdminId, targetManagerId, escalation_reason]);
    }

    await client.query('COMMIT');
    res.json({ message: 'Leave request processed successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing leave request:', error);
    res.status(500).json({ error: 'Failed to process leave request' });
  } finally {
    client.release();
  }
});

// Escalate leave request to management
router.post('/leave-requests/:requestId/escalate', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const { id: groupAdminId } = req.user!;

    if (!reason) {
      return res.status(400).json({ error: 'Escalation reason is required' });
    }

    // Verify the request belongs to an employee under this group admin
    const verifyResult = await client.query(`
      SELECT lr.*, u.company_id
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.id = $1 AND u.group_admin_id = $2
      AND lr.status = 'pending'
    `, [requestId, groupAdminId]);

    if (!verifyResult.rows.length) {
      return res.status(404).json({ error: 'Leave request not found, unauthorized, or not in pending status' });
    }

    const request = verifyResult.rows[0];

    // Find a management user to escalate to
    const managementResult = await client.query(`
      SELECT id 
      FROM users 
      WHERE role = 'management' 
      AND company_id = $1 
      LIMIT 1
    `, [request.company_id]);

    if (!managementResult.rows.length) {
      return res.status(500).json({ error: 'No management user found' });
    }

    const managementUserId = managementResult.rows[0].id;

    // Begin transaction
    await client.query('BEGIN');

    // Update request status to 'escalated'
    await client.query(`
      UPDATE leave_requests 
      SET 
        status = 'escalated',
        updated_at = NOW(),
        group_admin_id = $2
      WHERE id = $1
    `, [requestId, groupAdminId]);

    // Create escalation record
    await client.query(`
      INSERT INTO leave_escalations (
        request_id,
        escalated_by,
        escalated_to,
        reason,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, 'pending', NOW())
    `, [requestId, groupAdminId, managementUserId, reason]);

    await client.query('COMMIT');
    res.json({ message: 'Leave request escalated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error escalating leave request:', error);
    res.status(500).json({ 
      error: 'Failed to escalate leave request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Get group admin's own leave requests
router.get('/my-requests', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id: userId } = req.user!;

    const result = await client.query(`
      SELECT 
        lr.*,
        lt.name as leave_type_name,
        lt.requires_documentation,
        ld.id as document_id,
        ld.file_name,
        ld.file_type,
        ld.file_data,
        ld.upload_method
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN leave_documents ld ON lr.id = ld.request_id
      WHERE lr.user_id = $1
      ORDER BY lr.created_at DESC
    `, [userId]);

    // Group documents by request
    const requests = result.rows.reduce((acc: any[], row) => {
      const existingRequest = acc.find(r => r.id === row.id);
      if (existingRequest) {
        if (row.document_id) {
          existingRequest.documents.push({
            id: row.document_id,
            file_name: row.file_name,
            file_type: row.file_type,
            file_data: row.file_data,
            upload_method: row.upload_method
          });
        }
        return acc;
      }

      const documents = row.document_id ? [{
        id: row.document_id,
        file_name: row.file_name,
        file_type: row.file_type,
        file_data: row.file_data,
        upload_method: row.upload_method
      }] : [];

      const {
        document_id, file_name, file_type, file_data, upload_method,
        ...requestData
      } = row;

      return [...acc, { ...requestData, documents }];
    }, []);

    res.json(requests);
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({
      error: 'Failed to fetch leave requests',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Get group admin's leave balances
router.get('/my-balances', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id: userId } = req.user!;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const result = await client.query(`
      SELECT 
        lb.*,
        lt.name as leave_type_name,
        lt.is_paid
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.user_id = $1 AND lb.year = $2
      ORDER BY lt.name
    `, [userId, year]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leave balances:', error);
    res.status(500).json({
      error: 'Failed to fetch leave balances',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Get active leave types
router.get('/leave-types', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        lt.id,
        lt.name,
        lt.description,
        lt.requires_documentation,
        lt.max_days,
        lt.is_paid,
        lt.is_active
      FROM leave_types lt
      WHERE lt.is_active = true
      ORDER BY lt.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leave types:', error);
    res.status(500).json({
      error: 'Failed to fetch leave types',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Get active leave policies
router.get('/leave-policies', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT lp.*, lt.name as leave_type_name
      FROM leave_policies lp
      JOIN leave_types lt ON lp.leave_type_id = lt.id
      WHERE lt.is_active = true
      ORDER BY lt.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leave policies:', error);
    res.status(500).json({ error: 'Failed to fetch leave policies' });
  } finally {
    client.release();
  }
});

// Get employee leave balances
router.get('/employee-leave-balances', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        lb.*,
        u.name as user_name,
        u.employee_number,
        u.department,
        lt.name as leave_type_name
      FROM leave_balances lb
      JOIN users u ON lb.user_id = u.id
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE u.group_admin_id = $1
      ORDER BY u.name, lt.name
    `, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employee leave balances:', error);
    res.status(500).json({ error: 'Failed to fetch employee leave balances' });
  } finally {
    client.release();
  }
});

// Submit a new leave request
router.post('/request', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id: userId } = req.user!;
    const {
      leave_type_id,
      start_date,
      end_date,
      reason,
      contact_number,
      documents = []
    } = req.body;

    // Validate required fields
    if (!leave_type_id || !start_date || !end_date || !reason || !contact_number) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate dates
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      return res.status(400).json({ error: 'Start date cannot be in the past' });
    }

    if (endDate < startDate) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // Calculate days requested (excluding weekends)
    const days_requested = calculateWorkingDays(startDate, endDate);

    // Begin transaction
    await client.query('BEGIN');

    // Get leave type details and user gender
    const [leaveTypeResult, userResult] = await Promise.all([
      client.query(
        `SELECT lt.*, lp.* 
         FROM leave_types lt
         JOIN leave_policies lp ON lt.id = lp.leave_type_id
         WHERE lt.id = $1`,
        [leave_type_id]
      ),
      client.query('SELECT gender FROM users WHERE id = $1', [userId])
    ]);

    if (!leaveTypeResult.rows.length) {
      return res.status(400).json({ error: 'Invalid leave type' });
    }

    const leaveType = leaveTypeResult.rows[0];
    const userGender = userResult.rows[0]?.gender;

    // Check gender-specific leave eligibility
    if (leaveType.gender_specific) {
      if (!userGender) {
        return res.status(400).json({
          error: 'Missing Information',
          details: 'User gender information is required for this type of leave'
        });
      }

      if (userGender !== leaveType.gender_specific) {
        return res.status(400).json({
          error: 'Not Eligible',
          details: `This leave type is only available for ${leaveType.gender_specific} employees`
        });
      }
    }

    // Check if documents are required
    if (leaveType.requires_documentation && (!documents || !documents.length)) {
      return res.status(400).json({ error: 'Documentation is required for this leave type' });
    }

    // Check if user has enough leave balance
    const balanceResult = await client.query(`
      SELECT * FROM leave_balances 
      WHERE user_id = $1 
      AND leave_type_id = $2 
      AND year = EXTRACT(YEAR FROM NOW())
    `, [userId, leave_type_id]);

    if (!balanceResult.rows.length) {
      return res.status(400).json({ error: 'No leave balance found for this leave type' });
    }

    const balance = balanceResult.rows[0];
    if (balance.remaining_days < days_requested) {
      return res.status(400).json({ error: 'Insufficient leave balance' });
    }

    // Check for overlapping leave requests
    const overlapResult = await client.query(`
      SELECT * FROM leave_requests 
      WHERE user_id = $1 
      AND status != 'rejected'
      AND (
        (start_date <= $2 AND end_date >= $2)
        OR (start_date <= $3 AND end_date >= $3)
        OR (start_date >= $2 AND end_date <= $3)
      )
    `, [userId, start_date, end_date]);

    if (overlapResult.rows.length > 0) {
      return res.status(400).json({ error: 'You have overlapping leave requests for the selected dates' });
    }

    // Insert leave request
    const requestResult = await client.query(`
      INSERT INTO leave_requests (
        user_id,
        leave_type_id,
        start_date,
        end_date,
        days_requested,
        reason,
        status,
        contact_number,
        requires_documentation
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)
      RETURNING id
    `, [
      userId,
      leave_type_id,
      start_date,
      end_date,
      days_requested,
      reason,
      contact_number,
      leaveType.requires_documentation
    ]);

    const requestId = requestResult.rows[0].id;

    // Insert documents if any
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        await client.query(`
          INSERT INTO leave_documents (
            request_id,
            file_name,
            file_type,
            file_data,
            upload_method
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          requestId,
          doc.file_name,
          doc.file_type,
          doc.file_data,
          doc.upload_method
        ]);
      }
    }

    // Update leave balance
    await client.query(`      
      UPDATE leave_balances
      SET 
        pending_days = pending_days + $1,
        updated_at = NOW()
      WHERE user_id = $2 AND leave_type_id = $3 AND year = EXTRACT(YEAR FROM NOW())
    `, [days_requested, userId, leave_type_id]);

    await client.query('COMMIT');

    res.json({
      message: 'Leave request submitted successfully',
      request_id: requestId
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting leave request:', error);
    res.status(500).json({
      error: 'Failed to submit leave request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Helper function to calculate working days between two dates
function calculateWorkingDays(startDate: Date, endDate: Date): number {
  let days = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
      days++;
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

// Get document data
router.get('/document/:id', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { id: groupAdminId } = req.user!;

    // Verify the document belongs to a leave request from an employee under this group admin
    const result = await client.query(`
      SELECT ld.file_data, ld.file_type
      FROM leave_documents ld
      JOIN leave_requests lr ON ld.request_id = lr.id
      JOIN users u ON lr.user_id = u.id
      WHERE ld.id = $1 AND u.group_admin_id = $2
    `, [id, groupAdminId]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Document not found or unauthorized' });
    }

    const { file_data, file_type } = result.rows[0];

    // Send base64 data directly
    res.setHeader('Content-Type', 'text/plain');
    res.send(file_data);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({
      error: 'Failed to fetch document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Get pending requests
router.get('/pending-requests', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await client.query(`
      SELECT 
        lr.id,
        lr.user_id,
        u.name as user_name,
        u.employee_number,
        d.name as department,
        lr.leave_type_id,
        lt.name as leave_type_name,
        lr.start_date,
        lr.end_date,
        lr.days_requested,
        lr.reason,
        lr.status,
        lr.contact_number,
        lr.requires_documentation,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', ld.id,
            'file_name', ld.file_name,
            'file_type', ld.file_type
          ))
          FROM leave_documents ld
          WHERE ld.request_id = lr.id
          ), '[]'
        ) as documents,
        CASE 
          WHEN le.id IS NOT NULL THEN json_build_object(
            'escalation_id', le.id,
            'escalated_by', le.escalated_by,
            'escalated_by_name', eu.name,
            'reason', le.reason,
            'escalated_at', le.created_at,
            'status', le.status,
            'resolution_notes', le.resolution_notes
          )
          ELSE NULL
        END as escalation_details
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN departments d ON u.department_id = d.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN leave_escalations le ON lr.id = le.request_id
      LEFT JOIN users eu ON le.escalated_by = eu.id
      WHERE (
        lr.user_id = $1 -- Management's own requests
        OR (
          u.role = 'group_admin' 
          AND u.company_id = (SELECT company_id FROM users WHERE id = $1)
        ) -- Direct requests from group admins
        OR (
          lr.status = 'escalated'
          AND le.escalated_to = $1
          AND le.status = 'pending'
        ) -- Escalated requests assigned to this manager
      )
      ORDER BY lr.created_at DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  } finally {
    client.release();
  }
});

// Post request
router.post('/leave-requests/:id/:action', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id, action } = req.params;
    const { rejection_reason, resolution_notes } = req.body;

    await client.query('BEGIN');

    const requestResult = await client.query(
      'SELECT lr.*, le.id as escalation_id, le.status as escalation_status FROM leave_requests lr LEFT JOIN leave_escalations le ON lr.id = le.request_id WHERE lr.id = $1',
      [id]
    );

    if (!requestResult.rows.length) {
      throw new Error('Leave request not found');
    }

    const request = requestResult.rows[0];
    const isEscalated = request.status === 'escalated';
    const now = new Date();

    if (isEscalated) {
      if (!resolution_notes) {
        throw new Error('Resolution notes are required for escalated requests');
      }

      await client.query(
        'UPDATE leave_escalations SET status = $1, resolution_notes = $2, resolved_at = $3 WHERE request_id = $4',
        ['resolved', resolution_notes, now, id]
      );
    }

    if (action === 'approve' || action === 'reject') {
      await client.query(
        'UPDATE leave_requests SET status = $1, rejection_reason = $2, updated_at = $3 WHERE id = $4',
        [action === 'approve' ? 'approved' : 'rejected', action === 'reject' ? rejection_reason : null, now, id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Leave request processed successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing request:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  } finally {
    client.release();
  }
});

export default router;
