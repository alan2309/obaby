// src/screens/admin/OrderManagement.tsx
import React, { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Dimensions, Platform } from "react-native";
import {
  Text,
  Card,
  Chip,
  DataTable,
  Button,
  Searchbar,
  Portal,
  Modal,
  ActivityIndicator,
  Menu,
} from "react-native-paper";
import {
  Order,
  getAllOrders,
  getCustomers,
  getUsers,
  updateOrderPartialDelivery,
  getOrderDeliverySummary,
} from "../../firebase/firestore";
import { scaleSize, platformStyle } from "../../utils/constants";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const OrderManagement: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [salesmen, setSalesmen] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  // Simple filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [salesmanFilter, setSalesmanFilter] = useState<string>("all");

  // Order details modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [deliveryQuantities, setDeliveryQuantities] = useState<{ [key: string]: number }>({});
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersData, customersData, usersData] = await Promise.all([
        getAllOrders(),
        getCustomers(),
        getUsers(),
      ]);

      setOrders(ordersData || []);
      setCustomers(customersData || []);

      // Filter salesmen from users
      const salesmenData = (usersData || []).filter((user: any) => user.role === "salesman");
      setSalesmen(salesmenData);
    } catch (error: any) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // -------------------
  // Helper functions
  // -------------------
  const getCustomerName = (customerId: string) => {
    if (!customers || customers.length === 0) return "Unknown Customer";
    const customer = customers.find((c) => c.id === customerId);
    return customer?.name || "Unknown Customer";
  };

  const getSalesmanName = (salesmanId: string) => {
    if (!salesmen || salesmen.length === 0) return "Unknown Salesman";
    const salesman = salesmen.find((s) => s.id === salesmanId);
    return salesman?.name || "Unknown Salesman";
  };

  const formatDate = (date: Date | string | number | undefined | null) => {
    if (!date) return "-";
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatFullDate = (date: Date | string | number | undefined | null) => {
    if (!date) return "-";
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "-";
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending":
        return "#FFA000";
      case "Partially Delivered":
        return "#2196F3";
      case "Delivered":
        return "#4CAF50";
      default:
        return "#757575";
    }
  };

  // Initialize delivery quantities when modal opens
  const initializeDeliveryQuantities = (order: Order) => {
    const quantities: { [key: string]: number } = {};
    order.items.forEach((item) => {
      const key = `${item.productId}-${item.size}-${item.color}`;
      const deliveredQty = item.deliveredQuantity || 0;
      const remainingQty = Math.max(0, item.quantity - deliveredQty);
      quantities[key] = 0; // Start with 0 for remaining items
    });
    setDeliveryQuantities(quantities);
  };

  const handleDelivery = async () => {
    if (!selectedOrder) return;

    setDeliveryLoading(true);
    try {
      const deliveredItems = selectedOrder.items
        .map((item) => {
          const key = `${item.productId}-${item.size}-${item.color}`;
          const quantityToDeliver = deliveryQuantities[key] || 0;

          if (quantityToDeliver > 0) {
            return {
              productId: item.productId,
              size: item.size,
              color: item.color,
              deliveredQuantity: quantityToDeliver,
            };
          }
          return null;
        })
        .filter(Boolean) as Array<{
          productId: string;
          size: string;
          color: string;
          deliveredQuantity: number;
        }>;

      if (deliveredItems.length === 0) {
        alert("Please enter quantities to deliver");
        setDeliveryLoading(false);
        return;
      }

      const result = await updateOrderPartialDelivery(selectedOrder.id!, deliveredItems);

      if (result.success) {
        await loadData();
        setModalVisible(false);
        setSelectedOrder(null);
        setDeliveryQuantities({});
        alert("Delivery updated successfully!");
      } else {
        alert(`Delivery failed: ${result.message}`);
      }
    } catch (error: any) {
      console.error("Error in delivery:", error);
      alert(`Delivery error: ${error.message}`);
    } finally {
      setDeliveryLoading(false);
    }
  };

  const updateDeliveryQuantity = (key: string, value: number) => {
    setDeliveryQuantities((prev) => ({
      ...prev,
      [key]: value,
    }));
    setActiveMenu(null); // Close menu after selection
  };

  // Generate options for dropdown (0 to remaining quantity)
  const generateQuantityOptions = (remainingQty: number) => {
    const options: number[] = [];
    for (let i = 0; i <= remainingQty; i++) {
      options.push(i);
    }
    return options;
  };

  // Check if all items are fully delivered
  const isOrderFullyDelivered = (order: Order) => {
    return order.items.every((item) => (item.deliveredQuantity || 0) >= item.quantity);
  };

  // Calculate total pieces sold across all orders
  const calculateTotalPiecesSold = () => {
    return orders.reduce((total, order) => {
      return total + order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }, 0);
  };

  // PDF Generation Function
  const generateOrderPDF = async (order: Order) => {
    try {
      if (!order) return;
      setGeneratingPdf(order.id ?? null);

      const items = Array.isArray(order.items) ? order.items : [];
      const created = order.createdAt ? new Date(order.createdAt) : new Date();
      const deliveryProgress = getOrderDeliverySummary(order);

      // Use customerName and salesmanName from order data
      const customerName = order.customerName || getCustomerName(order.customerId) || 'Unknown Customer';
      const salesmanName = order.salesmanName || getSalesmanName(order.salesmanId) || 'Unknown Salesman';

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
          <div class="info-value">Date: ${formatFullDate(created)}</div>
          <div class="info-value">Status: <span class="status-badge">${order.status}</span></div>
        </div>
        <div class="info-section">
          <div class="info-label">Sales Information</div>
          <div class="info-value">Salesman: ${salesmanName}</div>
          <div class="info-value">Customer: ${customerName}</div>
        </div>
      </div>
      <table class="table"><thead><tr><th>Product</th><th>Size & Color</th><th>Quantity</th><th>Delivered</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>
      ${items.map(i => {
        const deliveredQty = i.deliveredQuantity || 0;
        const remainingQty = i.quantity - deliveredQty;
        return `<tr>
          <td><strong>${i.productName ?? 'N/A'}</strong><div class="product-id">${(i.productId ?? 'N/A').toString().substring(0,8)}</div></td>
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
      <div class="footer"><p>This invoice was generated automatically by the Adwyzors Business Manager</p><p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p></div>
      </body></html>`;

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
              setGeneratingPdf(null);
            }, 500);
          };
        } else {
          // Fallback: Use current window print
          const originalContent = document.body.innerHTML;
          document.body.innerHTML = htmlContent;
          window.print();
          document.body.innerHTML = originalContent;
          setGeneratingPdf(null);
        }
        return;
      }

      // Original native implementation for iOS and Android
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      if (!uri) throw new Error('Failed to create PDF');

      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(uri);
        setGeneratingPdf(null);
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
            setGeneratingPdf(null);
            return;
          } else {
            await Sharing.shareAsync(uri);
            setGeneratingPdf(null);
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
      } catch (fallbackErr) {
        // console.error('Final fallback failed, sharing generated URI instead', fallbackErr);
        await Sharing.shareAsync(uri);
      }

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    } finally {
      if (Platform.OS !== 'web') {
        setGeneratingPdf(null);
      }
      // For web, generatingPdf is set to null in the printWindow.onload callback
    }
  };

  // -------------------
  // Memoized filtered orders
  // -------------------
  const filteredOrders = useMemo(() => {
    let filtered = orders || [];

    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    if (salesmanFilter !== "all") {
      filtered = filtered.filter((order) => order.salesmanId === salesmanFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (order) =>
          (getCustomerName(order.customerId) || "").toLowerCase().includes(query) ||
          (getSalesmanName(order.salesmanId) || "").toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [orders, statusFilter, salesmanFilter, searchQuery, customers, salesmen]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const clearAllFilters = () => {
    setStatusFilter("all");
    setSalesmanFilter("all");
    setSearchQuery("");
  };

  // Responsive sizing for the quantity button and font
  const quantityButtonWidth = SCREEN_WIDTH < 420 ? 60 : SCREEN_WIDTH < 900 ? 80 : 100;
  const quantityFontSize = SCREEN_WIDTH < 420 ? 12 : SCREEN_WIDTH < 900 ? 13 : 14;

  if (loading && orders.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#F7CAC9" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text variant="headlineMedium" style={styles.title}>
          Order Management
        </Text>

        <Searchbar
          placeholder="Search by customer or salesman..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          icon={searchQuery ? "close" : "magnify"}
          onIconPress={searchQuery ? () => setSearchQuery("") : undefined}
        />

        {/* Filters */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.filterTitle}>
              Order Status
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.statusButtons}>
                {["all", "Pending", "Partially Delivered", "Delivered"].map((s) => (
                  <Button
                    key={s}
                    mode={statusFilter === s ? "contained" : "outlined"}
                    onPress={() => setStatusFilter(s)}
                    style={[styles.smallFilterButton, statusFilter === s && styles.smallFilterButtonActive]}
                    compact
                  >
                    {s === "all" ? "All" : s}
                  </Button>
                ))}
              </View>
            </ScrollView>
          </Card.Content>
        </Card>

        <Card style={styles.filterCard}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.filterTitle}>
              Salesman
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.statusButtons}>
                <Button
                  mode={salesmanFilter === "all" ? "contained" : "outlined"}
                  onPress={() => setSalesmanFilter("all")}
                  style={[styles.smallFilterButton, salesmanFilter === "all" && styles.smallFilterButtonActive]}
                  compact
                >
                  All
                </Button>
                {salesmen.map((salesman) => (
                  <Button
                    key={salesman.id}
                    mode={salesmanFilter === salesman.id ? "contained" : "outlined"}
                    onPress={() => setSalesmanFilter(salesman.id)}
                    style={[styles.smallFilterButton, salesmanFilter === salesman.id && styles.smallFilterButtonActive]}
                    compact
                  >
                    {salesman.name?.split(" ")[0] ?? "Salesman"}
                  </Button>
                ))}
              </View>
            </ScrollView>
          </Card.Content>
        </Card>

        {(() => {
          const activeCount = (statusFilter !== "all" ? 1 : 0) + (salesmanFilter !== "all" ? 1 : 0) + (searchQuery.trim() ? 1 : 0);
          return activeCount > 0 ? (
            <View style={styles.activeFilters}>
              <Text variant="bodySmall">{filteredOrders.length} orders found</Text>
              <Button mode="text" compact onPress={clearAllFilters} textColor="#F7CAC9" icon="close">
                Clear
              </Button>
            </View>
          ) : null;
        })()}

        {/* Orders Cards */}
        {filteredOrders.length > 0 ? (
          <View style={styles.ordersContainer}>
            {filteredOrders.map((order) => {
              const isFullyDelivered = isOrderFullyDelivered(order);
              const deliverySummary = getOrderDeliverySummary(order);

              return (
                <Card
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => {
                    setSelectedOrder(order);
                    initializeDeliveryQuantities(order);
                    setModalVisible(true);
                  }}
                >
                  <Card.Content style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <Text variant="titleSmall" style={styles.orderId}>
                        #{String(order.id).substring(0, 8)}
                      </Text>
                      <Chip compact style={[styles.statusChip, { backgroundColor: getStatusColor(order.status) }]} textStyle={styles.statusText}>
                        {isFullyDelivered ? "Delivered" : order.status}
                      </Chip>
                    </View>

                    <View style={styles.cardDetails}>
                      <View style={styles.detailRow}>
                        <Text variant="bodySmall" style={styles.detailLabel}>
                          Customer:
                        </Text>
                        <Text variant="bodySmall" style={styles.detailValue}>
                          {getCustomerName(order.customerId)}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text variant="bodySmall" style={styles.detailLabel}>
                          Salesman:
                        </Text>
                        <Text variant="bodySmall" style={styles.detailValue}>
                          {getSalesmanName(order.salesmanId)}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text variant="bodySmall" style={styles.detailLabel}>
                          Date:
                        </Text>
                        <Text variant="bodySmall" style={styles.detailValue}>
                          {formatDate(order.createdAt)}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text variant="bodySmall" style={styles.detailLabel}>
                          Amount:
                        </Text>
                        <Text variant="bodyMedium" style={styles.amountText}>
                          ₹{order.totalAmount.toFixed(0)}
                        </Text>
                      </View>
                    </View>

                    {deliverySummary.isPartiallyDelivered && (
                      <View style={styles.deliveryProgress}>
                        <Text variant="bodySmall" style={styles.progressText}>
                          {deliverySummary.deliveredItems}/{deliverySummary.totalItems} items delivered
                        </Text>
                      </View>
                    )}
                  </Card.Content>
                </Card>
              );
            })}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Text variant="titleMedium" style={styles.emptyText}>
                No orders found
              </Text>
              <Text variant="bodyMedium" style={styles.emptySubtext}>
                {orders.length === 0 ? "There are no orders in the system yet." : "No orders match your current filters."}
              </Text>
              {((statusFilter !== "all") || (salesmanFilter !== "all") || searchQuery.trim()) && (
                <Button mode="contained" onPress={clearAllFilters} style={styles.clearFiltersButton}>
                  Clear Filters
                </Button>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <Card style={[styles.statCard, { marginRight: scaleSize(8) }]}>
            <Card.Content style={styles.statContent}>
              <Text variant="headlineSmall" style={styles.statNumber}>
                {orders.length}
              </Text>
              <Text variant="bodySmall">Total Orders</Text>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <Text variant="headlineSmall" style={styles.statNumber}>
                {calculateTotalPiecesSold().toLocaleString()}
              </Text>
              <Text variant="bodySmall">Total Pieces Ordered</Text>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>

      {/* Order Details Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => {
            setModalVisible(false);
            setSelectedOrder(null);
            setDeliveryQuantities({});
            setActiveMenu(null);
          }}
          contentContainerStyle={styles.modalContainer}
        >
          {selectedOrder && (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text variant="titleLarge" style={styles.modalTitle}>
                Order Details
              </Text>
              <Text variant="bodySmall" style={styles.orderIdFull}>
                #{selectedOrder.id}
              </Text>

              {/* PDF Generation Button */}
              <View style={styles.pdfButtonContainer}>
                <Button
                  mode="outlined"
                  onPress={() => generateOrderPDF(selectedOrder)}
                  loading={generatingPdf === selectedOrder.id}
                  disabled={generatingPdf === selectedOrder.id}
                  style={styles.pdfButton}
                  icon="file-pdf-box"
                >
                  {Platform.OS === 'web' ? 'Print PDF' : 'Generate PDF'}
                </Button>
              </View>

              <View style={styles.modalSection}>
                <Text variant="titleSmall">Customer & Salesman</Text>
                <Text variant="bodyMedium">Customer: {getCustomerName(selectedOrder.customerId)}</Text>
                <Text variant="bodyMedium">Salesman: {getSalesmanName(selectedOrder.salesmanId)}</Text>
                <Text variant="bodyMedium">Total Amount: ₹{selectedOrder.totalAmount.toFixed(2)}</Text>
              </View>

              {/* Products Table with Delivery Input */}
              <View style={styles.modalSection}>
                <Text variant="titleSmall">Order Items & Delivery</Text>
                <DataTable style={styles.productsTable}>
                  <DataTable.Header>
                    <DataTable.Title style={styles.tableHeader}>SKU</DataTable.Title>
                    <DataTable.Title style={styles.tableHeader}>Size</DataTable.Title>
                    <DataTable.Title numeric style={styles.tableHeader}>
                      Ordered
                    </DataTable.Title>
                    <DataTable.Title numeric style={styles.tableHeader}>
                      Dispatched
                    </DataTable.Title>
                    <DataTable.Title numeric style={styles.tableHeader}>
                      Remaining
                    </DataTable.Title>
                    <DataTable.Title numeric style={styles.tableHeader}>
                      Deliver
                    </DataTable.Title>
                  </DataTable.Header>

                  {selectedOrder.items.map((item, index) => {
                    const deliveredQty = item.deliveredQuantity || 0;
                    const remainingQty = Math.max(0, item.quantity - deliveredQty);
                    const key = `${item.productId}-${item.size}-${item.color}`;
                    const currentDelivery = deliveryQuantities[key] || 0;
                    const quantityOptions = generateQuantityOptions(remainingQty);
                    const menuKey = `menu-${key}`;

                    return (
                      <DataTable.Row key={index} style={styles.tableRow}>
                        <DataTable.Cell style={styles.tableCell}>
                          <Text variant="bodySmall" style={styles.skuText}>
                            {(item.productId ?? "").toString().substring(0, 8)}
                          </Text>
                        </DataTable.Cell>

                        <DataTable.Cell style={styles.tableCell}>
                          <Text variant="bodySmall">{item.size || "-"}</Text>
                        </DataTable.Cell>

                        <DataTable.Cell numeric style={styles.tableCell}>
                          <Text variant="bodySmall">{item.quantity}</Text>
                        </DataTable.Cell>

                        <DataTable.Cell numeric style={styles.tableCell}>
                          <Text variant="bodySmall" style={styles.deliveredText}>
                            {deliveredQty}
                          </Text>
                        </DataTable.Cell>

                        <DataTable.Cell numeric style={styles.tableCell}>
                          <Text variant="bodySmall" style={styles.remainingText}>
                            {remainingQty}
                          </Text>
                        </DataTable.Cell>

                        <DataTable.Cell numeric style={styles.tableCell}>
                          {remainingQty > 0 ? (
                            <View style={styles.quantitySelector}>
                              <Menu
                                visible={activeMenu === menuKey}
                                onDismiss={() => setActiveMenu(null)}
                                anchor={
                                  // anchor view - keep size stable and avoid overflow
                                  <View style={{ width: quantityButtonWidth }}>
                                    <Button
                                      mode="outlined"
                                      onPress={() => setActiveMenu(menuKey)}
                                      style={[
                                        styles.quantityButton,
                                        { width: quantityButtonWidth },
                                      ]}
                                      contentStyle={[
                                        styles.quantityButtonContent,
                                        { minHeight: 34 },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.quantityButtonText,
                                          { fontSize: quantityFontSize },
                                        ]}
                                      >
                                        {currentDelivery}
                                      </Text>
                                    </Button>
                                  </View>
                                }
                                style={[styles.quantityMenu, { maxWidth: 220 }]}
                              >
                                <ScrollView style={styles.quantityMenuScroll} nestedScrollEnabled={true}>
                                  {quantityOptions.map((quantity) => (
                                    <Menu.Item
                                      key={quantity}
                                      onPress={() => updateDeliveryQuantity(key, quantity)}
                                      title={quantity.toString()}
                                      style={[
                                        styles.quantityMenuItem,
                                        quantity === currentDelivery && styles.quantityMenuItemSelected,
                                      ]}
                                      titleStyle={[
                                        styles.quantityMenuText,
                                        quantity === currentDelivery && styles.quantityMenuTextSelected,
                                      ]}
                                    />
                                  ))}
                                </ScrollView>
                              </Menu>
                            </View>
                          ) : (
                            <Text variant="bodySmall" style={styles.fullyDeliveredText}>
                              ✓
                            </Text>
                          )}
                        </DataTable.Cell>
                      </DataTable.Row>
                    );
                  })}
                </DataTable>

                {/* Delivery Summary */}
                <View style={styles.deliverySummary}>
                  <Text variant="bodySmall">Items to deliver: {Object.values(deliveryQuantities).reduce((sum, qty) => sum + qty, 0)}</Text>
                </View>

                {/* Delivery Action Buttons */}
                <View style={styles.deliveryActions}>
                  <Button
                    mode="contained"
                    onPress={handleDelivery}
                    loading={deliveryLoading}
                    disabled={deliveryLoading || Object.values(deliveryQuantities).every((qty) => qty === 0)}
                    style={styles.deliverButton}
                  >
                    Update Delivery
                  </Button>
                </View>
              </View>

              <Button
                mode="outlined"
                onPress={() => {
                  setModalVisible(false);
                  setSelectedOrder(null);
                  setDeliveryQuantities({});
                  setActiveMenu(null);
                }}
                style={styles.closeButton}
              >
                Close
              </Button>
            </ScrollView>
          )}
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5EDE0" },
  content: { padding: platformStyle.padding, paddingBottom: 24 },
  centered: { justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#3B3B3B" },

  title: { textAlign: "center", marginBottom: scaleSize(16), color: "#3B3B3B", fontSize: 22 },

  /* search & filters */
  searchbar: { marginBottom: scaleSize(12) },
  filterCard: { marginBottom: scaleSize(5), backgroundColor: "#FAF9F6", padding: scaleSize(3) },
  filterTitle: { marginBottom: scaleSize(8), color: "#3B3B3B" },
  statusButtons: { flexDirection: "row", paddingVertical: scaleSize(2) },
  smallFilterButton: { marginRight: scaleSize(8), borderRadius: 6 },
  smallFilterButtonActive: { backgroundColor: "#F7CAC9" },

  activeFilters: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: scaleSize(12),
    paddingHorizontal: scaleSize(4),
  },

  /* Orders Cards */
  ordersContainer: {
    gap: scaleSize(8),
  },
  orderCard: {
    backgroundColor: "#FAF9F6",
    elevation: 2,
  },
  cardContent: {
    padding: scaleSize(12),
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: scaleSize(8),
  },
  orderId: {
    fontWeight: "700",
    color: "#3B3B3B",
  },
  statusChip: {
    paddingHorizontal: scaleSize(8),
    paddingVertical: scaleSize(2),
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  cardDetails: {
    gap: scaleSize(4),
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    color: "#A08B73",
    fontSize: 12,
  },
  detailValue: {
    color: "#3B3B3B",
    fontSize: 12,
  },
  amountText: {
    fontWeight: "700",
    color: "#3B3B3B",
  },
  deliveryProgress: {
    marginTop: scaleSize(8),
    padding: scaleSize(6),
    backgroundColor: "#FFF3E0",
    borderRadius: scaleSize(4),
  },
  progressText: {
    color: "#FF9800",
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
  },

  /* empty state */
  emptyCard: { marginTop: scaleSize(20), backgroundColor: "#FAF9F6" },
  emptyContent: { alignItems: "center", padding: scaleSize(20) },
  emptyText: { textAlign: "center", color: "#3B3B3B", marginBottom: scaleSize(8) },
  emptySubtext: { textAlign: "center", color: "#A08B73", marginBottom: scaleSize(16) },
  clearFiltersButton: { backgroundColor: "#F7CAC9" },

  /* stats */
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: scaleSize(16) },
  statCard: { flex: 1, backgroundColor: "#FAF9F6" },
  statContent: { alignItems: "center", padding: scaleSize(12) },
  statNumber: { fontWeight: "700", color: "#F7CAC9", fontSize: 18 },

  /* modal */
  modalContainer: {
    backgroundColor: "white",
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: "100%",
  },
  modalContent: { paddingBottom: 20 },
  modalTitle: { textAlign: "center", marginBottom: 8, color: "#3B3B3B" },
  orderIdFull: { textAlign: "center", color: "#A08B73", marginBottom: 16 },
  modalSection: { marginBottom: 16 },

  /* PDF Button */
  pdfButtonContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  pdfButton: {
    borderColor: '#F7CAC9',
    minWidth: 200,
  },

  /* products table */
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
    fontFamily: "monospace",
    fontSize: 10,
    color: "#666",
  },
  deliveredText: {
    color: "#4CAF50",
    fontWeight: "500",
  },
  remainingText: {
    color: "#FF9800",
    fontWeight: "500",
  },
  fullyDeliveredText: {
    color: "#4CAF50",
    fontWeight: "bold",
    fontSize: 16,
  },

  /* quantity selector styles */
  quantitySelector: {
    alignItems: "flex-end",
  },
  quantityButton: {
    height: 34,
    borderColor: "#E0E0E0",
    justifyContent: "center",
  },
  quantityButtonContent: {
    height: 34,
    justifyContent: "center",
  },
  quantityButtonText: {
    fontWeight: "600",
    textAlign: "center",
    // no lineHeight zero — let text flow naturally
  },
  quantityMenu: {
    marginTop: 46,
    maxHeight: 240,
  },
  quantityMenuScroll: {
    maxHeight: 240,
  },
  quantityMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  quantityMenuItemSelected: {
    backgroundColor: "#F7CAC9",
  },
  quantityMenuText: {
    fontSize: 14,
  },
  quantityMenuTextSelected: {
    color: "#fff",
    fontWeight: "bold",
  },

  deliverySummary: {
    padding: scaleSize(8),
    backgroundColor: "#E3F2FD",
    borderRadius: scaleSize(4),
    marginBottom: scaleSize(12),
  },

  deliveryActions: {
    alignItems: "center",
  },
  deliverButton: {
    backgroundColor: "#4CAF50",
    minWidth: 200,
  },

  closeButton: {
    marginTop: scaleSize(8),
    borderColor: "#F7CAC9",
  },
});

export default OrderManagement;