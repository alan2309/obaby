// src/firebase/firestore.ts

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firestore, storage } from './config';
import { COLLECTIONS } from '../utils/constants';
import { getAuth } from 'firebase/auth';
import { UserData } from './auth';
import { getProductsOffline, saveProductsOffline, updateLastSyncTime } from '../utils/offlineStorage';
import { uploadMultipleToCloudinary } from './cloudinary';

// -----------------------------
// Data Interfaces
// -----------------------------
export interface ProductVariant {
  size: string;
  color: string;
  stock: number;
  production: number;
}

export interface Category {
  id?: string;
  title: string;
  createdAt: Date;
}

export interface Product {
  id?: string;
  title: string;
  description?: string;
  category: string;
  categoryId: string;
  costPrice?: number;
  sellingPrice?: number;
  images: string[];
  sizes: ProductVariant[];
  active: boolean;
  fullstock?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface OrderItem {
  productId: string;
  productName: string;
  size: string;
  color: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  finalPrice: number;
  discountGiven: number;
  deliveredQuantity?: number; // Make sure this is included
}

export interface Order {
  id?: string;
  customerId: string;
  customerName: string; 
  salesmanId: string;
  salesmanName: string; 
    workerId: string; 
  workerName: string; 
  items: OrderItem[];
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  status: 'Pending' | 'Delivered' | 'Partially Delivered';
  createdAt: Date;
  updatedAt: Date;
  deliveredAmount?: number;
  deliveredProfit?: number;
}
// -----------------------------
// Products: CRUD + helpers
// -----------------------------

/**
 * Add a new product document to Firestore.
 * Returns: newly created document id.
 */
export const addProduct = async (product: Omit<Product, 'id' | 'createdAt'>): Promise<string> => {
  try {
    console.log('➕ Adding new product...');
    
    // Separate local images from URLs
    const localImages = product.images.filter(uri => 
      uri && (uri.startsWith('file://') || uri.startsWith('data:'))
    );
    const existingUrls = product.images.filter(uri => 
      uri && uri.startsWith('http')
    );

    let allImageUrls = [...existingUrls];

    // Create product document first to get ID
    const docRef = await addDoc(collection(firestore, COLLECTIONS.PRODUCTS), {
      ...product,
      images: allImageUrls, // Start with existing URLs
      createdAt: Timestamp.now(),
    });

    console.log('📝 Product document created with ID:', docRef.id);

    // Upload local images if any
    if (localImages.length > 0) {
      try {
        console.log(`📤 Uploading ${localImages.length} local images to Cloudinary...`);
        const cloudinaryUrls = await uploadProductImages(localImages, docRef.id);
        allImageUrls = [...existingUrls, ...cloudinaryUrls];
        
        // Update product with Cloudinary URLs
        await updateDoc(docRef, { 
          images: allImageUrls,
          updatedAt: Timestamp.now()
        });
        
        console.log(`✅ Successfully uploaded ${cloudinaryUrls.length} images`);
      } catch (uploadError: any) {
        console.error('❌ Image upload failed, but product was created:', uploadError);
        // Product is created but images failed to upload
        // You might want to show a warning to the user
      }
    }

    console.log('✅ Product added successfully with ID:', docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error('❌ Error adding product:', error);
    throw new Error('Failed to add product');
  }
};

/**
 * Enhanced updateProduct function with Cloudinary uploads
 */
export const updateProduct = async (productId: string, product: Partial<Product>): Promise<void> => {
  try {
    console.log('✏️ Updating product:', productId);
    
    let updatedProduct = { ...product };
    
    // Handle image uploads if there are new local images
    if (product.images) {
      const localImages = product.images.filter(uri => 
        uri.startsWith('file://') || uri.startsWith('data:')
      );
      const existingUrls = product.images.filter(uri => 
        uri.startsWith('http')
      );
      
      let allImageUrls = existingUrls;
      
      if (localImages.length > 0) {
        console.log(`📤 Uploading ${localImages.length} new images to Cloudinary...`);
        const cloudinaryUrls = await uploadProductImages(localImages, productId);
        allImageUrls = [...existingUrls, ...cloudinaryUrls];
        updatedProduct.images = allImageUrls;
      }
    }
    
    await updateDoc(doc(firestore, COLLECTIONS.PRODUCTS, productId), {
      ...updatedProduct,
      updatedAt: Timestamp.now(),
    });
    
    console.log('✅ Product updated successfully');
  } catch (error: any) {
    console.error('❌ Error updating product:', error);
    throw new Error('Failed to update product');
  }
};

/**
 * Soft-delete a product by setting `active` to false.
 */
export const deleteProduct = async (productId: string): Promise<void> => {
  try {
    await updateDoc(doc(firestore, COLLECTIONS.PRODUCTS, productId), {
      active: false,
    });
  } catch (error) {
    throw new Error('Failed to delete product');
  }
};

/**
 * Fetch products from Firestore. Falls back to offline cache on error.
 * - includeInactive: when true, returns inactive products too.
 */ 
export const getProducts = async (includeInactive = false): Promise<Product[]> => {
  try {
    console.log('🔄 Fetching products from Firestore...');

    const querySnapshot = await getDocs(collection(firestore, COLLECTIONS.PRODUCTS));
    let productsData = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'No Title',
        description: data.description || '',
        category: data.category || 'Uncategorized',
        costPrice: data.costPrice || 0,
        categoryId: data.categoryId || '',
        sellingPrice: data.sellingPrice || 0,
        images: data.images || [],
        sizes: data.sizes?.map((variant: any) => ({
          size: variant.size || '',
          color: variant.color || 'Default',
          stock: variant.stock || 0,
          production: variant.production || 0, // Add this line
        })) || [],
        fullstock: data.fullstock || false,
        active: data.active !== undefined ? data.active : true,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Product;
    });

    if (!includeInactive) {
      productsData = productsData.filter(product => product.active);
    }

    // Sort by createdAt descending
    productsData.sort((a, b) => a.category.localeCompare(b.category));

    // Save to offline cache and update sync time
    await saveProductsOffline(productsData);
    await updateLastSyncTime();

    console.log(`✅ Loaded ${productsData.length} products from Firestore`);
    return productsData;
  } catch (error: any) {
    console.error('❌ Firestore error, trying offline data:', error);

    const offlineProducts = await getProductsOffline();
    if (offlineProducts) {
      console.log(`📦 Using ${offlineProducts.length} offline products`);
      return offlineProducts;
    }

    throw new Error('Failed to fetch products and no offline data available');
  }
};

/**
 * Get a single product by id.
 */
export const getProduct = async (productId: string): Promise<Product | null> => {
  try {
    const docSnap = await getDoc(doc(firestore, COLLECTIONS.PRODUCTS, productId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        sizes: data.sizes?.map((variant: any) => ({
          size: variant.size || '',
          color: variant.color || 'Default',
          stock: variant.stock || 0,
          production: variant.production || 0, // Add this line
        })) || [],
        createdAt: data.createdAt.toDate(),
      } as Product;
    }
    return null;
  } catch (error) {
    throw new Error('Failed to fetch product');
  }
};


/**
 * Upload product images to Cloudinary
 */
export const uploadProductImages = async (imageUris: string[], productId: string): Promise<string[]> => {
  try {
    console.log(`📤 Uploading ${imageUris.length} images to Cloudinary for product:`, productId);
    
    const folder = `products/${productId}`;
    
    // Filter out any invalid URIs
    const validUris = imageUris.filter(uri => 
      uri && (uri.startsWith('file://') || uri.startsWith('data:') || uri.startsWith('http'))
    );
    
    if (validUris.length === 0) {
      console.log('⚠️ No valid images to upload');
      return [];
    }
    
    return await uploadMultipleToCloudinary(validUris, folder);
  } catch (error: any) {
    console.error('❌ Error uploading product images to Cloudinary:', error);
    throw new Error(`Failed to upload images: ${error.message}`);
  }
};




// -----------------------------
// Stock Management Helpers
// -----------------------------

/**
 * Update stock for a specific product variant (size + color).
 * Decreases the variant stock by `quantity` (throws if insufficient stock).
 */
export const updateProductStock = async (
  productId: string,
  size: string,
  color: string,
  quantity: number
): Promise<void> => {
  try {
    const product = await getProduct(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    const updatedSizes = product.sizes.map(variant => {
      if (variant.size === size && variant.color === color) {
        const newStock = variant.stock - quantity;
        if (newStock < 0) {
          throw new Error('Insufficient stock');
        }
        return { ...variant, stock: newStock };
      }
      return variant;
    });

    await updateDoc(doc(firestore, COLLECTIONS.PRODUCTS, productId), {
      sizes: updatedSizes,
    });
  } catch (error) {
    throw new Error('Failed to update product stock');
  }
};

/**
 * Check whether requested quantity for a variant is available.
 */
export const checkStockAvailability = async (
  productId: string,
  size: string,
  color: string,
  quantity: number
): Promise<boolean> => {
  try {
    const product = await getProduct(productId);
    if (!product) return false;

    const variant = product.sizes.find(v => v.size === size && v.color === color);
    return variant ? variant.stock >= quantity : false;
  } catch (error) {
    return false;
  }
};

/**
 * Return products that have any variant stock at or below threshold (but > 0).
 */
export const getLowStockProducts = async (threshold = 3): Promise<Product[]> => {
  try {
    const products = await getProducts(true);
    return products.filter(product =>
      product.sizes.some(variant => !product.fullstock&&variant.stock <= threshold && variant.stock > 0)
    );
  } catch (error) {
    throw new Error('Failed to fetch low stock products');
  }
};

/**
 * Return products where every variant is out of stock.
 */
export const getOutOfStockProducts = async (): Promise<Product[]> => {
  try {
    const products = await getProducts(true);
    return products.filter(product => product.sizes.every(variant => variant.stock === 0));
  } catch (error) {
    throw new Error('Failed to fetch out of stock products');
  }
};

// -----------------------------
// Categories
// -----------------------------

/**
 * Fetch all categories from Firestore and return them sorted by title.
 */
export const getCategories = async (): Promise<Category[]> => {
  try {
    console.log('📂 Fetching categories from Firestore...');

    const querySnapshot = await getDocs(collection(firestore, 'categories'));
    const categories = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'Unnamed Category',
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Category;
    });

    categories.sort((a, b) => a.title.localeCompare(b.title));

    console.log(`✅ Loaded ${categories.length} categories`);
    return categories;
  } catch (error: any) {
    console.error('❌ Error fetching categories:', error);
    throw new Error('Failed to fetch categories');
  }
};

/**
 * Add a new category document and return its id.
 */
export const addCategory = async (category: Omit<Category, 'id'>): Promise<string> => {
  try {
    console.log('➕ Adding new category:', category.title);

    const docRef = await addDoc(collection(firestore, 'categories'), {
      ...category,
      createdAt: Timestamp.now(),
    });

    console.log('✅ Category added successfully with ID:', docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error('❌ Error adding category:', error);
    throw new Error('Failed to add category');
  }
};

/**
 * Update fields of an existing category document.
 */
export const updateCategory = async (categoryId: string, updates: Partial<Category>): Promise<void> => {
  try {
    console.log('✏️ Updating category:', categoryId, updates);
    await updateDoc(doc(firestore, 'categories', categoryId), {
      ...updates,
    });
    console.log('✅ Category updated successfully:', categoryId);
  } catch (error: any) {
    console.error('❌ Error updating category:', error);
    throw new Error('Failed to update category');
  }
};

/**
 * Delete a category document permanently.
 */
export const deleteCategory = async (categoryId: string): Promise<void> => {
  try {
    console.log('🗑️ Deleting category:', categoryId);
    await deleteDoc(doc(firestore, 'categories', categoryId));
    console.log('✅ Category deleted successfully:', categoryId);
  } catch (error: any) {
    console.error('❌ Error deleting category:', error);
    throw new Error('Failed to delete category');
  }
};

/**
 * Fetch products filtered by categoryId. Optionally include inactive products.
 */
export const getProductsByCategory = async (categoryId: string, includeInactive = false): Promise<Product[]> => {
  try {
    console.log(`📦 Fetching products for category: ${categoryId}`);

    const q = query(
      collection(firestore, COLLECTIONS.PRODUCTS),
      where('categoryId', '==', categoryId)
    );

    const querySnapshot = await getDocs(q);
    let productsData = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'No Title',
        description: data.description || '',
        category: data.category || 'Uncategorized',
        categoryId: data.categoryId || '',
        costPrice: data.costPrice || 0,
        sellingPrice: data.sellingPrice || 0,
        images: data.images || [],
        sizes: data.sizes?.map((variant: any) => ({
          size: variant.size || '',
          color: variant.color || 'Default',
          stock: variant.stock || 0,
          production: variant.production || 0, // Add this line
        })) || [],
        fullstock: data.fullstock || false,
        active: data.active !== undefined ? data.active : true,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Product;
    });

    if (!includeInactive) {
      productsData = productsData.filter(product => product.active);
    }

    productsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    console.log(`✅ Loaded ${productsData.length} products for category ${categoryId}`);
    return productsData;
  } catch (error: any) {
    console.error('❌ Error fetching products by category:', error);
    throw new Error('Failed to fetch products for this category');
  }
};

// -----------------------------
// Orders: creation, checks, queries
// -----------------------------

/**
 * Check stock for an array of OrderItem without creating an order.
 * Returns whether all items have sufficient stock and lists any insufficient items.
 */
export const checkOrderStock = async (items: OrderItem[]): Promise<{
  hasSufficientStock: boolean;
  outOfStockItems: Array<{ productName: string; size: string; color: string; availableStock: number; requestedQuantity: number }>;
}> => {
  const outOfStockItems: Array<{ productName: string; size: string; color: string; availableStock: number; requestedQuantity: number }> = [];

  for (const item of items) {
    const product = await getProduct(item.productId);
    if (!product) {
      outOfStockItems.push({
        productName: item.productName,
        size: item.size,
        color: item.color,
        availableStock: 0,
        requestedQuantity: item.quantity,
      });
      continue;
    }

    const variant = product.sizes.find(v => v.size === item.size && v.color === item.color);

    if (!variant ||  !product.fullstock && variant.stock < item.quantity) {
      console.log("product fullstock---",product.fullstock)
      outOfStockItems.push({
        productName: item.productName,
        size: item.size,
        color: item.color,
        availableStock: variant?.stock || 0,
        requestedQuantity: item.quantity,
      });
    }
  }

  return {
    hasSufficientStock: outOfStockItems.length === 0,
    outOfStockItems,
  };
};

/**
 * Create an order document after validating discounts and stock.
 * If successful, creates the order, updates stock and salesman stats.
 */
export const createOrder = async (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; orderId?: string; message?: string; outOfStockItems?: Array<{ productName: string; size: string; color: string; availableStock: number }> }> => {
  try {
    // Validate discounts for each item
    for (const item of order.items) {
      if (item.discountGiven > 0) {
        const discountPercent = (item.discountGiven / item.sellingPrice) * 100;
        const discountValidation = await validateDiscount(order.salesmanId, discountPercent);

        if (!discountValidation.isValid) {
          return {
            success: false,
            message: `Discount validation failed for ${item.productName}: ${discountValidation.message}`,
          };
        }
      }
    }

    // Check stock availability and collect out-of-stock items
    const outOfStockItems: Array<{ productName: string; size: string; color: string; availableStock: number }> = [];

    for (const item of order.items) {
      const product = await getProduct(item.productId);
      if (!product) {
        return {
          success: false,
          message: `Product ${item.productName} not found`,
        };
      }

      const variant = product.sizes.find(v => v.size === item.size);

      if (!variant) {
        return {
          success: false,
          message: `Variant not found for ${item.productName} (${item.size}, ${item.color})`,
        };
      }

      if (!product.fullstock && variant.stock < item.quantity) {
        outOfStockItems.push({
          productName: item.productName,
          size: item.size,
          color: item.color,
          availableStock: variant.stock,
        });
      }
    }

    // If any items are out of stock, return the list without creating order
    if (outOfStockItems.length > 0) {
      return {
        success: false,
        message: 'Some items are out of stock',
        outOfStockItems,
      };
    }

    // Fetch customer, salesman, and worker names
    const [customerData, salesmanData, workerData] = await Promise.all([
      getUser(order.customerId),
      getUser(order.salesmanId),
      order.workerId ? getUser(order.workerId) : Promise.resolve(null)
    ]);

    if (!customerData) {
      return {
        success: false,
        message: 'Customer not found',
      };
    }

    if (!salesmanData) {
      return {
        success: false,
        message: 'Salesman not found',
      };
    }

    // All validations passed - create the order with names
    const orderData: any = {
      ...order,
      customerName: customerData.name || 'Unknown Customer',
      salesmanName: salesmanData.name || 'Unknown Salesman',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Add worker information if provided
    if (order.workerId && workerData) {
      orderData.workerName = workerData.name || 'Unknown Worker';
    }

    const docRef = await addDoc(collection(firestore, COLLECTIONS.ORDERS), orderData);

    // Update stock after successful order creation
    for (const item of order.items) {
      const product = await getProduct(item.productId);
      if (product && !product.fullstock) {
        // Only update stock if product is not marked as fullstock
        await updateProductStock(item.productId, item.size, item.color, item.quantity);
      }
    }

    // Update salesman stats
    const totalDiscount = order.items.reduce((sum, item) => sum + (item.discountGiven * item.quantity), 0);
    await updateSalesmanStats(order.salesmanId, order.totalAmount, totalDiscount, order.totalProfit);

    return {
      success: true,
      orderId: docRef.id,
    };
  } catch (error: any) {
    console.error('Error creating order:', error);
    return {
      success: false,
      message: `Failed to create order: ${error.message}`,
    };
  }
};;

export const updateOrderPartialDelivery = async (
  orderId: string, 
  deliveredItems: Array<{
    productId: string;
    size: string;
    color: string;
    deliveredQuantity: number;
  }>
): Promise<{ success: boolean; message?: string }> => {
  try {
    const orderDoc = await getDoc(doc(firestore, COLLECTIONS.ORDERS, orderId));
    if (!orderDoc.exists()) {
      return { success: false, message: 'Order not found' };
    }

    const order = orderDoc.data() as Order;
    const updatedItems = [...order.items];
    let totalDeliveredAmount = 0;
    let totalDeliveredProfit = 0;

    // Update delivered quantities and calculate delivered amounts
    deliveredItems.forEach(deliveredItem => {
      const itemIndex = updatedItems.findIndex(
        item => 
          item.productId === deliveredItem.productId &&
          item.size === deliveredItem.size &&
          item.color === deliveredItem.color
      );

      if (itemIndex !== -1) {
        const item = updatedItems[itemIndex];
        const newDeliveredQuantity = Math.min(
          (item.deliveredQuantity || 0) + deliveredItem.deliveredQuantity,
          item.quantity
        );
        
        // Calculate the amount delivered in this batch
        const batchDeliveredAmount = deliveredItem.deliveredQuantity * item.finalPrice;
        const batchDeliveredProfit = deliveredItem.deliveredQuantity * (item.finalPrice - item.costPrice);
        
        updatedItems[itemIndex] = {
          ...item,
          deliveredQuantity: newDeliveredQuantity
        };

        totalDeliveredAmount += batchDeliveredAmount;
        totalDeliveredProfit += batchDeliveredProfit;
      }
    });

    // Determine new order status
    const allItemsDelivered = updatedItems.every(item => 
      (item.deliveredQuantity || 0) >= item.quantity
    );
    const someItemsDelivered = updatedItems.some(item => 
      (item.deliveredQuantity || 0) > 0 && (item.deliveredQuantity || 0) < item.quantity
    );
    const noItemsDelivered = updatedItems.every(item => 
      !item.deliveredQuantity || item.deliveredQuantity === 0
    );

    let newStatus: Order['status'] = order.status;
    if (allItemsDelivered) {
      newStatus = 'Delivered';
    } else if (someItemsDelivered) {
      newStatus = 'Partially Delivered';
    }

    // Update stock for delivered items
    // for (const deliveredItem of deliveredItems) {
    //   await updateProductStock(
    //     deliveredItem.productId,
    //     deliveredItem.size,
    //     deliveredItem.color,
    //     deliveredItem.deliveredQuantity
    //   );
    // }

    // Update salesman stats with delivered amounts
    // await updateSalesmanStats(
    //   order.salesmanId,
    //   totalDeliveredAmount,
    //   0, // No additional discount on delivery
    //   totalDeliveredProfit
    // );

    // Calculate cumulative delivered amounts
    const cumulativeDeliveredAmount = (order.deliveredAmount || 0) + totalDeliveredAmount;
    const cumulativeDeliveredProfit = (order.deliveredProfit || 0) + totalDeliveredProfit;

    // Update the order document
    await updateDoc(doc(firestore, COLLECTIONS.ORDERS, orderId), {
      items: updatedItems,
      status: newStatus,
      deliveredAmount: cumulativeDeliveredAmount,
      deliveredProfit: cumulativeDeliveredProfit,
      updatedAt: Timestamp.now(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating partial delivery:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Get delivery summary for an order
 */

export const getOrderDeliverySummary = (order: Order) => {
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const deliveredItems = order.items.reduce((sum, item) => sum + (item.deliveredQuantity || 0), 0);
  const remainingItems = totalItems - deliveredItems;
  
  // Calculate delivered amount from items to verify
  const calculatedDeliveredAmount = order.items.reduce((sum, item) => {
    const deliveredQty = item.deliveredQuantity || 0;
    return sum + (deliveredQty * item.finalPrice);
  }, 0);
  
  return {
    totalItems,
    deliveredItems,
    remainingItems,
    progress: totalItems > 0 ? (deliveredItems / totalItems) * 100 : 0,
    isFullyDelivered: deliveredItems >= totalItems,
    isPartiallyDelivered: deliveredItems > 0 && deliveredItems < totalItems,
    calculatedDeliveredAmount // For debugging
  };
};
/**
 * Get all orders for a particular salesman (sorted by createdAt desc).
 */
export const getOrdersBySalesman = async (salesmanId: string): Promise<Order[]> => {
  try {
    console.log('📦 Fetching orders for salesman:', salesmanId);

    const q = query(
      collection(firestore, COLLECTIONS.ORDERS),
      where('salesmanId', '==', salesmanId)
    );

    const querySnapshot = await getDocs(q);
    const orders = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        customerId: data.customerId,
        customerName: data.customerName || 'Unknown Customer',
        salesmanId: data.salesmanId,
        salesmanName: data.salesmanName || 'Unknown Salesman',
        workerId: data.workerId || undefined,
        workerName: data.workerName || undefined,
        items: data.items || [],
        totalAmount: data.totalAmount || 0,
        totalCost: data.totalCost || 0,
        totalProfit: data.totalProfit || 0,
        status: data.status || 'Pending',
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        deliveredAmount: data.deliveredAmount || 0,
        deliveredProfit: data.deliveredProfit || 0,
      } as Order;
    });

    orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    console.log(`✅ Found ${orders.length} orders for salesman`);
    return orders;
  } catch (error: any) {
    console.error('❌ Error fetching orders by salesman:', error);
    throw new Error('Failed to fetch orders');
  }
};

/**
 * Get orders for a specific customer (sorted by createdAt desc).
 */
export const getOrdersByCustomer = async (customerId: string): Promise<Order[]> => {
  try {
    const q = query(
      collection(firestore, COLLECTIONS.ORDERS),
      where('customerId', '==', customerId)
    );

    const querySnapshot = await getDocs(q);
    const orders = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate(),
    })) as Order[];

    orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return orders;
  } catch (error: any) {
    console.error('Error fetching customer orders:', error);
    throw new Error('Failed to fetch orders');
  }
};

/**
 * Get all orders in the system (sorted by createdAt desc).
 */
export const getAllOrders = async (): Promise<Order[]> => {
  try {
    console.log('📦 Fetching all orders...');

    const q = query(collection(firestore, COLLECTIONS.ORDERS));
    const querySnapshot = await getDocs(q);
    const orders = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Order;
    });

    orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    console.log(`✅ Found ${orders.length} total orders`);
    return orders;
  } catch (error: any) {
    console.error('❌ Error fetching all orders:', error);
    throw new Error('Failed to fetch orders');
  }
};
/**
 * Get orders for a specific worker (sorted by createdAt desc).
 */
export const getOrdersByWorker = async (workerId: string): Promise<Order[]> => {
  try {
    console.log('📦 Fetching orders for worker:', workerId);

    const q = query(
      collection(firestore, COLLECTIONS.ORDERS),
      where('workerId', '==', workerId)
    );

    const querySnapshot = await getDocs(q);
    const orders = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        customerId: data.customerId,
        customerName: data.customerName || 'Unknown Customer',
        salesmanId: data.salesmanId,
        salesmanName: data.salesmanName || 'Unknown Salesman',
        workerId: data.workerId,
        workerName: data.workerName || 'Unknown Worker',
        items: data.items || [],
        totalAmount: data.totalAmount || 0,
        totalCost: data.totalCost || 0,
        totalProfit: data.totalProfit || 0,
        status: data.status || 'Pending',
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        deliveredAmount: data.deliveredAmount || 0,
        deliveredProfit: data.deliveredProfit || 0,
      } as Order;
    });

    orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    console.log(`✅ Found ${orders.length} orders for worker`);
    return orders;
  } catch (error: any) {
    console.error('❌ Error fetching orders by worker:', error);
    throw new Error('Failed to fetch orders for worker');
  }
};

/**
 * Update an order's status and update the updatedAt timestamp.
 */
export const updateOrderStatus = async (orderId: string, status: Order['status']): Promise<void> => {
  try {
    await updateDoc(doc(firestore, COLLECTIONS.ORDERS, orderId), {
      status,
      updatedAt: Timestamp.now(),
    });
  } catch (error: any) {
    throw new Error('Failed to update order status');
  }
};

/**
 * Get orders filtered by status (requires an index for the orderBy/where combination).
 */
export const getOrdersByStatus = async (status: Order['status']): Promise<Order[]> => {
  try {
    const q = query(
      collection(firestore, COLLECTIONS.ORDERS),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate(),
    })) as Order[];
  } catch (error: any) {
    throw new Error('Failed to fetch orders by status');
  }
};

// -----------------------------
// Customers & Users
// -----------------------------
export const getCustomersBySalesman = async (salesmanId: string): Promise<UserData[]> => {
  try {
    const q = query(
      collection(firestore, COLLECTIONS.USERS),
      where('role', '==', 'customer'),
      where('salesmanId', '==', salesmanId)
    );
    
    const querySnapshot = await getDocs(q);
    const customers: UserData[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      customers.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as UserData);
    });
    
    return customers;
  } catch (error) {
    console.error('Error fetching customers by salesman:', error);
    throw error;
  }
};

export const getWorkersBySalesman = async (salesmanId: string): Promise<UserData[]> => {
  try {
    const q = query(
      collection(firestore, COLLECTIONS.USERS),
      where('role', '==', 'worker'),
      where('salesmanId', '==', salesmanId)
    );
    
    const querySnapshot = await getDocs(q);
    const customers: UserData[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      customers.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as UserData);
    });
    
    return customers;
  } catch (error) {
    console.error('Error fetching workers by salesman:', error);
    throw error;
  }
};
/**
 * Return approved customers by filtering users collection locally.
 * Requires an authenticated user to be present in `getAuth().currentUser`.
 */
export const getCustomers = async (): Promise<any[]> => {
  try {
    console.log('👥 Fetching customers...');

    const auth = getAuth();
    if (!auth.currentUser) {
      console.log('❌ No authenticated user');
      throw new Error('User not authenticated');
    }

    const querySnapshot = await getDocs(collection(firestore, COLLECTIONS.USERS));

    const customers = querySnapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unknown Customer',
          email: data.email || 'No email',
          phone: data.phone || 'No phone',
          role: data.role || 'customer',
          approved: data.approved !== undefined ? data.approved : false,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      })
      .filter(user => user.role === 'customer' && user.approved === true);

    console.log(`✅ Found ${customers.length} approved customers`);
    return customers;
  } catch (error: any) {
    console.error('❌ Error fetching customers:', error);

    if (error.code === 'permission-denied') {
      console.log('🔐 Permission denied - check Firestore rules');
      throw new Error('Permission denied. Please check Firestore security rules.');
    }

    throw new Error('Failed to fetch customers');
  }
};

/**
 * Get a single user document by id.
 */
export const getUser = async (userId: string): Promise<any> => {
  try {
    const docSnap = await getDoc(doc(firestore, COLLECTIONS.USERS, userId));
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      };
    }
    return null;
  } catch (error: any) {
    throw new Error('Failed to fetch user');
  }
};

/**
 * Fetch all users (requires authenticated current user).
 */
export const getUsers = async (): Promise<UserData[]> => {
  try {
    console.log('👤 Fetching all users...');

    const auth = getAuth();
    if (!auth.currentUser) {
      console.log('❌ No authenticated user');
      return [];
    }

    const querySnapshot = await getDocs(collection(firestore, COLLECTIONS.USERS));
    const users = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid || doc.id,
        name: data.name || 'Unknown User',
        email: data.email || 'No email',
        phone: data.phone || 'No phone',
        role: data.role || 'customer',
        approved: data.approved !== undefined ? data.approved : true,
        totalSales: data.totalSales || 0,
        totalDiscountGiven: data.totalDiscountGiven || 0,
        totalProfitGenerated: data.totalProfitGenerated || 0,
        maxDiscountPercent: data.maxDiscountPercent || 0,
        createdAt: data.createdAt?.toDate() || new Date(),
        city: data.city || '',
        salesmanId: data.salesmanId || '',
      } as UserData;
    });

    console.log(`✅ Found ${users.length} total users`);
    return users;
  } catch (error: any) {
    console.error('❌ Error fetching users:', error);

    if (error.code === 'permission-denied') {
      console.log('🔐 Permission denied for users collection');
      return [];
    }

    throw new Error('Failed to fetch users');
  }
};

/**
 * Update a user document with provided partial fields.
 */
export const updateUser = async (userId: string, updates: Partial<UserData>): Promise<void> => {
  try {
    await updateDoc(doc(firestore, COLLECTIONS.USERS, userId), updates);
    console.log('✅ User updated successfully:', userId, updates);
  } catch (error: any) {
    console.error('❌ Error updating user:', error);
    throw new Error('Failed to update user');
  }
};

/**
 * Delete user Firestore document (does not delete auth user).
 */
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    await deleteDoc(doc(firestore, COLLECTIONS.USERS, userId));
    console.log('✅ User document deleted:', userId);
  } catch (error: any) {
    console.error('❌ Error deleting user:', error);
    throw new Error('Failed to delete user');
  }
};

/**
 * Approve a user (set approved=true).
 */
export const approveUser = async (userId: string): Promise<void> => {
  try {
    await updateDoc(doc(firestore, COLLECTIONS.USERS, userId), {
      approved: true,
    });
    console.log('✅ User approved:', userId);
  } catch (error: any) {
    console.error('❌ Error approving user:', error);
    throw new Error('Failed to approve user');
  }
};

/**
 * Revoke user approval (set approved=false).
 */
export const revokeUserApproval = async (userId: string): Promise<void> => {
  try {
    await updateDoc(doc(firestore, COLLECTIONS.USERS, userId), {
      approved: false,
    });
    console.log('✅ User approval revoked:', userId);
  } catch (error: any) {
    console.error('❌ Error revoking user approval:', error);
    throw new Error('Failed to revoke user approval');
  }
};

/**
 * Change a user's role and apply sensible defaults for some roles.
 */
export const changeUserRole = async (userId: string, newRole: 'admin' | 'salesman' | 'customer'): Promise<void> => {
  try {
    const updates: Partial<UserData> = {
      role: newRole,
    };

    if (newRole === 'salesman') {
      updates.maxDiscountPercent = 10; // Default 10% discount
    }

    if (newRole === 'admin') {
      updates.approved = true;
    }

    await updateDoc(doc(firestore, COLLECTIONS.USERS, userId), updates);
    console.log('✅ User role changed:', userId, newRole);
  } catch (error: any) {
    console.error('❌ Error changing user role:', error);
    throw new Error('Failed to change user role');
  }
};

// -----------------------------
// Attendance
// -----------------------------

/**
 * Fetch attendance entries for a salesman, normalize dates, and group entries by date.
 * Returns grouped records with aggregated totalHours, earliest login and latest logout per date.
 */
export const getAttendance = async (salesmanId: string): Promise<any[]> => {
  try {
    console.log('📅 Fetching attendance for salesman:', salesmanId);

    const q = query(
      collection(firestore, COLLECTIONS.ATTENDANCE),
      where('salesmanId', '==', salesmanId)
    );

    const querySnapshot = await getDocs(q);

    const toJSDate = (val: any): Date | null => {
      if (!val) return null;
      if (typeof val?.toDate === 'function') return val.toDate();
      if (val instanceof Date) return val;
      if (typeof val === 'string') {
        const d = new Date(`${val}T00:00:00`);
        return isNaN(d.getTime()) ? null : d;
      }
      if (typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      }
      return null;
    };

    const allRecords = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();

      const normalizedDate = toJSDate(data.date ?? data.loginTime ?? docSnap.id) || new Date();
      const loginTime = toJSDate(data.loginTime);
      const logoutTime = toJSDate(data.logoutTime);
      const totalHours = typeof data.totalHours === 'number' ? data.totalHours : 0;

      return {
        id: docSnap.id,
        date: normalizedDate,
        loginTime,
        logoutTime,
        totalHours,
        salesmanId: data.salesmanId,
      };
    });

    // Group by date
    const grouped: Record<string, any> = {};

    for (const rec of allRecords) {
      if (!rec.date) continue;
      const dateKey = rec.date.toISOString().split('T')[0];

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: rec.date,
          totalHours: rec.totalHours || 0,
          loginTime: rec.loginTime,
          logoutTime: rec.logoutTime,
          salesmanId: rec.salesmanId,
          entries: [rec],
        };
      } else {
        grouped[dateKey].totalHours += rec.totalHours || 0;

        if (
          rec.loginTime &&
          (!grouped[dateKey].loginTime || rec.loginTime.getTime() < grouped[dateKey].loginTime.getTime())
        ) {
          grouped[dateKey].loginTime = rec.loginTime;
        }

        if (
          rec.logoutTime &&
          (!grouped[dateKey].logoutTime || rec.logoutTime.getTime() > grouped[dateKey].logoutTime.getTime())
        ) {
          grouped[dateKey].logoutTime = rec.logoutTime;
        }

        grouped[dateKey].entries.push(rec);
      }
    }

    const groupedArray = Object.keys(grouped).map(dateKey => ({
      id: dateKey,
      date: grouped[dateKey].date,
      totalHours: grouped[dateKey].totalHours,
      loginTime: grouped[dateKey].loginTime,
      logoutTime: grouped[dateKey].logoutTime,
      salesmanId: grouped[dateKey].salesmanId,
    }));

    groupedArray.sort((a, b) => b.date.getTime() - a.date.getTime());

    console.log(`✅ Found ${groupedArray.length} grouped attendance records`);
    return groupedArray;
  } catch (error: any) {
    console.error('❌ Error fetching attendance:', error);
    return [];
  }
};

// -----------------------------
// Sales Reports
// -----------------------------

/**
 * Fetch sales reports ordered by generatedAt desc.
 */
export const getSalesReports = async (): Promise<any[]> => {
  try {
    const q = query(
      collection(firestore, COLLECTIONS.SALES_REPORTS),
      orderBy('generatedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      generatedAt: doc.data().generatedAt?.toDate(),
    }));
  } catch (error: any) {
    throw new Error('Failed to fetch sales reports');
  }
};

// -----------------------------
// Salesman stats & Discount validation
// -----------------------------

/**
 * Update aggregated salesman statistics (total sales, discounts, profit).
 */
export const updateSalesmanStats = async (
  salesmanId: string,
  salesIncrease: number,
  discountGiven: number,
  profitGenerated: number
): Promise<void> => {
  try {
    const userDoc = doc(firestore, COLLECTIONS.USERS, salesmanId);
    const userData = await getUser(salesmanId);

    if (!userData) {
      throw new Error('Salesman not found');
    }

    await updateDoc(userDoc, {
      totalSales: (userData.totalSales || 0) + salesIncrease,
      totalDiscountGiven: (userData.totalDiscountGiven || 0) + discountGiven,
      totalProfitGenerated: (userData.totalProfitGenerated || 0) + profitGenerated,
    });
  } catch (error: any) {
    throw new Error('Failed to update salesman stats');
  }
};

/**
 * Validate that a requested discount percentage is within the salesperson's allowed max.
 */
export const validateDiscount = async (
  salesmanId: string,
  discountPercent: number
): Promise<{ isValid: boolean; maxAllowed: number; message?: string }> => {
  try {
    const userData = await getUser(salesmanId);

    if (!userData) {
      return { isValid: false, maxAllowed: 0, message: 'User not found' };
    }

    const maxDiscount = userData.maxDiscountPercent || 0;

    if (discountPercent > maxDiscount) {
      return {
        isValid: false,
        maxAllowed: maxDiscount,
        message: `Discount cannot exceed ${maxDiscount}%`,
      };
    }

    return { isValid: true, maxAllowed: maxDiscount };
  } catch (error: any) {
    return { isValid: false, maxAllowed: 0, message: 'Error validating discount' };
  }
};
