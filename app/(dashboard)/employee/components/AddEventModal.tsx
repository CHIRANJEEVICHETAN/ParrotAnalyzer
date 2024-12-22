import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

interface AddEventModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (event: {
    title: string;
    description: string;
    location: string;
    time: string;
    date: Date;
  }) => void;
  selectedDate: Date;
}

export default function AddEventModal({ visible, onClose, onSubmit, selectedDate }: AddEventModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [time, setTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an event title');
      return;
    }

    onSubmit({
      title,
      description,
      location,
      time: format(time, 'hh:mm a'),
      date: selectedDate,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setLocation('');
    setTime(new Date());
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <View className="bg-white rounded-t-xl p-4 h-2/3">
          <Text className="text-xl font-semibold mb-4">Add New Event</Text>
          
          <ScrollView>
            <View className="mb-4">
              <Text className="text-sm font-medium mb-1">Title *</Text>
              <TextInput
                className="border border-gray-200 rounded-lg p-2"
                value={title}
                onChangeText={setTitle}
                placeholder="Enter event title"
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium mb-1">Description</Text>
              <TextInput
                className="border border-gray-200 rounded-lg p-2"
                value={description}
                onChangeText={setDescription}
                placeholder="Enter event description"
                multiline
                numberOfLines={3}
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium mb-1">Location</Text>
              <TextInput
                className="border border-gray-200 rounded-lg p-2"
                value={location}
                onChangeText={setLocation}
                placeholder="Enter event location"
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium mb-1">Time</Text>
              <TouchableOpacity
                className="border border-gray-200 rounded-lg p-2"
                onPress={() => setShowTimePicker(true)}
              >
                <Text>{format(time, 'hh:mm a')}</Text>
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
          </ScrollView>

          <View className="flex-row justify-end mt-4 space-x-2">
            <TouchableOpacity
              className="px-4 py-2 rounded-lg bg-gray-200"
              onPress={onClose}
            >
              <Text>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="px-4 py-2 rounded-lg bg-blue-500"
              onPress={handleSubmit}
            >
              <Text className="text-white">Add Event</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
} 