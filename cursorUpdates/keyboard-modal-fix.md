# Fixing Keyboard Crashing Issues in React Native Modals

This document provides a comprehensive guide to resolving keyboard crashing issues that commonly occur when using modals with input fields in React Native applications.

## Common Issues

1. **Keyboard crashes the app** when opening a modal with input fields
2. **Input focus issues** causing erratic behavior
3. **Keyboard doesn't dismiss** properly when closing the modal
4. **Layout shifts** when keyboard appears/disappears
5. **Race conditions** between modal animations and keyboard appearance

## Solution Implementation

### 1. Proper Modal Component Structure

```tsx
const EmployeePickerModal = memo(({
  show,
  onClose,
  employeeSearch,
  setEmployeeSearch,
  filteredEmployees,
  isDark,
  onSelectEmployee,
  selectedEmployeeId
}: EmployeePickerModalProps) => {
  const employeeInputRef = useRef<TextInput>(null);

  // Component implementation
});
```

- Use `React.memo()` to prevent unnecessary re-renders
- Accept clear, well-defined props through a dedicated interface
- Use a separate component rather than an inline modal definition

### 2. Controlled Input Focus

```tsx
const employeeInputRef = useRef<TextInput>(null);

useEffect(() => {
  if (show && Platform.OS === 'android') {
    setTimeout(() => {
      employeeInputRef.current?.focus();
    }, 300);
  }
}, [show]);
```

- Use a ref to control input focus
- Delay focus until after modal animation completes (300ms)
- Only auto-focus on Android when needed
- Set `autoFocus={false}` on the TextInput component

### 3. Proper Keyboard Handling

```tsx
<TouchableOpacity
  onPress={() => {
    setShowEmployeePicker(true);
    setEmployeeSearch('');
    Keyboard.dismiss(); // Explicitly dismiss keyboard
  }}
>
  {/* Button content */}
</TouchableOpacity>
```

- Explicitly call `Keyboard.dismiss()` when opening/closing modals
- Use `keyboardShouldPersistTaps="always"` on scrollable components
- Wrap modal content in a TouchableOpacity to dismiss keyboard on outside tap

### 4. Stable Modal Layout

```tsx
<Modal
  visible={show}
  transparent
  animationType="slide"
  onRequestClose={onClose}
>
  <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
    <View
      style={{
        maxHeight: '80%',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 20,
        backgroundColor: isDark ? '#1F2937' : '#fff'
      }}
    >
      {/* Modal content */}
    </View>
  </View>
</Modal>
```

- Use `flex: 1` and `justifyContent: 'flex-end'` for bottom sheet modals
- Set `maxHeight` to prevent the modal from taking the full screen
- Use `transparent` and a semi-transparent background for the overlay

### 5. Proper State Management

```tsx
// When opening the modal
onPress={() => {
  setShowEmployeePicker(true);
  setEmployeeSearch('');
  Keyboard.dismiss();
}}

// When selecting an item
onPress={() => {
  onSelectEmployee(item.id);
  onClose(); // Close modal first before updating other state
}}
```

- Clear input state when opening the modal
- Close the modal before updating other state to prevent race conditions
- Use separate state variables for different concerns

### 6. FlatList Configuration

```tsx
<FlatList
  data={filteredEmployees}
  keyboardShouldPersistTaps="always"
  keyExtractor={(item) => item.id.toString()}
  renderItem={renderEmployeeItem}
  showsVerticalScrollIndicator={true}
  contentContainerStyle={{ paddingBottom: 20 }}
/>
```

- Set `keyboardShouldPersistTaps="always"` to prevent keyboard dismissal on tap
- Use proper `keyExtractor` function
- Add padding to the content container to ensure items are visible above the keyboard

## Complete Implementation Example

```tsx
import React, { useState, useRef, useEffect, memo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmployeePickerModalProps {
  show: boolean;
  onClose: () => void;
  employeeSearch: string;
  setEmployeeSearch: (text: string) => void;
  filteredEmployees: Employee[];
  isDark: boolean;
  onSelectEmployee: (id: number) => void;
  selectedEmployeeId: number;
}

const EmployeePickerModal = memo(({
  show,
  onClose,
  employeeSearch,
  setEmployeeSearch,
  filteredEmployees,
  isDark,
  onSelectEmployee,
  selectedEmployeeId
}: EmployeePickerModalProps) => {
  const employeeInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (show && Platform.OS === 'android') {
      setTimeout(() => {
        employeeInputRef.current?.focus();
      }, 300);
    }
  }, [show]);

  return (
    <Modal
      visible={show}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
        activeOpacity={1}
        onPress={() => {
          Keyboard.dismiss();
          onClose();
        }}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={(e) => e.stopPropagation()}
          style={{
            maxHeight: '80%',
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            padding: 20,
            backgroundColor: isDark ? '#1F2937' : '#fff'
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: isDark ? '#fff' : '#000' }}>
              Select Employee
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>
          
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 10,
              marginBottom: 20,
              borderRadius: 8,
              backgroundColor: isDark ? '#374151' : '#f3f4f6'
            }}
          >
            <Ionicons name="search" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} style={{ marginRight: 8 }} />
            <TextInput
              ref={employeeInputRef}
              value={employeeSearch}
              onChangeText={setEmployeeSearch}
              placeholder="Search by name or employee number..."
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              style={{ flex: 1, color: isDark ? '#fff' : '#000' }}
              autoFocus={false}
            />
            {employeeSearch.length > 0 && (
              <TouchableOpacity onPress={() => setEmployeeSearch('')}>
                <Ionicons name="close-circle" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </TouchableOpacity>
            )}
          </View>
          
          {filteredEmployees.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Ionicons name="people" size={48} color={isDark ? '#4B5563' : '#9CA3AF'} />
              <Text style={{ marginTop: 16, textAlign: 'center', color: isDark ? '#9CA3AF' : '#6B7280' }}>
                No employees found
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredEmployees}
              keyboardShouldPersistTaps="always"
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{
                    padding: 16,
                    marginBottom: 10,
                    borderRadius: 8,
                    backgroundColor: selectedEmployeeId === item.id 
                      ? (isDark ? '#2563eb' : '#bfdbfe')
                      : (isDark ? '#374151' : '#f3f4f6')
                  }}
                  onPress={() => {
                    Keyboard.dismiss();
                    onSelectEmployee(item.id);
                    onClose();
                  }}
                >
                  <Text style={{ fontWeight: '500', color: isDark ? '#fff' : '#000' }}>
                    {item.name}
                  </Text>
                  <Text style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                    {item.employee_number}
                  </Text>
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
});
```

## Key Takeaways

1. **Memoize modal components** to prevent unnecessary re-renders
2. **Control input focus** with refs and delayed focus
3. **Explicitly dismiss the keyboard** when opening/closing modals
4. **Use proper layout techniques** for stable modal positioning
5. **Implement proper touch handling** to dismiss the keyboard on outside tap
6. **Configure FlatList properly** with `keyboardShouldPersistTaps="always"`
7. **Manage state carefully** to prevent race conditions
8. **Use nested TouchableOpacity components** for proper event propagation

By implementing these techniques, you can create modals with input fields that work reliably across different devices and platforms without keyboard-related crashes or issues. 