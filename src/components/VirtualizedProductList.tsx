import React from 'react';
import { FlatList, ListRenderItem } from 'react-native';
import { Product } from '../firebase/firestore';

interface VirtualizedProductListProps {
  data: Product[];
  renderItem: ListRenderItem<Product>;
  numColumns?: number;
  loading?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}

const VirtualizedProductList: React.FC<VirtualizedProductListProps> = ({
  data,
  renderItem,
  numColumns = 2,
  loading = false,
  onRefresh,
  refreshing = false,
}) => {
  // Optimize FlatList performance
  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={(item) => item.id || Math.random().toString()}
      numColumns={numColumns}
      showsVerticalScrollIndicator={false}
      initialNumToRender={8} // Render fewer items initially
      maxToRenderPerBatch={10} // Control the batch size
      windowSize={5} // Reduce the window size
      removeClippedSubviews={true} // Unmount offscreen components
      updateCellsBatchingPeriod={50} // Batch updates
      onRefresh={onRefresh}
      refreshing={refreshing}
      contentContainerStyle={{
        padding: 8,
        paddingBottom: 20,
      }}
      columnWrapperStyle={numColumns > 1 ? {
        justifyContent: 'space-between',
        marginBottom: 8,
      } : undefined}
    />
  );
};

export default VirtualizedProductList;