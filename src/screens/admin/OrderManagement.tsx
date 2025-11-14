// src/screens/admin/OrderManagement.tsx
import React, { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
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
} from "react-native-paper";
import {
  Order,
  getAllOrders,
  updateOrderStatus,
  getCustomers,
  getUsers,
} from "../../firebase/firestore";
import { scaleSize, platformStyle } from "../../utils/constants";

const OrderManagement: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [salesmen, setSalesmen] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Simple filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [salesmanFilter, setSalesmanFilter] = useState<string>("all");

  // Order details modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

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
      const salesmenData = (usersData || []).filter(
        (user: any) => user.role === "salesman"
      );
      setSalesmen(salesmenData);
    } catch (error: any) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // -------------------
  // Helper functions — moved above useMemo so they're defined before use
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
    const d =
      typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending":
        return "#FFA000";
      case "Packed":
        return "#2196F3";
      case "Shipped":
        return "#673AB7";
      case "Delivered":
        return "#4CAF50";
      default:
        return "#757575";
    }
  };

  const getNextStatus = (currentStatus: string): Order["status"] | null => {
    switch (currentStatus) {
      case "Pending":
        return "Packed";
      case "Packed":
        return "Shipped";
      case "Shipped":
        return "Delivered";
      case "Delivered":
        return null;
      default:
        return null;
    }
  };

  // -------------------
  // Memoized filtered orders (now safe to call helpers)
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
      filtered = filtered.filter((order) =>
        (getCustomerName(order.customerId) || "").toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [orders, statusFilter, salesmanFilter, searchQuery, customers, salesmen]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const updateStatus = async (orderId: string, newStatus: Order["status"]) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      // Optimistically update local state
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId ? { ...order, status: newStatus, updatedAt: new Date() } : order
        )
      );
    } catch (error: any) {
      console.error("Error updating order status:", error);
    }
  };

  const clearAllFilters = () => {
    setStatusFilter("all");
    setSalesmanFilter("all");
    setSearchQuery("");
  };

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
          placeholder="Search by customer name..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          icon={searchQuery ? "close" : "magnify"}
          onIconPress={searchQuery ? () => setSearchQuery("") : undefined}
        />

        {/* Filters */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.filterTitle}>Order Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.statusButtons}>
                {["all", "Pending", "Packed", "Shipped", "Delivered"].map((s) => (
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
            <Text variant="titleSmall" style={styles.filterTitle}>Salesman</Text>
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
              <Button mode="text" compact onPress={clearAllFilters} textColor="#F7CAC9" icon="close">Clear</Button>
            </View>
          ) : null;
        })()}

        {/* Orders Table */}
        {filteredOrders.length > 0 ? (
          <DataTable style={styles.table}>
            <DataTable.Header style={styles.tableHeader}>
              <DataTable.Title style={styles.colOrder}>Order / Customer</DataTable.Title>
              <DataTable.Title style={styles.colDate}>Date</DataTable.Title>
              <DataTable.Title style={styles.colStatus}>Status</DataTable.Title>
              <DataTable.Title numeric style={styles.colAmount}>Amount</DataTable.Title>
              <DataTable.Title style={styles.colAction}>Action</DataTable.Title>
            </DataTable.Header>

            {filteredOrders.map((order) => {
              const nextStatus = getNextStatus(order.status);
              return (
                <DataTable.Row key={order.id} onPress={() => { setSelectedOrder(order); setModalVisible(true); }} style={styles.tableRow}>
                  <DataTable.Cell style={styles.colOrder}>
                    <View style={styles.cellInner}>
                      <Text style={styles.orderIdText}>#{String(order.id).substring(0, 8)}</Text>
                      <Text style={styles.customerText}>{getCustomerName(order.customerId)}</Text>
                      <Text style={styles.dateSmallText}>{getSalesmanName(order.salesmanId)}</Text>
                    </View>
                  </DataTable.Cell>

                  <DataTable.Cell style={styles.colDate}>
                    <View style={styles.cellInner}>
                      <Text style={styles.dateText}>{formatDate(order.createdAt)}</Text>
                      <Text style={styles.timeText}>{order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                    </View>
                  </DataTable.Cell>

                  <DataTable.Cell style={styles.colStatus}>
                    <View style={styles.statusCell}>
                      <Chip compact style={[styles.statusChip, { backgroundColor: getStatusColor(order.status) }]} textStyle={styles.statusText}>
                        {order.status}
                      </Chip>
                    </View>
                  </DataTable.Cell>

                  <DataTable.Cell numeric style={styles.colAmount}>
                    <View style={styles.amountCell}>
                      <Text style={styles.amountText}>${order.totalAmount.toFixed(0)}</Text>
                      <Text style={styles.profitText}>+${order.totalProfit.toFixed(0)}</Text>
                    </View>
                  </DataTable.Cell>

                  <DataTable.Cell style={styles.colAction}>
                    {nextStatus ? (
                      <Button mode="contained" compact onPress={(e) => { e.stopPropagation(); updateStatus(order.id!, nextStatus); }} contentStyle={styles.nextButtonContent} style={styles.nextButton} labelStyle={styles.nextButtonLabel}>
                        {nextStatus}
                      </Button>
                    ) : (
                      <Text style={styles.noActionText}>—</Text>
                    )}
                  </DataTable.Cell>
                </DataTable.Row>
              );
            })}
          </DataTable>
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Text variant="titleMedium" style={styles.emptyText}>No orders found</Text>
              <Text variant="bodyMedium" style={styles.emptySubtext}>
                {orders.length === 0 ? "There are no orders in the system yet." : "No orders match your current filters."}
              </Text>
              {((statusFilter !== 'all') || (salesmanFilter !== 'all') || searchQuery.trim()) && (
                <Button mode="contained" onPress={clearAllFilters} style={styles.clearFiltersButton}>Clear Filters</Button>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <Text variant="headlineSmall" style={styles.statNumber}>{orders.length}</Text>
              <Text variant="bodySmall">Total Orders</Text>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <Text variant="headlineSmall" style={styles.statNumber}>
                ${orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0).toFixed(0)}
              </Text>
              <Text variant="bodySmall">Total Sales</Text>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>

      {/* Modal */}
      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modalContainer}>
          {selectedOrder && (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text variant="titleLarge" style={styles.modalTitle}>Order Details</Text>
              <Text variant="bodySmall" style={styles.orderIdFull}>#{selectedOrder.id}</Text>

              <View style={styles.modalSection}>
                <Text variant="titleSmall">Customer & Salesman</Text>
                <Text variant="bodyMedium">Customer: {getCustomerName(selectedOrder.customerId)}</Text>
                <Text variant="bodyMedium">Salesman: {getSalesmanName(selectedOrder.salesmanId)}</Text>
              </View>

              <View style={styles.modalSection}>
                <Text variant="titleSmall">Order Items</Text>
                {selectedOrder.items.map((item, index) => (
                  <Card key={index} style={styles.itemCard}>
                    <Card.Content>
                      <Text variant="bodyMedium" style={styles.productName}>{item.productName}</Text>
                      <Text variant="bodySmall">Size: {item.size} | Color: {item.color} | Qty: {item.quantity}</Text>
                      <Text variant="bodySmall">Price: ${item.finalPrice.toFixed(2)} each</Text>
                    </Card.Content>
                  </Card>
                ))}
              </View>

              <View style={styles.modalSection}>
                <Text variant="titleSmall">Order Summary</Text>
                <View style={styles.summaryRow}><Text>Total Amount:</Text><Text>${selectedOrder.totalAmount.toFixed(2)}</Text></View>
                <View style={styles.summaryRow}><Text>Total Profit:</Text><Text style={styles.profitText}>${selectedOrder.totalProfit.toFixed(2)}</Text></View>
              </View>

              <Button mode="contained" onPress={() => setModalVisible(false)} style={styles.closeButton}>Close</Button>
            </ScrollView>
          )}
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  /* layout */
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

  /* table layout - columns */
  table: { backgroundColor: "transparent" },
  tableHeader: { backgroundColor: "transparent", borderBottomWidth: 0, paddingVertical: scaleSize(4) },

  colOrder: { flex: 2, paddingLeft: 6, alignItems: "flex-start" },
  colDate: { flex: 1, alignItems: "flex-start" },
  colStatus: { flex: 1.2, alignItems: "flex-start" },
  colAmount: { flex: 1, paddingRight: 8, alignItems: "flex-end" },
  colAction: { flex: 1, alignItems: "center" },

  tableRow: { minHeight: 72, borderBottomWidth: 0, paddingVertical: scaleSize(8) },

  cellInner: { paddingVertical: 2 },
  orderIdText: { fontWeight: "700", color: "#3B3B3B", fontSize: 13 },
  customerText: { color: "#3B3B3B", fontSize: 12, marginTop: 4 },
  dateSmallText: { color: "#A08B73", fontSize: 11 },

  dateText: { color: "#3B3B3B", fontSize: 13, fontWeight: "600" },
  timeText: { color: "#A08B73", fontSize: 11, marginTop: 2 },

  /* status chip */
  statusCell: { justifyContent: "center" },
  statusChip: {
    paddingHorizontal: scaleSize(3),
    paddingVertical: scaleSize(2),
    borderRadius: 18,
    minWidth: 84,
    justifyContent: "center",
    alignItems: "center",
  },
  statusText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  amountCell: { alignItems: "flex-end", paddingRight: 8 },
  amountText: { fontWeight: "700", color: "#3B3B3B", fontSize: 13 },
  profitText: { color: "#4CAF50", fontSize: 11, marginTop: 4 },

  nextButton: { backgroundColor: "#F7CAC9", alignSelf: "center", borderRadius: 6, paddingHorizontal: 8 },
  nextButtonContent: { height: 34 },
  nextButtonLabel: { color: "#3B3B3B", fontWeight: "700" },
  noActionText: { color: "#A08B73" },

  /* empty state */
  emptyCard: { marginTop: scaleSize(20), backgroundColor: "#FAF9F6" },
  emptyContent: { alignItems: "center", padding: scaleSize(20) },
  emptyText: { textAlign: "center", color: "#3B3B3B", marginBottom: scaleSize(8) },
  emptySubtext: { textAlign: "center", color: "#A08B73", marginBottom: scaleSize(16) },
  clearFiltersButton: { backgroundColor: "#F7CAC9" },

  /* stats */
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: scaleSize(16) },
  statCard: { flex: 1, backgroundColor: "#FAF9F6", marginRight: scaleSize(8) },
  statContent: { alignItems: "center", padding: scaleSize(12) },
  statNumber: { fontWeight: "700", color: "#F7CAC9", fontSize: 18 },

  /* modal */
  modalContainer: { backgroundColor: "white", padding: 20, margin: 20, borderRadius: 8, maxHeight: "100%" },
  modalContent: { paddingBottom: 20 },
  modalTitle: { textAlign: "center", marginBottom: 8, color: "#3B3B3B" },
  orderIdFull: { textAlign: "center", color: "#A08B73", marginBottom: 16 },
  modalSection: { marginBottom: 16 },
  itemCard: { marginVertical: 4, backgroundColor: "#FAF9F6" },
  productName: { fontWeight: "700", color: "#3B3B3B" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 2 },
  closeButton: { marginTop: 16, backgroundColor: "#F7CAC9" },
});

export default OrderManagement;
