import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Share } from 'react-native';
import { Text, Card, Button, DataTable, Chip, ActivityIndicator, Divider } from 'react-native-paper';
import { Order, getAllOrders, getUsers } from '../../firebase/firestore';
import { calculateMonthlyProfit, getTopProducts, calculateSalesmanPerformance, calculateWeeklyProfit, calculateYearlyProfit } from '../../utils/calculateProfit';
import { scaleSize, platformStyle } from '../../utils/constants';

const ReportsScreen: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ordersData, usersData] = await Promise.all([
        getAllOrders(),
        getUsers()
      ]);
      setOrders(ordersData || []);
      setUsers(usersData || []);
    } catch (error: any) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter orders based on date range
  const filteredOrders = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (dateRange) {
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
  }, [orders, dateRange]);

  // Calculate total products sold
  const calculateTotalProductsSold = (orders: Order[]): number => {
    return orders.reduce((total, order) => {
      return total + order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }, 0);
  };

  // Calculate completion rate
  const calculateCompletionRate = (orders: Order[]): number => {
    const totalOrders = orders.length;
    const deliveredOrders = orders.filter(order => order.status === 'Delivered').length;
    return totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;
  };

  // Calculate top customers
  const calculateTopCustomers = useMemo(() => {
    const customerStats: { [key: string]: {
      customer: any;
      totalPieces: number;
      totalOrders: number;
      totalSpent: number;
      salesman: any;
    } } = {};

    // Process delivered orders only for customer analysis
    const deliveredOrders = filteredOrders.filter(order => order.status === 'Delivered');

    deliveredOrders.forEach(order => {
      const customerId = order.customerId;
      
      if (!customerStats[customerId]) {
        // Find customer and associated salesman
        const customer = users.find(user => user.id === customerId || user.uid === customerId);
        const salesman = customer?.salesmanId ? 
          users.find(user => (user.id === customer.salesmanId || user.uid === customer.salesmanId)) : null;

        customerStats[customerId] = {
          customer,
          totalPieces: 0,
          totalOrders: 0,
          totalSpent: 0,
          salesman
        };
      }

      // Calculate pieces from this order
      const orderPieces = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      
      customerStats[customerId].totalPieces += orderPieces;
      customerStats[customerId].totalOrders += 1;
      customerStats[customerId].totalSpent += order.totalAmount || 0;
    });

    // Convert to array and sort by total pieces (descending)
    return Object.values(customerStats)
      .filter(stat => stat.customer) // Only include found customers
      .sort((a, b) => b.totalPieces - a.totalPieces)
      .slice(0, 10); // Top 10 customers
  }, [filteredOrders, users]);

  // Generate report data with filtered orders
  const report = useMemo(() => {
    const deliveredOrders = filteredOrders.filter(order => order.status === 'Delivered');
    const salesmen = users.filter(user => user.role === 'salesman');
    
    // Calculate metrics
    const totalSales = deliveredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalProductsSold = calculateTotalProductsSold(deliveredOrders);
    const totalOrders = deliveredOrders.length;
    const pendingOrders = filteredOrders.filter(order => order.status === 'Pending').length;
    const completionRate = calculateCompletionRate(filteredOrders);

    const topProducts = getTopProducts(filteredOrders, 10);

    // Salesman performance
    const salesmanPerformance = salesmen.map(salesman => ({
      ...salesman,
      ...calculateSalesmanPerformance(filteredOrders, salesman.id),
      productsSold: calculateTotalProductsSold(
        filteredOrders.filter(order => 
          order.salesmanId === salesman.id && order.status === 'Delivered'
        )
      )
    })).sort((a, b) => b.productsSold - a.productsSold); // Sort by products sold

    return {
      summary: {
        totalSales,
        totalProductsSold,
        totalOrders,
        pendingOrders,
        completionRate,
        period: dateRange,
        generatedAt: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      },
      topProducts,
      salesmanPerformance: salesmanPerformance.slice(0, 5),
      topCustomers: calculateTopCustomers,
      totalFilteredOrders: filteredOrders.length
    };
  }, [filteredOrders, users, dateRange, calculateTopCustomers]);

  const shareReport = async () => {
    const periodText = dateRange === 'week' ? 'Last 7 Days' : 
                      dateRange === 'month' ? 'This Month' : 'This Year';
    
    const reportText = `
📊 BUSINESS PERFORMANCE REPORT
📅 Generated: ${report.summary.generatedAt}
⏰ Period: ${periodText}

📈 SUMMARY:
• Total Sales: ₹${report.summary.totalSales.toFixed(2)}
• Products Sold: ${report.summary.totalProductsSold.toLocaleString()}
• Completed Orders: ${report.summary.totalOrders}
• Pending Orders: ${report.summary.pendingOrders}
• Total Orders: ${report.totalFilteredOrders}
• Completion Rate: ${report.summary.completionRate}%

🏆 TOP 10 PRODUCTS:
${report.topProducts.map((product, index) => 
  `${index + 1}. ${product.name} - ${product.sales} units - ₹${product.profit.toFixed(2)} revenue`
).join('\n')}

👥 TOP 5 SALESMEN:
${report.salesmanPerformance.map((salesman, index) => 
  `${index + 1}. ${salesman.name} - ${salesman.productsSold} products - ${salesman.totalOrders} orders`
).join('\n')}

👥 TOP 10 CUSTOMERS:
${report.topCustomers.map((customer, index) => 
  `${index + 1}. ${customer.customer.name} - ${customer.totalPieces} pieces - ₹${customer.totalSpent.toFixed(2)} spent`
).join('\n')}
    `.trim();

    try {
      await Share.share({
        message: reportText,
        title: `Business Report - ${periodText}`
      });
    } catch (error) {
      console.error('Error sharing report:', error);
    }
  };

  const exportToCSV = () => {
    // Simple CSV export implementation
    const csvContent = [
      ['Period', 'Total Sales', 'Products Sold', 'Total Orders', 'Pending Orders', 'Completion Rate'],
      [
        dateRange,
        report.summary.totalSales.toFixed(2),
        report.summary.totalProductsSold.toString(),
        report.summary.totalOrders.toString(),
        report.summary.pendingOrders.toString(),
        report.summary.completionRate.toString() + '%'
      ]
    ].map(row => row.join(',')).join('\n');

    console.log('CSV Data:', csvContent);
    // In a real app, you might want to save this to a file or use a proper export library
    alert('CSV data ready for export! Check console for data.');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F7CAC9" />
        <Text style={styles.loadingText}>Generating reports...</Text>
      </View>
    );
  }

  const getPeriodDisplay = () => {
    switch (dateRange) {
      case 'week': return 'Last 7 Days';
      case 'month': return 'This Month';
      case 'year': return 'This Year';
      default: return 'This Month';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={styles.title}>
        Reports & Analytics
      </Text>

      {/* Date Range Selector */}
      <Card style={styles.rangeCard}>
        <Card.Content>
          <Text variant="titleSmall" style={styles.rangeTitle}>
            Report Period
          </Text>
          <View style={styles.rangeContainer}>
            {(['week', 'month', 'year'] as const).map(range => (
              <Chip
                key={range}
                selected={dateRange === range}
                onPress={() => setDateRange(range)}
                style={[
                  styles.rangeChip,
                  dateRange === range && styles.rangeChipActive
                ]}
                mode="outlined"
                showSelectedCheck={false}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Chip>
            ))}
          </View>
          <Text style={styles.periodInfo}>
            Showing data for: <Text style={styles.periodHighlight}>{getPeriodDisplay()}</Text>
          </Text>
        </Card.Content>
      </Card>

      {/* Summary Cards */}
      <View style={styles.summaryGrid}>
        <Card style={styles.summaryCard}>
          <Card.Content style={styles.summaryContent}>
            <Text style={styles.summaryValue}>₹{report.summary.totalSales.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Total Sales</Text>
            <Text style={styles.summarySubtext}>{report.summary.totalOrders} completed orders</Text>
          </Card.Content>
        </Card>

        <Card style={styles.summaryCard}>
          <Card.Content style={styles.summaryContent}>
            <Text style={[styles.summaryValue, styles.productsValue]}>{report.summary.totalProductsSold.toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>Products Sold</Text>
            <Text style={styles.summarySubtext}>
              {report.summary.totalOrders > 0 ? 
                `${Math.round(report.summary.totalProductsSold / report.summary.totalOrders)} per order` : 
                '0 per order'
              }
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.summaryCard}>
          <Card.Content style={styles.summaryContent}>
            <Text style={styles.summaryValue}>{report.totalFilteredOrders}</Text>
            <Text style={styles.summaryLabel}>Total Orders</Text>
            <Text style={styles.summarySubtext}>{report.summary.pendingOrders} pending</Text>
          </Card.Content>
        </Card>

        <Card style={styles.summaryCard}>
          <Card.Content style={styles.summaryContent}>
            <Text style={styles.summaryValue}>{report.summary.completionRate}%</Text>
            <Text style={styles.summaryLabel}>Completion Rate</Text>
            <Text style={styles.summarySubtext}>Order fulfillment</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <Button 
          mode="contained" 
          onPress={shareReport}
          style={[styles.actionButton, styles.shareButton]}
          icon="share-variant"
          contentStyle={styles.buttonContent}
        >
          Share Report
        </Button>
        <Button 
          mode="outlined" 
          onPress={exportToCSV}
          style={[styles.actionButton, styles.exportButton]}
          icon="file-export"
          contentStyle={styles.buttonContent}
        >
          Export CSV
        </Button>
      </View>

      {/* Top Products */}
      <Card style={styles.reportCard}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.reportTitle}>
            🏆 Top 10 Products ({dateRange})
          </Text>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={styles.productColumn}>Product</DataTable.Title>
              <DataTable.Title numeric style={styles.unitsColumn}>Units</DataTable.Title>
              <DataTable.Title numeric style={styles.revenueColumn}>Revenue</DataTable.Title>
            </DataTable.Header>

            {report.topProducts.map((product, index) => (
              <DataTable.Row key={index}>
                <DataTable.Cell style={styles.productColumn}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {index + 1}. {product.name}
                  </Text>
                </DataTable.Cell>
                <DataTable.Cell numeric style={styles.unitsColumn}>
                  <Text style={styles.productSales}>{product.sales}</Text>
                </DataTable.Cell>
                <DataTable.Cell numeric style={styles.revenueColumn}>
                  <Text style={styles.productRevenue}>₹{product.profit.toFixed(0)}</Text>
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
          {report.topProducts.length === 0 && (
            <Text style={styles.emptyText}>No products sold in this period</Text>
          )}
        </Card.Content>
      </Card>

      {/* Top Salesmen */}
      <Card style={styles.reportCard}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.reportTitle}>
            👥 Top 5 Salesmen ({dateRange}ly)
          </Text>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={styles.salesmanColumn}>Salesman</DataTable.Title>
              <DataTable.Title numeric style={styles.productsColumn}>Products</DataTable.Title>
              <DataTable.Title numeric style={styles.ordersColumn}>Orders</DataTable.Title>
            </DataTable.Header>

            {report.salesmanPerformance.map((salesman, index) => (
              <DataTable.Row key={salesman.id}>
                <DataTable.Cell style={styles.salesmanColumn}>
                  <View>
                    <Text style={styles.salesmanName1}>
                      {index + 1}. {salesman.name}
                    </Text>
                    <Text style={styles.salesmanCompletion}>
                      {salesman.completionRate || 0}% completion
                    </Text>
                  </View>
                </DataTable.Cell>
                <DataTable.Cell numeric style={styles.productsColumn}>
                  <Text style={styles.salesmanProducts}>{salesman.productsSold}</Text>
                </DataTable.Cell>
                <DataTable.Cell numeric style={styles.ordersColumn}>
                  <Text style={styles.salesmanOrders}>{salesman.totalOrders}</Text>
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
          {report.salesmanPerformance.length === 0 && (
            <Text style={styles.emptyText}>No salesman data for this period</Text>
          )}
        </Card.Content>
      </Card>

      {/* Top Customers */}
      <Card style={styles.reportCard}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.reportTitle}>
            👥 Top 10 Customers ({dateRange}ly)
          </Text>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={styles.customerColumn}>Customer</DataTable.Title>
              <DataTable.Title style={styles.locationColumn}>Location</DataTable.Title>
              <DataTable.Title numeric style={styles.piecesColumn}>Pieces</DataTable.Title>
              <DataTable.Title numeric style={styles.ordersColumn}>Orders</DataTable.Title>
            </DataTable.Header>

            {report.topCustomers.map((customerData, index) => (
              <DataTable.Row key={customerData.customer.id || customerData.customer.uid}>
                <DataTable.Cell style={styles.customerColumn}>
                  <View>
                    <Text style={styles.customerName}>
                      {index + 1}. {customerData.customer.name}
                    </Text>
                    <Text style={styles.customerPhone}>
                      {customerData.customer.phone || 'No phone'}
                    </Text>
                    <Text style={styles.salesmanName}>
                      Salesman: {customerData.salesman?.name || 'Not assigned'}
                    </Text>
                  </View>
                </DataTable.Cell>
                <DataTable.Cell style={styles.locationColumn}>
                  <Text style={styles.customerCity}>
                    {customerData.customer.city || 'No city'}
                  </Text>
                </DataTable.Cell>
                <DataTable.Cell numeric style={styles.piecesColumn}>
                  <Text style={styles.customerPieces}>{customerData.totalPieces}</Text>
                </DataTable.Cell>
                <DataTable.Cell numeric style={styles.ordersColumn}>
                  <Text style={styles.customerOrders}>{customerData.totalOrders}</Text>
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
          {report.topCustomers.length === 0 && (
            <Text style={styles.emptyText}>No customer data for this period</Text>
          )}
        </Card.Content>
      </Card>

      {/* Order Status Breakdown */}
      <Card style={styles.reportCard}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.reportTitle}>
            📊 Order Status Breakdown
          </Text>
          <View style={styles.statusBreakdown}>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, styles.deliveredDot]} />
              <Text style={styles.statusLabel}>Delivered</Text>
              <Text style={styles.statusCount}>
                {filteredOrders.filter(order => order.status === 'Delivered').length}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, styles.pendingDot]} />
              <Text style={styles.statusLabel}>Pending</Text>
              <Text style={styles.statusCount}>
                {filteredOrders.filter(order => order.status === 'Pending').length}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, styles.partialDot]} />
              <Text style={styles.statusLabel}>Partial</Text>
              <Text style={styles.statusCount}>
                {filteredOrders.filter(order => order.status === 'Partially Delivered').length}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, styles.otherDot]} />
              <Text style={styles.statusLabel}>Other</Text>
              <Text style={styles.statusCount}>
                {filteredOrders.filter(order => 
                  !['Delivered', 'Pending', 'Partially Delivered'].includes(order.status)
                ).length}
              </Text>
            </View>
          </View>
          <View style={styles.totalOrdersRow}>
            <Text style={styles.totalOrdersLabel}>Total Orders:</Text>
            <Text style={styles.totalOrdersCount}>{report.totalFilteredOrders}</Text>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EDE0',
  },
  content: {
    padding: platformStyle.padding,
    paddingBottom: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: scaleSize(20),
    color: '#3B3B3B',
  },
  rangeCard: {
    marginBottom: scaleSize(20),
    backgroundColor: '#FAF9F6',
  },
  rangeTitle: {
    textAlign: 'center',
    marginBottom: scaleSize(12),
    color: '#3B3B3B',
  },
  rangeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: scaleSize(8),
    gap: scaleSize(8),
  },
  rangeChip: {
    backgroundColor: '#FAF9F6',
  },
  rangeChipActive: {
    backgroundColor: '#F7CAC9',
    borderColor: '#F7CAC9',
  },
  periodInfo: {
    textAlign: 'center',
    fontSize: scaleSize(12),
    color: '#A08B73',
    marginTop: scaleSize(4),
  },
  periodHighlight: {
    fontWeight: 'bold',
    color: '#3B3B3B',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: scaleSize(20),
    gap: scaleSize(12),
  },
  summaryCard: {
    width: '48%',
    minWidth: 150,
    backgroundColor: '#FAF9F6',
  },
  summaryContent: {
    alignItems: 'center',
    padding: scaleSize(12),
  },
  summaryValue: {
    fontSize: scaleSize(18),
    fontWeight: 'bold',
    color: '#F7CAC9',
    marginBottom: scaleSize(4),
  },
  productsValue: {
    color: '#4CAF50',
  },
  summaryLabel: {
    fontSize: scaleSize(11),
    color: '#3B3B3B',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: scaleSize(2),
  },
  summarySubtext: {
    fontSize: scaleSize(9),
    color: '#A08B73',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scaleSize(20),
    gap: scaleSize(12),
  },
  actionButton: {
    flex: 1,
  },
  buttonContent: {
    paddingVertical: scaleSize(6),
  },
  shareButton: {
    backgroundColor: '#E6C76E',
  },
  exportButton: {
    borderColor: '#E6C76E',
  },
  reportCard: {
    marginBottom: scaleSize(20),
    backgroundColor: '#FAF9F6',
  },
  reportTitle: {
    textAlign: 'center',
    marginBottom: scaleSize(16),
    color: '#3B3B3B',
  },
  // Table column styles
  productColumn: { flex: 2 },
  unitsColumn: { flex: 1 },
  revenueColumn: { flex: 1 },
  salesmanColumn: { flex: 2 },
  productsColumn: { flex: 1 },
  ordersColumn: { flex: 1 },
  customerColumn: { flex: 2 },
  locationColumn: { flex: 1.5 },
  piecesColumn: { flex: 1 },
  productName: {
    fontSize: scaleSize(12),
    color: '#3B3B3B',
  },
  productSales: {
    fontSize: scaleSize(12),
    fontWeight: '600',
    color: '#3B3B3B',
  },
  productRevenue: {
    fontSize: scaleSize(12),
    fontWeight: '600',
    color: '#4CAF50',
  },
  salesmanName: {
    fontSize: scaleSize(9),
    color: '#3B3B3B',
    fontWeight: '600',
  },
  salesmanName1: {
    fontSize: scaleSize(14),
    color: '#3B3B3B',
    fontWeight: '600',
  },
  salesmanCompletion: {
    fontSize: scaleSize(10),
    color: '#A08B73',
  },
  salesmanProducts: {
    fontSize: scaleSize(12),
    fontWeight: '600',
    color: '#4CAF50',
  },
  salesmanOrders: {
    fontSize: scaleSize(12),
    fontWeight: '600',
    color: '#F7CAC9',
  },
  customerName: {
    fontSize: scaleSize(14),
    color: '#3B3B3B',
    fontWeight: '600',
  },
  customerPhone: {
    fontSize: scaleSize(10),
    color: '#A08B73',
  },
  customerCity: {
    fontSize: scaleSize(11),
    color: '#3B3B3B',
  },
  customerPieces: {
    fontSize: scaleSize(12),
    fontWeight: '600',
    color: '#4CAF50',
  },
  customerOrders: {
    fontSize: scaleSize(12),
    fontWeight: '600',
    color: '#F7CAC9',
  },
  emptyText: {
    textAlign: 'center',
    color: '#A08B73',
    fontStyle: 'italic',
    marginTop: scaleSize(8),
  },
  // Order Status Breakdown Styles
  statusBreakdown: {
    marginBottom: scaleSize(16),
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scaleSize(10),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statusDot: {
    width: scaleSize(12),
    height: scaleSize(12),
    borderRadius: scaleSize(6),
    marginRight: scaleSize(8),
  },
  deliveredDot: {
    backgroundColor: '#4CAF50',
  },
  pendingDot: {
    backgroundColor: '#FFA000',
  },
  partialDot: {
    backgroundColor: '#2196F3',
  },
  otherDot: {
    backgroundColor: '#9E9E9E',
  },
  statusLabel: {
    flex: 1,
    fontSize: scaleSize(12),
    color: '#3B3B3B',
  },
  statusCount: {
    fontSize: scaleSize(12),
    fontWeight: '600',
    color: '#3B3B3B',
  },
  totalOrdersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: scaleSize(12),
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  totalOrdersLabel: {
    fontSize: scaleSize(14),
    fontWeight: '600',
    color: '#3B3B3B',
  },
  totalOrdersCount: {
    fontSize: scaleSize(16),
    fontWeight: 'bold',
    color: '#F7CAC9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5EDE0',
  },
  loadingText: {
    marginTop: scaleSize(16),
    color: '#3B3B3B',
  },
});

export default ReportsScreen;