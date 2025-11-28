// src/screens/salesman/ProductDetailScreen.tsx
import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  useWindowDimensions,
  Platform,
} from "react-native";
import {
  Text,
  Card,
  Chip,
  Button,
  Divider,
  Snackbar,
} from "react-native-paper";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Product, ProductVariant } from "../../firebase/firestore";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import {
  scaleSize,
  scaleFont,
  getScreenSize,
  getResponsivePadding,
  getResponsiveMargin,
  responsiveValue,
  theme,
  getMaxContainerWidth,
  isLargeScreen,
  isExtraLargeScreen,
} from "../../utils/constants";
import ImageGalleryModal from "../../components/ImageGalleryModal";

type SerializableProduct = Omit<Product, "createdAt" | "updatedAt"> & {
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

type ParamList = {
  ProductDetail: { product: SerializableProduct };
  OrderCart: undefined;
};
type RootStackParamList = {
  SalesmanTabs: undefined;
  ProductDetail: { product: SerializableProduct };
};

type ProductDetailRouteProp = RouteProp<ParamList, "ProductDetail">;
type NavigationProp = StackNavigationProp<ParamList,'ProductDetail'>;

interface ColorGroup {
  color: string;
  sizes: Array<{ size: string; stock: number; variant: ProductVariant }>;
}

// Size ordering function (same as ProductCatalog)
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

const sortSizes = (sizes: Array<{ size: string; stock: number; variant: ProductVariant }>) => {
  return sizes.sort((a, b) => {
    const orderA = getSizeOrder(a.size);
    const orderB = getSizeOrder(b.size);
    return orderA - orderB;
  });
};

const ProductDetailScreen: React.FC = () => {
  const route = useRoute<ProductDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const productParam = route.params?.product;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
const { user } = useAuth();
  const product = useMemo(() => {
    if (!productParam) return null;
    return {
      ...productParam,
      createdAt: productParam.createdAt
        ? new Date(productParam.createdAt)
        : undefined,
      updatedAt: productParam.updatedAt
        ? new Date(productParam.updatedAt)
        : undefined,
    } as Product;
  }, [productParam]);

  const maxContainerWidth = getMaxContainerWidth();
  const centerContent = isLargeScreen || isExtraLargeScreen;

  if (!product) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text>Product not found.</Text>
      </View>
    );
  }

  const { addToCart, getTotalItems } = useCart();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // safe sizes/images
  const sizes = product.sizes ?? [];
  const images = product.images ?? [
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400",
  ];

  // Check if product has full stock
  const isFullStockProduct = product.fullstock || false;

  // Group variants by color with proper size ordering
  const colorGroups = useMemo((): ColorGroup[] => {
    const groups: { [key: string]: ColorGroup } = {};
    
    sizes.forEach(variant => {
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
  }, [sizes]);

  // metrics - updated for full stock
  const totalStock = useMemo(
    () => sizes.reduce((total, v) => total + (v?.stock ?? 0), 0),
    [sizes]
  );
  const availableVariants = useMemo(
    () => isFullStockProduct ? sizes : sizes.filter((v) => (v?.stock ?? 0) > 0),
    [sizes, isFullStockProduct]
  );

  // Calculate max quantity for selected variant (unlimited if full stock)
  const getMaxQuantity = () => {
    if (isFullStockProduct) {
      return 9999; // Very high number to simulate unlimited
    }
    return selectedVariant?.stock || 0;
  };

  const handleQuantityIncrease = () => {
    const maxQuantity = getMaxQuantity();
    setQuantity(Math.min(maxQuantity, quantity + 1));
  };

  const handleQuantityDecrease = () => {
    setQuantity(Math.max(1, quantity - 1));
  };

  const handleAddToCart = () => {
    if (!selectedVariant) {
      setSnackbarMessage("Please select a size and color");
      setSnackbarVisible(true);
      return;
    }

    // For full stock products, no stock validation needed
    if (!isFullStockProduct) {
      const stock = selectedVariant.stock ?? 0;
      if (stock === 0) {
        setSnackbarMessage("Selected variant is out of stock");
        setSnackbarVisible(true);
        return;
      }
      if (quantity > stock) {
        setSnackbarMessage(`Only ${stock} units available`);
        setSnackbarVisible(true);
        return;
      }
    }

    const cartItem: any = { 
      product, 
      sizeVariant: selectedVariant, 
      quantity,
      isFullStock: isFullStockProduct 
    };
    addToCart(cartItem);
    setSnackbarMessage("Product added to order cart!");
    setSnackbarVisible(true);
  };

  const handleViewCart = () => {
    navigation.navigate('SalesmanTabs' as any, { screen: 'OrderCart' });
  };

  const openImageGallery = (index = 0) => {
    setGalleryIndex(index);
    setGalleryVisible(true);
  };

  const cartItemCount = getTotalItems?.() ?? 0;

  // layout decisions - improved for web
  const isWide = centerContent || windowWidth >= 900;
  const isWeb = Platform.OS === 'web';

  // content container style (typed)
  const centeredContentStyle: StyleProp<ViewStyle> = {
    maxWidth: maxContainerWidth,
    alignSelf: "center",
    width: "100%",
    minHeight: isWeb ? 'auto' : undefined,
  };

  const cardMargin = getResponsiveMargin();
  const cardPadding = getResponsivePadding();

  // responsive variants
  const titleVariant = responsiveValue({
    xsmall: "headlineSmall",
    small: "headlineSmall",
    medium: "headlineMedium",
    large: "headlineMedium",
    xlarge: "headlineLarge",
    default: "headlineSmall",
  });

  const priceVariant = responsiveValue({
    xsmall: "titleLarge",
    small: "titleLarge",
    medium: "headlineSmall",
    large: "headlineSmall",
    xlarge: "headlineMedium",
    default: "titleLarge",
  });

  const sectionVariant = responsiveValue({
    xsmall: "bodyLarge",
    small: "bodyLarge",
    medium: "titleLarge",
    large: "titleLarge",
    xlarge: "titleLarge",
    default: "bodyLarge",
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent, 
          centeredContentStyle,
          isWeb && styles.webScrollContent
        ]}
        showsVerticalScrollIndicator={true}
        {...(isWeb && {
          contentContainerStyle: { 
            ...styles.scrollContent, 
            ...centeredContentStyle,
            ...styles.webScrollContent 
          }
        })}
      >
        {/* Top area: image + info (row on wide, column on narrow) */}
        <View style={[
          styles.topRow, 
          isWide ? styles.row : styles.column,
          isWeb && styles.webTopRow
        ]}>
          {/* Image column */}
          <Card style={[
            styles.imageCard, 
            { 
              margin: cardMargin, 
              flex: isWide ? 0.45 : undefined,
              ...(isWeb && styles.webImageCard)
            }
          ]}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => openImageGallery(0)}>
              <View style={[
                styles.imageWrapper,
                isWeb && styles.webImageWrapper
              ]}>
                <Image
                  source={{ uri: images[0] }}
                  style={[
                    styles.image,
                    isWeb && styles.webImage
                  ]}
                  resizeMode="cover"
                  onError={(e) => console.log("Image load error", e)}
                />
                {images.length > 1 && (
                  <View style={styles.imageCountBadge}>
                    <Text style={styles.imageCountText}>+{images.length - 1}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </Card>

          {/* Info column */}
          <Card style={[
            styles.infoCard, 
            { 
              margin: cardMargin, 
              marginTop: isWide ? cardMargin : 0, 
              flex: isWide ? 0.55 : undefined,
              ...(isWeb && styles.webInfoCard)
            }
          ]}>
            <Card.Content style={{ 
              padding: cardPadding,
              ...(isWeb && { minHeight: 0 })
            }}>
              <Text variant={titleVariant as any} style={styles.productTitle}>
                {product.title}
              </Text>

              <View style={styles.priceContainer}>
                <Text variant={priceVariant as any} style={styles.sellingPrice}>
                  ₹{product.sellingPrice?.toFixed(2)}
                </Text>
                {isFullStockProduct && (
                  <Chip mode="outlined" style={styles.fullstockChip} textStyle={styles.fullstockChipText}>
                    Full Stock
                  </Chip>
                )}
              </View>

              <View style={styles.stockRow}>
                <Chip
                  mode="outlined"
                  style={[
                    styles.stockChip, 
                    (totalStock > 0 || isFullStockProduct) ? styles.inStockChip : styles.outOfStockChip
                  ]}
                  textStyle={styles.chipText}
                >
                  {isFullStockProduct ? "Full Stock" : (totalStock > 0 ? `${totalStock} in stock` : "Out of stock")}
                </Chip>

                {product.category && (
                  <Chip mode="outlined" style={styles.categoryChip} textStyle={styles.chipText}>
                    {product.category}
                  </Chip>
                )}
              </View>

              <Divider style={styles.divider} />

              <Text variant={sectionVariant as any} style={styles.sectionTitle}>
                Available Sizes & Colors
              </Text>
              
              {colorGroups.length > 0 ? (
                colorGroups.map((colorGroup, groupIndex) => (
                  <View key={colorGroup.color} style={styles.colorGroup}>
                    <View style={styles.colorHeader}>
                      <Text style={styles.colorName}>{colorGroup.color}</Text>
                      {!isFullStockProduct && (
                        <Text style={styles.colorStock}>
                          {colorGroup.sizes.reduce((sum, item) => sum + item.stock, 0)} available
                        </Text>
                      )}
                    </View>
                    
                    <View style={styles.sizesContainer}>
                      {colorGroup.sizes.map((sizeItem, sizeIndex) => {
                        const isSelected = selectedVariant?.size === sizeItem.variant.size && 
                                         selectedVariant?.color === sizeItem.variant.color;
                        const isOutOfStock = sizeItem.stock === 0 && !isFullStockProduct;
                        
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
                              {!isFullStockProduct && !isOutOfStock && (
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
                      <Divider style={styles.colorDivider} />
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
                      {isFullStockProduct ? "All available" : `Available: ${selectedVariant.stock} units`}
                    </Text>
                  </View>

                  <Text variant={sectionVariant as any} style={styles.sectionTitle}>
                    Quantity
                  </Text>
                  <View style={styles.quantityContainer}>
                    <Button
                      mode="outlined"
                      onPress={handleQuantityDecrease}
                      disabled={quantity <= 1}
                      style={styles.quantityButton}
                      contentStyle={styles.quantityButtonContent}
                      textColor="#000000"
                      icon="minus" children={undefined}                    >
                      {/* Empty text to use icon only */}
                    </Button>
                    <Text style={styles.quantityText}>{quantity}</Text>
                    <Button
                      mode="outlined"
                      onPress={handleQuantityIncrease}
                      disabled={!isFullStockProduct && quantity >= (selectedVariant.stock ?? 0)}
                      style={styles.quantityButton}
                      contentStyle={styles.quantityButtonContent}
                      textColor="#000000"
                      icon="plus" children={undefined}                    >
                      {/* Empty text to use icon only */}
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
            </Card.Content>
          </Card>
        </View>
      </ScrollView>

      {/* Fixed Action Buttons */}
{user&&user.role === 'salesman' && (
      <View style={[styles.footer, { padding: cardPadding }]}>
        <Button
          mode="contained"
          onPress={handleAddToCart}
          disabled={availableVariants.length === 0 || !selectedVariant}
          style={styles.addToCartButton}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          Add to Order Cart
        </Button>

        {cartItemCount > 0 && (
          <Button
            mode="outlined"
            onPress={handleViewCart}
            style={styles.viewCartButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            View Cart ({cartItemCount})
          </Button>
        )}
      </View>)}

      {/* Success Message */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: "View Cart",
          onPress: handleViewCart,
        }}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>

      <ImageGalleryModal
        visible={galleryVisible}
        onDismiss={() => setGalleryVisible(false)}
        images={images}
        initialIndex={galleryIndex}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: scaleSize(12),
  },
  webScrollContent: {
    minHeight: 'auto',
    overflow: 'visible',
  },
  webTopRow: {
    minHeight: 0,
  },
  webImageCard: {
    minHeight: 0,
    overflow: 'hidden',
  },
  webImageWrapper: {
    minHeight: 0,
  },
  webImage: {
    alignSelf: 'stretch',
  },
  webInfoCard: {
    minHeight: 0,
    overflow: 'visible',
  },

  topRow: {
    width: "100%",
    alignItems: "stretch",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  column: {
    flexDirection: "column",
  },

  imageCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 1,
    overflow: "hidden",
    borderTopLeftRadius: theme.roundness,
    borderTopRightRadius: theme.roundness,
    backgroundColor: theme.colors.primary,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageCountBadge: {
    position: "absolute",
    bottom: scaleSize(10),
    right: scaleSize(10),
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: scaleSize(8),
    paddingVertical: scaleSize(4),
    borderRadius: scaleSize(12),
  },
  imageCountText: {
    color: "#FFFFFF",
    fontSize: scaleFont(12),
    fontWeight: "600",
  },

  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
  },
  productTitle: {
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    fontWeight: "700",
    textAlign: "left",
    fontSize: scaleFont(18),
  },
  priceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  sellingPrice: {
    color: theme.colors.accent,
    fontWeight: "700",
    fontSize: scaleFont(18),
  },
  costPrice: {
    color: theme.colors.placeholder,
    fontSize: scaleFont(14),
    textDecorationLine: "line-through",
  },
  fullstockChip: {
    backgroundColor: "#E3F2FD",
    borderColor: "#2196F3",
  },
  fullstockChipText: {
    fontSize: scaleFont(11),
    fontWeight: "600",
    color: "#1976D2",
  },

  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  stockChip: {
    backgroundColor: "#E8F5E8",
    borderColor: "#4CAF50",
    marginRight: scaleSize(8),
  },
  inStockChip: { backgroundColor: "#E8F5E8", borderColor: "#4CAF50" },
  outOfStockChip: { backgroundColor: "#FFEBEE", borderColor: "#FF5252" },
  categoryChip: { backgroundColor: "#E3F2FD", borderColor: "#2196F3" },
  chipText: {
    fontSize: scaleFont(12),
    fontWeight: "500",
  },

  divider: {
    marginVertical: theme.spacing.md, // Reduced from lg
  },

  sectionTitle: {
    color: theme.colors.text,
    marginBottom: theme.spacing.sm, // Reduced from md
    fontWeight: "600",
    fontSize: scaleFont(12),
  },

  // Color Groups - Reduced sizes
  colorGroup: {
    marginBottom: theme.spacing.xs, // Reduced from sm
  },
  colorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.xs, // Reduced from sm
    paddingHorizontal: scaleSize(2), // Reduced from 4
  },
  colorName: {
    fontSize: scaleFont(11), // Reduced from 12
    fontWeight: "600",
    color: theme.colors.text,
  },
  colorStock: {
    fontSize: scaleFont(11), // Reduced from 12
    color: theme.colors.placeholder,
  },
  colorDivider: {
    marginTop: theme.spacing.md, // Reduced from lg
    marginBottom: theme.spacing.sm, // Reduced from md
  },

  // Sizes Container - Reduced sizes
  sizesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scaleSize(6), // Reduced from 8
  },
  sizeTouchable: {
    // Remove margin since we're using gap
  },
  sizeChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scaleSize(12), // Reduced from 16
    paddingVertical: scaleSize(8), // Reduced from 10
    borderRadius: theme.roundness,
    borderWidth: 1.5, // Reduced from 2
    borderColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
    minWidth: scaleSize(50), // Reduced from 60
    gap: scaleSize(3), // Reduced from 4
  },
  selectedSizeChip: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  outOfStockSizeChip: {
    backgroundColor: "#F5F5F5",
    borderColor: "#E0E0E0",
    opacity: 0.5,
  },
  sizeText: {
    fontSize: scaleFont(12), // Reduced from 14
    fontWeight: "600",
    color: theme.colors.text,
  },
  selectedSizeText: {
    color: "#FFFFFF",
  },
  outOfStockSizeText: {
    color: "#9E9E9E",
  },
  stockText: {
    fontSize: scaleFont(9), // Reduced from 10
    color: "#666666",
    fontWeight: "500",
  },
  selectedStockText: {
    opacity: 0.9,
    fontSize: scaleFont(10), // Reduced from 12
    color: "#1976D2",
  },

  // Selected Variant Info
  selectedVariantInfo: {
    backgroundColor: "#E8F4FD",
    padding: theme.spacing.sm,
    borderRadius: theme.roundness,
    marginBottom: theme.spacing.sm,
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
    color: theme.colors.placeholder,
    fontStyle: "italic",
    textAlign: "center",
    padding: theme.spacing.md, // Reduced from lg
    fontSize: scaleFont(12), // Added smaller font
  },

  // QUANTITY - Reduced sizes
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: theme.spacing.sm, // Reduced from md
  },
  quantityButton: {
    borderColor: "#000000",
    backgroundColor: "transparent",
  },
  quantityButtonContent: {
    width: scaleSize(36), // Reduced from 44
    height: scaleSize(36), // Reduced from 44
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    margin: 0,
  },
  quantityText: {
    fontSize: scaleFont(14), // Reduced from 16
    fontWeight: "700",
    marginHorizontal: scaleSize(10), // Reduced from 12
    minWidth: scaleSize(35), // Reduced from 40
    textAlign: "center",
    color: "#000000",
  },
  unlimitedNote: {
    fontSize: scaleFont(11),
    color: "#2196F3",
    fontStyle: "italic",
    marginBottom: theme.spacing.sm,
    textAlign: "center",
  },

  // PRICE SUMMARY - Reduced sizes
  priceSummary: {
    backgroundColor: "#FFF9C4",
    padding: theme.spacing.sm, // Reduced from md
    borderRadius: theme.roundness,
    marginTop: theme.spacing.xs, // Reduced from sm
  },
  summaryText: {
    color: theme.colors.text,
    fontSize: scaleFont(13), // Reduced from 14
  },
  finalPriceText: {
    color: theme.colors.text,
    fontSize: scaleFont(14), // Reduced from 16
    fontWeight: "700",
    marginTop: scaleSize(4), // Reduced from 6
  },

  // FOOTER actions
  footer: {
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    paddingVertical: scaleSize(10), // Reduced from 12
    paddingHorizontal: scaleSize(12),
  },
  addToCartButton: {
    backgroundColor: theme.colors.accent,
    marginBottom: scaleSize(6), // Reduced from 8
  },
  viewCartButton: {
    borderColor: theme.colors.accent,
  },
  buttonContent: {
    paddingVertical: scaleSize(10), // Reduced from 12
  },
  buttonLabel: {
    fontSize: scaleFont(14), // Reduced from 16
    fontWeight: "600",
    color: theme.colors.text,
  },

  snackbar: {
    backgroundColor: theme.colors.success,
  },
});

export default ProductDetailScreen;