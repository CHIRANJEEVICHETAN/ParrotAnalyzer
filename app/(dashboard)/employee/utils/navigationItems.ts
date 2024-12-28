import { NavItem } from '../../../types/nav';

export const employeeNavItems: NavItem[] = [
  { icon: 'home-outline', label: 'Home', href: '/(dashboard)/employee/employee' },
  { icon: 'time-outline', label: 'Shift Tracker', href: '/(dashboard)/employee/employeeShiftTracker' },
  { icon: 'notifications-outline', label: 'Notifications', href: '/(dashboard)/employee/notifications' },
  { icon: 'person-outline', label: 'Profile', href: '/(dashboard)/employee/profile' },
]; 