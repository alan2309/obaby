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

  // Generate report data with filtered orders
  const report = useMemo(() => {
    const deliveredOrders = filteredOrders.filter(order => order.status === 'Delivered');
    const salesmen = users.filter(user => user.role === 'salesman');
    
    // Calculate metrics
    const totalSales = deliveredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalProfit = deliveredOrders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);
    const totalOrders = deliveredOrders.length;
    const pendingOrders = filteredOrders.filter(order => order.status === 'Pending').length;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Get appropriate profit data based on date range
    let profitData: { period: string; profit: number }[] = [];
    switch (dateRange) {
      case 'week':
        profitData = calculateWeeklyProfit(filteredOrders);
        break;
      case 'month':
        profitData = calculateMonthlyProfit(filteredOrders).map(({ month, profit }) => ({
          period: month,
          profit
        }));
        break;
      case 'year':
        profitData = calculateYearlyProfit(filteredOrders);
        break;
    }

    const topProducts = getTopProducts(filteredOrders, 10);

    // Salesman performance
    const salesmanPerformance = salesmen.map(salesman => ({
      ...salesman,
      ...calculateSalesmanPerformance(filteredOrders, salesman.id)
    })).sort((a, b) => b.totalSales - a.totalSales);

    return {
      summary: {
        totalSales,
        totalProfit,
        totalOrders,
        pendingOrders,
        averageOrderValue,
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
      profitTrend: profitData,
      totalFilteredOrders: filteredOrders.length
    };
  }, [filteredOrders, users, dateRange]);

  const shareReport = async () => {
    const periodText = dateRange === 'week' ? 'Last 7 Days' : 
                      dateRange === 'month' ? 'This Month' : 'This Year';
    
    const reportText = `
📊 BUSINESS PERFORMANCE REPORT
📅 Generated: ${report.summary.generatedAt}
⏰ Period: ${periodText}

📈 SUMMARY:
• Total Sales: $${report.summary.totalSales.toFixed(2)}
• Total Profit: $${report.summary.totalProfit.toFixed(2)}
• Completed Orders: ${report.summary.totalOrders}
• Pending Orders: ${report.summary.pendingOrders}
• Total Orders: ${report.totalFilteredOrders}
• Average Order Value: $${report.summary.averageOrderValue.toFixed(2)}

🏆 TOP PRODUCTS:
${report.topProducts.map((product, index) => 
  `${index + 1}. ${product.name} - ${product.sales} units - $${product.profit.toFixed(2)} profit`
).join('\n')}

👥 TOP SALESMEN:
${report.salesmanPerformance.map((salesman, index) => 
  `${index + 1}. ${salesman.name} - $${salesman.totalSales.toFixed(2)} sales - ${salesman.totalOrders} orders`
).join('\n')}

📈 PROFIT TREND:
${report.profitTrend.map(item => 
  `• ${item.period}: $${item.profit.toFixed(2)}`
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
      ['Period', 'Total Sales', 'Total Profit', 'Total Orders', 'Pending Orders', 'Average Order Value'],
      [
        dateRange,
        report.summary.totalSales.toFixed(2),
        report.summary.totalProfit.toFixed(2),
        report.summary.totalOrders.toString(),
        report.summary.pendingOrders.toString(),
        report.summary.averageOrderValue.toFixed(2)
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
            <Text style={styles.summaryValue}>${report.summary.totalSales.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Total Sales</Text>
            <Text style={styles.summarySubtext}>{report.summary.totalOrders} completed orders</Text>
          </Card.Content>
        </Card>

        <Card style={styles.summaryCard}>
          <Card.Content style={styles.summaryContent}>
            <Text style={[styles.summaryValue, styles.profitValue]}>${report.summary.totalProfit.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Total Profit</Text>
            <Text style={styles.summarySubtext}>
              {report.summary.totalSales > 0 ? 
                `${((report.summary.totalProfit / report.summary.totalSales) * 100).toFixed(1)}% margin` : 
                '0% margin'
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
            <Text style={styles.summaryValue}>${report.summary.averageOrderValue.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Avg Order</Text>
            <Text style={styles.summarySubtext}>Per completed order</Text>
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
            🏆 Top Products ({dateRange})
          </Text>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={styles.productColumn}>Product</DataTable.Title>
              <DataTable.Title numeric style={styles.unitsColumn}>Units</DataTable.Title>
              <DataTable.Title numeric style={styles.profitColumn}>Profit</DataTable.Title>
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
                <DataTable.Cell numeric style={styles.profitColumn}>
                  <Text style={styles.productProfit}>${product.profit.toFixed(0)}</Text>
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
            👥 Top Salesmen ({dateRange})
          </Text>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={styles.salesmanColumn}>Salesman</DataTable.Title>
              <DataTable.Title numeric style={styles.ordersColumn}>Orders</DataTable.Title>
              <DataTable.Title numeric style={styles.salesColumn}>Sales</DataTable.Title>
            </DataTable.Header>

            {report.salesmanPerformance.map((salesman, index) => (
              <DataTable.Row key={salesman.id}>
                <DataTable.Cell style={styles.salesmanColumn}>
                  <View>
                    <Text style={styles.salesmanName}>
                      {index + 1}. {salesman.name}
                    </Text>
                    <Text style={styles.salesmanCompletion}>
                      {salesman.completionRate || 0}% completion
                    </Text>
                  </View>
                </DataTable.Cell>
                <DataTable.Cell numeric style={styles.ordersColumn}>
                  <Text style={styles.salesmanOrders}>{salesman.totalOrders}</Text>
                </DataTable.Cell>
                <DataTable.Cell numeric style={styles.salesColumn}>
                  <Text style={styles.salesmanSales}>${salesman.totalSales.toFixed(0)}</Text>
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
          {report.salesmanPerformance.length === 0 && (
            <Text style={styles.emptyText}>No salesman data for this period</Text>
          )}
        </Card.Content>
      </Card>

      {/* Profit Trend */}
      <Card style={styles.reportCard}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.reportTitle}>
            📈 Profit Trend ({dateRange})
          </Text>
          {report.profitTrend.map((item, index) => (
            <View key={index}>
              <View style={styles.trendRow}>
                <Text style={styles.trendPeriod}>{item.period}</Text>
                <View style={styles.trendValueContainer}>
                  <Text style={styles.trendProfit}>${item.profit.toFixed(0)}</Text>
                  {index > 0 && report.profitTrend[index - 1].profit > 0 && (
                    <Text style={[
                      styles.trendChange,
                      item.profit > report.profitTrend[index - 1].profit ? styles.trendPositive : styles.trendNegative
                    ]}>
                      {item.profit > report.profitTrend[index - 1].profit ? '↗' : '↘'}
                    </Text>
                  )}
                </View>
              </View>
              {index < report.profitTrend.length - 1 && <Divider />}
            </View>
          ))}
          {report.profitTrend.length === 0 && (
            <Text style={styles.emptyText}>No profit data for this period</Text>
          )}
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
  profitValue: {
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
  profitColumn: { flex: 1 },
  salesmanColumn: { flex: 2 },
  ordersColumn: { flex: 1 },
  salesColumn: { flex: 1 },
  productName: {
    fontSize: scaleSize(12),
    color: '#3B3B3B',
  },
  productSales: {
    fontSize: scaleSize(12),
    fontWeight: '600',
    color: '#3B3B3B',
  },
  productProfit: {
    fontSize: scaleSize(12),
    fontWeight: '600',
    color: '#4CAF50',
  },
  salesmanName: {
    fontSize: scaleSize(12),
    color: '#3B3B3B',
    fontWeight: '600',
  },
  salesmanCompletion: {
    fontSize: scaleSize(10),
    color: '#A08B73',
  },
  salesmanOrders: {
    fontSize: scaleSize(12),
    fontWeight: '600',
    color: '#3B3B3B',
  },
  salesmanSales: {
    fontSize: scaleSize(12),
    fontWeight: '600',
    color: '#F7CAC9',
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scaleSize(12),
  },
  trendPeriod: {
    fontSize: scaleSize(12),
    color: '#3B3B3B',
    fontWeight: '600',
  },
  trendValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(8),
  },
  trendProfit: {
    fontSize: scaleSize(12),
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  trendChange: {
    fontSize: scaleSize(14),
    fontWeight: 'bold',
  },
  trendPositive: {
    color: '#4CAF50',
  },
  trendNegative: {
    color: '#F44336',
  },
  emptyText: {
    textAlign: 'center',
    color: '#A08B73',
    fontStyle: 'italic',
    marginTop: scaleSize(8),
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