declare module 'react-native-modal' {
  import { Component } from 'react';
  import { Modal, ModalProps, ViewStyle, Animated } from 'react-native';

  interface ModalPropsType extends ModalProps {
    isVisible: boolean;
    backdropOpacity?: number;
    backdropColor?: string;
    children: React.ReactNode;
    animationIn?: string | Object;
    animationOut?: string | Object;
    animationInTiming?: number;
    animationOutTiming?: number;
    useNativeDriver?: boolean;
    hideModalContentWhileAnimating?: boolean;
    style?: ViewStyle;
    backdropTransitionInTiming?: number;
    backdropTransitionOutTiming?: number;
    onModalShow?: () => void;
    onModalHide?: () => void;
    onBackdropPress?: () => void;
    onBackButtonPress?: () => void;
    swipeDirection?: 'up' | 'down' | 'left' | 'right' | Array<'up' | 'down' | 'left' | 'right'>;
    onSwipeComplete?: () => void;
    swipeThreshold?: number;
  }

  export default class ReactNativeModal extends Component<ModalPropsType> {}
} 