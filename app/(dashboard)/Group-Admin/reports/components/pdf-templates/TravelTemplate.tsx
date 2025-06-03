import { generateBaseTemplate, TemplateOptions } from './BaseTemplate';

interface TravelData {
  summary: {
    totalTrips: number;
    totalDistance: number;
    totalExpenses: number;
    avgTripCost: number;
    totalTravelers: number;
  };
  expenseBreakdown?: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  categories?: Array<{
    category: string;
    amount: number;
    percentage: string;
  }>;
  vehicleStats?: Array<{
    vehicleType: string;
    tripCount: number;
    totalDistance: number;
    totalExpenses: number;
  }>;
  transport?: Array<{
    vehicle_type: string;
    trip_count: number;
    total_distance: number;
    total_expenses: number;
  }>;
  employeeStats?: Array<{
    employeeName: string;
    tripCount: number;
    totalDistance: number;
    totalExpenses: number;
    avgExpensePerTrip: number;
  }>;
  recentTrips?: Array<{
    employeeName: string;
    date: string;
    route: string;
    distance: number;
    expenses: number;
  }>;
  companyInfo: {
    name: string;
    logo: string;
    address: string;
    contact: string;
  };
}

// Helper function to safely format numeric values
const safeFormat = {
  fixed: (value: any, decimals = 1): string => {
    const num = parseFloat(value);
    return isNaN(num) ? '0' : num.toFixed(decimals);
  },
  locale: (value: any): string => {
    const num = parseFloat(value);
    return isNaN(num) ? '0' : num.toLocaleString();
  }
};

export const generateTravelReport = (data: TravelData, options: TemplateOptions): string => {
  // Ensure summary data exists with defaults
  const summary = {
    totalTrips: data.summary?.totalTrips || 0,
    totalDistance: data.summary?.totalDistance || 0,
    totalExpenses: data.summary?.totalExpenses || 0,
    avgTripCost: data.summary?.avgTripCost || 0,
    totalTravelers: data.summary?.totalTravelers || 0,
  };
  
  // Data mapping to handle both old and new formats
  const expenses = data.expenseBreakdown || (data.categories ? data.categories.map(c => ({
    category: c.category || 'Other',
    amount: parseFloat(c.amount?.toString() || '0'),
    percentage: parseFloat(c.percentage?.toString() || '0')
  })) : []);
  
  const vehicles = data.vehicleStats || (data.transport ? data.transport.map(t => ({
    vehicleType: t.vehicle_type || 'Unknown',
    tripCount: parseInt(t.trip_count?.toString() || '0'),
    totalDistance: parseFloat(t.total_distance?.toString() || '0'),
    totalExpenses: parseFloat(t.total_expenses?.toString() || '0')
  })) : []);
  
  const employees = data.employeeStats || [];
  const trips = data.recentTrips || [];

  const content = `
    <div class="summary-section">
      <h2>Travel Summary</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Total Trips</div>
          <div class="stat-value">${summary.totalTrips}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Total Distance</div>
          <div class="stat-value">${safeFormat.fixed(summary.totalDistance)} km</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Total Expenses</div>
          <div class="stat-value">₹${safeFormat.locale(summary.totalExpenses)}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Avg Trip Cost</div>
          <div class="stat-value">₹${safeFormat.locale(summary.avgTripCost)}</div>
        </div>
      </div>

      <h2>Expense Breakdown</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Amount</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.length > 0 ? expenses.map(exp => `
            <tr>
              <td>${exp.category || 'Other'}</td>
              <td>₹${safeFormat.locale(exp.amount)}</td>
              <td>${safeFormat.fixed(exp.percentage)}%</td>
            </tr>
          `).join('') : '<tr><td colspan="3">No expense data available</td></tr>'}
        </tbody>
      </table>

      <h2>Vehicle Statistics</h2>
      <table>
        <thead>
          <tr>
            <th>Vehicle Type</th>
            <th>Trips</th>
            <th>Distance</th>
            <th>Expenses</th>
          </tr>
        </thead>
        <tbody>
          ${vehicles.length > 0 ? vehicles.map(vehicle => `
            <tr>
              <td>${vehicle.vehicleType || 'Unknown'}</td>
              <td>${vehicle.tripCount || 0}</td>
              <td>${safeFormat.fixed(vehicle.totalDistance)} km</td>
              <td>₹${safeFormat.locale(vehicle.totalExpenses)}</td>
            </tr>
          `).join('') : '<tr><td colspan="4">No vehicle data available</td></tr>'}
        </tbody>
      </table>

      ${employees.length > 0 ? `
      <h2>Employee Travel Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Trips</th>
            <th>Distance</th>
            <th>Total Expenses</th>
            <th>Avg/Trip</th>
          </tr>
        </thead>
        <tbody>
          ${employees.map(emp => `
            <tr>
              <td>${emp.employeeName || 'Unknown'}</td>
              <td>${emp.tripCount || 0}</td>
              <td>${safeFormat.fixed(emp.totalDistance)} km</td>
              <td>₹${safeFormat.locale(emp.totalExpenses)}</td>
              <td>₹${safeFormat.locale(emp.avgExpensePerTrip)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ` : ''}

      ${trips.length > 0 ? `
      <h2>Recent Trips</h2>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Date</th>
            <th>Description</th>
            <th>Distance</th>
            <th>Expenses</th>
          </tr>
        </thead>
        <tbody>
          ${trips.map(trip => `
            <tr>
              <td>${trip.employeeName || 'Unknown'}</td>
              <td>${trip.date || '-'}</td>
              <td>${trip.route || 'Travel expense'}</td>
              <td>${safeFormat.fixed(trip.distance)} km</td>
              <td>₹${safeFormat.locale(trip.expenses)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ` : ''}
    </div>
  `;

  return generateBaseTemplate({
    title: 'Travel Report',
    date: new Date().toLocaleDateString(),
    content,
    theme: options.theme,
    companyInfo: options.companyInfo || {
      name: 'Company Name',
      logo: '',
      address: '',
      contact: ''
    },
    adminName: options.adminName || 'Administrator'
  });
}; 