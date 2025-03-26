import { NavItem } from "../../../types/nav";

export const managementNavItems: NavItem[] = [
  { icon: "home-outline", label: "Home", href: "/management" },
  {
    icon: "analytics-outline",
    label: "Analytics",
    href: "/management/analytics",
  },
  {
    icon: "notifications-outline",
    label: "Push Notifications",
    href: "/(dashboard)/management/notifications",
  },
  // {
  //   icon: "notifications-outline",
  //   label: "Test Notifications",
  //   href: "/(testing)/test-notifications",
  // },
  {
    icon: "calendar-outline",
    label: "Leave",
    href: "/(dashboard)/management/leave-management",
  },
  { icon: "person-outline", label: "Profile", href: "/management/profile" },
];
