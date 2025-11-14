import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  useWindowDimensions,
  TouchableOpacity,
  ListRenderItemInfo,
} from "react-native";
import { Text, Card, Chip, Searchbar, Button, ActivityIndicator } from "react-native-paper";
import { Product, getProducts } from "../firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { scaleSize, isTablet, isSmallDevice } from "../utils/constants";

interface ProductCatalogProps {
  onProductPress?: (product: Product) => void;
  showAddToCart?: boolean;
  onAddToCart?: (product: Product) => void;
}

const MIN_CARD_TABLET = 240;
const MIN_CARD_SMALL = 140;
const MIN_CARD_DEFAULT = 180;

const ProductCard = React.memo(
  ({
    item,
    onPress,
    onAddToCart,
    showAddToCart,
    cardWidth,
    isAdmin,
  }: {
    item: Product;
    onPress?: (p: Product) => void;
    onAddToCart?: (p: Product) => void;
    showAddToCart?: boolean;
    cardWidth: number;
    isAdmin?: boolean;
  }) => {
    const totalStock = (item.sizes || []).reduce((t: number, v: any) => t + (v?.stock || 0), 0);
    const isOutOfStock = totalStock === 0;

    return (
      <View style={[styles.cardWrapper, { width: cardWidth }]}>
        {/* DON'T set overflow:hidden on Card (Surface) or shadow will be clipped.
            Wrap image in a view with overflow:hidden instead. */}
        <Card style={styles.productCard} mode="elevated" onPress={() => onPress?.(item)}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => onPress?.(item)}>
            <View style={[styles.imageContainer, { width: cardWidth, borderTopLeftRadius: 10, borderTopRightRadius: 10 }]}>
              {item.images && item.images.length > 0 ? (
                <Image
                  source={{ uri: item.images[0] }}
                  style={[styles.productImage, { width: cardWidth }]}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.productImage, styles.placeholderImage, { width: cardWidth }]}>
                  <Text style={styles.placeholderText}>No Image</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <Card.Content style={styles.cardContent}>
            <Text numberOfLines={2} style={styles.productTitle}>
              {item.title}
            </Text>

            <Text numberOfLines={2} style={styles.productDescription}>
              {item.description}
            </Text>

            <View style={styles.priceRow}>
              <Text style={styles.sellingPrice}>${(item.sellingPrice ?? 0).toFixed(2)}</Text>
              {isAdmin && <Text style={styles.costPrice}>${(item.costPrice ?? 0).toFixed(2)}</Text>}
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

            {showAddToCart && onAddToCart && (
              <Button
                mode="contained"
                onPress={() => onAddToCart(item)}
                disabled={isOutOfStock}
                style={[styles.addToCartButton, isOutOfStock && styles.disabledButton]}
                labelStyle={styles.buttonLabel}
                contentStyle={styles.buttonContent}
                compact
              >
                {isOutOfStock ? "Out of Stock" : "Add to Cart"}
              </Button>
            )}
          </Card.Content>
        </Card>
      </View>
    );
  }
);

ProductCard.displayName = "ProductCard";

const ProductCatalog: React.FC<ProductCatalogProps> = ({ onProductPress, showAddToCart = false, onAddToCart }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();

  // load products
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const productsData = await getProducts(true);
      setProducts(productsData || []);
    } catch (err) {
      console.error("Error loading products:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // responsive columns and card width
  const { numColumns, cardWidth } = useMemo(() => {
    const MIN_CARD = isTablet ? MIN_CARD_TABLET : isSmallDevice ? MIN_CARD_SMALL : MIN_CARD_DEFAULT;
    const maxColumns = isTablet ? 3 : 2;
    const calculated = Math.floor(windowWidth / MIN_CARD) || 1;
    const cols = Math.min(Math.max(calculated, 1), maxColumns);

    const horizontalPadding = scaleSize(10) * 2; // list padding left/right
    const gapTotal = scaleSize(6) * (cols - 1);
    const available = windowWidth - horizontalPadding - gapTotal;
    const cWidth = Math.floor(available / cols);

    return { numColumns: cols, cardWidth: cWidth };
  }, [windowWidth]);

  // derive filtered products with memo for performance
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      return (
        (p.title || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Product>) => (
      <ProductCard
        item={item}
        onPress={onProductPress}
        onAddToCart={onAddToCart}
        showAddToCart={showAddToCart}
        cardWidth={cardWidth}
        isAdmin={user?.role === "admin"}
      />
    ),
    [onProductPress, onAddToCart, showAddToCart, cardWidth, user?.role]
  );

  const keyExtractor = useCallback((item: Product) => item.id ?? item.title ?? Math.random().toString(), []);

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5EDE0",
  },
  searchbar: {
    margin: scaleSize(10),
    marginBottom: scaleSize(6),
    backgroundColor: "#FAF9F6",
    borderRadius: scaleSize(8),
    elevation: 1,
  },
  searchInput: {
    color: "#3B3B3B",
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
  productCard: {
    backgroundColor: "#FAF9F6",
    borderRadius: scaleSize(8),
    // do NOT set overflow: 'hidden' here - it will clip card shadow
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  imageContainer: {
    overflow: "hidden", // clip image corners without affecting Card shadow
    borderTopLeftRadius: scaleSize(8),
    borderTopRightRadius: scaleSize(8),
    backgroundColor: "#E6C76E",
  },
  productImage: {
    height: scaleSize(100),
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
    fontSize: scaleSize(11),
    fontWeight: "500",
  },
  cardContent: {
    padding: scaleSize(10),
    paddingTop: scaleSize(8),
    justifyContent: "flex-start",
  },
  productTitle: {
    fontWeight: "600",
    marginBottom: scaleSize(4),
    color: "#3B3B3B",
    fontSize: scaleSize(12),
    lineHeight: scaleSize(16),
  },
  productDescription: {
    color: "#A08B73",
    marginBottom: scaleSize(6),
    fontSize: scaleSize(6),
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: scaleSize(8),
  },
  sellingPrice: {
    fontWeight: "700",
    color: "#3B3B3B",
    fontSize: scaleSize(8),
  },
  costPrice: {
    color: "#A08B73",
    fontSize: scaleSize(6),
    fontStyle: "italic",
  },
  chipsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: scaleSize(8),
  },
  stockChip: {
    height: scaleSize(20),
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
    height: scaleSize(20),
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    borderColor: "#2196F3",
  },
  chipText: {
    fontSize: scaleSize(6),
    fontWeight: "500",
  },
  addToCartButton: {
    backgroundColor: "#E6C76E",
    borderRadius: scaleSize(6),
    marginTop: scaleSize(8),
    alignSelf: "stretch",
  },
  disabledButton: {
    backgroundColor: "#CCCCCC",
  },
  buttonContent: {
    paddingVertical: scaleSize(6),
    paddingHorizontal: scaleSize(6),
  },
  buttonLabel: {
    fontSize: scaleSize(12),
    fontWeight: "600",
    color: "#3B3B3B",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5EDE0",
    padding: scaleSize(20),
  },
  loadingText: {
    marginTop: scaleSize(16),
    color: "#3B3B3B",
    fontSize: scaleSize(13),
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
    color: "#3B3B3B",
    marginBottom: scaleSize(6),
    fontSize: scaleSize(14),
    fontWeight: "600",
  },
  emptySubtext: {
    textAlign: "center",
    color: "#A08B73",
    marginBottom: scaleSize(8),
    fontSize: scaleSize(11),
  },
  retryButton: {
    borderColor: "#F7CAC9",
    borderWidth: 1,
  },
  retryButtonContent: {
    paddingVertical: scaleSize(8),
    paddingHorizontal: scaleSize(12),
  },
});

export default ProductCatalog;
