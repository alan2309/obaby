import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { Text, TextInput, Button, IconButton, Card, Chip, Modal, Portal, DataTable, FAB } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { Product, ProductVariant, getProducts, addProduct, updateProduct, deleteProduct, uploadProductImage } from '../../firebase/firestore';
import { scaleSize, platformStyle, isTablet } from '../../utils/constants';

const ProductManagement: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const productsData = await getProducts(true);
      setProducts(productsData);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setUploading(true);
        // In real implementation, you'd upload to Firebase Storage
        // For now, we'll just use the local URI
        setImages([...images, result.assets[0].uri]);
        setUploading(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const addVariant = () => {
    setVariants([...variants, { size: '', color: '', stock: 0 }]);
  };

  const updateVariant = (index: number, field: keyof ProductVariant, value: string | number) => {
    const updatedVariants = [...variants];
    updatedVariants[index] = { ...updatedVariants[index], [field]: value };
    setVariants(updatedVariants);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title || !description || !category || !costPrice || !sellingPrice) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      
      const productData = {
        title,
        description,
        category,
        costPrice: parseFloat(costPrice),
        sellingPrice: parseFloat(sellingPrice),
        images, // In production, upload to Firebase Storage first
        sizes: variants,
        active: true,
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id!, productData);
        Alert.alert('Success', 'Product updated successfully');
      } else {
        await addProduct(productData);
        Alert.alert('Success', 'Product added successfully');
      }

      resetForm();
      setModalVisible(false);
      loadProducts();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setCostPrice('');
    setSellingPrice('');
    setImages([]);
    setVariants([]);
    setEditingProduct(null);
  };

  const editProduct = (product: Product) => {
    setEditingProduct(product);
    setTitle(product.title);
    setDescription(product.description);
    setCategory(product.category);
    setCostPrice(product.costPrice.toString());
    setSellingPrice(product.sellingPrice.toString());
    setImages(product.images);
    setVariants(product.sizes);
    setModalVisible(true);
  };

  const handleDelete = async (product: Product) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete ${product.title}?`,
      [
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
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Product Management
        </Text>

        <DataTable>
          <DataTable.Header>
            <DataTable.Title>Product</DataTable.Title>
            <DataTable.Title numeric>Cost</DataTable.Title>
            <DataTable.Title numeric>Price</DataTable.Title>
            <DataTable.Title>Status</DataTable.Title>
            <DataTable.Title>Actions</DataTable.Title>
          </DataTable.Header>

          {products.map((product) => (
            <DataTable.Row key={product.id}>
              <DataTable.Cell>
                <Text variant="bodyMedium" numberOfLines={1}>
                  {product.title}
                </Text>
              </DataTable.Cell>
              <DataTable.Cell numeric>${product.costPrice}</DataTable.Cell>
              <DataTable.Cell numeric>${product.sellingPrice}</DataTable.Cell>
              <DataTable.Cell>
                <Chip 
                  mode="outlined" 
                  style={product.active ? styles.activeChip : styles.inactiveChip}
                >
                  {product.active ? 'Active' : 'Inactive'}
                </Chip>
              </DataTable.Cell>
              <DataTable.Cell>
                <View style={styles.actionButtons}>
                  <Button 
                    mode="text" 
                    compact 
                    onPress={() => editProduct(product)}
                  >
                    Edit
                  </Button>
                  <Button 
                    mode="text" 
                    compact 
                    textColor="red"
                    onPress={() => handleDelete(product)}
                  >
                    Delete
                  </Button>
                </View>
              </DataTable.Cell>
            </DataTable.Row>
          ))}
        </DataTable>

        {products.length === 0 && !loading && (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text variant="bodyLarge" style={styles.emptyText}>
                No products found. Add your first product!
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

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
            <Text variant="headlineSmall" style={styles.modalTitle}>
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </Text>

            <TextInput
              label="Product Title *"
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              mode="outlined"
            />

            <TextInput
              label="Description *"
              value={description}
              onChangeText={setDescription}
              style={styles.input}
              mode="outlined"
              multiline
              numberOfLines={3}
            />

            <TextInput
              label="Category *"
              value={category}
              onChangeText={setCategory}
              style={styles.input}
              mode="outlined"
            />

            <View style={styles.priceRow}>
              <TextInput
                label="Cost Price *"
                value={costPrice}
                onChangeText={setCostPrice}
                style={[styles.input, styles.halfInput]}
                mode="outlined"
                keyboardType="decimal-pad"
              />
              <TextInput
                label="Selling Price *"
                value={sellingPrice}
                onChangeText={setSellingPrice}
                style={[styles.input, styles.halfInput]}
                mode="outlined"
                keyboardType="decimal-pad"
              />
            </View>

            <Button
              mode="outlined"
              onPress={pickImage}
              loading={uploading}
              style={styles.input}
              icon="image"
            >
              Add Image
            </Button>

            {images.length > 0 && (
              <ScrollView horizontal style={styles.imageScroll}>
                {images.map((uri, index) => (
                  <Image key={index} source={{ uri }} style={styles.image} />
                ))}
              </ScrollView>
            )}

            <Text variant="titleMedium" style={styles.sectionTitle}>
              Variants
            </Text>

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
                    />
                    <TextInput
                      label="Color"
                      value={variant.color}
                      onChangeText={(value) => updateVariant(index, 'color', value)}
                      style={styles.variantInput}
                      mode="outlined"
                    />
                    <TextInput
                      label="Stock"
                      value={variant.stock.toString()}
                      onChangeText={(value) => updateVariant(index, 'stock', parseInt(value) || 0)}
                      style={styles.variantInput}
                      mode="outlined"
                      keyboardType="numeric"
                    />
                    <IconButton
                      icon="delete"
                      onPress={() => removeVariant(index)}
                      iconColor="red"
                      size={20}
                    />
                  </View>
                </Card.Content>
              </Card>
            ))}

            <Button
              mode="outlined"
              onPress={addVariant}
              style={styles.input}
              icon="plus"
            >
              Add Variant
            </Button>

            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              style={styles.submitButton}
            >
              {editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
          </ScrollView>
        </Modal>
      </Portal>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      />
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
  modal: {
    backgroundColor: 'white',
    margin: scaleSize(20),
    padding: scaleSize(20),
    borderRadius: scaleSize(8),
    maxHeight: '100%',
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: scaleSize(20),
    color: '#3B3B3B',
  },
  input: {
    marginBottom: scaleSize(16),
  },
  halfInput: {
    flex: 1,
    marginHorizontal: scaleSize(4),
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  imageScroll: {
    marginBottom: scaleSize(16),
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: scaleSize(8),
    marginRight: scaleSize(8),
  },
  sectionTitle: {
    marginBottom: scaleSize(16),
    color: '#3B3B3B',
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
  submitButton: {
    marginTop: scaleSize(16),
    backgroundColor: '#F7CAC9',
  },
  fab: {
    position: 'absolute',
    margin: scaleSize(16),
    right: 0,
    bottom: 0,
    backgroundColor: '#F7CAC9',
  },
  activeChip: {
    backgroundColor: '#E8F5E8',
  },
  inactiveChip: {
    backgroundColor: '#FFEBEE',
  },
  actionButtons: {
    flexDirection: 'row',
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
});

export default ProductManagement;