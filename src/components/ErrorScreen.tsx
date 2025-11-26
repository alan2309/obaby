import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { scaleSize } from '../utils/constants';

interface ErrorScreenProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  showRetry?: boolean;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({ 
  title = 'Something went wrong',
  message,
  onRetry,
  showRetry = true
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {showRetry && onRetry && (
        <Button 
          mode="contained" 
          onPress={onRetry}
          style={styles.retryButton}
          icon="refresh"
        >
          Try Again
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5EDE0',
    padding: scaleSize(20),
  },
  title: {
    fontSize: scaleSize(18),
    fontWeight: 'bold',
    color: '#FF5252',
    marginBottom: scaleSize(8),
    textAlign: 'center',
  },
  message: {
    fontSize: scaleSize(14),
    color: '#3B3B3B',
    textAlign: 'center',
    marginBottom: scaleSize(16),
    lineHeight: scaleSize(20),
  },
  retryButton: {
    backgroundColor: '#F7CAC9',
  },
});

export default ErrorScreen;