import React, { useState, useRef, useEffect } from 'react';
import "./../app/utils/backgroundLocationTask";
import { View, Text, TouchableOpacity, Animated, Image, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import ThemeContext from './context/ThemeContext';
import AuthContext from './context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PermissionsModal from './components/PermissionsModal';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';

export default function Welcome() {
    const router = useRouter();
    const { theme } = ThemeContext.useTheme();
    const { isOffline } = AuthContext.useAuth();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;
    const [showPermissionsModal, setShowPermissionsModal] = useState(false);
    const [networkState, setNetworkState] = useState<{isConnected: boolean, isInternetReachable: boolean | null}>({
        isConnected: true,
        isInternetReachable: true
    });
    const offlineBadgeFadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 1200,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true,
            }),
        ]).start();
        
        // Check network connectivity
        checkNetworkStatus();
        
        // Animate offline badge if in offline mode
        if (isOffline) {
            Animated.timing(offlineBadgeFadeAnim, {
                toValue: 1,
                duration: 500,
                delay: 1000,
                useNativeDriver: true,
            }).start();
        }
    }, [isOffline]);
    
    const checkNetworkStatus = async () => {
        try {
            const status = await Network.getNetworkStateAsync();
            setNetworkState({
                isConnected: status.isConnected === true,
                isInternetReachable: status.isInternetReachable ?? null
            });
        } catch (error) {
            console.error('Failed to check network status:', error);
            // Default to assuming there's connectivity if we can't check
            setNetworkState({ isConnected: true, isInternetReachable: true });
        }
    };

    const handleGetStarted = async () => {
        // Check if permissions have been requested before
        try {
            // Check network connectivity first
            await checkNetworkStatus();
            
            const permissionsRequested = await AsyncStorage.getItem('permissionsRequested');
            if (permissionsRequested === 'true') {
                // If permissions were already requested before, skip to sign in
                router.push('/(auth)/signin');
            } else {
                // Show the permissions modal
                setShowPermissionsModal(true);
            }
        } catch (error) {
            console.error('Error checking permissions status:', error);
            // Default to showing the modal if there's an error
            setShowPermissionsModal(true);
        }
    };

    const handlePermissionsClose = () => {
        setShowPermissionsModal(false);
        // Navigate to sign in after permissions handling
        router.push('/(auth)/signin');
    };

    const isDark = theme === 'dark';

    return (
        <>
            <StatusBar 
                barStyle={isDark ? "light-content" : "dark-content"}
                backgroundColor={isDark ? '#1E293B' : '#EEF2FF'}
            />
            <LinearGradient
                colors={isDark ? 
                    ['#1E293B', '#0F172A'] : 
                    ['#EEF2FF', '#E0E7FF']}
                style={{ flex: 1 }}
            >
                <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    opacity: 0.4,
                    backgroundColor: 'transparent',
                    borderStyle: 'solid',
                    borderWidth: 1.5,
                    borderColor: isDark ? '#3B82F6' : '#6366F1',
                    borderRadius: 20,
                    transform: [{ scale: 1.5 }, { rotate: '45deg' }],
                }} />
                <View style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 64,
                    paddingHorizontal: 24,
                }}>
                    {/* Top Section */}
                    <Animated.View style={{
                        alignItems: 'center',
                        opacity: fadeAnim,
                        transform: [
                            { translateY: slideAnim },
                            { scale: scaleAnim }
                        ]
                    }}>
                        <View style={{
                            width: 200,
                            height: 200,
                            borderRadius: 100,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 24,
                            padding: 3,
                            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                            borderWidth: 2,
                            borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(99, 102, 241, 0.3)',
                            shadowColor: isDark ? '#3B82F6' : '#6366F1',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.2,
                            shadowRadius: 8,
                            elevation: 8,
                        }}>
                            <View style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: 100,
                                overflow: 'hidden',
                                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.05)' : 'rgba(99, 102, 241, 0.05)',
                            }}>
                                <Image 
                                    source={require('../assets/images/icon.png')}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                    }}
                                    resizeMode="cover"
                                />
                            </View>
                        </View>
                        <Text style={{
                            fontSize: 36,
                            fontWeight: 'bold',
                            marginBottom: 12,
                            color: isDark ? '#ffffff' : '#1F2937',
                            textShadowColor: 'rgba(0, 0, 0, 0.1)',
                            textShadowOffset: { width: 0, height: 2 },
                            textShadowRadius: 4
                        }}>
                            Parrot Analyzer
                        </Text>
                        <Text style={{
                            textAlign: 'center',
                            fontSize: 20,
                            color: isDark ? '#D1D5DB' : '#4B5563',
                            marginBottom: 16,
                            letterSpacing: 0.5
                        }}>
                            Streamline Employee Tracking & Reporting
                        </Text>                        
                        {/* Offline indicator */}
                        {isOffline && (
                            <Animated.View 
                                style={{
                                    opacity: offlineBadgeFadeAnim,
                                    marginTop: 8,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 12,
                                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                                    borderWidth: 1,
                                    borderColor: isDark ? 'rgba(239, 68, 68, 0.5)' : 'rgba(239, 68, 68, 0.3)',
                                }}
                            >
                                <Ionicons 
                                    name="cloud-offline-outline" 
                                    size={18} 
                                    color={isDark ? '#FCA5A5' : '#DC2626'}
                                />
                                <Text
                                    style={{
                                        color: isDark ? '#FCA5A5' : '#DC2626',
                                        fontSize: 14,
                                        fontWeight: '600',
                                        marginLeft: 6,
                                    }}
                                >
                                    Offline Mode
                                </Text>
                            </Animated.View>
                        )}
                    </Animated.View>

                    {/* Bottom Section */}
                    <Animated.View style={{
                        width: '100%',
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }]
                    }}>
                        {/* Network status indicator */}
                        {(!networkState.isConnected || networkState.isInternetReachable === false) && (
                            <View style={{
                                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(254, 202, 202, 0.8)',
                                padding: 12,
                                borderRadius: 8,
                                marginBottom: 16,
                                flexDirection: 'row',
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(220, 38, 38, 0.3)',
                            }}>
                                <Ionicons 
                                    name="wifi-outline" 
                                    size={20} 
                                    color={isDark ? '#FCA5A5' : '#DC2626'}
                                    style={{ marginRight: 8 }}
                                />
                                <Text style={{
                                    fontSize: 14,
                                    color: isDark ? '#FCA5A5' : '#B91C1C',
                                    flex: 1,
                                }}>
                                    No internet connection. Some features may be limited.
                                </Text>
                            </View>
                        )}
                    
                        <TouchableOpacity
                            style={{
                                backgroundColor: isDark ? '#3B82F6' : '#6366F1',
                                paddingVertical: 18,
                                paddingHorizontal: 32,
                                borderRadius: 16,
                                alignItems: 'center',
                                shadowColor: isDark ? '#3B82F6' : '#6366F1',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 8,
                            }}
                            onPress={handleGetStarted}
                        >
                            <Text style={{
                                color: '#ffffff',
                                fontSize: 20,
                                fontWeight: 'bold',
                                letterSpacing: 0.5
                            }}>
                                Get Started
                            </Text>
                        </TouchableOpacity>

                        <Text style={{
                            textAlign: 'center',
                            fontSize: 15,
                            color: isDark ? '#D1D5DB' : '#4B5563',
                            marginTop: 20,
                            letterSpacing: 0.5
                        }}>
                            Powered by Tecosoft.ai
                        </Text>
                    </Animated.View>
                </View>
            </LinearGradient>

            {/* Permissions Modal */}
            <PermissionsModal
                visible={showPermissionsModal}
                onClose={handlePermissionsClose}
            />
        </>
    );
}