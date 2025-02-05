import { generateBaseTemplate, TemplateOptions } from './BaseTemplate';

interface ExpenseData {
  summary: {
    totalExpenses: number;
    averageExpense: number;
    approvalRate: number;
    pendingCount: number;
  };
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: string;
  }>;
  recentExpenses: Array<{
    employeeName: string;
    date: string;
    amount: number;
    status: string;
    category: string;
    description?: string;
  }>;
  companyInfo: {
    name: string;
    logo: string;
    address: string;
    contact: string;
  };
}

export const generateExpenseReport = (data: ExpenseData, options: TemplateOptions): string => {
  const content = `
    <div class="summary-section">
      <h2>Expense Summary</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Total Expenses</div>
          <div class="stat-value">₹${data.summary.totalExpenses.toLocaleString()}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Average Expense</div>
          <div class="stat-value">₹${data.summary.averageExpense.toLocaleString()}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Approval Rate</div>
          <div class="stat-value">${data.summary.approvalRate}%</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Pending Claims</div>
          <div class="stat-value">${data.summary.pendingCount}</div>
        </div>
      </div>

      <h2>Category Breakdown</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Amount</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          ${data.categoryBreakdown.map(cat => `
            <tr>
              <td>${cat.category}</td>
              <td>₹${cat.amount.toLocaleString()}</td>
              <td>${cat.percentage}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>All Expenses</h2>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Date</th>
            <th>Category</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.recentExpenses.map(exp => `
            <tr>
              <td>${exp.employeeName}</td>
              <td>${exp.date}</td>
              <td>${exp.category}</td>
              <td>${exp.description || '-'}</td>
              <td>₹${exp.amount.toLocaleString()}</td>
              <td>${exp.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  return generateBaseTemplate({
    title: 'Expense Report',
    date: new Date().toLocaleDateString(),
    content,
    theme: options.theme,
    companyInfo: options.companyInfo,
    adminName: options.adminName
  });
}; 