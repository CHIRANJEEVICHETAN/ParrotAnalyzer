import { NavItem } from '../../../types/nav';

export const employeeNavItems: NavItem[] = [
  {
    icon: "home-outline",
    label: "Home",
    href: "/(dashboard)/employee/employee",
  },
  {
    icon: "location-outline",
    label: "Live Tracking",
    href: "/(dashboard)/employee/tracking",
  },
  // {
  //   icon: "location",
  //   label: "Live Tracking Test",
  //   href: "/(dashboard)/tracking-test",
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