import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import ThemeContext from "../../context/ThemeContext";
import AuthContext from "../../context/AuthContext";
import axios from "axios";
import { Calendar } from "react-native-calendars";
import { format } from "date-fns";

interface ShiftDetail {
  shift_start: string;
  shift_end: string | null;
  total_hours: number | string;
  total_distance: number | string;
  total_expenses: number | string;
  date: string;
}

interface AttendanceData {
  date: string;
  shifts: ShiftDetail[];
  total_hours: number | string;
  total_distance: number | string;
  total_expenses: number | string;
  shift_count: number | string;
}

interface CalendarDay {
  timestamp: number;
  year: number;
  month: number;
  day: number;
  dateString: string;
}

interface MarkedDates {
  [date: string]: {
    marked?: boolean;
    dotColor?: string;
    selected?: boolean;
    selectedColor?: string;
    disabled?: boolean;
  };
}

// Add this helper function at the top level
const getApiEndpoint = (role: string) => {
  switch (role) {
    case "employee":
      return "/api/employee";
    case "group-admin":
      return "/api/group-admin";
    case "management":
      return "/api/management";
    default:
      return "/api/employee";
  }
};

// Add this helper function for role-specific titles
const getRoleSpecificTitle = (role: string) => {
  switch (role) {
    case "employee":
      return "Employee Attendance";
    case "group-admin":
      return "Group Admin Attendance";
    case "management":
      return "Management Attendance";
    default:
      return "Attendance Management";
  }
};

export default function AttendanceManagement() {
  const { theme } = ThemeContext.useTheme();
  const { token, user } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === "dark";

  // Get the API endpoint based on user role
  const apiEndpoint = getApiEndpoint(user?.role || "employee");
  console.log(apiEndpoint);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<{
    [key: string]: AttendanceData;
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [monthStats, setMonthStats] = useState({
    totalDays: 0,
    totalHours: 0,
    avgHours: 0,
    totalExpenses: 0,
  });

  useEffect(() => {
    fetchAttendanceData(format(selectedDate, "yyyy-MM"));
  }, [selectedDate]);

  // Update the fetchAttendanceData function
  const fetchAttendanceData = async (month: string) => {
    try {
      setIsLoading(true);
      console.log("Fetching attendance for month:", month);

      console.warn(apiEndpoint);

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}${apiEndpoint}/attendance/${month}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Log raw data from database
      console.log("Raw response data:", response.data);
      response.data.forEach((record: AttendanceData) => {
        record.shifts.forEach((shift, index) => {
          console.log(`Raw shift ${index + 1} times:`, {
            start: shift.shift_start,
            end: shift.shift_end,
            expenses: shift.total_expenses,
            distance: shift.total_distance
          });
        });
      });

      const data = response.data.reduce((acc: any, curr: AttendanceData) => {
        const localDate = format(new Date(curr.date), "yyyy-MM-dd");
        
        // Make sure shift expenses are properly preserved, whether ongoing or completed
        const processedShifts = curr.shifts.map(shift => ({
          ...shift,
          total_expenses: parseNumber(shift.total_expenses), // Ensure proper parsing
          total_distance: parseNumber(shift.total_distance), // Ensure proper parsing
          total_hours: parseNumber(shift.total_hours) // Ensure proper parsing
        }));
        
        acc[localDate] = {
          ...curr,
          date: localDate,
          shifts: processedShifts,
          // Ensure all summary values are properly calculated
          total_hours: curr.total_hours,
          total_distance: curr.total_distance,
          total_expenses: curr.total_expenses,
          shift_count: curr.shift_count,
        };
        return acc;
      }, {});

      // Log processed data
      console.log("Processed attendance data:", data);
      (Object.values(data) as AttendanceData[]).forEach((day) => {
        day.shifts.forEach((shift, index) => {
          console.log(`Processed shift ${index + 1} details:`, {
            start: shift.shift_start,
            end: shift.shift_end,
            displayStart: shift.shift_start.substring(11, 19),
            displayEnd: shift.shift_end
              ? shift.shift_end.substring(11, 19)
              : "Ongoing",
            expenses: shift.total_expenses,
            distance: shift.total_distance
          });
        });
      });

      setAttendanceData(data);
      calculateMonthStats(response.data);
    } catch (error: any) {
      console.error("Error fetching attendance:", error);
      Alert.alert(
        "Error",
        "Failed to fetch attendance data. Please try again later."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const calculateMonthStats = (data: AttendanceData[]) => {
    const stats = data.reduce(
      (acc, curr) => {
        // Parse and sum total expenses and hours for each day
        // Ensure we're adding numbers, not strings
        const dayExpenses = parseNumber(curr.total_expenses);
        const dayHours = parseNumber(curr.total_hours);
        
        console.log(`Day expenses for ${curr.date}: ${dayExpenses}`);
        
        return {
          totalDays: acc.totalDays + 1,
          totalHours: acc.totalHours + dayHours,
          totalExpenses: acc.totalExpenses + dayExpenses,
        };
      },
      { totalDays: 0, totalHours: 0, totalExpenses: 0 }
    );

    setMonthStats({
      ...stats,
      avgHours: stats.totalDays ? stats.totalHours / stats.totalDays || 0 : 0,
    });
  };

  const getMarkedDates = () => {
    const marked: MarkedDates = {};
    const today = new Date();

    const currentMonth = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      1
    );
    const lastDay = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth() + 1,
      0
    );

    for (
      let date = currentMonth;
      date <= lastDay;
      date.setDate(date.getDate() + 1)
    ) {
      const dateString = format(date, "yyyy-MM-dd");
      const isAttendancePresent = attendanceData[dateString];
      const isFutureDate = date > today;

      marked[dateString] = {
        marked: isAttendancePresent ? true : false,
        dotColor: isDark ? "#60A5FA" : "#3B82F6",
        selected: format(selectedDate, "yyyy-MM-dd") === dateString,
        selectedColor: isDark ? "#1E40AF" : "#93C5FD",
        disabled: isFutureDate,
      };
    }

    return marked;
  };

  const handleDateSelect = (day: CalendarDay) => {
    const selectedDateStr = format(new Date(day.timestamp), "yyyy-MM-dd");
    const today = new Date();
    const selectedDate = new Date(day.timestamp);

    if (selectedDate > today) {
      return;
    }

    setSelectedDate(selectedDate);

    if (!attendanceData[selectedDateStr]) {
      Alert.alert(
        "No Attendance Data",
        `No attendance record found for ${format(
          selectedDate,
          "MMMM d, yyyy"
        )}.`
      );
    }
  };

  const parseNumber = (value: string | number | null): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "string") {
      const parsedValue = parseFloat(value);
      console.log(`Parsing string value: ${value} => ${parsedValue || 0}`);
      return parsedValue || 0;
    }
    if (typeof value === "number") {
      console.log(`Already a number: ${value}`);
      return value || 0;
    }
    console.log(`Unhandled value type: ${typeof value}, value: ${value}`);
    return 0;
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={isDark ? ["#1F2937", "#111827"] : ["#FFFFFF", "#F3F4F6"]}
        className="pb-4"
        style={[
          styles.header,
          {
            paddingTop:
              Platform.OS === "ios"
                ? StatusBar.currentHeight || 44
                : StatusBar.currentHeight || 0,
          },
        ]}
      >
        <View className="flex-row items-center justify-between px-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2 rounded-full"
            style={{ backgroundColor: isDark ? "#374151" : "#F3F4F6" }}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? "#FFFFFF" : "#000000"}
            />
          </TouchableOpacity>
          <Text
            className={`text-xl font-bold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            {getRoleSpecificTitle(user?.role || "employee")}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView
        className={`flex-1 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}
        showsVerticalScrollIndicator={false}
      >
        {/* Monthly Stats */}
        <View className="flex-row flex-wrap p-4">
          {[
            {
              title: "Days Present",
              value: monthStats.totalDays,
              icon: "calendar-outline",
              color: "bg-blue-500",
            },
            {
              title: "Total Hours",
              value: monthStats.totalHours?.toFixed(1) || "0.0",
              icon: "time-outline",
              color: "bg-green-500",
            },
            {
              title: "Avg Hours/Day",
              value: monthStats.avgHours?.toFixed(1) || "0.0",
              icon: "stats-chart-outline",
              color: "bg-purple-500",
            },
            {
              title: "Total Expenses",
              value: `₹${monthStats.totalExpenses?.toFixed(0) || "0"}`,
              icon: "cash-outline",
              color: "bg-orange-500",
            },
          ].map((stat, index) => (
            <View key={index} className="w-1/2 p-2">
              <View
                className={`p-4 rounded-xl ${
                  isDark ? "bg-gray-800" : "bg-white"
                }`}
                style={styles.statCard}
              >
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center ${stat.color}`}
                >
                  <Ionicons name={stat.icon as any} size={20} color="white" />
                </View>
                <Text
                  className={`mt-2 text-2xl font-bold ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  {stat.value}
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {stat.title}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Calendar */}
        <View
          className={`mx-4 rounded-xl ${isDark ? "bg-gray-800" : "bg-white"}`}
          style={styles.calendarCard}
        >
          <Calendar
            theme={{
              calendarBackground: "transparent",
              textSectionTitleColor: isDark ? "#9CA3AF" : "#6B7280",
              selectedDayBackgroundColor: isDark ? "#1E40AF" : "#93C5FD",
              selectedDayTextColor: "#FFFFFF",
              todayTextColor: isDark ? "#60A5FA" : "#3B82F6",
              dayTextColor: isDark ? "#FFFFFF" : "#111827",
              textDisabledColor: isDark ? "#4B5563" : "#D1D5DB",
              monthTextColor: isDark ? "#FFFFFF" : "#111827",
              arrowColor: isDark ? "#FFFFFF" : "#111827",
              disabledTextColor: isDark ? "#4B5563" : "#D1D5DB",
            }}
            markedDates={getMarkedDates()}
            onDayPress={handleDateSelect}
            maxDate={format(new Date(), "yyyy-MM-dd")}
          />
        </View>

        {/* Selected Day Details */}
        {attendanceData[format(selectedDate, "yyyy-MM-dd")] ? (
          <View
            className={`m-4 p-4 rounded-xl ${
              isDark ? "bg-gray-800" : "bg-white"
            }`}
            style={styles.detailCard}
          >
            <Text
              className={`text-lg font-bold mb-4 ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {format(selectedDate, "MMMM d, yyyy")}
            </Text>

            {/* Daily Summary */}
            <View className="mb-6 p-4 rounded-lg bg-opacity-50 bg-blue-500/10">
              <Text
                className={`text-base font-semibold mb-2 ${
                  isDark ? "text-blue-400" : "text-blue-600"
                }`}
              >
                Daily Summary
              </Text>
              <View className="flex-row flex-wrap">
                <View className="w-1/2 mb-2">
                  <Text
                    className={`text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Total Shifts
                  </Text>
                  <Text
                    className={`text-base font-semibold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {
                      attendanceData[format(selectedDate, "yyyy-MM-dd")].shifts
                        .length
                    }
                  </Text>
                </View>
                <View className="w-1/2 mb-2">
                  <Text
                    className={`text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Total Hours
                  </Text>
                  <Text
                    className={`text-base font-semibold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {parseNumber(
                      attendanceData[format(selectedDate, "yyyy-MM-dd")]
                        .total_hours
                    )?.toFixed(1) || "0.0"}{" "}
                    hrs
                  </Text>
                </View>
                <View className="w-1/2">
                  <Text
                    className={`text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Total Distance
                  </Text>
                  <Text
                    className={`text-base font-semibold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {parseNumber(
                      attendanceData[format(selectedDate, "yyyy-MM-dd")]
                        .total_distance
                    )?.toFixed(1) || "0.0"}{" "}
                    km
                  </Text>
                </View>
                <View className="w-1/2">
                  <Text
                    className={`text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Total Expenses
                  </Text>
                  <Text
                    className={`text-base font-semibold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    ₹
                    {(() => {
                      const expenseValue = parseNumber(
                        attendanceData[format(selectedDate, "yyyy-MM-dd")]
                          .total_expenses
                      );
                      console.log(`Displaying total expenses: ${expenseValue}`);
                      return expenseValue.toFixed(2) || "0.00";
                    })()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Individual Shifts */}
            <Text
              className={`text-base font-semibold mb-3 ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Shift Details
            </Text>

            {attendanceData[format(selectedDate, "yyyy-MM-dd")].shifts.map(
              (shift, index) => (
                <View
                  key={index}
                  className={`mb-4 p-4 rounded-lg ${
                    isDark ? "bg-gray-700" : "bg-gray-50"
                  } ${
                    index ===
                    attendanceData[format(selectedDate, "yyyy-MM-dd")].shifts
                      .length -
                      1
                      ? "mb-0"
                      : ""
                  }`}
                >
                  <Text
                    className={`text-sm font-medium mb-2 ${
                      isDark ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Shift {index + 1}
                  </Text>

                  <View className="space-y-3">
                    {[
                      {
                        label: "Shift Time",
                        value: (() => {
                          console.log("Rendering shift times:", {
                            rawStart: shift.shift_start,
                            rawEnd: shift.shift_end,
                            displayStart: shift.shift_start.substring(11, 19),
                            displayEnd: shift.shift_end
                              ? shift.shift_end.substring(11, 19)
                              : "Ongoing",
                          });
                          return `${shift.shift_start.substring(11, 19)} - ${
                            shift.shift_end
                              ? shift.shift_end.substring(11, 19)
                              : "Ongoing"
                          }`;
                        })(),
                        icon: "time-outline" as keyof typeof Ionicons.glyphMap,
                      },
                      {
                        label: "Duration",
                        value: `${
                          parseNumber(shift.total_hours)?.toFixed(1) || "0.0"
                        } hrs`,
                        icon: "hourglass-outline" as keyof typeof Ionicons.glyphMap,
                      },
                      {
                        label: "Distance",
                        value: `${
                          parseNumber(shift.total_distance)?.toFixed(1) || "0.0"
                        } km`,
                        icon: "map-outline" as keyof typeof Ionicons.glyphMap,
                      },
                      {
                        label: "Expenses",
                        value: `₹${(() => {
                          const expValue = parseNumber(shift.total_expenses);
                          console.log(`Rendering shift expenses: ${expValue}`);
                          return expValue.toFixed(2) || "0.00";
                        })()}`,
                        icon: "cash-outline" as keyof typeof Ionicons.glyphMap,
                      },
                    ].map((detail, detailIndex) => (
                      <View key={detailIndex} className="flex-row items-center">
                        <View
                          className={`w-8 h-8 rounded-full items-center justify-center ${
                            isDark ? "bg-gray-600" : "bg-gray-200"
                          }`}
                        >
                          <Ionicons
                            name={detail.icon}
                            size={16}
                            color={isDark ? "#60A5FA" : "#3B82F6"}
                          />
                        </View>
                        <View className="ml-3 flex-1">
                          <Text
                            className={`text-xs ${
                              isDark ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            {detail.label}
                          </Text>
                          <Text
                            className={`text-sm font-semibold ${
                              isDark ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {detail.value}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )
            )}
          </View>
        ) : (
          <View
            className={`m-4 p-4 rounded-xl ${
              isDark ? "bg-gray-800" : "bg-white"
            }`}
            style={styles.detailCard}
          >
            <View className="items-center py-6">
              <Ionicons
                name="calendar-outline"
                size={48}
                color={isDark ? "#4B5563" : "#9CA3AF"}
              />
              <Text
                className={`mt-4 text-center text-lg ${
                  isDark ? "text-gray-400" : "text-gray-500"
                }`}
              >
                No attendance record found for{" "}
                {format(selectedDate, "MMMM d, yyyy")}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  statCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  calendarCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    padding: 10,
  },
  detailCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});
