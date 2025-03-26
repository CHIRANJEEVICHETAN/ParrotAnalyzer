import { NavItem } from '../../../types/nav';

export const employeeNavItems: NavItem[] = [
  {
    icon: "home-outline",
    label: "Home",
    href: "/(dashboard)/employee/employee",
  },
  {
    icon: "time-outline",
    label: "Shift Tracker",
    href: "/(dashboard)/shared/shiftTracker",
  },
  // {
  //   icon: "notifications-outline",
  //   label: "Test Notifications",
  //   href: "/(testing)/test-notifications",
  // },
  {
    icon: "calendar-outline",
    label: "Leave",
    href: "/(dashboard)/employee/leave-insights",
  },
  {
    icon: "notifications-outline",
    label: "Notifications",
    href: "/(dashboard)/employee/notifications",
  },
  {
    icon: "person-outline",
    label: "Profile",
    href: "/(dashboard)/employee/profile",
  },
]; 