import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  TouchableOpacity,
  Modal as RNModal,
  Dimensions,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  IconButton,
  Card,
  Chip,
  Modal,
  Portal,
  DataTable,
  FAB,
  Searchbar,
  SegmentedButtons,
  Switch,
} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import {
  Product,
  ProductVariant,
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  Category,
  addCategory,
  deleteCategory,
} from '../../firebase/firestore';
import { scaleSize, platformStyle, isTablet } from '../../utils/constants';

const { width: screenWidth } = Dimensions.get('window');
const isMobile = screenWidth < 768;

const ProductManagement: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fullstock, setFullstock] = useState(false);
const isEditingRef = React.useRef(false);
  // Category form state
  const [newCategoryName, setNewCategoryName] = useState('');

  // Standard sizes from S to 5XL
  const standardSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  // Auto-fill standard sizes when modal opens for new product
useEffect(() => {
  // Only auto-fill for new products, not when editing
  if (modalVisible && !isEditingRef.current && variants.length === 0) {
    const standardVariants = standardSizes.map((size) => ({
      size,
      color: 'Default',
      stock: fullstock ? 1 : 1,
      production: fullstock ? 1 : 1,
    }));
    setVariants(standardVariants);
  }
  
  // Reset the editing flag when modal closes
  if (!modalVisible) {
    isEditingRef.current = false;
  }
}, [modalVisible, variants.length, fullstock]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const productsData = await getProducts(true);
      setProducts(productsData);
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const categoriesData = await getCategories();
      setCategories(categoriesData);
    } catch (error: any) {
      console.error('Error loading categories:', error);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: undefined,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setImages([...images, result.assets[0].uri]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // Add a single variant
  const addVariant = () => {
    setVariants([...variants, { 
      size: '', 
      color: 'Default', 
      stock: fullstock ? 1 : 1, 
      production: fullstock ? 1 : 1 
    }]);
  };

  const updateVariant = (
    index: number,
    field: keyof ProductVariant,
    value: string | number
  ) => {
    const updatedVariants = [...variants];
    updatedVariants[index] = { ...updatedVariants[index], [field]: value };
    setVariants(updatedVariants);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  // Stock management functions
  const increaseStock = (index: number) => {
    const updatedVariants = [...variants];
    updatedVariants[index].stock += 1;
    setVariants(updatedVariants);
  };

  const decreaseStock = (index: number) => {
    const updatedVariants = [...variants];
    if (updatedVariants[index].stock > 0) {
      updatedVariants[index].stock -= 1;
      setVariants(updatedVariants);
    }
  };

  const handleStockChange = (index: number, value: string) => {
    const numericValue = parseInt(value) || 0;
    if (numericValue >= 0) {
      updateVariant(index, 'stock', numericValue);
    }
  };

  // Production management functions
  const increaseProduction = (index: number) => {
    const updatedVariants = [...variants];
    updatedVariants[index].production += 1;
    setVariants(updatedVariants);
  };

  const decreaseProduction = (index: number) => {
    const updatedVariants = [...variants];
    if (updatedVariants[index].production > 0) {
      updatedVariants[index].production -= 1;
      setVariants(updatedVariants);
    }
  };

  const handleProductionChange = (index: number, value: string) => {
    const numericValue = parseInt(value) || 0;
    if (numericValue >= 0) {
      updateVariant(index, 'production', numericValue);
    }
  };

  // Fullstock toggle handler
 const handleFullstockToggle = () => {
  const newFullstock = !fullstock;
  setFullstock(newFullstock);
  
  if (newFullstock) {
    // When enabling fullstock, set all variants to stock: 1 and production: 1
    const updatedVariants = variants.map(variant => ({
      ...variant,
      stock: 1,
      production: 1
    }));
    setVariants(updatedVariants);
  }
  // When disabling fullstock, we don't need to change anything
  // The user can manually adjust stock and production values
};
  const clearAllVariants = () => {
    Alert.alert('Clear All Variants', 'Are you sure you want to remove all variants?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: () => setVariants([]),
      },
    ]);
  };

  const resetToStandardSizes = () => {
    const standardVariants = standardSizes.map((size) => ({
      size,
      color: 'Default',
      stock: fullstock ? 1 : 1,
      production: fullstock ? 1 : 1,
    }));
    setVariants(standardVariants);
    Alert.alert('Success', 'Reset to standard sizes');
  };

  const handleSubmit = async () => {
    if (!title || !categoryId || !sellingPrice) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);

      const localImages = images.filter(
        (uri) => uri && (uri.startsWith('file://') || uri.startsWith('data:'))
      );

      if (localImages.length > 0) {
        Alert.alert('Uploading', `Uploading ${localImages.length} images...`);
      }

      const productData = {
        title,
        description: '',
        category,
        categoryId,
        costPrice: 0,
        sellingPrice: parseFloat(sellingPrice),
        images,
        sizes: variants,
        active: true,
        fullstock, // Add fullstock field
      };

      let successMessage = 'Product added successfully';

      if (editingProduct) {
        await updateProduct(editingProduct.id!, productData);
        successMessage = 'Product updated successfully';
      } else {
        await addProduct(productData);
      }

      if (localImages.length > 0) {
        successMessage += '. Some images may not have uploaded correctly.';
      }

      Alert.alert('Success', successMessage);
      resetForm();
      setModalVisible(false);
      loadProducts();
    } catch (error: any) {
      console.error('Error submitting product:', error);
      Alert.alert('Error', error?.message ?? 'Failed to submit product');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setCategory('');
    setCategoryId('');
    setSellingPrice('');
    setImages([]);
    setVariants([]);
    setEditingProduct(null);
    setShowCategoryDropdown(false);
    setFullstock(false);
  };

const editProduct = (product: Product) => {
  isEditingRef.current = true;
  setEditingProduct(product);
  setTitle(product.title);
  setCategory(product.category);
  setCategoryId(product.categoryId);
  setSellingPrice((product.sellingPrice ?? 0).toString());
  setImages(product.images ?? []);
  setVariants(product.sizes ?? []);
  setFullstock(product.fullstock ?? false);
  setModalVisible(true);
};

  const handleDelete = async (product: Product) => {
    Alert.alert('Delete Product', `Are you sure you want to delete ${product.title}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(product.id!);
            loadProducts();
            Alert.alert('Success', 'Product deleted successfully');
          } catch (error: any) {
            Alert.alert('Error', error?.message ?? 'Failed to delete product');
          }
        },
      },
    ]);
  };

  const selectCategory = (selectedCategory: Category) => {
    setCategory(selectedCategory.title);
    setCategoryId(selectedCategory.id!);
    setShowCategoryDropdown(false);
  };

  const getCategoryName = (categoryId: string) => {
    const foundCategory = categories.find((cat) => cat.id === categoryId);
    return foundCategory ? foundCategory.title : 'Unknown Category';
  };

  // Filter products based on selected category and search query
  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === 'all' || product.categoryId === selectedCategory;
    const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group products by category for the category view
  const productsByCategory = filteredProducts.reduce((acc, product) => {
    const categoryName = getCategoryName(product.categoryId);
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  // Category management functions
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    try {
      setLoading(true);
      await addCategory({
        title: newCategoryName.trim(),
        createdAt: new Date(),
      });
      setNewCategoryName('');
      setCategoryModalVisible(false);
      await loadCategories();
      Alert.alert('Success', 'Category added successfully');
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Failed to add category');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    const productsInCategory = products.filter((p) => p.categoryId === category.id);

    if (productsInCategory.length > 0) {
      Alert.alert(
        'Cannot Delete Category',
        `There are ${productsInCategory.length} products in this category. Please reassign or delete those products first.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert('Delete Category', `Are you sure you want to delete "${category.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(category.id!);
            await loadCategories();
            Alert.alert('Success', 'Category deleted successfully');
          } catch (error: any) {
            Alert.alert('Error', error?.message ?? 'Failed to delete category');
          }
        },
      },
    ]);
  };

  const [viewMode, setViewMode] = useState<'list' | 'category'>('list');

  // Responsive table component for mobile
  const MobileProductRow = ({ product }: { product: Product }) => (
    <Card style={styles.mobileCard}>
      <Card.Content>
        <View style={styles.mobileRow}>
          <View style={styles.mobileProductInfo}>
            <Text variant="bodyLarge" style={styles.mobileProductTitle}>
              {product.title}
            </Text>
            <Text variant="bodyMedium" style={styles.mobileCategory}>
              {getCategoryName(product.categoryId)}
            </Text>
            <Text variant="bodyMedium" style={styles.mobilePrice}>
              ₹{product.sellingPrice}
            </Text>
          </View>
          <View style={styles.mobileStatusActions}>
            <Chip 
              mode="outlined" 
              style={product.active ? styles.activeChip : styles.inactiveChip}
              compact
            >
              {product.fullstock ? 'Full Stock' : 'Limited'}
            </Chip>
            <View style={styles.mobileActionButtons}>
              <Button 
                mode="text" 
                compact 
                onPress={() => editProduct(product)}
                textColor="#1976D2"
                style={styles.mobileActionButton}
              >
                Edit
              </Button>
              <Button 
                mode="text" 
                compact 
                onPress={() => handleDelete(product)} 
                textColor="#D32F2F"
                style={styles.mobileActionButton}
              >
                Delete
              </Button>
            </View>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  // Mobile Variant Row Component
  const MobileVariantRow = ({ variant, index }: { variant: ProductVariant; index: number }) => (
    <Card style={styles.variantCard}>
      <Card.Content>
        <View style={styles.mobileVariantHeader}>
          <TextInput
            label="Size"
            value={variant.size}
            onChangeText={(value) => updateVariant(index, 'size', value)}
            style={styles.mobileSizeInput}
            mode="outlined"
            placeholder="S, M, L..."
          />
          <IconButton 
            icon="delete" 
            onPress={() => removeVariant(index)} 
            iconColor="red" 
            size={20}
          />
        </View>
        
        {!fullstock && (
          <View style={styles.mobileControlsRow}>
            {/* Stock Controls */}
            <View style={styles.mobileControlGroup}>
              <Text variant="bodySmall" style={styles.mobileControlLabel}>
                Stock
              </Text>
              <View style={styles.mobileNumberControls}>
                <IconButton 
                  icon="minus" 
                  size={18}
                  onPress={() => decreaseStock(index)}
                  disabled={variant.stock <= 0}
                  iconColor={variant.stock <= 0 ? '#ccc' : '#D32F2F'}
                  style={styles.mobileIconButton}
                />
                <TextInput
                  value={variant.stock.toString()}
                  onChangeText={(value) => handleStockChange(index, value)}
                  style={styles.mobileNumberInput}
                  mode="outlined"
                  keyboardType="numeric"
                  dense
                />
                <IconButton 
                  icon="plus" 
                  size={18}
                  onPress={() => increaseStock(index)}
                  iconColor="#4CAF50"
                  style={styles.mobileIconButton}
                />
              </View>
            </View>

            {/* Production Controls */}
            <View style={styles.mobileControlGroup}>
              <Text variant="bodySmall" style={styles.mobileControlLabel}>
                Production
              </Text>
              <View style={styles.mobileNumberControls}>
                <IconButton 
                  icon="minus" 
                  size={18}
                  onPress={() => decreaseProduction(index)}
                  disabled={variant.production <= 0}
                  iconColor={variant.production <= 0 ? '#ccc' : '#D32F2F'}
                  style={styles.mobileIconButton}
                />
                <TextInput
                  value={variant.production.toString()}
                  onChangeText={(value) => handleProductionChange(index, value)}
                  style={styles.mobileNumberInput}
                  mode="outlined"
                  keyboardType="numeric"
                  dense
                />
                <IconButton 
                  icon="plus" 
                  size={18}
                  onPress={() => increaseProduction(index)}
                  iconColor="#4CAF50"
                  style={styles.mobileIconButton}
                />
              </View>
            </View>
          </View>
        )}
      </Card.Content>
    </Card>
  );

  // Desktop Variant Row Component
  const DesktopVariantRow = ({ variant, index }: { variant: ProductVariant; index: number }) => (
    <Card style={styles.variantCard}>
      <Card.Content>
        <View style={styles.desktopVariantRow}>
          {/* Size Input */}
          <TextInput
            label="Size"
            value={variant.size}
            onChangeText={(value) => updateVariant(index, 'size', value)}
            style={styles.desktopSizeInput}
            mode="outlined"
            placeholder="S, M, L..."
          />
          
          {!fullstock && (
            <>
              {/* Stock Controls */}
              <View style={styles.desktopControlGroup}>
                <Text variant="bodySmall" style={styles.desktopControlLabel}>
                  Stock
                </Text>
                <View style={styles.desktopNumberControls}>
                  <IconButton 
                    icon="minus" 
                    size={18}
                    onPress={() => decreaseStock(index)}
                    disabled={variant.stock <= 0}
                    iconColor={variant.stock <= 0 ? '#ccc' : '#D32F2F'}
                  />
                  <TextInput
                    value={variant.stock.toString()}
                    onChangeText={(value) => handleStockChange(index, value)}
                    style={styles.desktopNumberInput}
                    mode="outlined"
                    keyboardType="numeric"
                    dense
                  />
                  <IconButton 
                    icon="plus" 
                    size={18}
                    onPress={() => increaseStock(index)}
                    iconColor="#4CAF50"
                  />
                </View>
              </View>

              {/* Production Controls */}
              <View style={styles.desktopControlGroup}>
                <Text variant="bodySmall" style={styles.desktopControlLabel}>
                  Production
                </Text>
                <View style={styles.desktopNumberControls}>
                  <IconButton 
                    icon="minus" 
                    size={18}
                    onPress={() => decreaseProduction(index)}
                    disabled={variant.production <= 0}
                    iconColor={variant.production <= 0 ? '#ccc' : '#D32F2F'}
                  />
                  <TextInput
                    value={variant.production.toString()}
                    onChangeText={(value) => handleProductionChange(index, value)}
                    style={styles.desktopNumberInput}
                    mode="outlined"
                    keyboardType="numeric"
                    dense
                  />
                  <IconButton 
                    icon="plus" 
                    size={18}
                    onPress={() => increaseProduction(index)}
                    iconColor="#4CAF50"
                  />
                </View>
              </View>
            </>
          )}

          <IconButton 
            icon="delete" 
            onPress={() => removeVariant(index)} 
            iconColor="red" 
            size={20}
          />
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Product Management
        </Text>

        {/* Search and Filters */}
        <View style={styles.filterSection}>
          <Searchbar
            placeholder="Search products..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchbar}
          />

          <SegmentedButtons
            value={viewMode}
            onValueChange={setViewMode}
            buttons={[
              { value: 'list', label: 'List View' },
              { value: 'category', label: 'Category View' },
            ]}
            style={styles.viewModeToggle}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            <View style={styles.categoryFilter}>
              <Chip
                selected={selectedCategory === 'all'}
                onPress={() => setSelectedCategory('all')}
                style={styles.categoryChip}
              >
                <Text>All Products</Text>
              </Chip>
              {categories.map((cat) => (
                <Chip
                  key={cat.id}
                  selected={selectedCategory === cat.id}
                  onPress={() => setSelectedCategory(cat.id!)}
                  style={styles.categoryChip}
                >
                  <Text>{cat.title}</Text>
                </Chip>
              ))}
            </View>
          </ScrollView>
        </View>

        {viewMode === 'list' ? (
          // Responsive table - mobile cards vs desktop table
          isMobile ? (
            // Mobile view - cards
            <View style={styles.mobileTable}>
              {filteredProducts.map((product) => (
                <MobileProductRow key={product.id} product={product} />
              ))}
            </View>
          ) : (
            // Desktop/Tablet view - DataTable
            <DataTable style={styles.desktopTable}>
              <DataTable.Header>
                <DataTable.Title style={styles.productColumn}>Product</DataTable.Title>
                <DataTable.Title style={styles.categoryColumn}>Category</DataTable.Title>
                <DataTable.Title numeric style={styles.priceColumn}>Price</DataTable.Title>
                <DataTable.Title style={styles.statusColumn}>Full Stock</DataTable.Title>
                <DataTable.Title style={styles.actionsColumn}>Actions</DataTable.Title>
              </DataTable.Header>

              {filteredProducts.map((product) => (
                <DataTable.Row key={product.id}>
                  <DataTable.Cell style={styles.productColumn}>
                    <View>
                      <Text variant="bodyMedium" numberOfLines={1}>
                        {product.title}
                      </Text>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell style={styles.categoryColumn}>
                    <Text variant="bodyMedium" numberOfLines={1}>
                      {getCategoryName(product.categoryId)}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={styles.priceColumn}>
                    <Text variant="bodyMedium">₹{product.sellingPrice}</Text>
                  </DataTable.Cell>
                  <DataTable.Cell style={styles.statusColumn}>
                    <Chip mode="outlined" style={product.active ? styles.activeChip : styles.inactiveChip}>
                      {product.fullstock ? 'Yes' : 'NO'}
                    </Chip>
                  </DataTable.Cell>
                  <DataTable.Cell style={styles.actionsColumn}>
                    <View style={styles.actionButtons}>
                      <Button 
                        mode="text" 
                        compact 
                        onPress={() => editProduct(product)}
                        textColor="#1976D2"
                        style={styles.editButton}
                      >
                        Edit
                      </Button>
                      <Button 
                        mode="text" 
                        compact 
                        onPress={() => handleDelete(product)} 
                        textColor="#D32F2F"
                        style={styles.deleteButton}
                      >
                        Delete
                      </Button>
                    </View>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          )
        ) : (
          // Category View
          <View style={styles.categoryView}>
            {Object.entries(productsByCategory).map(([categoryName, categoryProducts]) => (
              <Card key={categoryName} style={styles.categoryCard}>
                <Card.Content>
                  <View style={styles.categoryHeader}>
                    <Text variant="titleMedium" style={styles.categoryTitle}>
                      {categoryName}
                    </Text>
                    <Text variant="bodySmall" style={styles.productCount}>
                      {categoryProducts.length} products
                    </Text>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.categoryProducts}>
                      {categoryProducts.map((product) => (
                        <Card key={product.id} style={styles.productCard}>
                          <Card.Content style={styles.productCardContent}>
                            {product.images && product.images.length > 0 && (
                              <Image 
                                source={{ uri: product.images[0] }} 
                                style={styles.productImage} 
                                resizeMode="contain"
                              />
                            )}
                            <Text variant="bodyMedium" numberOfLines={2} style={styles.productTitle}>
                              {product.title}
                            </Text>
                            {product.fullstock && (
                              <Chip mode="outlined" style={styles.fullstockChip} compact>
                                Fullstock
                              </Chip>
                            )}
                            <Text variant="bodySmall" style={styles.productPrice}>
                              ₹{product.sellingPrice}
                            </Text>
                            <View style={styles.productActions}>
                              <Button 
                                mode="text" 
                                compact 
                                onPress={() => editProduct(product)} 
                                style={styles.smallButton}
                                textColor="#1976D2"
                              >
                                Edit
                              </Button>
                            </View>
                          </Card.Content>
                        </Card>
                      ))}
                    </View>
                  </ScrollView>
                </Card.Content>
              </Card>
            ))}
          </View>
        )}

        {filteredProducts.length === 0 && !loading && (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text variant="bodyLarge" style={styles.emptyText}>
                {products.length === 0 ? 'No products found. Add your first product!' : 'No products match your filters'}
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Product Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => {
            setModalVisible(false);
            resetForm();
          }}
          contentContainerStyle={[styles.modal, isMobile && styles.mobileModal]}
        >
          <ScrollView>
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" style={styles.modalTitle}>
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
                style={styles.closeIcon}
              />
            </View>

            <TextInput label="Product Title *" value={title} onChangeText={setTitle} style={styles.input} mode="outlined" />

            {/* Category Selection */}
            <View style={styles.input}>
              <Text variant="bodyMedium" style={styles.label}>
                Category *
              </Text>

              <TouchableOpacity 
                style={styles.customDropdownButton} 
                onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
              >
                <Text style={styles.dropdownButtonText}>{category || 'Select Category'}</Text>
                <IconButton icon={showCategoryDropdown ? 'chevron-up' : 'chevron-down'} size={20} iconColor="#666" />
              </TouchableOpacity>

              <RNModal
                visible={showCategoryDropdown}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowCategoryDropdown(false)}
              >
                <TouchableOpacity 
                  style={styles.dropdownOverlay}
                  activeOpacity={1}
                  onPress={() => setShowCategoryDropdown(false)}
                >
                  <View style={styles.dropdownModalContainer}>
                    <View style={styles.dropdownModalContent}>
                      <ScrollView 
                        style={styles.dropdownModalList}
                        keyboardShouldPersistTaps="handled"
                      >
                        {categories.map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={styles.dropdownModalItem}
                            onPress={() => {
                              selectCategory(item);
                              setShowCategoryDropdown(false);
                            }}
                          >
                            <Text style={styles.dropdownModalItemText}>{item.title}</Text>
                          </TouchableOpacity>
                        ))}
                        {categories.length === 0 && (
                          <View style={styles.dropdownModalItem}>
                            <Text style={styles.dropdownModalEmptyText}>No categories available</Text>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  </View>
                </TouchableOpacity>
              </RNModal>

              {categoryId ? <Text variant="bodySmall" style={styles.selectedCategory}>Selected: {category}</Text> : null}
            </View>

            {/* Selling Price Input */}
            <TextInput
              label="Selling Price *"
              value={sellingPrice}
              onChangeText={setSellingPrice}
              style={styles.input}
              mode="outlined"
              keyboardType="decimal-pad"
              left={<TextInput.Affix text="₹" />}
            />

            {/* Fullstock Toggle */}
            <View style={styles.fullstockToggle}>
              <View style={styles.fullstockRow}>
                <Text variant="bodyMedium" style={styles.fullstockLabel}>
                  Fullstock Product
                </Text>
                <Switch
                  value={fullstock}
                  onValueChange={handleFullstockToggle}
                  color="#4CAF50"
                />
              </View>
              <Text variant="bodySmall" style={styles.fullstockDescription}>
                {fullstock 
                  ? 'Stock and production fields are hidden. All variants will have stock: 1 and production: 1. Orders will not reduce stock.'
                  : 'Stock and production fields are visible. Orders will reduce stock normally.'}
              </Text>
            </View>

            <Button mode="outlined" onPress={pickImage} loading={uploading} style={styles.input} icon="image">
              <Text>Add Image</Text>
            </Button>

            {images.length > 0 && (
              <ScrollView horizontal style={styles.imageScroll}>
                {images.map((uri, index) => (
                  <Image 
                    key={index} 
                    source={{ uri }} 
                    style={styles.image} 
                    resizeMode="contain"
                  />
                ))}
              </ScrollView>
            )}

            <View style={styles.variantHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Variants ({variants.length})
              </Text>
              <View style={[styles.variantHeaderActions, isMobile && styles.mobileVariantHeaderActions]}>
                {variants.length > 0 && (
                  <Button
                    mode="outlined"
                    onPress={clearAllVariants}
                    style={[styles.smallButton, styles.clearButton]}
                    compact
                    textColor="red"
                  >
                    <Text>Clear All</Text>
                  </Button>
                )}
                <Button mode="outlined" onPress={resetToStandardSizes} style={styles.variantButton} icon="refresh">
                  <Text>Reset</Text>
                </Button>
              </View>
            </View>

            {variants.length === 0 && (
              <Card style={styles.emptyVariantCard}>
                <Card.Content>
                  <Text variant="bodyMedium" style={styles.emptyVariantText}>
                    No variants added. Standard sizes will be auto-filled when you create a new product.
                  </Text>
                </Card.Content>
              </Card>
            )}

            {/* Variants List - Responsive */}
            {variants.map((variant, index) => (
              isMobile ? (
                <MobileVariantRow key={index} variant={variant} index={index} />
              ) : (
                <DesktopVariantRow key={index} variant={variant} index={index} />
              )
            ))}

            <View style={styles.variantButtons}>
              <Button
                mode="outlined"
                onPress={addVariant}
                style={[styles.smallButton, styles.addVariantButton]}
                compact
                icon="plus"
              >
                <Text>Add Variant</Text>
              </Button>
            </View>

            <Button mode="contained" onPress={handleSubmit} loading={loading} disabled={loading} style={styles.submitButton}>
              <Text>{editingProduct ? 'Update Product' : 'Add Product'}</Text>
            </Button>
          </ScrollView>
        </Modal>

        {/* Category Management Modal */}
        <Modal visible={categoryModalVisible} onDismiss={() => setCategoryModalVisible(false)} contentContainerStyle={[styles.modal, isMobile && styles.mobileModal]}>
          <ScrollView>
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" style={styles.modalTitle}>
                Manage Categories
              </Text>
              <IconButton icon="close" size={24} onPress={() => setCategoryModalVisible(false)} style={styles.closeIcon} />
            </View>

            <View style={styles.input}>
              <Text variant="bodyMedium" style={styles.label}>
                Add New Category
              </Text>
              <View style={styles.addCategoryRow}>
                <TextInput placeholder="Enter category name" value={newCategoryName} onChangeText={setNewCategoryName} style={styles.categoryInput} mode="outlined" />
                <Button mode="contained" onPress={handleAddCategory} loading={loading} disabled={loading} style={styles.addCategoryButton}>
                  <Text>Add</Text>
                </Button>
              </View>
            </View>

            <Text variant="titleMedium" style={styles.sectionTitle}>
              Existing Categories
            </Text>

            {categories.map((category) => (
              <Card key={category.id} style={styles.categoryItemCard}>
                <Card.Content style={styles.categoryItemContent}>
                  <Text variant="bodyMedium">{category.title}</Text>
                  <IconButton icon="delete" onPress={() => handleDeleteCategory(category)} iconColor="red" size={20} />
                </Card.Content>
              </Card>
            ))}

            {categories.length === 0 && (
              <Text variant="bodyMedium" style={styles.emptyText}>
                No categories yet. Add your first category!
              </Text>
            )}

            <Button mode="outlined" onPress={() => setCategoryModalVisible(false)} style={styles.closeButton}>
              <Text>Close</Text>
            </Button>
          </ScrollView>
        </Modal>
      </Portal>

      {/* Floating Action Buttons */}
      <FAB icon="plus" style={styles.fab} onPress={() => setModalVisible(true)} />
      <FAB icon="folder" style={[styles.fab, styles.categoryFab]} onPress={() => setCategoryModalVisible(true)} small />
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
    paddingBottom: 100,
  },
  title: {
    textAlign: 'center',
    marginBottom: scaleSize(24),
    color: '#3B3B3B',
  },
  filterSection: {
    marginBottom: scaleSize(16),
  },
  searchbar: {
    marginBottom: scaleSize(12),
  },
  viewModeToggle: {
    marginBottom: scaleSize(12),
  },
  categoryScroll: {
    marginBottom: scaleSize(16),
  },
  categoryFilter: {
    flexDirection: 'row',
    paddingVertical: scaleSize(4),
  },
  categoryChip: {
    marginRight: scaleSize(8),
  },
  
  // Mobile Table Styles
  mobileTable: {
    gap: scaleSize(8),
  },
  mobileCard: {
    backgroundColor: 'white',
    marginBottom: scaleSize(8),
  },
  mobileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mobileProductInfo: {
    flex: 1,
    marginRight: scaleSize(8),
  },
  mobileProductTitle: {
    fontWeight: '600',
    marginBottom: scaleSize(4),
  },
  mobileCategory: {
    color: '#666',
    marginBottom: scaleSize(2),
  },
  mobilePrice: {
    color: '#E6C76E',
    fontWeight: '600',
  },
  mobileStatusActions: {
    alignItems: 'flex-end',
    minWidth: 100,
  },
  mobileActionButtons: {
    flexDirection: 'row',
    marginTop: scaleSize(8),
  },
  mobileActionButton: {
    minWidth: 50,
    marginLeft: scaleSize(4),
  },
  
  // Desktop Table Styles
  desktopTable: {
    flex: 1,
  },
  productColumn: {
    flex: 2,
    justifyContent: 'center',
  },
  categoryColumn: {
    flex: 1.5,
    justifyContent: 'center',
  },
  priceColumn: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: scaleSize(8),
  },
  statusColumn: {
    flex: 1.2,
    justifyContent: 'center',
    paddingLeft: scaleSize(12),
  },
  actionsColumn: {
    flex: 1.5,
    justifyContent: 'center',
  },
  
  categoryView: {
    gap: scaleSize(16),
  },
  categoryCard: {
    backgroundColor: '#FAF9F6',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleSize(12),
  },
  categoryTitle: {
    color: '#3B3B3B',
    fontWeight: '600',
  },
  productCount: {
    color: '#A08B73',
  },
  categoryProducts: {
    flexDirection: 'row',
    gap: scaleSize(12),
  },
  productCard: {
    width: 150,
    backgroundColor: 'white',
  },
  productCardContent: {
    alignItems: 'center',
    padding: scaleSize(8),
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: scaleSize(8),
    marginBottom: scaleSize(8),
  },
  productTitle: {
    textAlign: 'center',
    marginBottom: scaleSize(4),
  },
  productPrice: {
    color: '#E6C76E',
    fontWeight: '600',
    marginBottom: scaleSize(8),
  },
  productActions: {
    width: '100%',
  },
  smallButton: {
    minWidth: 60,
  },
  modal: {
    backgroundColor: 'white',
    margin: scaleSize(20),
    padding: scaleSize(20),
    borderRadius: scaleSize(8),
    maxHeight: '90%',
  },
  mobileModal: {
    margin: scaleSize(10),
    padding: scaleSize(15),
    maxHeight: '95%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleSize(20),
  },
  modalTitle: {
    color: '#3B3B3B',
    flex: 1,
    marginRight: scaleSize(8),
  },
  closeIcon: {
    margin: 0,
  },
  input: {
    marginBottom: scaleSize(16),
  },
  // Fullstock styles
  fullstockToggle: {
    marginBottom: scaleSize(16),
    padding: scaleSize(12),
    backgroundColor: '#F8F9FA',
    borderRadius: scaleSize(8),
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  fullstockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleSize(8),
  },
  fullstockLabel: {
    color: '#3B3B3B',
    fontWeight: '600',
  },
  fullstockDescription: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
  },
  fullstockChip: {
    backgroundColor: '#E8F5E8',
    borderColor: '#4CAF50',
    marginTop: scaleSize(4),
  },
  customDropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#79747E',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'white',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#3B3B3B',
    flex: 1,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModalContainer: {
    width: '80%',
    maxHeight: '60%',
  },
  dropdownModalContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownModalList: {
    maxHeight: 300,
  },
  dropdownModalItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownModalItemText: {
    fontSize: 16,
    color: '#3B3B3B',
  },
  dropdownModalEmptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  imageScroll: {
    marginBottom: scaleSize(16),
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: scaleSize(8),
    marginRight: scaleSize(8),
  },
  sectionTitle: {
    marginBottom: scaleSize(16),
    color: '#3B3B3B',
  },
  variantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleSize(16),
  },
  variantHeaderActions: {
    flexDirection: 'row',
    gap: scaleSize(8),
  },
  mobileVariantHeaderActions: {
    flexDirection: 'column',
    gap: scaleSize(4),
  },
  addVariantButton: {
    borderColor: '#4CAF50',
  },
  clearButton: {
    borderColor: 'red',
  },
  variantCard: {
    marginBottom: scaleSize(8),
  },
  
  // Desktop Variant Styles
  desktopVariantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(12),
  },
  desktopSizeInput: {
    flex: 0.8,
    minWidth: 80,
  },
  desktopControlGroup: {
    flex: 1,
  },
  desktopControlLabel: {
    marginBottom: scaleSize(4),
    color: '#3B3B3B',
    fontSize: 12,
    textAlign: 'center',
  },
  desktopNumberControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleSize(4),
  },
  desktopNumberInput: {
    width: 60,
    textAlign: 'center',
  },
  
  // Mobile Variant Styles
  mobileVariantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleSize(12),
  },
  mobileSizeInput: {
    flex: 1,
    marginRight: scaleSize(8),
  },
  mobileControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scaleSize(12),
  },
  mobileControlGroup: {
    flex: 1,
  },
  mobileControlLabel: {
    marginBottom: scaleSize(4),
    color: '#3B3B3B',
    fontSize: 12,
    textAlign: 'center',
  },
  mobileNumberControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleSize(2),
  },
  mobileNumberInput: {
    width: 50,
    textAlign: 'center',
    height: 40,
  },
  mobileIconButton: {
    margin: 0,
    width: 36,
    height: 36,
  },
  
  variantButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: scaleSize(16),
  },
  variantButton: {
    marginHorizontal: scaleSize(4),
  },
  emptyVariantCard: {
    marginBottom: scaleSize(16),
    backgroundColor: '#FFF9C4',
  },
  emptyVariantText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
  submitButton: {
    marginTop: scaleSize(16),
    backgroundColor: '#F7CAC9',
  },
  closeButton: {
    marginTop: scaleSize(16),
  },
  fab: {
    position: 'absolute',
    margin: scaleSize(16),
    right: 0,
    bottom: 0,
    backgroundColor: '#F7CAC9',
  },
  categoryFab: {
    bottom: scaleSize(80),
  },
  activeChip: {
    backgroundColor: '#E8F5E8',
  },
  inactiveChip: {
    backgroundColor: '#FFEBEE',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: scaleSize(4),
  },
  editButton: {
    minWidth: 50,
  },
  deleteButton: {
    minWidth: 50,
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
  label: {
    marginBottom: scaleSize(8),
    color: '#3B3B3B',
  },
  selectedCategory: {
    marginTop: scaleSize(8),
    color: '#666',
    fontStyle: 'italic',
  },
  // Category management styles
  addCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(8),
  },
  categoryInput: {
    flex: 1,
  },
  addCategoryButton: {
    backgroundColor: '#F7CAC9',
  },
  categoryItemCard: {
    marginBottom: scaleSize(8),
    backgroundColor: '#FAF9F6',
  },
  categoryItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default ProductManagement;