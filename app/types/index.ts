export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  company_id?: number;
  group_id?: number;
  profile_image?: string;
} 