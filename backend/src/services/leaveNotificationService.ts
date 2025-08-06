import { pool } from '../config/database';
import { socketService } from '../../server';
import { NotificationService } from './notificationService';

const notificationService = new NotificationService();

interface LeaveNotificationData {
  requestId: number;
  userId: number;
  action: 'submitted' | 'approved' | 'rejected' | 'escalated';
  level?: string;
  comments?: string;
}

class LeaveNotificationService {
  private async getRequestDetails(requestId: number) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          lr.*,
          u.name as employee_name,
          u.group_admin_id,
          lt.name as leave_type_name,
          al.level_name as current_level,
          al.role as required_role
        FROM leave_requests lr
        JOIN users u ON lr.user_id = u.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN approval_levels al ON lr.current_level_id = al.id
        WHERE lr.id = $1
      `, [requestId]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  private async getApproverIds(companyId: number, role: string) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id FROM users 
        WHERE company_id = $1 AND role = $2
      `, [companyId, role]);

      return result.rows.map(row => row.id);
    } finally {
      client.release();
    }
  }

  private async createNotification(
    userId: number,
    title: string,
    message: string,
    type: string,
    data: any
  ) {
    await notificationService.sendPushNotification({
      id: 0,
      user_id: userId.toString(),
      title,
      message,
      type,
      data,
      priority: 'high'
    });
  }

  public async notifyLeaveRequestSubmitted(requestId: number) {
    const request = await this.getRequestDetails(requestId);
    if (!request) return;

    // Notify group admin
    if (request.group_admin_id) {
      await this.createNotification(
        request.group_admin_id,
        'New Leave Request',
        `${request.employee_name} has submitted a ${request.leave_type_name} request`,
        'leave_request_submitted',
        { requestId }
      );

      await socketService.emitToUser(request.group_admin_id, 'leave_request_submitted', {
        requestId,
        employeeName: request.employee_name,
        leaveType: request.leave_type_name
      });
    }
  }

  public async notifyLeaveRequestApproved(data: LeaveNotificationData) {
    const request = await this.getRequestDetails(data.requestId);
    if (!request) return;

    // Notify employee
    await this.createNotification(
      request.user_id,
      'Leave Request Approved',
      `Your ${request.leave_type_name} request has been approved by ${data.level}`,
      'leave_request_approved',
      { requestId: data.requestId, comments: data.comments }
    );

    await socketService.emitToUser(request.user_id, 'leave_request_approved', {
      requestId: data.requestId,
      leaveType: request.leave_type_name,
      level: data.level,
      comments: data.comments
    });

    // If there's a next level, notify those approvers
    if (request.current_level_id) {
      const approverIds = await this.getApproverIds(request.company_id, request.required_role);
      for (const approverId of approverIds) {
        await this.createNotification(
          approverId,
          'Leave Request Needs Review',
          `${request.employee_name}'s ${request.leave_type_name} request needs your approval`,
          'leave_request_pending',
          { requestId: data.requestId }
        );

        await socketService.emitToUser(approverId, 'leave_request_pending', {
          requestId: data.requestId,
          employeeName: request.employee_name,
          leaveType: request.leave_type_name
        });
      }
    }
  }

  public async notifyLeaveRequestRejected(data: LeaveNotificationData) {
    const request = await this.getRequestDetails(data.requestId);
    if (!request) return;

    // Notify employee
    await this.createNotification(
      request.user_id,
      'Leave Request Rejected',
      `Your ${request.leave_type_name} request has been rejected by ${data.level}`,
      'leave_request_rejected',
      { requestId: data.requestId, comments: data.comments }
    );

    await socketService.emitToUser(request.user_id, 'leave_request_rejected', {
      requestId: data.requestId,
      leaveType: request.leave_type_name,
      level: data.level,
      comments: data.comments
    });
  }

  public async notifyLeaveRequestEscalated(data: LeaveNotificationData) {
    const request = await this.getRequestDetails(data.requestId);
    if (!request) return;

    // Notify employee
    await this.createNotification(
      request.user_id,
      'Leave Request Escalated',
      `Your ${request.leave_type_name} request has been escalated to management`,
      'leave_request_escalated',
      { requestId: data.requestId, comments: data.comments }
    );

    await socketService.emitToUser(request.user_id, 'leave_request_escalated', {
      requestId: data.requestId,
      leaveType: request.leave_type_name,
      comments: data.comments
    });

    // Notify management
    const managementIds = await this.getApproverIds(request.company_id, 'management');
    for (const managerId of managementIds) {
      await this.createNotification(
        managerId,
        'Escalated Leave Request',
        `${request.employee_name}'s ${request.leave_type_name} request needs your review`,
        'leave_request_escalated',
        { requestId: data.requestId }
      );

      await socketService.emitToUser(managerId, 'leave_request_escalated', {
        requestId: data.requestId,
        employeeName: request.employee_name,
        leaveType: request.leave_type_name
      });
    }
  }
}

export const leaveNotificationService = new LeaveNotificationService(); 