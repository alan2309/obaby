// src/screens/admin/DashboardScreen.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, RefreshControl } from 'react-native';
import { Text, Card, Chip, ActivityIndicator, Button, DataTable } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { Order, getAllOrders, getUsers } from '../../firebase/firestore';
import { calculateMonthlyProfit, getTopProducts, calculateWeeklyProfit, calculateYearlyProfit } from '../../utils/calculateProfit';
import { scaleSize, platformStyle } from '../../utils/constants';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DashboardScreen: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersData = [], usersData = []] = await Promise.all([getAllOrders(), getUsers()]);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
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

  // Filter orders based on time range
  const filteredOrders = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= now;
    });
  }, [orders, timeRange]);

  // Filter only delivered orders for metrics
  const deliveredOrders = useMemo(() => 
    filteredOrders.filter(o => o?.status === 'Delivered'), 
    [filteredOrders]
  );

  // Calculate metrics based on filtered data
  const metrics = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalSales = deliveredOrders.reduce((sum, order) => sum + (order?.totalAmount || 0), 0);
    const totalProfit = deliveredOrders.reduce((sum, order) => sum + (order?.totalProfit || 0), 0);
    const pendingOrders = filteredOrders.filter(o => o?.status === 'Pending').length;

    return { totalOrders, totalSales, totalProfit, pendingOrders };
  }, [filteredOrders, deliveredOrders]);

  // Calculate chart data based on time range
  const chartData = useMemo(() => {
    let profitData: { period: string; profit: number }[] = [];

    switch (timeRange) {
      case 'week':
        // Last 7 days
        profitData = calculateWeeklyProfit(filteredOrders);
        break;
      case 'month':
        // Last 30 days or current month
        profitData = calculateMonthlyProfit(filteredOrders).map(({ month, profit }) => ({
          period: month,
          profit
        }));
        break;
      case 'year':
        // Last 12 months
        profitData = calculateYearlyProfit(filteredOrders);
        break;
      default:
        profitData = calculateMonthlyProfit(filteredOrders).map(({ month, profit }) => ({
          period: month,
          profit
        }));
    }

    return {
      labels: profitData.map(item => item.period),
      data: profitData.map(item => item.profit)
    };
  }, [filteredOrders, timeRange]);

  // Top products based on filtered data
  const topProducts = useMemo(() => 
    getTopProducts(filteredOrders, 5), 
    [filteredOrders]
  );

  // Salesmen metrics based on filtered data
  const salesmen = useMemo(() => 
    Array.isArray(users) ? users.filter(u => u?.role === 'salesman') : [], 
    [users]
  );

  const topSalesman = useMemo(() => 
    salesmen.reduce((top: any, salesman: any) => {
      const salesmanSales = deliveredOrders
        .filter(order => order?.salesmanId === salesman.id)
        .reduce((s, order) => s + (order?.totalAmount || 0), 0);
      return !top || salesmanSales > top.sales ? { ...salesman, sales: salesmanSales } : top;
    }, null as any),
    [salesmen, deliveredOrders]
  );

  const chartConfig = {
    backgroundColor: '#FAF9F6',
    backgroundGradientFrom: '#FAF9F6',
    backgroundGradientTo: '#FAF9F6',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(247, 202, 201, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(59, 59, 59, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: '4', strokeWidth: '2', stroke: '#F7CAC9' },
  };

  const chartWidth = Math.max(320, Math.min(SCREEN_WIDTH - 48, 900));

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F7CAC9" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerRow}>
        <Text variant="headlineMedium" style={styles.title}>Admin Dashboard</Text>
        <Button
          mode="outlined"
          compact
          onPress={loadData}
          icon="refresh"
          style={styles.headerRefresh}
          contentStyle={{ paddingHorizontal: scaleSize(8) }}
        >
          Refresh
        </Button>
      </View>
<Card style={styles.quickAccessCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.quickAccessTitle}>
            Quick Access
          </Text>
          <View style={styles.quickAccessGrid}>
            <Card 
              style={styles.accessCard}
              onPress={() => navigation.navigate('SalesmanManagement')}
            >
              <Card.Content style={styles.accessCardContent}>
                <Text style={styles.accessIcon}>👥</Text>
                <Text style={styles.accessTitle}>Sales Team</Text>
                <Text style={styles.accessSubtitle}>{salesmen.length} active</Text>
              </Card.Content>
            </Card>

            <Card 
              style={styles.accessCard}
              onPress={() => navigation.navigate('CustomerManagement')}
            >
              <Card.Content style={styles.accessCardContent}>
                <Text style={styles.accessIcon}>👤</Text>
                <Text style={styles.accessTitle}>Customers</Text>
                <Text style={styles.accessSubtitle}>
                  {users.filter(u => u?.role === 'customer').length} total
                </Text>
              </Card.Content>
            </Card>

            <Card 
              style={styles.accessCard}
              onPress={() => navigation.navigate('Orders')}
            >
              <Card.Content style={styles.accessCardContent}
              >
                <Text style={styles.accessIcon}>📦</Text>
                <Text style={styles.accessTitle}>Orders</Text>
                <Text style={styles.accessSubtitle}>{metrics.pendingOrders} pending</Text>
              </Card.Content>
            </Card>

            <Card 
              style={styles.accessCard}
              onPress={() => navigation.navigate('NotificationsAdmin')}
            >
              <Card.Content style={styles.accessCardContent}>
                <Text style={styles.accessIcon}>🔔</Text>
                <Text style={styles.accessTitle}>Notifications</Text>
                <Text style={styles.accessSubtitle}>Send alerts</Text>
              </Card.Content>
            </Card>
          </View>
        </Card.Content>
      </Card>
      {/* Time Range Selector */}
      <View style={styles.timeRangeContainer}>
        {(['week', 'month', 'year'] as const).map(range => (
          <Chip
            key={range}
            selected={timeRange === range}
            onPress={() => setTimeRange(range)}
            style={[styles.timeRangeChip, timeRange === range && styles.timeRangeChipActive]}
            mode="outlined"
          >
            {range.charAt(0).toUpperCase() + range.slice(1)}
          </Chip>
        ))}
      </View>

      {/* Time Range Info */}
      <Text variant="bodySmall" style={styles.timeRangeInfo}>
        Showing data for {timeRange === 'week' ? 'the last 7 days' : timeRange === 'month' ? 'this month' : 'this year'}
      </Text>

      {/* Key Metrics */}
      <View style={styles.metricsGrid}>
        <Card style={styles.metricCard}>
          <Card.Content style={styles.metricContent}>
            <Text style={styles.metricValue}>{metrics.totalOrders}</Text>
            <Text style={styles.metricLabel}>Total Orders</Text>
            <Chip mode="outlined" style={styles.metricChip}>
              {metrics.pendingOrders} pending
            </Chip>
          </Card.Content>
        </Card>

        <Card style={styles.metricCard}>
          <Card.Content style={styles.metricContent}>
            <Text style={styles.metricValue}>{salesmen.length}</Text>
            <Text style={styles.metricLabel}>Active Salesmen</Text>
            {topSalesman && (
              <Chip mode="outlined" style={styles.metricChip}>
                Top: {topSalesman.name.split(' ')[0]}
              </Chip>
            )}
          </Card.Content>
        </Card>
        
        <Card style={styles.metricCard}>
          <Card.Content style={styles.metricContent}>
            <Text style={styles.metricValue}>${metrics.totalSales.toFixed(0)}</Text>
            <Text style={styles.metricLabel}>Total Sales</Text>
          </Card.Content>
        </Card>

        <Card style={styles.metricCard}>
          <Card.Content style={styles.metricContent}>
            <Text style={styles.metricValue}>${metrics.totalProfit.toFixed(0)}</Text>
            <Text style={styles.metricLabel}>Total Profit</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Profit Chart */}
      {chartData.data.length > 0 && chartData.data.some(val => val > 0) && (
        <Card style={styles.chartCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.chartTitle}>
              {timeRange.charAt(0).toUpperCase() + timeRange.slice(1)}ly Profit Trend
            </Text>
            <LineChart
              data={{
                labels: chartData.labels,
                datasets: [{ data: chartData.data }],
              }}
              verticalLabelRotation={-25}
              width={chartWidth}
              height={260}
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
              renderDotContent={({ x, y, index, indexData }) => (
                <Text
                  key={`label-${index}`}
                  style={{
                    position: 'absolute',
                    left: x - scaleSize(10),
                    top: y - scaleSize(18),
                    fontSize: scaleSize(10),
                    color: '#3B3B3B',
                    fontWeight: '700',
                  }}
                >
                  {Math.round(indexData)}
                </Text>
              )}
              withDots
              withShadow={false}
            />
          </Card.Content>
        </Card>
      )}

      {/* Top Products */}
      {Array.isArray(topProducts) && topProducts.length > 0 && (
        <Card style={styles.tableCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.tableTitle}>
              Top Selling Products ({timeRange})
            </Text>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Product</DataTable.Title>
                <DataTable.Title numeric>Units Sold</DataTable.Title>
                <DataTable.Title numeric>Profit</DataTable.Title>
              </DataTable.Header>

              {topProducts.map((product, index) => (
                <DataTable.Row key={index}>
                  <DataTable.Cell>
                    <Text numberOfLines={1} style={styles.productName}>{product.name}</Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    <Text style={styles.productSales}>{product.sales}</Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    <Text style={styles.productProfit}>${(product.profit || 0).toFixed(0)}</Text>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </Card.Content>
        </Card>
      )}

      {/* Recent Activity */}
      <Card style={styles.activityCard}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.activityTitle}>
            Recent Activity ({timeRange})
          </Text>
          {(Array.isArray(filteredOrders) ? filteredOrders.slice(0, 5) : []).map(order => {
            const dateString = new Date(order.createdAt).toLocaleDateString();
            return (
              <View key={order.id} style={styles.activityItem}>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityOrder}>Order #{String(order.id || '').substring(0, 8)}</Text>
                  <Text style={styles.activityDate}>{dateString}</Text>
                </View>
                <View style={styles.activityDetails}>
                  <Text style={styles.activityAmount}>${(order?.totalAmount || 0).toFixed(2)}</Text>
                  <Chip
                    mode="outlined"
                    style={[
                      styles.statusChip,
                      order?.status === 'Delivered' && styles.deliveredChip,
                      order?.status === 'Pending' && styles.pendingChip,
                    ]}
                    textStyle={styles.statusText}
                  >
                    {order?.status || '—'}
                  </Chip>
                </View>
              </View>
            );
          })}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5EDE0' },
  content: { padding: platformStyle.padding, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: scaleSize(8) },
  title: { textAlign: 'left', color: '#3B3B3B' },
  headerRefresh: { alignSelf: 'flex-start' },
  timeRangeContainer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    marginBottom: scaleSize(8), 
    gap: scaleSize(8) 
  },
  timeRangeChip: { backgroundColor: '#FAF9F6' },
  timeRangeChipActive: { borderColor: '#F7CAC9', borderWidth: 1 },
  timeRangeInfo: {
    textAlign: 'center',
    color: '#A08B73',
    marginBottom: scaleSize(16),
    fontStyle: 'italic'
  },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: scaleSize(16), gap: scaleSize(12) },
  metricCard: { width: '48%', minWidth: 150, backgroundColor: '#FAF9F6' },
  metricContent: { alignItems: 'center', padding: scaleSize(12) },
  metricValue: { fontSize: scaleSize(22), fontWeight: '700', color: '#F7CAC9', marginBottom: scaleSize(4) },
  metricLabel: { fontSize: scaleSize(12), color: '#3B3B3B', textAlign: 'center', marginBottom: scaleSize(6) },
  metricChip: { height: scaleSize(20), backgroundColor: '#E3F2FD' },

  chartCard: { marginBottom: scaleSize(16), backgroundColor: '#FAF9F6' },
  chartTitle: { textAlign: 'center', marginBottom: scaleSize(10), color: '#3B3B3B' },
  chart: { marginVertical: scaleSize(8), borderRadius: scaleSize(12), alignSelf: 'center' },

  tableCard: { marginBottom: scaleSize(16), backgroundColor: '#FAF9F6' },
  tableTitle: { textAlign: 'center', marginBottom: scaleSize(10), color: '#3B3B3B' },
  productName: { fontSize: scaleSize(12), color: '#3B3B3B' },
  productSales: { fontSize: scaleSize(12), fontWeight: '600', color: '#3B3B3B' },
  productProfit: { fontSize: scaleSize(12), fontWeight: '600', color: '#4CAF50' },

  activityCard: { backgroundColor: '#FAF9F6' },
  activityTitle: { textAlign: 'center', marginBottom: scaleSize(12), color: '#3B3B3B' },
  activityItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: scaleSize(8), borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  activityInfo: { flex: 1 },
  activityOrder: { fontSize: scaleSize(12), fontWeight: '600', color: '#3B3B3B', marginBottom: scaleSize(2) },
  activityDate: { fontSize: scaleSize(10), color: '#A08B73' },
  activityDetails: { alignItems: 'flex-end' },
  activityAmount: { fontSize: scaleSize(12), fontWeight: '600', color: '#F7CAC9', marginBottom: scaleSize(4) },

  statusChip: { height: scaleSize(24), minWidth: scaleSize(68), justifyContent: 'center' },
  deliveredChip: { backgroundColor: '#E8F5E8' },
  pendingChip: { backgroundColor: '#FFF3E0' },
  statusText: { fontSize: scaleSize(11), fontWeight: '700' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5EDE0' },
  loadingText: { marginTop: scaleSize(16), color: '#3B3B3B' },

  quickAccessCard: {
    marginBottom: scaleSize(20),
    backgroundColor: '#FAF9F6',
  },
  quickAccessTitle: {
    textAlign: 'center',
    marginBottom: scaleSize(16),
    color: '#3B3B3B',
    fontWeight: '600',
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: scaleSize(12),
  },
  accessCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderColor: '#F7CAC9',
    borderWidth: 1,
    marginBottom: scaleSize(12),
  },
  accessCardContent: {
    alignItems: 'center',
    padding: scaleSize(12),
  },
  accessIcon: {
    fontSize: scaleSize(24),
    marginBottom: scaleSize(8),
  },
  accessTitle: {
    fontSize: scaleSize(12),
    fontWeight: '600',
    color: '#3B3B3B',
    textAlign: 'center',
    marginBottom: scaleSize(4),
  },
  accessSubtitle: {
    fontSize: scaleSize(10),
    color: '#A08B73',
    textAlign: 'center',
  },
});

export default DashboardScreen;