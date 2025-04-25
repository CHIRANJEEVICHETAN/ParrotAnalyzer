import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import ThemeContext from '../../../context/ThemeContext';

// Define the modal types and corresponding colors and icons
const MODAL_TYPES = {
  SUCCESS: {
    backgroundColor: '#10B981', // green-500
    darkBackgroundColor: '#065F46', // green-800
    iconName: 'checkmark-circle',
    materialIconName: 'check-circle',
    secondaryIcon: 'thumbs-up',
    title: 'Success',
    buttonText: 'Great!',
    bgOpacity: 0.2,
    lightBgOpacity: 0.1,
  },
  ERROR: {
    backgroundColor: '#EF4444', // red-500
    darkBackgroundColor: '#991B1B', // red-800
    iconName: 'close-circle',
    materialIconName: 'close-circle',
    secondaryIcon: 'alert-circle',
    title: 'Error',
    buttonText: 'Understood',
    bgOpacity: 0.2,
    lightBgOpacity: 0.1,
  },
  WARNING: {
    backgroundColor: '#F59E0B', // amber-500
    darkBackgroundColor: '#92400E', // amber-800
    iconName: 'warning',
    materialIconName: 'alert-circle',
    secondaryIcon: 'alert',
    title: 'Warning',
    buttonText: 'Got It',
    bgOpacity: 0.2,
    lightBgOpacity: 0.1,
  },
  INFO: {
    backgroundColor: '#3B82F6', // blue-500
    darkBackgroundColor: '#1E40AF', // blue-800
    iconName: 'information-circle',
    materialIconName: 'information',
    secondaryIcon: 'bulb',
    title: 'Information',
    buttonText: 'OK',
    bgOpacity: 0.2,
    lightBgOpacity: 0.1,
  },
  CUSTOM: {
    backgroundColor: '#6B7280', // gray-500
    darkBackgroundColor: '#1F2937', // gray-800
    iconName: 'alert-circle',
    materialIconName: 'bell',
    secondaryIcon: 'chatbubble-ellipses',
    title: 'Notification',
    buttonText: 'OK',
    bgOpacity: 0.15,
    lightBgOpacity: 0.08,
  },
  TASK_SUCCESS: {
    backgroundColor: '#4ADE80', // green-400
    darkBackgroundColor: '#16A34A', // green-600
    iconName: 'checkmark-circle',
    materialIconName: 'check-circle',
    secondaryIcon: 'checkmark-circle',
    title: 'Success!',
    buttonText: 'Continue',
    bgOpacity: 0.2,
    lightBgOpacity: 0.1,
  },
  PASSWORD_CHANGE: {
    backgroundColor: '#10B981', // green-500
    darkBackgroundColor: '#065F46', // green-800
    iconName: 'lock-closed',
    materialIconName: 'lock',
    secondaryIcon: 'lock-closed',
    title: 'Password Changed',
    buttonText: 'Continue',
    bgOpacity: 0.2,
    lightBgOpacity: 0.1,
  },
};

type ModalType = 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO' | 'CUSTOM' | 'TASK_SUCCESS' | 'PASSWORD_CHANGE';

interface CustomModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  type?: ModalType;
  customIcon?: string;
  customColor?: string;
  customDarkColor?: string;
  showCloseButton?: boolean;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  onCancel?: () => void;
  children?: React.ReactNode;
  modalSize?: 'small' | 'medium' | 'large' | 'fullWidth';
  closeOnBackdropPress?: boolean;
  containerStyle?: ViewStyle;
  titleStyle?: TextStyle;
  messageStyle?: TextStyle;
  backdropOpacity?: number;
  autoClose?: number; // Time in ms after which modal should auto close
  fullscreen?: boolean; // Whether to display the modal in fullscreen
}

const { width, height } = Dimensions.get('window');

const getModalWidth = (size: string) => {
  switch (size) {
    case 'small':
      return width * 0.7;
    case 'medium':
      return width * 0.85;
    case 'large':
      return width * 0.95;
    case 'fullWidth':
      return width * 0.95;
    default:
      return width * 0.85;
  }
};

export default function CustomModal({
  visible,
  onClose,
  title,
  message,
  type = 'CUSTOM',
  customIcon,
  customColor,
  customDarkColor,
  showCloseButton = true,
  onConfirm,
  confirmText,
  cancelText = 'Cancel',
  onCancel,
  children,
  modalSize = 'medium',
  closeOnBackdropPress = true,
  containerStyle,
  titleStyle,
  messageStyle,
  backdropOpacity = 0.5,
  autoClose,
  fullscreen = false,
}: CustomModalProps) {
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === 'dark';
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Auto close timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get modal configuration based on type
  const modalConfig = MODAL_TYPES[type];
  
  // Allow custom color override
  const backgroundColor = customColor || 
    (isDark ? modalConfig.darkBackgroundColor : modalConfig.backgroundColor);
  
  // Allow custom icon override
  const iconName = customIcon || modalConfig.iconName;
  const materialIconName = modalConfig.materialIconName;
  const secondaryIconName = modalConfig.secondaryIcon;
  
  // Allow custom title and button text override
  const modalTitle = title || modalConfig.title;
  const defaultConfirmText = confirmText || modalConfig.buttonText;
  
  useEffect(() => {
    if (visible) {
      // Start animations when modal becomes visible
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(iconRotate, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Start pulse animation for attention
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Set up auto close if specified
      if (autoClose && autoClose > 0) {
        timerRef.current = setTimeout(() => {
          handleClose();
        }, autoClose);
      }
    } else {
      // Reset animations when modal is hidden
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      iconRotate.setValue(0);
    }
    
    return () => {
      // Clean up timer on unmount
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [visible, autoClose]);
  
  const handleClose = () => {
    // Animate out before closing
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    });
  };
  
  // Transform for icon rotation
  const spin = iconRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  // Render a fullscreen modal
  if (fullscreen) {
    // Get type-specific styling
    const bgColor = backgroundColor;
    const iconBgOpacity = isDark ? modalConfig.bgOpacity : modalConfig.lightBgOpacity;
    
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="none"
        onRequestClose={handleClose}
      >
        <Animated.View 
          className={`
            absolute inset-0 flex justify-center items-center z-50
            ${isDark ? 'bg-gray-900/95' : 'bg-white/95'}
          `}
          style={{ opacity: fadeAnim }}
        >
          <Animated.View 
            className="items-center px-6"
            style={{ transform: [{ scale: scaleAnim }] }}
          >
            <Animated.View 
              className={`
                w-20 h-20 rounded-full mb-6 justify-center items-center
              `}
              style={{ 
                transform: [{ scale: pulseAnim }],
                backgroundColor: type === 'SUCCESS' || type === 'TASK_SUCCESS' || type === 'PASSWORD_CHANGE' 
                  ? isDark ? 'rgba(74, 222, 128, 0.2)' : 'rgba(74, 222, 128, 0.1)'
                  : type === 'ERROR'
                  ? isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)'
                  : type === 'WARNING'
                  ? isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)'
                  : type === 'INFO'
                  ? isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'
                  : isDark ? 'rgba(107, 114, 128, 0.2)' : 'rgba(229, 231, 235, 0.2)'
              }}
            >
              <MaterialCommunityIcons
                name={materialIconName as any}
                size={48}
                color={bgColor}
              />
            </Animated.View>
            
            <Text className={`
              text-2xl font-semibold mb-2 text-center
              ${isDark ? 'text-white' : 'text-gray-900'}
            `}>
              {modalTitle}
            </Text>
            
            {message && (
              <Text className={`
                text-base text-center mb-6
                ${isDark ? 'text-gray-300' : 'text-gray-600'}
              `}>
                {message}
              </Text>
            )}
            
            {children}
            
            {onConfirm && (
              <TouchableOpacity
                className={`
                  mt-6 py-3 px-8 rounded-lg
                `}
                style={{
                  backgroundColor: backgroundColor
                }}
                onPress={() => {
                  if (onConfirm) onConfirm();
                  handleClose();
                }}
              >
                <Text className="text-white font-medium text-base">
                  {defaultConfirmText}
                </Text>
              </TouchableOpacity>
            )}
            
            {showCloseButton && !onConfirm && (
              <TouchableOpacity
                className="absolute top-12 right-6"
                onPress={handleClose}
                hitSlop={{ top: 15, right: 15, bottom: 15, left: 15 }}
              >
                <Ionicons 
                  name="close" 
                  size={28} 
                  color={isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)"} 
                />
              </TouchableOpacity>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  }
  
  // Standard modal for other types
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback
        onPress={closeOnBackdropPress ? handleClose : undefined}
      >
        <Animated.View 
          className="flex-1 justify-center items-center"
          style={[
            { opacity: fadeAnim, backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})` },
          ]}
        >
          <TouchableWithoutFeedback>
            <Animated.View
              className={`
                ${modalSize === 'small' ? 'w-[70%]' : 
                  modalSize === 'medium' ? 'w-[85%]' : 
                  modalSize === 'large' ? 'w-[95%]' : 'w-[95%]'}
                max-w-lg
                rounded-2xl overflow-hidden
                ${isDark ? 'bg-gray-800' : 'bg-white'}
                shadow-2xl
              `}
              style={[
                { transform: [{ scale: scaleAnim }] },
                containerStyle,
              ]}
            >
              {/* Modal Icon - Only shown for certain types */}
              {(['SUCCESS', 'ERROR', 'WARNING', 'INFO', 'PASSWORD_CHANGE'].includes(type)) && (
                <View className="absolute -top-12 left-1/2 z-10 transform -translate-x-1/2">
                  <Animated.View
                    className={`
                      p-3 rounded-full
                      ${type === 'SUCCESS' || type === 'PASSWORD_CHANGE' ? (isDark ? 'bg-green-700' : 'bg-green-500') :
                        type === 'ERROR' ? (isDark ? 'bg-red-700' : 'bg-red-500') :
                        type === 'WARNING' ? (isDark ? 'bg-amber-700' : 'bg-amber-500') :
                        type === 'INFO' ? (isDark ? 'bg-blue-700' : 'bg-blue-500') :
                        isDark ? 'bg-gray-700' : 'bg-gray-500'}
                      shadow-lg border-2 border-white
                    `}
                    style={{ transform: [{ scale: pulseAnim }] }}
                  >
                    <Animated.View style={{ transform: [{ rotate: spin }] }}>
                      <Ionicons 
                        name={iconName as any} 
                        size={32} 
                        color="white"
                      />
                    </Animated.View>
                  </Animated.View>
                </View>
              )}

              {/* Modal Header */}
              <View className={`
                flex-row items-center px-6 py-4
                ${type === 'SUCCESS' || type === 'PASSWORD_CHANGE' ? (isDark ? 'bg-green-800/90' : 'bg-green-500/90') :
                  type === 'ERROR' ? (isDark ? 'bg-red-800/90' : 'bg-red-500/90') :
                  type === 'WARNING' ? (isDark ? 'bg-amber-800/90' : 'bg-amber-500/90') :
                  type === 'INFO' ? (isDark ? 'bg-blue-800/90' : 'bg-blue-500/90') :
                  isDark ? 'bg-gray-700/90' : 'bg-gray-500/90'}
              `}>
                <Ionicons 
                  name={secondaryIconName as any} 
                  size={22} 
                  color="white"
                  className="mr-3"
                />
                <Text className="flex-1 text-white text-lg font-semibold" style={titleStyle}>
                  {modalTitle}
                </Text>
                
                {showCloseButton && (
                  <TouchableOpacity
                    className="p-1 rounded-full active:bg-white/20"
                    onPress={handleClose}
                    hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  >
                    <Ionicons name="close" size={18} color="white" />
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Modal Content */}
              <View className="p-6 pt-8">
                {message ? (
                  <Text className={`
                    text-base leading-6 mb-6 text-center
                    ${isDark ? 'text-gray-200' : 'text-gray-700'}
                  `} style={messageStyle}>
                    {message}
                  </Text>
                ) : null}
                
                {children}
                
                {/* Action Buttons */}
                {(onConfirm || onCancel) && (
                  <View className={`
                    flex-row ${onCancel && onConfirm ? 'justify-between' : 'justify-center'} 
                    space-x-3 mt-4
                  `}>
                    {onCancel && (
                      <TouchableOpacity
                        className={`
                          px-5 py-3 rounded-lg flex-1 
                          ${onConfirm ? 'max-w-[45%]' : ''}
                          border
                          ${isDark ? 'bg-gray-700 active:bg-gray-600 border-gray-600' : 
                            'bg-gray-100 active:bg-gray-200 border-gray-200'}
                        `}
                        onPress={() => {
                          if (onCancel) onCancel();
                          handleClose();
                        }}
                      >
                        <Text className={`
                          text-base font-medium text-center
                          ${isDark ? 'text-gray-200' : 'text-gray-700'}
                        `}>
                          {cancelText}
                        </Text>
                      </TouchableOpacity>
                    )}
                    
                    {onConfirm && (
                      <TouchableOpacity
                        className={`
                          px-5 py-3 rounded-lg ${onCancel ? 'flex-1 max-w-[55%]' : 'min-w-[50%]'}
                          ${type === 'SUCCESS' || type === 'PASSWORD_CHANGE' ? (isDark ? 'bg-green-700 active:bg-green-600' : 'bg-green-500 active:bg-green-600') :
                            type === 'ERROR' ? (isDark ? 'bg-red-700 active:bg-red-600' : 'bg-red-500 active:bg-red-600') :
                            type === 'WARNING' ? (isDark ? 'bg-amber-700 active:bg-amber-600' : 'bg-amber-500 active:bg-amber-600') :
                            type === 'INFO' ? (isDark ? 'bg-blue-700 active:bg-blue-600' : 'bg-blue-500 active:bg-blue-600') :
                            isDark ? 'bg-gray-700 active:bg-gray-600' : 'bg-gray-500 active:bg-gray-600'}
                        `}
                        onPress={() => {
                          if (onConfirm) onConfirm();
                          handleClose();
                        }}
                      >
                        <View className="flex-row justify-center items-center">
                          <Text className="text-white text-base font-medium text-center">
                            {confirmText || defaultConfirmText}
                          </Text>
                          <Ionicons 
                            name={type === 'SUCCESS' || type === 'PASSWORD_CHANGE' ? 'checkmark' : 
                                  type === 'ERROR' ? 'alert' :
                                  type === 'WARNING' ? 'arrow-forward' :
                                  'arrow-forward'} 
                            size={18} 
                            color="white" 
                            style={{ marginLeft: 6 }}
                          />
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
