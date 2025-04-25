import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import ThemeContext from '../../../../context/ThemeContext';
import AuthContext from '../../../../context/AuthContext';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { format, differenceInDays, isWeekend } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

interface LeaveType {
  id: number;
  name: string;
  requires_documentation: boolean;
  max_days: number;
  max_consecutive_days: number;
  notice_period_days: number;
}

interface LeaveBalance {
  id: number;
  name: string;
  max_days: number;
  days_used: number;
}

interface Document {
  id?: number;
  file_name: string;
  file_type: string;
  file_data: string;
  upload_method: 'camera' | 'file';
}

interface RequestLeaveModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  leaveTypes: LeaveType[];
  balances: LeaveBalance[];
}

interface ErrorModalState {
  visible: boolean;
  title: string;
  message: string;
  type: 'error' | 'success' | 'warning';
}

export default function RequestLeaveModal({ visible, onClose, onSuccess, leaveTypes, balances }: RequestLeaveModalProps) {
  const { theme } = ThemeContext.useTheme();
  const { token, user } = AuthContext.useAuth();
  const isDark = theme === "dark";
  const screenWidth = Dimensions.get("window").width;

  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [errorModal, setErrorModal] = useState<ErrorModalState>({
    visible: false,
    title: "",
    message: "",
    type: "error",
  });

  useEffect(() => {
    if (visible) {
      resetForm();
      checkCameraPermission();
    }
  }, [visible]);

  const checkCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Camera permission is required for taking photos"
      );
    }
  };

  const resetForm = () => {
    setSelectedType(null);
    setStartDate(new Date());
    setEndDate(new Date());
    setReason("");
    setContactNumber("");
    setDocuments([]);
    setErrors({});
  };

  const showError = (
    title: string,
    message: string,
    type: ErrorModalState["type"] = "error"
  ) => {
    setErrorModal({
      visible: true,
      title,
      message,
      type,
    });
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!selectedType) {
      showError("Warning", "Please select a leave type", "warning");
      return false;
    }

    const selectedLeaveType = leaveTypes.find(
      (type) => type.id === selectedType
    );
    if (!selectedLeaveType) return false;

    // Notice Period Validation
    const noticeDays = differenceInDays(startDate, today);

    if (noticeDays < selectedLeaveType.notice_period_days) {
      const earliestPossibleDate = new Date();
      earliestPossibleDate.setDate(
        earliestPossibleDate.getDate() + selectedLeaveType.notice_period_days
      );

      showError(
        "Notice Period Required",
        `This leave type requires ${selectedLeaveType.notice_period_days} days advance notice.\n\n` +
          `• Required Notice: ${selectedLeaveType.notice_period_days} days\n` +
          `• Earliest Possible Date: ${format(
            earliestPossibleDate,
            "MMM dd, yyyy"
          )}\n\n` +
          `Please adjust your start date to comply with the notice period requirement.`,
        "warning"
      );
      return false;
    }

    if (!reason.trim()) {
      showError("Warning", "Please provide a reason for leave", "warning");
      return false;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(contactNumber)) {
      showError(
        "Warning",
        "Please enter a valid 10-digit mobile number starting with 6-9",
        "warning"
      );
      return false;
    }

    if (startDate < today) {
      showError("Warning", "Start date cannot be in the past", "warning");
      return false;
    }

    if (endDate < startDate) {
      showError("Warning", "End date cannot be before start date", "warning");
      return false;
    }

    if (selectedLeaveType.requires_documentation && documents.length === 0) {
      showError("Warning", "Please upload required documentation", "warning");
      return false;
    }

    const workingDays = calculateWorkingDays(startDate, endDate);
    if (workingDays > selectedLeaveType.max_consecutive_days) {
      showError(
        "Warning",
        `Maximum ${selectedLeaveType.max_consecutive_days} consecutive working days allowed`,
        "warning"
      );
      return false;
    }

    return true;
  };

  const calculateWorkingDays = (start: Date, end: Date) => {
    let days = 0;
    const current = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    while (current <= endDate) {
      if (!isWeekend(current)) {
        days++;
      }
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const handleDocumentUpload = async (method: "camera" | "file") => {
    try {
      if (method === "camera") {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.7,
          allowsEditing: true,
          base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
          const imageAsset = result.assets[0];
          const base64Data = imageAsset.base64;

          if (!base64Data) {
            throw new Error("Failed to get image data");
          }

          const newDocument: Document = {
            file_name: `photo_${Date.now()}.jpg`,
            file_type: "image/jpeg",
            file_data: base64Data,
            upload_method: "camera",
          };

          if (newDocument.file_data.length > 5 * 1024 * 1024) {
            Alert.alert("Error", "File size should not exceed 5MB");
            return;
          }

          setDocuments((prev) => [...prev, newDocument]);
          setErrors((prev) => ({ ...prev, documents: "" }));
        }
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["image/*", "application/pdf"],
          copyToCacheDirectory: true,
        });

        if (!result.canceled) {
          const docAsset = result.assets[0];
          const base64Data = await FileSystem.readAsStringAsync(docAsset.uri, {
            encoding: "base64",
          });

          const timestamp = Date.now();
          const extension = docAsset.mimeType
            ? `.${docAsset.mimeType.split("/")[1]}`
            : "";
          const fileName = docAsset.name || `file_${timestamp}${extension}`;

          const newDocument: Document = {
            file_name: fileName,
            file_type: docAsset.mimeType || "application/octet-stream",
            file_data: base64Data,
            upload_method: "file",
          };

          if (base64Data.length > 5 * 1024 * 1024) {
            Alert.alert("Error", "File size should not exceed 5MB");
            return;
          }

          setDocuments((prev) => [...prev, newDocument]);
          setErrors((prev) => ({ ...prev, documents: "" }));
        }
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      Alert.alert("Error", "Failed to upload document");
    }
  };

  const removeDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Find the selected leave type
      const selectedLeaveType = leaveTypes.find(
        (type) => type.id === selectedType
      );
      if (!selectedLeaveType) {
        showError("Error", "Invalid leave type selected", "error");
        return;
      }

      // Find the corresponding balance
      const leaveBalance = balances.find(
        (balance) => balance.name === selectedLeaveType.name
      );
      if (!leaveBalance) {
        showError(
          "Warning",
          "Leave balance not found. Please contact your administrator.",
          "warning"
        );
        return;
      }

      // Calculate requested days
      const requestedDays = calculateWorkingDays(startDate, endDate);
      const availableDays = leaveBalance.max_days - leaveBalance.days_used;

      // Check if enough days are available
      if (availableDays < requestedDays) {
        showError(
          "Warning",
          `Insufficient leave balance.\n\n` +
            `• Available Balance: ${availableDays} days\n` +
            `• Requested Days: ${requestedDays} days\n` +
            `• Total Balance: ${leaveBalance.max_days} days\n` +
            `• Used Days: ${leaveBalance.days_used} days`,
          "warning"
        );
        return;
      }

      // Proceed with submitting the leave request
      const formData = {
        leave_type_id: selectedType,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        reason,
        contact_number: contactNumber,
        documents: documents.map((doc) => ({
          file_name: doc.file_name,
          file_type: doc.file_type,
          file_data: doc.file_data,
          upload_method: doc.upload_method,
        })),
      };

      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/leave/request`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Send notification to group admin
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/employee-notifications/notify-admin`,
        {
          title: `📋 Leave Request Submitted\n By 👤 ${
            user?.name || "Employee"
          }`,
          message:
            `━━━━━━━━ 📅 Leave Details ━━━━━━━━\n` +
            `🗓️ Duration\n` +
            `• Start: ${format(startDate, "dd MMM yyyy")}\n` +
            `• End: ${format(endDate, "dd MMM yyyy")}\n\n` +
            `📝 Request Info\n` +
            `• Type: ${leaveTypes.find((t) => t.id === selectedType)?.name}\n` +
            `• Reason: ${reason}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          type: "leave-request",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setErrorModal({
        visible: true,
        title: "Success!",
        message:
          "Your leave request has been submitted successfully. You will be notified once it is reviewed.",
        type: "success",
      });

      // Wait for user to acknowledge success before closing
      const timer = setTimeout(() => {
        setErrorModal((prev) => ({ ...prev, visible: false }));
        onSuccess?.();
        onClose();
      }, 2000);

      return () => clearTimeout(timer);
    } catch (error: any) {
      const errorDetails = error.response?.data?.details;
      const errorMessage =
        errorDetails?.message ||
        error.response?.data?.error ||
        "Failed to submit request";

      if (errorDetails?.required_days) {
        showError(
          "Notice Period Required",
          `This leave type requires ${errorDetails.required_days} days advance notice.\n\n` +
            `• Required Notice: ${errorDetails.required_days} days\n` +
            `• Earliest Possible Date: ${format(
              new Date(errorDetails.earliest_possible_date),
              "MMM dd, yyyy"
            )}\n\n` +
            `Please adjust your start date to comply with the notice period requirement.`,
          "warning"
        );
      } else if (
        error.response?.data?.error === "Insufficient leave balance" &&
        errorDetails
      ) {
        showError(
          "Insufficient Leave Balance",
          `You don't have enough leave balance.\n\n` +
            `• Available Balance: ${errorDetails.available_days} days\n` +
            `• Requested Days: ${errorDetails.requested_days} days\n` +
            `• Total Balance: ${errorDetails.total_balance} days\n` +
            `• Used Days: ${errorDetails.used_days} days\n` +
            `• Pending Days: ${errorDetails.pending_days} days`,
          "warning"
        );
      } else {
        setErrorModal({
          visible: true,
          title: "Request Failed",
          message: errorMessage,
          type: "error",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="fade"
        transparent={true}
        onRequestClose={onClose}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className={`w-11/12 max-h-[90%] rounded-xl ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            {/* Header */}
            <View className="p-4 border-b border-gray-200">
              <View className="flex-row justify-between items-center">
                <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  New Leave Request
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color={isDark ? '#D1D5DB' : '#6B7280'} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView className="p-4">
              {/* Leave Type */}
              <View className="mb-4">
                <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Leave Type <Text className="text-red-500">*</Text>
                </Text>
                <View className={`border rounded-lg ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} ${
                  errors.leaveType ? 'border-red-500' : ''
                }`}>
                  <Picker
                    selectedValue={selectedType}
                    onValueChange={(value) => {
                      setSelectedType(value);
                      setErrors(prev => ({ ...prev, leaveType: '' }));
                    }}
                    style={{
                      color: isDark ? '#FFFFFF' : '#111827',
                    }}
                  >
                    <Picker.Item label="Select Leave Type" value={null} />
                    {leaveTypes.map(type => (
                      <Picker.Item key={type.id} label={type.name} value={type.id} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Date Selection */}
              <View className="flex-row space-x-4 gap-4 mb-4">
                <View className="flex-1">
                  <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Start Date <Text className="text-red-500">*</Text>
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowStartDate(true)}
                    className={`p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
                  >
                    <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                      {format(startDate, 'MMM dd, yyyy')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="flex-1">
                  <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    End Date <Text className="text-red-500">*</Text>
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowEndDate(true)}
                    className={`p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
                  >
                    <Text className={isDark ? 'text-white' : 'text-gray-900'}>
                      {format(endDate, 'MMM dd, yyyy')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Date Pickers */}
              {(showStartDate || showEndDate) && (
                <DateTimePicker
                  value={showStartDate ? startDate : endDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    if (showStartDate) {
                      setShowStartDate(false);
                      if (selectedDate) setStartDate(selectedDate);
                    } else {
                      setShowEndDate(false);
                      if (selectedDate) setEndDate(selectedDate);
                    }
                  }}
                />
              )}

              {/* Reason */}
              <View className="mb-4">
                <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Reason <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  value={reason}
                  onChangeText={(text) => {
                    setReason(text);
                    setErrors(prev => ({ ...prev, reason: '' }));
                  }}
                  multiline
                  numberOfLines={3}
                  className={`p-3 rounded-lg ${
                    isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  } ${errors.reason ? 'border border-red-500' : ''}`}
                  placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                  placeholder="Enter reason for leave"
                />
              </View>

              {/* Contact Number */}
              <View className="mb-4">
                <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Contact Number <Text className="text-red-500">*</Text>
                </Text>
                <View className={`flex-row items-center rounded-lg ${
                  isDark ? 'bg-gray-800' : 'bg-gray-100'
                } ${errors.contactNumber ? 'border border-red-500' : ''}`}>
                  <Text className={`px-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>+91</Text>
                  <TextInput
                    value={contactNumber}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/\D/g, '').slice(0, 10);
                      setContactNumber(cleaned);
                      setErrors(prev => ({ ...prev, contactNumber: '' }));
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                    className={`flex-1 p-3 ${isDark ? 'text-white' : 'text-gray-900'}`}
                    placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                    placeholder="Enter mobile number"
                  />
                </View>
              </View>

              {/* Document Upload */}
              {selectedType && leaveTypes.find(t => t.id === selectedType)?.requires_documentation && (
                <View className="mb-4">
                  <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Documents Required <Text className="text-red-500">*</Text>
                  </Text>
                  <View className="flex-row space-x-4 gap-4 mb-4">
                    <TouchableOpacity
                      onPress={() => handleDocumentUpload('camera')}
                      className="flex-1 bg-blue-500 p-3 rounded-lg flex-row justify-center items-center"
                    >
                      <Ionicons name="camera" size={20} color="white" style={{ marginRight: 8 }} />
                      <Text className="text-white font-medium">Camera</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDocumentUpload('file')}
                      className="flex-1 bg-green-500 p-3 rounded-lg flex-row justify-center items-center"
                    >
                      <Ionicons name="document" size={20} color="white" style={{ marginRight: 8 }} />
                      <Text className="text-white font-medium">Upload</Text>
                    </TouchableOpacity>
                  </View>

                  {documents.map((doc, index) => (
                    <View
                      key={index}
                      className={`flex-row justify-between items-center p-3 rounded-lg mb-3 ${
                        isDark ? 'bg-gray-800' : 'bg-gray-100'
                      }`}
                    >
                      <View className="flex-row items-center flex-1 mr-2">
                        <Ionicons
                          name={doc.file_type.includes('image') ? 'image' : 'document-text'}
                          size={20}
                          color={isDark ? '#D1D5DB' : '#6B7280'}
                        />
                        <Text 
                          className={`ml-2 ${isDark ? 'text-white' : 'text-gray-900'}`}
                          numberOfLines={1}
                          style={{ maxWidth: screenWidth * 0.6 }}
                        >
                          {doc.file_name}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        onPress={() => removeDocument(index)}
                        className="p-2"
                      >
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
            
            {/* Sticky Submit Button Container */}
            <View className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                className={`bg-blue-500 p-4 rounded-lg ${loading ? 'opacity-70' : ''}`}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-center font-semibold">
                    Submit Request
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error/Success Modal */}
      <Modal
        visible={errorModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModal(prev => ({ ...prev, visible: false }))}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className={`w-11/12 p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <View className="items-center mb-4">
              <Ionicons
                name={
                  errorModal.type === 'success'
                    ? 'checkmark-circle'
                    : errorModal.type === 'warning'
                    ? 'warning'
                    : 'alert-circle'
                }
                size={48}
                color={
                  errorModal.type === 'success'
                    ? '#10B981'
                    : errorModal.type === 'warning'
                    ? '#F59E0B'
                    : '#EF4444'
                }
              />
            </View>
            <Text className={`text-lg font-semibold text-center mb-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              {errorModal.title}
            </Text>
            <Text className={`text-center mb-6 ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {errorModal.message}
            </Text>
            <TouchableOpacity
              onPress={() => setErrorModal(prev => ({ ...prev, visible: false }))}
              className={`py-3 rounded-lg ${
                errorModal.type === 'success'
                  ? 'bg-green-500'
                  : errorModal.type === 'warning'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
            >
              <Text className="text-white text-center font-medium">
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
} 