// src/utils/shareUtils.ts
import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';

export const sharePDF = async (filePath: string, fileName: string) => {
  try {
    if (Platform.OS === 'web') {
      // For web, create a download link
      const response = await fetch(filePath);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // For mobile, use the Share API
      await Share.share({
        url: filePath,
        title: fileName,
      });
    }
  } catch (error: any) {
    console.error('Error sharing PDF:', error);
    throw new Error(`Failed to share PDF: ${error.message}`);
  }
};