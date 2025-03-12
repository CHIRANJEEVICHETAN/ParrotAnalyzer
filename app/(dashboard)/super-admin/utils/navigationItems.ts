import { NavItem } from "../../../types/nav";

export const superAdminNavItems: NavItem[] = [
  { icon: "home-outline", label: "Home", href: "/super-admin" },
  {
    icon: "people-outline",
    label: "Users",
    href: "/super-admin/company_management",
  },
  {
    icon: "settings-outline",
    label: "Config",
    href: "/super-admin/system-config",
  },
  { icon: "document-outline", label: "Reports", href: "/super-admin/reports" },
  { icon: "shield-outline", label: "Security", href: "/super-admin/security" },
];
