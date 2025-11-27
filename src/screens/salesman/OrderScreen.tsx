// src/screens/salesman/OrderScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Divider,
  Modal,
  Portal,
  List,
  ActivityIndicator,
  Snackbar,
  Searchbar,
} from 'react-native-paper';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { createOrder, getCustomers, checkOrderStock, getCustomersBySalesman } from '../../firebase/firestore';
import { 
  scaleSize, 
  scaleFont,
  getScreenSize,
  getResponsivePadding,
  getResponsiveMargin,
  responsiveValue,
  theme,
  SCREEN_WIDTH,
  currentScreenConfig 
} from '../../utils/constants';
import { UserData } from '../../firebase/auth';

const OrderScreen: React.FC = () => {
  const { cartItems, removeFromCart, updateQuantity, clearCart, getTotalItems, getTotalAmount, getTotalCost, getTotalProfit } = useCart();
  const { user } = useAuth();
  const [customers, setCustomers] = useState<UserData[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<UserData[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<UserData | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const screenSize = getScreenSize();

  useEffect(() => {
    loadCustomers();
  }, []);

  // Filter customers based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCustomers(customers);
    } else {
      const filtered = customers.filter(customer =>
        customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone?.includes(searchQuery) ||
        customer.city?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCustomers(filtered);
    }
  }, [searchQuery, customers]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      // Get only customers assigned to this salesman
      if (user?.uid) {
        const customersData = await getCustomersBySalesman(user.uid);
        setCustomers(customersData);
        setFilteredCustomers(customersData);
      } else {
        setSnackbarMessage('Unable to load customers: User not found');
        setSnackbarVisible(true);
      }
    } catch (error: any) {
      console.error('Error loading customers:', error);
      setSnackbarMessage('Failed to load customers');
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = (productId: string, size: string, color: string, productName: string) => {
    Alert.alert(
      'Remove Item',
      `Remove ${productName} (${size}, ${color}) from order?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => removeFromCart(productId, size, color)
        },
      ]
    );
  };

  const handleSubmitOrder = async () => {
    if (!selectedCustomer) {
      setSnackbarMessage('Please select a customer');
      setSnackbarVisible(true);
      return;
    }

    if (cartItems.length === 0) {
      setSnackbarMessage('Cart is empty');
      setSnackbarVisible(true);
      return;
    }

    try {
      const orderItems = cartItems.map(item => ({
        productId: item.product.id!,
        productName: item.product.title,
        size: item.sizeVariant.size,
        color: item.sizeVariant.color,
        quantity: item.quantity,
        costPrice: item.product.costPrice || 0,
        sellingPrice: item.product.sellingPrice || 0,
        finalPrice: item.product.sellingPrice || 0,
        discountGiven: 0,
      }));

      const stockCheck = await checkOrderStock(orderItems);
      
      if (!stockCheck.hasSufficientStock) {
        showOutOfStockAlert(stockCheck.outOfStockItems);
        return;
      }

      Alert.alert(
        'Confirm Order',
        `Create order for ${selectedCustomer.name} with ${getTotalItems()} items totaling ₹${getTotalAmount().toFixed(2)}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Create Order', 
            onPress: createOrderHandler
          },
        ]
      );

    } catch (error: any) {
      console.error('Error checking stock:', error);
      setSnackbarMessage('Error checking stock availability');
      setSnackbarVisible(true);
    }
  };

  const showOutOfStockAlert = (outOfStockItems: Array<{productName: string, size: string, color: string, availableStock: number, requestedQuantity: number}>) => {
    const alertMessage = outOfStockItems.map(item => 
      `• ${item.productName} (${item.size}, ${item.color})\n  Available: ${item.availableStock}, Requested: ${item.requestedQuantity}`
    ).join('\n\n');

    Alert.alert(
      'Insufficient Stock',
      `The following items are out of stock or have insufficient quantity:\n\n${alertMessage}\n\nPlease update your cart and try again.`,
      [
        { 
          text: 'Update Cart', 
          onPress: () => {
            handleOutOfStockItems(outOfStockItems);
          }
        },
        { 
          text: 'Cancel', 
          style: 'cancel' 
        }
      ]
    );
  };

  const handleOutOfStockItems = (outOfStockItems: Array<{productName: string, size: string, color: string, availableStock: number, requestedQuantity: number}>) => {
    outOfStockItems.forEach(item => {
      const cartItem = cartItems.find(cartItem => 
        cartItem.product.title === item.productName &&
        cartItem.sizeVariant.size === item.size &&
        cartItem.sizeVariant.color === item.color
      );
      if (cartItem?.product.id) {
        removeFromCart(
          cartItem.product.id,
          item.size,
          item.color
        );
      }
    });

    setSnackbarMessage(`${outOfStockItems.length} items removed due to insufficient stock`);
    setSnackbarVisible(true);
  };

 const createOrderHandler = async () => {
  try {
    setSubmitting(true);

    const orderItems = cartItems.map(item => ({
      productId: item.product.id!,
      productName: item.product.title,
      size: item.sizeVariant.size,
      color: item.sizeVariant.color,
      quantity: item.quantity,
      costPrice: item.product.costPrice || 0,
      sellingPrice: item.product.sellingPrice || 0,
      finalPrice: item.product.sellingPrice || 0,
      discountGiven: 0,
    }));

    const orderData = {
      customerId: selectedCustomer!.id!,
      customerName: selectedCustomer!.name, // Add customer name
      salesmanId: user!.uid,
      salesmanName: user!.name || 'Salesman', // Add salesman name
      items: orderItems,
      totalAmount: getTotalAmount(),
      totalCost: getTotalCost(),
      totalProfit: getTotalProfit(),
      status: 'Pending' as const,
    };

    const result = await createOrder(orderData);
    
    if (result.success) {
      setSnackbarMessage(`Order created successfully! Order ID: ${result.orderId}`);
      setSnackbarVisible(true);
      
      clearCart();
      setSelectedCustomer(null);
    } else {
      if (result.outOfStockItems && result.outOfStockItems.length > 0) {
        showOutOfStockAlert(result.outOfStockItems.map(item => ({
          ...item,
          requestedQuantity: orderItems.find(oi => 
            oi.productName === item.productName && 
            oi.size === item.size && 
            oi.color === item.color
          )?.quantity || 0
        })));
      } else {
        setSnackbarMessage(`Failed to create order: ${result.message}`);
        setSnackbarVisible(true);
      }
    }
    
  } catch (error: any) {
    console.error('Error creating order:', error);
    setSnackbarMessage(`Failed to create order: ${error.message}`);
    setSnackbarVisible(true);
  } finally {
    setSubmitting(false);
  }
};

  // Reset search when modal opens/closes
  const handleModalOpen = () => {
    setSearchQuery('');
    setShowCustomerModal(true);
  };

  const handleModalClose = () => {
    setSearchQuery('');
    setShowCustomerModal(false);
  };

  const handleCustomerSelect = (customer: UserData) => {
    setSelectedCustomer(customer);
    setSearchQuery('');
    setShowCustomerModal(false);
  };

  if (cartItems.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Your Order Cart is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Add products from the catalog to create an order
          </Text>
        </View>
      </View>
    );
  }

  const cardMargin = getResponsiveMargin();
  const cardPadding = getResponsivePadding();

  const sectionTitleVariant = responsiveValue({
    xsmall: 'titleLarge',
    small: 'titleLarge',
    medium: 'headlineSmall',
    large: 'headlineSmall',
    xlarge: 'headlineMedium',
    default: 'titleLarge'
  });

  const modalTitleVariant = responsiveValue({
    xsmall: 'headlineSmall',
    small: 'headlineSmall',
    medium: 'headlineMedium',
    large: 'headlineMedium',
    xlarge: 'headlineLarge',
    default: 'headlineSmall'
  });

  const orderItemLayout = responsiveValue({
    xsmall: 'column',
    small: 'column',
    medium: 'row',
    large: 'row',
    xlarge: 'row',
    default: 'column'
  });

  const itemControlsAlignment = responsiveValue({
    xsmall: 'center',
    small: 'center',
    medium: 'flex-end',
    large: 'flex-end',
    xlarge: 'flex-end',
    default: 'center'
  }) as 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline' | undefined;

  const productImageSize = responsiveValue({
    xsmall: scaleSize(50),
    small: scaleSize(60),
    medium: scaleSize(70),
    large: scaleSize(80),
    xlarge: scaleSize(90),
    default: scaleSize(60)
  });

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Customer Selection */}
        <Card style={[styles.sectionCard, { margin: cardMargin, marginTop: 50 }]}>
          <Card.Content style={{ padding: cardPadding }}>
            <Text variant={sectionTitleVariant as any} style={styles.sectionTitle}>
              Customer Selection
            </Text>
            {selectedCustomer ? (
              <View style={styles.selectedCustomer}>
                <Text style={styles.customerName}>{selectedCustomer.name}</Text>
                <Text style={styles.customerDetails}>
                  {selectedCustomer.email} • {selectedCustomer.phone}
                  {selectedCustomer.city ? ` • ${selectedCustomer.city}` : ''}
                </Text>
                <Button 
                  mode="outlined" 
                  onPress={handleModalOpen}
                  style={styles.changeCustomerButton}
                >
                  Change Customer
                </Button>
              </View>
            ) : (
              <View style={styles.selectCustomerContainer}>
                <Button 
                  mode="contained" 
                  onPress={handleModalOpen}
                  style={styles.selectCustomerButton}
                >
                  Select Customer
                </Button>
                
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Order Items */}
        <Card style={[styles.sectionCard, { margin: cardMargin, marginTop: 0 }]}>
          <Card.Content style={{ padding: cardPadding }}>
            <Text variant={sectionTitleVariant as any} style={styles.sectionTitle}>
              Order Items ({getTotalItems()})
            </Text>
            {cartItems.map((item, index) => (
              <View key={`${item.product.id}-${item.sizeVariant.size}-${item.sizeVariant.color}`}>
                <View style={[
                  styles.orderItem, 
                  orderItemLayout === 'row' ? styles.orderItemRow : styles.orderItemColumn
                ]}>
                  <View style={styles.productImageContainer}>
                    {item.product.images && item.product.images.length > 0 ? (
                      <Image
                        source={{ uri: item.product.images[0] }}
                        style={[styles.productImage, { width: productImageSize, height: productImageSize }]}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.placeholderImage, { width: productImageSize, height: productImageSize }]}>
                        <Text style={styles.placeholderText}>No Image</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.itemInfo}>
                    <Text style={styles.productName}>{item.product.title}</Text>
                    <Text style={styles.variantText}>
                      {item.sizeVariant.size} • {item.sizeVariant.color}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>
                        ₹{item.product.sellingPrice?.toFixed(2)} × {item.quantity}
                      </Text>
                      <Text style={styles.totalPrice}>
                        ₹{((item.product.sellingPrice || 0) * item.quantity).toFixed(2)}
                      </Text>
                    </View>
                    <Text style={styles.productId}>
                      ID: {item.product.id?.substring(0, 8) || 'N/A'}
                    </Text>
                  </View>

                  <View style={[
                    styles.itemControls,
                    { alignItems: itemControlsAlignment }
                  ]}>
                    <View style={styles.quantityControls}>
                      <Button
                        compact
                        mode="outlined"
                        onPress={() => updateQuantity(
                          item.product.id!,
                          item.sizeVariant.size,
                          item.sizeVariant.color,
                          item.quantity - 1
                        )}
                        style={styles.quantityButton}
                      >
                        -
                      </Button>
                      <Text style={styles.quantityText}>{item.quantity}</Text>
                      <Button
                        compact
                        mode="outlined"
                        onPress={() => updateQuantity(
                          item.product.id!,
                          item.sizeVariant.size,
                          item.sizeVariant.color,
                          item.quantity + 1
                        )}
                        disabled={item.quantity >= item.sizeVariant.stock}
                        style={styles.quantityButton}
                      >
                        +
                      </Button>
                    </View>

                    <Button
                      mode="outlined"
                      compact
                      onPress={() => handleRemoveItem(
                        item.product.id!,
                        item.sizeVariant.size,
                        item.sizeVariant.color,
                        item.product.title
                      )}
                      style={styles.removeButton}
                    >
                      Remove
                    </Button>
                  </View>
                </View>
                {index < cartItems.length - 1 && <Divider />}
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Order Summary */}
        <Card style={[styles.sectionCard, { margin: cardMargin, marginTop: 0 }]}>
          <Card.Content style={{ padding: cardPadding }}>
            <Text variant={sectionTitleVariant as any} style={styles.sectionTitle}>
              Order Summary
            </Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Items:</Text>
              <Text style={styles.summaryValue}>{getTotalItems()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Amount:</Text>
              <Text style={[styles.summaryValue, styles.totalAmount]}>
                ₹{getTotalAmount().toFixed(2)}
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Submit Order Button */}
      <View style={[styles.footer, { padding: cardPadding }]}>
        <Button
          mode="contained"
          onPress={handleSubmitOrder}
          disabled={!selectedCustomer || submitting}
          loading={submitting}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
        >
          {submitting ? 'Creating Order...' : `Create Order - ₹${getTotalAmount().toFixed(2)}`}
        </Button>
      </View>

      {/* Customer Selection Modal with Search */}
      <Portal>
        <Modal
          visible={showCustomerModal}
          onDismiss={handleModalClose}
          contentContainerStyle={[
            styles.modalContainer,
            { width: currentScreenConfig.modal.width }
          ]}
        >
          <Text variant={modalTitleVariant as any} style={styles.modalTitle}>
            My Customers ({customers.length})
          </Text>
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder="Search your customers by name, email, phone, or city..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
              icon={searchQuery ? "close" : "magnify"}
              onIconPress={searchQuery ? () => setSearchQuery('') : undefined}
            />
          </View>

          {loading ? (
            <ActivityIndicator size="large" style={styles.loading} />
          ) : (
            <ScrollView style={styles.modalScrollView}>
              {filteredCustomers.length === 0 ? (
                <View style={styles.noCustomersContainer}>
                  <Text style={styles.noCustomersText}>
                    {searchQuery 
                      ? 'No customers found matching your search.' 
                      : 'No customers assigned to you yet.'
                    }
                  </Text>
                  {!searchQuery && (
                    <Text style={styles.noCustomersHint}>
                      Contact your administrator to get customers assigned to you.
                    </Text>
                  )}
                </View>
              ) : (
                filteredCustomers.map(customer => (
                  <List.Item
                    key={customer.id}
                    title={customer.name}
                    description={`${customer.email} • ${customer.phone}${customer.city ? ` • ${customer.city}` : ''}`}
                    onPress={() => handleCustomerSelect(customer)}
                    style={styles.customerItem}
                    titleStyle={styles.customerTitle}
                    descriptionStyle={styles.customerDescription}  
                  />
                ))
              )}
            </ScrollView>
          )}
          <Button
            mode="outlined"
            onPress={handleModalClose}
            style={styles.modalCloseButton}
          >
            Cancel
          </Button>
        </Modal>
      </Portal>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={4000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyTitle: {
    ...theme.typography.headlineMedium,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...theme.typography.bodyLarge,
    color: theme.colors.placeholder,
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
  },
  sectionTitle: {
    ...theme.typography.headlineSmall,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerCountBadge: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: scaleSize(8),
    paddingVertical: scaleSize(4),
    borderRadius: theme.roundness,
  },
  customerCountText: {
    color: 'white',
    fontSize: scaleFont(12),
    fontWeight: 'bold',
  },
  selectedCustomer: {
    alignItems: 'center',
  },
  customerName: {
    ...theme.typography.headlineSmall,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  customerDetails: {
    ...theme.typography.bodyMedium,
    color: theme.colors.placeholder,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  selectCustomerContainer: {
    alignItems: 'center',
  },
  customerHint: {
    ...theme.typography.bodySmall,
    color: theme.colors.placeholder,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  changeCustomerButton: {
    borderColor: theme.colors.accent,
  },
  selectCustomerButton: {
    backgroundColor: theme.colors.accent,
  },
  orderItem: {
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderItemColumn: {
    flexDirection: 'column',
  },
  productImageContainer: {
    marginRight: theme.spacing.md,
  },
  productImage: {
    borderRadius: theme.roundness,
  },
  placeholderImage: {
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.roundness,
  },
  placeholderText: {
    color: theme.colors.text,
    fontSize: scaleFont(10),
    textAlign: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  productName: {
    ...theme.typography.headlineSmall,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  variantText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.placeholder,
    marginBottom: theme.spacing.xs,
  },
  productId: {
    ...theme.typography.labelSmall,
    color: theme.colors.placeholder,
    fontFamily: 'monospace',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  price: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  totalPrice: {
    ...theme.typography.headlineSmall,
    color: theme.colors.accent,
    fontWeight: 'bold',
  },
  itemControls: {
    gap: theme.spacing.sm,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  quantityButton: {
    borderColor: theme.colors.accent,
  },
  quantityText: {
    ...theme.typography.headlineSmall,
    color: theme.colors.text,
    minWidth: scaleSize(30),
    textAlign: 'center',
  },
  removeButton: {
    borderColor: theme.colors.error,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  summaryLabel: {
    ...theme.typography.bodyLarge,
    color: theme.colors.text,
  },
  summaryValue: {
    ...theme.typography.bodyLarge,
    fontWeight: '600',
    color: theme.colors.text,
  },
  totalAmount: {
    ...theme.typography.headlineSmall,
    color: theme.colors.accent,
    fontWeight: 'bold',
  },
  profitText: {
    color: theme.colors.success,
  },
  footer: {
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  submitButton: {
    backgroundColor: theme.colors.accent,
  },
  submitButtonContent: {
    paddingVertical: scaleSize(12),
  },
  modalContainer: {
    backgroundColor: 'white',
    margin: theme.spacing.lg,
    borderRadius: theme.roundness,
    maxHeight: '100%',
    alignSelf: 'center',
  },
  modalTitle: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    textAlign: 'center',
    color: theme.colors.text,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  searchBar: {
    backgroundColor: theme.colors.surface,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  customerItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  customerTitle: {
    ...theme.typography.bodyLarge,
    fontWeight: '600',
  },
  customerDescription: {
    ...theme.typography.bodyMedium,
  },
  customerStatus: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: scaleSize(4),
  },
  pendingBadge: {
    fontSize: scaleFont(10),
    color: theme.colors.warning,
    fontWeight: '600',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: scaleSize(6),
    paddingVertical: scaleSize(2),
    borderRadius: theme.roundness,
  },
  assignedBadge: {
    fontSize: scaleFont(10),
    color: theme.colors.success,
    fontWeight: '600',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: scaleSize(6),
    paddingVertical: scaleSize(2),
    borderRadius: theme.roundness,
  },
  noCustomersContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  noCustomersText: {
    ...theme.typography.bodyMedium,
    textAlign: 'center',
    color: theme.colors.placeholder,
    fontStyle: 'italic',
    marginBottom: theme.spacing.sm,
  },
  noCustomersHint: {
    ...theme.typography.bodySmall,
    textAlign: 'center',
    color: theme.colors.placeholder,
  },
  modalCloseButton: {
    margin: theme.spacing.lg,
    borderColor: theme.colors.accent,
  },
  loading: {
    padding: theme.spacing.xl,
  },
});

export default OrderScreen;