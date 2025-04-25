import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import ThemeContext from "../../context/ThemeContext";
import AuthContext from "../../context/AuthContext";
import {
  format,
  differenceInSeconds,
  differenceInHours,
  differenceInMinutes,
} from "date-fns";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Modal from "react-native-modal";
import numberToWords from "./components/NumberToWords";

interface TravelDetail {
  id: number;
  vehicleType: string;
  vehicleNumber: string;
  totalKilometers: string;
  startDateTime: Date;
  endDateTime: Date;
  routeTaken: string;
}

interface ExpenseDetail {
  id: number;
  lodgingExpenses: string;
  dailyAllowance: string;
  diesel: string;
  tollCharges: string;
  otherExpenses: string;
  totalAmount: number;
}

interface FormData {
  employeeName: string;
  employeeNumber: string;
  department: string;
  designation: string;
  location: string;
  date: Date;
  travelDate: Date;
  vehicleType: string;
  vehicleNumber: string;
  totalKilometers: string;
  startDateTime: Date;
  endDateTime: Date;
  routeTaken: string;
  showStartPicker: boolean;
  showEndPicker: boolean;
  lodgingExpenses: string;
  dailyAllowance: string;
  diesel: string;
  tollCharges: string;
  otherExpenses: string;
  advanceTaken: string;
  supportingDocs: DocumentFile[];
}

interface EmployeeDetails {
  name: string;
  employee_number: string;
  department: string;
  designation: string;
  company_name: string;
}

interface DocumentFile {
  uri: string;
  type: string;
  name: string;
  isImage?: boolean;
}

const EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL;

const CACHE_KEYS = {
  EMPLOYEE_DETAILS: "employee_expense_details",
};

const calculateTravelTime = (
  startTime: string | Date,
  endTime: string | Date
) => {
  if (!startTime || !endTime) return "--:--";

  const start = typeof startTime === "string" ? new Date(startTime) : startTime;
  const end = typeof endTime === "string" ? new Date(endTime) : endTime;

  const hours = differenceInHours(end, start);
  const minutes = differenceInMinutes(end, start) % 60;

  return `${hours}h ${minutes}m`;
};

const calculateAverageSpeed = (
  distance: string,
  startTime: string | Date,
  endTime: string | Date
) => {
  if (!distance || !startTime || !endTime) return "--";

  const kilometers = parseFloat(distance);
  const start = typeof startTime === "string" ? new Date(startTime) : startTime;
  const end = typeof endTime === "string" ? new Date(endTime) : endTime;

  const hours = differenceInSeconds(end, start) / 3600;

  if (hours === 0) return "--";

  const avgSpeed = kilometers / hours;
  return `${avgSpeed.toFixed(1)} km/h`;
};

// Helper function to convert number to words
const convertNumberToWords = (num: number): string => {
  return numberToWords(num);
};


export default function EmployeeExpenses() {
  const { theme } = ThemeContext.useTheme();
  const { user, token, refreshToken } = AuthContext.useAuth();
  const router = useRouter();

  // Form state
  const [formData, setFormData] = useState<FormData>({
    employeeName: user?.name || "",
    employeeNumber: "",
    department: "",
    designation: "",
    location: "",
    date: new Date(),
    travelDate: new Date(),
    vehicleType: "",
    vehicleNumber: "",
    totalKilometers: "",
    startDateTime: new Date(),
    endDateTime: new Date(),
    routeTaken: "",
    showStartPicker: false,
    showEndPicker: false,
    lodgingExpenses: "",
    dailyAllowance: "",
    diesel: "",
    tollCharges: "",
    otherExpenses: "",
    advanceTaken: "",
    supportingDocs: [],
  });

  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateType, setDateType] = useState<"date" | "travelDate">("date");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");
  const [savedExpenseDetails, setSavedExpenseDetails] = useState<
    ExpenseDetail[]
  >([]);
  const [employeeDetails, setEmployeeDetails] = useState({
    employeeName: user?.name || "",
    employeeNumber: "",
    department: "",
    designation: "",
    location: "",
  });
  const [savedTravelDetails, setSavedTravelDetails] = useState<TravelDetail[]>(
    []
  );
  const [companyName, setCompanyName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Calculated fields
  const totalExpenses = React.useMemo(() => {
    const values = [
      "lodgingExpenses",
      "dailyAllowance",
      "diesel",
      "tollCharges",
      "otherExpenses",
    ].map(
      (key) => parseFloat(formData[key as keyof typeof formData] as string) || 0
    );
    return values.reduce((acc, curr) => acc + curr, 0);
  }, [formData]);

  const amountPayable = React.useMemo(() => {
    return totalExpenses - (parseFloat(formData.advanceTaken) || 0);
  }, [totalExpenses, formData.advanceTaken]);

  // Handlers
  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData((prev: FormData) => ({
        ...prev,
        [dateType]: selectedDate,
      }));
    }
  };

  const showDatePickerModal = (type: "date" | "travelDate") => {
    setDateType(type);
    setShowDatePicker(true);
  };

  const handleDocumentPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        multiple: true,
      });

      if (!result.canceled) {
        // Map the files to include the necessary properties
        const newFiles = result.assets.map((asset) => ({
          uri: asset.uri,
          type: asset.mimeType || "image/jpeg",
          name: asset.name,
        }));

        setFormData((prev) => ({
          ...prev,
          supportingDocs: [...prev.supportingDocs, ...newFiles],
        }));

        console.log("Files selected:", newFiles);
      }
    } catch (err) {
      console.error("Error picking document:", err);
      Alert.alert("Error", "Failed to pick document");
    }
  };

  // Validation
  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.employeeName.trim()) {
      newErrors.employeeName = "Employee name is required";
    }

    if (!formData.employeeNumber.trim()) {
      newErrors.employeeNumber = "Employee number is required";
    }

    // Add more validations as needed

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Modify the token verification useEffect
  useEffect(() => {
    const checkAuthAndFetchDetails = async () => {
      try {
        const currentToken = await refreshToken();
        if (!currentToken) {
          router.replace("/(auth)/signin");
          return;
        }

        // Set token in axios headers
        axios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${currentToken}`;

        const employeeResponse = await axios.get<EmployeeDetails>(
          `${EXPO_PUBLIC_API_URL}/api/employee/details`
        );

        // Update form data with employee details
        setFormData((prev) => ({
          ...prev,
          employeeName: employeeResponse.data.name || "",
          employeeNumber: employeeResponse.data.employee_number || "",
          department: employeeResponse.data.department || "",
          designation: employeeResponse.data.designation || "",
        }));

        // Update company name
        setCompanyName(
          employeeResponse.data.company_name || "Company Not Assigned"
        );

        // Also update employeeDetails state
        setEmployeeDetails((prev) => ({
          ...prev,
          employeeName: employeeResponse.data.name || "",
          employeeNumber: employeeResponse.data.employee_number || "",
          department: employeeResponse.data.department || "",
          designation: employeeResponse.data.designation || "",
        }));
      } catch (error) {
        console.error("Auth/Details check error:", error);
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          Alert.alert(
            "Session Expired",
            "Your session has expired. Please login again.",
            [
              {
                text: "OK",
                onPress: async () => {
                  await AsyncStorage.removeItem("auth_token");
                  router.replace("/(auth)/signin");
                },
              },
            ]
          );
        } else {
          Alert.alert(
            "Error",
            "Failed to fetch employee details. Please try again later."
          );
        }
      }
    };

    checkAuthAndFetchDetails();
  }, []);

  // Add this function before handleSubmit
  const resetForm = () => {
    setFormData({
      employeeName: user?.name || "",
      employeeNumber: "",
      department: "",
      designation: "",
      location: "",
      date: new Date(),
      travelDate: new Date(),
      vehicleType: "",
      vehicleNumber: "",
      totalKilometers: "",
      startDateTime: new Date(),
      endDateTime: new Date(),
      routeTaken: "",
      showStartPicker: false,
      showEndPicker: false,
      lodgingExpenses: "",
      dailyAllowance: "",
      diesel: "",
      tollCharges: "",
      otherExpenses: "",
      advanceTaken: "",
      supportingDocs: [],
    });
    setErrors({});
  };

  // Update handleSubmit to use auth_token instead of userToken
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      console.log("Starting expense submission...");

      // First check if user can submit expenses anytime
      const userPermissionsResponse = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/employee/permissions`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const canSubmitAnytime =
        userPermissionsResponse.data?.permissions?.includes(
          "can_submit_expenses_anytime"
        ) || false;

      // Only check for active shift if user cannot submit anytime
      if (!canSubmitAnytime) {
        // Check for active shift
        const shiftStatus = await AsyncStorage.getItem(
          `${user?.role}-shiftStatus`
        );
        console.warn("shiftStatus", shiftStatus);
        if (!shiftStatus) {
          setShowSuccessModal(false); // Ensure success modal is hidden
          Alert.alert(
            "No Active Shift",
            "You must have an active shift to submit expenses. Please start a shift first.",
            [{ text: "OK", style: "default" }]
          );
          setIsSubmitting(false);
          return;
        }

        const { isActive } = JSON.parse(shiftStatus);
        if (!isActive) {
          setShowSuccessModal(false); // Ensure success modal is hidden
          Alert.alert(
            "No Active Shift",
            "You must have an active shift to submit expenses. Please start a shift first.",
            [{ text: "OK", style: "default" }]
          );
          setIsSubmitting(false);
          return;
        }
      }

      // Validate employee details first
      if (
        !formData.employeeName ||
        !formData.employeeNumber ||
        !formData.department ||
        !formData.designation
      ) {
        console.error("Missing employee details:", {
          name: formData.employeeName,
          number: formData.employeeNumber,
          department: formData.department,
          designation: formData.designation,
        });
        Alert.alert(
          "Error",
          "Employee details are missing. Please try refreshing the page."
        );
        return;
      }

      // Create form data for file upload
      const formDataToSend = new FormData();

      // Log employee details before sending
      console.log("Employee details being sent:", {
        employeeName: formData.employeeName,
        employeeNumber: formData.employeeNumber,
        department: formData.department,
        designation: formData.designation,
      });

      // Add saved details from AsyncStorage
      formDataToSend.append(
        "savedTravelDetails",
        JSON.stringify(savedTravelDetails)
      );
      formDataToSend.append(
        "savedExpenseDetails",
        JSON.stringify(savedExpenseDetails)
      );

      // Add all the expense details
      formDataToSend.append("employeeName", formData.employeeName);
      formDataToSend.append("employeeNumber", formData.employeeNumber);
      formDataToSend.append("department", formData.department);
      formDataToSend.append("designation", formData.designation);
      formDataToSend.append("location", formData.location);
      formDataToSend.append("date", formData.date.toISOString());
      formDataToSend.append("vehicleType", formData.vehicleType);
      formDataToSend.append("vehicleNumber", formData.vehicleNumber);
      formDataToSend.append("totalKilometers", formData.totalKilometers);
      formDataToSend.append(
        "startDateTime",
        formData.startDateTime.toISOString()
      );
      formDataToSend.append("endDateTime", formData.endDateTime.toISOString());
      formDataToSend.append("routeTaken", formData.routeTaken);
      formDataToSend.append("lodgingExpenses", formData.lodgingExpenses);
      formDataToSend.append("dailyAllowance", formData.dailyAllowance);
      formDataToSend.append("diesel", formData.diesel);
      formDataToSend.append("tollCharges", formData.tollCharges);
      formDataToSend.append("otherExpenses", formData.otherExpenses);
      formDataToSend.append("advanceTaken", formData.advanceTaken);
      
      // Use calculateTotalAmount and calculateAmountPayable which include saved expenses
      const calculatedTotalAmount = calculateTotalAmount();
      const calculatedAmountPayable = calculateAmountPayable();
      
      formDataToSend.append("totalAmount", calculatedTotalAmount.toString());
      formDataToSend.append("amountPayable", calculatedAmountPayable.toString());

      // Add supporting documents
      formData.supportingDocs.forEach((doc, index) => {
        console.log("Appending document:", {
          name: doc.name,
          type: doc.type,
          uri: doc.uri,
        });
        formDataToSend.append("documents", {
          uri: doc.uri,
          type: doc.type,
          name: doc.name,
        } as any);
      });

      // Log the complete FormData
      for (let [key, value] of formDataToSend.entries()) {
        console.log(`${key}: ${value}`);
      }

      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/expenses/submit`,
        formDataToSend,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          timeout: 30000,
        }
      );

      console.log("Submission response:", response.data);

      // Clear AsyncStorage data after successful submission
      await Promise.all([
        AsyncStorage.removeItem("savedTravelDetails"),
        AsyncStorage.removeItem("savedExpenseDetails"),
      ]);

      // Clear the state as well
      setSavedTravelDetails([]);
      setSavedExpenseDetails([]);

      setShowSuccessModal(true);

      // Send notification to group admin
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/employee-notifications/notify-admin`,
        {
          title: `💰 New Expense Report - ${user?.name} (${formData.employeeNumber})`,
          message: `📊 Expense Details:\n🗓️ Date: ${format(
            formData.date,
            "dd/MM/yyyy"
          )}\n💵 Total Amount: ₹${calculatedTotalAmount.toFixed(2)}\n🚗 Travel: ${
            formData.totalKilometers
          }km\n📍 Route: ${formData.routeTaken}\n\n💼 Department: ${
            formData.department
          }\n👤 Designation: ${formData.designation}`,
          type: "expense-submission",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Auto hide after 2 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
        resetForm();
        router.back();
      }, 2000);
    } catch (error) {
      console.error("Expense submission error:", error);
      Alert.alert(
        "Error",
        axios.isAxiosError(error)
          ? error.response?.data?.details || "Failed to submit expense claim"
          : "Failed to submit expense claim",
        [{ text: "OK", style: "default" }],
        {
          cancelable: true,
          userInterfaceStyle: theme === "dark" ? "dark" : "light",
        }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to check if current expense details exist
  const hasCurrentExpenseDetails = () => {
    return (
      formData.lodgingExpenses.trim() !== "" ||
      formData.dailyAllowance.trim() !== "" ||
      formData.diesel.trim() !== "" ||
      formData.tollCharges.trim() !== "" ||
      formData.otherExpenses.trim() !== ""
    );
  };

  // Helper function to calculate total amount including saved expenses
  const calculateTotalAmount = () => {
    const currentExpenseTotal = [
      "lodgingExpenses",
      "dailyAllowance",
      "diesel",
      "tollCharges",
      "otherExpenses",
    ].reduce(
      (acc, key) =>
        acc +
        (parseFloat(formData[key as keyof typeof formData] as string) || 0),
      0
    );

    const savedExpenseTotal = savedExpenseDetails.reduce(
      (acc, expense) => acc + expense.totalAmount,
      0
    );

    return currentExpenseTotal + savedExpenseTotal;
  };

  // Helper function to calculate amount payable
  const calculateAmountPayable = () => {
    return calculateTotalAmount() - (parseFloat(formData.advanceTaken) || 0);
  };

  const handleStartDateTimeChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || formData.startDateTime;

    if (pickerMode === "date") {
      setFormData((prev: FormData) => ({
        ...prev,
        showStartPicker: Platform.OS === "ios",
        startDateTime: new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate(),
          prev.startDateTime.getHours(),
          prev.startDateTime.getMinutes()
        ),
      }));
      if (Platform.OS === "android") {
        setPickerMode("time");
        setFormData((prev: FormData) => ({ ...prev, showStartPicker: true }));
      }
    } else {
      setFormData((prev: FormData) => ({
        ...prev,
        showStartPicker: false,
        startDateTime: new Date(
          prev.startDateTime.getFullYear(),
          prev.startDateTime.getMonth(),
          prev.startDateTime.getDate(),
          currentDate.getHours(),
          currentDate.getMinutes()
        ),
      }));
      setPickerMode("date");
    }
  };

  const handleEndDateTimeChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || formData.endDateTime;

    if (pickerMode === "date") {
      setFormData((prev: FormData) => ({
        ...prev,
        showEndPicker: Platform.OS === "ios",
        endDateTime: new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate(),
          prev.endDateTime.getHours(),
          prev.endDateTime.getMinutes()
        ),
      }));
      if (Platform.OS === "android") {
        setPickerMode("time");
        setFormData((prev: FormData) => ({ ...prev, showEndPicker: true }));
      }
    } else {
      setFormData((prev: FormData) => ({
        ...prev,
        showEndPicker: false,
        endDateTime: new Date(
          prev.endDateTime.getFullYear(),
          prev.endDateTime.getMonth(),
          prev.endDateTime.getDate(),
          currentDate.getHours(),
          currentDate.getMinutes()
        ),
      }));
      setPickerMode("date");
    }
  };

  const showStartDateTimePicker = () => {
    setPickerMode("date");
    setFormData((prev) => ({ ...prev, showStartPicker: true }));
  };

  const showEndDateTimePicker = () => {
    setPickerMode("date");
    setFormData((prev) => ({ ...prev, showEndPicker: true }));
  };

  const handleTravelDetailsReset = () => {
    setFormData((prev) => ({
      ...prev,
      vehicleType: "",
      vehicleNumber: "",
      totalKilometers: "",
      startDateTime: new Date(),
      endDateTime: new Date(),
      routeTaken: "",
      showStartPicker: false,
      showEndPicker: false,
    }));
  };

  const handleSaveTravelDetails = async () => {
    // Validate required fields
    if (
      !formData.totalKilometers ||
      !formData.startDateTime ||
      !formData.endDateTime
    ) {
      Alert.alert("Error", "Please fill all required travel details");
      return;
    }

    const newTravelDetail: TravelDetail = {
      id: Date.now(),
      vehicleType: formData.vehicleType,
      vehicleNumber: formData.vehicleNumber,
      totalKilometers: formData.totalKilometers,
      startDateTime: formData.startDateTime,
      endDateTime: formData.endDateTime,
      routeTaken: formData.routeTaken,
    };

    const updatedDetails = [...savedTravelDetails, newTravelDetail];
    setSavedTravelDetails(updatedDetails);

    try {
      await AsyncStorage.setItem(
        "savedTravelDetails",
        JSON.stringify(updatedDetails)
      );
      handleTravelDetailsReset(); // Reset form after saving
      Alert.alert(
        "Success",
        `Travel Details ${updatedDetails.length} saved successfully`
      );
    } catch (error) {
      console.error("Error saving travel details:", error);
      Alert.alert("Error", "Failed to save travel details");
    }
  };

  // Add this useEffect for loading persisted data
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const employeeData = await AsyncStorage.getItem("employeeDetails");
        const travelData = await AsyncStorage.getItem("savedTravelDetails");

        if (employeeData) {
          const parsed = JSON.parse(employeeData);
          setEmployeeDetails(parsed);
          // Update formData with employee details
          setFormData((prev) => ({
            ...prev,
            employeeNumber: parsed.employeeNumber || "",
            department: parsed.department || "",
            designation: parsed.designation || "",
            location: parsed.location || "",
          }));
        }

        if (travelData) {
          setSavedTravelDetails(JSON.parse(travelData));
        }
      } catch (error) {
        console.error("Error loading persisted data:", error);
      }
    };

    loadPersistedData();
  }, []);

  // Add function to handle employee details changes
  const handleEmployeeDetailsChange = async (field: string, value: string) => {
    const updatedDetails = {
      ...employeeDetails,
      [field]: value,
    };

    setEmployeeDetails(updatedDetails);
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    try {
      await AsyncStorage.setItem(
        "employeeDetails",
        JSON.stringify(updatedDetails)
      );
    } catch (error) {
      console.error("Error saving employee details:", error);
    }
  };

  // Add function to handle travel detail deletion
  const handleDeleteTravelDetail = async (id: number) => {
    Alert.alert(
      "Delete Travel Detail",
      "Are you sure you want to delete this travel detail?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updatedDetails = savedTravelDetails.filter(
              (detail) => detail.id !== id
            );
            setSavedTravelDetails(updatedDetails);

            try {
              await AsyncStorage.setItem(
                "savedTravelDetails",
                JSON.stringify(updatedDetails)
              );
            } catch (error) {
              console.error("Error saving updated travel details:", error);
            }
          },
        },
      ]
    );
  };

  const handleExpenseDetailsReset = () => {
    setFormData((prev) => ({
      ...prev,
      lodgingExpenses: "",
      dailyAllowance: "",
      diesel: "",
      tollCharges: "",
      otherExpenses: "",
    }));
  };

  const handleSaveExpenseDetails = async () => {
    // Validate if at least one expense field is filled
    const hasExpense = [
      "lodgingExpenses",
      "dailyAllowance",
      "diesel",
      "tollCharges",
      "otherExpenses",
    ].some((key) => formData[key as keyof typeof formData]);

    if (!hasExpense) {
      Alert.alert("Error", "Please fill at least one expense field");
      return;
    }

    // Calculate total for this expense entry
    const currentTotal = [
      "lodgingExpenses",
      "dailyAllowance",
      "diesel",
      "tollCharges",
      "otherExpenses",
    ].reduce((acc, key) => {
      return (
        acc +
        (parseFloat(formData[key as keyof typeof formData] as string) || 0)
      );
    }, 0);

    const newExpenseDetail: ExpenseDetail = {
      id: Date.now(),
      lodgingExpenses: formData.lodgingExpenses,
      dailyAllowance: formData.dailyAllowance,
      diesel: formData.diesel,
      tollCharges: formData.tollCharges,
      otherExpenses: formData.otherExpenses,
      totalAmount: currentTotal,
    };

    const updatedDetails = [...savedExpenseDetails, newExpenseDetail];

    try {
      // Save to AsyncStorage
      await AsyncStorage.setItem(
        "savedExpenseDetails",
        JSON.stringify(updatedDetails)
      );
      setSavedExpenseDetails(updatedDetails);

      // Reset form fields
      handleExpenseDetailsReset();

      Alert.alert(
        "Success",
        `Expense Details ${updatedDetails.length} saved successfully`
      );
    } catch (error) {
      console.error("Error saving expense details:", error);
      Alert.alert("Error", "Failed to save expense details");
    }
  };

  // Add useEffect to load saved expense details on mount
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedExpenses = await AsyncStorage.getItem("savedExpenseDetails");
        if (savedExpenses) {
          setSavedExpenseDetails(JSON.parse(savedExpenses));
        }
      } catch (error) {
        console.error("Error loading saved expense details:", error);
      }
    };

    loadSavedData();
  }, []);

  const handleDeleteExpenseDetail = async (id: number) => {
    Alert.alert(
      "Delete Expense Detail",
      "Are you sure you want to delete this expense detail?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {}, // Add empty onPress to prevent undefined handler
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updatedDetails = savedExpenseDetails.filter(
              (detail) => detail.id !== id
            );
            setSavedExpenseDetails(updatedDetails);

            try {
              await AsyncStorage.setItem(
                "savedExpenseDetails",
                JSON.stringify(updatedDetails)
              );
            } catch (error) {
              console.error("Error saving updated expense details:", error);
            }
          },
        },
      ],
      {
        cancelable: true,
        userInterfaceStyle: theme === "dark" ? "dark" : "light",
      }
    );
  };

  // Add this function to load cached employee details
  const loadCachedEmployeeDetails = async () => {
    try {
      const cachedDetails = await AsyncStorage.getItem(
        CACHE_KEYS.EMPLOYEE_DETAILS
      );
      if (cachedDetails) {
        const details = JSON.parse(cachedDetails);
        setFormData((prev) => ({
          ...prev,
          employeeName: details.employeeName || "",
          employeeNumber: details.employeeNumber || "",
          department: details.department || "",
          designation: details.designation || "",
        }));
      }
    } catch (error) {
      console.error("Error loading cached employee details:", error);
    }
  };

  // Add this function to save employee details to cache
  const saveEmployeeDetailsToCache = async (details: any) => {
    try {
      await AsyncStorage.setItem(
        CACHE_KEYS.EMPLOYEE_DETAILS,
        JSON.stringify(details)
      );
    } catch (error) {
      console.error("Error saving employee details to cache:", error);
    }
  };

  // Add this function to handle document upload options
  const handleDocumentUpload = () => {
    setShowUploadModal(true);
  };

  // Add function to capture image using camera
  const captureImage = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Camera permission is required to take photos"
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled) {
        const newDoc: DocumentFile = {
          uri: result.assets[0].uri,
          type: "image/jpeg",
          name: `photo_${Date.now()}.jpg`,
          isImage: true,
        };

        setFormData((prev) => ({
          ...prev,
          supportingDocs: [...prev.supportingDocs, newDoc],
        }));
      }
    } catch (error) {
      console.error("Error capturing image:", error);
      Alert.alert("Error", "Failed to capture image");
    }
  };

  // Modify the existing document pick function
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        multiple: true,
      });

      if (!result.canceled) {
        const newFiles = result.assets.map((asset) => ({
          uri: asset.uri,
          type: asset.mimeType || "application/octet-stream",
          name: asset.name,
          isImage: asset.mimeType?.startsWith("image/"),
        }));

        setFormData((prev) => ({
          ...prev,
          supportingDocs: [...prev.supportingDocs, ...newFiles],
        }));
      }
    } catch (error) {
      console.error("Error picking document:", error);
      Alert.alert("Error", "Failed to pick document");
    }
  };

  // Add function to remove document
  const removeDocument = (index: number) => {
    Alert.alert(
      "Remove Document",
      "Are you sure you want to remove this document?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setFormData((prev) => ({
              ...prev,
              supportingDocs: prev.supportingDocs.filter((_, i) => i !== index),
            }));
          },
        },
      ]
    );
  };

  // Add useEffect to load cached data
  useEffect(() => {
    loadCachedEmployeeDetails();
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[
        styles.container,
        { backgroundColor: theme === "dark" ? "#111827" : "#F3F4F6" },
      ]}
    >
      <StatusBar
        backgroundColor={theme === "dark" ? "#1F2937" : "#FFFFFF"}
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
      />

      {/* Update header to match profile page */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF",
            paddingTop:
              Platform.OS === "ios"
                ? StatusBar.currentHeight || 44
                : StatusBar.currentHeight || 0,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backButton,
              { backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6" },
            ]}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={theme === "dark" ? "#FFFFFF" : "#000000"}
            />
          </TouchableOpacity>
          <Text
            style={[
              styles.headerTitle,
              { color: theme === "dark" ? "#FFFFFF" : "#111827" },
            ]}
          >
            Travel Claim Form
          </Text>
          <View style={{ width: 40 }}>
            <Text> </Text>
          </View>
        </View>
      </View>

      {/* Form Content */}
      <ScrollView style={styles.content}>
        {/* Company Details */}
        <View
          style={[
            styles.section,
            { backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF" },
          ]}
        >
          <Text
            style={[
              styles.companyName,
              { color: theme === "dark" ? "#FFFFFF" : "#111827" },
            ]}
          >
            {companyName}
          </Text>
          <Text
            style={[
              styles.formCode,
              { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
            ]}
          >
            Form Code: TP/TCF
          </Text>
        </View>

        {/* Employee Details Section */}
        <View
          style={[
            styles.section,
            { backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF" },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme === "dark" ? "#FFFFFF" : "#111827" },
            ]}
          >
            Employee Details
          </Text>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Employee Name
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                  color: theme === "dark" ? "#FFFFFF" : "#111827",
                  borderColor: errors.employeeName ? "#EF4444" : "#E5E7EB",
                },
              ]}
              value={formData.employeeName}
              editable={false}
              placeholder="Employee name"
              placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Employee Number
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                  color: theme === "dark" ? "#FFFFFF" : "#111827",
                  borderColor: errors.employeeNumber ? "#EF4444" : "#E5E7EB",
                },
              ]}
              value={formData.employeeNumber}
              editable={false}
              placeholder="Employee number"
              placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Department
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                  color: theme === "dark" ? "#FFFFFF" : "#111827",
                  borderColor: errors.department ? "#EF4444" : "#E5E7EB",
                },
              ]}
              value={formData.department}
              editable={false}
              placeholder="Department"
              placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Designation
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                  color: theme === "dark" ? "#FFFFFF" : "#111827",
                  borderColor: errors.designation ? "#EF4444" : "#E5E7EB",
                },
              ]}
              value={formData.designation}
              editable={false}
              placeholder="Designation"
              placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Location
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                  color: theme === "dark" ? "#FFFFFF" : "#111827",
                },
              ]}
              value={formData.location}
              onChangeText={(text) =>
                handleEmployeeDetailsChange("location", text)
              }
              placeholder="Enter location"
              placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.input,
              {
                backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                justifyContent: "center",
              },
            ]}
            onPress={() => showDatePickerModal("date")}
          >
            <Text style={{ color: theme === "dark" ? "#FFFFFF" : "#111827" }}>
              {formData.date
                ? format(new Date(formData.date), "dd MMM yyyy")
                : "Select date"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Enhanced Travel Details Section */}
        <View
          style={[
            styles.section,
            { backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF" },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme === "dark" ? "#FFFFFF" : "#111827" },
            ]}
          >
            Travel Details
          </Text>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Vehicle Type
            </Text>
            <View
              style={[
                styles.pickerContainer,
                { backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6" },
              ]}
            >
              <Picker
                selectedValue={formData.vehicleType}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, vehicleType: value }))
                }
                style={{ color: theme === "dark" ? "#FFFFFF" : "#111827" }}
              >
                <Picker.Item label="Select Vehicle Type" value="" />
                <Picker.Item label="Car" value="car" />
                <Picker.Item label="Bike" value="bike" />
                <Picker.Item label="Public Transport" value="public" />
                <Picker.Item label="Other" value="other" />
              </Picker>
            </View>
          </View>

          {formData.vehicleType !== "public" && (
            <View style={styles.inputGroup}>
              <Text
                style={[
                  styles.label,
                  { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
                ]}
              >
                Vehicle Number
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                    color: theme === "dark" ? "#FFFFFF" : "#111827",
                  },
                ]}
                value={formData.vehicleNumber}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, vehicleNumber: text }))
                }
                placeholder="Enter vehicle number"
                placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Total Distance (KM) *
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                  color: theme === "dark" ? "#FFFFFF" : "#111827",
                },
              ]}
              value={formData.totalKilometers}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, totalKilometers: text }))
              }
              keyboardType="numeric"
              placeholder="Enter total kilometers"
              placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
            />
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text
                style={[
                  styles.label,
                  { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
                ]}
              >
                Start Date & Time *
              </Text>
              <TouchableOpacity
                style={[
                  styles.input,
                  {
                    backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                    justifyContent: "center",
                  },
                ]}
                onPress={showStartDateTimePicker}
              >
                <Text
                  style={{ color: theme === "dark" ? "#FFFFFF" : "#111827" }}
                >
                  {format(formData.startDateTime, "dd MMM yyyy hh:mm aa")}
                </Text>
              </TouchableOpacity>

              {formData.showStartPicker && (
                <DateTimePicker
                  value={formData.startDateTime}
                  mode={pickerMode}
                  is24Hour={false}
                  display="default"
                  onChange={handleStartDateTimeChange}
                />
              )}
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text
                style={[
                  styles.label,
                  { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
                ]}
              >
                End Date & Time *
              </Text>
              <TouchableOpacity
                style={[
                  styles.input,
                  {
                    backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                    justifyContent: "center",
                  },
                ]}
                onPress={showEndDateTimePicker}
              >
                <Text
                  style={{ color: theme === "dark" ? "#FFFFFF" : "#111827" }}
                >
                  {format(formData.endDateTime, "dd MMM yyyy hh:mm aa")}
                </Text>
              </TouchableOpacity>

              {formData.showEndPicker && (
                <DateTimePicker
                  value={formData.endDateTime}
                  mode={pickerMode}
                  is24Hour={false}
                  display="default"
                  onChange={handleEndDateTimeChange}
                  minimumDate={formData.startDateTime}
                />
              )}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Total Travel Time
            </Text>
            <Text
              style={[
                styles.calculatedValue,
                {
                  color: theme === "dark" ? "#FFFFFF" : "#111827",
                  backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                },
              ]}
            >
              {calculateTravelTime(
                formData.startDateTime,
                formData.endDateTime
              )}
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Average Speed (KM/H)
            </Text>
            <Text
              style={[
                styles.calculatedValue,
                {
                  color: theme === "dark" ? "#FFFFFF" : "#111827",
                  backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                },
              ]}
            >
              {calculateAverageSpeed(
                formData.totalKilometers,
                formData.startDateTime,
                formData.endDateTime
              )}
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Route Details
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                  color: theme === "dark" ? "#FFFFFF" : "#111827",
                  height: 80,
                },
              ]}
              value={formData.routeTaken}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, routeTaken: text }))
              }
              placeholder="Enter route details"
              placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
              multiline
            />
          </View>

          <View style={styles.travelButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.travelButton,
                { backgroundColor: theme === "dark" ? "#4B5563" : "#E5E7EB" },
              ]}
              onPress={handleTravelDetailsReset}
            >
              <Text
                style={[
                  styles.travelButtonText,
                  { color: theme === "dark" ? "#FFFFFF" : "#374151" },
                ]}
              >
                Reset
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.travelButton, { backgroundColor: "#10B981" }]}
              onPress={handleSaveTravelDetails}
            >
              <Text style={styles.travelButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Saved Travel Details List */}
        {savedTravelDetails.length > 0 && (
          <View style={styles.savedTravelDetails}>
            {savedTravelDetails.map((detail, index) => (
              <View
                key={detail.id}
                style={[
                  styles.savedTravelItem,
                  { backgroundColor: theme === "dark" ? "#374151" : "#E8F5E9" },
                ]}
              >
                <View style={styles.savedTravelContent}>
                  <View style={styles.savedTravelInfo}>
                    <Text
                      style={[
                        styles.savedTravelText,
                        { color: theme === "dark" ? "#10B981" : "#047857" },
                      ]}
                    >
                      Travel Details {index + 1}
                    </Text>
                    <Text
                      style={[
                        styles.savedTravelSubText,
                        { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
                      ]}
                    >
                      {`${detail.totalKilometers}km • ${format(
                        new Date(detail.startDateTime),
                        "dd MMM yyyy"
                      )}`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteTravelDetail(detail.id)}
                    style={styles.deleteButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={theme === "dark" ? "#EF4444" : "#DC2626"}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {showDatePicker && (
          <DateTimePicker
            value={dateType === "date" ? formData.date : formData.travelDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        {/* Expense Details Section */}
        <View
          style={[
            styles.section,
            { backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF" },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme === "dark" ? "#FFFFFF" : "#111827" },
            ]}
          >
            Expense Details
          </Text>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Lodging Expenses (₹)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                  color: theme === "dark" ? "#FFFFFF" : "#111827",
                },
              ]}
              value={formData.lodgingExpenses}
              onChangeText={(text) => {
                const numericValue = text.replace(/[^0-9.]/g, "");
                setFormData((prev) => ({
                  ...prev,
                  lodgingExpenses: numericValue,
                }));
              }}
              placeholder="0.00"
              placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Daily Allowance/Food (₹)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                  color: theme === "dark" ? "#FFFFFF" : "#111827",
                },
              ]}
              value={formData.dailyAllowance}
              onChangeText={(text) => {
                const numericValue = text.replace(/[^0-9.]/g, "");
                setFormData((prev) => ({
                  ...prev,
                  dailyAllowance: numericValue,
                }));
              }}
              placeholder="0.00"
              placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Diesel (₹)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                  color: theme === "dark" ? "#FFFFFF" : "#111827",
                },
              ]}
              value={formData.diesel}
              onChangeText={(text) => {
                const numericValue = text.replace(/[^0-9.]/g, "");
                setFormData((prev) => ({ ...prev, diesel: numericValue }));
              }}
              placeholder="0.00"
              placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Toll Charges (₹)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                  color: theme === "dark" ? "#FFFFFF" : "#111827",
                },
              ]}
              value={formData.tollCharges}
              onChangeText={(text) => {
                const numericValue = text.replace(/[^0-9.]/g, "");
                setFormData((prev) => ({ ...prev, tollCharges: numericValue }));
              }}
              placeholder="0.00"
              placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Other Expenses (₹)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                  color: theme === "dark" ? "#FFFFFF" : "#111827",
                },
              ]}
              value={formData.otherExpenses}
              onChangeText={(text) => {
                const numericValue = text.replace(/[^0-9.]/g, "");
                setFormData((prev) => ({
                  ...prev,
                  otherExpenses: numericValue,
                }));
              }}
              placeholder="0.00"
              placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: theme === "dark" ? "#4B5563" : "#E5E7EB" },
              ]}
              onPress={handleExpenseDetailsReset}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  { color: theme === "dark" ? "#FFFFFF" : "#374151" },
                ]}
              >
                Reset
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: "#10B981" }]}
              onPress={handleSaveExpenseDetails}
            >
              <Text style={[styles.actionButtonText, { color: "#FFFFFF" }]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Saved Expense Details List */}
        {savedExpenseDetails.length > 0 && (
          <View style={styles.savedDetailsContainer}>
            {savedExpenseDetails.map((detail, index) => (
              <View
                key={detail.id}
                style={[
                  styles.savedDetailItem,
                  { backgroundColor: theme === "dark" ? "#374151" : "#E8F5E9" },
                ]}
              >
                <View style={styles.savedDetailContent}>
                  <View style={styles.savedDetailInfo}>
                    <Text
                      style={[
                        styles.savedDetailTitle,
                        { color: theme === "dark" ? "#10B981" : "#047857" },
                      ]}
                    >
                      Expense Details {index + 1}
                    </Text>
                    <Text
                      style={[
                        styles.savedDetailSubText,
                        { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
                      ]}
                    >
                      {`Total Amount: ₹${detail.totalAmount.toFixed(2)}`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteExpenseDetail(detail.id)}
                    style={styles.deleteButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={theme === "dark" ? "#EF4444" : "#DC2626"}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Financial Summary Section */}
        <View
          style={[
            styles.section,
            { backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF" },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme === "dark" ? "#FFFFFF" : "#111827" },
            ]}
          >
            Financial Summary
          </Text>

          <View style={styles.summaryRow}>
            <Text
              style={[
                styles.summaryLabel,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Total Expenses
            </Text>
            <Text
              style={[
                styles.summaryValue,
                { color: theme === "dark" ? "#FFFFFF" : "#111827" },
              ]}
            >
              ₹ {calculateTotalAmount().toFixed(2)}
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280", marginTop: 10 },
              ]}
            >
              Advance Taken (₹)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
                  color: theme === "dark" ? "#FFFFFF" : "#111827",
                },
              ]}
              value={formData.advanceTaken}
              onChangeText={(text) => {
                const numericValue = text.replace(/[^0-9.]/g, "");
                setFormData((prev) => ({
                  ...prev,
                  advanceTaken: numericValue,
                }));
              }}
              placeholder="0.00"
              placeholderTextColor={theme === "dark" ? "#9CA3AF" : "#6B7280"}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.summaryRow}>
            <Text
              style={[
                styles.summaryLabel,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Amount {calculateAmountPayable() >= 0 ? "Payable" : "Receivable"}
            </Text>
            <Text
              style={[
                styles.summaryValue,
                { color: calculateAmountPayable() >= 0 ? "#10B981" : "#EF4444" },
              ]}
            >
              ₹ {Math.abs(calculateAmountPayable()).toFixed(2)}
            </Text>
          </View>

          <View style={styles.amountInWords}>
            <Text
              style={[
                styles.label,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Amount in Words:
            </Text>
            <Text
              style={[
                styles.wordsText,
                { color: theme === "dark" ? "#FFFFFF" : "#111827" },
              ]}
            >
              {convertNumberToWords(Math.abs(calculateAmountPayable()))} Rupees Only
            </Text>
          </View>
        </View>

        {/* Document Upload Section */}
        <TouchableOpacity
          style={[
            styles.uploadButton,
            { backgroundColor: theme === "dark" ? "#374151" : "#E5E7EB" },
          ]}
          onPress={handleDocumentUpload}
        >
          <Ionicons
            name="cloud-upload-outline"
            size={24}
            color={theme === "dark" ? "#FFFFFF" : "#111827"}
          />
          <Text
            style={[
              styles.uploadButtonText,
              { color: theme === "dark" ? "#FFFFFF" : "#111827" },
            ]}
          >
            Upload Supporting Documents
          </Text>
        </TouchableOpacity>

        {/* Display uploaded files */}
        {formData.supportingDocs.length > 0 && (
          <View style={styles.uploadedFiles}>
            {formData.supportingDocs.map((doc, index) => (
              <View
                key={index}
                style={[
                  styles.uploadedFile,
                  { backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6" },
                ]}
              >
                {doc.isImage ? (
                  <Image
                    source={{ uri: doc.uri }}
                    style={styles.documentThumbnail}
                  />
                ) : (
                  <Ionicons
                    name="document-outline"
                    size={24}
                    color={theme === "dark" ? "#FFFFFF" : "#111827"}
                  />
                )}
                <Text
                  style={[
                    styles.fileName,
                    { color: theme === "dark" ? "#FFFFFF" : "#111827" },
                  ]}
                  numberOfLines={1}
                >
                  {doc.name}
                </Text>
                <TouchableOpacity
                  onPress={() => removeDocument(index)}
                  style={styles.removeButton}
                >
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={theme === "dark" ? "#EF4444" : "#DC2626"}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: theme === "dark" ? "#3B82F6" : "#2563EB" },
            isSubmitting && { opacity: 0.7 }, // Add opacity when submitting
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting} // Disable button while submitting
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Claim</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Success Modal */}
      <Modal
        isVisible={showSuccessModal}
        backdropOpacity={0.5}
        animationIn="fadeIn"
        animationOut="fadeOut"
        useNativeDriver
        style={styles.modal}
      >
        <View
          style={[
            styles.successModal,
            { backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF" },
          ]}
        >
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={50} color="#10B981" />
          </View>
          <Text
            style={[
              styles.successTitle,
              { color: theme === "dark" ? "#FFFFFF" : "#111827" },
            ]}
          >
            Success!
          </Text>
          <Text
            style={[
              styles.successMessage,
              { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
            ]}
          >
            Expense claim submitted successfully
          </Text>
        </View>
      </Modal>

      {/* Document Upload Modal */}
      <Modal
        isVisible={showUploadModal}
        backdropOpacity={0.5}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        useNativeDriver
        onBackdropPress={() => setShowUploadModal(false)}
        style={styles.modal}
      >
        <View
          style={[
            styles.uploadModal,
            { backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF" },
          ]}
        >
          <View style={styles.uploadModalHeader}>
            <Text
              style={[
                styles.uploadModalTitle,
                { color: theme === "dark" ? "#FFFFFF" : "#111827" },
              ]}
            >
              Upload Document
            </Text>
            <TouchableOpacity
              onPress={() => setShowUploadModal(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="close"
                size={24}
                color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
              />
            </TouchableOpacity>
          </View>
          
          <Text
            style={[
              styles.uploadModalSubtitle,
              { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
            ]}
          >
            Choose upload method
          </Text>
          
          <TouchableOpacity
            style={[
              styles.uploadOption,
              { backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6" },
            ]}
            onPress={() => {
              setShowUploadModal(false);
              captureImage();
            }}
          >
            <View style={styles.uploadOptionIcon}>
              <Ionicons
                name="camera"
                size={24}
                color={theme === "dark" ? "#3B82F6" : "#2563EB"}
              />
            </View>
            <View style={styles.uploadOptionText}>
              <Text
                style={[
                  styles.uploadOptionTitle,
                  { color: theme === "dark" ? "#FFFFFF" : "#111827" },
                ]}
              >
                Take Photo
              </Text>
              <Text
                style={[
                  styles.uploadOptionDescription,
                  { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
                ]}
              >
                Use your camera to take a new photo
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.uploadOption,
              { backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6" },
            ]}
            onPress={() => {
              setShowUploadModal(false);
              pickDocument();
            }}
          >
            <View style={styles.uploadOptionIcon}>
              <Ionicons
                name="images"
                size={24}
                color={theme === "dark" ? "#10B981" : "#047857"}
              />
            </View>
            <View style={styles.uploadOptionText}>
              <Text
                style={[
                  styles.uploadOptionTitle,
                  { color: theme === "dark" ? "#FFFFFF" : "#111827" },
                ]}
              >
                Choose from Gallery
              </Text>
              <Text
                style={[
                  styles.uploadOptionDescription,
                  { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
                ]}
              >
                Select images or documents from your device
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.cancelButton,
              { borderColor: theme === "dark" ? "#4B5563" : "#E5E7EB" },
            ]}
            onPress={() => setShowUploadModal(false)}
          >
            <Text
              style={[
                styles.cancelButtonText,
                { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  companyName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  formCode: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "500",
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  readOnlyInput: {
    opacity: 0.8, // Makes it look slightly disabled
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
  },
  pickerContainer: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  datePickerButton: {
    marginBottom: 16,
  },
  datePickerValue: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
  },
  rowContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "600",
  },
  amountInWords: {
    marginTop: 16,
  },
  wordsText: {
    fontSize: 14,
    fontStyle: "italic",
    marginTop: 4,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  uploadedFiles: {
    marginTop: 10,
  },
  uploadedFile: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginVertical: 5,
    borderRadius: 8,
  },
  documentThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 10,
  },
  fileName: {
    flex: 1,
    marginRight: 10,
  },
  removeButton: {
    padding: 4,
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 32,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  rowInputs: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calculatedValue: {
    fontSize: 16,
    fontWeight: "500",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  resetButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  travelButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  travelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 8,
  },
  travelButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  savedTravelDetails: {
    marginTop: 8,
    marginBottom: 16,
  },
  savedTravelItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  savedTravelContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  savedTravelInfo: {
    flex: 1,
    marginRight: 8,
  },
  savedTravelText: {
    fontSize: 14,
    fontWeight: "500",
  },
  savedTravelSubText: {
    fontSize: 12,
    marginTop: 4,
  },
  deleteButton: {
    padding: 2,
    alignSelf: "center",
  },
  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  savedDetailsContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  savedDetailItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  savedDetailContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  savedDetailInfo: {
    flex: 1,
    marginRight: 8,
  },
  savedDetailTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  savedDetailSubText: {
    fontSize: 12,
    marginTop: 4,
  },
  modal: {
    margin: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  successModal: {
    width: "80%",
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#10B98120",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  uploadModal: {
    width: "90%",
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  uploadModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 16,
  },
  uploadModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  uploadModalSubtitle: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  uploadOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    width: "100%",
  },
  uploadOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3F4F620",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  uploadOptionText: {
    flex: 1,
  },
  uploadOptionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  uploadOptionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  cancelButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    width: "100%",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
