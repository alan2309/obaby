// C:\Users\alank\OneDrive\Desktop\projcts\BusinessManager\src\screens\salesman\ProductCatalogSalesman.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import ProductCatalog from '../../components/ProductCatalog';

const ProductCatalogSalesman: React.FC = () => {
  return (
    <View style={styles.container}>
      <ProductCatalog 
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