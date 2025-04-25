// Employee leave statistics type
export interface EmployeeStat {
  employee_id: number;
  employee_name: string;
  total_requests: number;
  approved_requests: number;
  total_leave_days: number;
  leave_types: string;
}

// Leave type data structure
export interface LeaveTypeData {
  id: number;
  leave_type: string;
  request_count: number;
  approved_count: number;
  rejected_count: number;
  pending_count: number;
  total_days: number;
  default_days?: number;
}

// Leave balance data structure
export interface LeaveTypeBalance {
  leave_type: string;
  total_available: number;
  total_used: number;
  total_pending: number;
}

// Leave balances response
export interface LeaveBalances {
  total_leave_balance: number;
  total_leave_used: number;
  total_leave_pending: number;
  leave_types_balances: LeaveTypeBalance[];
}

// Monthly trend data
export interface MonthlyTrend {
  month: string;
  count: number;
}

// Leave metrics
export interface LeaveMetrics {
  total_employees_on_leave: number;
  total_requests: number;
  approved_requests: number;
  pending_requests: number;
  approval_rate: number;
  total_leave_days: number;
}

// Complete leave analytics data structure
export interface LeaveAnalyticsData {
  leaveTypes: LeaveTypeData[];
  employeeStats: EmployeeStat[];
  balances: LeaveBalances;
  monthlyTrend: MonthlyTrend[];
  metrics: LeaveMetrics;
} 