import { generateBaseTemplate, TemplateOptions } from './BaseTemplate';
import { format } from 'date-fns';

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
    reportPeriod?: {
      startDate: string;
      endDate: string;
      totalDays: number;
    }
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
    id: number;
    employeeName: string;
    employeeNumber: string;
    role: string;
    department: string;
    designation: string;
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
  employeeAttendanceData?: Array<{
    id: number;
    name: string;
    employeeNumber: string;
    department: string;
    designation: string;
    summary: {
      daysPresent: number;
      daysAbsent: number;
      daysOnLeave: number;
      avgHours: number;
      onTimePercentage: number;
      totalDistance: number;
      totalExpenses: number;
      completedShifts: number;
      activeShifts: number;
      incompleteShifts: number;
    };
    dailyRecords: Array<{
      date: string;
      dayOfWeek: string;
      status: string;
      shifts: Array<{
        id: number;
        startTime: string;
        endTime: string;
        duration: number;
        distance: number;
        expenses: number;
        status: string;
        startLocation: string;
        endLocation: string;
        endedAutomatically: boolean;
      }>;
      expenses: Array<{
        id: number;
        total: number;
        kilometers: number;
        lodging: number;
        dailyAllowance: number;
        fuel: number;
        toll: number;
        other: number;
        status: string;
        comments: string;
      }>;
      leave?: {
        leaveType: string;
        isPaid: boolean;
        status: string;
        reason: string;
      };
      summary: {
        totalHours: number;
        totalDistance: number;
        totalExpenses: number;
        shiftsCount: number;
      }
    }>;
  }>;
  companyInfo: {
    name: string;
    logo: string;
    address: string;
    contact: string;
  };
  filterOptions?: {
    startDate?: string;
    endDate?: string;
    employeeId?: string;
    department?: string;
    dateRangePreset?: string;
  };
  leaveInfo?: Array<{
    employeeId: number;
    employeeName: string;
    employeeNumber: string;
    startDate: string;
    endDate: string;
    daysCount: number;
    leaveType: string;
    isPaid: boolean;
    reason?: string;
  }>;
}

export const generateAttendanceReport = (data: AttendanceData, options: TemplateOptions): string => {
  // Format dates for display
  const startDate = data.summary.reportPeriod?.startDate || data.filterOptions?.startDate || '';
  const endDate = data.summary.reportPeriod?.endDate || data.filterOptions?.endDate || '';
  
  // Format date range for title
  const dateRangeTitle = startDate && endDate 
    ? `${formatDateString(startDate)} – ${formatDateString(endDate)}`
    : "Last 30 Days";

  // Format filters
  const employeeFilter = options.filters?.employee || '';
  const departmentFilter = options.filters?.department || '';
  
  // Calculate leave days total
  const totalLeaveDays = data.leaveInfo 
    ? data.leaveInfo.reduce((sum, leave) => sum + leave.daysCount, 0)
    : 0;

  // Generate detailed attendance data
  const detailedAttendance = generateDetailedAttendanceTable(data);
  
  // Generate per-employee summary
  const employeeSummary = generateEmployeeSummary(data);

  const content = `
    <div class="report-container">
      <h1 class="main-title">${data.companyInfo?.name || 'Company'} – Attendance & Shift Report</h1>
      
      <div class="header-meta">
        <div class="meta-item"><strong>Date Range:</strong> ${dateRangeTitle}</div>
        <div class="meta-item"><strong>Generated On:</strong> ${formatDateString(new Date().toISOString())}</div>
      </div>

      <div class="section overview-section">
        <h2>1. Report Overview</h2>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value">${data.summary.totalEmployees}</div>
            <div class="metric-label">Total Employees</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.summary.completedShifts + data.summary.activeShifts}</div>
            <div class="metric-label">Total Shifts</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.summary.onTimeRate}%</div>
            <div class="metric-label">On-Time Rate</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.summary.avgWorkingHours.toFixed(1)} h</div>
            <div class="metric-label">Average Working Hours</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.summary.totalDistance.toFixed(1)} km</div>
            <div class="metric-label">Total Distance Traveled</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">₹${data.summary.totalExpenses.toLocaleString()}</div>
            <div class="metric-label">Total Expenses</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${totalLeaveDays}</div>
            <div class="metric-label">Total Leave Days Approved</div>
          </div>
        </div>
      </div>

      ${data.leaveInfo && data.leaveInfo.length > 0 ? `
        <div class="section">
          <h2>2. Leave Summary</h2>
          <p class="section-description">List of all leaves approved (or pending) in the above date range.</p>
          <table class="data-table leave-table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Leave Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Total Days</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${data.leaveInfo.map(leave => `
                <tr>
                  <td>${leave.employeeName} (${leave.employeeNumber})</td>
                  <td>${leave.leaveType}</td>
                  <td>${formatDateString(leave.startDate)}</td>
                  <td>${formatDateString(leave.endDate)}</td>
                  <td>${leave.daysCount}</td>
                  <td>${leave.isPaid ? 'Paid' : 'Unpaid'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <div class="section">
        <h2>3. Detailed Attendance & Shift Log</h2>
        <p class="section-description">One row per employee per day. "Present" = Yes/No; if "No" and a leave is approved, leave type is shown; otherwise marked Absent.</p>
        ${detailedAttendance}
      </div>

      <div class="section">
        <h2>4. Employee Performance Summary</h2>
        <p class="section-description">Aggregated metrics per employee over the date range.</p>
        ${employeeSummary}
      </div>

      <div class="section">
        <h2>5. Notes & Definitions</h2>
        <ol class="notes-list">
          <li><strong>On-Time:</strong> Shift is "On-Time" if the employee's first GPS-recorded location at check-in is timestamped at or before 09:00 AM local time.</li>
          <li><strong>Shift Status:</strong>
            <ul>
              <li><strong>Completed:</strong> Both "Shift Start" and "Shift End" times exist.</li>
              <li><strong>Incomplete:</strong> "Shift Start" exists but "Shift End" is missing.</li>
              <li><strong>No Shift:</strong> No "Shift Start" record and no approved leave on that date.</li>
            </ul>
          </li>
          <li><strong>Location Format:</strong> GPS coordinates shown as latitude°, longitude°; optionally in parentheses add a label.</li>
          <li><strong>Total KM Traveled:</strong> Distance between "Shift Start" and "Shift End".</li>
          <li><strong>Expenses:</strong> Sum of all expense entries submitted on that particular shift date.</li>
          <li><strong>Leave Type:</strong> If "Present=No" and an approved leave covers that date, leave type is shown. If "Present=No" and no leave found, marked as "Absent".</li>
        </ol>
      </div>

      <style>
        .report-container {
          font-family: Arial, sans-serif;
          max-width: 100%;
          margin: 0 auto;
        }
        .main-title {
          font-size: 24px;
          color: #333;
          text-align: center;
          margin-bottom: 10px;
        }
        .header-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          color: #555;
          border-bottom: 1px solid #ccc;
          padding-bottom: 10px;
        }
        .section {
          margin-bottom: 30px;
        }
        .overview-section {
          background-color: #f9fafc;
          padding: 15px;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }
        .metrics-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          margin-top: 15px;
        }
        .metric-card {
          flex: 1;
          min-width: 120px;
          background-color: white;
          padding: 12px;
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border-left: 3px solid #2563eb;
          text-align: center;
        }
        .metric-value {
          font-size: 20px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 4px;
        }
        .metric-label {
          font-size: 11px;
          color: #6b7280;
        }
        .section h2 {
          font-size: 18px;
          color: #2563eb;
          margin-bottom: 10px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 5px;
        }
        .section-description {
          font-style: italic;
          color: #666;
          margin-bottom: 10px;
          font-size: 13px;
        }
        .metrics-overview {
          display: flex;
          flex-wrap: wrap;
          list-style-type: none;
          padding: 0;
        }
        .metrics-overview li {
          width: 33%;
          padding: 8px 0;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 11px;
        }
        .data-table th {
          background-color: #2563eb;
          color: white;
          padding: 6px 4px;
          text-align: left;
          font-size: 11px;
          border: 1px solid #e5e7eb;
        }
        .data-table td {
          padding: 6px 4px;
          border: 1px solid #e5e7eb;
          font-size: 11px;
        }
        .data-table tbody tr:nth-child(even) {
          background-color: #f9fafb;
        }
        .leave-table th {
          background-color: #8b5cf6;
        }
        .notes-list {
          font-size: 13px;
          padding-left: 20px;
        }
        .notes-list li {
          margin-bottom: 8px;
        }
        .notes-list ul {
          padding-left: 20px;
          margin-top: 5px;
        }
      </style>
    </div>
  `;

  return generateBaseTemplate({
    title: `Attendance Report - ${dateRangeTitle}`,
    date: formatDateString(new Date().toISOString()),
    content,
    theme: options.theme,
    companyInfo: data.companyInfo,
    adminName: options.adminName,
    filters: {
      dateRange: dateRangeTitle,
      employee: employeeFilter,
      department: departmentFilter
    }
  });
};

// Helper function to format dates consistently
function formatDateString(dateStr: string): string {
  try {
    // Handle different date formats
    if (!dateStr) return '–';
    
    // Try to parse the date in several formats
    let date;
    
    // For ISO date strings (YYYY-MM-DD)
    if (dateStr.includes('-')) {
      date = new Date(dateStr);
    } 
    // For date strings formatted like "MM/DD/YYYY" from toLocaleDateString()
    else if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        // Assume MM/DD/YYYY format from US locale
        const month = parseInt(parts[0]) - 1; // Month is 0-indexed
        const day = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        
        // Create date using UTC to avoid timezone issues
        date = new Date(Date.UTC(year, month, day));
      } else {
        date = new Date(dateStr);
      }
    } else {
      date = new Date(dateStr);
    }
    
    if (isNaN(date.getTime())) {
      return dateStr; // Return original if parsing failed
    }
    
    // Format as DD/MM/YYYY (Indian format)
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateStr; // Return original if any error occurs
  }
}

// Helper function to convert minutes to hours and minutes format
function formatDuration(hours: number): string {
  if (isNaN(hours) || hours === 0) return '–';
  
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  
  return `${h} h ${m > 0 ? `${m} m` : ''}`;
}

// Generate the detailed attendance table
function generateDetailedAttendanceTable(data: AttendanceData): string {
  if (!data.employeeAttendanceData || data.employeeAttendanceData.length === 0) {
    return '<p>No detailed attendance data available.</p>';
  }

  // Group records by employee
  let tableContent = '';
  
  // Sort employees by name
  const sortedEmployees = [...data.employeeAttendanceData].sort((a, b) => 
    a.name.localeCompare(b.name)
  );
  
  // Loop through each employee
  sortedEmployees.forEach(employee => {
    // Create employee header
    tableContent += `
      <div class="employee-section">
        <h3 style="margin-top: 20px; margin-bottom: 20px; text-align: center; font-size: 24px; font-weight: bold; border: 2px solid #2563eb; border-radius: 8px; padding: 12px; background: linear-gradient(to right, #2563eb0d, #2563eb1a); color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.1);">${employee.name} <span style="font-size: 16px; opacity: 0.8;">(${employee.employeeNumber})</span></h3>
        <div class="employee-summary-box">
          <div><strong>Department:</strong> ${employee.department}</div>
          <div><strong>Role:</strong> Employee</div>
          <div><strong>Days Present:</strong> ${employee.summary.daysPresent}</div>
          <div><strong>Leave Days:</strong> ${employee.summary.daysOnLeave}</div>
          <div><strong>Absent Days:</strong> ${employee.summary.daysAbsent}</div>
        </div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee Number</th>
              <th>Employee Name</th>
              <th>Role</th>
              <th>Department</th>
              <th>Present</th>
              <th>Shift Start Time</th>
              <th>Shift End Time</th>
              <th>Shift Start Location</th>
              <th>Shift End Location</th>
              <th>Total Hours Worked</th>
              <th>Total KM Traveled</th>
              <th>Expenses (₹)</th>
              <th>On-Time</th>
              <th>Shift Status</th>
              <th>Leave Type</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    // Sort daily records by date (descending)
    const sortedDailyRecords = [...employee.dailyRecords].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
    
    // Add each day's attendance record
    sortedDailyRecords.forEach(record => {
      // Convert date format - directly parse the MM/DD/YYYY format that is likely coming from the backend
      let formattedDate = record.date;
      
      try {
        if (typeof record.date === 'string' && record.date.includes('/')) {
          const parts = record.date.split('/');
          if (parts.length === 3) {
            // Assume MM/DD/YYYY format
            const month = parseInt(parts[0]) - 1;
            const day = parseInt(parts[1]);
            const year = parseInt(parts[2]);
            const date = new Date(year, month, day);
            
            // Format as DD/MM/YYYY
            formattedDate = `${day.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${year}`;
          }
        }
      } catch (error) {
        console.error('Error parsing date:', error, record.date);
      }
      
      // Get first shift of the day if present
      const firstShift = record.shifts.length > 0 ? record.shifts[0] : undefined;
      
      // Calculate if on-time (start time before or at 9 AM)
      const onTime = firstShift 
        ? extractTimeHours(firstShift.startTime) <= 9 
        : false;
      
      // Determine shift status
      let shiftStatus = 'No Shift';
      if (record.shifts.length > 0) {
        if (firstShift?.endTime && firstShift.endTime !== 'N/A') {
          shiftStatus = 'Completed';
        } else {
          shiftStatus = 'Incomplete';
        }
      } else if (record.leave) {
        shiftStatus = 'Absent';
      } else {
        shiftStatus = 'Absent';
      }

      // Determine row class based on status
      let rowClass = '';
      if (record.shifts.length > 0) {
        rowClass = 'present-row';
      } else if (record.leave) {
        rowClass = 'leave-row';
      } else {
        rowClass = 'absent-row';
      }
      
      tableContent += `
        <tr class="${rowClass}">
          <td>${formattedDate}</td>
          <td>${employee.employeeNumber}</td>
          <td>${employee.name}</td>
          <td>Employee</td>
          <td>${employee.department}</td>
          <td>${record.shifts.length > 0 ? 'Yes' : 'No'}</td>
          <td>${firstShift?.startTime || '–'}</td>
          <td>${firstShift?.endTime && firstShift.endTime !== 'N/A' ? firstShift.endTime : '–'}</td>
          <td>${firstShift?.startLocation && firstShift.startLocation !== 'N/A' ? firstShift.startLocation : '–'}</td>
          <td>${firstShift?.endLocation && firstShift.endLocation !== 'N/A' ? firstShift.endLocation : '–'}</td>
          <td>${formatDuration(record.summary.totalHours)}</td>
          <td>${record.summary.totalDistance > 0 ? `${record.summary.totalDistance.toFixed(1)} km` : '–'}</td>
          <td>${record.summary.totalExpenses > 0 ? `₹${record.summary.totalExpenses.toLocaleString()}` : '–'}</td>
          <td>${record.shifts.length > 0 ? (onTime ? 'Yes' : 'No') : '–'}</td>
          <td>${shiftStatus}</td>
          <td>${record.leave?.leaveType || '–'}</td>
        </tr>
      `;
    });
    
    tableContent += `
          </tbody>
        </table>
      </div>
    `;
  });
  
  return `
    <div class="detailed-attendance">
      ${tableContent}
      <style>
        .employee-section {
          margin-bottom: 30px;
          page-break-inside: avoid;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 20px;
        }
        .employee-section h3 {
          margin-bottom: 8px;
          color: #2563eb;
          font-size: 16px;
        }
        .employee-summary-box {
          display: flex;
          flex-wrap: wrap;
          margin-bottom: 10px;
          background-color: #f0f4ff;
          padding: 8px 12px;
          border-radius: 4px;
          border-left: 4px solid #2563eb;
        }
        .employee-summary-box div {
          margin-right: 20px;
          font-size: 12px;
        }
        .present-row {
          background-color: #f0fff4;
        }
        .leave-row {
          background-color: #fff0f7;
        }
        .absent-row {
          background-color: #fff7ed;
        }
      </style>
    </div>
  `;
}

// Generate per-employee performance summary
function generateEmployeeSummary(data: AttendanceData): string {
  // Combine employee stats with leave information
  const employees = data.employeeStats || [];
  const leaveMap: { [key: number]: number } = {};
  
  // Create a map of employee ID to total leave days
  if (data.leaveInfo) {
    data.leaveInfo.forEach(leave => {
      if (!leaveMap[leave.employeeId]) {
        leaveMap[leave.employeeId] = 0;
      }
      leaveMap[leave.employeeId] += leave.daysCount;
    });
  }
  
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Employee Name</th>
          <th>Role</th>
          <th>Department</th>
          <th>Days Present</th>
          <th>Total Hours</th>
          <th>On-Time Rate</th>
          <th>Total KM</th>
          <th>Total Expenses (₹)</th>
          <th>Shifts Completed</th>
          <th>Leave Days</th>
        </tr>
      </thead>
      <tbody>
        ${employees.map(emp => `
          <tr>
            <td>${emp.employeeName} (${emp.employeeNumber})</td>
            <td>${emp.role || 'Employee'}</td>
            <td>${emp.department || '–'}</td>
            <td>${emp.daysPresent}</td>
            <td>${formatDuration(emp.avgHours * emp.daysPresent)}</td>
            <td>${emp.daysPresent > 0 ? `${emp.onTimePercentage}%` : '–'}</td>
            <td>${emp.totalDistance > 0 ? `${emp.totalDistance.toFixed(1)} km` : '–'}</td>
            <td>${emp.totalExpenses > 0 ? `₹${emp.totalExpenses.toLocaleString()}` : '–'}</td>
            <td>${emp.shiftStatus.completed}</td>
            <td>${leaveMap[emp.id] || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Helper to extract hours from time string (e.g., "09:30 AM" -> 9.5)
function extractTimeHours(timeStr: string | undefined): number {
  if (!timeStr) return -1;
  
  try {
    // Match hours, minutes, and AM/PM
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return -1;
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const isPM = match[3]?.toUpperCase() === 'PM';
    
    // Convert to 24-hour format if PM
    if (isPM && hours < 12) hours += 12;
    // Handle 12 AM (midnight)
    if (!isPM && hours === 12) hours = 0;
    
    return hours + minutes / 60;
  } catch {
    return -1;
  }
} 