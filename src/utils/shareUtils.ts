// src/utils/shareUtils.ts
import { Platform, Share, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const sharePDF = async (filePath: string, fileName: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      // For web, we've already handled printing in the PDF generator
      console.log('PDF ready for printing in browser');
      return;
    }

    // For mobile, check if sharing is available
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (!isSharingAvailable) {
      Alert.alert('Sharing not available', 'Sharing is not available on this device');
      return;
    }

    // Share the PDF file using the URI from Print.printToFileAsync
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/pdf',
      dialogTitle: `Share ${fileName}`,
      UTI: 'com.adobe.pdf' // iOS uniform type identifier for PDF
    });

  } catch (error: any) {
    console.error('Error sharing PDF:', error);
    
    if (Platform.OS !== 'web') {
      Alert.alert('Sharing Failed', `Unable to share PDF: ${error.message}`);
    }
    
    throw new Error(`Failed to share PDF: ${error.message}`);
  }
};