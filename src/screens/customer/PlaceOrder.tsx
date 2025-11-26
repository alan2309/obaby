import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, Chip, DataTable, FAB } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { Product, getProducts, createOrder, OrderItem } from '../../firebase/firestore';
import ProductCatalog from '../../components/ProductCatalog';
import { scaleSize, platformStyle } from '../../utils/constants';

interface CartItem extends OrderItem {
  product: Product;
  variantIndex: number;
}

const PlaceOrder: React.FC = () => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCatalog, setShowCatalog] = useState(true);
  const [loading, setLoading] = useState(false);

  const addToCart = (product: Product) => {
    // For customers, automatically select first available variant
    const availableVariantIndex = product.sizes.findIndex(variant => variant.stock > 0);
    
    if (availableVariantIndex === -1) {
      Alert.alert('Out of Stock', 'This product is currently out of stock.');
      return;
    }

    const variant = product.sizes[availableVariantIndex];
    const existingItemIndex = cart.findIndex(
      item => item.productId === product.id
    );

    if (existingItemIndex >= 0) {
      // Update quantity if item already in cart
      const updatedCart = [...cart];
      updatedCart[existingItemIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      // Add new item to cart
      const newItem: CartItem = {
        productId: product.id!,
        productName: product.title,
        size: variant.size,
        color: variant.color,
        quantity: 1,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        finalPrice: product.sellingPrice, // No discounts for customers
        discountGiven: 0,
        product,
        variantIndex: availableVariantIndex
      };
      setCart([...cart, newItem]);
    }

    Alert.alert('Added to Cart', `${product.title} added to your order.`);
  };

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) {
      removeFromCart(index);
      return;
    }
    
    const updatedCart = [...cart];
    updatedCart[index].quantity = quantity;
    setCart(updatedCart);
  };

  const removeFromCart = (index: number) => {
    const updatedCart = cart.filter((_, i) => i !== index);
    setCart(updatedCart);
  };

  const calculateTotals = () => {
    const totalAmount = cart.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    return { totalAmount, totalItems };
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Please add products to your order');
      return;
    }

    try {
      setLoading(true);
      
      const { totalAmount, totalItems } = calculateTotals();
      const totalCost = cart.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
      const totalProfit = totalAmount - totalCost;
      
      const orderData = {
        customerId: user!.uid,
        salesmanId: 'system', // System-generated order for customer self-service
        items: cart.map(item => ({
          productId: item.productId,
          productName: item.productName,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
          finalPrice: item.finalPrice,
          discountGiven: item.discountGiven,
        })),
        totalAmount,
        totalCost,
        totalProfit,
        status: 'Pending' as const,
      };

      await createOrder(orderData);
      
      Alert.alert(
        'Order Placed!', 
        `Your order has been placed successfully. Total: $${totalAmount.toFixed(2)}`,
        [{ text: 'OK', onPress: () => {
          setCart([]);
          setShowCatalog(true);
        }}]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const { totalAmount, totalItems } = calculateTotals();

  if (showCatalog) {
    return (
      <View style={styles.container}>
        <ProductCatalog
          onProductPress={(product) => addToCart(product)}
          showAddToCart={true}
          onAddToCart={addToCart}
        />
        
        {cart.length > 0 && (
          <FAB
            icon="cart"
            style={styles.fab}
            onPress={() => setShowCatalog(false)}
            label={`${totalItems} items`}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Review Your Order
        </Text>

        <Card style={styles.cartCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Order Items ({totalItems})
            </Text>
            
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Product</DataTable.Title>
                <DataTable.Title>Variant</DataTable.Title>
                <DataTable.Title numeric>Qty</DataTable.Title>
                <DataTable.Title numeric>Price</DataTable.Title>
                <DataTable.Title>Action</DataTable.Title>
              </DataTable.Header>

              {cart.map((item, index) => (
                <DataTable.Row key={index}>
                  <DataTable.Cell>
                    <Text variant="bodyMedium" style={styles.productName}>
                      {item.productName}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <Text variant="bodySmall">
                      {item.size} / {item.color}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    <View style={styles.quantityContainer}>
                      <Button
                        compact
                        mode="text"
                        onPress={() => updateQuantity(index, item.quantity - 1)}
                      >
                        -
                      </Button>
                      <Text style={styles.quantityText}>{item.quantity}</Text>
                      <Button
                        compact
                        mode="text"
                        onPress={() => updateQuantity(index, item.quantity + 1)}
                      >
                        +
                      </Button>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    <Text variant="bodyMedium">
                      ${(item.finalPrice * item.quantity).toFixed(2)}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <Button
                      compact
                      mode="text"
                      textColor="red"
                      onPress={() => removeFromCart(index)}
                    >
                      Remove
                    </Button>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>

            {cart.length === 0 && (
              <Text style={styles.emptyText}>Your cart is empty</Text>
            )}
          </Card.Content>
        </Card>

        {/* Order Summary */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Order Summary
            </Text>
            
            <View style={styles.summaryRow}>
              <Text variant="bodyLarge">Items Total:</Text>
              <Text variant="bodyLarge">${totalAmount.toFixed(2)}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text variant="bodyLarge">Shipping:</Text>
              <Text variant="bodyLarge">$0.00</Text>
            </View>
            
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text variant="titleLarge">Total Amount:</Text>
              <Text variant="titleLarge" style={styles.totalAmount}>
                ${totalAmount.toFixed(2)}
              </Text>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={() => setShowCatalog(true)}
            style={styles.backButton}
            icon="arrow-left"
          >
            Continue Shopping
          </Button>
          <Button
            mode="contained"
            onPress={handlePlaceOrder}
            loading={loading}
            disabled={loading || cart.length === 0}
            style={styles.placeOrderButton}
            icon="check"
          >
            Place Order
          </Button>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EDE0',
  },
  content: {
    padding: platformStyle.padding,
    paddingBottom: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: scaleSize(24),
    color: '#3B3B3B',
  },
  cartCard: {
    marginBottom: scaleSize(16),
    backgroundColor: '#FAF9F6',
  },
  sectionTitle: {
    marginBottom: scaleSize(16),
    color: '#3B3B3B',
  },
  productName: {
    fontWeight: '500',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityText: {
    marginHorizontal: scaleSize(8),
    minWidth: scaleSize(20),
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#A08B73',
    fontStyle: 'italic',
    marginVertical: scaleSize(16),
  },
  summaryCard: {
    marginBottom: scaleSize(16),
    backgroundColor: '#FAF9F6',
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
  totalAmount: {
    color: '#F7CAC9',
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scaleSize(8),
  },
  backButton: {
    flex: 1,
  },
  placeOrderButton: {
    flex: 2,
    backgroundColor: '#E6C76E',
  },
  fab: {
    position: 'absolute',
    margin: scaleSize(16),
    right: 0,
    bottom: 0,
    backgroundColor: '#F7CAC9',
  },
});

export default PlaceOrder;