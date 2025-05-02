import React, { useState } from 'react';
import "./../app/utils/backgroundLocationTask";
import { View, Text, TouchableOpacity, Animated, Image, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import ThemeContext from './context/ThemeContext';
import { useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PermissionsModal from './components/PermissionsModal';

export default function Welcome() {
    const router = useRouter();
    const { theme } = ThemeContext.useTheme();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;
    const [showPermissionsModal, setShowPermissionsModal] = useState(false);

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
    }, []);

    const handleGetStarted = async () => {
        // Check if permissions have been requested before
        try {
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
                    </Animated.View>

                    {/* Bottom Section */}
                    <Animated.View style={{
                        width: '100%',
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }]
                    }}>
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
                            Powered by Loginware.ai
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