import React, { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import {
  Text,
  Card,
  DataTable,
  Chip,
  Button,
  ActivityIndicator,
  Searchbar,
  Menu,
  Divider,
  Portal,
  Modal,
} from "react-native-paper";
import {
  getUsers,
  getOrdersBySalesman,
  getAttendance,
  Order,
} from "../../firebase/firestore";
import { calculateSalesmanPerformance } from "../../utils/calculateProfit";
import { scaleSize, platformStyle } from "../../utils/constants";
import { UserData } from "../../firebase/auth";

interface SalesmanWithStats extends UserData {
  performance: {
    totalOrders: number;
    deliveredOrders: number;
    totalSales: number;
    totalProfit: number;
    averageOrderValue: number;
    completionRate: number;
  };
  calculatedDiscountGiven: number;
  lastActive: Date | null;
  allOrders: Order[];
}

const SalesmanManagement: React.FC = () => {
  const [salesmen, setSalesmen] = useState<UserData[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSalesman, setSelectedSalesman] =
    useState<SalesmanWithStats | null>(null);
  const [salesmanOrders, setSalesmanOrders] = useState<Order[]>([]);
  const [salesmanAttendance, setSalesmanAttendance] = useState<any[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "sales" | "profit" | "orders">(
    "sales"
  );
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const usersData = await getUsers();

      // Filter salesmen and get their orders
      const salesmenData = usersData.filter(
        (user: any) => user.role === "salesman"
      ) as UserData[];

      // Fix: Map the data to match UserData interface
      const mappedSalesmen = salesmenData.map((salesman) => ({
        ...salesman,
        uid: salesman.id || salesman.uid, // Use id as uid if uid doesn't exist
      }));

      setSalesmen(mappedSalesmen);

      // Load orders for all salesmen
      const ordersPromises = mappedSalesmen.map((salesman) =>
        getOrdersBySalesman(salesman.uid)
      );
      const allOrdersData = await Promise.all(ordersPromises);
      const flattenedOrders = allOrdersData.flat();
      setAllOrders(flattenedOrders);
    } catch (error: any) {
      console.error("Error loading salesman data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const salesmenWithStats = useMemo((): SalesmanWithStats[] => {
    return salesmen.map((salesman) => {
      // Filter salesman's delivered orders (same logic as Dashboard)
      const salesmanOrders = allOrders.filter(
        (order) => order.salesmanId === salesman.uid
      );
      const deliveredOrders = salesmanOrders.filter(
        (order) => order.status === "Delivered"
      );

      // Calculate metrics EXACTLY like Dashboard does
      const totalOrders = salesmanOrders.length;
      const totalSales = deliveredOrders.reduce(
        (sum, order) => sum + (order?.totalAmount || 0),
        0
      );
      const totalProfit = deliveredOrders.reduce(
        (sum, order) => sum + (order?.totalProfit || 0),
        0
      );
      const pendingOrders = salesmanOrders.filter(
        (order) => order.status === "Pending"
      ).length;

      // Calculate completion rate
      const completionRate =
        totalOrders > 0 ? (deliveredOrders.length / totalOrders) * 100 : 0;
      const averageOrderValue =
        deliveredOrders.length > 0 ? totalSales / deliveredOrders.length : 0;

      // Calculate total discount given from orders
      const calculatedDiscountGiven = deliveredOrders.reduce((sum, order) => {
        return (
          sum +
          order.items.reduce(
            (itemSum, item) => itemSum + item.discountGiven * item.quantity,
            0
          )
        );
      }, 0);

      // Get latest order date
      const lastOrder = [...salesmanOrders].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

      return {
        ...salesman,
        performance: {
          totalOrders,
          deliveredOrders: deliveredOrders.length,
          totalSales,
          totalProfit,
          averageOrderValue,
          completionRate: Math.round(completionRate),
        },
        calculatedDiscountGiven,
        lastActive: lastOrder ? new Date(lastOrder.createdAt) : null,
        allOrders: salesmanOrders,
      };
    });
  }, [salesmen, allOrders]);

  // Filter and sort salesmen
  const filteredSalesmen = useMemo(() => {
    let filtered = salesmenWithStats.slice(); // copy to avoid mutating original

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (salesman) =>
          salesman.name.toLowerCase().includes(query) ||
          salesman.email.toLowerCase().includes(query)
      );
    }

    // Apply sorting - FIXED to use performance fields consistently
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "sales":
          return b.performance.totalSales - a.performance.totalSales;
        case "profit":
          return b.performance.totalProfit - a.performance.totalProfit;
        case "orders":
          return b.performance.totalOrders - a.performance.totalOrders;
        default:
          return b.performance.totalSales - a.performance.totalSales;
      }
    });

    return filtered;
  }, [salesmenWithStats, searchQuery, sortBy]);

  const loadSalesmanDetails = async (salesman: SalesmanWithStats) => {
    try {
      // Validate salesmanId before making the call
      if (!salesman.uid) {
        console.error("Invalid salesman ID:", salesman.uid);
        return;
      }

      setDetailLoading(true);
      setSelectedSalesman(salesman);

      const [orders, attendance] = await Promise.all([
        getOrdersBySalesman(salesman.uid),
        getAttendance(salesman.uid),
      ]);

      setSalesmanOrders(orders);
      setSalesmanAttendance(attendance);
      setDetailModalVisible(true);
    } catch (error) {
      console.error("Error loading salesman details:", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const getPerformanceColor = (completionRate: number) => {
    if (completionRate >= 90) return "#4CAF50";
    if (completionRate >= 70) return "#FFA000";
    return "#F44336";
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Never";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const calculateTotalAttendanceHours = (attendance: any[]) => {
    return attendance.reduce(
      (total, record) => total + (record.totalHours || 0),
      0
    );
  };

  const getSalesmanInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F7CAC9" />
        <Text style={styles.loadingText}>Loading sales team data...</Text>
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
          Sales Team Management
        </Text>

        {/* Search and Sort */}
        <View style={styles.controlsRow}>
          <Searchbar
            placeholder="Search salesmen..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchbar}
            icon={searchQuery ? "close" : "magnify"}
            onIconPress={searchQuery ? () => setSearchQuery("") : undefined}
          />

          <Menu
            visible={sortMenuVisible}
            onDismiss={() => setSortMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setSortMenuVisible(true)}
                style={styles.sortButton}
                icon="sort"
              >
                {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
              </Button>
            }
          >
            <Menu.Item
              onPress={() => {
                setSortBy("name");
                setSortMenuVisible(false);
              }}
              title="By Name"
              leadingIcon={sortBy === "name" ? "check" : undefined}
            />
            <Menu.Item
              onPress={() => {
                setSortBy("sales");
                setSortMenuVisible(false);
              }}
              title="By Sales"
              leadingIcon={sortBy === "sales" ? "check" : undefined}
            />
            <Menu.Item
              onPress={() => {
                setSortBy("profit");
                setSortMenuVisible(false);
              }}
              title="By Profit"
              leadingIcon={sortBy === "profit" ? "check" : undefined}
            />
            <Menu.Item
              onPress={() => {
                setSortBy("orders");
                setSortMenuVisible(false);
              }}
              title="By Orders"
              leadingIcon={sortBy === "orders" ? "check" : undefined}
            />
          </Menu>
        </View>

        {/* Summary Stats */}
        <View style={styles.summaryGrid}>
          <Card style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryValue}>{salesmen.length}</Text>
              <Text style={styles.summaryLabel}>Total Salesmen</Text>
            </Card.Content>
          </Card>

          <Card style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryValue}>
                {formatCurrency(
                  salesmenWithStats.reduce(
                    (sum, s) => sum + s.performance.totalSales,
                    0
                  )
                )}
              </Text>
              <Text style={styles.summaryLabel}>Total Sales</Text>
            </Card.Content>
          </Card>

          <Card style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryValue}>
                {formatCurrency(
                  salesmenWithStats.reduce(
                    (sum, s) => sum + s.performance.totalProfit,
                    0
                  )
                )}
              </Text>
              <Text style={styles.summaryLabel}>Total Profit</Text>
            </Card.Content>
          </Card>

          <Card style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryValue}>
                {salesmenWithStats.reduce(
                  (sum, s) => sum + s.performance.totalOrders,
                  0
                )}
              </Text>
              <Text style={styles.summaryLabel}>Total Orders</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Salesmen List */}
        <Card style={styles.listCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.listTitle}>
              Sales Team Performance
            </Text>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title style={styles.nameColumn}>
                  Salesman
                </DataTable.Title>
                <DataTable.Title numeric style={styles.ordersColumn}>
                  Orders
                </DataTable.Title>
                <DataTable.Title numeric style={styles.salesColumn}>
                  Sales
                </DataTable.Title>
                <DataTable.Title numeric style={styles.performanceColumn}>
                  Performance
                </DataTable.Title>
              </DataTable.Header>

              {filteredSalesmen.map((salesman) => (
                <DataTable.Row
                  key={salesman.uid}
                  onPress={() => loadSalesmanDetails(salesman)}
                  style={styles.salesmanRow}
                >
                  <DataTable.Cell style={styles.nameColumn}>
                    <View style={styles.salesmanInfo}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {getSalesmanInitials(salesman.name)}
                        </Text>
                      </View>
                      <View style={styles.salesmanDetails}>
                        <Text style={styles.salesmanName}>{salesman.name}</Text>
                        <Text style={styles.salesmanEmail}>
                          {salesman.email}
                        </Text>
                        <Text style={styles.lastActive}>
                          Last: {formatDate(salesman.lastActive)}
                        </Text>
                      </View>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={styles.ordersColumn}>
                    <View style={styles.ordersCell}>
                      <Text style={styles.ordersTotal}>
                        {salesman.performance.totalOrders}
                      </Text>
                      <Text style={styles.ordersDelivered}>
                        {salesman.performance.deliveredOrders} delivered
                      </Text>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={styles.salesColumn}>
                    <View style={styles.salesCell}>
                      <Text style={styles.salesAmount}>
                        {formatCurrency(salesman.performance.totalSales)}
                      </Text>
                      <Text style={styles.salesProfit}>
                        {formatCurrency(salesman.performance.totalProfit)}{" "}
                        profit
                      </Text>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={styles.performanceColumn}>
                    <Chip
                      mode="outlined"
                      style={styles.performanceChip}
                      textStyle={{
                        color: getPerformanceColor(
                          salesman.performance.completionRate
                        ),
                        fontSize: 15,
                        fontWeight: "bold",
                      }}
                    >
                      {salesman.performance.completionRate}%
                    </Chip>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>

            {filteredSalesmen.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {salesmen.length === 0
                    ? "No salesmen found in the system"
                    : "No salesmen match your search criteria"}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Salesman Detail Modal */}
      <Portal>
        <Modal
          visible={detailModalVisible}
          onDismiss={() => setDetailModalVisible(false)}
          contentContainerStyle={styles.modalContainer} // outer container (NO overflow here)
        >
          {/* INNER wrapper - plain View keeps clipping without affecting Surface shadow */}
          <View style={styles.modalInner}>
            {selectedSalesman && (
              <ScrollView>
                <View style={styles.modalHeader}>
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>
                      {getSalesmanInitials(selectedSalesman.name)}
                    </Text>
                  </View>
                  <View style={styles.modalTitleContainer}>
                    <Text variant="titleLarge" style={styles.modalTitle}>
                      {selectedSalesman.name}
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      {selectedSalesman.email}
                    </Text>
                    <Text style={styles.modalPhone}>
                      {selectedSalesman.phone || "No phone number"}
                    </Text>
                    <Text style={styles.modalMemberSince}>
                      Member since: {formatDate(selectedSalesman.createdAt)}
                    </Text>
                  </View>
                </View>

                {detailLoading ? (
                  <View style={styles.detailLoading}>
                    <ActivityIndicator size="small" color="#F7CAC9" />
                    <Text style={styles.detailLoadingText}>
                      Loading details...
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Performance Summary */}
                    <Card style={styles.detailCard}>
                      <Card.Content>
                        <Text variant="titleSmall" style={styles.detailCardTitle}>
                          📊 Performance Summary
                        </Text>
                        <View style={styles.statsGrid}>
                          <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                              {selectedSalesman.performance.totalOrders}
                            </Text>
                            <Text style={styles.statLabel}>Total Orders</Text>
                          </View>
                          <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                              {selectedSalesman.performance.deliveredOrders}
                            </Text>
                            <Text style={styles.statLabel}>Delivered</Text>
                          </View>
                          <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                              {formatCurrency(
                                selectedSalesman.performance.totalSales
                              )}
                            </Text>
                            <Text style={styles.statLabel}>Total Sales</Text>
                          </View>
                          <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                              {formatCurrency(
                                selectedSalesman.performance.totalProfit
                              )}
                            </Text>
                            <Text style={styles.statLabel}>Total Profit</Text>
                          </View>
                        </View>

                        <View style={styles.additionalStats}>
                          <View style={styles.additionalStat}>
                            <Text style={styles.additionalStatLabel}>
                              Completion Rate:
                            </Text>
                            <Text
                              style={[
                                styles.additionalStatValue,
                                {
                                  color: getPerformanceColor(
                                    selectedSalesman.performance.completionRate
                                  ),
                                },
                              ]}
                            >
                              {selectedSalesman.performance.completionRate}%
                            </Text>
                          </View>
                          <View style={styles.additionalStat}>
                            <Text style={styles.additionalStatLabel}>
                              Avg Order Value:
                            </Text>
                            <Text style={styles.additionalStatValue}>
                              {formatCurrency(
                                selectedSalesman.performance.averageOrderValue
                              )}
                            </Text>
                          </View>
                          <View style={styles.additionalStat}>
                            <Text style={styles.additionalStatLabel}>
                              Total Discount Given:
                            </Text>
                            <Text style={styles.additionalStatValue}>
                              {formatCurrency(
                                selectedSalesman.calculatedDiscountGiven
                              )}
                            </Text>
                          </View>
                          {selectedSalesman.maxDiscountPercent &&
                            selectedSalesman.maxDiscountPercent > 0 && (
                              <View style={styles.additionalStat}>
                                <Text style={styles.additionalStatLabel}>
                                  Max Discount Allowed:
                                </Text>
                                <Text style={styles.additionalStatValue}>
                                  {selectedSalesman.maxDiscountPercent}%
                                </Text>
                              </View>
                            )}
                        </View>
                      </Card.Content>
                    </Card>

                    {/* Recent Orders */}
                    <Card style={styles.detailCard}>
                      <Card.Content>
                        <Text variant="titleSmall" style={styles.detailCardTitle}>
                          📦 Recent Orders ({salesmanOrders.length})
                        </Text>
                        {salesmanOrders.slice(0, 5).map((order) => (
                          <View key={order.id} style={styles.orderItem}>
                            <View style={styles.orderInfo}>
                              <Text style={styles.orderId}>
                                Order #{order.id?.substring(0, 8)}
                              </Text>
                              <Text style={styles.orderDate}>
                                {new Date(order.createdAt).toLocaleDateString()}
                              </Text>
                              <Text style={styles.orderItems}>
                                {order.items.length} items •{" "}
                                {formatCurrency(order.totalAmount)}
                              </Text>
                            </View>
                            <View style={styles.orderDetails}>
                              <Chip
                                compact
                                textStyle={{
                                  fontSize: 14,
                                  justifyContent: "center",
                                  fontWeight: "bold",
                                  alignItems: "center",
                                }}
                                style={[
                                  styles.statusChip,
                                  order.status === "Delivered" &&
                                    styles.deliveredChip,
                                  order.status === "Pending" &&
                                    styles.pendingChip,
                                  order.status === "Shipped" &&
                                    styles.shippedChip,
                                  order.status === "Packed" && styles.packedChip,
                                ]}
                              >
                                {order.status}
                              </Chip>
                            </View>
                          </View>
                        ))}
                        {salesmanOrders.length === 0 && (
                          <Text style={styles.noDataText}>
                            No orders found for this salesman
                          </Text>
                        )}
                      </Card.Content>
                    </Card>

                    {/* Attendance Summary */}
                    <Card style={styles.detailCard}>
                      <Card.Content>
                        <Text variant="titleSmall" style={styles.detailCardTitle}>
                          ⏰ Attendance Summary
                        </Text>
                        <View style={styles.attendanceSummary}>
                          <View style={styles.attendanceStat}>
                            <Text style={styles.attendanceStatValue}>
                              {calculateTotalAttendanceHours(
                                salesmanAttendance
                              ).toFixed(1)}
                              h
                            </Text>
                            <Text style={styles.attendanceStatLabel}>
                              Total Hours
                            </Text>
                          </View>
                          <View style={styles.attendanceStat}>
                            <Text style={styles.attendanceStatValue}>
                              {salesmanAttendance.length}
                            </Text>
                            <Text style={styles.attendanceStatLabel}>
                              Total Days
                            </Text>
                          </View>
                          <View style={styles.attendanceStat}>
                            <Text style={styles.attendanceStatValue}>
                              {salesmanAttendance.length > 0
                                ? (
                                    calculateTotalAttendanceHours(
                                      salesmanAttendance
                                    ) / salesmanAttendance.length
                                  ).toFixed(1)
                                : 0}
                              h
                            </Text>
                            <Text style={styles.attendanceStatLabel}>
                              Avg per Day
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.attendanceSubtitle}>
                          Recent Attendance:
                        </Text>
                        {salesmanAttendance.slice(0, 5).map((record, index) => (
                          <View key={index} style={styles.attendanceItem}>
                            <Text style={styles.attendanceDate}>
                              {new Date(record.date).toLocaleDateString()}
                            </Text>
                            <View style={styles.attendanceDetails}>
                              <Text style={styles.attendanceHours}>
                                {record.totalHours || 0}h
                              </Text>
                              {record.loginTime && (
                                <Text style={styles.attendanceTime}>
                                  {new Date(record.loginTime).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" }
                                  )}
                                </Text>
                              )}
                            </View>
                          </View>
                        ))}
                        {salesmanAttendance.length === 0 && (
                          <Text style={styles.noDataText}>
                            No attendance records found
                          </Text>
                        )}
                      </Card.Content>
                    </Card>
                  </>
                )}

                <Button
                  mode="contained"
                  onPress={() => setDetailModalVisible(false)}
                  style={styles.closeButton}
                  labelStyle={styles.closeButtonLabel}
                >
                  Close Details
                </Button>
              </ScrollView>
            )}
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

// ... (keep all the same styles from the previous implementation)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5EDE0",
  },
  content: {
    padding: platformStyle.padding,
    paddingBottom: 20,
  },
  title: {
    textAlign: "center",
    marginBottom: scaleSize(20),
    color: "#3B3B3B",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: scaleSize(16),
    gap: scaleSize(12),
  },
  searchbar: {
    flex: 1,
  },
  sortButton: {
    backgroundColor: "#FAF9F6",
    minWidth: 100,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: scaleSize(20),
    gap: scaleSize(12),
  },
  summaryCard: {
    width: "48%",
    backgroundColor: "#FAF9F6",
  },
  summaryContent: {
    alignItems: "center",
    padding: scaleSize(12),
  },
  summaryValue: {
    fontSize: scaleSize(16),
    fontWeight: "bold",
    color: "#F7CAC9",
    marginBottom: scaleSize(4),
  },
  summaryLabel: {
    fontSize: scaleSize(10),
    color: "#3B3B3B",
    textAlign: "center",
  },
  listCard: {
    backgroundColor: "#FAF9F6",
  },
  listTitle: {
    textAlign: "center",
    marginBottom: scaleSize(16),
    color: "#3B3B3B",
  },
  // Table column styles
  nameColumn: { flex: 3 },
  ordersColumn: { flex: 1.5 },
  salesColumn: { flex: 2 },
  performanceColumn: { flex: 1.5 },
  salesmanRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  salesmanInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: scaleSize(25),
    height: scaleSize(25),
    borderRadius: scaleSize(20),
    backgroundColor: "#F7CAC9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: scaleSize(12),
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: scaleSize(10),
  },
  salesmanDetails: {
    flex: 1,
  },
  salesmanName: {
    fontSize: scaleSize(8),
    fontWeight: "600",
    color: "#3B3B3B",
    marginBottom: scaleSize(2),
  },
  salesmanEmail: {
    fontSize: scaleSize(5),
    color: "#A08B73",
    marginBottom: scaleSize(2),
  },
  lastActive: {
    fontSize: scaleSize(5),
    color: "#A08B73",
    fontStyle: "italic",
  },
  ordersCell: {
    alignItems: "flex-end",
  },
  ordersTotal: {
    fontSize: scaleSize(9),
    fontWeight: "bold",
    color: "#3B3B3B",
  },
  ordersDelivered: {
    fontSize: scaleSize(7),
    color: "#4CAF50",
  },
  salesCell: {
    alignItems: "flex-end",
  },
  salesAmount: {
    fontSize: scaleSize(9),
    fontWeight: "bold",
    color: "#3B3B3B",
  },
  salesProfit: {
    fontSize: scaleSize(7),
    color: "#4CAF50",
  },
  performanceChip: {
    height: scaleSize(15),
    backgroundColor: "transparent",
  },
  emptyState: {
    padding: scaleSize(20),
    alignItems: "center",
  },
  emptyText: {
    textAlign: "center",
    color: "#A08B73",
    fontStyle: "italic",
  },
  // MODAL OUTER - keep shadows/elevation. IMPORTANT: NO overflow here.
  modalContainer: {
    backgroundColor: "white",
    margin: 20,
    borderRadius: 30,
    height: "80%",
    // overflow: "hidden", // REMOVED to prevent react-native-paper Surface shadow clipping warning
    padding: 30,
  },
  // INNER plain View - handles clipping safely
  modalInner: {
    backgroundColor: "white",
    width: "100%",
    height: "100%",
    borderRadius: 30,
    overflow: "hidden", // safe because this is a plain View
    padding: 0, // we've already applied padding on modalContainer
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: scaleSize(20),
    backgroundColor: "#FAF9F6",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalAvatar: {
    width: scaleSize(60),
    height: scaleSize(60),
    borderRadius: scaleSize(30),
    backgroundColor: "#F7CAC9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: scaleSize(16),
  },
  modalAvatarText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: scaleSize(18),
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    color: "#3B3B3B",
    marginBottom: scaleSize(4),
  },
  modalSubtitle: {
    color: "#A08B73",
    fontSize: scaleSize(12),
    marginBottom: scaleSize(2),
  },
  modalPhone: {
    color: "#A08B73",
    fontSize: scaleSize(12),
  },
  modalMemberSince: {
    color: "#A08B73",
    fontSize: scaleSize(11),
    fontStyle: "italic",
  },
  detailLoading: {
    padding: scaleSize(40),
    alignItems: "center",
  },
  detailLoadingText: {
    marginTop: scaleSize(12),
    color: "#A08B73",
  },
  detailCard: {
    margin: scaleSize(16),
    backgroundColor: "#FAF9F6",
    padding: 20,
  },
  detailCardTitle: {
    color: "#3B3B3B",
    marginBottom: scaleSize(12),
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: scaleSize(16),
  },
  statItem: {
    alignItems: "center",
    width: "48%",
    padding: scaleSize(8),
    marginBottom: scaleSize(8),
  },
  statValue: {
    fontSize: scaleSize(18),
    fontWeight: "bold",
    color: "#F7CAC9",
    marginBottom: scaleSize(4),
  },
  statLabel: {
    fontSize: scaleSize(10),
    color: "#3B3B3B",
    textAlign: "center",
  },
  additionalStats: {
    marginTop: scaleSize(8),
  },
  additionalStat: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: scaleSize(6),
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  additionalStatLabel: {
    fontSize: scaleSize(12),
    color: "#3B3B3B",
  },
  additionalStatValue: {
    fontSize: scaleSize(12),
    fontWeight: "600",
  },
  orderItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: scaleSize(10),
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: scaleSize(9),
    fontWeight: "600",
    color: "#3B3B3B",
    marginBottom: scaleSize(2),
  },
  orderDate: {
    fontSize: scaleSize(7),
    color: "#A08B73",
    marginBottom: scaleSize(2),
  },
  orderItems: {
    fontSize: scaleSize(7),
    color: "#A08B73",
  },
  orderDetails: {
    alignItems: "flex-end",
  },
  statusChip: {
    height: scaleSize(20),
    minWidth: scaleSize(45),
  },
  deliveredChip: {
    backgroundColor: "#E8F5E8",
  },
  pendingChip: {
    backgroundColor: "#FFF3E0",
  },
  shippedChip: {
    backgroundColor: "#E3F2FD",
  },
  packedChip: {
    backgroundColor: "#F3E5F5",
  },
  attendanceSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: scaleSize(16),
    padding: scaleSize(12),
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
  },
  attendanceStat: {
    alignItems: "center",
  },
  attendanceStatValue: {
    fontSize: scaleSize(16),
    fontWeight: "bold",
    color: "#F7CAC9",
    marginBottom: scaleSize(4),
  },
  attendanceStatLabel: {
    fontSize: scaleSize(10),
    color: "#3B3B3B",
  },
  attendanceSubtitle: {
    fontSize: scaleSize(12),
    fontWeight: "600",
    color: "#3B3B3B",
    marginBottom: scaleSize(8),
  },
  attendanceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: scaleSize(8),
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  attendanceDate: {
    fontSize: scaleSize(12),
    color: "#3B3B3B",
  },
  attendanceDetails: {
    alignItems: "flex-end",
  },
  attendanceHours: {
    fontSize: scaleSize(12),
    fontWeight: "600",
    color: "#F7CAC9",
  },
  attendanceTime: {
    fontSize: scaleSize(10),
    color: "#A08B73",
  },
  noDataText: {
    textAlign: "center",
    color: "#A08B73",
    fontStyle: "italic",
    padding: scaleSize(16),
  },
  closeButton: {
    margin: scaleSize(16),
    backgroundColor: "#F7CAC9",
  },
  closeButtonLabel: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5EDE0",
  },
  loadingText: {
    marginTop: scaleSize(16),
    color: "#3B3B3B",
  },
});

export default SalesmanManagement;
