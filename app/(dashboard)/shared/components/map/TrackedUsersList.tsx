import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '../../../../hooks/useColorScheme';
import { TrackingUser, TrackingStatus } from '../../../../types/liveTracking';

interface TrackedUsersListProps {
  users: TrackingUser[];
  selectedUserId?: string;
  onUserSelect: (user: TrackingUser) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  trackingStatus: TrackingStatus;
  compact?: boolean;
  showHeader?: boolean;
  hideOfflineUsers?: boolean;
  emptyMessage?: string;
  helpContent?: React.ReactNode;
}

const TrackedUsersList: React.FC<TrackedUsersListProps> = ({
  users,
  selectedUserId,
  onUserSelect,
  onRefresh,
  isRefreshing = false,
  trackingStatus,
  compact = false,
  showHeader = true,
  hideOfflineUsers = false,
  emptyMessage = "No users available",
  helpContent,
}) => {
  // Theme hooks for consistent styling
  const backgroundColor = useThemeColor("#ffffff", "#121212");
  const textColor = useThemeColor("#333333", "#ffffff");
  const primaryColor = useThemeColor("#3498db", "#5dabf0");
  const secondaryColor = useThemeColor("#2ecc71", "#4ade80");
  const inactiveColor = useThemeColor("#95a5a6", "#64748b");
  const selectedBackground = useThemeColor("#e3f2fd", "#1e293b");
  const borderColor = useThemeColor("#e0e0e0", "#2d3748");

  // Filtered users based on active status if hideOfflineUsers is true
  const filteredUsers = useMemo(() => {
    if (hideOfflineUsers) {
      return users.filter((user) => user.isActive);
    }
    return users;
  }, [users, hideOfflineUsers]);

  // Sort users: active first, then by name
  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      // Active users first
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;

      // Then sort by name
      return a.name.localeCompare(b.name);
    });
  }, [filteredUsers]);

  // Function to format the last updated time
  const formatLastUpdated = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    // Less than a minute
    if (diff < 60000) {
      return "Just now";
    }

    // Less than an hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }

    // Less than a day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }

    // More than a day
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  };

  // Function to get color based on battery level
  const getBatteryColor = (level?: number) => {
    if (level === undefined) return inactiveColor;

    if (level < 20) {
      return "#e74c3c"; // Red for low battery
    } else if (level < 50) {
      return "#f39c12"; // Orange/yellow for medium battery
    } else {
      return "#2ecc71"; // Green for good battery
    }
  };

  // Render each item in the list
  const renderItem = ({ item }: { item: TrackingUser }) => {
    const isSelected = item.id === selectedUserId;
    const batteryColor = getBatteryColor(item.batteryLevel);

    return (
      <TouchableOpacity
        style={[
          styles.userItem,
          {
            backgroundColor: isSelected ? selectedBackground : backgroundColor,
          },
          compact ? styles.userItemCompact : null,
          { borderColor },
        ]}
        onPress={() => onUserSelect(item)}
        activeOpacity={0.7}
      >
        {/* Status indicator */}
        <View
          style={[
            styles.statusDot,
            { backgroundColor: item.isActive ? secondaryColor : inactiveColor },
          ]}
        />

        <View style={styles.userDetails}>
          {/* User name and info */}
          <View style={styles.nameContainer}>
            <Text
              style={[
                styles.userName,
                { color: textColor },
                compact ? styles.userNameCompact : null,
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>

            {!compact && (
              <Text
                style={[styles.userInfo, { color: inactiveColor }]}
                numberOfLines={1}
              >
                {item.deviceInfo || "Unknown device"}
              </Text>
            )}
          </View>

          {/* Last updated */}
          {!compact && (
            <Text style={[styles.timestamp, { color: inactiveColor }]}>
              {formatLastUpdated(item.lastUpdated)}
            </Text>
          )}

          {/* Battery indicator */}
          {item.batteryLevel !== undefined && (
            <View style={styles.batteryContainer}>
              <Ionicons
                name={item.batteryLevel < 20 ? "battery-dead" : "battery-full"}
                size={compact ? 14 : 16}
                color={batteryColor}
              />
              {!compact && (
                <Text style={[styles.batteryText, { color: batteryColor }]}>
                  {item.batteryLevel}%
                </Text>
              )}
            </View>
          )}

          {/* Selected indicator */}
          {isSelected && (
            <View
              style={[
                styles.selectedIndicator,
                { backgroundColor: primaryColor },
              ]}
            >
              <Ionicons name="checkmark" size={12} color="#fff" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // List header component
  const ListHeader = () => {
    if (!showHeader) return null;

    return (
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>
          Tracked Users ({filteredUsers.length})
        </Text>

        {trackingStatus === TrackingStatus.ACTIVE ? (
          <View
            style={[styles.statusPill, { backgroundColor: secondaryColor }]}
          >
            <Text style={styles.statusText}>ACTIVE</Text>
          </View>
        ) : trackingStatus === TrackingStatus.PAUSED ? (
          <View style={[styles.statusPill, { backgroundColor: "#f39c12" }]}>
            <Text style={styles.statusText}>PAUSED</Text>
          </View>
        ) : trackingStatus === TrackingStatus.ERROR ? (
          <View style={[styles.statusPill, { backgroundColor: "#e74c3c" }]}>
            <Text style={styles.statusText}>ERROR</Text>
          </View>
        ) : (
          <View style={[styles.statusPill, { backgroundColor: inactiveColor }]}>
            <Text style={styles.statusText}>INACTIVE</Text>
          </View>
        )}
      </View>
    );
  };

  // Empty list component
  const EmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people" size={48} color={inactiveColor} />
      <Text style={[styles.emptyText, { color: textColor }]}>
        {emptyMessage}
      </Text>
      {helpContent ? (
        helpContent
      ) : (
        <Text style={[styles.emptySubtext, { color: inactiveColor }]}>
          {trackingStatus === TrackingStatus.ACTIVE
            ? "Waiting for users to connect..."
            : "Start tracking to see users"}
        </Text>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <FlatList
        data={sortedUsers}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyList}
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        contentContainerStyle={
          sortedUsers.length === 0 ? styles.fullHeight : null
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  fullHeight: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  userItemCompact: {
    padding: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
  },
  userNameCompact: {
    fontSize: 14,
  },
  userInfo: {
    fontSize: 12,
    marginTop: 2,
  },
  timestamp: {
    fontSize: 12,
    marginRight: 12,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  batteryText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  selectedIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default React.memo(TrackedUsersList);