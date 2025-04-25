export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  company_id: number;
  group_admin_id?: number;
  permissions?: string[];
  token?: string;
} 