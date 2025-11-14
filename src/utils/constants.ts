import { Dimensions, Platform, PixelRatio } from 'react-native';
import { DefaultTheme } from 'react-native-paper';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive sizing
export const scaleFont = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export const scaleSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

export const isTablet = SCREEN_WIDTH >= 768;
export const isSmallDevice = SCREEN_WIDTH < 375;

// Platform-specific adjustments
export const platformStyle = {
  padding: Platform.select({ ios: 16, android: 16, web: 24 }),
  margin: Platform.select({ ios: 8, android: 8, web: 16 }),
  cardMargin: Platform.select<number | string>({ ios: 16, android: 16, web: 'auto' }),
};

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#F7CAC9',
    accent: '#E6C76E',
    background: '#F5EDE0',
    surface: '#FAF9F6',
    text: '#3B3B3B',
    placeholder: '#A08B73',
  },
  roundness: scaleSize(8),
};

export const COLLECTIONS = {
  USERS: 'users',
  PRODUCTS: 'products',
  ORDERS: 'orders',
  NOTIFICATIONS: 'notifications',
  ATTENDANCE: 'attendance',
  SALES_REPORTS: 'salesReports',
} as const;

export const ORDER_STATUS = {
  PENDING: 'Pending',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
} as const;

export const USER_ROLES = {
  ADMIN: 'admin',
  SALESMAN: 'salesman',
  CUSTOMER: 'customer',
} as const;