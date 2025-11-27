// src/screens/admin/DashboardScreen.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from "react-native";
import {
  Text,
  Card,
  Chip,
  ActivityIndicator,
  Button,
  DataTable,
} from "react-native-paper";
import { LineChart } from "react-native-chart-kit";
import { Order, getAllOrders, getUsers } from "../../firebase/firestore";
import {
  calculateMonthlyItemsSold,
  getTopProducts,
  calculateWeeklyItemsSold,
  calculateYearlyItemsSold,
} from "../../utils/calculateProfit";
import {
  scaleSize,
  scaleFont,
  theme,
  getResponsivePadding,
  getMaxContainerWidth,
} from "../../utils/constants";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

const DashboardScreen: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">(
    "month"
  );

  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const screenWidth = Dimensions.get("window").width;

  const containerPadding = getResponsivePadding();
  const maxContainerWidth = getMaxContainerWidth();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersData = [], usersData = []] = await Promise.all([
        getAllOrders(),
        getUsers(),
      ]);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (error: any) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Filter only delivered orders
  const deliveredOrders = useMemo(() => 
    orders.filter(order => order.status === "Delivered"),
    [orders]
  );

  // Filter delivered orders based on time range
  const filteredOrders = useMemo(() => {
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

  // Calculate total items sold from delivered orders
  const totalItemsSold = useMemo(() => {
    return filteredOrders.reduce((total, order) => {
      return (
        total +
        order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
      );
    }, 0);
  }, [filteredOrders]);

  // Calculate metrics based on delivered orders data
  const metrics = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalSales = filteredOrders.reduce(
      (sum, order) => sum + (order?.totalAmount || 0),
      0
    );
    const pendingOrders = orders.filter(
      (o) => o?.status === "Pending"|| o?.status === "Partially Delivered"
    ).length;

    return { totalOrders, totalSales, totalItemsSold, pendingOrders };
  }, [filteredOrders, totalItemsSold, orders]);

  // Calculate chart data based on time range (items sold from delivered orders only)
  const chartData = useMemo(() => {
    let itemsData: { period: string; items: number }[] = [];

    switch (timeRange) {
      case "week":
        itemsData = calculateWeeklyItemsSold(filteredOrders);
        break;
      case "month":
        itemsData = calculateMonthlyItemsSold(filteredOrders).map(
          ({ month, items }) => ({
            period: month,
            items,
          })
        );
        break;
      case "year":
        itemsData = calculateYearlyItemsSold(filteredOrders);
        break;
      default:
        itemsData = calculateMonthlyItemsSold(filteredOrders).map(
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
  }, [filteredOrders, timeRange]);

  // Top products based on delivered orders only
  const topProducts = useMemo(
    () => getTopProducts(filteredOrders, 10),
    [filteredOrders]
  );

  // Salesmen metrics based on delivered orders only
  const salesmen = useMemo(
    () =>
      Array.isArray(users) ? users.filter((u) => u?.role === "salesman") : [],
    [users]
  );

  const topSalesman = useMemo(
    () =>
      salesmen.reduce((top: any, salesman: any) => {
        const salesmanSales = filteredOrders
          .filter((order) => order?.salesmanId === salesman.id)
          .reduce((s, order) => s + (order?.totalAmount || 0), 0);
        return !top || salesmanSales > top.sales
          ? { ...salesman, sales: salesmanSales }
          : top;
      }, null as any),
    [salesmen, filteredOrders]
  );

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

  // Responsive chart width - respect max container width and allow scroll for many labels
  const effectiveContainerWidth = Math.min(maxContainerWidth, screenWidth);
  const chartWidth = Math.max(
    320,
    Math.min(effectiveContainerWidth - containerPadding * 2, 1200)
  );

  // Responsive font sizes wrapper
  const responsiveFont = (size: number) => scaleFont(size);

  // Small helper to clip inner content (prevents shadow clipping on Card)
  const Clipped = ({
    children,
    radius = scaleSize(8),
    style,
  }: {
    children: React.ReactNode;
    radius?: number;
    style?: any;
  }) => (
    <View style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
      {children}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { padding: containerPadding, maxWidth: maxContainerWidth },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.headerRow}>
        <Text
          variant="headlineMedium"
          style={[styles.title, { fontSize: responsiveFont(18) }]}
        >
          Admin Dashboard
        </Text>
        <View style={styles.refreshButtonContainer}>
          {screenWidth < 400 ? (
            // Icon-only button for very small screens
            <Button
              mode="outlined"
              compact
              onPress={loadData}
              icon="refresh"
              style={styles.headerRefreshIconOnly}
              contentStyle={styles.headerRefreshContent}
              labelStyle={{ fontSize: 0 }} // Hide text completely
            >
              {""}
            </Button>
          ) : screenWidth < 600 ? (
            // Compact button with text for medium screens
            <Button
              mode="outlined"
              compact
              onPress={loadData}
              icon="refresh"
              style={styles.headerRefreshCompact}
              contentStyle={styles.headerRefreshContent}
              labelStyle={[styles.headerRefreshLabel, { fontSize: responsiveFont(11) }]}
            >
              Refresh
            </Button>
          ) : (
            // Regular button for large screens
            <Button
              mode="outlined"
              onPress={loadData}
              icon="refresh"
              style={styles.headerRefreshRegular}
              contentStyle={styles.headerRefreshContent}
              labelStyle={[styles.headerRefreshLabel, { fontSize: responsiveFont(12) }]}
            >
              Refresh
            </Button>
          )}
        </View>
      </View>

      {/* Quick Access Cards (2 per row) */}
      <View style={styles.sectionRow}>
        {[
          {
            key: "sales-team",
            icon: "👥",
            title: "Distributors",
            subtitle: `${salesmen.length} active`,
            onPress: () => navigation.navigate("SalesmanManagement"),
          },
          {
            key: "customers",
            icon: "👤",
            title: "Customers",
            subtitle: `${users.filter((u) => u?.role === "customer").length} total`,
            onPress: () => navigation.navigate("CustomerManagement"),
          },
          {
            key: "orders",
            icon: "📦",
            title: "Orders",
            subtitle: `${metrics.pendingOrders} pending`,
            onPress: () => navigation.navigate("Orders"),
          },
          {
            key: "notifications",
            icon: "🔔",
            title: "Notifications",
            subtitle: "Send alerts",
            onPress: () => navigation.navigate("NotificationsAdmin"),
          },
        ].map((item) => (
          <View key={item.key} style={styles.cardWrapper}>
            <Card style={styles.accessCard} onPress={item.onPress}>
              <Clipped radius={scaleSize(8)}>
                <Card.Content style={styles.accessCardContent}>
                  <Text style={[styles.accessIcon, { fontSize: responsiveFont(20) }]}>
                    {item.icon}
                  </Text>
                  <Text style={[styles.accessTitle, { fontSize: responsiveFont(14) }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.accessSubtitle, { fontSize: responsiveFont(12) }]}>
                    {item.subtitle}
                  </Text>
                </Card.Content>
              </Clipped>
            </Card>
          </View>
        ))}
      </View>

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
              textStyle={{ fontSize: responsiveFont(12) }}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Chip>
          </View>
        ))}
      </View>

      {/* Time Range Info */}
      <Text variant="bodySmall" style={[styles.timeRangeInfo, { fontSize: responsiveFont(12) }]}>
        Showing delivered orders data for{" "}
        {timeRange === "week" ? "the last 7 days" : timeRange === "month" ? "this month" : "this year"}
      </Text>

      {/* Key Metrics (2 per row) */}
      <View style={styles.sectionRow}>
        {[
          {
            key: "orders",
            value: metrics.totalOrders,
            label: "Delivered Orders",
            chip: `${metrics.pendingOrders} pending`,
          },
          {
            key: "salesmen",
            value: salesmen.length,
            label: "Active Distributors",
            chip: topSalesman ? `Top: ${topSalesman.name?.split(" ")[0] || "N/A"}` : undefined,
          },
          {
            key: "sales",
            value: `₹${metrics.totalSales.toFixed(0)}`,
            label: "Total Sales",
          },
          {
            key: "items",
            value: metrics.totalItemsSold,
            label: "Items Sold",
          },
        ].map((m) => (
          <View key={m.key} style={styles.cardWrapper}>
            <Card style={styles.metricCard}>
              <Clipped radius={scaleSize(8)}>
                <Card.Content style={styles.metricContent}>
                  <Text style={[styles.metricValue, { fontSize: responsiveFont(20) }]}>{m.value}</Text>
                  <Text style={[styles.metricLabel, { fontSize: responsiveFont(12) }]}>{m.label}</Text>
                  {m.chip && (
                    <Chip mode="outlined" style={styles.metricChip} textStyle={{ fontSize: responsiveFont(10) }}>
                      {m.chip}
                    </Chip>
                  )}
                </Card.Content>
              </Clipped>
            </Card>
          </View>
        ))}
      </View>

      {/* Items Sold Chart */}
      {chartData.data.length > 0 && chartData.data.some((val) => val > 0) && (
        <View style={styles.fullWidthCard}>
          <Card style={styles.chartCard}>
            <Clipped radius={scaleSize(8)}>
              <Card.Content>
                <Text variant="titleLarge" style={[styles.chartTitle, { fontSize: responsiveFont(16) }]}>
                  {timeRange.charAt(0).toUpperCase() + timeRange.slice(1)}ly Items Sold (Delivered)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <LineChart
                    data={{
                      labels: chartData.labels,
                      datasets: [{ data: chartData.data }],
                    }}
                    verticalLabelRotation={-25}
                    width={Math.max(chartWidth, chartData.labels.length * 60)}
                    height={screenWidth < 768 ? 220 : 260}
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
                    withDots={screenWidth >= 768}
                    withShadow={false}
                  />
                </ScrollView>
              </Card.Content>
            </Clipped>
          </Card>
        </View>
      )}

      {/* Top Products - Fixed Table */}
      {Array.isArray(topProducts) && topProducts.length > 0 && (
        <View style={styles.fullWidthCard}>
          <Card style={styles.tableCard}>
            <Clipped radius={scaleSize(8)}>
              <Card.Content>
                <Text variant="titleLarge" style={[styles.tableTitle, { fontSize: responsiveFont(16) }]}>
                  Top 10 Selling Products ({timeRange}) - Delivered
                </Text>
                
                {/* Fixed DataTable without horizontal scroll */}
                <DataTable style={styles.dataTable}>
                  <DataTable.Header style={styles.tableHeader}>
                    <DataTable.Title style={styles.productColumn}>
                      <Text style={{ fontSize: responsiveFont(12), fontWeight: '600' }}>Product</Text>
                    </DataTable.Title>
                    <DataTable.Title numeric style={styles.unitsColumn}>
                      <Text style={{ fontSize: responsiveFont(12), fontWeight: '600' }}>Units Sold</Text>
                    </DataTable.Title>
                    <DataTable.Title numeric style={styles.revenueColumn}>
                      <Text style={{ fontSize: responsiveFont(12), fontWeight: '600' }}>Revenue</Text>
                    </DataTable.Title>
                  </DataTable.Header>

                  {topProducts.map((product, index) => (
                    <DataTable.Row key={index} style={styles.tableRow}>
                      <DataTable.Cell style={styles.productColumn}>
                        <Text 
                          numberOfLines={2} 
                          style={[styles.productName, { fontSize: responsiveFont(12) }]}
                        >
                          {product.name}
                        </Text>
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={styles.unitsColumn}>
                        <Text style={[styles.productSales, { fontSize: responsiveFont(12) }]}>
                          {product.sales}
                        </Text>
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={styles.revenueColumn}>
                        <Text style={[styles.productProfit, { fontSize: responsiveFont(12) }]}>
                          ₹{(product.profit || 0).toFixed(0)}
                        </Text>
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))}
                </DataTable>
              </Card.Content>
            </Clipped>
          </Card>
        </View>
      )}

      {/* Recent Activity */}
      <View style={styles.fullWidthCard}>
        <Card style={styles.activityCard}>
          <Clipped radius={scaleSize(8)}>
            <Card.Content>
              <Text variant="titleLarge" style={[styles.activityTitle, { fontSize: responsiveFont(16) }]}>
                Recent Activity ({timeRange})
              </Text>
              {(Array.isArray(orders) ? orders.slice(0, 5) : []).map((order) => {
                const dateString = new Date(order.createdAt).toLocaleDateString();
                return (
                  <View key={order.id} style={styles.activityItem}>
                    <View style={styles.activityInfo}>
                      <Text style={[styles.activityOrder, { fontSize: responsiveFont(12) }]}>
                        Order #{String(order.id || "").substring(0, 8)}
                      </Text>
                      <Text style={[styles.activityDate, { fontSize: responsiveFont(10) }]}>{dateString}</Text>
                    </View>
                    <View style={styles.activityDetails}>
                      <Text style={[styles.activityAmount, { fontSize: responsiveFont(12) }]}>
                        ₹{(order?.totalAmount || 0).toFixed(2)}
                      </Text>
                      <Chip
                        mode="outlined"
                        style={[
                          styles.statusChip,
                          order?.status === "Delivered" && styles.deliveredChip,
                          order?.status === "Pending" && styles.pendingChip,
                          order?.status === "Partially Delivered"&& styles.partiallydeliveredChip,
                        ]}
                        textStyle={[styles.statusText, { fontSize: responsiveFont(10) }]}
                      >
                        {order?.status || "—"}
                      </Chip>
                    </View>
                  </View>
                );
              })}
            </Card.Content>
          </Clipped>
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingBottom: scaleSize(20),
    alignSelf: "center",
    width: "100%",
  },

  // Reusable two-column row wrapper — ensures two cards per row
  sectionRow: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: scaleSize(12) as any,
    marginBottom: scaleSize(12),
  },

  // Each card wrapper sets the card to take ~48% of the row (two columns)
  cardWrapper: {
    flexBasis: "48%",
    maxWidth: "48%",
    marginBottom: scaleSize(12),
  },

  // For full-width sections (charts, tables, recent activity)
  fullWidthCard: {
    width: "100%",
    marginBottom: scaleSize(12),
  },

  // Header with responsive refresh button
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: scaleSize(16),
  },
  title: {
    textAlign: "left",
    color: theme.colors.text,
    flex: 1,
    minWidth: 200, // Ensure title doesn't get too small
  },
  refreshButtonContainer: {
    alignSelf: "flex-start",
  },
  headerRefreshIconOnly: {
    minWidth: scaleSize(40),
    minHeight: scaleSize(40),
  },
  headerRefreshCompact: {
    minWidth: scaleSize(80),
  },
  headerRefreshRegular: {
    minWidth: scaleSize(100),
  },
  headerRefreshContent: {
    paddingHorizontal: scaleSize(8),
    // Ensure proper touch target regardless of screen size
    minHeight: scaleSize(36),
  },
  headerRefreshLabel: {
    fontWeight: "500",
  },

  // Time Range
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
    backgroundColor: theme.colors.surface,
    minHeight: 32,
  },
  timeRangeChipActive: {
    borderColor: theme.colors.primary,
    borderWidth: 1,
  },
  timeRangeInfo: {
    textAlign: "center",
    color: theme.colors.placeholder,
    marginBottom: scaleSize(16),
    fontStyle: "italic",
  },

  // Quick Access Card styles
  accessCard: {
    backgroundColor: "#FFFFFF",
    borderColor: theme.colors.primary,
    borderWidth: 1,
    borderRadius: scaleSize(8),
  },
  accessCardContent: {
    alignItems: "center",
    padding: scaleSize(12),
  },
  accessIcon: {
    marginBottom: scaleSize(8),
  },
  accessTitle: {
    fontWeight: "600",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: scaleSize(4),
  },
  accessSubtitle: {
    color: theme.colors.placeholder,
    textAlign: "center",
  },

  // Metrics Grid Card styles
  metricCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: scaleSize(8),
  },
  metricContent: {
    alignItems: "center",
    padding: scaleSize(12),
  },
  metricValue: {
    fontWeight: "700",
    color: theme.colors.primary,
    marginBottom: scaleSize(4),
    textAlign: "center",
  },
  metricLabel: {
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: scaleSize(6),
  },
  metricChip: {
    height: scaleSize(30),
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignContent : "center",
  },

  // Chart
  chartCard: {
    marginBottom: scaleSize(16),
    backgroundColor: theme.colors.surface,
  },
  chartTitle: {
    textAlign: "center",
    marginBottom: scaleSize(10),
    color: theme.colors.text,
  },
  chart: {
    marginVertical: scaleSize(8),
    borderRadius: scaleSize(12),
  },

  // Table - Fixed styles
  tableCard: {
    marginBottom: scaleSize(16),
    backgroundColor: theme.colors.surface,
  },
  tableTitle: {
    textAlign: "center",
    marginBottom: scaleSize(16),
    color: theme.colors.text,
  },
  dataTable: {
    width: '100%',
  },
  tableHeader: {
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tableRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  // Table column widths
  productColumn: {
    flex: 2,
    paddingVertical: scaleSize(8),
  },
  unitsColumn: {
    flex: 1,
    paddingVertical: scaleSize(8),
  },
  revenueColumn: {
    flex: 1,
    paddingVertical: scaleSize(8),
  },
  productName: {
    color: theme.colors.text,
  },
  productSales: {
    fontWeight: "600",
    color: theme.colors.text,
  },
  productProfit: {
    fontWeight: "600",
    color: theme.colors.success,
  },

  // Recent Activity
  activityCard: {
    backgroundColor: theme.colors.surface,
    marginBottom: scaleSize(12),
  },
  activityTitle: {
    textAlign: "center",
    marginBottom: scaleSize(12),
    color: theme.colors.text,
  },
  activityItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: scaleSize(8),
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  activityInfo: {
    flex: 1,
  },
  activityOrder: {
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: scaleSize(2),
  },
  activityDate: {
    color: theme.colors.placeholder,
  },
  activityDetails: {
    alignItems: "flex-end",
    marginLeft: scaleSize(8),
  },
  activityAmount: {
    fontWeight: "600",
    color: theme.colors.primary,
    marginBottom: scaleSize(4),
  },

  // Status Chips
  statusChip: {
    height: scaleSize(28),
    minWidth: scaleSize(48),
    justifyContent: "center",
  },
  deliveredChip: {
    backgroundColor: "#E8F5E8",
  },
  partiallydeliveredChip:{
    backgroundColor: "#5db1f7ff",
  },
  pendingChip: {
    backgroundColor: "#FFF3E0",
  },
  statusText: {
    fontWeight: "700",
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: scaleSize(16),
    color: theme.colors.text,
  },
});

export default DashboardScreen;