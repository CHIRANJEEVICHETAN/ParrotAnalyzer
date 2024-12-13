// app/(dashboard)/management/analytics.tsx
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../../context/ThemeContext';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

export default function ManagementAnalytics() {
    const { theme } = ThemeContext.useTheme();
    const router = useRouter();
    const screenWidth = Dimensions.get('window').width;

    const chartConfig = {
        backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
        backgroundGradientFrom: theme === 'dark' ? '#1F2937' : '#FFFFFF',
        backgroundGradientTo: theme === 'dark' ? '#1F2937' : '#FFFFFF',
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
        labelColor: (opacity = 1) => theme === 'dark' ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={theme === 'dark' ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
                style={[styles.header, { paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : StatusBar.currentHeight || 0 }]}
            >
                <View className="flex-row items-center justify-between px-6">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="mr-4 p-2 rounded-full"
                            style={[styles.backButton, { backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6' }]}
                        >
                            <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFFFFF' : '#000000'} />
                        </TouchableOpacity>
                        <Text className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            Analytics
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView 
                className={`flex-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
                showsVerticalScrollIndicator={false}
            >
                {/* Performance Overview */}
                <View className="p-6">
                    <Text className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        Team Performance
                    </Text>
                    <LineChart
                        data={{
                            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                            datasets: [{
                                data: [85, 75, 81, 89, 92, 88]
                            }]
                        }}
                        width={screenWidth - 40}
                        height={220}
                        chartConfig={chartConfig}
                        bezier
                        style={styles.chart}
                    />
                </View>

                {/* Attendance Metrics */}
                <View className="p-6">
                    <Text className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        Attendance Overview
                    </Text>
                    <BarChart
                        data={{
                            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                            datasets: [{
                                data: [95, 88, 92, 87, 91]
                            }]
                        }}
                        width={screenWidth - 40}
                        height={220}
                        chartConfig={chartConfig}
                        style={styles.chart}
                    />
                </View>

                {/* Key Metrics */}
                <View className="p-6">
                    <Text className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        Key Metrics
                    </Text>
                    <View className="flex-row flex-wrap justify-between">
                        {[
                            { label: 'Avg Performance', value: '87%', trend: '+2.5%' },
                            { label: 'Attendance Rate', value: '95%', trend: '+1.2%' },
                            { label: 'Task Completion', value: '92%', trend: '+3.7%' },
                            { label: 'Team Efficiency', value: '88%', trend: '+1.5%' },
                        ].map((metric, index) => (
                            <View
                                key={index}
                                className={`w-[48%] p-4 rounded-xl mb-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                                style={styles.metricCard}
                            >
                                <Text className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {metric.label}
                                </Text>
                                <Text className={`text-2xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {metric.value}
                                </Text>
                                <Text className="text-green-500 text-sm">
                                    {metric.trend}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        paddingBottom: 16,
    },
    backButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },
    metricCard: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
});