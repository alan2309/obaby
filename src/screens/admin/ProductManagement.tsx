import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  TouchableOpacity,
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
import { testCloudinaryConnection } from '../../firebase/cloudinary';

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

  // Form state - added sellingPrice back
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [uploading, setUploading] = useState(false);

  // Category form state
  const [newCategoryName, setNewCategoryName] = useState('');

  // Standard sizes from S to 5XL
  const standardSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  useEffect(() => {
    const testConnection = async () => {
      const isConnected = await testCloudinaryConnection();
      if (!isConnected) {
        console.warn('⚠️ Cloudinary connection test failed');
      }
    };
    testConnection();
  }, []);

  // Auto-fill standard sizes when modal opens for new product
  useEffect(() => {
    if (modalVisible && !editingProduct && variants.length === 0) {
      const standardVariants = standardSizes.map((size) => ({
        size,
        color: 'Default',
        stock: 1,
      }));
      setVariants(standardVariants);
    }
  }, [modalVisible, editingProduct]);

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
        allowsEditing: false, // Changed to false to prevent cropping
        aspect: undefined, // Removed fixed aspect ratio
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
    setVariants([...variants, { size: '', color: 'Default', stock: 0 }]);
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
      stock: 0,
    }));
    setVariants(standardVariants);
    Alert.alert('Success', 'Reset to standard sizes');
  };

  const handleSubmit = async () => {
    // Updated validation - added sellingPrice validation
    if (!title || !categoryId || !sellingPrice) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);

      // Show upload progress if there are local images
      const localImages = images.filter(
        (uri) => uri && (uri.startsWith('file://') || uri.startsWith('data:'))
      );

      if (localImages.length > 0) {
        Alert.alert('Uploading', `Uploading ${localImages.length} images...`);
      }

      // Updated product data - added sellingPrice back
      const productData = {
        title,
        description: '', // Keep empty description for compatibility
        category,
        categoryId,
        costPrice: 0, // Set default value
        sellingPrice: parseFloat(sellingPrice), // Added selling price back
        images,
        sizes: variants,
        active: true,
      };

      let successMessage = 'Product added successfully';

      if (editingProduct) {
        await updateProduct(editingProduct.id!, productData);
        successMessage = 'Product updated successfully';
      } else {
        await addProduct(productData);
      }

      // Check if there were any local images that might have failed to upload
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
  };

  const editProduct = (product: Product) => {
    setEditingProduct(product);
    setTitle(product.title);
    setCategory(product.category);
    setCategoryId(product.categoryId);
    setSellingPrice((product.sellingPrice ?? 0).toString());
    setImages(product.images ?? []);
    setVariants(product.sizes ?? []);
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
    // Check if any products are using this category
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
  // List View - Added Price column back with proper spacing
  <DataTable>
    <DataTable.Header>
      <DataTable.Title style={styles.productColumn}>Product</DataTable.Title>
      <DataTable.Title style={styles.categoryColumn}>Category</DataTable.Title>
      <DataTable.Title numeric style={styles.priceColumn}>Price</DataTable.Title>
      <DataTable.Title style={styles.statusColumn}>Status</DataTable.Title>
      <DataTable.Title style={styles.actionsColumn}>Actions</DataTable.Title>
    </DataTable.Header>

    {filteredProducts.map((product) => (
      <DataTable.Row key={product.id}>
        <DataTable.Cell style={styles.productColumn}>
          <Text variant="bodyMedium" numberOfLines={1}>
            {product.title}
          </Text>
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
            {product.active ? 'Active' : 'Inactive'}
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
) : (
  // Category View - Added price display back
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
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            {/* Close Button on Top */}
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

            <TextInput label="Product SKU *" value={title} onChangeText={setTitle} style={styles.input} mode="outlined" />

            {/* Category Selection */}
            <View style={styles.input}>
              <Text variant="bodyMedium" style={styles.label}>
                Category *
              </Text>

              <TouchableOpacity style={styles.customDropdownButton} onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}>
                <Text style={styles.dropdownButtonText}>{category || 'Select Category'}</Text>
                <IconButton icon={showCategoryDropdown ? 'chevron-up' : 'chevron-down'} size={20} iconColor="#666" />
              </TouchableOpacity>

              {showCategoryDropdown && (
                <View style={styles.dropdownWrapper}>
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled={true}>
                    {categories.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          selectCategory(item);
                          setShowCategoryDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{item.title}</Text>
                      </TouchableOpacity>
                    ))}
                    {categories.length === 0 && (
                      <View style={styles.dropdownItem}>
                        <Text style={styles.dropdownEmptyText}>No categories available</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}

              {categoryId ? <Text variant="bodySmall" style={styles.selectedCategory}>Selected: {category}</Text> : null}
            </View>

            {/* Selling Price Input - Added back */}
            <TextInput
              label="Selling Price *"
              value={sellingPrice}
              onChangeText={setSellingPrice}
              style={styles.input}
              mode="outlined"
              keyboardType="decimal-pad"
              left={<TextInput.Affix text="₹" />}
            />

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
              <View style={styles.variantHeaderActions}>
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
                <Text>Reset to Standard Sizes</Text>
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

            {variants.map((variant, index) => (
              <Card key={index} style={styles.variantCard}>
                <Card.Content>
                  <View style={styles.variantRow}>
                    <TextInput
                      label="Size"
                      value={variant.size}
                      onChangeText={(value) => updateVariant(index, 'size', value)}
                      style={styles.variantInput}
                      mode="outlined"
                      placeholder="e.g., S, M, L, XL..."
                    />
                    <TextInput
                      label="Stock"
                      value={variant.stock.toString()}
                      onChangeText={(value) => updateVariant(index, 'stock', parseInt(value) || 0)}
                      style={styles.variantInput}
                      mode="outlined"
                      keyboardType="numeric"
                    />
                    <IconButton icon="delete" onPress={() => removeVariant(index)} iconColor="red" size={20} />
                  </View>
                </Card.Content>
              </Card>
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
        <Modal visible={categoryModalVisible} onDismiss={() => setCategoryModalVisible(false)} contentContainerStyle={styles.modal}>
          <ScrollView>
            {/* Close Button on Top */}
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" style={styles.modalTitle}>
                Manage Categories
              </Text>
              <IconButton icon="close" size={24} onPress={() => setCategoryModalVisible(false)} style={styles.closeIcon} />
            </View>

            {/* Add Category Form */}
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

            {/* Categories List */}
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
    maxHeight: '100%',
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
  halfInput: {
    flex: 1,
    marginHorizontal: scaleSize(4),
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
  dropdownWrapper: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 1,
    elevation: 5,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#3B3B3B',
    flex: 1,
  },
  dropdownList: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#79747E',
    borderRadius: 4,
    backgroundColor: 'white',
    marginTop: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#3B3B3B',
  },
  dropdownEmptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  addVariantButton: {
    borderColor: '#4CAF50',
  },
  clearButton: {
    borderColor: 'red',
  },
  variantCard: {
    marginBottom: scaleSize(8),
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  variantInput: {
    flex: 1,
    marginHorizontal: scaleSize(4),
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
  // Table column styles for proper spacing
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
});

export default ProductManagement;