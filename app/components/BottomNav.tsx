import { View, Text, TouchableOpacity } from 'react-native';
import ThemeContext from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';

interface NavItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  href: string;
}

interface BottomNavProps {
  items: NavItem[];
}

export default function BottomNav({ items }: BottomNavProps) {
  const { theme } = ThemeContext.useTheme();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View 
      className={`flex-row justify-around items-center py-2 px-4 border-t
      ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}
    >
      {items.map((item) => (
        <TouchableOpacity
          key={item.href}
          onPress={() => router.push(item.href as any)}
          className="items-center py-2 px-4"
        >
          <Ionicons
            name={item.icon}
            size={24}
            color={pathname === item.href 
              ? '#3B82F6' 
              : theme === 'dark' ? '#9CA3AF' : '#6B7280'
            }
          />
          <Text
            className={`text-xs mt-1
            ${pathname === item.href 
              ? 'text-blue-500' 
              : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
} 