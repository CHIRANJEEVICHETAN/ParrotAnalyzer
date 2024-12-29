import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface GraphSelectorProps {
  options: Array<{
    type: string;
    icon: string;
    label: string;
  }>;
  selectedType: string;
  onSelect: (type: string) => void;
  isDark: boolean;
}

export default function GraphSelector({ options, selectedType, onSelect, isDark }: GraphSelectorProps) {
  return (
    <View className="flex-row flex-wrap">
      {options.map((option) => (
        <TouchableOpacity
          key={option.type}
          onPress={() => onSelect(option.type)}
          className={`flex-row items-center mr-2 mb-2 px-2 py-1 rounded-lg ${
            selectedType === option.type
              ? isDark ? 'bg-blue-600' : 'bg-blue-500'
              : isDark ? 'bg-gray-700' : 'bg-gray-100'
          }`}
          style={styles.graphOption}
        >
          <Ionicons
            name={option.icon as any}
            size={14}
            color={selectedType === option.type ? '#FFFFFF' : isDark ? '#9CA3AF' : '#6B7280'}
            style={{ marginRight: 3 }}
          />
          <Text className={`${
            selectedType === option.type
              ? 'text-white'
              : isDark ? 'text-gray-300' : 'text-gray-600'
          } text-xs`}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  graphOption: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  }
}); 