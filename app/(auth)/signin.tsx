import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Animated, Keyboard, Image, StatusBar, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import ThemeContext from '../context/ThemeContext';
import AuthContext from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

export default function SignIn() {
    const { theme } = ThemeContext.useTheme();
    const { login, isLoading } = AuthContext.useAuth();
    const router = useRouter();

    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<{ message: string; type: string } | null>(null);
    const [isValidIdentifier, setIsValidIdentifier] = useState(false);
    const [identifierType, setIdentifierType] = useState<'email' | 'phone' | null>(null);

    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const inputFocusAnim = useRef(new Animated.Value(0)).current;

    // Validation functions
    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePhone = (phone: string) => {
        const phoneRegex = /^(\+91)?[0-9]{10}$/;
        return phoneRegex.test(phone);
    };

    const handleIdentifierChange = (text: string) => {
        let formattedText = text;
        if (/^\d+$/.test(text.replace('+91', ''))) {
            // Phone number input
            setIdentifierType('phone');
            if (!text.startsWith('+91')) {
                formattedText = '+91' + text;
            }
            setIsValidIdentifier(validatePhone(formattedText));
        } else {
            // Email input
            setIdentifierType('email');
            setIsValidIdentifier(validateEmail(text));
        }
        setIdentifier(formattedText);
        setError(null);
    };

    const handleSignIn = async () => {
        setError(null);
        Keyboard.dismiss();

        if (!identifier || !password) {
          setError({
            message: "Please enter both email/phone and password",
            type: "VALIDATION",
          });
          return;
        }

        try {
          const result = await login(identifier, password);

          if (result.error) {
            setError({
              message: result.error,
              type: result.errorType || "UNKNOWN",
            });

            // For critical errors, you might want to show an alert
            if (result.errorType === "COMPANY_DISABLED") {
              Alert.alert("Account Disabled", result.error, [{ text: "OK" }]);
            }
          }
        } catch (error) {
          console.error("Sign in error:", error);
          setError({
            message: "An unexpected error occurred. Please try again.",
            type: "UNKNOWN",
          });
        }
    };

    // Mount animation
    useState(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }),
        ]).start();
    });

    return (
        <>
            <StatusBar
                barStyle={theme === 'dark' ? "light-content" : "dark-content"}
                backgroundColor={theme === 'dark' ? '#1E293B' : '#EEF2FF'}
            />
            <TouchableOpacity
                activeOpacity={1}
                onPress={Keyboard.dismiss}
                style={{
                    flex: 1,
                    backgroundColor: theme === 'dark' ? '#1E293B' : '#EEF2FF',
                }}
            >
                <LinearGradient
                    colors={theme === 'dark' ?
                        ['#1E293B', '#0F172A'] :
                        ['#EEF2FF', '#E0E7FF']}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        contentContainerStyle={{ flexGrow: 1 }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <Animated.View
                            style={{
                                flex: 1,
                                padding: 24,
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            }}
                        >
                            {/* Logo Section */}
                            <View style={{
                                alignItems: 'center',
                                marginTop: 60,
                                marginBottom: 40,
                            }}>
                                <View style={{
                                    width: 120,
                                    height: 120,
                                    borderRadius: 60,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 24,
                                    padding: 3,
                                    backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                    borderWidth: 2,
                                    borderColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(99, 102, 241, 0.3)',
                                    shadowColor: theme === 'dark' ? '#3B82F6' : '#6366F1',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 8,
                                    elevation: 8,
                                }}>
                                    <View style={{
                                        width: '100%',
                                        height: '100%',
                                        borderRadius: 60,
                                        overflow: 'hidden',
                                        backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.05)' : 'rgba(99, 102, 241, 0.05)',
                                    }}>
                                        <Image
                                            source={require('../../assets/images/icon.png')}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                            }}
                                            resizeMode="cover"
                                        />
                                    </View>
                                </View>
                                <Text style={{
                                    fontSize: 28,
                                    fontWeight: 'bold',
                                    color: theme === 'dark' ? '#ffffff' : '#1F2937',
                                    marginBottom: 8,
                                    textShadowColor: 'rgba(0, 0, 0, 0.1)',
                                    textShadowOffset: { width: 0, height: 2 },
                                    textShadowRadius: 4
                                }}>
                                    Welcome Back
                                </Text>
                                <Text style={{
                                    fontSize: 16,
                                    color: theme === 'dark' ? '#D1D5DB' : '#4B5563',
                                    textAlign: 'center',
                                    letterSpacing: 0.5,
                                }}>
                                    Sign in to continue to Parrot Analyzer
                                </Text>
                            </View>

                            {/* Form Section */}
                            <Animated.View style={{
                                transform: [{ translateX: inputFocusAnim }]
                            }}>
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{
                                        marginBottom: 8,
                                        color: theme === 'dark' ? '#D1D5DB' : '#4B5563',
                                        fontSize: 14,
                                    }}>
                                        Email or Phone Number
                                    </Text>
                                    <TextInput
                                        value={identifier}
                                        onChangeText={handleIdentifierChange}
                                        keyboardType={identifierType === 'phone' ? 'phone-pad' : 'email-address'}
                                        autoCapitalize="none"
                                        style={{
                                            backgroundColor: theme === 'dark' ? '#1F2937' : '#F3F4F6',
                                            padding: 16,
                                            borderRadius: 12,
                                            color: theme === 'dark' ? '#ffffff' : '#1F2937',
                                            borderWidth: 2,
                                            borderColor: isValidIdentifier
                                                ? '#10B981'
                                                : identifier
                                                    ? '#EF4444'
                                                    : theme === 'dark' ? '#374151' : '#E5E7EB',
                                        }}
                                        placeholderTextColor={theme === 'dark' ? '#6B7280' : '#9CA3AF'}
                                        placeholder="Enter your email or phone"
                                    />
                                    {identifier && (
                                        <Text style={{
                                            marginTop: 4,
                                            fontSize: 12,
                                            color: isValidIdentifier ? '#10B981' : '#EF4444',
                                        }}>
                                            {isValidIdentifier
                                                ? `Valid ${identifierType}`
                                                : `Invalid ${identifierType}`}
                                        </Text>
                                    )}
                                </View>

                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{
                                        marginBottom: 8,
                                        color: theme === 'dark' ? '#D1D5DB' : '#4B5563',
                                        fontSize: 14,
                                    }}>
                                        Password
                                    </Text>
                                    <View style={{ position: 'relative' }}>
                                        <TextInput
                                            value={password}
                                            onChangeText={setPassword}
                                            secureTextEntry={!showPassword}
                                            style={{
                                                backgroundColor: theme === 'dark' ? '#1F2937' : '#F3F4F6',
                                                padding: 16,
                                                paddingRight: 48,
                                                borderRadius: 12,
                                                color: theme === 'dark' ? '#ffffff' : '#1F2937',
                                                borderWidth: 2,
                                                borderColor: theme === 'dark' ? '#374151' : '#E5E7EB',
                                            }}
                                            placeholderTextColor={theme === 'dark' ? '#6B7280' : '#9CA3AF'}
                                            placeholder="Enter your password"
                                        />
                                        <TouchableOpacity
                                            onPress={() => setShowPassword(!showPassword)}
                                            style={{
                                                position: 'absolute',
                                                right: 16,
                                                top: 16,
                                            }}
                                        >
                                            <Ionicons
                                                name={showPassword ? 'eye-off' : 'eye'}
                                                size={24}
                                                color={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    onPress={() => router.push('/(auth)/forgot-password')}
                                    style={{ alignSelf: 'flex-end', marginBottom: 24 }}
                                >
                                    <Text style={{
                                        color: '#3B82F6',
                                        fontSize: 14,
                                    }}>
                                        Forgot Password?
                                    </Text>
                                </TouchableOpacity>

                                {error && (
                                    <View style={[
                                        styles.errorContainer,
                                        error.type === 'COMPANY_DISABLED' ? styles.companyDisabledError : styles.generalError
                                    ]}>
                                        <Text style={styles.errorText}>{error.message}</Text>
                                        {error.type === 'COMPANY_DISABLED' && (
                                            <Text style={styles.errorSubText}>
                                                If you believe this is a mistake, please contact your administrator or support team.
                                            </Text>
                                        )}
                                    </View>
                                )}

                                <TouchableOpacity
                                    onPress={handleSignIn}
                                    disabled={isLoading}
                                    style={{
                                        backgroundColor: theme === 'dark' ? '#3B82F6' : '#6366F1',
                                        paddingVertical: 16,
                                        paddingHorizontal: 32,
                                        borderRadius: 16,
                                        opacity: isLoading ? 0.7 : 1,
                                        shadowColor: theme === 'dark' ? '#3B82F6' : '#6366F1',
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.3,
                                        shadowRadius: 8,
                                        elevation: 8,
                                    }}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text style={{
                                            color: '#ffffff',
                                            textAlign: 'center',
                                            fontSize: 18,
                                            fontWeight: 'bold',
                                            letterSpacing: 0.5,
                                        }}>
                                            Sign In
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </Animated.View>
                        </Animated.View>
                    </ScrollView>
                </LinearGradient>
            </TouchableOpacity>
        </>
    );
}

const styles = StyleSheet.create({
    errorContainer: {
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
        width: '100%',
    },
    generalError: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
        borderWidth: 1,
    },
    companyDisabledError: {
        backgroundColor: '#DC2626',
        borderColor: '#B91C1C',
        borderWidth: 1,
    },
    errorText: {
        color: '#991B1B',
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
    },
    errorSubText: {
        color: '#991B1B',
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
    },
});