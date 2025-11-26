// src/screens/salesman/CategoriesScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  ListRenderItemInfo,
} from 'react-native';
import { Text, Card, ActivityIndicator, Searchbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Category, getCategories, getProductsByCategory, getProducts } from '../../firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { theme, scaleSize, scaleFont } from '../../utils/constants';

type NavigationProp = StackNavigationProp<any, 'CategoryProducts'>;

interface CategoryWithPreview extends Category {
  previewImage?: string;
  productCount: number;
  isAllProducts?: boolean;
}

const CategoriesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [categories, setCategories] = useState<CategoryWithPreview[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<CategoryWithPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { width: windowWidth } = useWindowDimensions();

  // Calculate responsive grid layout
  const isLargeScreen = windowWidth >= 768;
  const numColumns = isLargeScreen ? 3 : 2;
  const cardSpacing = scaleSize(8);
  const totalHorizontalPadding = scaleSize(20);
  const availableWidth = windowWidth - totalHorizontalPadding - (cardSpacing * (numColumns - 1));
  const cardWidth = availableWidth / numColumns;

  // Create the "All Products" category
  const createAllProductsCategory = async (): Promise<CategoryWithPreview> => {
    try {
      const allProducts = await getProducts(true);
      const previewImage = allProducts.length > 0 ? allProducts[0].images?.[0] : undefined;
      
      return {
        id: 'all-products',
        title: 'All Products',
        previewImage,
        productCount: allProducts.length,
        isAllProducts: true,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('Error creating all products category:', error);
      return {
        id: 'all-products',
        title: 'All Products',
        previewImage: undefined,
        productCount: 0,
        isAllProducts: true,
        createdAt: new Date(),
      };
    }
  };

  const loadCategoriesWithPreviews = async () => {
    try {
      setLoading(true);

      // Create All Products category first
      const allProductsCategory = await createAllProductsCategory();
      
      // Get regular categories
      const categoriesData = await getCategories();
      console.log('📂 Loaded categories:', categoriesData.length);

      const categoriesWithPreviews: CategoryWithPreview[] = await Promise.all(
        categoriesData.map(async (category) => {
          if (!category.id) {
            console.warn('⚠️ Category without id:', category);
            return {
              ...category,
              previewImage: undefined,
              productCount: 0,
            };
          }

          try {
            const categoryProducts = await getProductsByCategory(category.id, true);
            console.log(`📊 Category "${category.title}" (id:${category.id}) -> ${categoryProducts.length}`);

            const previewImage = categoryProducts.length > 0 ? categoryProducts[0].images?.[0] : undefined;
            return {
              ...category,
              previewImage,
              productCount: categoryProducts.length,
            };
          } catch (err) {
            console.error(`Error loading products for category ${category.title}:`, err);
            return {
              ...category,
              previewImage: undefined,
              productCount: 0,
            };
          }
        })
      );

      // Combine All Products with regular categories and sort
      const allCategories = [allProductsCategory, ...categoriesWithPreviews];
      const regularCategories = allCategories.slice(1).sort((a, b) => (a.title || '').localeCompare(b.title || ''));

      // Final array with All Products first, then sorted regular categories
      const finalCategories = [allCategories[0], ...regularCategories];

      setCategories(finalCategories);
      setFilteredCategories(finalCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategories([]);
      setFilteredCategories([]);
    } finally {
      setLoading(false);
    }
  };

  // Use the reliable per-category loader on focus
  useFocusEffect(
    useCallback(() => {
      loadCategoriesWithPreviews();
    }, [])
  );

  // Filter categories when search changes
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setFilteredCategories(categories);
      return;
    }
    setFilteredCategories(
      categories.filter((c) => (c.title || '').toLowerCase().includes(q))
    );
  }, [searchQuery, categories]);

  const handleCategoryPress = (category: CategoryWithPreview) => {
    if (category.isAllProducts) {
      navigation.navigate('CategoryProducts', {
        categoryId: undefined,
        categoryTitle: 'All Products',
        isAllProducts: true,
      });
    } else {
      navigation.navigate('CategoryProducts', {
        categoryId: category.id,
        categoryTitle: category.title,
        isAllProducts: false,
      });
    }
  };

  const renderCategoryItem = ({ item }: ListRenderItemInfo<CategoryWithPreview>) => {
    return (
      <View style={[styles.categoryItem, { width: cardWidth }]}>
        <TouchableOpacity onPress={() => handleCategoryPress(item)} activeOpacity={0.7}>
          <Card style={[
            styles.categoryCard,
            item.isAllProducts && styles.allProductsCard
          ]} mode="elevated">
            <View style={styles.cardInnerWrapper}>
              <View style={[
                styles.previewArea,
                item.isAllProducts && styles.allProductsPreview
              ]}>
                {item.previewImage ? (
                  <Image source={{ uri: item.previewImage }} style={styles.previewImage} resizeMode="cover" />
                ) : (
                  <View style={[
                    styles.noPreview,
                    item.isAllProducts && styles.allProductsNoPreview
                  ]}>
                    <Text style={styles.noPreviewText}>
                      {item.productCount === 0 ? 'No Products' : 'No Image'}
                    </Text>
                  </View>
                )}
                {item.isAllProducts && (
                  <View style={styles.allProductsBadge}>
                    <Text style={styles.allProductsBadgeText}>ALL</Text>
                  </View>
                )}
                <View style={styles.folderTab} />
              </View>

              <Card.Content style={styles.categoryContent}>
                <Text style={[
                  styles.categoryTitle,
                  item.isAllProducts && styles.allProductsTitle
                ]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.productCount}>
                  {item.productCount} product{item.productCount !== 1 ? 's' : ''}
                </Text>
              </Card.Content>
            </View>
          </Card>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search categories..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
        iconColor="#A08B73"
        inputStyle={styles.searchInput}
      />

      <FlatList
        data={filteredCategories}
        renderItem={renderCategoryItem}
        keyExtractor={(item) => item.id || item.title}
        numColumns={numColumns}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {categories.length === 0 ? 'No categories available' : 'No categories found'}
            </Text>
            <Text style={styles.emptySubtext}>
              {categories.length === 0
                ? 'Categories will appear here once they are added to the system.'
                : 'Try adjusting your search terms.'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme?.colors?.background ?? '#F5EDE0',
  },
  searchbar: {
    margin: scaleSize(10),
    marginBottom: scaleSize(6),
    backgroundColor: theme?.colors?.surface ?? '#FAF9F6',
    borderRadius: scaleSize(8),
    elevation: 1,
  },
  searchInput: {
    color: theme?.colors?.text ?? '#3B3B3B',
    fontSize: scaleFont(12),
  },
  listContent: {
    paddingHorizontal: scaleSize(10),
    paddingBottom: scaleSize(15),
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: scaleSize(8),
  },
  categoryItem: {
    marginHorizontal: scaleSize(2),
  },
  categoryCard: {
    backgroundColor: theme?.colors?.surface ?? '#FAF9F6',
    borderRadius: scaleSize(10),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  allProductsCard: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
    borderWidth: 1,
  },
  cardInnerWrapper: {
    borderRadius: scaleSize(10),
    overflow: 'hidden',
  },
  previewArea: {
    height: scaleSize(90),
    backgroundColor: '#E6C76E',
    position: 'relative',
    borderTopLeftRadius: scaleSize(10),
    borderTopRightRadius: scaleSize(10),
    overflow: 'hidden',
  },
  allProductsPreview: {
    backgroundColor: '#BBDEFB',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  noPreview: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7CAC9',
  },
  allProductsNoPreview: {
    backgroundColor: '#90CAF9',
  },
  noPreviewText: {
    color: '#3B3B3B',
    fontSize: scaleFont(10),
    fontWeight: '500',
  },
  allProductsBadge: {
    position: 'absolute',
    top: scaleSize(4),
    right: scaleSize(4),
    backgroundColor: '#2196F3',
    borderRadius: scaleSize(8),
    paddingHorizontal: scaleSize(6),
    paddingVertical: scaleSize(2),
  },
  allProductsBadgeText: {
    color: 'white',
    fontSize: scaleFont(8),
    fontWeight: 'bold',
  },
  folderTab: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: scaleSize(4),
    backgroundColor: theme?.colors?.surface ?? '#FAF9F6',
    borderTopLeftRadius: scaleSize(10),
    borderTopRightRadius: scaleSize(10),
  },
  categoryContent: {
    padding: scaleSize(8),
    paddingTop: scaleSize(4),
  },
  categoryTitle: {
    fontWeight: '600',
    color: theme?.colors?.text ?? '#3B3B3B',
    fontSize: scaleFont(12),
    marginBottom: scaleSize(2),
  },
  allProductsTitle: {
    color: '#1976D2',
    fontWeight: '700',
  },
  productCount: {
    color: theme?.colors?.placeholder ?? '#A08B73',
    fontSize: scaleFont(10),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme?.colors?.background ?? '#F5EDE0',
    padding: scaleSize(20),
  },
  loadingText: {
    marginTop: scaleSize(16),
    color: theme?.colors?.text ?? '#3B3B3B',
    fontSize: scaleFont(14),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scaleSize(25),
    minHeight: scaleSize(200),
  },
  emptyText: {
    textAlign: 'center',
    color: theme?.colors?.text ?? '#3B3B3B',
    marginBottom: scaleSize(6),
    fontSize: scaleFont(16),
    fontWeight: '600',
  },
  emptySubtext: {
    textAlign: 'center',
    color: theme?.colors?.placeholder ?? '#A08B73',
    marginBottom: scaleSize(8),
    fontSize: scaleFont(13),
  },
});

export default CategoriesScreen;