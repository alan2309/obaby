import React from 'react';
import { Text } from 'react-native-paper';
import { scaleFont, isTablet } from '../utils/constants';

interface ResponsiveTextProps {
  variant?: 'headline' | 'title' | 'body' | 'caption';
  children: React.ReactNode;
  style?: any;
}

const variantSizes = {
  headline: scaleFont(isTablet ? 28 : 24),
  title: scaleFont(isTablet ? 20 : 18),
  body: scaleFont(isTablet ? 16 : 14),
  caption: scaleFont(isTablet ? 14 : 12),
};

export const ResponsiveText: React.FC<ResponsiveTextProps> = ({
  variant = 'body',
  children,
  style,
}) => {
  return (
    <Text style={[{ fontSize: variantSizes[variant] }, style]}>
      {children}
    </Text>
  );
};