import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, StatusBar, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemeContext from '../../../context/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

type SubPoint = {
    text: string;
};

type Rule = {
    title: string;
    description: string;
    icon: string;
    subPoints?: SubPoint[];
};

const rules: Rule[] = [
    {
        title: 'Group Admin Approval Authority',
        description: 'The Group Admin has the sole authority to approve or reject any expense submitted by employees within their group.',
        icon: 'shield-checkmark'
    },
    {
        title: 'Receipt Attachment Rule',
        description: 'All expenses must include an attached receipt for validation and approval. Submissions without receipts will be automatically flagged or rejected.',
        icon: 'receipt'
    },
    {
        title: 'Mandatory Fields Rule',
        description: 'Each expense must include the following details before it can be approved:',
        icon: 'list',
        subPoints: [
            { text: 'Category' },
            { text: 'Amount' },
            { text: 'Date of Expense' },
            { text: 'Purpose/Description' }
        ]
    },
    {
        title: 'Compliance Rule',
        description: 'Expenses must comply with company policies. Violations, such as duplicate submissions or unauthorized spending, will result in rejection or escalation.',
        icon: 'alert-circle'
    },
    {
        title: 'Notification Rule',
        description: 'The Group Admin will receive an immediate notification when a new expense is submitted for their review. Employees will be notified once the expense is approved or rejected.',
        icon: 'notifications'
    },
    {
        title: 'Audit and Log Rule',
        description: 'All approval or rejection actions by the Group Admin will be logged with timestamps and detailed comments, ensuring transparency and compliance.',
        icon: 'document-text'
    },
    {
        title: 'Category-Based Rule',
        description: 'Specific rules apply based on the category of the expense:',
        icon: 'folder',
        subPoints: [
            { text: 'Travel: Receipts and travel details are mandatory for approval.' },
            { text: 'Food: Expenses must adhere to daily allowance or pre-defined limits.' },
            { text: 'Miscellaneous: Additional documentation may be required based on the nature of the expense.' }
        ]
    },
    {
        title: 'Escalation Rule',
        description: 'If an expense is not acted upon by the Group Admin within a specified timeframe (e.g., 48 hours), it will be escalated to higher authorities for resolution.',
        icon: 'time'
    }
];

export default function ExpenseApprovalRules() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();

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
                                    Expense Approval Rules
                                </Text>
                                <Text className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                    Standard rules for expense approval
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
                    {rules.map((rule, index) => (
                        <View
                            key={index}
                            className={`mb-3 p-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                            style={[
                                styles.card, 
                                index === 0 && { marginTop: 4 },
                                index === rules.length - 1 && { marginBottom: 8 }
                            ]}
                        >
                            <View className="flex-row items-start">
                                <View className={`p-2.5 rounded-lg mr-3 ${
                                    theme === 'dark' ? 'bg-gray-700' : 'bg-blue-50'
                                }`}>
                                    <Ionicons
                                        name={rule.icon as any}
                                        size={22}
                                        color="#3B82F6"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className={`text-base font-bold mb-1 ${
                                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    }`}>
                                        {rule.title.toUpperCase()}
                                    </Text>
                                    <Text className={`text-sm ${
                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                    }`}>
                                        {rule.description}
                                    </Text>
                                    {rule.subPoints && (
                                        <View className="mt-2 ml-2">
                                            {rule.subPoints.map((subPoint, subIndex) => (
                                                <View 
                                                    key={subIndex} 
                                                    className="flex-row items-center mb-1.5"
                                                    style={[
                                                        styles.subPoint,
                                                        subIndex === rule.subPoints!.length - 1 && { marginBottom: 0 }
                                                    ]}
                                                >
                                                    <View className="w-1 h-1 rounded-full bg-blue-500 mr-2" />
                                                    <Text className={`text-sm flex-1 ${
                                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                                    }`}>
                                                        {subPoint.text}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </View>
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
    },
    subPoint: {
        opacity: 0.9,
    }
});
