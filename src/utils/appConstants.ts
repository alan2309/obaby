export const APP_CONFIG = {
  NAME: 'Business Manager',
  VERSION: '1.0.0',
  SUPPORT_EMAIL: 'support@businessmanager.com',
  COMPANY_NAME: 'Business Manager Inc.',
};

export const FEATURE_FLAGS = {
  OFFLINE_MODE: true,
  PUSH_NOTIFICATIONS: false, // Enable when ready
  ADVANCED_ANALYTICS: true,
  MULTI_LANGUAGE: false,
};

export const PERFORMANCE_CONFIG = {
  DEBOUNCE_DELAY: 300,
  CACHE_DURATION: 60, // minutes
  MAX_IMAGE_SIZE: 1024, // pixels
  BATCH_SIZE: 50,
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Please check your internet connection and try again.',
  AUTH_ERROR: 'Authentication failed. Please log in again.',
  PERMISSION_ERROR: 'You don\'t have permission to perform this action.',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
};