import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Dimensions } from "react-native";
import {
  Text,
  Card,
  Chip,
  DataTable,
  ActivityIndicator,
  Button,
} from "react-native-paper";
import { BarChart } from "react-native-chart-kit";
import { useAuth } from "../../context/AuthContext";
import {
  Order,
  getOrdersBySalesman,
} from "../../firebase/firestore";
import {
  calculateSalesmanPerformance,
  calculateMonthlySales,
} from "../../utils/calculateProfit";
import { scaleSize, platformStyle } from "../../utils/constants";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DashboardSalesman: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Safe performance calculation
  const performance = calculateSalesmanPerformance(orders, user?.uid || "");

  // Safe monthly sales calculation
  const monthlySales = calculateMonthlySales(orders);
  const chartLabels = Object.keys(monthlySales).slice(-6);
  const chartData =
    chartLabels.length > 0
      ? {
          labels: chartLabels,
          datasets: [
            {
              data: chartLabels.map((month) => Math.round(monthlySales[month])),
            },
          ],
        }
      : null;

  const chartConfig = {
    backgroundColor: "#FAF9F6",
    backgroundGradientFrom: "#FAF9F6",
    backgroundGradientTo: "#FAF9F6",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(230, 199, 110, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(59, 59, 59, ${opacity})`,
    style: {
      borderRadius: 16,
    },
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
          </Card.Content>
        </Card>

        <Card style={styles.metricCard}>
          <Card.Content style={styles.metricContent}>
            <Text style={styles.metricValue}>
              ₹{performance.totalSales.toFixed(0)}
            </Text>
            <Text style={styles.metricLabel}>Total Sales</Text>
          </Card.Content>
        </Card>

        <Card style={styles.metricCard}>
          <Card.Content style={styles.metricContent}>
            <Text style={styles.metricValue}>
              ₹{performance.totalProfit.toFixed(0)}
            </Text>
            <Text style={styles.metricLabel}>Total Profit</Text>
          </Card.Content>
        </Card>

        <Card style={styles.metricCard}>
          <Card.Content style={styles.metricContent}>
            <Text style={styles.metricValue}>
              {performance.completionRate}%
            </Text>
            <Text style={styles.metricLabel}>Completion Rate</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Sales Chart - Only show if we have data */}
      {chartData && chartData.labels.length > 0 && (
        <Card style={styles.chartCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.chartTitle}>
              Monthly Sales Performance
            </Text>
            <BarChart
              data={chartData}
              width={SCREEN_WIDTH - 60}
              height={220}
              chartConfig={chartConfig}
              style={styles.chart}
              showValuesOnTopOfBars
              yAxisLabel="₹"
              yAxisSuffix=""
            />
          </Card.Content>
        </Card>
      )}

      {/* Recent Orders */}
      <Card style={styles.ordersCard}>
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
                  style={[
                    styles.orderStatus,
                    order.status === "Delivered" && styles.deliveredStatus,
                    order.status === "Pending" && styles.pendingStatus,
                  ]}
                  textStyle={styles.orderStatusText}
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
    marginBottom: scaleSize(6),
  },
  metricChip: {
    height: scaleSize(24),
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignContent: "center",
  },
  chartCard: {
    marginBottom: scaleSize(20),
    backgroundColor: "#FAF9F6",
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
    paddingVertical: scaleSize(12), // Increased from 8
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: scaleSize(14), // Increased from 8
    fontWeight: "600",
    color: "#3B3B3B",
    marginBottom: scaleSize(4), // Increased from 2
  },
  orderDate: {
    fontSize: scaleSize(12), // Increased from 6
    color: "#A08B73",
  },
  orderDetails: {
    alignItems: "flex-end",
  },
  orderAmount: {
    fontSize: scaleSize(14), // Increased from 8
    fontWeight: "600",
    color: "#E6C76E",
    marginBottom: scaleSize(4), // Increased from 2
  },
  orderStatus: {
    height: scaleSize(24), // Increased from 15
  },
  deliveredStatus: {
    backgroundColor: "#E8F5E8",
    justifyContent: "center",
    alignItems: "center",
  },
  pendingStatus: {
    backgroundColor: "#FFF3E0",
  },
  orderStatusText: {
    fontSize: scaleSize(11), // Increased from 6
    fontWeight: '500',
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
  actionsCard: {
    backgroundColor: "#FAF9F6",
  },
  actionsTitle: {
    textAlign: "center",
    marginBottom: scaleSize(16),
    color: "#3B3B3B",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: scaleSize(12),
  },
  actionButton: {
    flex: 1,
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