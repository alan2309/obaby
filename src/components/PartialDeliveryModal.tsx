import React, { useState,useEffect  } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {
  Text,
  Modal,
  Portal,
  Button,
  Card,
  TextInput,
  Divider,
} from 'react-native-paper';
import { Order, OrderItem } from '../firebase/firestore';

interface PartialDeliveryModalProps {
  visible: boolean;
  onDismiss: () => void;
  order: Order;
  onConfirm: (deliveredItems: Array<{
    productId: string;
    size: string;
    color: string;
    deliveredQuantity: number;
  }>) => void;
  loading?: boolean;
}

const PartialDeliveryModal: React.FC<PartialDeliveryModalProps> = ({
  visible,
  onDismiss,
  order,
  onConfirm,
  loading = false,
}) => {
  const [quantities, setQuantities] = useState<{ [key: string]: string }>({});
 useEffect(() => {
    if (visible && order) {
      setQuantities({});
    }
  }, [visible, order]);
   if (!order) {
    return null;
  }
  const getItemKey = (item: OrderItem) => 
    `${item.productId}-${item.size}-${item.color}`;

  const getRemainingQuantity = (item: OrderItem) => 
    item.quantity - (item.deliveredQuantity || 0);

  const handleQuantityChange = (item: OrderItem, value: string) => {
    const key = getItemKey(item);
    const remaining = getRemainingQuantity(item);
    const numValue = parseInt(value) || 0;
    
    if (numValue <= remaining && numValue >= 0) {
      setQuantities(prev => ({
        ...prev,
        [key]: value,
      }));
    } else if (value === '') {
      setQuantities(prev => ({
        ...prev,
        [key]: '',
      }));
    }
  };

  const handleConfirm = () => {
    if (!order) return;

    const deliveredItems = order.items
      .map(item => {
        const key = getItemKey(item);
        const quantity = parseInt(quantities[key]) || 0;
        return {
          productId: item.productId,
          size: item.size,
          color: item.color,
          deliveredQuantity: quantity,
        };
      })
      .filter(item => item.deliveredQuantity > 0);

    if (deliveredItems.length > 0) {
      onConfirm(deliveredItems);
    }
  };

  const hasValidDeliveries = Object.values(quantities).some(
    qty => parseInt(qty) > 0
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <ScrollView>
          <Text variant="titleLarge" style={styles.modalTitle}>
            Partial Delivery
          </Text>
          <Text variant="bodySmall" style={styles.orderId}>
            Order #{order.id?.substring(0, 8)}
          </Text>

          <Text variant="bodyMedium" style={styles.instruction}>
            Enter quantities delivered for each item:
          </Text>

          {order.items.map((item, index) => {
            const remaining = getRemainingQuantity(item);
            const key = getItemKey(item);
            
            return (
              <Card key={key} style={styles.itemCard}>
                <Card.Content>
                  <View style={styles.itemHeader}>
                    <Text variant="bodyLarge" style={styles.productName}>
                      {item.productName}
                    </Text>
                    <Text variant="bodySmall" style={styles.itemDetails}>
                      {item.size} | {item.color}
                    </Text>
                  </View>
                  
                  <View style={styles.quantityRow}>
                    <View style={styles.quantityInfo}>
                      <Text variant="bodySmall">
                        Ordered: {item.quantity}
                      </Text>
                      <Text variant="bodySmall">
                        Already Delivered: {item.deliveredQuantity || 0}
                      </Text>
                      <Text variant="bodySmall" style={styles.remainingText}>
                        Remaining: {remaining}
                      </Text>
                    </View>
                    
                    <TextInput
                      mode="outlined"
                      keyboardType="numeric"
                      value={quantities[key] || ''}
                      onChangeText={(value) => handleQuantityChange(item, value)}
                      placeholder="0"
                      style={styles.quantityInput}
                      dense
                      maxLength={3}
                      disabled={remaining === 0}
                    />
                  </View>
                  {remaining === 0 && (
                    <Text variant="bodySmall" style={styles.fullyDeliveredText}>
                      ✓ Fully delivered
                    </Text>
                  )}
                </Card.Content>
              </Card>
            );
          })}

          <Divider style={styles.divider} />

          <View style={styles.buttonRow}>
            <Button
              mode="outlined"
              onPress={onDismiss}
              style={styles.button}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleConfirm}
              style={styles.button}
              disabled={!hasValidDeliveries || loading}
              loading={loading}
            >
              Confirm Delivery
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 4,
    color: '#3B3B3B',
  },
  orderId: {
    textAlign: 'center',
    color: '#A08B73',
    marginBottom: 16,
  },
  fullyDeliveredText: {
  color: '#4CAF50',
  fontWeight: '600',
  marginTop: 4,
  textAlign: 'center',
},
  instruction: {
    marginBottom: 16,
    color: '#3B3B3B',
    textAlign: 'center',
  },
  itemCard: {
    marginBottom: 8,
    backgroundColor: '#FAF9F6',
  },
  itemHeader: {
    marginBottom: 8,
  },
  productName: {
    fontWeight: '700',
    color: '#3B3B3B',
  },
  itemDetails: {
    color: '#A08B73',
    marginTop: 2,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityInfo: {
    flex: 1,
  },
  remainingText: {
    color: '#FFA000',
    fontWeight: '600',
  },
  quantityInput: {
    width: 80,
    height: 40,
  },
  divider: {
    marginVertical: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
});

export default PartialDeliveryModal;