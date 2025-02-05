import { generateBaseTemplate, TemplateOptions } from './BaseTemplate';

interface TaskData {
  summary: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    overdueTasks: number;
    avgCompletionTime: number | null;
  };
  statusBreakdown: Array<{
    status: string;
    count: number;
    percentage: string;
  }>;
  priorityBreakdown: Array<{
    priority: string;
    count: number;
    percentage: string;
  }>;
  employeePerformance: Array<{
    employeeName: string;
    totalTasks: number;
    completedTasks: number;
    onTimeCompletion: number;
    avgCompletionTime: number | null;
  }>;
  companyInfo: {
    name: string;
    logo: string;
    address: string;
    contact: string;
  };
}

export const generateTaskReport = (data: TaskData, options: TemplateOptions): string => {
  // Add safe checks for data access
  const summary = data?.summary || {};
  const statusBreakdown = data?.statusBreakdown || [];
  const priorityBreakdown = data?.priorityBreakdown || [];
  const employeePerformance = data?.employeePerformance || [];

  const content = `
    <div class="summary-section">
      <h2>Task Summary</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Total Tasks</div>
          <div class="stat-value">${summary.totalTasks || 0}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Completion Rate</div>
          <div class="stat-value">${summary.completionRate?.toFixed(1) || '0.0'}%</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Overdue Tasks</div>
          <div class="stat-value">${summary.overdueTasks || 0}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Avg. Completion Time</div>
          <div class="stat-value">${summary.avgCompletionTime?.toFixed(1) || '0.0'}h</div>
        </div>
      </div>

      <div class="distribution-section">
        <h2>Status Distribution</h2>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Count</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${statusBreakdown.map(status => `
              <tr>
                <td>${status.status || 'Unknown'}</td>
                <td>${status.count || 0}</td>
                <td>${status.percentage || '0.0'}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>Priority Distribution</h2>
        <table>
          <thead>
            <tr>
              <th>Priority</th>
              <th>Count</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${priorityBreakdown.map(priority => `
              <tr>
                <td>${priority.priority || 'Unknown'}</td>
                <td>${priority.count || 0}</td>
                <td>${priority.percentage || '0.0'}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <h2>Employee Performance</h2>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Total Tasks</th>
            <th>Completed</th>
            <th>On-Time %</th>
            <th>Avg Time</th>
          </tr>
        </thead>
        <tbody>
          ${employeePerformance.map(emp => `
            <tr>
              <td>${emp.employeeName || 'Unknown'}</td>
              <td>${emp.totalTasks || 0}</td>
              <td>${emp.completedTasks || 0}</td>
              <td>${emp.onTimeCompletion?.toFixed(1) || '0.0'}%</td>
              <td>${emp.avgCompletionTime?.toFixed(1) || '0.0'}h</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  return generateBaseTemplate({
    title: 'Task Report',
    date: new Date().toLocaleDateString(),
    content,
    theme: options.theme,
    companyInfo: options.companyInfo,
    adminName: options.adminName
  });
}; 