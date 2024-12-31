import { generateBaseTemplate } from './BaseTemplate';

interface TaskData {
  summary: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    overdueTasks: number;
    avgCompletionTime: number;
  };
  statusBreakdown: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  priorityBreakdown: Array<{
    priority: string;
    count: number;
    percentage: number;
  }>;
  employeePerformance: Array<{
    employeeName: string;
    totalTasks: number;
    completedTasks: number;
    onTimeCompletion: number;
    avgCompletionTime: number;
  }>;
  companyInfo: {
    name: string;
    logo: string;
    address: string;
    contact: string;
  };
}

export const generateTaskReport = (data: TaskData, theme: 'light' | 'dark'): string => {
  const content = `
    <div class="summary-section">
      <h2>Task Summary</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Total Tasks</div>
          <div class="stat-value">${data.summary.totalTasks}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Completion Rate</div>
          <div class="stat-value">${data.summary.completionRate}%</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Overdue Tasks</div>
          <div class="stat-value">${data.summary.overdueTasks}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Avg. Completion Time</div>
          <div class="stat-value">${data.summary.avgCompletionTime.toFixed(1)}h</div>
        </div>
      </div>

      <div class="breakdown-section">
        <h2>Task Status Distribution</h2>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Count</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${data.statusBreakdown.map(status => `
              <tr>
                <td>${status.status}</td>
                <td>${status.count}</td>
                <td>${status.percentage}%</td>
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
            ${data.priorityBreakdown.map(priority => `
              <tr>
                <td>${priority.priority}</td>
                <td>${priority.count}</td>
                <td>${priority.percentage}%</td>
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
          ${data.employeePerformance.map(emp => `
            <tr>
              <td>${emp.employeeName}</td>
              <td>${emp.totalTasks}</td>
              <td>${emp.completedTasks}</td>
              <td>${emp.onTimeCompletion}%</td>
              <td>${emp.avgCompletionTime.toFixed(1)}h</td>
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
    theme,
    companyInfo: data.companyInfo
  });
}; 