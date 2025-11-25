import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Chip, DataTable, Button, Searchbar, SegmentedButtons, Modal, Portal } from 'react-native-paper';
import { Product, getProducts, getLowStockProducts, getOutOfStockProducts } from '../../firebase/firestore';
import { scaleSize, platformStyle } from '../../utils/constants';

const InventoryScreen: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'low' | 'out'>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [viewMode]);

  useEffect(() => {
    filterProducts();
  }, [searchQuery, products]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      let productsData: Product[];
      
      switch (viewMode) {
        case 'low':
          productsData = await getLowStockProducts();
          break;
        case 'out':
          productsData = await getOutOfStockProducts();
          break;
        default:
          productsData = await getProducts(true);
      }
      
      setProducts(productsData);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    if (!searchQuery) {
      setFilteredProducts(products);
      return;
    }

    const filtered = products.filter(product =>
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredProducts(filtered);
  };

  const getTotalStock = (variants: any[]) => {
    return variants.reduce((total, variant) => total + variant.stock, 0);
  };

  // Updated low stock logic: if any variant stock <= 3, mark as low stock
  const getStockStatus = (variants: any[]) => {
    const totalStock = getTotalStock(variants);
    
    if (totalStock === 0) return { status: 'Out of Stock', color: '#FF5252' };
    
    // Check if any variant has stock <= 3
    const hasLowStockVariant = variants.some(variant => variant.stock <= 3 && variant.stock > 0);
    if (hasLowStockVariant) return { status: 'Low Stock', color: '#FF9800' };
    
    return { status: 'In Stock', color: '#4CAF50' };
  };

  // Check if product has any low stock variant (stock <= 3)
  const hasLowStockVariant = (variants: any[]): boolean => {
    return variants.some(variant => variant.stock <= 3 && variant.stock > 0);
  };

  // Check if product is out of stock (all variants = 0)
  const isOutOfStock = (variants: any[]): boolean => {
    return variants.every(variant => variant.stock === 0);
  };

  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedProduct(null);
  };

  const getVariantStockStatus = (stock: number) => {
    if (stock === 0) return { status: 'Out of Stock', color: '#FF5252' };
    if (stock <= 3) return { status: 'Low Stock', color: '#FF9800' };
    return { status: 'In Stock', color: '#4CAF50' };
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Inventory Management
        </Text>

        <SegmentedButtons
          value={viewMode}
          onValueChange={setViewMode}
          buttons={[
            { value: 'all', label: 'All Products' },
            { value: 'low', label: 'Low Stock' },
            { value: 'out', label: 'Out of Stock' },
          ]}
          style={styles.segment}
        />

        <Searchbar
          placeholder="Search inventory..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />

        <DataTable>
          <DataTable.Header>
            <DataTable.Title>Product</DataTable.Title>
            <DataTable.Title>Category</DataTable.Title>
            <DataTable.Title numeric>Total Stock</DataTable.Title>
            <DataTable.Title>Status</DataTable.Title>
            <DataTable.Title>Variants</DataTable.Title>
          </DataTable.Header>

          {filteredProducts.map((product) => {
            const totalStock = getTotalStock(product.sizes);
            const stockStatus = getStockStatus(product.sizes);
            
            return (
              <DataTable.Row 
                key={product.id} 
                onPress={() => openProductModal(product)}
                style={styles.tableRow}
              >
                <DataTable.Cell>
                  <Text variant="bodyMedium" numberOfLines={1} style={styles.productName}>
                    {product.title}
                  </Text>
                </DataTable.Cell>
                <DataTable.Cell>
                  <Chip mode="outlined" compact style={styles.categoryChip}>
                    {product.category}
                  </Chip>
                </DataTable.Cell>
                <DataTable.Cell numeric>
                  <Text variant="bodyMedium" style={[styles.stockText, { color: stockStatus.color }]}>
                    {totalStock}
                  </Text>
                </DataTable.Cell>
                <DataTable.Cell>
                  <Chip 
                    mode="outlined"
                    textStyle={{ color: stockStatus.color, fontSize: 12, fontWeight: 'bold' }}
                    style={styles.statusChip}
                  >
                    {stockStatus.status}
                  </Chip>
                </DataTable.Cell>
                <DataTable.Cell>
                  <Text variant="bodySmall" style={styles.variantsText}>
                    {product.sizes.length} variants
                  </Text>
                </DataTable.Cell>
              </DataTable.Row>
            );
          })}
        </DataTable>

        {filteredProducts.length === 0 && !loading && (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text variant="bodyLarge" style={styles.emptyText}>
                {viewMode === 'all' 
                  ? 'No products found' 
                  : viewMode === 'low'
                  ? 'No low stock products'
                  : 'No out of stock products'
                }
              </Text>
            </Card.Content>
          </Card>
        )}

        <Card style={styles.statsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.statsTitle}>
              Inventory Summary
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={styles.statNumber}>
                  {products.filter(p => 
                    !hasLowStockVariant(p.sizes) && !isOutOfStock(p.sizes)
                  ).length}
                </Text>
                <Text variant="bodyMedium">In Stock</Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={[styles.statNumber, styles.lowStock]}>
                  {products.filter(p => hasLowStockVariant(p.sizes)).length}
                </Text>
                <Text variant="bodyMedium">Low Stock</Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={[styles.statNumber, styles.outOfStock]}>
                  {products.filter(p => isOutOfStock(p.sizes)).length}
                </Text>
                <Text variant="bodyMedium">Out of Stock</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Product Details Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={closeModal}
          contentContainerStyle={styles.modalContainer}
        >
          {selectedProduct && (
            <ScrollView style={styles.modalContent}>
              <Text variant="titleLarge" style={styles.modalTitle}>
                {selectedProduct.title}
              </Text>
              
              <View style={styles.productInfo}>
                <Chip mode="outlined" style={styles.modalCategoryChip}>
                  {selectedProduct.category}
                </Chip>
              </View>

              <DataTable style={styles.modalTable}>
                <DataTable.Header>
                  <DataTable.Title style={styles.sizeColumn}>Size</DataTable.Title>
                  <DataTable.Title numeric style={styles.stockColumn}>Stock</DataTable.Title>
                  <DataTable.Title style={styles.statusColumn}>Status</DataTable.Title>
                </DataTable.Header>

                {selectedProduct.sizes.map((variant, index) => {
                  const variantStatus = getVariantStockStatus(variant.stock);
                  return (
                    <DataTable.Row key={index}>
                      <DataTable.Cell style={styles.sizeColumn}>
                        <Text variant="bodyMedium">{variant.size}</Text>
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={styles.stockColumn}>
                        <Text 
                          variant="bodyMedium" 
                          style={[styles.variantStock, { color: variantStatus.color }]}
                        >
                          {variant.stock}
                        </Text>
                      </DataTable.Cell>
                      <DataTable.Cell style={styles.statusColumn}>
                        <Chip 
                          mode="outlined"
                          textStyle={{ 
                            color: variantStatus.color, 
                            fontSize: 11, 
                            fontWeight: 'bold' 
                          }}
                          style={styles.variantStatusChip}
                        >
                          {variantStatus.status}
                        </Chip>
                      </DataTable.Cell>
                    </DataTable.Row>
                  );
                })}
              </DataTable>

              <View style={styles.totalStockSection}>
                <Text variant="titleSmall" style={styles.totalStockLabel}>
                  Total Stock:
                </Text>
                <Text variant="headlineSmall" style={[
                  styles.totalStockValue,
                  { color: getStockStatus(selectedProduct.sizes).color }
                ]}>
                  {getTotalStock(selectedProduct.sizes)}
                </Text>
              </View>

              <Button 
                mode="contained" 
                onPress={closeModal}
                style={styles.closeButton}
                labelStyle={styles.closeButtonLabel}
              >
                Close
              </Button>
            </ScrollView>
          )}
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
  title: {
    textAlign: 'center',
    marginBottom: scaleSize(24),
    color: '#3B3B3B',
  },
  segment: {
    marginBottom: scaleSize(16),
  },
  searchbar: {
    marginBottom: scaleSize(16),
  },
  tableRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  productName: {
    fontWeight: '600',
    color: '#3B3B3B',
  },
  categoryChip: {
    backgroundColor: '#E3F2FD',
  },
  stockText: {
    fontWeight: 'bold',
  },
  statusChip: {
    backgroundColor: 'transparent',
  },
  variantsText: {
    color: '#666',
    fontStyle: 'italic',
  },
  emptyCard: {
    marginTop: scaleSize(20),
    alignItems: 'center',
    padding: scaleSize(20),
  },
  emptyText: {
    textAlign: 'center',
    color: '#A08B73',
  },
  statsCard: {
    marginTop: scaleSize(20),
    backgroundColor: '#FAF9F6',
  },
  statsTitle: {
    textAlign: 'center',
    marginBottom: scaleSize(16),
    color: '#3B3B3B',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  lowStock: {
    color: '#FF9800',
  },
  outOfStock: {
    color: '#FF5252',
  },
  // Modal Styles
  modalContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    maxHeight: '100%',
  },
  modalContent: {
    padding: 20,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: scaleSize(16),
    color: '#3B3B3B',
  },
  productInfo: {
    marginBottom: scaleSize(20),
    alignItems: 'center',
  },
  modalCategoryChip: {
    backgroundColor: '#E3F2FD',
    marginBottom: scaleSize(8),
  },
  // Modal Table Styles with proper spacing
  modalTable: {
    marginBottom: scaleSize(16),
  },
  sizeColumn: {
    flex: 1.5,
    justifyContent: 'center',
  },
  stockColumn: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: scaleSize(8),
  },
  statusColumn: {
    flex: 1.5,
    justifyContent: 'center',
    paddingLeft: scaleSize(12),
  },
  variantStock: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  variantStatusChip: {
    backgroundColor: 'transparent',
    minWidth: 90,
  },
  totalStockSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: scaleSize(20),
    padding: scaleSize(16),
    backgroundColor: '#FAF9F6',
    borderRadius: 8,
  },
  totalStockLabel: {
    fontWeight: '600',
    color: '#3B3B3B',
  },
  totalStockValue: {
    fontWeight: 'bold',
  },
  closeButton: {
    marginTop: scaleSize(20),
    backgroundColor: '#F7CAC9',
  },
  closeButtonLabel: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

export default InventoryScreen;