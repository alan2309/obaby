// src/screens/salesman/CategoryProductsScreen.tsx
import React, { useState, useCallback } from "react";
import { View, StyleSheet, Alert } from "react-native";
import {
  useRoute,
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";
import { RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { FAB, Snackbar } from "react-native-paper";
import ProductCatalog from "../../components/ProductCatalog";
import { Product } from "../../firebase/firestore";
import { generateProductPDF } from "../../utils/pdfGenerator";
import { sharePDF } from "../../utils/shareUtils";
import { scaleSize } from "../../utils/constants";

type RouteParams = {
  categoryId: string;
  categoryTitle: string;
  isAllProducts?: boolean;
};

type NavigationProp = StackNavigationProp<any, "ProductDetail">;

const CategoryProductsScreen: React.FC = () => {
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const navigation = useNavigation<NavigationProp>();
  const { categoryId, categoryTitle, isAllProducts = false } = route.params;
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const handleProductPress = (product: Product) => {
    if (isSelectionMode) {
      // Toggle selection
      const isSelected = selectedProducts.some((p) => p.id === product.id);
      if (isSelected) {
        setSelectedProducts((prev) => prev.filter((p) => p.id !== product.id));
      } else {
        setSelectedProducts((prev) => [...prev, product]);
      }
    } else {
      // Normal navigation
      const serializableProduct = {
        ...product,
        createdAt: product.createdAt?.toISOString?.() || product.createdAt,
        updatedAt: product.updatedAt?.toISOString?.() || product.updatedAt,
      };
      navigation.navigate("ProductDetail", { product: serializableProduct });
    }
  };

  const handleProductLongPress = (product: Product) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedProducts([product]);
    }
  };

  const handleShareAsPDF = async () => {
    if (selectedProducts.length === 0) {
      setSnackbarMessage("Please select at least one product to share");
      setSnackbarVisible(true);
      return;
    }

    try {
      setGeneratingPDF(true);

      Alert.alert(
        "Generate PDF",
        `Generate PDF for ${selectedProducts.length} selected product(s)?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Generate PDF",
            onPress: async () => {
              try {
                const pdfTitle = isAllProducts 
                  ? 'All Products' 
                  : categoryTitle;
                
                const pdfPath = await generateProductPDF(
                  selectedProducts,
                  pdfTitle
                );
                await sharePDF(pdfPath, `${pdfTitle}_Products.pdf`);
                setSnackbarMessage(
                  `PDF shared successfully for ${selectedProducts.length} product(s)`
                );
                setSnackbarVisible(true);
              } catch (error: any) {
                console.error("PDF generation error:", error);
                setSnackbarMessage(`Failed to generate PDF: ${error.message}`);
                setSnackbarVisible(true);
              } finally {
                setGeneratingPDF(false);
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("PDF generation error:", error);
      setSnackbarMessage(`Failed to generate PDF: ${error.message}`);
      setSnackbarVisible(true);
      setGeneratingPDF(false);
    }
  };

  const clearSelection = () => {
    setSelectedProducts([]);
    setIsSelectionMode(false);
  };

  const exitSelectionMode = () => {
    setSelectedProducts([]);
    setIsSelectionMode(false);
  };

  // Refresh data when screen comes into focus and clear selection
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((prev) => prev + 1);
      exitSelectionMode();
    }, [])
  );

  return (
    <View style={styles.container}>
      <ProductCatalog
        key={refreshKey}
        categoryId={categoryId}
        onProductPress={handleProductPress}
        onProductLongPress={handleProductLongPress}
        showAddToCart={true}
        screenTitle={categoryTitle}
        selectedProducts={selectedProducts}
        isSelectionMode={isSelectionMode}
      />

      {/* Selection Mode FAB */}
      {isSelectionMode && (
        <View style={styles.fabContainer}>
          <FAB
            icon="close"
            style={[styles.fab, styles.cancelFab]}
            onPress={clearSelection}
            small
          />
          <FAB
            icon="file-pdf-box"
            style={[styles.fab, styles.pdfFab]}
            onPress={handleShareAsPDF}
            loading={generatingPDF}
            disabled={generatingPDF || selectedProducts.length === 0}
            label={
              selectedProducts.length > 0
                ? `${selectedProducts.length}`
                : undefined
            }
          />
        </View>
      )}

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: "OK",
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5EDE0",
  },
  fabContainer: {
    position: "absolute",
    right: scaleSize(16),
    bottom: scaleSize(16),
    flexDirection: "row",
    gap: scaleSize(12),
  },
  fab: {
    backgroundColor: "#F7CAC9",
  },
  cancelFab: {
    backgroundColor: "#FF6B6B",
  },
  pdfFab: {
    backgroundColor: "#4ECDC4",
  },
});

export default CategoryProductsScreen;