import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Switch,
  TextInput,
  Platform,
  StatusBar,
  FlatList,
  RefreshControl
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../../context/AuthContext';
import { useColorScheme, useThemeColor } from '../../../hooks/useColorScheme';
import { useSocket } from '../../../hooks/useSocket';
import { TrackingPrecision } from '../../../types/liveTracking';
import axios from 'axios';

interface EmployeeTrackingSettings {
  id: number;
  user_id: number;
  user_name: string;
  can_override_geofence: boolean;
  tracking_precision: TrackingPrecision;
  updated_at: string;
}

export default function EmployeeTrackingSettingsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { user, token } = useAuth();
  const backgroundColor = useThemeColor('#f8fafc', '#0f172a');
  const textColor = useThemeColor('#334155', '#e2e8f0');
  const cardColor = useThemeColor('#ffffff', '#1e293b');
  const borderColor = useThemeColor('rgba(0, 0, 0, 0.1)', 'rgba(255, 255, 255, 0.1)');
  const primaryColor = useThemeColor('#3b82f6', '#60a5fa');

  const [employees, setEmployees] = useState<EmployeeTrackingSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { socket } = useSocket();

  // Fetch employees on mount
  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-tracking/employees`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      Alert.alert('Error', 'Failed to fetch employee tracking settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateEmployeeSettings = async (userId: number, field: keyof EmployeeTrackingSettings, value: any) => {
    try {
      setSaving(true);
      
      // Find the current employee to get the other field values
      const currentEmployee = employees.find(e => e.user_id === userId);
      if (!currentEmployee) {
        throw new Error('Employee not found');
      }
      
      // Create a payload with both required fields
      const payload: {
        user_id: number,
        can_override_geofence?: boolean,
        tracking_precision?: TrackingPrecision
      } = {
        user_id: userId
      };
      
      // Set the field that's being updated
      if (field === 'can_override_geofence') {
        payload.can_override_geofence = value;
        payload.tracking_precision = currentEmployee.tracking_precision;
      } else if (field === 'tracking_precision') {
        payload.tracking_precision = value;
        payload.can_override_geofence = currentEmployee.can_override_geofence;
      }
      
      await axios.put(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-tracking/employee-settings`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Update local state
      setEmployees(prev => prev.map(e => 
        e.user_id === userId ? { ...e, [field]: value } : e
      ));

      // Notify user via socket
      socket?.emit('employee_tracking_settings_updated', { userId, field, value });
    } catch (error) {
      console.error('Error updating employee settings:', error);
      Alert.alert('Error', 'Failed to update employee tracking settings');
    } finally {
      setSaving(false);
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.user_id.toString().includes(searchQuery)
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchEmployees();
  };

  const renderEmployeeItem = ({ item }: { item: EmployeeTrackingSettings }) => (
    <View style={[styles.employeeCard, { backgroundColor: cardColor, borderColor }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.employeeName, { color: textColor }]}>
          {item.user_name}
        </Text>
        <Text style={[styles.employeeId, { color: textColor }]}>
          ID: {item.user_id}
        </Text>
      </View>

      <View style={styles.settingsRow}>
        <Text style={[styles.settingLabel, { color: textColor }]}>
          Can Override Geofence
        </Text>
        <Switch
          value={item.can_override_geofence}
          onValueChange={(value) => updateEmployeeSettings(item.user_id, 'can_override_geofence', value)}
          disabled={saving}
          trackColor={{ false: borderColor, true: primaryColor }}
          thumbColor={item.can_override_geofence ? '#ffffff' : '#f3f4f6'}
        />
      </View>

      <View style={styles.settingsRow}>
        <Text style={[styles.settingLabel, { color: textColor }]}>
          Tracking Precision
        </Text>
        <View style={styles.precisionButtons}>
          {(['low', 'medium', 'high'] as TrackingPrecision[]).map(precision => (
            <TouchableOpacity
              key={precision}
              style={[
                styles.precisionButton,
                item.tracking_precision === precision && styles.precisionButtonActive,
                { borderColor }
              ]}
              onPress={() => updateEmployeeSettings(item.user_id, 'tracking_precision', precision)}
              disabled={saving}
            >
              <Text style={[
                styles.precisionButtonText,
                { color: textColor },
                item.tracking_precision === precision && styles.precisionButtonTextActive
              ]}>
                {precision.charAt(0).toUpperCase() + precision.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={[styles.updatedAt, { color: textColor }]}>
        Last updated: {new Date(item.updated_at).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen 
        options={{
          title: 'Employee Tracking Settings',
          headerStyle: {
            backgroundColor: cardColor,
          },
          headerTintColor: textColor,
        }}
      />
      <ExpoStatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <>
          <View style={[styles.searchContainer, { backgroundColor: cardColor, borderColor }]}>
            <Ionicons name="search" size={20} color={textColor} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: textColor }]}
              placeholder="Search by name or ID..."
              placeholderTextColor={textColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={filteredEmployees}
            renderItem={renderEmployeeItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={textColor}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: textColor }]}>
                  No employees found
                </Text>
              </View>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  employeeCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  employeeName: {
    fontSize: 18,
    fontWeight: '600',
  },
  employeeId: {
    fontSize: 14,
    opacity: 0.7,
  },
  settingsRow: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  precisionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  precisionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  precisionButtonActive: {
    backgroundColor: '#3b82f6',
  },
  precisionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  precisionButtonTextActive: {
    color: '#ffffff',
  },
  updatedAt: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
}); 