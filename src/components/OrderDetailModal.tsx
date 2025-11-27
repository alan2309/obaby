// src/components/OrderDetailModal.tsx
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Modal, Portal, Text, Card, Chip, DataTable, Button } from 'react-native-paper';
import { Order } from '../firebase/firestore';
import { scaleSize } from '../utils/constants';

interface OrderDetailModalProps {
  visible: boolean;
  onDismiss: () => void;
  order: Order | null;
  users: any[];
  onStatusUpdate?: (orderId: string, newStatus: Order['status']) => void;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  visible,
  onDismiss,
  order,
  users,
  onStatusUpdate,
}) => {
  if (!order) return null;

  const getCustomerName = (customerId: string) => {
    const customer = users.find(c => c.id === customerId);
    return customer?.name || 'Unknown Customer';
  };

  const getSalesmanName = (salesmanId: string) => {
    const salesman = users.find(s => s.id === salesmanId);
    return salesman?.name || 'Unknown Salesman';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return '#FFA000';
      case 'Delivered': return '#4CAF50';
      default: return '#757575';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
      >
        <ScrollView>
          <Text variant="headlineSmall" style={styles.modalTitle}>
            Order Details
          </Text>

          {/* Order Header */}
          <Card style={styles.sectionCard}>
            <Card.Content>
              <View style={styles.orderHeader}>
                <View>
                  <Text variant="titleMedium">Order #{order.id?.substring(0, 8)}</Text>
                  <Text variant="bodySmall" style={styles.orderDate}>
                    Created: {formatDate(order.createdAt)}
                  </Text>
                  <Text variant="bodySmall" style={styles.orderDate}>
                    Updated: {formatDate(order.updatedAt)}
                  </Text>
                </View>
                <Chip 
                  mode="outlined"
                  textStyle={{ color: getStatusColor(order.status) }}
                >
                  {order.status}
                </Chip>
              </View>

              <View style={styles.orderInfo}>
                <View style={styles.infoItem}>
                  <Text variant="bodySmall" style={styles.infoLabel}>Customer:</Text>
                  <Text variant="bodyMedium">{getCustomerName(order.customerId)}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text variant="bodySmall" style={styles.infoLabel}>Salesman:</Text>
                  <Text variant="bodyMedium">{getSalesmanName(order.salesmanId)}</Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Order Items */}
          <Card style={styles.sectionCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Order Items ({order.items.length})
              </Text>
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title>Product</DataTable.Title>
                  <DataTable.Title>Variant</DataTable.Title>
                  <DataTable.Title numeric>Qty</DataTable.Title>
                  <DataTable.Title numeric>Price</DataTable.Title>
                </DataTable.Header>

                {order.items.map((item, index) => (
                  <DataTable.Row key={index}>
                    <DataTable.Cell>
                      <Text variant="bodyMedium">{item.productName}</Text>
                    </DataTable.Cell>
                    <DataTable.Cell>
                      <Text variant="bodySmall">
                        {item.size}
                      </Text>
                    </DataTable.Cell>
                    <DataTable.Cell numeric>
                      <Text variant="bodyMedium">{item.quantity}</Text>
                    </DataTable.Cell>
                    <DataTable.Cell numeric>
                      <Text variant="bodyMedium">
                        ${(item.finalPrice * item.quantity).toFixed(2)}
                      </Text>
                      {item.discountGiven > 0 && (
                        <Text variant="bodySmall" style={styles.discountText}>
                          -${item.discountGiven}
                        </Text>
                      )}
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            </Card.Content>
          </Card>

          {/* Order Summary */}
          <Card style={styles.sectionCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Order Summary
              </Text>
              <View style={styles.summaryRow}>
                <Text variant="bodyMedium">Items Total:</Text>
                <Text variant="bodyMedium">${order.totalAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text variant="bodyMedium">Total Cost:</Text>
                <Text variant="bodyMedium">${order.totalCost.toFixed(2)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text variant="titleMedium">Total Profit:</Text>
                <Text variant="titleMedium" style={styles.profitText}>
                  ${order.totalProfit.toFixed(2)}
                </Text>
              </View>
            </Card.Content>
          </Card>

          {/* Status Actions */}
          {onStatusUpdate && order.status !== 'Delivered' && (
            <Card style={styles.sectionCard}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Update Status
                </Text>
                <View style={styles.statusActions}>
                  <Button
                    mode="contained"
                    onPress={() => onStatusUpdate(order.id!, 'Delivered')}
                    style={styles.statusButton}
                  >
                    Mark as Delivered
                  </Button>
                </View>
              </Card.Content>
            </Card>
          )}

          <Button
            mode="outlined"
            onPress={onDismiss}
            style={styles.closeButton}
          >
            Close
          </Button>
        </ScrollView>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    backgroundColor: 'white',
    margin: scaleSize(20),
    padding: scaleSize(20),
    borderRadius: scaleSize(12),
    maxHeight: '80%',
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: scaleSize(20),
    color: '#3B3B3B',
  },
  sectionCard: {
    marginBottom: scaleSize(16),
    backgroundColor: '#FAF9F6',
  },
  sectionTitle: {
    marginBottom: scaleSize(12),
    color: '#3B3B3B',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scaleSize(12),
  },
  orderDate: {
    color: '#A08B73',
    marginTop: scaleSize(2),
  },
  orderInfo: {
    gap: scaleSize(8),
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    color: '#A08B73',
  },
  discountText: {
    color: '#4CAF50',
    fontSize: scaleSize(10),
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleSize(8),
    paddingVertical: scaleSize(4),
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E6C76E',
    paddingTop: scaleSize(12),
    marginTop: scaleSize(8),
  },
  profitText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  statusActions: {
    gap: scaleSize(8),
  },
  statusButton: {
    backgroundColor: '#F7CAC9',
  },
  closeButton: {
    marginTop: scaleSize(8),
    borderColor: '#F7CAC9',
  },
});

export default OrderDetailModal;