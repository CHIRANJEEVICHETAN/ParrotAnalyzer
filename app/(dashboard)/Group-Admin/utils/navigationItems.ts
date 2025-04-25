import { NavItem } from '../../../types/nav';

export const groupAdminNavItems: NavItem[] = [
  {
    icon: "home-outline",
    label: "Home",
    href: "/(dashboard)/Group-Admin/group-admin",
  },
  {
    icon: "people-outline",
    label: "Employees",
    href: "/(dashboard)/Group-Admin/employee-management",
  },
  // {
  //   icon: "pulse-outline",
  //   label: "Live-testing",
  //   href: "/tracking-test",
  // },
  // {
  //   icon: "notifications-outline",
  //   label: "Test Notifications",
  //   href: "/(testing)/test-notifications",
  // },
  {
    icon: "list-outline",
    label: "Tasks",
    href: "/(dashboard)/Group-Admin/task-management",
  },
  // {
  //   icon: "document-text-outline",
  //   label: "Reports",
  //   href: "/(dashboard)/Group-Admin/reports",
  // },
  {
    icon: "notifications-outline",
    label: "Notifications",
    href: "/(dashboard)/Group-Admin/notifications",
  },
  {
    icon: "settings-outline",
    label: "Settings",
    href: "/(dashboard)/Group-Admin/settings",
  },
]; 