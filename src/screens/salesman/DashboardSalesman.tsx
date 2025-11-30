// src/screens/salesman/DashboardSalesman.tsx
import React, { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, ScrollView, Dimensions } from "react-native";
import {
  Text,
  Card,
  Chip,
  DataTable,
  ActivityIndicator,
  Button,
} from "react-native-paper";
import { LineChart, BarChart } from "react-native-chart-kit";
import { useAuth } from "../../context/AuthContext";
import {
  Order,
  getOrdersBySalesman,
  getWorkersBySalesman,
} from "../../firebase/firestore";
import {
  calculateSalesmanPerformance,
  calculateMonthlyItemsSold,
  calculateWeeklyItemsSold,
  calculateYearlyItemsSold,
} from "../../utils/calculateProfit";
import { scaleSize, platformStyle, isSmallDevice, scaleFont, theme } from "../../utils/constants";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DashboardSalesman: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">("month");

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      if (!user) {
        console.log("❌ No user found");
        setError("User not found");
        return;
      }

      console.log("🔄 Loading salesman data for user:", user.uid);

      const [ordersData, workersData] = await Promise.all([
        getOrdersBySalesman(user.uid).catch((err) => {
          console.log(
            "⚠️ Orders loading failed, using empty array:",
            err.message
          );
          return [];
        }),
        getWorkersBySalesman(user.uid).catch((err) => {
          console.log(
            "⚠️ Workers loading failed, using empty array:",
            err.message
          );
          return [];
        })
      ]);

      console.log("✅ Orders loaded:", ordersData.length);
      console.log("✅ Workers loaded:", workersData.length);

      setOrders(ordersData);
      setWorkers(workersData);
      setError(null);
    } catch (error: any) {
      console.error("❌ Error loading salesman data:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total products sold for delivered orders only
  const calculateTotalProductsSold = (orders: Order[]): number => {
    return orders.reduce((total, order) => {
      return total + order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }, 0);
  };

  // Filter only delivered orders for the current salesman
  const deliveredOrders = useMemo(() => 
    orders.filter(order => order.status === "Delivered"),
    [orders]
  );

  // Filter delivered orders based on time range
  const filteredDeliveredOrders = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return deliveredOrders.filter((order) => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= now;
    });
  }, [deliveredOrders, timeRange]);

  // Filter all orders (including pending) based on time range for completion rate calculation
  const filteredAllOrders = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return orders.filter((order) => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= now;
    });
  }, [orders, timeRange]);

  // Calculate worker performance with detailed metrics
  const workerPerformance = useMemo(() => {
    if (workers.length === 0 || filteredDeliveredOrders.length === 0) {
      return [];
    }

    const workerMap = new Map();

    // Initialize all workers with zero values
    workers.forEach(worker => {
      workerMap.set(worker.id, {
        workerId: worker.id,
        workerName: worker.name,
        itemsSold: 0,
        ordersCount: 0,
        totalSales: 0,
        totalProfit: 0,
        efficiency: 0
      });
    });

    // Calculate performance for each worker
    filteredDeliveredOrders.forEach(order => {
      if (order.workerId && workerMap.has(order.workerId)) {
        const workerData = workerMap.get(order.workerId);
        const orderItems = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const orderProfit = order.totalProfit || 0;
        
        workerMap.set(order.workerId, {
          ...workerData,
          itemsSold: workerData.itemsSold + orderItems,
          ordersCount: workerData.ordersCount + 1,
          totalSales: workerData.totalSales + (order.totalAmount || 0),
          totalProfit: workerData.totalProfit + orderProfit
        });
      }
    });

    // Calculate efficiency (items per order)
    workerMap.forEach((workerData, workerId) => {
      if (workerData.ordersCount > 0) {
        workerMap.set(workerId, {
          ...workerData,
          efficiency: Math.round((workerData.itemsSold / workerData.ordersCount) * 100) / 100
        });
      }
    });

    return Array.from(workerMap.values())
      .filter(worker => worker.itemsSold > 0)
      .sort((a, b) => b.itemsSold - a.itemsSold);
  }, [workers, filteredDeliveredOrders]);

  // Get top worker
  const topWorker = useMemo(() => {
    return workerPerformance.length > 0 ? workerPerformance[0] : null;
  }, [workerPerformance]);

  // Calculate performance metrics using time-filtered delivered orders
  const performance = useMemo(() => {
    const totalOrders = filteredDeliveredOrders.length;
    const totalSales = filteredDeliveredOrders.reduce(
      (sum, order) => sum + (order?.totalAmount || 0),
      0
    );
    const totalProductsSold = calculateTotalProductsSold(filteredDeliveredOrders);
    
    // Calculate completion rate based on time-filtered orders
    const totalOrdersInTimeRange = filteredAllOrders.length;
    const completionRate = totalOrdersInTimeRange > 0 ? 
      (filteredDeliveredOrders.length / totalOrdersInTimeRange) * 100 : 0;

    return {
      totalOrders,
      deliveredOrders: filteredDeliveredOrders.length,
      totalSales,
      totalProductsSold,
      completionRate: Math.round(completionRate),
      pendingOrders: filteredAllOrders.filter(order => order.status === "Pending"|| order.status === "Partially Delivered").length,
      topWorkerName: topWorker ? topWorker.workerName : "No data",
      workerCount: workerPerformance.length
    };
  }, [filteredDeliveredOrders, filteredAllOrders, topWorker, workerPerformance]);

  // Calculate chart data based on time range (items sold from delivered orders only)
  const chartData = useMemo(() => {
    let itemsData: { period: string; items: number }[] = [];

    switch (timeRange) {
      case "week":
        itemsData = calculateWeeklyItemsSold(filteredDeliveredOrders);
        break;
      case "month":
        itemsData = calculateMonthlyItemsSold(filteredDeliveredOrders).map(
          ({ month, items }) => ({
            period: month,
            items,
          })
        );
        break;
      case "year":
        itemsData = calculateYearlyItemsSold(filteredDeliveredOrders);
        break;
      default:
        itemsData = calculateMonthlyItemsSold(filteredDeliveredOrders).map(
          ({ month, items }) => ({
            period: month,
            items,
          })
        );
    }

    return {
      labels: itemsData.map((item) => item.period),
      data: itemsData.map((item) => item.items),
    };
  }, [filteredDeliveredOrders, timeRange]);

  // Worker performance chart data
  const workerChartData = useMemo(() => {
    if (workerPerformance.length === 0) return null;

    const topWorkers = workerPerformance.slice(0, 5); // Show top 5 workers
    
    return {
      labels: topWorkers.map(worker => 
        worker.workerName.length > 8 
          ? worker.workerName.substring(0, 8) + '...' 
          : worker.workerName
      ),
      datasets: [{
        data: topWorkers.map(worker => worker.itemsSold),
      }],
    };
  }, [workerPerformance]);

  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.secondary,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(247, 202, 201, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(59, 59, 59, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: "4", strokeWidth: "2", stroke: "#F7CAC9" },
  };

  const barChartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(86, 156, 214, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(59, 59, 59, ${opacity})`,
    style: { borderRadius: 16 },
    barPercentage: 0.6,
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "Pending":
        return "#FFA000";
      case "Delivered":
        return "#4CAF50";
      case "Partially Delivered":
        return "#2196F3";
      default:
        return "#757575";
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F7CAC9" />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error Loading Dashboard</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Button mode="contained" onPress={loadData} style={styles.retryButton}>
          <Text>Try Again</Text>
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={styles.title}>
        Distributor Dashboard
      </Text>

      <Text variant="bodyLarge" style={styles.welcome}>
        Welcome back, {user?.name}!
      </Text>

      {/* Time Range Selector */}
      <View style={styles.timeRangeContainer}>
        {(["week", "month", "year"] as const).map((range) => (
          <View
            key={range}
            style={[
              styles.timeRangeWrapper,
              timeRange === range && styles.timeRangeWrapperActive,
            ]}
          >
            <Chip
              selected={timeRange === range}
              onPress={() => setTimeRange(range)}
              style={[
                styles.timeRangeChip,
                timeRange === range && styles.timeRangeChipActive,
              ]}
              mode="outlined"
              textStyle={{ fontSize: scaleFont(12) }}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Chip>
          </View>
        ))}
      </View>

      {/* Time Range Info */}
      <Text variant="bodySmall" style={styles.timeRangeInfo}>
        Showing delivered orders data for{" "}
        {timeRange === "week" ? "the last 7 days" : timeRange === "month" ? "this month" : "this year"}
      </Text>

      {/* Performance Metrics */}
      <View style={styles.metricsGrid}>
        <Card style={styles.metricCard}>
          <Card.Content style={styles.metricContent}>
            <Chip mode="outlined" style={styles.metricChip}>
              {performance.deliveredOrders}
              <Text> delivered</Text>
            </Chip>
            <Text style={styles.metricLabel}>
              Total Orders -{" "}
              <Text style={styles.metricValue}>{performance.deliveredOrders+performance.pendingOrders}</Text>
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.metricCard}>
          <Card.Content style={styles.metricContent}>
            <Text style={styles.metricValue}>
              ₹{performance.totalSales.toFixed(0)}
            </Text>
            <Text style={styles.metricLabel}>Total Sales</Text>
            <Text style={styles.metricSubtext}>
              From {performance.deliveredOrders} orders
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.metricCard}>
          <Card.Content style={styles.metricContent}>
            <Text style={styles.metricValue}>
              {performance.totalProductsSold.toLocaleString()}
            </Text>
            <Text style={styles.metricLabel}>Items Sold</Text>
            <Text style={styles.metricSubtext}>
              In {timeRange}
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.metricCard}>
          <Card.Content style={styles.metricContent}>
            <Text style={styles.metricValue}>
              {performance.topWorkerName}
            </Text>
            <Text style={styles.metricLabel}>Top Salesman</Text>
            <Text style={styles.metricSubtext}>
              Most items sold
            </Text>
          </Card.Content>
        </Card>
      </View>

      {/* Top Worker Section */}
      {topWorker && (
        <Card style={styles.topWorkerCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.topWorkerTitle}>
              🏆 Top Performing Salesman
            </Text>
            <View style={styles.topWorkerContent}>
              <View style={styles.topWorkerInfo}>
                <Text style={styles.topWorkerName}>{topWorker.workerName}</Text>
                <View style={styles.topWorkerStats}>
                  <Text style={styles.topWorkerStat}>
                    <Text style={styles.statValue}>{topWorker.itemsSold}</Text> items sold
                  </Text>
                  <Text style={styles.topWorkerStat}>
                    <Text style={styles.statValue}>{topWorker.ordersCount}</Text> orders
                  </Text>
                  <Text style={styles.topWorkerStat}>
                    <Text style={styles.statValue}>₹{topWorker.totalSales.toFixed(0)}</Text> sales
                  </Text>
                  <Text style={styles.topWorkerStat}>
                    <Text style={styles.statValue}>{topWorker.efficiency}</Text> items/order
                  </Text>
                </View>
              </View>
              <View style={styles.topWorkerBadge}>
                <Text style={styles.topWorkerRank}>#1</Text>
                <Text style={styles.topWorkerSubtext}>Top Performer</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Worker Performance Chart */}

      {/* Items Sold Chart - Only show if we have data */}
      {chartData.data.length > 0 && chartData.data.some((val) => val > 0) && (
        <Card style={styles.chartCard}>
          <View style={styles.clipped}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.chartTitle}>
                {timeRange.charAt(0).toUpperCase() + timeRange.slice(1)}ly Items Sold (Delivered)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <LineChart
                  data={{
                    labels: chartData.labels,
                    datasets: [{ data: chartData.data }],
                  }}
                  verticalLabelRotation={-25}
                  width={Math.max(SCREEN_WIDTH - 60, chartData.labels.length * 60)}
                  height={SCREEN_WIDTH < 768 ? 220 : 260}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chart}
                  formatYLabel={(y) => {
                    const n = Number(y);
                    if (isNaN(n)) return y;
                    if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
                    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
                    return `${n}`;
                  }}
                  withDots={SCREEN_WIDTH >= 768}
                  withShadow={false}
                />
              </ScrollView>
            </Card.Content>
          </View>
        </Card>
      )}

      {/* Worker Performance Table */}
      {workerPerformance.length > 0 && (
        <Card style={styles.performanceCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.performanceTitle}>
              Salesman Performance Details
            </Text>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Salesman</DataTable.Title>
                <DataTable.Title numeric>Items</DataTable.Title>
                <DataTable.Title numeric>Orders</DataTable.Title>
                <DataTable.Title numeric>Sales</DataTable.Title>
              </DataTable.Header>
              {workerPerformance.map((worker, index) => (
                <DataTable.Row key={worker.workerId}>
                  <DataTable.Cell>
                    <View style={styles.workerCell}>
                      <View style={[
                        styles.rankBadge,
                        index === 0 && styles.rankBadgeGold,
                        index === 1 && styles.rankBadgeSilver,
                        index === 2 && styles.rankBadgeBronze
                      ]}>
                        <Text style={styles.rankText}>#{index + 1}</Text>
                      </View>
                      <Text style={styles.workerTableName}>
                        {worker.workerName}
                      </Text>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell numeric>{worker.itemsSold}</DataTable.Cell>
                  <DataTable.Cell numeric>{worker.ordersCount}</DataTable.Cell>
                  <DataTable.Cell numeric>₹{worker.totalSales.toFixed(0)}</DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </Card.Content>
        </Card>
      )}

      {/* Recent Orders */}
      <Card style={styles.ordersCard}>
        <View style={styles.clipped}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.ordersTitle}>
              Recent Orders
            </Text>
            {orders.slice(0, 5).map((order) => (
              <View key={order.id} style={styles.orderItem}>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderId}>
                    Order #{order.id?.substring(0, 8)}
                  </Text>
                  <Text style={styles.orderDate}>
                    {order.createdAt?.toLocaleDateString?.() || 'N/A'}
                  </Text>
                  {order.workerName && (
                    <Text style={styles.orderWorker}>
                      Salesman: {order.workerName}
                    </Text>
                  )}
                </View>
                <View style={styles.orderDetails}>
                  <Text style={styles.orderAmount}>
                    ₹{(order.totalAmount || 0).toFixed(2)}
                  </Text>
                  <Chip
                    mode="outlined"
                    textStyle={[
                      styles.orderStatusText,
                      { color: getStatusColor(order.status) }
                    ]}
                    style={[
                      styles.orderStatus,
                      {
                        backgroundColor: `${getStatusColor(order.status)}22`,
                      },
                      order.status === "Delivered" && styles.deliveredStatus,
                      order.status === "Pending" && styles.pendingStatus,
                    ]}
                  >
                    {order.status || 'Unknown'}
                  </Chip>
                </View>
              </View>
            ))}
            {orders.length === 0 && (
              <View style={styles.noDataContainer}>
                <Text style={styles.noOrdersText}>No orders yet</Text>
                <Text style={styles.noOrdersSubtext}>
                  Start creating orders to see your performance analytics!
                </Text>
              </View>
            )}
          </Card.Content>
        </View>
      </Card>
    </ScrollView>
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
  title: {
    textAlign: "center",
    marginBottom: scaleSize(18),
    color: "#3B3B3B",
  },
  welcome: {
    paddingTop: scaleSize(14),
    textAlign: "center",
    marginBottom: scaleSize(20),
    color: "#A08B73",
    fontSize: scaleSize(15),
  },
  // Time Range Styles
  timeRangeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: scaleSize(12),
    alignItems: "center",
    flexWrap: "wrap",
  },
  timeRangeWrapper: {
    marginHorizontal: scaleSize(4),
    marginVertical: scaleSize(2),
  },
  timeRangeWrapperActive: {},
  timeRangeChip: {
    backgroundColor: "#FAF9F6",
    minHeight: 32,
  },
  timeRangeChipActive: {
    borderColor: "#F7CAC9",
    borderWidth: 1,
  },
  timeRangeInfo: {
    textAlign: "center",
    color: "#A08B73",
    marginBottom: scaleSize(16),
    fontStyle: "italic",
    fontSize: scaleSize(12),
  },
  // Metrics Grid
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: scaleSize(20),
    gap: scaleSize(12),
  },
  metricCard: {
    width: "48%",
    minWidth: 150,
    backgroundColor: "#FAF9F6",
  },
  metricContent: {
    alignItems: "center",
    justifyContent: "center",
    padding: scaleSize(12),
  },
  metricValue: {
    fontSize: scaleSize(15),
    fontWeight: "bold",
    color: "#E6C76E",
    marginBottom: scaleSize(4),
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: scaleSize(11),
    color: "#3B3B3B",
    textAlign: "center",
    marginBottom: scaleSize(2),
  },
  metricSubtext: {
    fontSize: scaleSize(9),
    color: "#A08B73",
    textAlign: "center",
    fontStyle: "italic",
  },
  metricChip: {
    height: scaleSize(33),
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignContent: "center",
    marginBottom: scaleSize(4),
  },
  // Top Worker Section
  topWorkerCard: {
    marginBottom: scaleSize(20),
    backgroundColor: "#FAF9F6",
    borderColor: "#FFD700",
    borderWidth: 2,
  },
  topWorkerTitle: {
    textAlign: "center",
    marginBottom: scaleSize(16),
    color: "#3B3B3B",
    fontWeight: "bold",
  },
  topWorkerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topWorkerInfo: {
    flex: 1,
  },
  topWorkerName: {
    fontSize: scaleSize(18),
    fontWeight: "bold",
    color: "#3B3B3B",
    marginBottom: scaleSize(8),
  },
  topWorkerStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scaleSize(12),
  },
  topWorkerStat: {
    fontSize: scaleSize(12),
    color: "#666",
    marginBottom: scaleSize(4),
  },
  statValue: {
    fontWeight: "bold",
    color: "#4CAF50",
  },
  topWorkerBadge: {
    backgroundColor: "#FFD700",
    borderRadius: 20,
    width: scaleSize(60),
    height: scaleSize(60),
    justifyContent: "center",
    alignItems: "center",
    padding: scaleSize(8),
  },
  topWorkerRank: {
    fontSize: scaleSize(18),
    fontWeight: "bold",
    color: "#3B3B3B",
  },
  topWorkerSubtext: {
    fontSize: scaleSize(9),
    color: "#3B3B3B",
    textAlign: "center",
    marginTop: scaleSize(2),
  },
  // Worker Performance
  workerList: {
    marginTop: scaleSize(16),
  },
  workerListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: scaleSize(8),
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  workerRank: {
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
    width: scaleSize(24),
    height: scaleSize(24),
    justifyContent: "center",
    alignItems: "center",
    marginRight: scaleSize(12),
  },
  workerRankText: {
    fontSize: scaleSize(10),
    fontWeight: "bold",
    color: "#2196F3",
  },
  workerDetails: {
    flex: 1,
  },
  workerListName: {
    fontSize: scaleSize(14),
    fontWeight: "600",
    color: "#3B3B3B",
    marginBottom: scaleSize(2),
  },
  workerListStats: {
    fontSize: scaleSize(11),
    color: "#666",
  },
  workerListSales: {
    fontSize: scaleSize(12),
    fontWeight: "600",
    color: "#E6C76E",
  },
  // Performance Table
  performanceCard: {
    marginBottom: scaleSize(20),
    backgroundColor: "#FAF9F6",
  },
  performanceTitle: {
    textAlign: "center",
    marginBottom: scaleSize(16),
    color: "#3B3B3B",
  },
  workerCell: {
    flexDirection: "row",
    alignItems: "center",
  },
  rankBadge: {
    backgroundColor: "#E3F2FD",
    borderRadius: 10,
    width: scaleSize(20),
    height: scaleSize(20),
    justifyContent: "center",
    alignItems: "center",
    marginRight: scaleSize(8),
  },
  rankBadgeGold: {
    backgroundColor: "#FFD700",
  },
  rankBadgeSilver: {
    backgroundColor: "#C0C0C0",
  },
  rankBadgeBronze: {
    backgroundColor: "#CD7F32",
  },
  rankText: {
    fontSize: scaleSize(9),
    fontWeight: "bold",
    color: "#3B3B3B",
  },
  workerTableName: {
    fontSize: scaleSize(12),
    color: "#3B3B3B",
  },
  // Chart Styles
  chartCard: {
    marginBottom: scaleSize(20),
    backgroundColor: "#FAF9F6",
  },
  clipped: {
    borderRadius: scaleSize(8),
    overflow: "hidden",
  },
  chartTitle: {
    textAlign: "center",
    marginBottom: scaleSize(16),
    color: "#3B3B3B",
  },
  chart: {
    marginVertical: scaleSize(8),
    borderRadius: scaleSize(16),
  },
  // Orders Card
  ordersCard: {
    marginBottom: scaleSize(20),
    backgroundColor: "#FAF9F6",
  },
  ordersTitle: {
    textAlign: "center",
    marginBottom: scaleSize(16),
    color: "#3B3B3B",
  },
  orderItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: scaleSize(12),
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: scaleSize(14),
    fontWeight: "600",
    color: "#3B3B3B",
    marginBottom: scaleSize(4),
  },
  orderDate: {
    fontSize: scaleSize(12),
    color: "#A08B73",
    marginBottom: scaleSize(2),
  },
  orderWorker: {
    fontSize: scaleSize(11),
    color: "#2196F3",
    fontStyle: "italic",
  },
  orderDetails: {
    alignItems: "flex-end",
  },
  orderAmount: {
    fontSize: scaleSize(14),
    fontWeight: "600",
    color: "#E6C76E",
    marginBottom: scaleSize(4),
  },
  orderStatus: {
    height: isSmallDevice ? scaleSize(34) : scaleSize(32),
    paddingHorizontal: isSmallDevice ? scaleSize(8) : scaleSize(12),
    minWidth: isSmallDevice ? scaleSize(70) : scaleSize(85),
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveredStatus: {
    backgroundColor: "#E8F5E8",
  },
  pendingStatus: {
    backgroundColor: "#FFF3E0",
  },
  orderStatusText: {
    fontSize: isSmallDevice ? scaleFont(9.5) : scaleFont(11),
    fontWeight: "bold",
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  noDataContainer: {
    alignItems: "center",
    padding: scaleSize(20),
  },
  noOrdersText: {
    textAlign: "center",
    color: "#3B3B3B",
    fontSize: scaleSize(16),
    fontWeight: "600",
    marginBottom: scaleSize(8),
  },
  noOrdersSubtext: {
    textAlign: "center",
    color: "#A08B73",
    fontSize: scaleSize(12),
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: scaleSize(20),
    backgroundColor: "#F5EDE0",
  },
  errorTitle: {
    fontSize: scaleSize(18),
    fontWeight: "bold",
    color: "#FF5252",
    marginBottom: scaleSize(8),
    textAlign: "center",
  },
  errorText: {
    fontSize: scaleSize(14),
    color: "#3B3B3B",
    textAlign: "center",
    marginBottom: scaleSize(16),
  },
  retryButton: {
    backgroundColor: "#F7CAC9",
  },
});

export default DashboardSalesman;