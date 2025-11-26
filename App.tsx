import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, StyleSheet, View } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { theme } from './src/utils/constants';
import { CartProvider } from './src/context/CartContext';
import ErrorBoundary from './src/components/ErrorBoundary';

// Web-specific container component
const WebContainer = ({ children }: { children?: React.ReactNode }) => {
  if (Platform.OS === 'web') {
    return (
      <View 
        style={styles.webContainer}
        // @ts-ignore - web-specific inline style for scrollbar hiding
        style={{
          ...styles.webContainer,
          ...(Platform.OS === 'web' ? {
            // @ts-ignore - web styles
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          } : {})
        }}
      >
        {children}
      </View>
    );
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <CartProvider>
            <ErrorBoundary>
              <WebContainer>
                <StatusBar style="auto" />
                <AppNavigator />
              </WebContainer>
            </ErrorBoundary>
          </CartProvider>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    height: Platform.OS === 'web' ? '100%' : undefined,
    width: '100%',
    overflow: Platform.OS === 'web' ? 'scroll' : undefined,
  },
});