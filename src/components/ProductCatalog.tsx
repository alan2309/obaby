// src/screens/ProductCatalog.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  useWindowDimensions,
  TouchableOpacity,
  ListRenderItemInfo,
  Platform,
  Modal,
  ScrollView,
} from "react-native";
import { Text, Card, Chip, Searchbar, Button, ActivityIndicator, Snackbar } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { Product, getProducts, getProductsByCategory } from "../firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { scaleSize, scaleFont, isTablet, isSmallDevice, platformStyle, theme } from '../utils/constants';

interface ProductCatalogProps {
  onProductPress?: (product: Product) => void;
  showAddToCart?: boolean;
  onAddToCart?: (product: Product) => void;
  categoryId?: string; 
  screenTitle?: string; 
  onProductLongPress?: (product: Product) => void;
  selectedProducts?: Product[];
  isSelectionMode?: boolean;
}

interface ColorGroup {
  color: string;
  sizes: Array<{ size: string; stock: number; variant: any }>;
}

const MIN_CARD_TABLET = 240;
const MIN_CARD_SMALL = 140;
const MIN_CARD_DEFAULT = 180;
const MIN_CARD_LAPTOP = 200; // Smaller minimum for laptop screens

// Add a new function to detect laptop-like screens
const isLaptopScreen = (width: number) => width >= 1200;

// Size ordering function
const getSizeOrder = (size: string): number => {
  const sizeMap: { [key: string]: number } = {
    'XS': 0,
    'S': 1,
    'M': 2,
    'L': 3,
    'XL': 4,
    'XXL': 5,
    'XXXL': 6,
    '2XL': 5,
    '3XL': 6,
    '4XL': 7,
    '5XL': 8,
    '6XL': 9,
    '28': 10,
    '30': 11,
    '32': 12,
    '34': 13,
    '36': 14,
    '38': 15,
    '40': 16,
    '42': 17,
    '44': 18,
    '46': 19,
    '48': 20,
    '50': 21,
  };

  // Convert to uppercase and trim
  const normalizedSize = size.toUpperCase().trim();
  
  // Check if it's in our predefined order
  if (sizeMap[normalizedSize] !== undefined) {
    return sizeMap[normalizedSize];
  }

  // If it's a number (like "28", "30", etc.), convert to number and add offset
  const numericSize = parseInt(normalizedSize);
  if (!isNaN(numericSize)) {
    return numericSize + 100; // Add offset to separate from letter sizes
  }

  // For any other sizes, put them at the end
  return 1000;
};

const sortSizes = (sizes: Array<{ size: string; stock: number; variant: any }>) => {
  return sizes.sort((a, b) => {
    const orderA = getSizeOrder(a.size);
    const orderB = getSizeOrder(b.size);
    return orderA - orderB;
  });
};

const ProductCard = React.memo(
  ({
    item,
    onPress,
    onAddToCart,
    showAddToCart,
    cardWidth,
    isAdmin,
    onLongPress,
    isSelected = false,
    isSelectionMode = false,
    onOpenSizeModal,
  }: {
    item: Product;
    onPress?: (p: Product) => void;
    onAddToCart?: (p: Product) => void;
    showAddToCart?: boolean;
    cardWidth: number;
    isAdmin?: boolean;
    onLongPress?: (p: Product) => void;
    isSelected?: boolean;
    isSelectionMode?: boolean;
    onOpenSizeModal?: (product: Product) => void;
  }) => {
    const sizes = Array.isArray(item.sizes) ? item.sizes : [];
    const totalStock = sizes.reduce((t: number, v: any) => t + (v?.stock || 0), 0);
    const isOutOfStock = totalStock === 0;

    // Use full image height (more height than width)
    const imageHeight = Math.max(scaleSize(120), Math.round(cardWidth * 1.2));

    return (
      <View style={[styles.cardWrapper, { width: cardWidth }]}>
        <Card 
          style={[
            styles.productCard, 
            isSelectionMode && styles.selectionModeCard,
            isSelected && styles.selectedProductCard
          ]} 
          mode="elevated" 
        >
          {/* Wrap the entire content in a View with overflow hidden */}
          <View style={styles.cardInnerContainer}>
            <TouchableOpacity 
              activeOpacity={0.95} 
              onPress={() => onPress?.(item)}
              onLongPress={() => onLongPress?.(item)}
              delayLongPress={500}
              style={styles.touchableArea}
            >
              {/* Selection Indicator */}
              {isSelectionMode && (
                <View style={[
                  styles.selectionIndicator,
                  isSelected ? styles.selectedIndicator : styles.unselectedIndicator
                ]}>
                  <Text style={styles.selectionText}>
                    {isSelected ? '✓' : ''}
                  </Text>
                </View>
              )}

              <View style={[styles.imageContainer, { width: cardWidth, height: imageHeight }]}>
                {item.images && item.images.length > 0 ? (
                  <Image
                    source={{ uri: item.images[0] }}
                    style={[styles.productImage, { width: cardWidth, height: imageHeight }]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.productImage, styles.placeholderImage, { width: cardWidth, height: imageHeight }]}>
                    <Text style={styles.placeholderText}>No Image</Text>
                  </View>
                )}
              </View>

              <Card.Content style={styles.cardContent}>
                {/* Reduced font sizes for name and price */}
                <Text numberOfLines={2} style={styles.productTitle}>
                  {item.title ?? "Untitled Product"}
                </Text>
                
                <View style={styles.priceRow}>
                  <Text style={styles.sellingPrice}>
                    ₹{(Number(item.sellingPrice) || 0).toFixed(2)}
                  </Text>
                </View>

                <View style={styles.chipsRow}>
                  <Chip
                    mode="outlined"
                    style={[styles.stockChip, isOutOfStock ? styles.outOfStockChip : styles.inStockChip]}
                    textStyle={styles.chipText}
                  >
                    {isOutOfStock ? "Out of stock" : `${totalStock} in stock`}
                  </Chip>

                  <Chip mode="outlined" style={styles.categoryChip} textStyle={styles.chipText}>
                    {item.category || "—"}
                  </Chip>
                </View>
              </Card.Content>
            </TouchableOpacity>

            {/* Add to Cart Button - Moved outside TouchableOpacity */}
            {showAddToCart && onOpenSizeModal && (
              <View style={styles.addToCartContainer}>
                <Button
                  mode="contained"
                  onPress={() => onOpenSizeModal(item)}
                  disabled={isOutOfStock}
                  style={[styles.addToCartButton, isOutOfStock && styles.disabledButton]}
                  labelStyle={styles.buttonLabel}
                  contentStyle={styles.buttonContent}
                >
                  {isOutOfStock ? "Out of Stock" : "Add to Cart"}
                </Button>
              </View>
            )}
          </View>
        </Card>
      </View>
    );
  }
);

ProductCard.displayName = "ProductCard";

// Size Selection Modal Component
const SizeSelectionModal: React.FC<{
  visible: boolean;
  onDismiss: () => void;
  product: Product | null;
  onAddToCart: (product: Product, variant: any, quantity: number) => void;
}> = ({ visible, onDismiss, product, onAddToCart }) => {
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const { getTotalItems } = useCart();
  const navigation = useNavigation<any>();

  // Group variants by color
  const colorGroups = useMemo((): ColorGroup[] => {
    if (!product?.sizes) return [];
    
    const groups: { [key: string]: ColorGroup } = {};
    
    product.sizes.forEach(variant => {
      const color = variant.color || "Default";
      const size = variant.size || "N/A";
      const stock = variant.stock || 0;
      
      if (!groups[color]) {
        groups[color] = {
          color,
          sizes: []
        };
      }
      
      groups[color].sizes.push({
        size,
        stock,
        variant
      });
    });
    
    // Sort sizes within each color group using our size ordering
    Object.values(groups).forEach(group => {
      group.sizes = sortSizes(group.sizes);
    });
    
    return Object.values(groups).sort((a, b) => a.color.localeCompare(b.color));
  }, [product]);

  const handleAddToCart = () => {
    if (!product || !selectedVariant) return;
    
    onAddToCart(product, selectedVariant, quantity);
    setSnackbarVisible(true);
    
    // Reset selection but keep modal open
    setSelectedVariant(null);
    setQuantity(1);
  };

  const handleClose = () => {
    setSelectedVariant(null);
    setQuantity(1);
    onDismiss();
  };

  const handleViewCart = () => {
    handleClose();
    // Navigate to the OrderCart tab within SalesmanTabs
    navigation.navigate('SalesmanTabs', { screen: 'OrderCart' });
  };

  const handleSnackbarDismiss = () => {
    setSnackbarVisible(false);
  };

  const cartItemCount = getTotalItems?.() ?? 0;

  if (!product) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Size & Quantity</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
            <View style={styles.productInfo}>
              <Text style={styles.modalProductTitle}>{product.title}</Text>
              <Text style={styles.modalProductPrice}>₹{product.sellingPrice?.toFixed(2)}</Text>
            </View>

            <Text style={styles.sectionTitle}>Available Sizes & Colors</Text>
            
            {colorGroups.length > 0 ? (
              colorGroups.map((colorGroup, groupIndex) => (
                <View key={colorGroup.color} style={styles.colorGroup}>
                  <View style={styles.colorHeader}>
                    <Text style={styles.colorName}>{colorGroup.color}</Text>
                    <Text style={styles.colorStock}>
                      {colorGroup.sizes.reduce((sum, item) => sum + item.stock, 0)} available
                    </Text>
                  </View>
                  
                  <View style={styles.sizesContainer}>
                    {colorGroup.sizes.map((sizeItem, sizeIndex) => {
                      const isSelected = selectedVariant?.size === sizeItem.variant.size && 
                                       selectedVariant?.color === sizeItem.variant.color;
                      const isOutOfStock = sizeItem.stock === 0;
                      
                      return (
                        <TouchableOpacity
                          key={`${sizeItem.size}-${sizeIndex}`}
                          onPress={() => {
                            if (!isOutOfStock) {
                              setSelectedVariant(sizeItem.variant);
                              setQuantity(1);
                            }
                          }}
                          disabled={isOutOfStock}
                          style={styles.sizeTouchable}
                        >
                          <View style={[
                            styles.sizeChip,
                            isSelected && styles.selectedSizeChip,
                            isOutOfStock && styles.outOfStockSizeChip
                          ]}>
                            <Text style={[
                              styles.sizeText,
                              isSelected && styles.selectedSizeText,
                              isOutOfStock && styles.outOfStockSizeText
                            ]}>
                              {sizeItem.size}
                            </Text>
                            {!isOutOfStock && (
                              <Text style={[
                                styles.stockText,
                                isSelected && styles.selectedStockText
                              ]}>
                                {sizeItem.stock}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  
                  {groupIndex < colorGroups.length - 1 && (
                    <View style={styles.colorDivider} />
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.noVariantsText}>No variants available</Text>
            )}

            {selectedVariant && (
              <>
                <View style={styles.selectedVariantInfo}>
                  <Text style={styles.selectedVariantText}>
                    Selected: {selectedVariant.size}
                  </Text>
                  <Text style={styles.selectedStockInfo}>
                    Available: {selectedVariant.stock} units
                  </Text>
                </View>

                <Text style={styles.sectionTitle}>Quantity</Text>
                <View style={styles.quantityContainer}>
                  <Button
                    mode="outlined"
                    onPress={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    style={styles.quantityButton}
                    contentStyle={styles.quantityButtonContent}
                  >
                    -
                  </Button>
                  <Text style={styles.quantityText}>{quantity}</Text>
                  <Button
                    mode="outlined"
                    onPress={() => setQuantity(Math.min(selectedVariant.stock ?? 0, quantity + 1))}
                    disabled={quantity >= (selectedVariant.stock ?? 0)}
                    style={styles.quantityButton}
                    contentStyle={styles.quantityButtonContent}
                  >
                    +
                  </Button>
                </View>

                <View style={styles.priceSummary}>
                  <Text style={styles.summaryText}>
                    Price: ₹{product.sellingPrice?.toFixed(2)} × {quantity}
                  </Text>
                  <Text style={styles.finalPriceText}>
                    Total: ₹{((product.sellingPrice ?? 0) * quantity).toFixed(2)}
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={handleViewCart}
              style={styles.viewCartButton}
              disabled={cartItemCount === 0}
            >
              {cartItemCount > 0 ? `View Cart (${cartItemCount})` : 'View Cart'}
            </Button>
            <Button
              mode="contained"
              onPress={handleAddToCart}
              disabled={!selectedVariant}
              style={styles.addButton}
            >
              Add to Cart
            </Button>
          </View>
        </View>

        {/* Success Snackbar inside modal */}
        <Snackbar
          visible={snackbarVisible}
          onDismiss={handleSnackbarDismiss}
          duration={2000}
          style={styles.modalSnackbar}
          action={{
            label: "OK",
            onPress: handleSnackbarDismiss,
          }}
        >
          Added to cart successfully!
        </Snackbar>
      </View>
    </Modal>
  );
};

const ProductCatalog: React.FC<ProductCatalogProps> = ({ 
  onProductPress, 
  showAddToCart = false, 
  onAddToCart,
  categoryId,
  screenTitle,
  onProductLongPress,
  selectedProducts = [],
  isSelectionMode = false
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sizeModalVisible, setSizeModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { width: windowWidth } = useWindowDimensions();

  // load products
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      let productsData: Product[];
      
      if (categoryId) {
        // Load products for specific category
        console.log("Loading products for category:", categoryId);
        productsData = await getProductsByCategory(categoryId, true);
      } else {
        // Load all products
        productsData = await getProducts(true);
      }
      
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (err) {
      console.error("Error loading products:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // responsive columns and card width - UPDATED FOR LAPTOP SCREENS
  const { numColumns, cardWidth } = useMemo(() => {
    const laptopScreen = isLaptopScreen(windowWidth);
    
    // Use appropriate minimum card width based on screen size
    const MIN_CARD = laptopScreen 
      ? MIN_CARD_LAPTOP 
      : isTablet 
        ? MIN_CARD_TABLET 
        : isSmallDevice 
          ? MIN_CARD_SMALL 
          : MIN_CARD_DEFAULT;
    
    // Increase max columns for laptop screens
    const maxColumns = laptopScreen ? 4 : isTablet ? 3 : 2;
    const calculated = Math.floor(windowWidth / MIN_CARD) || 1;
    const cols = Math.min(Math.max(calculated, 1), maxColumns);

    const horizontalPadding = scaleSize(10) * 2; // list padding left/right
    const gapTotal = scaleSize(6) * (cols - 1);
    const available = windowWidth - horizontalPadding - gapTotal;
    const cWidth = Math.floor(available / cols);

    console.log(`Screen: ${windowWidth}px, Columns: ${cols}, CardWidth: ${cWidth}px, Laptop: ${laptopScreen}`);
    
    return { numColumns: cols, cardWidth: cWidth };
  }, [windowWidth]);

  // filtered list
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      (p.title || "").toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const handleOpenSizeModal = (product: Product) => {
    setSelectedProduct(product);
    setSizeModalVisible(true);
  };

  const handleAddToCartWithSize = (product: Product, variant: any, quantity: number) => {
    const cartItem: any = { product, sizeVariant: variant, quantity };
    addToCart(cartItem);
    // Snackbar is now handled inside the modal
  };

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Product>) => {
      const isSelected = selectedProducts.some(p => p.id === item.id);
      
      return (
        <ProductCard
          item={item}
          onPress={onProductPress}
          onAddToCart={onAddToCart}
          onLongPress={onProductLongPress}
          onOpenSizeModal={showAddToCart ? handleOpenSizeModal : undefined}
          showAddToCart={showAddToCart}
          cardWidth={cardWidth}
          isAdmin={user?.role === "admin"}
          isSelected={isSelected}
          isSelectionMode={isSelectionMode}
        />
      );
    },
    [onProductPress, onAddToCart, onProductLongPress, showAddToCart, cardWidth, user?.role, selectedProducts, isSelectionMode]
  );

  const keyExtractor = useCallback((item: Product, index: number) => item.id ?? `${item.title ?? 'product'}-${index}`, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search products..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
        iconColor="#A08B73"
        inputStyle={styles.searchInput}
      />
      
      {screenTitle && (
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>{screenTitle}</Text>
          {isSelectionMode && (
            <Text style={styles.selectionInfo}>
              {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
            </Text>
          )}
        </View>
      )}

      <FlatList
        data={filteredProducts}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={12}
        windowSize={9}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {products.length === 0 ? "No products available" : "No products found"}
            </Text>
            <Text style={styles.emptySubtext}>
              {products.length === 0
                ? "Products will appear here once they are added to the system."
                : "Try adjusting your search terms."}
            </Text>
            {products.length === 0 && (
              <Button mode="outlined" onPress={loadProducts} style={styles.retryButton} contentStyle={styles.retryButtonContent}>
                Refresh
              </Button>
            )}
          </View>
        }
      />

      {/* Size Selection Modal */}
      <SizeSelectionModal
        visible={sizeModalVisible}
        onDismiss={() => setSizeModalVisible(false)}
        product={selectedProduct}
        onAddToCart={handleAddToCartWithSize}
      />

      {/* Success Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        Product added to cart successfully!
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme?.colors?.background ?? "#F5EDE0",
  },
  searchbar: {
    margin: scaleSize(10),
    marginBottom: scaleSize(6),
    backgroundColor: theme?.colors?.surface ?? "#FAF9F6",
    borderRadius: scaleSize(8),
    elevation: 1,
  },
  searchInput: {
    color: theme?.colors?.text ?? "#3B3B3B",
    fontSize: scaleFont(15),
  },
  listContent: {
    paddingHorizontal: scaleSize(10),
    paddingBottom: scaleSize(15),
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: scaleSize(6),
  },
  cardWrapper: {
    marginVertical: scaleSize(6),
  },
  screenHeader: {
    paddingHorizontal: scaleSize(10),
    paddingVertical: scaleSize(8),
  },
  screenTitle: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: theme?.colors?.text ?? "#3B3B3B",
    textAlign: 'center',
  },
  selectionInfo: {
    fontSize: scaleFont(14),
    color: theme?.colors?.accent ?? "#4ECDC4",
    textAlign: 'center',
    fontWeight: '600',
    marginTop: scaleSize(4),
  },
  productCard: {
    backgroundColor: theme?.colors?.surface ?? "#FAF9F6",
    borderRadius: scaleSize(8),
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    // Remove overflow: 'hidden' from here
  },
  cardInnerContainer: {
    overflow: 'hidden', // Move overflow hidden here
    borderRadius: scaleSize(8), // Match the card border radius
  },
  touchableArea: {
    flex: 1,
  },
  selectionModeCard: {
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedProductCard: {
    borderColor: "#4ECDC4",
    borderWidth: 2,
    backgroundColor: "#F0F9F8",
  },
  selectionIndicator: {
    position: 'absolute',
    top: scaleSize(8),
    right: scaleSize(8),
    width: scaleSize(24),
    height: scaleSize(24),
    borderRadius: scaleSize(12),
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  selectedIndicator: {
    backgroundColor: "#4ECDC4",
  },
  unselectedIndicator: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  selectionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: scaleFont(14),
  },
  // Wrap image with overflow hidden to preserve card shadow
  imageContainer: {
    overflow: "hidden",
    borderTopLeftRadius: scaleSize(8),
    borderTopRightRadius: scaleSize(8),
    backgroundColor: "#E6C76E",
  },
  productImage: {
    // height set dynamically inline
    width: "100%",
    backgroundColor: "#E6C76E",
  },
  placeholderImage: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F7CAC9",
  },
  placeholderText: {
    color: "#3B3B3B",
    fontSize: scaleFont(12),
    fontWeight: "500",
  },
  cardContent: {
    padding: scaleSize(8),
    paddingTop: scaleSize(10),
    justifyContent: "flex-start",
  },
  // Add to Cart Button Container
  addToCartContainer: {
    padding: scaleSize(8),
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  // Reduced font sizes for product title and price
  productTitle: {
    fontWeight: "600",
    color: theme?.colors?.text ?? "#3B3B3B",
    fontSize: scaleFont(14), // Reduced from 20
    lineHeight: scaleFont(18), // Reduced from 28
    marginBottom: scaleSize(4),
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: scaleSize(6),
  },
  sellingPrice: {
    fontWeight: "700",
    color: theme?.colors?.text ?? "#3B3B3B",
    fontSize: scaleFont(16), // Reduced from larger size
  },
  chipsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: scaleSize(8),
  },
  stockChip: {
    height: scaleSize(28),
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: scaleSize(6),
  },
  inStockChip: {
    backgroundColor: "#E8F5E8",
    borderColor: "#4CAF50",
  },
  outOfStockChip: {
    backgroundColor: "#FFEBEE",
    borderColor: "#FF5252",
  },
  categoryChip: {
    height: scaleSize(28),
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    borderColor: "#2196F3",
  },
  chipText: {
    fontSize: scaleFont(10), // Reduced
    fontWeight: "500",
  },
  addToCartButton: {
    backgroundColor: "#E6C76E",
    borderRadius: scaleSize(6),
    alignSelf: "stretch",
  },
  disabledButton: {
    backgroundColor: "#CCCCCC",
  },
  buttonContent: {
    paddingVertical: scaleSize(8),
  },
  buttonLabel: {
    fontSize: scaleFont(12),
    fontWeight: "600",
    color: theme?.colors?.text ?? "#3B3B3B",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme?.colors?.background ?? "#F5EDE0",
    padding: scaleSize(20),
  },
  loadingText: {
    marginTop: scaleSize(16),
    color: theme?.colors?.text ?? "#3B3B3B",
    fontSize: scaleFont(14),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: scaleSize(25),
    minHeight: scaleSize(180),
  },
  emptyText: {
    textAlign: "center",
    color: theme?.colors?.text ?? "#3B3B3B",
    marginBottom: scaleSize(6),
    fontSize: scaleFont(16),
    fontWeight: "600",
  },
  emptySubtext: {
    textAlign: "center",
    color: theme?.colors?.placeholder ?? "#A08B73",
    marginBottom: scaleSize(8),
    fontSize: scaleFont(13),
  },
  retryButton: {
    borderColor: "#F7CAC9",
    borderWidth: 1,
  },
  retryButtonContent: {
    paddingVertical: scaleSize(8),
    paddingHorizontal: scaleSize(12),
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: scaleSize(20),
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: scaleSize(12),
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: scaleSize(16),
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: {
    fontSize: scaleFont(18),
    fontWeight: "bold",
  },
  closeButton: {
    padding: scaleSize(4),
  },
  closeButtonText: {
    fontSize: scaleFont(24),
    color: "#000",
  },
  modalScroll: {
    padding: scaleSize(16),
  },
  productInfo: {
    marginBottom: scaleSize(16),
  },
  modalProductTitle: {
    fontSize: scaleFont(16),
    fontWeight: "600",
    color: "#333",
    marginBottom: scaleSize(4),
  },
  modalProductPrice: {
    fontSize: scaleFont(18),
    fontWeight: "700",
    color: "#4ECDC4",
  },
  sectionTitle: {
    color: "#333",
    marginBottom: scaleSize(12),
    fontWeight: "600",
    fontSize: scaleFont(14),
  },
  colorGroup: {
    marginBottom: scaleSize(12),
  },
  colorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: scaleSize(8),
    paddingHorizontal: scaleSize(4),
  },
  colorName: {
    fontSize: scaleFont(12),
    fontWeight: "600",
    color: "#333",
  },
  colorStock: {
    fontSize: scaleFont(12),
    color: "#666",
  },
  colorDivider: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginTop: scaleSize(16),
    marginBottom: scaleSize(12),
  },
  sizesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scaleSize(8),
  },
  sizeTouchable: {
    // Remove margin since we're using gap
  },
  sizeChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scaleSize(12),
    paddingVertical: scaleSize(8),
    borderRadius: scaleSize(6),
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
    minWidth: scaleSize(50),
    gap: scaleSize(3),
  },
  selectedSizeChip: {
    backgroundColor: "#4ECDC4",
    borderColor: "#4ECDC4",
  },
  outOfStockSizeChip: {
    backgroundColor: "#F5F5F5",
    borderColor: "#E0E0E0",
    opacity: 0.5,
  },
  sizeText: {
    fontSize: scaleFont(12),
    fontWeight: "600",
    color: "#333",
  },
  selectedSizeText: {
    color: "#FFFFFF",
  },
  outOfStockSizeText: {
    color: "#9E9E9E",
  },
  stockText: {
    fontSize: scaleFont(9),
    color: "#666666",
    fontWeight: "500",
  },
  selectedStockText: {
    opacity: 0.9,
    fontSize: scaleFont(10),
    color: "#1976D2",
  },
  // Selected Variant Info
  selectedVariantInfo: {
    backgroundColor: "#E8F4FD",
    padding: scaleSize(12),
    borderRadius: scaleSize(6),
    marginBottom: scaleSize(16),
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
  },
  selectedVariantText: {
    fontSize: scaleFont(14),
    fontWeight: "600",
    color: "#333",
    marginBottom: scaleSize(4),
  },
  selectedStockInfo: {
    fontSize: scaleFont(12),
    color: "#666",
  },
  noVariantsText: {
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
    padding: scaleSize(16),
    fontSize: scaleFont(12),
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: scaleSize(16),
  },
  quantityButton: {
    borderColor: "#4ECDC4",
  },
  quantityButtonContent: {
    width: scaleSize(36),
    height: scaleSize(36),
  },
  quantityText: {
    fontSize: scaleFont(16),
    fontWeight: "700",
    marginHorizontal: scaleSize(12),
    minWidth: scaleSize(35),
    textAlign: "center",
  },
  priceSummary: {
    backgroundColor: "#FFF9C4",
    padding: scaleSize(12),
    borderRadius: scaleSize(6),
    marginTop: scaleSize(8),
  },
  summaryText: {
    color: "#333",
    fontSize: scaleFont(14),
  },
  finalPriceText: {
    color: "#333",
    fontSize: scaleFont(16),
    fontWeight: "700",
    marginTop: scaleSize(4),
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: scaleSize(16),
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    gap: scaleSize(12),
  },
  viewCartButton: {
    flex: 1,
    borderColor: "#4ECDC4",
  },
  addButton: {
    flex: 1,
    backgroundColor: "#4ECDC4",
  },
  modalSnackbar: {
    backgroundColor: "#4CAF50",
    position: 'absolute',
    bottom: scaleSize(20),
    left: scaleSize(20),
    right: scaleSize(20),
  },
  snackbar: {
    backgroundColor: "#4CAF50",
  },
});

export default ProductCatalog;