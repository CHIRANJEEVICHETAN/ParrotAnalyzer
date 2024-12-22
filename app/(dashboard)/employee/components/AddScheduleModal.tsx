import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

interface AddScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (scheduleData: {
    title: string;
    description: string;
    location: string;
    time: string;
    date: string;
  }) => void;
  selectedDate: string;
  isDark: boolean;
}

export default function AddScheduleModal({ 
  visible, 
  onClose, 
  onSubmit, 
  selectedDate,
  isDark 
}: AddScheduleModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [time, setTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title,
        description,
        location,
        time: format(time, 'HH:mm'),
        date: selectedDate,
      });
      
      // Reset form (will only execute if submission was successful)
      setTitle('');
      setDescription('');
      setLocation('');
      setTime(new Date());
    } catch (error) {
      console.error('Error submitting schedule:', error);
      Alert.alert('Error', 'Failed to add schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.modalContent,
          { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }
        ]}>
          <View style={styles.modalHeader}>
            <Text style={[
              styles.modalTitle,
              { color: isDark ? '#FFFFFF' : '#111827' }
            ]}>
              Add Schedule
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons 
                name="close" 
                size={24} 
                color={isDark ? '#9CA3AF' : '#6B7280'} 
              />
            </TouchableOpacity>
          </View>

          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: isDark ? '#374151' : '#F3F4F6',
                color: isDark ? '#FFFFFF' : '#111827'
              }
            ]}
            placeholder="Title"
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            style={[
              styles.input,
              styles.textArea,
              { 
                backgroundColor: isDark ? '#374151' : '#F3F4F6',
                color: isDark ? '#FFFFFF' : '#111827'
              }
            ]}
            placeholder="Description"
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: isDark ? '#374151' : '#F3F4F6',
                color: isDark ? '#FFFFFF' : '#111827'
              }
            ]}
            placeholder="Location"
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            value={location}
            onChangeText={setLocation}
          />

          <TouchableOpacity
            style={[
              styles.timeButton,
              { backgroundColor: isDark ? '#374151' : '#F3F4F6' }
            ]}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={{ color: isDark ? '#FFFFFF' : '#111827' }}>
              {format(time, 'hh:mm a')}
            </Text>
          </TouchableOpacity>

          {showTimePicker && (
            <DateTimePicker
              value={time}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={(event, selectedTime) => {
                setShowTimePicker(Platform.OS === 'ios');
                if (selectedTime) {
                  setTime(selectedTime);
                }
              }}
            />
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button, 
                styles.submitButton,
                isSubmitting && styles.buttonDisabled
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <View style={styles.buttonContent}>
                {isSubmitting ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinner} />
                    <Text style={styles.buttonText}>Adding...</Text>
                  </>
                ) : (
                  <Text style={styles.buttonText}>Add Schedule</Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  input: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  timeButton: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 100,
  },
  cancelButton: {
    backgroundColor: '#6B7280',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
}); 