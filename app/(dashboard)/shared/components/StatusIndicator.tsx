import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrackingStatus } from '../../../types/liveTracking';
import { useThemeColor } from '../../../hooks/useColorScheme';

interface StatusIndicatorProps {
  status: TrackingStatus;
  showText?: boolean;
  size?: 'small' | 'medium' | 'large';
}

/**
 * A component that visually represents tracking status
 */
const StatusIndicator: React.FC<StatusIndicatorProps> = ({ 
  status, 
  showText = false,
  size = 'medium'
}) => {
  const textColor = useThemeColor('#334155', '#e2e8f0');

  // Determine indicator color based on status
  const getStatusColor = () => {
    switch (status) {
      case TrackingStatus.ACTIVE:
        return '#10b981'; // Green
      case TrackingStatus.PAUSED:
        return '#f59e0b'; // Yellow/Orange
      case TrackingStatus.ERROR:
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  // Determine status text
  const getStatusText = () => {
    switch (status) {
      case TrackingStatus.ACTIVE:
        return 'Active';
      case TrackingStatus.PAUSED:
        return 'Paused';
      case TrackingStatus.ERROR:
        return 'Error';
      default:
        return 'Inactive';
    }
  };

  // Calculate size
  const getIndicatorSize = () => {
    switch (size) {
      case 'small':
        return 8;
      case 'large':
        return 14;
      default:
        return 10;
    }
  };

  const indicatorSize = getIndicatorSize();

  return (
    <View style={styles.container}>
      <View 
        style={[
          styles.indicator,
          { 
            backgroundColor: getStatusColor(),
            width: indicatorSize,
            height: indicatorSize,
            borderRadius: indicatorSize / 2
          }
        ]} 
      />
      {showText && (
        <Text style={[styles.text, { color: textColor }]}>
          {getStatusText()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicator: {
    marginRight: 6,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  }
});

export default StatusIndicator; 