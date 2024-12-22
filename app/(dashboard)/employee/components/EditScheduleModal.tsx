import React, { useState, useEffect } from 'react';
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
import { ScheduleEvent } from '../types';

interface EditScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (scheduleData: {
    id: number;
    title: string;
    description: string;
    location: string;
    time: string;
    date: string;
  }) => void;
  schedule: ScheduleEvent | null;
  isDark: boolean;
}

export default function EditScheduleModal({
  visible,
  onClose,
  onSubmit,
  schedule,
  isDark
}: EditScheduleModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [time, setTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (schedule) {
      setTitle(schedule.title);
      setDescription(schedule.description || '');
      setLocation(schedule.location || '');
      const [hours, minutes] = schedule.time.split(':');
      const timeDate = new Date();
      timeDate.setHours(parseInt(hours), parseInt(minutes));
      setTime(timeDate);
    }
  }, [schedule]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        id: schedule?.id || 0,
        title,
        description,
        location,
        time: format(time, 'HH:mm'),
        date: schedule?.date || '',
      });
    } catch (error) {
      console.error('Error updating schedule:', error);
      Alert.alert('Error', 'Failed to update schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <View 
          style={[
            styles.modalContent,
            { 
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
              borderColor: isDark ? '#374151' : '#E5E7EB',
              borderWidth: 1,
            }
          ]}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[
              styles.modalTitle,
              { color: isDark ? '#FFFFFF' : '#111827' }
            ]}>
              Edit Schedule
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons 
                name="close" 
                size={24} 
                color={isDark ? '#9CA3AF' : '#6B7280'} 
              />
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={[
                styles.label,
                { color: isDark ? '#D1D5DB' : '#374151' }
              ]}>
                Title *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: isDark ? '#374151' : '#F3F4F6',
                    color: isDark ? '#FFFFFF' : '#111827',
                    borderColor: isDark ? '#4B5563' : '#E5E7EB'
                  }
                ]}
                placeholder="Enter title"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[
                styles.label,
                { color: isDark ? '#D1D5DB' : '#374151' }
              ]}>
                Description
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { 
                    backgroundColor: isDark ? '#374151' : '#F3F4F6',
                    color: isDark ? '#FFFFFF' : '#111827',
                    borderColor: isDark ? '#4B5563' : '#E5E7EB'
                  }
                ]}
                placeholder="Enter description"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[
                styles.label,
                { color: isDark ? '#D1D5DB' : '#374151' }
              ]}>
                Location
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: isDark ? '#374151' : '#F3F4F6',
                    color: isDark ? '#FFFFFF' : '#111827',
                    borderColor: isDark ? '#4B5563' : '#E5E7EB'
                  }
                ]}
                placeholder="Enter location"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                value={location}
                onChangeText={setLocation}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[
                styles.label,
                { color: isDark ? '#D1D5DB' : '#374151' }
              ]}>
                Time
              </Text>
              <TouchableOpacity
                style={[
                  styles.timeButton,
                  { 
                    backgroundColor: isDark ? '#374151' : '#F3F4F6',
                    borderColor: isDark ? '#4B5563' : '#E5E7EB'
                  }
                ]}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons 
                  name="time-outline" 
                  size={20} 
                  color={isDark ? '#9CA3AF' : '#6B7280'} 
                  style={{ marginRight: 8 }}
                />
                <Text style={{ color: isDark ? '#FFFFFF' : '#111827' }}>
                  {format(time, 'hh:mm a')}
                </Text>
              </TouchableOpacity>
            </View>

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
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button, 
                styles.saveButton,
                isSubmitting && styles.buttonDisabled
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <View style={styles.buttonContent}>
                {isSubmitting ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinner} />
                    <Text style={styles.buttonText}>Saving...</Text>
                  </>
                ) : (
                  <Text style={styles.buttonText}>Save Changes</Text>
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
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    width: '100%',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  timeButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6B7280',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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