// src\firebase\firestore.ts
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

export interface ProductVariant {
  size: string;
  color: string;
  stock: number;
}

export interface Product {
  id?: string;
  title: string;
  description: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  images: string[];
  sizes: ProductVariant[];
  active: boolean;
  createdAt: Date;
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
}

export interface Order {
  id?: string;
  customerId: string;
  salesmanId: string;
  items: OrderItem[];
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  status: 'Pending' | 'Packed' | 'Shipped' | 'Delivered';
  createdAt: Date;
  updatedAt: Date;
}

// Product CRUD Operations
export const addProduct = async (product: Omit<Product, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(firestore, COLLECTIONS.PRODUCTS), {
      ...product,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    throw new Error('Failed to add product');
  }
};

export const updateProduct = async (productId: string, product: Partial<Product>): Promise<void> => {
  try {
    await updateDoc(doc(firestore, COLLECTIONS.PRODUCTS, productId), product);
  } catch (error) {
    throw new Error('Failed to update product');
  }
};

export const deleteProduct = async (productId: string): Promise<void> => {
  try {
    await updateDoc(doc(firestore, COLLECTIONS.PRODUCTS, productId), {
      active: false,
    });
  } catch (error) {
    throw new Error('Failed to delete product');
  }
};

// Update getProducts in firestore.ts
export const getProducts = async (includeInactive = false): Promise<Product[]> => {
  try {
    console.log('🔄 Fetching products from Firestore...');
    
    // Try to get fresh data first
    const querySnapshot = await getDocs(collection(firestore, COLLECTIONS.PRODUCTS));
    let productsData = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'No Title',
        description: data.description || '',
        category: data.category || 'Uncategorized',
        costPrice: data.costPrice || 0,
        sellingPrice: data.sellingPrice || 0,
        images: data.images || [],
        sizes: data.sizes || [],
        active: data.active !== undefined ? data.active : true,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Product;
    });

    // Filter active products if needed
    if (!includeInactive) {
      productsData = productsData.filter(product => product.active);
    }

    // Sort manually
    productsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Save to offline storage
    await saveProductsOffline(productsData);
    await updateLastSyncTime();

    console.log(`✅ Loaded ${productsData.length} products from Firestore`);
    return productsData;
  } catch (error: any) {
    console.error('❌ Firestore error, trying offline data:', error);
    
    // Fallback to offline data
    const offlineProducts = await getProductsOffline();
    if (offlineProducts) {
      console.log(`📦 Using ${offlineProducts.length} offline products`);
      return offlineProducts;
    }
    
    throw new Error('Failed to fetch products and no offline data available');
  }
};

export const getProduct = async (productId: string): Promise<Product | null> => {
  try {
    const docSnap = await getDoc(doc(firestore, COLLECTIONS.PRODUCTS, productId));
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt.toDate(),
      } as Product;
    }
    return null;
  } catch (error) {
    throw new Error('Failed to fetch product');
  }
};

// Image Upload
export const uploadProductImage = async (imageUri: string, productId: string): Promise<string> => {
  try {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    const imageRef = ref(storage, `products/${productId}/${Date.now()}.jpg`);
    await uploadBytes(imageRef, blob);
    
    return await getDownloadURL(imageRef);
  } catch (error) {
    throw new Error('Failed to upload image');
  }
};

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

export const checkStockAvailability = async (
  productId: string, 
  size: string, 
  color: string, 
  quantity: number
): Promise<boolean> => {
  try {
    const product = await getProduct(productId);
    if (!product) return false;

    const variant = product.sizes.find(v => 
      v.size === size && v.color === color
    );

    return variant ? variant.stock >= quantity : false;
  } catch (error) {
    return false;
  }
};

export const getLowStockProducts = async (threshold = 10): Promise<Product[]> => {
  try {
    const products = await getProducts(true);
    return products.filter(product =>
      product.sizes.some(variant => variant.stock <= threshold && variant.stock > 0)
    );
  } catch (error) {
    throw new Error('Failed to fetch low stock products');
  }
};

export const getOutOfStockProducts = async (): Promise<Product[]> => {
  try {
    const products = await getProducts(true);
    return products.filter(product =>
      product.sizes.every(variant => variant.stock === 0)
    );
  } catch (error) {
    throw new Error('Failed to fetch out of stock products');
  }
};

// Update the createOrder function in firestore.ts
export const createOrder = async (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    // Validate discounts for each item
    for (const item of order.items) {
      if (item.discountGiven > 0) {
        const discountPercent = (item.discountGiven / item.sellingPrice) * 100;
        const discountValidation = await validateDiscount(order.salesmanId, discountPercent);
        
        if (!discountValidation.isValid) {
          throw new Error(`Discount validation failed for ${item.productName}: ${discountValidation.message}`);
        }
      }
    }

    // Validate stock before creating order
    for (const item of order.items) {
      const hasStock = await checkStockAvailability(item.productId, item.size, item.color, item.quantity);
      if (!hasStock) {
        throw new Error(`Insufficient stock for ${item.productName} (${item.size}, ${item.color})`);
      }
    }

    const docRef = await addDoc(collection(firestore, COLLECTIONS.ORDERS), {
      ...order,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Update stock after successful order creation
    for (const item of order.items) {
      await updateProductStock(item.productId, item.size, item.color, item.quantity);
    }

    // Update salesman stats
    const totalDiscount = order.items.reduce((sum, item) => sum + (item.discountGiven * item.quantity), 0);
    await updateSalesmanStats(
      order.salesmanId,
      order.totalAmount,
      totalDiscount,
      order.totalProfit
    );

    return docRef.id;
  } catch (error: any) {
    throw new Error(`Failed to create order: ${error.message}`);
  }
};

export const getOrdersBySalesman = async (salesmanId: string): Promise<Order[]> => {
  try {
    console.log('📦 Fetching orders for salesman:', salesmanId);
    
    // Simple query without composite index
    const q = query(
      collection(firestore, COLLECTIONS.ORDERS),
      where('salesmanId', '==', salesmanId)
      // Removed orderBy to avoid composite index requirement
    );
    
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
    
    // Sort manually in JavaScript
    orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    console.log(`✅ Found ${orders.length} orders for salesman`);
    return orders;
  } catch (error: any) {
    console.error('❌ Error fetching orders by salesman:', error);
    throw new Error('Failed to fetch orders');
  }
};

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
    
    // Manual sorting
    orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return orders;
  } catch (error: any) {
    console.error('Error fetching customer orders:', error);
    throw new Error('Failed to fetch orders');
  }
};

export const getAllOrders = async (): Promise<Order[]> => {
  try {
    console.log('📦 Fetching all orders...');
    
    // Simple query without ordering
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
    
    // Sort manually in JavaScript
    orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    console.log(`✅ Found ${orders.length} total orders`);
    return orders;
  } catch (error: any) {
    console.error('❌ Error fetching all orders:', error);
    throw new Error('Failed to fetch orders');
  }
};

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

// Customer management
export const getCustomers = async (): Promise<any[]> => {
  try {
    console.log('👥 Fetching customers...');
    
    // First check if user is authenticated
    const auth = getAuth();
    if (!auth.currentUser) {
      console.log('❌ No authenticated user');
      throw new Error('User not authenticated');
    }
    
    // Get all users and filter in JavaScript
    const querySnapshot = await getDocs(collection(firestore, COLLECTIONS.USERS));
    
    const customers = querySnapshot.docs
      .map(doc => {
        const data = doc.data();
        // Safe data access with fallbacks
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
    
    // Check if it's a permission error
    if (error.code === 'permission-denied') {
      console.log('🔐 Permission denied - check Firestore rules');
      throw new Error('Permission denied. Please check Firestore security rules.');
    }
    
    throw new Error('Failed to fetch customers');
  }
};

// User management functions
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

// Discount validation function
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
        message: `Discount cannot exceed ${maxDiscount}%` 
      };
    }
    
    return { isValid: true, maxAllowed: maxDiscount };
  } catch (error: any) {
    return { isValid: false, maxAllowed: 0, message: 'Error validating discount' };
  }
};

// Add these functions to your existing firestore.ts

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
export const updateUser = async (userId: string, updates: Partial<UserData>): Promise<void> => {
  try {
    await updateDoc(doc(firestore, COLLECTIONS.USERS, userId), updates);
    console.log('✅ User updated successfully:', userId, updates);
  } catch (error: any) {
    console.error('❌ Error updating user:', error);
    throw new Error('Failed to update user');
  }
};

export const deleteUser = async (userId: string): Promise<void> => {
  try {
    // Delete the user document from Firestore
    await deleteDoc(doc(firestore, COLLECTIONS.USERS, userId));
    console.log('✅ User document deleted:', userId);
    
    // Note: To delete the auth user, you'll need Cloud Functions
    // This only deletes the Firestore document
  } catch (error: any) {
    console.error('❌ Error deleting user:', error);
    throw new Error('Failed to delete user');
  }
};

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

export const changeUserRole = async (userId: string, newRole: 'admin' | 'salesman' | 'customer'): Promise<void> => {
  try {
    const updates: Partial<UserData> = {
      role: newRole,
    };
    
    // If making someone a salesman, set default max discount if not exists
    if (newRole === 'salesman') {
      updates.maxDiscountPercent = 10; // Default 10% discount
    }
    
    // If approving an admin, automatically approve them
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

// Add these functions to your existing firestore.ts

// Replace the getAttendance function with this:
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

    // Normalize and map all records
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

    // --- 🧮 GROUP BY DATE (combine entries on same date) ---
    const grouped: Record<string, any> = {};

    for (const rec of allRecords) {
      if (!rec.date) continue;
      const dateKey = rec.date.toISOString().split('T')[0]; // e.g., "2025-11-09"

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: rec.date,
          totalHours: rec.totalHours || 0,
          loginTime: rec.loginTime,
          logoutTime: rec.logoutTime,
          salesmanId: rec.salesmanId,
          entries: [rec], // optional if you want to inspect merged ones
        };
      } else {
        // Combine hours
        grouped[dateKey].totalHours += rec.totalHours || 0;

        // Keep earliest login
        if (
          rec.loginTime &&
          (!grouped[dateKey].loginTime ||
            rec.loginTime.getTime() < grouped[dateKey].loginTime.getTime())
        ) {
          grouped[dateKey].loginTime = rec.loginTime;
        }

        // Keep latest logout
        if (
          rec.logoutTime &&
          (!grouped[dateKey].logoutTime ||
            rec.logoutTime.getTime() > grouped[dateKey].logoutTime.getTime())
        ) {
          grouped[dateKey].logoutTime = rec.logoutTime;
        }

        grouped[dateKey].entries.push(rec);
      }
    }

    // Convert grouped data to an array
    const groupedArray = Object.keys(grouped).map(dateKey => ({
      id: dateKey,
      date: grouped[dateKey].date,
      totalHours: grouped[dateKey].totalHours,
      loginTime: grouped[dateKey].loginTime,
      logoutTime: grouped[dateKey].logoutTime,
      salesmanId: grouped[dateKey].salesmanId,
    }));

    // Sort by date descending
    groupedArray.sort((a, b) => b.date.getTime() - a.date.getTime());

    console.log(`✅ Found ${groupedArray.length} grouped attendance records`);
    return groupedArray;
  } catch (error: any) {
    console.error('❌ Error fetching attendance:', error);
    return [];
  }
};


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

