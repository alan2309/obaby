// src/screens/salesman/ProductCatalogSalesman.tsx
import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import ProductCatalog from '../../components/ProductCatalog';
import { Product } from '../../firebase/firestore';

type NavigationProp = StackNavigationProp<any, 'ProductDetail'>;

const ProductCatalogSalesman: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleProductPress = (product: Product) => {
    const serializableProduct = {
      ...product,
      createdAt: product.createdAt?.toISOString?.() || product.createdAt,
      updatedAt: product.updatedAt?.toISOString?.() || product.updatedAt,
    };
    navigation.navigate('ProductDetail', { product: serializableProduct });
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setRefreshKey(prev => prev + 1);
    }, [])
  );

  return (
    <View style={styles.container}>
      <ProductCatalog 
        key={refreshKey} // This forces complete re-render when key changes
        onProductPress={handleProductPress}
        showAddToCart={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EDE0',
  },
});

export default ProductCatalogSalesman;