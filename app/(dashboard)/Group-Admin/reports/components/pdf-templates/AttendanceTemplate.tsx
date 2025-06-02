import { generateBaseTemplate, TemplateOptions } from './BaseTemplate';

interface AttendanceData {
  summary: {
    totalEmployees: number;
    avgWorkingHours: number;
    onTimeRate: number;
    totalDistance: number;
    totalExpenses: number;
    activeShifts: number;
    completedShifts: number;
    totalWorkingHours?: number;
  };
  dailyStats: Array<{
    date: string;
    presentCount: number;
    onTimeCount: number;
    totalHours: number;
    totalDistance: number;
    totalExpenses: number;
    completedShifts: number;
    incompleteShifts: number;
  }>;
  employeeStats: Array<{
    employeeName: string;
    role: string;
    department: string;
    daysPresent: number;
    avgHours: number;
    onTimePercentage: number;
    totalDistance: number;
    totalExpenses: number;
    shiftStatus: {
      completed: number;
      active: number;
      incomplete: number;
    };
  }>;
  shiftDetails?: Array<{
    employeeName: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
    distance: number;
    expenses: number;
    status: string;
  }>;
  companyInfo: {
    name: string;
    logo: string;
    address: string;
    contact: string;
  };
  filters?: {
    dateRange?: string;
    employee?: string;
    department?: string;
  };
}

export const generateAttendanceReport = (data: AttendanceData, options: TemplateOptions): string => {
  // Calculate formatted date range for title
  const dateRangeTitle = data.filters?.dateRange || "Last 30 Days";
  const employeeFilter = data.filters?.employee ? ` - ${data.filters.employee}` : "";
  const departmentFilter = data.filters?.department ? ` - ${data.filters.department}` : "";
  
  const content = `
    <div class="summary-section">
      <h2>Attendance Summary ${employeeFilter}${departmentFilter}</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Total Employees</div>
          <div class="stat-value">${data.summary.totalEmployees}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Total Shifts</div>
          <div class="stat-value">${data.summary.completedShifts + (data.summary.activeShifts || 0)}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">On-Time Rate</div>
          <div class="stat-value">${data.summary.onTimeRate}%</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Avg. Working Hours</div>
          <div class="stat-value">${data.summary.avgWorkingHours.toFixed(1)}h</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Total Distance</div>
          <div class="stat-value">${data.summary.totalDistance.toFixed(1)} km</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Total Expenses</div>
          <div class="stat-value">₹${data.summary.totalExpenses.toLocaleString()}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Completed Shifts</div>
          <div class="stat-value">${data.summary.completedShifts}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Active/Incomplete</div>
          <div class="stat-value">${data.summary.activeShifts}</div>
        </div>
      </div>

      <h2>Daily Statistics</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Employees Present</th>
            <th>Total Hours</th>
            <th>Completed Shifts</th>
            <th>Incomplete</th>
            <th>Total KM</th>
            <th>Total Expenses</th>
          </tr>
        </thead>
        <tbody>
          ${data.dailyStats.map(day => `
            <tr>
              <td>${day.date}</td>
              <td>${day.presentCount}</td>
              <td>${day.totalHours.toFixed(1)}h</td>
              <td>${day.completedShifts}</td>
              <td>${day.incompleteShifts}</td>
              <td>${day.totalDistance.toFixed(1)} km</td>
              <td>₹${day.totalExpenses.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>Employee Performance</h2>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Role</th>
            <th>Department</th>
            <th>Days Present</th>
            <th>Total Hours</th>
            <th>On Time %</th>
            <th>Distance</th>
            <th>Expenses</th>
            <th>Shift Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.employeeStats.map(emp => `
            <tr>
              <td>${emp.employeeName}</td>
              <td>${emp.role || 'Employee'}</td>
              <td>${emp.department || 'N/A'}</td>
              <td>${emp.daysPresent}</td>
              <td>${emp.avgHours.toFixed(1)}h</td>
              <td>${emp.onTimePercentage}%</td>
              <td>${emp.totalDistance.toFixed(1)} km</td>
              <td>₹${emp.totalExpenses.toLocaleString()}</td>
              <td>${emp.shiftStatus.completed} Completed${emp.shiftStatus.active || emp.shiftStatus.incomplete ? `, ${emp.shiftStatus.active || emp.shiftStatus.incomplete} Incomplete` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${data.filters?.employee && data.shiftDetails && data.shiftDetails.length > 0 ? `
        <h2>Shift Details - ${data.filters.employee}</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Duration</th>
              <th>KM</th>
              <th>Expenses</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.shiftDetails.map(shift => `
              <tr>
                <td>${shift.date}</td>
                <td>${shift.startTime}</td>
                <td>${shift.endTime || 'N/A'}</td>
                <td>${shift.duration.toFixed(1)}h</td>
                <td>${shift.distance.toFixed(1)} km</td>
                <td>₹${shift.expenses.toLocaleString()}</td>
                <td>${shift.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      <div style="margin-top: 30px; font-size: 14px; color: #6B7280;">
        <h3>Notes:</h3>
        <ul>
          <li>On-Time Rate: Percentage of shifts started before or at 9:00 AM.</li>
          <li>Working hours calculated based on shift start and end times.</li>
          <li>Incomplete shifts: Shifts that have been started but not ended yet.</li>
          ${data.summary.activeShifts > 0 ? 
            `<li><strong>Note:</strong> There are ${data.summary.activeShifts} active/incomplete shifts in the selected period.</li>` : ''}
        </ul>
      </div>
    </div>
  `;

  return generateBaseTemplate({
    title: `Attendance Report - ${dateRangeTitle}`,
    date: new Date().toLocaleDateString(),
    content,
    theme: options.theme,
    companyInfo: options.companyInfo,
    adminName: options.adminName,
    filters: options.filters
  });
}; 