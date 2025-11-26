import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  useWindowDimensions,
  Platform,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  Modal,
  Portal,
  DataTable,
  Divider,
} from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import {
  Product,
  getProducts,
  getCustomers,
  createOrder,
  OrderItem,
} from '../../firebase/firestore';
import { scaleSize, platformStyle } from '../../utils/constants';

interface CartItem extends OrderItem {
  product: Product;
  variantIndex: number;
}

const CreateOrderScreen: React.FC = () => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [productModalVisible, setProductModalVisible] = useState(false);

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('🔄 Loading data for order creation...');

      const [customersData, productsData] = await Promise.all([
        getCustomers().catch(err => {
          console.log('⚠️ Customers loading failed, using empty array:', err.message);
          return [];
        }),
        getProducts().catch(err => {
          console.log('⚠️ Products loading failed, using empty array:', err.message);
          return [];
        }),
      ]);

      console.log('✅ Customers loaded:', customersData.length);
      console.log('✅ Products loaded:', productsData.length);

      setCustomers(customersData);
      setProducts(productsData);
    } catch (error: any) {
      console.error('❌ Error loading order creation data:', error);
      Alert.alert('Error', 'Failed to load data. Please check your connection and try again.');
    }
  };

  const addToCart = (product: Product, variantIndex: number, quantity: number = 1) => {
    const variant = product.sizes[variantIndex];
    const existingItemIndex = cart.findIndex(
      item =>
        item.productId === product.id &&
        item.size === variant.size &&
        item.color === variant.color
    );

    if (existingItemIndex >= 0) {
      const updatedCart = [...cart];
      updatedCart[existingItemIndex].quantity += quantity;
      setCart(updatedCart);
    } else {
      const newItem: CartItem = {
        productId: product.id!,
        productName: product.title,
        size: variant.size,
        color: variant.color,
        quantity,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        finalPrice: product.sellingPrice,
        discountGiven: 0,
        product,
        variantIndex,
      };
      setCart([...cart, newItem]);
    }

    setProductModalVisible(false);
  };

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return;

    const updatedCart = [...cart];
    updatedCart[index].quantity = quantity;
    setCart(updatedCart);
  };

  const removeFromCart = (index: number) => {
    const updatedCart = cart.filter((_, i) => i !== index);
    setCart(updatedCart);
  };

  const applyDiscount = (index: number, discountPercent: number) => {
    if (discountPercent < 0 || discountPercent > (user?.maxDiscountPercent || 0)) {
      Alert.alert('Error', `Discount cannot exceed ${user?.maxDiscountPercent}%`);
      return;
    }

    const updatedCart = [...cart];
    const item = updatedCart[index];
    const discountAmount = (item.sellingPrice * discountPercent) / 100;

    item.finalPrice = item.sellingPrice - discountAmount;
    item.discountGiven = discountAmount;

    setCart(updatedCart);
  };

  const calculateTotals = () => {
    const totalAmount = cart.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
    const totalCost = cart.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
    const totalProfit = totalAmount - totalCost;
    const totalDiscount = cart.reduce((sum, item) => sum + (item.discountGiven * item.quantity), 0);

    return { totalAmount, totalCost, totalProfit, totalDiscount };
  };

  const handleCreateOrder = async () => {
    if (!selectedCustomer) {
      Alert.alert('Error', 'Please select a customer');
      return;
    }

    if (cart.length === 0) {
      Alert.alert('Error', 'Please add products to the order');
      return;
    }

    try {
      setLoading(true);

      const { totalAmount, totalCost, totalProfit } = calculateTotals();

      const orderData = {
        customerId: selectedCustomer.id,
        salesmanId: user!.uid,
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

      Alert.alert('Success', 'Order created successfully!');
      setSelectedCustomer(null);
      setCart([]);
      setStep(1);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const { totalAmount, totalCost, totalProfit, totalDiscount } = calculateTotals();

  // responsive modal sizing
  const modalHorizontalPadding = scaleSize(24);
  const modalWidth = Math.min(920, Math.max(320, windowWidth - modalHorizontalPadding));
  const modalMaxHeight = Math.min(windowHeight * 0.9, 900);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Create New Order
        </Text>

        {/* Step 1: Select Customer */}
        {step === 1 && (
          <Card style={styles.stepCard}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.stepTitle}>
                Step 1: Select Customer
              </Text>

              {customers.length === 0 ? (
                <View style={styles.noCustomersContainer}>
                  <Text style={styles.noCustomersTitle}>No Approved Customers</Text>
                  <Text style={styles.noCustomersText}>
                    There are no approved customers available. Customers need to be:
                  </Text>
                  <View style={styles.requirementsList}>
                    <Text style={styles.requirement}>• Registered in the system</Text>
                    <Text style={styles.requirement}>• Approved by an administrator</Text>
                    <Text style={styles.requirement}>• Have the role "customer"</Text>
                  </View>
                  <Button mode="outlined" onPress={loadData} style={styles.refreshButton} icon="refresh">
                    Check Again
                  </Button>
                  <Text style={styles.contactAdmin}>Please contact an administrator to approve customers.</Text>
                </View>
              ) : (
                customers.map(customer => (
                  <Card
                    key={customer.id}
                    style={[
                      styles.customerCard,
                      selectedCustomer?.id === customer.id && styles.selectedCustomerCard,
                    ]}
                    onPress={() => {
                      console.log('✅ Selected customer:', customer.name);
                      setSelectedCustomer(customer);
                    }}
                  >
                    <Card.Content>
                      <Text variant="titleMedium" style={styles.customerName}>
                        {customer.name}
                      </Text>
                      <Text variant="bodyMedium" style={styles.customerEmail}>
                        {customer.email}
                      </Text>
                      <Text variant="bodyMedium" style={styles.customerPhone}>
                        {customer.phone}
                      </Text>
                    </Card.Content>
                  </Card>
                ))
              )}

              <Button
                mode="contained"
                onPress={() => {
                  if (!selectedCustomer) {
                    Alert.alert('Selection Required', 'Please select a customer to continue.');
                    return;
                  }
                  setStep(2);
                }}
                disabled={!selectedCustomer}
                style={styles.nextButton}
                icon="arrow-right"
              >
                Next: Add Products
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* Step 2: Add Products */}
        {step === 2 && (
          <Card style={styles.stepCard}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.stepTitle}>
                Step 2: Add Products
              </Text>

              <Text variant="bodyMedium" style={styles.selectedCustomer}>
                Customer: {selectedCustomer?.name}
              </Text>

              <Button mode="outlined" onPress={() => setProductModalVisible(true)} style={styles.addProductButton} icon="plus">
                Add Product
              </Button>

              {cart.length > 0 && (
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title>Product</DataTable.Title>
                    <DataTable.Title>Variant</DataTable.Title>
                    <DataTable.Title numeric>Qty</DataTable.Title>
                    <DataTable.Title numeric>Price</DataTable.Title>
                    <DataTable.Title>Actions</DataTable.Title>
                  </DataTable.Header>

                  {cart.map((item, index) => (
                    <DataTable.Row key={index}>
                      <DataTable.Cell>{item.productName}</DataTable.Cell>
                      <DataTable.Cell>
                        <Text variant="bodySmall">
                          {item.size} / {item.color}
                        </Text>
                      </DataTable.Cell>
                      <DataTable.Cell numeric>
                        <View style={styles.quantityContainer}>
                          <Button compact mode="text" onPress={() => updateQuantity(index, item.quantity - 1)}>
                            -
                          </Button>
                          <Text style={styles.quantityText}>{item.quantity}</Text>
                          <Button compact mode="text" onPress={() => updateQuantity(index, item.quantity + 1)}>
                            +
                          </Button>
                        </View>
                      </DataTable.Cell>
                      <DataTable.Cell numeric>
                        <Text>${item.finalPrice}</Text>
                        {item.discountGiven > 0 && <Text style={styles.discountText}>-${item.discountGiven}</Text>}
                      </DataTable.Cell>
                      <DataTable.Cell>
                        <View style={styles.rowActions}>
                          <Button compact mode="text" onPress={() => applyDiscount(index, 5)} disabled={(user?.maxDiscountPercent || 0) < 5}>
                            5%
                          </Button>
                          <Button compact mode="text" onPress={() => applyDiscount(index, 10)} disabled={(user?.maxDiscountPercent || 0) < 10}>
                            10%
                          </Button>
                          <Button compact mode="text" textColor="red" onPress={() => removeFromCart(index)}>
                            Remove
                          </Button>
                        </View>
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))}
                </DataTable>
              )}

              {cart.length === 0 && <Text style={styles.emptyText}>No products added to order</Text>}

              <View style={styles.stepButtons}>
                <Button mode="outlined" onPress={() => setStep(1)} style={styles.backButton}>
                  Back
                </Button>
                <Button mode="contained" onPress={() => setStep(3)} disabled={cart.length === 0} style={styles.nextButton}>
                  Next: Review Order
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Step 3: Review Order */}
        {step === 3 && (
          <Card style={styles.stepCard}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.stepTitle}>
                Step 3: Review Order
              </Text>

              <Card style={styles.summaryCard}>
                <Card.Content>
                  <Text variant="titleMedium">Order Summary</Text>
                  <View style={styles.summaryRow}>
                    <Text>Customer:</Text>
                    <Text>{selectedCustomer?.name}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text>Items:</Text>
                    <Text>{cart.reduce((sum, item) => sum + item.quantity, 0)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text>Total Discount:</Text>
                    <Text style={styles.discountText}>-${totalDiscount.toFixed(2)}</Text>
                  </View>
                  <Divider style={styles.divider} />
                  <View style={styles.summaryRow}>
                    <Text variant="titleMedium">Total Amount:</Text>
                    <Text variant="titleMedium" style={styles.totalAmount}>
                      ${totalAmount.toFixed(2)}
                    </Text>
                  </View>
                  {user?.role === 'admin' && (
                    <>
                      <View style={styles.summaryRow}>
                        <Text>Total Cost:</Text>
                        <Text>${totalCost.toFixed(2)}</Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text>Total Profit:</Text>
                        <Text style={styles.profitText}>${totalProfit.toFixed(2)}</Text>
                      </View>
                    </>
                  )}
                </Card.Content>
              </Card>

              <View style={styles.stepButtons}>
                <Button mode="outlined" onPress={() => setStep(2)} style={styles.backButton}>
                  Back
                </Button>
                <Button mode="contained" onPress={handleCreateOrder} loading={loading} disabled={loading} style={styles.createButton}>
                  Create Order
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Product Selection Modal */}
      <Portal>
        <Modal
          visible={productModalVisible}
          onDismiss={() => setProductModalVisible(false)}
          contentContainerStyle={[
            styles.modal,
            { width: modalWidth, maxHeight: modalMaxHeight },
          ]}
        >
          <View style={styles.modalInner}>
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" style={styles.modalTitle}>
                Select Product
              </Text>
              <Button mode="text" onPress={() => setProductModalVisible(false)} icon="close">
                Close
              </Button>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              {products.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text variant="bodyLarge" style={styles.emptyText}>
                    No products available
                  </Text>
                  <Text variant="bodyMedium" style={styles.emptySubtext}>
                    Check if products are added and active in the system.
                  </Text>
                </View>
              ) : (
                products.map(product => {
                  const totalStock = (product.sizes || []).reduce((sum, variant) => sum + (variant.stock || 0), 0);
                  const isOutOfStock = totalStock === 0;

                  return (
                    <Card key={product.id} style={[styles.productCard, isOutOfStock && styles.outOfStockCard]}>
                      <Card.Content>
                        <View style={styles.productHeader}>
                          <Text variant="titleMedium" style={styles.productName}>
                            {product.title}
                          </Text>
                          <Text variant="titleMedium" style={styles.productPrice}>
                            ${product.sellingPrice}
                          </Text>
                        </View>

                        <Text variant="bodyMedium" style={styles.productDescription}>
                          {product.description}
                        </Text>

                        <Text variant="bodySmall" style={styles.productCategory}>
                          Category: {product.category}
                        </Text>

                        <View style={styles.stockInfo}>
                          <Chip mode="outlined" style={isOutOfStock ? styles.outOfStockChip : styles.inStockChip}>
                            {isOutOfStock ? 'Out of Stock' : `${totalStock} in stock`}
                          </Chip>
                        </View>

                        <Text variant="bodySmall" style={styles.variantsTitle}>
                          Available Variants:
                        </Text>

                        <View style={styles.variantsContainer}>
                          {(product.sizes || []).map((variant, index) => (
                            <Chip
                              key={`${product.id}-${variant.size}-${variant.color}-${index}`}
                              mode="outlined"
                              onPress={() => !isOutOfStock && addToCart(product, index, 1)}
                              disabled={(variant.stock || 0) === 0}
                              style={[
                                styles.variantChip,
                                (variant.stock || 0) === 0 && styles.disabledVariant,
                              ]}
                            >
                              {variant.size} / {variant.color}
                              {variant.stock > 0 ? ` (${variant.stock})` : ' (Sold out)'}
                            </Chip>
                          ))}
                        </View>

                        {isOutOfStock && <Text style={styles.outOfStockText}>This product is currently out of stock</Text>}
                      </Card.Content>
                    </Card>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Modal>
      </Portal>
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

  /* modal */
  modal: {
    alignSelf: 'center',
    backgroundColor: 'white',
    borderRadius: scaleSize(12),
    // elevation shadow on Android / iOS
    ...Platform.select({
      android: { elevation: 6 },
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
    }),
    overflow: 'hidden',
  },
  modalInner: {
    flexDirection: 'column',
    // make inner container fill modal; ScrollView will handle overflow
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scaleSize(12),
    paddingHorizontal: scaleSize(14),
    borderBottomWidth: 1,
    borderBottomColor: '#F0E6E0',
    backgroundColor: '#FAF9F6',
  },
  modalTitle: {
    margin: 0,
    color: '#3B3B3B',
  },
  modalContent: {
    paddingHorizontal: scaleSize(14),
    paddingVertical: scaleSize(12),
    // let content size define scrollable area; this container will grow until modalMaxHeight
  },

  /* product list inside modal */
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scaleSize(6),
  },
  productName: {
    flex: 1,
    fontWeight: '700',
    fontSize: scaleSize(8),
    color: '#3B3B3B',
    marginRight: scaleSize(8),
  },
  productPrice: {
    textAlign: 'right',
    color: '#3B3B3B',
    fontWeight: '700',
  },
  productDescription: {
    color: '#A08B73',
    paddingTop: scaleSize(4),
    marginBottom: scaleSize(8),
    fontSize: scaleSize(7),
  },
  productCategory: {
    color: '#A08B73',
    fontStyle: 'italic',
    marginBottom: scaleSize(8),
  },
  stockInfo: {
    marginBottom: scaleSize(10),
  },
  inStockChip: {
    backgroundColor: '#E8F5E8',
    alignSelf: 'flex-start',
  },
  outOfStockChip: {
    backgroundColor: '#FFEBEE',
    alignSelf: 'flex-start',
  },
  outOfStockCard: {
    opacity: 0.9,
    backgroundColor: '#FBFBFB',
  },
  variantsTitle: {
    fontWeight: '700',
    marginBottom: scaleSize(8),
    color: '#3B3B3B',
  },
  variantsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: scaleSize(10),
  },
  variantChip: {
    marginRight: scaleSize(8),
    marginBottom: scaleSize(8),
  },
  disabledVariant: {
    opacity: 0.55,
  },
  outOfStockText: {
    color: '#FF5252',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: scaleSize(8),
  },

  emptyState: {
    alignItems: 'center',
    padding: scaleSize(20),
  },

  emptyText: {
    textAlign: 'center',
    color: '#3B3B3B',
    marginBottom: scaleSize(8),
  },
  emptySubtext: {
    textAlign: 'center',
    color: '#A08B73',
  },

  /* rest of screen styles left mostly as before */
  title: {
    textAlign: 'center',
    marginBottom: scaleSize(24),
    color: '#3B3B3B',
  },
  stepCard: {
    marginBottom: scaleSize(16),
  },
  stepTitle: {
    marginBottom: scaleSize(16),
    color: '#3B3B3B',
  },
  customerCard: {
    marginBottom: scaleSize(8),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedCustomerCard: {
    borderColor: '#F7CAC9',
    backgroundColor: '#FAF9F6',
  },
  selectedCustomer: {
    marginBottom: scaleSize(16),
    fontStyle: 'italic',
    color: '#A08B73',
  },
  addProductButton: {
    marginBottom: scaleSize(12),
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
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  discountText: {
    color: '#4CAF50',
    fontSize: 12,
  },
  stepButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: scaleSize(16),
  },
  backButton: {
    flex: 1,
    marginRight: scaleSize(8),
  },
  customerName: {
    fontWeight: 'bold',
    color: '#3B3B3B',
    marginBottom: scaleSize(4),
  },
  customerEmail: {
    color: '#A08B73',
    marginBottom: scaleSize(2),
  },
  customerPhone: {
    color: '#A08B73',
  },
  nextButton: {
    flex: 2,
    backgroundColor: '#F7CAC9',
  },
  createButton: {
    flex: 2,
    backgroundColor: '#E6C76E',
  },
  productCard: {
    marginBottom: scaleSize(12),
    borderRadius: scaleSize(8),
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
  },
  divider: {
    marginVertical: scaleSize(8),
  },
  totalAmount: {
    color: '#F7CAC9',
    fontWeight: 'bold',
  },
  profitText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  noCustomersContainer: {
    alignItems: 'center',
    padding: scaleSize(20),
    backgroundColor: '#FFF9C4',
    borderRadius: scaleSize(8),
    marginBottom: scaleSize(16),
  },
  noCustomersTitle: {
    fontSize: scaleSize(16),
    fontWeight: 'bold',
    color: '#F57C00',
    marginBottom: scaleSize(8),
    textAlign: 'center',
  },
  noCustomersText: {
    fontSize: scaleSize(12),
    color: '#3B3B3B',
    textAlign: 'center',
    marginBottom: scaleSize(12),
  },
  requirementsList: {
    marginBottom: scaleSize(16),
    alignSelf: 'stretch',
  },
  requirement: {
    fontSize: scaleSize(11),
    color: '#3B3B3B',
    marginBottom: scaleSize(4),
  },
  refreshButton: {
    marginBottom: scaleSize(12),
    borderColor: '#F7CAC9',
  },
  contactAdmin: {
    fontSize: scaleSize(10),
    color: '#A08B73',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default CreateOrderScreen;
