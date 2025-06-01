import React, { memo } from 'react';
import { View, StyleSheet } from "react-native";
import { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "../../../../hooks/useColorScheme";
import { Location } from "../../../../types/liveTracking";

interface LocationMarkerProps {
  location: Location;
  title?: string;
  description?: string;
  color?: string;
  size?: number;
  isActive?: boolean;
  batteryLevel?: number;
  showBatteryIndicator?: boolean;
  showAccuracyCircle?: boolean;
  onPress?: () => void;
  zIndex?: number;
  isSelected?: boolean;
  trackedUserId?: string;
  employeeNumber?: string;
  employeeLabel?: string;
  deviceInfo?: string;
}

/**
 * Custom marker component for displaying user/employee locations
 */
const LocationMarker: React.FC<LocationMarkerProps> = ({
  location,
  title,
  description,
  color,
  size = 32,
  isActive = true,
  batteryLevel,
  showBatteryIndicator = false,
  showAccuracyCircle = false,
  onPress,
  zIndex = 1,
  isSelected = false,
  trackedUserId,
  employeeNumber,
  employeeLabel,
  deviceInfo,
}) => {
  // Theme colors
  const backgroundColor = useThemeColor("#ffffff", "#121212");
  const primaryColor = useThemeColor("#3498db", "#5dabf0");
  const selectedColor = useThemeColor("#f97316", "#f97316");

  // Marker color based on active status and provided color
  const markerColor = color || (isActive ? primaryColor : "#9ca3af");

  // Enhanced display name for the marker (for title when clicked)
  const displayName = employeeLabel || title || "";

  // Enhanced description with employee number and device info (for description when clicked)
  let enhancedDescription = description || "";
  if (employeeNumber) {
    enhancedDescription = enhancedDescription
      ? `${enhancedDescription}`
      : `ID: ${employeeNumber}`;
  }
  if (deviceInfo) {
    enhancedDescription = enhancedDescription
      ? `${deviceInfo} • ${enhancedDescription}`
      : deviceInfo;
  }

  return (
    <Marker
      coordinate={{
        latitude: location.latitude,
        longitude: location.longitude,
      }}
      title={displayName}
      description={enhancedDescription}
      onPress={onPress}
      tracksViewChanges={false}
      zIndex={zIndex}
    >
      <View style={styles.markerContainer}>
        {/* Main marker - slightly bigger */}
        <View
          style={[
            styles.marker,
            {
              width: size,
              height: size,
              backgroundColor: markerColor,
              borderColor: isSelected ? selectedColor : backgroundColor,
              borderWidth: isSelected ? 2 : 1,
            },
          ]}
        >
          <Ionicons
            name={isActive ? "location" : "location-outline"}
            size={size * 0.6}
            color={backgroundColor}
          />
        </View>
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  marker: {
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default memo(LocationMarker); 