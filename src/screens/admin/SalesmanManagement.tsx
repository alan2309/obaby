// src/screens/admin/SalesmanManagement.tsx
import React, { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from "react-native";
import {
  Text,
  Card,
  DataTable,
  Chip,
  Button,
  ActivityIndicator,
  Searchbar,
  Portal,
  Modal,
  TextInput,
  Dialog,
} from "react-native-paper";
import {
  getUsers,
  getOrdersBySalesman,
  getAttendance,
  Order,
} from "../../firebase/firestore";
import { registerSalesman, UserData } from "../../firebase/auth";
import { scaleSize, platformStyle } from "../../utils/constants";

interface SalesmanWithStats extends UserData {
  performance: {
    totalOrders: number;
    deliveredOrders: number;
    totalSales: number;
    totalProductsSold: number;
    averageOrderValue: number;
    completionRate: number;
  };
  calculatedDiscountGiven: number;
  lastActive: Date | null;
  allOrders: Order[];
  isTopPerformer: boolean;
}

const SalesmanManagement: React.FC = () => {
  const [salesmen, setSalesmen] = useState<UserData[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSalesman, setSelectedSalesman] = useState<SalesmanWithStats | null>(null);
  const [salesmanOrders, setSalesmanOrders] = useState<Order[]>([]);
  const [salesmanAttendance, setSalesmanAttendance] = useState<any[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Add Salesman Dialog State
  const [addDialogVisible, setAddDialogVisible] = useState(false);
  const [newSalesman, setNewSalesman] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    password: "",
    maxDiscountPercent: "10",
  });
  const [creatingSalesman, setCreatingSalesman] = useState(false);

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
      // Map the data to match UserData interface
      const mappedSalesmen = salesmenData.map((salesman) => ({
        ...salesman,
        uid: salesman.id || salesman.uid,
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
      Alert.alert("Error", "Failed to load salesman data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Calculate total products sold from orders
  const calculateTotalProductsSold = (orders: Order[]): number => {
    return orders.reduce((total, order) => {
      return total + order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }, 0);
  };

  const salesmenWithStats = useMemo((): SalesmanWithStats[] => {
    const salesmenStats = salesmen.map((salesman) => {
      const salesmanOrders = allOrders.filter(
        (order) => order.salesmanId === salesman.uid
      );
      const deliveredOrders = salesmanOrders.filter(
        (order) => order.status === "Delivered"
      );

      const totalOrders = salesmanOrders.length;
      const totalSales = deliveredOrders.reduce(
        (sum, order) => sum + (order?.totalAmount || 0),
        0
      );
      const totalProductsSold = calculateTotalProductsSold(deliveredOrders);

      const completionRate =
        totalOrders > 0 ? (deliveredOrders.length / totalOrders) * 100 : 0;
      const averageOrderValue =
        deliveredOrders.length > 0 ? totalSales / deliveredOrders.length : 0;

      const calculatedDiscountGiven = deliveredOrders.reduce((sum, order) => {
        return (
          sum +
          order.items.reduce(
            (itemSum, item) => itemSum + item.discountGiven * item.quantity,
            0
          )
        );
      }, 0);

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
          totalProductsSold,
          averageOrderValue,
          completionRate: Math.round(completionRate),
        },
        calculatedDiscountGiven,
        lastActive: lastOrder ? new Date(lastOrder.createdAt) : null,
        allOrders: salesmanOrders,
        isTopPerformer: false,
      };
    });

    // Mark top performers (top 3 by products sold)
    const sortedByProductsSold = [...salesmenStats].sort(
      (a, b) => b.performance.totalProductsSold - a.performance.totalProductsSold
    );
    
    return salesmenStats.map(salesman => ({
      ...salesman,
      isTopPerformer: sortedByProductsSold.indexOf(salesman) < 3 && salesman.performance.totalProductsSold > 0
    }));
  }, [salesmen, allOrders]);

  // Filter salesmen based on search
  const filteredSalesmen = useMemo(() => {
    if (!searchQuery.trim()) {
      return salesmenWithStats;
    }

    const query = searchQuery.toLowerCase().trim();
    return salesmenWithStats.filter(
      (salesman) =>
        salesman.name.toLowerCase().includes(query) ||
        salesman.email.toLowerCase().includes(query) ||
        salesman.uid.toLowerCase().includes(query) ||
        salesman.city.toLowerCase().includes(query)
    );
  }, [salesmenWithStats, searchQuery]);

  const loadSalesmanDetails = async (salesman: SalesmanWithStats) => {
    try {
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
      Alert.alert("Error", "Failed to load salesman details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAddSalesman = async () => {
    if (!newSalesman.name || !newSalesman.email || !newSalesman.phone || !newSalesman.city || !newSalesman.password) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }

    if (!newSalesman.email.includes('@')) {
      Alert.alert("Error", "Please enter a valid email");
      return;
    }

    try {
      setCreatingSalesman(true);
      await registerSalesman(
        newSalesman.email,
        newSalesman.password,
        newSalesman.name,
        newSalesman.phone,
        newSalesman.city,
      );

      Alert.alert("Success", "Salesman account created successfully!");
      setAddDialogVisible(false);
      setNewSalesman({
        name: "",
        email: "",
        phone: "",
        city: "",
        password: "",
        maxDiscountPercent: "10",
      });
      loadData();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create salesman account");
    } finally {
      setCreatingSalesman(false);
    }
  };

  // Performance color based on products sold
  const getPerformanceColor = (productsSold: number) => {
    if (productsSold >= 1000) return "#4CAF50";
    if (productsSold >= 500) return "#FFA000";
    if (productsSold >= 100) return "#FF9800";
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
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
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

        {/* Search and Add Button */}
        <View style={styles.controlsRow}>
          <Searchbar
            placeholder="Search salesmen by name, email, city, or ID..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchbar}
            icon={searchQuery ? "close" : "magnify"}
            onIconPress={searchQuery ? () => setSearchQuery("") : undefined}
          />
          <Button
            mode="contained"
            onPress={() => setAddDialogVisible(true)}
            style={styles.addButton}
            icon="account-plus"
          >
            Add Distributor
          </Button>
        </View>

        {/* Summary Stats */}
        <View style={styles.summaryGrid}>
          <Card style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryValue}>{salesmen.length}</Text>
              <Text style={styles.summaryLabel}>Total Distributors</Text>
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
                {salesmenWithStats.reduce(
                  (sum, s) => sum + s.performance.totalProductsSold,
                  0
                ).toLocaleString()}
              </Text>
              <Text style={styles.summaryLabel}>Items Sold</Text>
            </Card.Content>
          </Card>

          <Card style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryValue}>
                {salesmenWithStats.filter(s => s.isTopPerformer).length}
              </Text>
              <Text style={styles.summaryLabel}>Top Performers</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Salesmen List */}
        <Card style={styles.listCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.listTitle}>
              Distributors Performance
            </Text>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title style={styles.nameColumn}>
                  Salesman
                </DataTable.Title>
                <DataTable.Title style={styles.cityColumn}>
                  City
                </DataTable.Title>
                <DataTable.Title numeric style={styles.ordersColumn}>
                  Orders
                </DataTable.Title>
                <DataTable.Title numeric style={styles.salesColumn}>
                  Sales
                </DataTable.Title>
                <DataTable.Title numeric style={styles.performanceColumn}>
                  Products Sold
                </DataTable.Title>
              </DataTable.Header>

              {filteredSalesmen.map((salesman) => (
                <DataTable.Row
                  key={salesman.uid}
                  onPress={() => loadSalesmanDetails(salesman)}
                  style={[
                    styles.salesmanRow,
                    salesman.isTopPerformer && styles.topPerformerRow
                  ]}
                >
                  <DataTable.Cell style={styles.nameColumn}>
                    <View style={styles.salesmanInfo}>
                      <View style={[
                        styles.avatar,
                        salesman.isTopPerformer && styles.topPerformerAvatar
                      ]}>
                        <Text style={styles.avatarText}>
                          {getSalesmanInitials(salesman.name)}
                        </Text>
                        {salesman.isTopPerformer && (
                          <View style={styles.topPerformerBadge}>
                            <Text style={styles.topPerformerBadgeText}>★</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.salesmanDetails}>
                        <View style={styles.nameRow}>
                          <Text style={styles.salesmanName}>{salesman.name}</Text>
                        </View>
                        <Text style={styles.salesmanEmail}>
                          {salesman.email}
                        </Text>
                        <Text style={styles.salesmanId}>
                          ID: {salesman.uid}
                        </Text>
                      </View>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell style={styles.cityColumn}>
                    <Chip 
                      mode="outlined" 
                      style={styles.cityChip}
                      textStyle={styles.cityChipText}
                    >
                      {salesman.city || "Not set"}
                    </Chip>
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
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={styles.performanceColumn}>
                    <Chip
                      mode="outlined"
                      style={styles.performanceChip}
                      textStyle={{
                        color: getPerformanceColor(
                          salesman.performance.totalProductsSold
                        ),
                        fontSize: 12,
                        fontWeight: "bold",
                      }}
                    >
                      {salesman.performance.totalProductsSold.toLocaleString()}
                    </Chip>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>

            {filteredSalesmen.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {salesmen.length === 0
                    ? "No salesmen found. Add your first salesman!"
                    : "No salesmen match your search criteria"}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Add Salesman Dialog */}
      <Portal>
        <Dialog visible={addDialogVisible} onDismiss={() => setAddDialogVisible(false)}>
          <Dialog.Title>Add New Distributor</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Full Name *"
              value={newSalesman.name}
              onChangeText={(text) => setNewSalesman({...newSalesman, name: text})}
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label="Email *"
              value={newSalesman.email}
              onChangeText={(text) => setNewSalesman({...newSalesman, email: text})}
              style={styles.input}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              label="Phone *"
              value={newSalesman.phone}
              onChangeText={(text) => setNewSalesman({...newSalesman, phone: text})}
              style={styles.input}
              mode="outlined"
              keyboardType="phone-pad"
            />
            <TextInput
              label="City *"
              value={newSalesman.city}
              onChangeText={(text) => setNewSalesman({...newSalesman, city: text})}
              style={styles.input}
              mode="outlined"
              placeholder="Enter city name"
            />
            <TextInput
              label="Password *"
              value={newSalesman.password}
              onChangeText={(text) => setNewSalesman({...newSalesman, password: text})}
              style={styles.input}
              mode="outlined"
              secureTextEntry
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button labelStyle={{color: '#000'}} onPress={() => setAddDialogVisible(false)}>Cancel</Button>
            <Button 
              onPress={handleAddSalesman} 
              loading={creatingSalesman}
              disabled={creatingSalesman}
              labelStyle={{color: '#000'}}
            >
              Create Account
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Salesman Detail Modal */}
      <Portal>
        <Modal
          visible={detailModalVisible}
          onDismiss={() => setDetailModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
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
                    <Text style={styles.modalCity}>
                      📍 {selectedSalesman.city || "City not specified"}
                    </Text>
                    <Text style={styles.modalId}>
                      Salesman ID: {selectedSalesman.uid}
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
                              {selectedSalesman.performance.totalProductsSold.toLocaleString()}
                            </Text>
                            <Text style={styles.statLabel}>Products Sold</Text>
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
                                    selectedSalesman.performance.totalProductsSold
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
                              <Text style={styles.productsCount}>
                                {order.items.reduce((sum, item) => sum + item.quantity, 0)} products
                              </Text>
                            </View>
                            <View style={styles.orderDetails}>
                              <Chip
                                compact
                                textStyle={{
                                  fontSize: 12,
                                  fontWeight: "bold",
                                }}
                                style={[
                                  styles.statusChip,
                                  order.status === "Delivered" &&
                                    styles.deliveredChip,
                                  order.status === "Pending" &&
                                    styles.pendingChip,
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5EDE0",
  },
  content: {
    padding: platformStyle.padding,
    paddingBottom: 20,
  },
  productsCount: {
    fontSize: scaleSize(12),
    color: "#4CAF50",
    fontWeight: "600",
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
  addButton: {
    backgroundColor: "#F7CAC9",
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
  cityColumn: { flex: 1.5 },
  ordersColumn: { flex: 1.2 },
  salesColumn: { flex: 1.5 },
  performanceColumn: { flex: 1.2 },
  salesmanRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  topPerformerRow: {
    backgroundColor: "#FFF9C4",
  },
  salesmanInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: scaleSize(40),
    height: scaleSize(40),
    borderRadius: scaleSize(20),
    backgroundColor: "#F7CAC9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: scaleSize(12),
    position: 'relative',
  },
  topPerformerAvatar: {
    backgroundColor: "#FFD700",
  },
  topPerformerBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topPerformerBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: scaleSize(14),
  },
  salesmanDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSize(2),
  },
  salesmanName: {
    fontSize: scaleSize(12),
    fontWeight: "600",
    color: "#3B3B3B",
    marginRight: scaleSize(8),
  },
  topPerformerChip: {
    height: scaleSize(16),
    backgroundColor: '#FFD700',
  },
  topPerformerChipText: {
    fontSize: scaleSize(8),
    color: '#3B3B3B',
    fontWeight: 'bold',
  },
  salesmanEmail: {
    fontSize: scaleSize(10),
    color: "#A08B73",
    marginBottom: scaleSize(2),
  },
  salesmanId: {
    fontSize: scaleSize(9),
    color: "#666",
    fontFamily: 'monospace',
    marginBottom: scaleSize(2),
  },
  lastActive: {
    fontSize: scaleSize(9),
    color: "#A08B73",
    fontStyle: "italic",
  },
  cityChip: {
    height: scaleSize(25),
    backgroundColor: '#E8F4FD',
  },
  cityChipText: {
    fontSize: scaleSize(10),
    color: '#1976D2',
    fontWeight: '500',
  },
  ordersCell: {
    alignItems: "flex-end",
  },
  ordersTotal: {
    fontSize: scaleSize(12),
    fontWeight: "bold",
    color: "#3B3B3B",
  },
  ordersDelivered: {
    fontSize: scaleSize(10),
    color: "#4CAF50",
  },
  salesCell: {
    alignItems: "flex-end",
  },
  salesAmount: {
    fontSize: scaleSize(12),
    fontWeight: "bold",
    color: "#3B3B3B",
  },
  salesProfit: {
    fontSize: scaleSize(10),
    color: "#4CAF50",
  },
  performanceChip: {
    height: scaleSize(24),
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
  input: {
    marginBottom: scaleSize(12),
  },
  // Modal styles
  modalContainer: {
    backgroundColor: "white",
    margin: 20,
    borderRadius: 30,
    height: "80%",
    padding: 30,
  },
  modalInner: {
    backgroundColor: "white",
    width: "100%",
    height: "100%",
    borderRadius: 30,
    overflow: "hidden",
    padding: 0,
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
  modalCity: {
    color: "#1976D2",
    fontSize: scaleSize(12),
    fontWeight: '500',
    marginBottom: scaleSize(2),
  },
  modalId: {
    color: "#666",
    fontSize: scaleSize(11),
    fontFamily: 'monospace',
    marginBottom: scaleSize(2),
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
    fontSize: scaleSize(11),
    fontWeight: "600",
    color: "#3B3B3B",
    marginBottom: scaleSize(2),
  },
  orderDate: {
    fontSize: scaleSize(9),
    color: "#A08B73",
    marginBottom: scaleSize(2),
  },
  orderItems: {
    fontSize: scaleSize(9),
    color: "#A08B73",
  },
  orderDetails: {
    alignItems: "flex-end",
  },
  statusChip: {
    height: scaleSize(25),
    minWidth: scaleSize(45),
  },
  deliveredChip: {
    backgroundColor: "#E8F5E8",
  },
  pendingChip: {
    backgroundColor: "#FFF3E0",
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