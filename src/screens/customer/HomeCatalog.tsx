//src\screens\customer\HomeCatalog.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import ProductCatalog from '../../components/ProductCatalog';

const HomeCatalog: React.FC = () => {
  return (
    <View style={styles.container}>
      <ProductCatalog 
        showAddToCart={true}
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

export default HomeCatalog;