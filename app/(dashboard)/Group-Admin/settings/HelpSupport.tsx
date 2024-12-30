import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, StatusBar, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

type HelpSection = {
    title: string;
    icon: string;
    items: HelpItem[];
};

type HelpItem = {
    question: string;
    answer: string;
    subPoints?: string[];
};

const helpSections: HelpSection[] = [
    {
        title: 'Common Issues and Solutions',
        icon: 'help-circle',
        items: [
            {
                question: 'How to Approve or Reject an Expense?',
                answer: 'Navigate to the Expense Approval Page in your admin dashboard.',
                subPoints: [
                    'Review the submitted expense details and attached receipt',
                    'Click Approve or Reject, adding a comment if needed',
                    'The employee will be notified automatically'
                ]
            },
            {
                question: 'What to Do If a Receipt Is Missing?',
                answer: 'Reject the expense and include a comment asking the employee to re-submit with the required receipt.'
            },
            {
                question: 'How to Handle Policy Violations?',
                answer: 'Reject the expense and notify the employee of the violation.',
                subPoints: [
                    'Clearly state which policy was violated',
                    'For persistent violations, escalate the issue to higher authorities'
                ]
            }
        ]
    },
    {
        title: 'Contacting Support',
        icon: 'call',
        items: [
            {
                question: 'Technical Support',
                answer: 'If you encounter technical issues, contact the support team via email at support@parrotanalyzer.com or call +91-9876543210.'
            },
            {
                question: 'Policy or Compliance Queries',
                answer: 'For questions about company expense policies, contact the HR or Finance team directly.'
            }
        ]
    },
    {
        title: 'Tips for Efficient Management',
        icon: 'bulb',
        items: [
            {
                question: 'Best Practices',
                answer: 'Follow these tips for efficient expense management:',
                subPoints: [
                    'Set Regular Review Times: Check expenses daily or weekly',
                    'Use Filters: Leverage category and date filters',
                    'Add Comments: Provide clear feedback when rejecting'
                ]
            }
        ]
    },
    {
        title: 'Training and Documentation',
        icon: 'book',
        items: [
            {
                question: 'Admin Tutorials',
                answer: 'Access step-by-step tutorials and video guides in the Admin Resources section.'
            },
            {
                question: 'Policy Handbook',
                answer: 'Refer to the Expense Policy Handbook for detailed information on approval criteria.'
            }
        ]
    }
];

export default function HelpSupport() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();
    const [expandedSection, setExpandedSection] = useState<number | null>(null);
    const [expandedItems, setExpandedItems] = useState<string[]>([]);

    const toggleItem = (itemId: string) => {
        setExpandedItems(prev => {
            if (prev.includes(itemId)) {
                return prev.filter(id => id !== itemId);
            } else {
                return [...prev, itemId];
            }
        });
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={{ flex: 1, backgroundColor: theme === 'dark' ? '#111827' : '#F3F4F6' }}>
                <LinearGradient
                    colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
                    style={[styles.header, { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 0 }]}
                >
                    <View className="px-6">
                        <View className="flex-row items-center">
                            <TouchableOpacity
                                onPress={() => router.back()}
                                className="mr-4 p-2 rounded-full"
                                style={[styles.backButton, { backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6' }]}
                            >
                                <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFFFFF' : '#000000'} />
                            </TouchableOpacity>
                            <View>
                                <Text className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    Help & Support
                                </Text>
                                <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                    Find answers and contact support
                                </Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                <ScrollView 
                    className="flex-1 px-4 pt-3"
                    contentContainerStyle={{ paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                >
                    {helpSections.map((section, sectionIndex) => (
                        <View
                            key={sectionIndex}
                            className={`mb-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                            style={styles.card}
                        >
                            <TouchableOpacity
                                className="p-4 flex-row items-center justify-between"
                                onPress={() => setExpandedSection(expandedSection === sectionIndex ? null : sectionIndex)}
                            >
                                <View className="flex-row items-center">
                                    <View className={`p-2 rounded-lg mr-3 ${
                                        theme === 'dark' ? 'bg-gray-700' : 'bg-blue-50'
                                    }`}>
                                        <Ionicons name={section.icon as any} size={22} color="#3B82F6" />
                                    </View>
                                    <Text className={`text-lg font-semibold ${
                                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    }`}>
                                        {section.title}
                                    </Text>
                                </View>
                                <Ionicons
                                    name={expandedSection === sectionIndex ? 'chevron-up' : 'chevron-down'}
                                    size={20}
                                    color={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                                />
                            </TouchableOpacity>

                            {expandedSection === sectionIndex && (
                                <View className="px-4 pb-4">
                                    {section.items.map((item, itemIndex) => (
                                        <View key={itemIndex} className="mt-2">
                                            <TouchableOpacity
                                                onPress={() => toggleItem(`${sectionIndex}-${itemIndex}`)}
                                                className="flex-row items-center justify-between"
                                            >
                                                <Text className={`text-base font-medium ${
                                                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                                }`}>
                                                    {item.question}
                                                </Text>
                                                <Ionicons
                                                    name={expandedItems.includes(`${sectionIndex}-${itemIndex}`) ? 'remove' : 'add'}
                                                    size={18}
                                                    color={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                                                />
                                            </TouchableOpacity>

                                            {expandedItems.includes(`${sectionIndex}-${itemIndex}`) && (
                                                <View className="mt-2 ml-4">
                                                    <Text className={`text-sm ${
                                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                                    }`}>
                                                        {item.answer}
                                                    </Text>
                                                    {item.subPoints && (
                                                        <View className="mt-2">
                                                            {item.subPoints.map((point, pointIndex) => (
                                                                <View key={pointIndex} className="flex-row items-center mb-1">
                                                                    <View className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2" />
                                                                    <Text className={`text-sm flex-1 ${
                                                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                                                    }`}>
                                                                        {point}
                                                                    </Text>
                                                                </View>
                                                            ))}
                                                        </View>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    ))}
                </ScrollView>
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    header: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        paddingBottom: 14,
    },
    backButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    }
});
