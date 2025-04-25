import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, FontAwesome5, Fontisto } from "@expo/vector-icons";
import { useThemeColor } from "../../../hooks/useColorScheme";

interface BatteryLevelIndicatorProps {
  level: number;
  showText?: boolean;
  size?: "small" | "medium" | "large";
  isCharging?: boolean;
}

/**
 * A component that displays the battery level with color-coded indicators
 */
const BatteryLevelIndicator: React.FC<BatteryLevelIndicatorProps> = ({
  level,
  showText = true,
  size = "medium",
  isCharging = false,
}) => {
  const textColor = useThemeColor("#334155", "#e2e8f0");

  // Determine icon size based on component size
  const getIconSize = () => {
    switch (size) {
      case "small":
        return 14;
      case "large":
        return 22;
      default:
        return 18;
    }
  };

  // Determine icon name and color based on battery level
  const getBatteryIcon = () => {
    if (isCharging) {
      return {
        name: "battery-charging",
        color: "#10b981", // Green
        iconSet: "Ionicons",
      };
    }

    if (level <= 10) {
      return {
        name: "battery-dead",
        color: "#ef4444", // Red
        iconSet: "Ionicons",
      };
    } else if (level <= 20) {
      return {
        name: "battery-quarter",
        color: "#ef4444", // Red
        iconSet: "Fontisto",
      };
    } else if (level <= 50) {
      return {
        name: "battery-half",
        color: "#f59e0b", // Yellow/Orange
        iconSet: "Ionicons",
      };
    } else if (level <= 80) {
      return {
        name: "battery-three-quarters",
        color: "#10b981", // Green
        iconSet: "FontAwesome5",
      };
    } else {
      return {
        name: "battery-full",
        color: "#10b981", // Green
        iconSet: "Ionicons",
      };
    }
  };

  // Get the appropriate icon based on battery level
  const batteryIcon = getBatteryIcon();
  const iconSize = getIconSize();

  // Determine text color based on battery level
  const getTextColor = () => {
    if (level <= 20) {
      return "#ef4444"; // Red
    } else if (level <= 50) {
      return "#f59e0b"; // Yellow/Orange
    } else {
      return textColor;
    }
  };

  return (
    <View style={styles.container}>
      {batteryIcon.iconSet === "FontAwesome5" ? (
        <FontAwesome5
          name={batteryIcon.name as any}
          size={iconSize}
          color={batteryIcon.color}
        />
      ) : (
        <Ionicons
          name={batteryIcon.name as any}
          size={iconSize}
          color={batteryIcon.color}
        />
      )}
      {showText && (
        <Text style={[styles.text, { color: getTextColor() }]}>
          {`${level}%`}
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
  text: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
});

export default BatteryLevelIndicator; 