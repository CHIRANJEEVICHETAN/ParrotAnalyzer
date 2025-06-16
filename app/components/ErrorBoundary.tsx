import React, { Component, ErrorInfo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import EventEmitter from '../utils/EventEmitter';
import * as Updates from 'expo-updates';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: any[];
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * A React Error Boundary component that catches errors in its child component tree
 * and displays a user-friendly error message with recovery options
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to the console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Store error info in state
    this.setState({ errorInfo });
    
    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Emit error event for potential logging/analytics
    EventEmitter.emit('ERROR_CAUGHT', { 
      error: error.toString(), 
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });
  }

  componentDidUpdate(prevProps: Props) {
    // Check if any reset keys changed
    if (this.state.hasError && this.props.resetKeys) {
      if (!prevProps.resetKeys || 
          JSON.stringify(prevProps.resetKeys) !== JSON.stringify(this.props.resetKeys)) {
        // Reset the error state
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null
        });
      }
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleGoBack = () => {
    this.handleReset();
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback to home if can't go back
      router.replace('/');
    }
  };

  handleRestart = async () => {
    // For web, just reload the page
    if (Platform.OS === 'web') {
      window.location.reload();
      return;
    }
    
    // For native platforms, use Expo Updates if available
    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.error('Failed to reload app:', error);
      // Fallback to resetting the error state
      this.handleReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Default fallback UI
      return (
        <View style={styles.container}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="alert-circle" size={64} color="#DC2626" />
          </View>
          
          <Text style={styles.title}>Something went wrong</Text>
          
          <Text style={styles.message}>
            {this.state.error?.message || "We encountered an unexpected error"}
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={this.handleGoBack}>
              <Text style={styles.buttonText}>Go Back</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.buttonPrimary} onPress={this.handleRestart}>
              <Text style={styles.buttonTextPrimary}>Restart App</Text>
            </TouchableOpacity>
          </View>
          
          {__DEV__ && this.state.errorInfo && (
            <View style={styles.detailsContainer}>
              <Text style={styles.detailsTitle}>Error Details (Developer Only):</Text>
              <Text style={styles.details}>
                {this.state.error?.toString()}
              </Text>
              <Text style={styles.stackTrace}>
                {this.state.errorInfo.componentStack}
              </Text>
            </View>
          )}
        </View>
      );
    }

    // If there's no error, render children normally
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  errorIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 300,
    marginBottom: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    minWidth: 120,
    alignItems: 'center',
  },
  buttonPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    minWidth: 120,
    alignItems: 'center',
  },
  buttonText: {
    color: '#4B5563',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonTextPrimary: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  detailsContainer: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4B5563',
    marginBottom: 8,
  },
  details: {
    fontSize: 12,
    color: '#EF4444',
    marginBottom: 8,
  },
  stackTrace: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

export default ErrorBoundary; 