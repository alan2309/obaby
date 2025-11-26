import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { scaleSize, platformStyle } from '../../utils/constants';

const NotificationsCustomer: React.FC = () => {
  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Notifications
      </Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">No New Notifications</Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            You're all caught up! New promotions and order updates will appear here.
          </Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EDE0',
    padding: platformStyle.padding,
  },
  title: {
    textAlign: 'center',
    marginBottom: scaleSize(24),
    color: '#3B3B3B',
  },
  card: {
    backgroundColor: '#FAF9F6',
  },
  emptyText: {
    textAlign: 'center',
    color: '#A08B73',
    fontStyle: 'italic',
    marginTop: scaleSize(8),
  },
});

export default NotificationsCustomer;