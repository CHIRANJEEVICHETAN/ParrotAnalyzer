import { generateBaseTemplate, TemplateOptions } from './BaseTemplate';

interface LeaveData {
  summary: {
    totalLeaves: number;
    approvedLeaves: number;
    pendingLeaves: number;
    rejectedLeaves: number;
    avgProcessingTime: number;
  };
  leaveTypeBreakdown: Array<{
    type: string;
    count: number;
    percentage: number;
    totalDays: number;
  }>;
  monthlyDistribution: Array<{
    month: string;
    count: number;
    approvedCount: number;
    totalDays: number;
  }>;
  employeeStats: Array<{
    employeeName: string;
    totalLeaves: number;
    approvedLeaves: number;
    totalDays: number;
    remainingBalance: number;
    leaveTypes: Array<{
      type: string;
      count: number;
      days: number;
    }>;
    leaveBalance: {
      casual: number;
      sick: number;
      annual: number;
    };
  }>;
  recentLeaves: Array<{
    employeeName: string;
    type: string;
    startDate: string;
    endDate: string;
    days: number;
    status: string;
  }>;
  companyInfo: {
    name: string;
    logo: string;
    address: string;
    contact: string;
  };
}

export const generateLeaveReport = (data: LeaveData, options: TemplateOptions): string => {
  const content = `
    <div class="summary-section">
      <h2>Leave Summary</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Total Leaves</div>
          <div class="stat-value">${data.summary.totalLeaves}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Approved</div>
          <div class="stat-value">${data.summary.approvedLeaves}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Pending</div>
          <div class="stat-value">${data.summary.pendingLeaves}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Processing Time</div>
          <div class="stat-value">${data.summary.avgProcessingTime.toFixed(1)}h</div>
        </div>
      </div>

      <h2>Leave Type Distribution</h2>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Count</th>
            <th>Days</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          ${data.leaveTypeBreakdown.map(type => `
            <tr>
              <td>${type.type}</td>
              <td>${type.count}</td>
              <td>${type.totalDays}</td>
              <td>${type.percentage}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>Monthly Distribution</h2>
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Total Leaves</th>
            <th>Approved</th>
            <th>Total Days</th>
          </tr>
        </thead>
        <tbody>
          ${data.monthlyDistribution.map(month => `
            <tr>
              <td>${month.month}</td>
              <td>${month.count}</td>
              <td>${month.approvedCount}</td>
              <td>${month.totalDays}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>Employee Leave Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Total Leaves</th>
            <th>Approved</th>
            <th>Total Days</th>
            <th>Casual</th>
            <th>Sick</th>
            <th>Annual</th>
          </tr>
        </thead>
        <tbody>
          ${data.employeeStats.map(emp => `
            <tr>
              <td>${emp.employeeName}</td>
              <td>${emp.totalLeaves}</td>
              <td>${emp.approvedLeaves}</td>
              <td>${emp.totalDays}</td>
              <td>${emp.leaveBalance.casual}</td>
              <td>${emp.leaveBalance.sick}</td>
              <td>${emp.leaveBalance.annual}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>Recent Leave Requests</h2>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Type</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Days</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.recentLeaves.map(leave => `
            <tr>
              <td>${leave.employeeName}</td>
              <td>${leave.type}</td>
              <td>${leave.startDate}</td>
              <td>${leave.endDate}</td>
              <td>${leave.days}</td>
              <td>${leave.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  return generateBaseTemplate({
    title: 'Leave Report',
    date: new Date().toLocaleDateString(),
    content,
    theme: options.theme,
    companyInfo: options.companyInfo,
    adminName: options.adminName
  });
}; 