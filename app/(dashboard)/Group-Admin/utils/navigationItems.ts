import { NavItem } from '../../../types/nav';

export const groupAdminNavItems: NavItem[] = [
  { icon: 'home-outline', label: 'Home', href: '/(dashboard)/Group-Admin/group-admin' },
  { icon: 'people-outline', label: 'Employees', href: '/(dashboard)/Group-Admin/employee-management' },
  { icon: 'list-outline', label: 'Tasks', href: '/(dashboard)/Group-Admin/task-management' },
  { icon: 'document-text-outline', label: 'Reports', href: '/(dashboard)/Group-Admin/reports' },
  { icon: 'settings-outline', label: 'Settings', href: '/(dashboard)/Group-Admin/settings' },
]; 