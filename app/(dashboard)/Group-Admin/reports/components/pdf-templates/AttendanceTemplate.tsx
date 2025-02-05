import { generateBaseTemplate, TemplateOptions } from './BaseTemplate';

interface AttendanceData {
  summary: {
    totalEmployees: number;
    avgWorkingHours: number;
    onTimeRate: number;
    totalDistance: number;
  };
  dailyStats: Array<{
    date: string;
    presentCount: number;
    onTimeCount: number;
    totalHours: number;
  }>;
  employeeStats: Array<{
    employeeName: string;
    daysPresent: number;
    avgHours: number;
    onTimePercentage: number;
  }>;
  companyInfo: {
    name: string;
    logo: string;
    address: string;
    contact: string;
  };
}

export const generateAttendanceReport = (data: AttendanceData, options: TemplateOptions): string => {
  const content = `
    <div class="summary-section">
      <h2>Attendance Summary</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Total Employees</div>
          <div class="stat-value">${data.summary.totalEmployees}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Avg. Working Hours</div>
          <div class="stat-value">${data.summary.avgWorkingHours.toFixed(1)}h</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">On-Time Rate</div>
          <div class="stat-value">${data.summary.onTimeRate}%</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Total Distance</div>
          <div class="stat-value">${data.summary.totalDistance.toFixed(1)} km</div>
        </div>
      </div>

      <h2>Daily Statistics</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Present</th>
            <th>On Time</th>
            <th>Total Hours</th>
          </tr>
        </thead>
        <tbody>
          ${data.dailyStats.map(day => `
            <tr>
              <td>${day.date}</td>
              <td>${day.presentCount}</td>
              <td>${day.onTimeCount}</td>
              <td>${day.totalHours.toFixed(1)}h</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>Employee Performance</h2>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Days Present</th>
            <th>Avg Hours</th>
            <th>On Time %</th>
          </tr>
        </thead>
        <tbody>
          ${data.employeeStats.map(emp => `
            <tr>
              <td>${emp.employeeName}</td>
              <td>${emp.daysPresent}</td>
              <td>${emp.avgHours.toFixed(1)}h</td>
              <td>${emp.onTimePercentage}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  return generateBaseTemplate({
    title: 'Attendance Report',
    date: new Date().toLocaleDateString(),
    content,
    theme: options.theme,
    companyInfo: options.companyInfo,
    adminName: options.adminName
  });
}; 