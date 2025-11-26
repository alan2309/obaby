// src/screens/common/DebugScreen.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';

const DebugScreen: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Debug Info</Text>
      <Text>User: {user ? JSON.stringify(user) : 'No user'}</Text>
      <Text>Role: {user?.role}</Text>
      <Text>Approved: {user?.approved?.toString()}</Text>
      <Button onPress={logout}>Logout</Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F5EDE0',
  },
});

export default DebugScreen;