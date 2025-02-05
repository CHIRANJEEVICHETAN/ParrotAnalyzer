export interface LeaveType {
  id: number;
  name: string;
  description: string;
  requires_documentation: boolean;
  max_days: number;
  is_paid: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface LeavePolicy {
  id: number;
  leave_type_id: number;
  default_days: number;
  carry_forward_days: number;
  min_service_days: number;
  requires_approval: boolean;
  notice_period_days: number;
  max_consecutive_days: number;
  gender_specific: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface LeavePolicyRule {
  id: number;
  policy_id: number;
  rule_type: string;
  rule_value: any;
  created_at: Date;
}

export interface LeaveRequest {
  id: number;
  user_id: number;
  leave_type_id: number;
  start_date: Date;
  end_date: Date;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  contact_number: string;
  requires_documentation: boolean;
  documentation_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface LeaveBalance {
  id: number;
  user_id: number;
  leave_type_id: number;
  total_days: number;
  used_days: number;
  remaining_days: number;
  year: number;
  created_at: Date;
  updated_at: Date;
}

export interface LeaveAnalytics {
  statistics: {
    total_requests: number;
    approved_requests: number;
    pending_requests: number;
    rejected_requests: number;
  };
  typeDistribution: Array<{
    leave_type: string;
    request_count: number;
  }>;
  trend: Array<{
    date: string;
    request_count: number;
  }>;
}

export interface LeaveEscalation {
  id: number;
  request_id: number;
  escalated_by: number;
  escalated_to: number;
  reason: string;
  status: 'pending' | 'resolved';
  resolution_notes?: string;
  created_at: Date;
  resolved_at?: Date;
} 