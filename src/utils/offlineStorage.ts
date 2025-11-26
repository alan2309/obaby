import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_KEYS = {
  PRODUCTS: 'offline_products',
  ORDERS: 'offline_orders',
  USER_DATA: 'offline_user_data',
  LAST_SYNC: 'last_sync_time',
};

export const saveOfflineData = async (key: string, data: any) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({
      data,
      timestamp: new Date().toISOString(),
    }));
    console.log(`✅ Offline data saved: ${key}`);
  } catch (error) {
    console.error(`❌ Error saving offline data (${key}):`, error);
  }
};

export const getOfflineData = async (key: string) => {
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const { data, timestamp } = JSON.parse(stored);
      console.log(`📦 Loaded offline data: ${key} from ${timestamp}`);
      return data;
    }
  } catch (error) {
    console.error(`❌ Error loading offline data (${key}):`, error);
  }
  return null;
};

export const clearOfflineData = async (key: string) => {
  try {
    await AsyncStorage.removeItem(key);
    console.log(`🧹 Cleared offline data: ${key}`);
  } catch (error) {
    console.error(`❌ Error clearing offline data (${key}):`, error);
  }
};

// Specific offline functions for app data
export const saveProductsOffline = (products: any[]) => 
  saveOfflineData(OFFLINE_KEYS.PRODUCTS, products);

export const getProductsOffline = () => 
  getOfflineData(OFFLINE_KEYS.PRODUCTS);

export const saveOrdersOffline = (orders: any[]) => 
  saveOfflineData(OFFLINE_KEYS.ORDERS, orders);

export const getOrdersOffline = () => 
  getOfflineData(OFFLINE_KEYS.ORDERS);

export const isDataStale = async (maxAgeMinutes: number = 60): Promise<boolean> => {
  try {
    const lastSync = await AsyncStorage.getItem(OFFLINE_KEYS.LAST_SYNC);
    if (!lastSync) return true;

    const lastSyncTime = new Date(lastSync).getTime();
    const currentTime = new Date().getTime();
    const minutesSinceSync = (currentTime - lastSyncTime) / (1000 * 60);

    return minutesSinceSync > maxAgeMinutes;
  } catch (error) {
    return true;
  }
};

export const updateLastSyncTime = async () => {
  try {
    await AsyncStorage.setItem(OFFLINE_KEYS.LAST_SYNC, new Date().toISOString());
  } catch (error) {
    console.error('Error updating last sync time:', error);
  }
};