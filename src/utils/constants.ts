// src/utils/constants.ts
import { Dimensions, Platform, PixelRatio } from 'react-native';
import { DefaultTheme } from 'react-native-paper';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Enhanced screen size detection with better breakpoints
export const getScreenSize = () => {
  // Use the smaller dimension to handle both portrait and landscape
  const minDimension = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT);
  
  if (minDimension >= 1200) return 'xlarge'; // Large tablets/desktop
  if (minDimension >= 768) return 'large';   // Tablets/small laptops
  if (minDimension >= 480) return 'medium';  // Large phones
  if (minDimension >= 375) return 'small';   // Medium phones
  return 'xsmall';                           // Small phones
};

export const screenSize = getScreenSize();

// Better scaling function with maximum limits
export const scaleFont = (size: number) => {
  const scaleFactors = {
    xsmall: 0.8,
    small: 0.9,
    medium: 1,
    large: 0.9,    // Scale down on larger screens
    xlarge: 0.8,   // Scale down even more on very large screens
  };
  
  const baseSize = size * scaleFactors[screenSize];
  
  // Use a more conservative scaling approach
  const scale = Math.min(SCREEN_WIDTH / 375, 1.5); // Max scale factor of 1.5
  const newSize = baseSize * scale;
  
  return Math.round(PixelRatio.roundToNearestPixel(Math.min(newSize, size * 2))); // Max 2x original size
};

export const scaleSize = (size: number) => {
  const scaleFactors = {
    xsmall: 0.8,
    small: 0.9,
    medium: 1,
    large: 0.9,    // Scale down on larger screens
    xlarge: 0.8,   // Scale down even more on very large screens
  };
  
  const baseSize = size * scaleFactors[screenSize];
  
  // Conservative scaling for larger screens
  const scale = Math.min(SCREEN_WIDTH / 375, 1.5);
  return Math.round(PixelRatio.roundToNearestPixel(Math.min(baseSize * scale, size * 2)));
};

// Enhanced responsive value helper
export const responsiveValue = <T>(values: {
  xsmall?: T;
  small?: T;
  medium?: T;
  large?: T;
  xlarge?: T;
  default: T;
}): T => {
  return values[screenSize] || values.default;
};

// Better image sizing for different screen sizes
export const getProductImageSize = () => {
  return responsiveValue({
    xsmall: SCREEN_WIDTH * 0.8,
    small: SCREEN_WIDTH * 0.8,
    medium: SCREEN_WIDTH * 0.7,
    large: Math.min(SCREEN_WIDTH * 0.6, 400), // Max 400px on tablets
    xlarge: Math.min(SCREEN_WIDTH * 0.5, 500), // Max 500px on large screens
    default: SCREEN_WIDTH * 0.7
  });
};

// Better padding and margins for large screens
export const getResponsivePadding = () => {
  return responsiveValue({
    xsmall: scaleSize(12),
    small: scaleSize(16),
    medium: scaleSize(20),
    large: scaleSize(24),
    xlarge: scaleSize(28),
    default: scaleSize(16),
  });
};

export const getResponsiveMargin = () => {
  return responsiveValue({
    xsmall: scaleSize(8),
    small: scaleSize(12),
    medium: scaleSize(16),
    large: scaleSize(20),
    xlarge: scaleSize(24),
    default: scaleSize(16),
  });
};

// Max width container for large screens
export const getMaxContainerWidth = () => {
  return responsiveValue({
    xsmall: SCREEN_WIDTH,
    small: SCREEN_WIDTH,
    medium: SCREEN_WIDTH,
    large: 768, // Fixed max width for tablets
    xlarge: 1024, // Fixed max width for desktop
    default: SCREEN_WIDTH
  });
};

export const isExtraLargeScreen = screenSize === 'xlarge';
export const isLargeScreen = screenSize === 'large' || isExtraLargeScreen;
export const isMediumScreen = screenSize === 'medium' || isLargeScreen;
export const isSmallScreen = screenSize === 'small' || isMediumScreen;

export const getGridColumns = () => {
  switch (screenSize) {
    case 'xlarge': return 4;
    case 'large': return 3;
    case 'medium': return 2;
    case 'small': return 2;
    case 'xsmall': return 1;
    default: return 2;
  }
};

// Platform-specific adjustments with screen size consideration
export const platformStyle = {
  padding: Platform.select({ 
    ios: scaleSize(16), 
    android: scaleSize(16), 
    web: scaleSize(24) 
  }),
  margin: Platform.select({ 
    ios: scaleSize(8), 
    android: scaleSize(8), 
    web: scaleSize(16) 
  }),
  cardMargin: scaleSize(16),
  sectionMargin: scaleSize(24),
  screenPadding: scaleSize(20),
};

// Screen size specific configurations
export const screenConfig = {
  xlarge: {
    productCard: {
      minWidth: 280,
      imageHeight: 200,
    },
    modal: {
      width: SCREEN_WIDTH * 0.6,
      maxWidth: 600,
    },
  },
  large: {
    productCard: {
      minWidth: 240,
      imageHeight: 180,
    },
    modal: {
      width: SCREEN_WIDTH * 0.7,
      maxWidth: 500,
    },
  },
  medium: {
    productCard: {
      minWidth: 200,
      imageHeight: 160,
    },
    modal: {
      width: SCREEN_WIDTH * 0.8,
      maxWidth: 400,
    },
  },
  small: {
    productCard: {
      minWidth: 160,
      imageHeight: 140,
    },
    modal: {
      width: SCREEN_WIDTH * 0.9,
      maxWidth: 350,
    },
  },
  xsmall: {
    productCard: {
      minWidth: 140,
      imageHeight: 120,
    },
    modal: {
      width: SCREEN_WIDTH * 0.95,
      maxWidth: 320,
    },
  },
};
export const isTablet = screenSize === 'large' || screenSize === 'xlarge';
export const isSmallDevice = screenSize === 'xsmall' || screenSize === 'small';

// Get current screen config
export const currentScreenConfig = screenConfig[screenSize];

// Collection constants
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
  DELIVERED: 'Delivered',
} as const;

export const USER_ROLES = {
  ADMIN: 'admin',
  SALESMAN: 'salesman',
  CUSTOMER: 'customer',
  WORKER: 'worker',
} as const;

export const getCardWidth = (containerPadding: number = 32, gap: number = 16) => {
  const columns = getGridColumns();
  const availableWidth = SCREEN_WIDTH - containerPadding - (gap * (columns - 1));
  return availableWidth / columns;
};

export const getImageHeight = (aspectRatio: number = 1) => {
  const baseHeight = SCREEN_HEIGHT * 0.3;
  const maxHeight = SCREEN_HEIGHT * 0.6;
  const calculatedHeight = baseHeight * aspectRatio;
  return Math.min(calculatedHeight, maxHeight);
};

// Enhanced theme with better large screen handling
export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#f7aaa9ff',
    accent: '#E6C76E',
    background: '#F5EDE0',
    surface: '#FAF9F6',
    text: '#3B3B3B',
    placeholder: '#A08B73',
    error: '#FF5252',
    success: '#4CAF50',
    warning: '#FF9800',
    info: '#2196F3',
  },
  roundness: scaleSize(8),
  spacing: {
    xs: scaleSize(4),
    sm: scaleSize(8),
    md: scaleSize(16),
    lg: scaleSize(24),
    xl: scaleSize(32),
    xxl: scaleSize(48),
  },
  typography: {
    displayLarge: {
      fontSize: scaleFont(32),
      fontWeight: 'bold' as const,
    },
    displayMedium: {
      fontSize: scaleFont(28),
      fontWeight: 'bold' as const,
    },
    displaySmall: {
      fontSize: scaleFont(24),
      fontWeight: 'bold' as const,
    },
    headlineLarge: {
      fontSize: scaleFont(20),
      fontWeight: '600' as const,
    },
    headlineMedium: {
      fontSize: scaleFont(18),
      fontWeight: '600' as const,
    },
    headlineSmall: {
      fontSize: scaleFont(16),
      fontWeight: '600' as const,
    },
    bodyLarge: {
      fontSize: scaleFont(16),
    },
    bodyMedium: {
      fontSize: scaleFont(14),
    },
    bodySmall: {
      fontSize: scaleFont(12),
    },
    labelLarge: {
      fontSize: scaleFont(14),
      fontWeight: '500' as const,
    },
    labelMedium: {
      fontSize: scaleFont(12),
      fontWeight: '500' as const,
    },
    labelSmall: {
      fontSize: scaleFont(10),
      fontWeight: '500' as const,
    },
  },
};

// Export screen dimensions for easy access
export { SCREEN_WIDTH, SCREEN_HEIGHT };