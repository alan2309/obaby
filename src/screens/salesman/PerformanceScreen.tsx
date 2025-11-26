import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, DataTable } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { scaleSize, platformStyle } from '../../utils/constants';

const PerformanceScreen: React.FC = () => {
  const { user } = useAuth();

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        My Performance
      </Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge">Sales Statistics</Text>
          <DataTable>
            <DataTable.Row>
              <DataTable.Cell>Total Sales</DataTable.Cell>
              <DataTable.Cell numeric>${user?.totalSales || 0}</DataTable.Cell>
            </DataTable.Row>
            <DataTable.Row>
              <DataTable.Cell>Total Profit</DataTable.Cell>
              <DataTable.Cell numeric>${user?.totalProfitGenerated || 0}</DataTable.Cell>
            </DataTable.Row>
            <DataTable.Row>
              <DataTable.Cell>Discounts Given</DataTable.Cell>
              <DataTable.Cell numeric>${user?.totalDiscountGiven || 0}</DataTable.Cell>
            </DataTable.Row>
            <DataTable.Row>
              <DataTable.Cell>Max Discount Allowed</DataTable.Cell>
              <DataTable.Cell numeric>{user?.maxDiscountPercent || 0}%</DataTable.Cell>
            </DataTable.Row>
          </DataTable>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge">Recent Activity</Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Performance analytics coming soon...
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
    marginBottom: scaleSize(16),
    backgroundColor: '#FAF9F6',
  },
  emptyText: {
    textAlign: 'center',
    color: '#A08B73',
    fontStyle: 'italic',
    marginVertical: scaleSize(16),
  },
});

export default PerformanceScreen;