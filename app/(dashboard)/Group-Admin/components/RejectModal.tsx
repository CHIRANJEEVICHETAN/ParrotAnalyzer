import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  onReject: (reason: string) => void;
  isDark: boolean;
}

export default function RejectModal({ visible, onClose, onReject, isDark }: Props) {
  const [reason, setReason] = useState('');

  const handleReject = () => {
    if (reason.trim()) {
      onReject(reason.trim());
      setReason('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View
          className={`w-[90%] p-4 rounded-lg ${
            isDark ? "bg-gray-800" : "bg-white"
          }`}
          style={styles.modalContent}
        >
          <Text
            className={`text-lg font-semibold mb-4 ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Reject Expense
          </Text>
          <TextInput
            placeholder="Enter reason for rejection"
            placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            className={`border p-2 rounded-lg mb-4 ${
              isDark
                ? "border-gray-600 text-white"
                : "border-gray-300 text-gray-900"
            }`}
          />
          <View className="flex-row justify-end gap-3 space-x-2">
            <TouchableOpacity
              onPress={onClose}
              className="px-4 py-2 rounded-lg bg-gray-500"
            >
              <Text className="text-white font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleReject}
              className="px-4 py-2 rounded-lg bg-red-500"
              disabled={!reason.trim()}
            >
              <Text className="text-white font-medium">Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
}); 