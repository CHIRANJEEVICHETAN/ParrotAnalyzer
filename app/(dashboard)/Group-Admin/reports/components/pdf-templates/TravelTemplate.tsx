import { generateBaseTemplate, TemplateOptions } from './BaseTemplate';

interface TravelData {
  summary: {
    totalTrips: number;
    totalDistance: number;
    totalExpenses: number;
    avgTripCost: number;
    totalTravelers: number;
  };
  expenseBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  vehicleStats: Array<{
    vehicleType: string;
    tripCount: number;
    totalDistance: number;
    totalExpenses: number;
  }>;
  employeeStats: Array<{
    employeeName: string;
    tripCount: number;
    totalDistance: number;
    totalExpenses: number;
    avgExpensePerTrip: number;
  }>;
  recentTrips: Array<{
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

export const generateTravelReport = (data: TravelData, options: TemplateOptions): string => {
  const content = `
    <div class="summary-section">
      <h2>Travel Summary</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Total Trips</div>
          <div class="stat-value">${data.summary.totalTrips}</div>
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
          <div class="stat-label">Avg Trip Cost</div>
          <div class="stat-value">₹${data.summary.avgTripCost.toLocaleString()}</div>
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
          ${data.expenseBreakdown.map(exp => `
            <tr>
              <td>${exp.category}</td>
              <td>₹${exp.amount.toLocaleString()}</td>
              <td>${exp.percentage}%</td>
            </tr>
          `).join('')}
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
          ${data.vehicleStats.map(vehicle => `
            <tr>
              <td>${vehicle.vehicleType}</td>
              <td>${vehicle.tripCount}</td>
              <td>${vehicle.totalDistance.toFixed(1)} km</td>
              <td>₹${vehicle.totalExpenses.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

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
          ${data.employeeStats.map(emp => `
            <tr>
              <td>${emp.employeeName}</td>
              <td>${emp.tripCount}</td>
              <td>${emp.totalDistance.toFixed(1)} km</td>
              <td>₹${emp.totalExpenses.toLocaleString()}</td>
              <td>₹${emp.avgExpensePerTrip.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>Recent Trips</h2>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Date</th>
            <th>Route</th>
            <th>Distance</th>
            <th>Expenses</th>
          </tr>
        </thead>
        <tbody>
          ${data.recentTrips.map(trip => `
            <tr>
              <td>${trip.employeeName}</td>
              <td>${trip.date}</td>
              <td>${trip.route}</td>
              <td>${trip.distance.toFixed(1)} km</td>
              <td>₹${trip.expenses.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  return generateBaseTemplate({
    title: 'Travel Report',
    date: new Date().toLocaleDateString(),
    content,
    theme: options.theme,
    companyInfo: options.companyInfo,
    adminName: options.adminName
  });
}; 