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
import { LineChart } from "react-native-chart-kit";
import { useAuth } from "../../context/AuthContext";
import {
  Order,
  getOrdersBySalesman,
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

      const ordersData = await getOrdersBySalesman(user.uid).catch((err) => {
        console.log(
          "⚠️ Orders loading failed, using empty array:",
          err.message
        );
        return [];
      });

      console.log("✅ Orders loaded:", ordersData.length);

      setOrders(ordersData);
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
      pendingOrders: filteredAllOrders.filter(order => order.status === "Pending").length
    };
  }, [filteredDeliveredOrders, filteredAllOrders]);

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

  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(247, 202, 201, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(59, 59, 59, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: "4", strokeWidth: "2", stroke: "#F7CAC9" },
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
        Salesman Dashboard
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
              <Text style={styles.metricValue}>{performance.totalOrders}</Text>
            </Text>
            <Text style={styles.metricSubtext}>
              {performance.pendingOrders} pending in {timeRange}
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
              {performance.completionRate}%
            </Text>
            <Text style={styles.metricLabel}>Completion Rate</Text>
            <Text style={styles.metricSubtext}>
              {performance.deliveredOrders}/{filteredAllOrders.length} orders
            </Text>
          </Card.Content>
        </Card>
      </View>

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