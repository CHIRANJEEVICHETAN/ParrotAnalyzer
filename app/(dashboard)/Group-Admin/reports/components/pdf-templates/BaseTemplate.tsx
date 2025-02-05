import { Theme } from '../../types';

interface BaseTemplateProps {
  title: string;
  date: string;
  content: string;
  theme?: Theme;
  logo?: string;
  companyInfo?: {
    name: string;
    logo: string;
    address: string;
    contact: string;
  };
  adminName?: string;
}

export interface TemplateOptions {
  theme: Theme;
  companyInfo?: {
    name: string;
    logo: string;
    address: string;
    contact: string;
  };
  adminName?: string;
}

export const generateBaseTemplate = ({
  title,
  date,
  content,
  theme = 'light',
  companyInfo,
  adminName = 'Group Admin'
}: BaseTemplateProps): string => {
  const isDark = theme === 'dark';
  
  // Use companyInfo if provided, fallback to env variables
  const companyName = companyInfo?.name || 'Company Name';
  const companyLogo = companyInfo?.logo || 'Company Logo';
  const companyAddress = companyInfo?.address || 'Company Address';
  const companyContact = companyInfo?.contact || 'Company Contact';

  // Ensure we're not wrapping content that's already an HTML document
  const isContentHTML = content.trim().toLowerCase().startsWith('<!doctype html') || 
                       content.trim().toLowerCase().startsWith('<html');

  // If content is already a complete HTML document, return it as is
  if (isContentHTML) {
    return content;
  }
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body {
            font-family: 'Helvetica', sans-serif;
            color: ${isDark ? '#FFFFFF' : '#000000'};
            background-color: ${isDark ? '#1F2937' : '#FFFFFF'};
            margin: 0;
            padding: 40px;
            font-size: 14px;
            line-height: 1.5;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #3B82F6;
            padding-bottom: 20px;
          }

          .company-info {
            text-align: right;
          }

          .logo {
            max-width: 150px;
            height: auto;
            object-fit: contain;
          }

          .title {
            font-size: 32px;
            font-weight: bold;
            color: #3B82F6;
            margin-bottom: 10px;
          }

          .date {
            font-size: 14px;
            color: ${isDark ? '#9CA3AF' : '#6B7280'};
          }

          .content {
            margin-top: 20px;
          }

          .summary-section {
            margin-bottom: 40px;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
          }

          .stat-box {
            background-color: ${isDark ? '#374151' : '#F3F4F6'};
            padding: 20px;
            border-radius: 8px;
            text-align: center;
          }

          .stat-label {
            font-size: 14px;
            color: ${isDark ? '#9CA3AF' : '#6B7280'};
            margin-bottom: 8px;
          }

          .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: ${isDark ? '#FFFFFF' : '#111827'};
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background-color: ${isDark ? '#374151' : '#FFFFFF'};
            border-radius: 8px;
            overflow: hidden;
          }

          th {
            background-color: #3B82F6;
            color: white;
            font-weight: 600;
            padding: 12px;
            text-align: left;
          }

          td {
            padding: 12px;
            border-bottom: 1px solid ${isDark ? '#4B5563' : '#E5E7EB'};
          }

          tr:last-child td {
            border-bottom: none;
          }

          .top-performers {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-top: 20px;
          }

          .performer-card {
            background-color: ${isDark ? '#374151' : '#F3F4F6'};
            padding: 20px;
            border-radius: 8px;
          }

          .performer-card h3 {
            margin: 0 0 10px 0;
            color: #3B82F6;
          }

          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: ${isDark ? '#9CA3AF' : '#6B7280'};
            border-top: 1px solid ${isDark ? '#4B5563' : '#E5E7EB'};
            padding-top: 20px;
          }

          .admin-info {
            font-size: 14px;
            color: ${isDark ? '#9CA3AF' : '#6B7280'};
            margin-top: 4px;
          }

          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${companyLogo 
            ? `<img src="${companyLogo}" class="logo" alt="${companyName}" onerror="this.style.display='none'"/>` 
            : ''}
          <div class="company-info">
            <div class="title">${title}</div>
            <div class="date">Generated on: ${date}</div>
            <div class="admin-info">Generated by: ${adminName}</div>
            <div class="company-details">
              <div>${companyName || ''}</div>
              <div>${companyAddress || ''}</div>
              <div>${companyContact || ''}</div>
            </div>
          </div>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <div>Generated by ${adminName} | ${companyName}</div>
          <div>This is a computer-generated document. No signature is required.</div>
        </div>
      </body>
    </html>
  `;
}; 