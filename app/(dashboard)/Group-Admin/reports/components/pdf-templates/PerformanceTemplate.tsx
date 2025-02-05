import { generateBaseTemplate, TemplateOptions } from './BaseTemplate';

interface PerformanceData {
  summary: {
    totalEmployees: number;
    avgAttendance: number;
    avgTaskCompletion: number;
    avgExpenseApproval: number;
  };
  employeePerformance: Array<{
    employeeName: string;
    employeeNumber: string;
    attendance: {
      daysPresent: number;
      onTimeRate: number;
      avgWorkingHours: number;
    };
    tasks: {
      totalAssigned: number;
      completionRate: number;
      onTimeCompletion: number;
    };
    expenses: {
      totalSubmitted: number;
      approvalRate: number;
      avgProcessingTime: number;
    };
  }>;
  departmentStats: Array<{
    department: string;
    employeeCount: number;
    avgAttendance: number;
    avgTaskCompletion: number;
    avgExpenseApproval: number;
  }>;
  topPerformers: Array<{
    employeeName: string;
    department: string;
    score: number;
    highlights: string[];
  }>;
  companyInfo: {
    name: string;
    logo: string;
    address: string;
    contact: string;
  };
}

export const generatePerformanceReport = (data: PerformanceData, options: TemplateOptions): string => {
  const content = `
    <div class="summary-section">
      <h2>Performance Overview</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Total Employees</div>
          <div class="stat-value">${data.summary.totalEmployees}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Avg Attendance</div>
          <div class="stat-value">${data.summary.avgAttendance}%</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Task Completion</div>
          <div class="stat-value">${data.summary.avgTaskCompletion}%</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Expense Approval</div>
          <div class="stat-value">${data.summary.avgExpenseApproval}%</div>
        </div>
      </div>

      <h2>Employee Performance Details</h2>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>ID</th>
            <th>Attendance</th>
            <th>Working Hours</th>
            <th>Task Completion</th>
            <th>On-Time Tasks</th>
            <th>Expense Approval</th>
          </tr>
        </thead>
        <tbody>
          ${data.employeePerformance.map(emp => `
            <tr>
              <td>${emp.employeeName}</td>
              <td>${emp.employeeNumber}</td>
              <td>${emp.attendance.onTimeRate}%</td>
              <td>${emp.attendance.avgWorkingHours.toFixed(1)}h</td>
              <td>${emp.tasks.completionRate}%</td>
              <td>${emp.tasks.onTimeCompletion}%</td>
              <td>${emp.expenses.approvalRate}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>Department Performance</h2>
      <table>
        <thead>
          <tr>
            <th>Department</th>
            <th>Employees</th>
            <th>Avg Attendance</th>
            <th>Task Completion</th>
            <th>Expense Approval</th>
          </tr>
        </thead>
        <tbody>
          ${data.departmentStats.map(dept => `
            <tr>
              <td>${dept.department}</td>
              <td>${dept.employeeCount}</td>
              <td>${dept.avgAttendance}%</td>
              <td>${dept.avgTaskCompletion}%</td>
              <td>${dept.avgExpenseApproval}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>Top Performers</h2>
      <div class="top-performers">
        ${data.topPerformers.map(performer => `
          <div class="performer-card">
            <h3>${performer.employeeName}</h3>
            <p class="department">${performer.department}</p>
            <p class="score">Performance Score: ${performer.score}%</p>
            <ul>
              ${performer.highlights.map(highlight => `
                <li>${highlight}</li>
              `).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  return generateBaseTemplate({
    title: 'Performance Report',
    date: new Date().toLocaleDateString(),
    content,
    theme: options.theme,
    companyInfo: options.companyInfo,
    adminName: options.adminName
  });
}; 