import React, { useCallback, useEffect, useRef, useState, memo } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import MapView, { 
  Marker, 
  Region, 
  MapViewProps as RNMapViewProps,
  PROVIDER_GOOGLE,
  LatLng
} from 'react-native-maps';
import { MapRegion } from '../../../../types/liveTracking';
import { useColorScheme } from '../../../../hooks/useColorScheme';

const DEFAULT_DELTA = {
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const DEFAULT_LOCATION = {
  latitude: 37.78825,
  longitude: -122.4324,
};

interface LocationMapProps extends Omit<RNMapViewProps, 'initialRegion'> {
  initialRegion?: MapRegion | null;
  showsUserLocation?: boolean;
  followsUserLocation?: boolean;
  zoomLevel?: number;
  onRegionChange?: (region: Region) => void;
  onMapPress?: (coordinate: LatLng) => void;
  mapStyle?: 'standard' | 'satellite' | 'hybrid' | 'terrain';
  isInteractive?: boolean;
  testID?: string;
}

const LocationMapView: React.FC<LocationMapProps> = ({
  initialRegion,
  showsUserLocation = true,
  followsUserLocation = false,
  zoomLevel = 15,
  onRegionChange,
  onMapPress,
  mapStyle = 'standard',
  isInteractive = true,
  testID = 'location-map',
  ...props
}) => {
  const mapRef = useRef<MapView | null>(null);
  const [currentRegion, setCurrentRegion] = useState<Region>({
    ...DEFAULT_LOCATION,
    ...DEFAULT_DELTA,
    ...(initialRegion || {})
  });
  
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  // Custom map style for dark mode
  const darkMapStyle = [
    {
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#212121"
        }
      ]
    },
    {
      "elementType": "labels.icon",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#757575"
        }
      ]
    },
    {
      "elementType": "labels.text.stroke",
      "stylers": [
        {
          "color": "#212121"
        }
      ]
    },
    {
      "featureType": "administrative",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#757575"
        }
      ]
    },
    {
      "featureType": "administrative.country",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#9e9e9e"
        }
      ]
    },
    {
      "featureType": "administrative.land_parcel",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "administrative.locality",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#bdbdbd"
        }
      ]
    },
    {
      "featureType": "poi",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#757575"
        }
      ]
    },
    {
      "featureType": "poi.park",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#181818"
        }
      ]
    },
    {
      "featureType": "poi.park",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#616161"
        }
      ]
    },
    {
      "featureType": "poi.park",
      "elementType": "labels.text.stroke",
      "stylers": [
        {
          "color": "#1b1b1b"
        }
      ]
    },
    {
      "featureType": "road",
      "elementType": "geometry.fill",
      "stylers": [
        {
          "color": "#2c2c2c"
        }
      ]
    },
    {
      "featureType": "road",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#8a8a8a"
        }
      ]
    },
    {
      "featureType": "road.arterial",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#373737"
        }
      ]
    },
    {
      "featureType": "road.highway",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#3c3c3c"
        }
      ]
    },
    {
      "featureType": "road.highway.controlled_access",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#4e4e4e"
        }
      ]
    },
    {
      "featureType": "road.local",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#616161"
        }
      ]
    },
    {
      "featureType": "transit",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#757575"
        }
      ]
    },
    {
      "featureType": "water",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#000000"
        }
      ]
    },
    {
      "featureType": "water",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#3d3d3d"
        }
      ]
    }
  ];

  // Update region when initialRegion changes
  useEffect(() => {
    if (initialRegion) {
      const newRegion = {
        ...DEFAULT_DELTA,
        ...initialRegion
      };
      
      setCurrentRegion(newRegion);
      
      // Animate to the new region if the map is ready
      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 500);
      }
    }
  }, [initialRegion]);

  // Handle map region change
  const handleRegionChange = useCallback((region: Region) => {
    setCurrentRegion(region);
    onRegionChange?.(region);
  }, [onRegionChange]);

  // Memoize region prop to prevent re-renders
  const regionProp = useCallback(() => currentRegion, [currentRegion]);

  // Handle map press
  const handleMapPress = useCallback((event: any) => {
    onMapPress?.(event.nativeEvent.coordinate);
  }, [onMapPress]);

  // Zoom level calculations
  useEffect(() => {
    if (zoomLevel && mapRef.current) {
      const newDelta = {
        latitudeDelta: 0.0922 / Math.pow(2, zoomLevel - 10),
        longitudeDelta: 0.0421 / Math.pow(2, zoomLevel - 10)
      };
      
      const newRegion = {
        ...currentRegion,
        ...newDelta
      };
      
      setCurrentRegion(newRegion);
      mapRef.current.animateToRegion(newRegion, 500);
    }
  }, [zoomLevel]);

  return (
    <View style={styles.container} testID={testID}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={currentRegion}
        showsUserLocation={showsUserLocation}
        followsUserLocation={followsUserLocation}
        onRegionChangeComplete={handleRegionChange}
        onPress={isInteractive ? handleMapPress : undefined}
        scrollEnabled={isInteractive}
        zoomEnabled={isInteractive}
        pitchEnabled={isInteractive}
        rotateEnabled={isInteractive}
        mapType={mapStyle}
        customMapStyle={isDarkMode ? darkMapStyle : undefined}
        showsCompass={true}
        showsScale={true}
        showsMyLocationButton={showsUserLocation}
        maxZoomLevel={20}
        minZoomLevel={3}
        loadingEnabled={true}
        {...props}
      >
        {props.children}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  map: {
    width: '100%',
    height: '100%',
  },
});

// Apply memo to prevent unnecessary re-renders
export default memo(LocationMapView); 