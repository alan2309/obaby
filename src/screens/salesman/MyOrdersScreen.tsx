// src/screens/salesman/MyOrdersScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Share,
  Platform,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import {
  Text,
  Card,
  Chip,
  ActivityIndicator,
  Searchbar,
  Button,
  IconButton,
  Menu,
  Snackbar,
  DataTable,
} from "react-native-paper";
import { useAuth } from "../../context/AuthContext";
import {
  Order,
  getOrdersBySalesman,
  getOrderDeliverySummary,
} from "../../firebase/firestore";
import {
  scaleSize,
  platformStyle,
  ORDER_STATUS,
  theme,
  scaleFont,
  screenSize,
  isSmallDevice,
} from "../../utils/constants";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375; // iPhone SE, small Android devices
const isMediumScreen = screenWidth >= 375 && screenWidth < 414; // Standard iPhones
const isLargeScreen = screenWidth >= 414; // Plus size phones, iPads

const MyOrdersScreen: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [snackbarMsg, setSnackbarMsg] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      if (!user) {
        setOrders([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setLoading(true);
      const ordersData = await getOrdersBySalesman(user.uid);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (error: any) {
      console.error("Error loading orders:", error);
      setSnackbarMsg("Error loading orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    filterOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, orders, statusFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const safeToDate = (d?: Date | string | number) => {
    if (!d) return new Date();
    if (d instanceof Date) return d;
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return new Date();
    return parsed;
  };

  const formatDate = (dateInput?: Date | string | number) => {
    const date = safeToDate(dateInput);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  const formatShortDate = (dateInput?: Date | string | number) => {
    const date = safeToDate(dateInput);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filterOrders = () => {
    let filtered = Array.isArray(orders) ? [...orders] : [];

    // Apply status filter
    if (statusFilter && statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          (order.items || []).some((item) =>
            (item.productName || "").toLowerCase().includes(q)
          ) || (order.id || "").toLowerCase().includes(q)
      );
    }

    setFilteredOrders(filtered);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case ORDER_STATUS.PENDING:
        return "#FFA000";
      case ORDER_STATUS.DELIVERED:
        return "#4CAF50";
      case "Partially Delivered":
        return "#2196F3";
      default:
        return "#757575";
    }
  };

  const getDeliveryProgress = (order: Order) => {
    const deliverySummary = getOrderDeliverySummary(order);
    return {
      progress: deliverySummary.progress,
      deliveredItems: deliverySummary.deliveredItems,
      totalItems: deliverySummary.totalItems,
      remainingItems: deliverySummary.remainingItems,
      isPartiallyDelivered: deliverySummary.isPartiallyDelivered,
    };
  };

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

 const generateOrderPDF = async (order: Order) => {
  try {
    if (!order) return;
    setGeneratingPdf(order.id ?? null);

    const items = Array.isArray(order.items) ? order.items : [];
    const created = safeToDate(order.createdAt);
    const deliveryProgress = getDeliveryProgress(order);

    // Use customerName and salesmanName from order data
    const customerName = order.customerName || 'Unknown Customer';
    const salesmanName = order.salesmanName || user?.name || 'Unknown Salesman';

    const htmlContent = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>
      body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;margin:20px;color:#333}
      .header{text-align:center;margin-bottom:20px;border-bottom:2px solid #E6C76E;padding-bottom:12px}
      .title{font-size:24px;font-weight:700;color:#3B3B3B;margin-bottom:4px}
      .subtitle{font-size:14px;color:#666}
      .order-info{display:flex;justify-content:space-between;margin:20px 0;padding:16px;background:#FAF9F6;border-radius:8px;border-left:4px solid #E6C76E}
      .info-section{flex:1;padding-right:12px}
      .info-label{font-weight:700;color:#3B3B3B;margin-bottom:6px}
      .info-value{color:#666;margin-bottom:4px}
      .status-badge{display:inline-block;padding:6px 12px;background:${getStatusColor(order.status)}22;color:${getStatusColor(order.status)};border-radius:20px;font-weight:700;border:1px solid ${getStatusColor(order.status)}}
      .delivery-progress{margin:12px 0;padding:12px;background:#E3F2FD;border-radius:6px;border-left:4px solid #2196F3}
      .progress-bar{height:8px;background:#E0E0E0;border-radius:4px;margin:8px 0;overflow:hidden}
      .progress-fill{height:100%;background:#4CAF50;border-radius:4px}
      .progress-text{font-size:12px;color:#666;text-align:center}
      .table{width:100%;border-collapse:collapse;margin:16px 0;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
      .table th{background:#E6C76E;color:#3B3B3B;padding:10px;text-align:left;border:1px solid #ddd;font-weight:700}
      .table td{padding:10px;border:1px solid #ddd;vertical-align:top}
      .delivered-badge{display:inline-block;padding:2px 6px;background:#4CAF50;color:white;border-radius:10px;font-size:10px;margin-left:4px}
      .summary{margin-top:16px;padding:16px;background:#FAF9F6;border-radius:8px;border:1px solid #E6C76E}
      .summary-row{display:flex;justify-content:space-between;margin:6px 0}
      .total{font-weight:700;font-size:16px;margin-top:8px;border-top:2px solid #E6C76E;padding-top:8px}
      .footer{margin-top:24px;text-align:center;color:#666;font-size:12px;padding-top:12px;border-top:1px solid #ddd}
      .product-id{font-family:monospace;font-size:12px;color:#888}
      @media print {
        @page { margin: 0.5in; }
        body { margin: 0; -webkit-print-color-adjust: exact; }
        .header { border-bottom: 2px solid #E6C76E; }
      }
    </style></head><body>
    <div class="header"><div class="title">ORDER FORM</div><div class="subtitle">Sales Order Confirmation</div></div>
    <div class="order-info">
      <div class="info-section">
        <div class="info-label">Order Details</div>
        <div class="info-value">Order #: ${order.id ?? 'N/A'}</div>
        <div class="info-value">Date: ${formatDate(created)}</div>
        <div class="info-value">Status: <span class="status-badge">${order.status}</span></div>
      </div>
      <div class="info-section">
        <div class="info-label">Sales Information</div>
        <div class="info-value">Salesman: ${salesmanName}</div>
        <div class="info-value">Customer: ${customerName}</div>
      </div>
    </div>

    ${deliveryProgress.isPartiallyDelivered || order.status === 'Partially Delivered' ? `
    <div class="delivery-progress">
      <div class="info-label">Delivery Progress</div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${deliveryProgress.progress}%"></div>
      </div>
      <div class="progress-text">
        ${deliveryProgress.deliveredItems} of ${deliveryProgress.totalItems} items delivered (${Math.round(deliveryProgress.progress)}%)
      </div>
    </div>
    ` : ''}

    <table class="table"><thead><tr><th>Product</th><th>Size & Color</th><th>Quantity</th><th>Delivered</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>
    ${items.map(i => {
      const deliveredQty = i.deliveredQuantity || 0;
      const remainingQty = i.quantity - deliveredQty;
      return `<tr>
        <td><strong>${i.productName ?? 'N/A'}</strong></td>
        <td>${i.size ?? '-'}</td>
        <td>${i.quantity ?? 0}</td>
        <td>
          ${deliveredQty > 0 ? `
            <strong style="color: #4CAF50">${deliveredQty}</strong>
            ${remainingQty > 0 ? `<span style="color: #FF9800">(${remainingQty} pending)</span>` : '<span class="delivered-badge">✓</span>'}
          ` : '<span style="color: #757575">0</span>'}
        </td>
        <td>₹${(Number(i.finalPrice) || 0).toFixed(2)}</td>
        <td><strong>₹${(((Number(i.finalPrice) || 0) * (i.quantity || 0))).toFixed(2)}</strong></td>
      </tr>`;
    }).join('')}
    </tbody></table>
    <div class="summary">
      <div class="summary-row"><span>Total Items:</span><span>${deliveryProgress.totalItems}</span></div>
      ${deliveryProgress.isPartiallyDelivered ? `
      <div class="summary-row"><span>Delivered Items:</span><span style="color: #4CAF50">${deliveryProgress.deliveredItems}</span></div>
      <div class="summary-row"><span>Remaining Items:</span><span style="color: #FF9800">${deliveryProgress.remainingItems}</span></div>
      ` : ''}
      <div class="summary-row total"><span>Total Amount:</span><span>₹${(Number(order.totalAmount) || 0).toFixed(2)}</span></div>
      ${order.deliveredAmount ? `<div class="summary-row"><span>Amount Delivered:</span><span style="color: #4CAF50">₹${(Number(order.deliveredAmount) || 0).toFixed(2)}</span></div>` : ''}
    </div>
    <div class="footer"><p>This invoice was generated automatically by the Sales App</p><p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p></div>
    </body></html>`;

    // Rest of the PDF generation code remains the same...
    // Different approach for web vs native
    if (Platform.OS === 'web') {
      // For web: Use browser's print functionality with better styling
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Wait for content to load then trigger print
        printWindow.onload = () => {
          printWindow.focus();
          // Add delay to ensure content is rendered
          setTimeout(() => {
            printWindow.print();
            setSnackbarMsg('Print dialog opened - Select "Save as PDF" for digital copy');
            setGeneratingPdf(null);
          }, 500);
        };
      } else {
        // Fallback: Use current window print
        const originalContent = document.body.innerHTML;
        document.body.innerHTML = htmlContent;
        window.print();
        document.body.innerHTML = originalContent;
        setSnackbarMsg('Printing...');
        setGeneratingPdf(null);
      }
      return;
    }

    // Original native implementation for iOS and Android
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    if (!uri) throw new Error('Failed to create PDF');

    if (Platform.OS === 'ios') {
      await Sharing.shareAsync(uri);
      setSnackbarMsg('PDF shared');
      return;
    }

    // Android implementation
    const SAF = (FileSystem as any).StorageAccessFramework;
    if (SAF) {
      try {
        const permissions = await SAF.requestDirectoryPermissionsAsync();
        if (permissions?.granted) {
          const directoryUri = permissions.directoryUri;
          const fileName = `Order_${order.id ?? 'order'}_Invoice_${Date.now()}.pdf`;
          const createdFileUri = await SAF.createFileAsync(directoryUri, fileName, 'application/pdf');
          await FileSystem.copyAsync({ from: uri, to: createdFileUri });
          setSnackbarMsg('PDF saved to folder');
          return;
        } else {
          await Sharing.shareAsync(uri);
          setSnackbarMsg('PDF shared');
          return;
        }
      } catch (safErr) {
        console.warn('SAF flow failed, falling back to share:', safErr);
      }
    }

    // Fallback for Android
    try {
      const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
      const dest = `${docDir}Order_${order.id ?? 'order'}_Invoice_${Date.now()}.pdf`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      await Sharing.shareAsync(dest);
      setSnackbarMsg('PDF saved & shared');
    } catch (fallbackErr) {
      console.error('Final fallback failed, sharing generated URI instead', fallbackErr);
      await Sharing.shareAsync(uri);
      setSnackbarMsg('PDF shared (fallback)');
    }

  } catch (error) {
    console.error('Error generating PDF:', error);
    setSnackbarMsg('Failed to generate PDF');
  } finally {
    if (Platform.OS !== 'web') {
      setGeneratingPdf(null);
    }
    // For web, generatingPdf is set to null in the printWindow.onload callback
  }
};

  const shareOrderDetails = async (order: Order) => {
    try {
      const items = Array.isArray(order.items) ? order.items : [];
      const deliveryProgress = getDeliveryProgress(order);

      // Use customer name from order data
      const customerName = order.customerName || "Customer";

      const orderDetails = items
        .map((item) => {
          const deliveredQty = item.deliveredQuantity || 0;
          const deliveryInfo =
            deliveredQty > 0
              ? ` (${deliveredQty} delivered${
                  item.quantity > deliveredQty
                    ? `, ${item.quantity - deliveredQty} pending`
                    : ""
                })`
              : "";
          return `• ${item.productName} (${item.size || "-"}, ${
            item.color || "-"
          }) - ${item.quantity} x ₹${(Number(item.finalPrice) || 0).toFixed(
            2
          )} = ₹${(
            (Number(item.finalPrice) || 0) * (item.quantity || 0)
          ).toFixed(2)}${deliveryInfo}`;
        })
        .join("\n");

      const deliverySummary = deliveryProgress.isPartiallyDelivered
        ? `\nDelivery Progress: ${deliveryProgress.deliveredItems}/${
            deliveryProgress.totalItems
          } items delivered (${Math.round(deliveryProgress.progress)}%)`
        : "";

      const message = `Order #${(order.id ?? "")
        .toString()
        .substring(0, 8)}\nCustomer: ${customerName}\nStatus: ${
        order.status
      }\nDate: ${formatDate(
        order.createdAt
      )}${deliverySummary}\n\nItems:\n${orderDetails}\n\nTotal: ₹${(
        Number(order.totalAmount) || 0
      ).toFixed(2)}`;

      await Share.share({
        message,
        title: `Order ${(order.id ?? "").toString().substring(0, 8)} Details`,
      });
    } catch (error) {
      console.error("Error sharing order:", error);
      setSnackbarMsg("Failed to share order");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text variant="headlineMedium" style={styles.title}>
          My Orders
        </Text>

        <Searchbar
          placeholder="Search orders..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />

        <ScrollView
          horizontal
          style={styles.filterScroll}
          showsHorizontalScrollIndicator={false}
        >
          <View style={styles.filterContainer}>
            {["all", ...Object.values(ORDER_STATUS), "Partially Delivered"].map(
              (status) => (
                <Chip
                  key={status}
                  selected={statusFilter === status}
                  onPress={() => setStatusFilter(status)}
                  style={styles.filterChip}
                  mode="outlined"
                >
                  {status === "all" ? "All" : status}
                </Chip>
              )
            )}
          </View>
        </ScrollView>

        {filteredOrders.map((order) => {
          const deliveryProgress = getDeliveryProgress(order);
          const isExpanded = expandedOrder === order.id;

          return (
            <Card key={order.id} style={styles.orderCard}>
              <Card.Content style={styles.cardContent}>
                {/* Compact Order Header */}
                <TouchableOpacity
                  style={styles.orderHeader}
                  onPress={() => toggleOrderExpansion(order.id!)}
                  activeOpacity={0.7}
                >
                  <View style={styles.orderBasicInfo}>
                    <View style={styles.orderIdRow}>
                      <Text variant="titleSmall" style={styles.orderId}>
                        Order #{(order.id ?? "").toString().substring(0, 8)}
                      </Text>
                      <Chip
                        mode="outlined"
                        textStyle={[
                          styles.statusChipText,
                          { color: getStatusColor(order.status) }
                        ]}
                        style={[
                          styles.statusChip,
                          {
                            backgroundColor: `${getStatusColor(
                              order.status
                            )}22`,
                          },
                        ]}
                      >
                        {order.status}
                      </Chip>
                    </View>

                    <Text variant="bodySmall" style={styles.orderDate}>
                      {formatShortDate(order.createdAt)}
                    </Text>

                    <View style={styles.orderSummary}>
                      <Text variant="bodyMedium" style={styles.orderAmount}>
                        ₹{(Number(order.totalAmount) || 0).toFixed(2)}
                      </Text>
                      <Text variant="bodySmall" style={styles.itemCount}>
                        • {deliveryProgress.totalItems} items
                      </Text>
                      {deliveryProgress.isPartiallyDelivered && (
                        <Text variant="bodySmall" style={styles.deliveredCount}>
                          • {deliveryProgress.deliveredItems} delivered
                        </Text>
                      )}
                    </View>
                  </View>

                  <IconButton
                    icon={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    style={styles.expandIcon}
                  />
                </TouchableOpacity>

                {/* Expanded Product Details */}
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    <View style={styles.actionsRow}>
                      <Button
                        mode="outlined"
                        onPress={() => generateOrderPDF(order)}
                        loading={generatingPdf === order.id}
                        disabled={generatingPdf === order.id}
                        style={styles.actionButton}
                        compact
                      >
                        {Platform.OS === "web" ? "Print" : "PDF"}
                      </Button>
                      <Button
                        mode="outlined"
                        onPress={() => shareOrderDetails(order)}
                        style={styles.actionButton}
                        compact
                      >
                        Share
                      </Button>
                    </View>

                    {/* Products Table */}
                    <DataTable style={styles.productsTable}>
                      <DataTable.Header>
                        <DataTable.Title style={styles.tableHeader}>
                          Product
                        </DataTable.Title>
                        <DataTable.Title style={styles.tableHeader}>
                          Size
                        </DataTable.Title>
                        <DataTable.Title numeric style={styles.tableHeader}>
                          Quantity
                        </DataTable.Title>
                        <DataTable.Title numeric style={styles.tableHeader}>
                          Dispatched
                        </DataTable.Title>
                        <DataTable.Title numeric style={styles.tableHeader}>
                          Remaining
                        </DataTable.Title>
                      </DataTable.Header>

                      {(Array.isArray(order.items) ? order.items : []).map(
                        (item, index) => {
                          const deliveredQty = item.deliveredQuantity || 0;
                          const remainingQty = item.quantity - deliveredQty;

                          return (
                            <DataTable.Row key={index} style={styles.tableRow}>
                              <DataTable.Cell style={styles.tableCell}>
                                <Text
                                  variant="bodySmall"
                                  style={styles.productName}
                                  numberOfLines={1}
                                >
                                  {item.productName}
                                </Text>
                                <Text
                                  variant="bodySmall"
                                  style={styles.skuText}
                                >
                                  {(item.productId ?? "")
                                    .toString()
                                    .substring(0, 8)}
                                </Text>
                              </DataTable.Cell>
                              <DataTable.Cell style={styles.tableCell}>
                                <Text variant="bodySmall">
                                  {item.size || "-"}
                                </Text>
                              </DataTable.Cell>
                              <DataTable.Cell numeric style={styles.tableCell}>
                                <Text variant="bodySmall">{item.quantity}</Text>
                              </DataTable.Cell>
                              <DataTable.Cell numeric style={styles.tableCell}>
                                <Text
                                  variant="bodySmall"
                                  style={[
                                    styles.deliveredText,
                                    deliveredQty > 0
                                      ? styles.deliveredPositive
                                      : {},
                                  ]}
                                >
                                  {deliveredQty}
                                </Text>
                              </DataTable.Cell>
                              <DataTable.Cell numeric style={styles.tableCell}>
                                <Text
                                  variant="bodySmall"
                                  style={[
                                    styles.remainingText,
                                    remainingQty > 0
                                      ? styles.remainingPositive
                                      : {},
                                  ]}
                                >
                                  {remainingQty}
                                </Text>
                              </DataTable.Cell>
                            </DataTable.Row>
                          );
                        }
                      )}
                    </DataTable>

                    {/* Order Summary */}
                    <View style={styles.orderSummarySection}>
                      <View style={styles.summaryRow}>
                        <Text variant="bodySmall">Total Items:</Text>
                        <Text variant="bodySmall">
                          {deliveryProgress.totalItems}
                        </Text>
                      </View>
                      {deliveryProgress.isPartiallyDelivered && (
                        <>
                          <View style={styles.summaryRow}>
                            <Text
                              variant="bodySmall"
                              style={styles.deliveredSummary}
                            >
                              Items Delivered:
                            </Text>
                            <Text
                              variant="bodySmall"
                              style={styles.deliveredSummary}
                            >
                              {deliveryProgress.deliveredItems}
                            </Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text
                              variant="bodySmall"
                              style={styles.remainingSummary}
                            >
                              Items Remaining:
                            </Text>
                            <Text
                              variant="bodySmall"
                              style={styles.remainingSummary}
                            >
                              {deliveryProgress.remainingItems}
                            </Text>
                          </View>
                        </>
                      )}
                      <View style={[styles.summaryRow, styles.totalRow]}>
                        <Text variant="bodyMedium" style={styles.totalLabel}>
                          Total Amount:
                        </Text>
                        <Text variant="bodyMedium" style={styles.totalAmount}>
                          ₹{(Number(order.totalAmount) || 0).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </Card.Content>
            </Card>
          );
        })}

        {filteredOrders.length === 0 && !loading && (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text variant="bodyLarge" style={styles.emptyText}>
                {orders.length === 0
                  ? "No orders found. Create your first order!"
                  : "No orders match your filters"}
              </Text>
            </Card.Content>
          </Card>
        )}

        <View style={{ height: scaleSize(24) }} />
      </ScrollView>

      <Snackbar
        visible={!!snackbarMsg}
        onDismiss={() => setSnackbarMsg(null)}
        duration={3000}
      >
        {snackbarMsg}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: platformStyle.padding, paddingBottom: scaleSize(24) },
  title: {
    textAlign: "center",
    marginBottom: scaleSize(18),
    color: theme.colors.text,
    fontSize: scaleFont(18),
    fontWeight: "bold",
  },
  searchbar: {
    marginBottom: scaleSize(12),
    backgroundColor: theme.colors.surface,
  },
  filterScroll: { marginBottom: scaleSize(12) },
  filterContainer: { flexDirection: "row", paddingVertical: scaleSize(4) },
  filterChip: { marginRight: scaleSize(8) },

  // Compact Order Card Styles
  orderCard: {
    marginBottom: scaleSize(8),
    backgroundColor: theme.colors.surface,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardContent: {
    padding: scaleSize(12),
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderBasicInfo: {
    flex: 1,
  },
  orderIdRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: scaleSize(4),
    flexWrap: isSmallDevice ? 'wrap' : 'nowrap',
  },
  orderId: {
    fontWeight: "600",
    marginRight: scaleSize(8),
    color: theme.colors.text,
    fontSize: isSmallDevice ? scaleFont(13) : scaleFont(14),
  },
  statusChip: {
    height: isSmallDevice ? scaleSize(32) : scaleSize(26),
    paddingHorizontal: isSmallDevice ? scaleSize(10) : scaleSize(12),
    minWidth: isSmallDevice ? scaleSize(80) : scaleSize(90),
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusChipText: {
    fontSize: isSmallDevice ? scaleFont(11) : scaleFont(12),
    fontWeight: "bold",
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  orderDate: {
    color: theme.colors.placeholder,
    marginBottom: scaleSize(6),
    fontSize: isSmallDevice ? scaleFont(11) : scaleFont(12),
  },
  orderSummary: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  orderAmount: {
    fontWeight: "bold",
    color: theme.colors.accent,
    marginRight: scaleSize(8),
    fontSize: isSmallDevice ? scaleFont(13) : scaleFont(14),
  },
  itemCount: {
    color: theme.colors.placeholder,
    marginRight: scaleSize(8),
    fontSize: isSmallDevice ? scaleFont(11) : scaleFont(12),
  },
  deliveredCount: {
    color: "#4CAF50",
    fontSize: isSmallDevice ? scaleFont(11) : scaleFont(12),
    fontWeight: "500",
  },
  expandIcon: {
    margin: 0,
    marginTop: -scaleSize(4),
  },

  // Expanded Content Styles
  expandedContent: {
    marginTop: scaleSize(12),
    paddingTop: scaleSize(12),
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: scaleSize(12),
    gap: scaleSize(8),
  },
  actionButton: {
    minWidth: isSmallDevice ? scaleSize(60) : scaleSize(70),
  },

  // Products Table Styles
  productsTable: {
    backgroundColor: "#FAFAFA",
    borderRadius: scaleSize(8),
    overflow: "hidden",
    marginBottom: scaleSize(12),
  },
  tableHeader: {
    paddingVertical: scaleSize(8),
    paddingHorizontal: scaleSize(4),
  },
  tableRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  tableCell: {
    paddingVertical: scaleSize(8),
    paddingHorizontal: scaleSize(4),
  },
  skuText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: scaleFont(10),
    color: theme.colors.placeholder,
  },
  productName: {
    fontSize: scaleFont(12),
    marginTop: scaleSize(2),
  },
  deliveredText: {
    color: "#757575",
  },
  deliveredPositive: {
    color: "#4CAF50",
    fontWeight: "500",
  },
  remainingText: {
    color: "#757575",
  },
  remainingPositive: {
    color: "#FF9800",
    fontWeight: "500",
  },

  // Order Summary Styles
  orderSummarySection: {
    backgroundColor: "#F8F9FA",
    padding: scaleSize(12),
    borderRadius: scaleSize(6),
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accent,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: scaleSize(6),
  },
  deliveredSummary: {
    color: "#4CAF50",
  },
  remainingSummary: {
    color: "#FF9800",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    paddingTop: scaleSize(8),
    marginTop: scaleSize(4),
  },
  totalLabel: {
    fontWeight: "600",
    color: theme.colors.text,
  },
  totalAmount: {
    fontWeight: "bold",
    color: theme.colors.accent,
  },

  // Common Styles
  emptyCard: {
    alignItems: "center",
    padding: scaleSize(20),
    backgroundColor: theme.colors.surface,
  },
  emptyText: {
    textAlign: "center",
    color: theme.colors.placeholder,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: scaleSize(12),
    color: theme.colors.text,
  },
});

export default MyOrdersScreen;