import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import ThemeContext from '../context/ThemeContext';
import AuthContext from '../context/AuthContext';
import PermissionsModal from '../components/PermissionsModal';
import PermissionsManager from '../utils/permissionsManager';

export default function DashboardLayout() {
  const { theme } = ThemeContext.useTheme();
  const { user, token } = AuthContext.useAuth();
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  // Check if we need to show permissions modal for authenticated users
  useEffect(() => {
    const checkPermissions = async () => {
      if (!user) return;

      try {
        // Check if permissions have been requested before
        const permissionsRequested = await PermissionsManager.havePermissionsBeenRequested();
        
        if (!permissionsRequested) {
          // If permissions haven't been requested yet, show the modal
          setShowPermissionsModal(true);
        } else {
          // Permissions were requested before, now check if notification permission was granted
          // If granted, set up notification services
          const notificationStatus = await PermissionsManager.checkNotificationPermissions();
          if (notificationStatus === 'granted') {
            await PermissionsManager.setupNotificationChannel();
          }
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
      }
    };

    checkPermissions();
  }, [user]);

  const handlePermissionsClose = () => {
    setShowPermissionsModal(false);
  };

  return (
    <>
      <Stack 
        screenOptions={{ 
          headerShown: false,
          contentStyle: {
            backgroundColor: theme === 'dark' ? '#111827' : '#ffffff'
          },
          animation: 'fade'
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="employee" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Group-Admin" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="management" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="super-admin" 
          options={{ headerShown: false }} 
        />
        
        <Stack.Screen 
          name="management/group-admin-management" 
          options={{
            headerShown: true,
            title: 'Group Admin Management',
            headerTintColor: theme === 'dark' ? '#F9FAFB' : '#111827',
            headerStyle: {
              backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
            },
            headerShadowVisible: false,
            presentation: 'modal',
            animation: 'slide_from_right'
          }}
        />
      </Stack>

      {/* Permissions Modal for authenticated users */}
      <PermissionsModal
        visible={showPermissionsModal}
        onClose={handlePermissionsClose}
        userId={user?.id || undefined}
        token={token || undefined}
        userRole={user?.role || undefined}
      />
    </>
  );
}