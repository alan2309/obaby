import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Chip, DataTable, Button, Searchbar, SegmentedButtons } from 'react-native-paper';
import { Product, getProducts, getLowStockProducts, getOutOfStockProducts } from '../../firebase/firestore';
import { scaleSize, platformStyle } from '../../utils/constants';

const InventoryScreen: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'low' | 'out'>('all');

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

  const getStockStatus = (totalStock: number) => {
    if (totalStock === 0) return { status: 'Out of Stock', color: '#FF5252' };
    if (totalStock <= 10) return { status: 'Low Stock', color: '#FF9800' };
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
            const stockStatus = getStockStatus(totalStock);
            
            return (
              <DataTable.Row key={product.id}>
                <DataTable.Cell>
                  <Text variant="bodyMedium" numberOfLines={1}>
                    {product.title}
                  </Text>
                </DataTable.Cell>
                <DataTable.Cell>
                  <Chip mode="outlined" compact>
                    {product.category}
                  </Chip>
                </DataTable.Cell>
                <DataTable.Cell numeric>
                  <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>
                    {totalStock}
                  </Text>
                </DataTable.Cell>
                <DataTable.Cell>
                  <Chip 
                    mode="outlined"
                    textStyle={{ color: stockStatus.color, fontSize: 12 }}
                  >
                    {stockStatus.status}
                  </Chip>
                </DataTable.Cell>
                <DataTable.Cell>
                  <Text variant="bodySmall">
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
                  {products.filter(p => getTotalStock(p.sizes) > 10).length}
                </Text>
                <Text variant="bodyMedium">In Stock</Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={[styles.statNumber, styles.lowStock]}>
                  {products.filter(p => {
                    const stock = getTotalStock(p.sizes);
                    return stock > 0 && stock <= 10;
                  }).length}
                </Text>
                <Text variant="bodyMedium">Low Stock</Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={[styles.statNumber, styles.outOfStock]}>
                  {products.filter(p => getTotalStock(p.sizes) === 0).length}
                </Text>
                <Text variant="bodyMedium">Out of Stock</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
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
  segment: {
    marginBottom: scaleSize(16),
  },
  searchbar: {
    marginBottom: scaleSize(16),
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
});

export default InventoryScreen;