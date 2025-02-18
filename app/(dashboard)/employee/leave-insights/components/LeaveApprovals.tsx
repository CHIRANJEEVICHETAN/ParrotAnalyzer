import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../../../context/ThemeContext';

export default function LeaveApprovals() {
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === 'dark';

  return (
    <ScrollView className="flex-1">
      {/* Approved/Rejected leave requests list */}
    </ScrollView>
  );
} 