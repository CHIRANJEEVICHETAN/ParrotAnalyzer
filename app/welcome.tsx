import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import ThemeContext from './context/ThemeContext';
import { useEffect, useRef } from 'react';

export default function Welcome() {
    const router = useRouter();
    const { theme } = ThemeContext.useTheme();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 1000,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <View
            style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 64,
                paddingHorizontal: 24,
                backgroundColor: theme === 'dark' ? '#111827' : '#ffffff'
            }}
        >
            {/* Top Section */}
            <Animated.View
                style={{
                    alignItems: 'center',
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                }}
            >
                <View style={{
                    width: 160,
                    height: 160,
                    backgroundColor: '#3B82F6',
                    borderRadius: 80,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 24
                }}>
                    <Text style={{ fontSize: 64 }}>🦜</Text>
                </View>
                <Text style={{
                    fontSize: 32,
                    fontWeight: 'bold',
                    marginBottom: 8,
                    color: theme === 'dark' ? '#ffffff' : '#1F2937'
                }}>
                    Parrot Analyzer
                </Text>
                <Text style={{
                    textAlign: 'center',
                    fontSize: 18,
                    color: theme === 'dark' ? '#D1D5DB' : '#4B5563',
                    marginBottom: 16
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
                        backgroundColor: '#3B82F6',
                        paddingVertical: 16,
                        paddingHorizontal: 32,
                        borderRadius: 12,
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: {
                            width: 0,
                            height: 2,
                        },
                        shadowOpacity: 0.25,
                        shadowRadius: 3.84,
                        elevation: 5,
                    }}
                    onPress={() => router.push('/(auth)/signin')}
                >
                    <Text style={{
                        color: '#ffffff',
                        fontSize: 18,
                        fontWeight: 'bold'
                    }}>
                        Get Started
                    </Text>
                </TouchableOpacity>

                <Text
                    style={{
                        textAlign: 'center',
                        fontSize: 14,
                        color: theme === 'dark' ? '#D1D5DB' : '#4B5563',
                        marginTop: 16
                    }}
                >
                    Powered by Loginware.ai
                </Text>
            </Animated.View>
        </View>
    );
}