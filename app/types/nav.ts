import { Ionicons } from '@expo/vector-icons';

export interface NavItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  href: string;
}

const nav = {
  NavItem: {} as NavItem
};

export default nav; 