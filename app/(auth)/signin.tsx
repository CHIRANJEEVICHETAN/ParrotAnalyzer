import { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Animated, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import ThemeContext from '../context/ThemeContext';
import AuthContext from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function SignIn() {
    const { theme } = ThemeContext.useTheme();
    const { login, isLoading } = AuthContext.useAuth();
    const router = useRouter();

    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
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
        setError('');
    };

    const handleSignIn = async () => {
        setError('');
        
        if (!identifier || !password) {
            setError('Please fill in all fields');
            return;
        }

        try {
            console.log('Attempting signin with:', { identifier });
            await login(identifier, password);
            console.log('Login successful');
        } catch (err: any) {
            console.error('Login error in signin:', err);
            let errorMessage = 'An error occurred during login';
            
            // Handle specific error cases
            if (err.response?.status === 401) {
                errorMessage = 'Invalid credentials. Please check your email/phone and password';
            } else if (err.response?.status === 404) {
                errorMessage = 'User not found. Please check your email/phone';
            } else if (err.response?.status === 403) {
                errorMessage = 'Account is locked. Please contact support';
            } else if (err.message) {
                errorMessage = err.message;
            }

            setError(errorMessage);
            
            // Shake animation for error feedback
            Animated.sequence([
                Animated.timing(inputFocusAnim, {
                    toValue: 10,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(inputFocusAnim, {
                    toValue: -10,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(inputFocusAnim, {
                    toValue: 0,
                    duration: 100,
                    useNativeDriver: true,
                }),
            ]).start();
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
        <TouchableOpacity 
            activeOpacity={1} 
            onPress={Keyboard.dismiss}
            style={{
                flex: 1,
                backgroundColor: theme === 'dark' ? '#111827' : '#ffffff',
            }}
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
                        width: 80,
                        height: 80,
                        backgroundColor: '#3B82F6',
                        borderRadius: 40,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 3.84,
                        elevation: 5,
                    }}>
                        <Text style={{ fontSize: 40 }}>🦜</Text>
                    </View>
                    <Text style={{
                        fontSize: 24,
                        fontWeight: 'bold',
                        color: theme === 'dark' ? '#ffffff' : '#1F2937',
                        marginBottom: 8,
                    }}>
                        Welcome Back
                    </Text>
                    <Text style={{
                        fontSize: 16,
                        color: theme === 'dark' ? '#9CA3AF' : '#6B7280',
                        textAlign: 'center',
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

                    {error ? (
                        <Animated.View 
                            style={{
                                transform: [{ translateX: inputFocusAnim }],
                                backgroundColor: theme === 'dark' ? '#991B1B' : '#FEE2E2',
                                padding: 12,
                                borderRadius: 8,
                                marginBottom: 16,
                            }}
                        >
                            <Text style={{
                                color: theme === 'dark' ? '#FCA5A5' : '#991B1B',
                                textAlign: 'center',
                            }}>
                                {error}
                            </Text>
                        </Animated.View>
                    ) : null}

                    <TouchableOpacity
                        onPress={handleSignIn}
                        disabled={isLoading}
                        style={{
                            backgroundColor: '#3B82F6',
                            padding: 16,
                            borderRadius: 12,
                            opacity: isLoading ? 0.7 : 1,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 3.84,
                            elevation: 5,
                        }}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={{
                                color: '#ffffff',
                                textAlign: 'center',
                                fontSize: 16,
                                fontWeight: 'bold',
                            }}>
                                Sign In
                            </Text>
                        )}
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>
        </TouchableOpacity>
    );
}