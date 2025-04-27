import { generateBaseTemplate, TemplateOptions } from './BaseTemplate';
import { LeaveAnalyticsData, LeaveTypeData, LeaveTypeBalance, EmployeeStat } from '../../../types';

// Helper to get color for leave types - fully dynamic approach
const getLeaveTypeColor = (leaveType: string): string => {
  const type = leaveType.toLowerCase();
  
  // Define color palette for common leave types
  const colorMap: Record<string, string> = {
    casual: '#3B82F6',    // Blue
    sick: '#EF4444',      // Red
    annual: '#10B981',    // Green
    privilege: '#10B981', // Green
    pl: '#10B981',        // Green (Privilege Leave)
    el: '#10B981',        // Green (Earned Leave)
    sl: '#EF4444',        // Red (Sick Leave)
    cl: '#3B82F6',        // Blue (Casual Leave)
    maternity: '#EC4899', // Pink
    paternity: '#8B5CF6', // Purple
    marriage: '#8B5CF6',  // Purple
    bereavement: '#6B7280', // Gray
    public: '#F59E0B',    // Amber
    holiday: '#F59E0B',   // Amber
    compensatory: '#14B8A6', // Teal
    comp: '#14B8A6',      // Teal
    special: '#6366F1',   // Indigo
    scl: '#6366F1',       // Indigo (Special Casual Leave)
    sabbatical: '#7C3AED', // Violet
    without: '#9CA3AF',   // Gray
    lwp: '#9CA3AF',       // Gray (Leave Without Pay)
    birthday: '#F97316',  // Orange
    adoption: '#EC4899',  // Pink
    child: '#A855F7',     // Purple
  };

  // Find the first matching type in our map
  for (const [key, color] of Object.entries(colorMap)) {
    if (type.includes(key)) {
      return color;
    }
  }
  
  // Default - create a consistent color based on the leave type string
  const hashCode = Array.from(type).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', 
    '#EC4899', '#6366F1', '#64748B', '#14B8A6', '#F97316'
  ];
  return colors[hashCode % colors.length];
};

export const generateLeaveReport = (data: LeaveAnalyticsData, options: TemplateOptions): string => {
  console.log('Generating leave report with data structure:', {
    hasLeaveTypes: Array.isArray(data.leaveTypes),
    employeeStatsCount: data.employeeStats?.length || 0,
    hasBalances: !!data.balances,
    hasMetrics: !!data.metrics
  });

  // Extract data from the analytics with safe fallbacks
  const sortedLeaveTypes = [...(data.leaveTypes || [])].sort((a, b) => b.request_count - a.request_count);
  
  // Calculate rejected counts (not directly available in the metrics)
  const metrics = data.metrics || {
    total_requests: 0,
    approved_requests: 0,
    pending_requests: 0,
    total_employees_on_leave: 0,
    approval_rate: 0,
    total_leave_days: 0
  };
  
  const rejectedCount = metrics.total_requests - 
                      metrics.approved_requests - 
                      metrics.pending_requests;
  
  // Group leave types for visualization purposes (optional)
  const groupLeavesByCategory = () => {
    // This is a dynamic approach that categorizes leave types based on analysis of their names
    // rather than hardcoding specific category mappings
    
    const result: Record<string, LeaveTypeData[]> = {
      'Regular': [],
      'Special': [],
      'Other': []
    };
    
    // Dynamically categorize leave types
    (data.leaveTypes || []).forEach(lt => {
      const name = lt.leave_type.toLowerCase();
      if (name.includes('casual') || name.includes('sick') || name.includes('annual') || 
          name.includes('privilege') || name.includes('cl') || name.includes('sl') || 
          name.includes('el') || name.includes('pl')) {
        result['Regular'].push(lt);
      } else if (name.includes('maternity') || name.includes('paternity') || 
                name.includes('marriage') || name.includes('bereavement') || 
                name.includes('sabbatical') || name.includes('child') || 
                name.includes('adoption') || name.includes('special')) {
        result['Special'].push(lt);
      } else {
        result['Other'].push(lt);
      }
    });
    
    return result;
  };
  
  const groupedLeaves = groupLeavesByCategory();
  
  const content = `
    <div class="summary-section">
      <h2>Leave Summary</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Total Requests</div>
          <div class="stat-value">${metrics.total_requests}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Approved</div>
          <div class="stat-value">${metrics.approved_requests}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Pending</div>
          <div class="stat-value">${metrics.pending_requests}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Rejected</div>
          <div class="stat-value">${rejectedCount}</div>
        </div>
      </div>
      
      <div class="stats-grid" style="margin-top: 20px;">
        <div class="stat-box">
          <div class="stat-label">Approval Rate</div>
          <div class="stat-value">${metrics.approval_rate}%</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Total Leave Days</div>
          <div class="stat-value">${metrics.total_leave_days}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Employees on Leave</div>
          <div class="stat-value">${metrics.total_employees_on_leave}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Total Types</div>
          <div class="stat-value">${data.leaveTypes?.length || 0}</div>
        </div>
      </div>

      <h2>Leave Type Distribution</h2>
      <table>
        <thead>
          <tr>
            <th>Leave Type</th>
            <th>Requests</th>
            <th>Approved</th>
            <th>Rejected</th>
            <th>Pending</th>
            <th>Days</th>
            <th>% of Total</th>
          </tr>
        </thead>
        <tbody>
          ${sortedLeaveTypes.map(type => {
            const percentage = metrics.total_requests > 0 ? 
              Math.round((type.request_count / metrics.total_requests) * 100) : 0;
            return `
              <tr>
                <td>
                  <div style="display: flex; align-items: center;">
                    <div style="width: 12px; height: 12px; border-radius: 3px; background-color: ${getLeaveTypeColor(type.leave_type)}; margin-right: 8px;"></div>
                    ${type.leave_type}
                  </div>
                </td>
                <td>${type.request_count}</td>
                <td>${type.approved_count}</td>
                <td>${type.rejected_count}</td>
                <td>${type.pending_count}</td>
                <td>${type.total_days}</td>
                <td>${percentage}%</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      ${data.monthlyTrend && data.monthlyTrend.length > 0 ? `
        <h2>Monthly Trend</h2>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Request Count</th>
            </tr>
          </thead>
          <tbody>
            ${data.monthlyTrend.map(month => `
              <tr>
                <td>${month.month}</td>
                <td>${month.count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      <h2>Employee Leave Statistics</h2>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Total Requests</th>
            <th>Approved</th>
            <th>Days Taken</th>
            <th>Leave Types</th>
          </tr>
        </thead>
        <tbody>
          ${(data.employeeStats || []).map(emp => `
            <tr>
              <td>${emp.employee_name}</td>
              <td>${emp.total_requests}</td>
              <td>${emp.approved_requests}</td>
              <td>${emp.total_leave_days}</td>
              <td>${emp.leave_types}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${data.balances && data.balances.leave_types_balances ? `
        <h2>Leave Balance Overview</h2>
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-label">Total Available</div>
            <div class="stat-value">${data.balances.total_leave_balance || 0}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Total Used</div>
            <div class="stat-value">${data.balances.total_leave_used || 0}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Total Pending</div>
            <div class="stat-value">${data.balances.total_leave_pending || 0}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Employee Count</div>
            <div class="stat-value">${metrics.total_employees_on_leave || 0}</div>
          </div>
        </div>
        
        <h3>Leave Type Balances</h3>
        <table>
          <thead>
            <tr>
              <th>Leave Type</th>
              <th>Available</th>
              <th>Used</th>
              <th>Pending</th>
            </tr>
          </thead>
          <tbody>
            ${(data.balances.leave_types_balances || []).map((balance, index) => `
              <tr>
                <td>
                  <div style="display: flex; align-items: center;">
                    <div style="width: 12px; height: 12px; border-radius: 3px; background-color: ${getLeaveTypeColor(balance.leave_type)}; margin-right: 8px;"></div>
                    ${balance.leave_type}
                  </div>
                </td>
                <td>${balance.total_available}</td>
                <td>${balance.total_used}</td>
                <td>${balance.total_pending}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
      
      <h2>Leave Categories</h2>
      
      ${Object.entries(groupedLeaves).map(([category, leaves]) => {
        if (leaves.length === 0) return '';
        
        return `
          <h3>${category} Leave Types</h3>
          <table>
            <thead>
              <tr>
                <th>Leave Type</th>
                <th>Requests</th>
                <th>Approved</th>
                <th>Days</th>
              </tr>
            </thead>
            <tbody>
              ${leaves.map(leave => `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center;">
                      <div style="width: 12px; height: 12px; border-radius: 3px; background-color: ${getLeaveTypeColor(leave.leave_type)}; margin-right: 8px;"></div>
                      ${leave.leave_type}
                    </div>
                  </td>
                  <td>${leave.request_count}</td>
                  <td>${leave.approved_count}</td>
                  <td>${leave.total_days}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }).join('')}
    </div>
  `;

  return generateBaseTemplate({
    title: 'Leave Analysis Report',
    date: new Date().toLocaleDateString(),
    content,
    theme: options.theme,
    companyInfo: options.companyInfo,
    adminName: options.adminName
  });
}; 