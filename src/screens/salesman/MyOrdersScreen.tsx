import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Chip, DataTable, ActivityIndicator, Searchbar } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { Order, getOrdersBySalesman } from '../../firebase/firestore';
import { scaleSize, platformStyle, ORDER_STATUS } from '../../utils/constants';

const MyOrdersScreen: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [searchQuery, orders, statusFilter]);

  const loadOrders = async () => {
    try {
      if (!user) return;
      
      const ordersData = await getOrdersBySalesman(user.uid);
      setOrders(ordersData);
    } catch (error: any) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterOrders = () => {
    let filtered = orders;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(order =>
        order.items.some(item =>
          item.productName.toLowerCase().includes(searchQuery.toLowerCase())
        ) ||
        order.id?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredOrders(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return '#FFA000';
      case 'Packed': return '#2196F3';
      case 'Shipped': return '#673AB7';
      case 'Delivered': return '#4CAF50';
      default: return '#757575';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F7CAC9" />
        <Text style={styles.loadingText}>Loading orders...</Text>
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
          My Orders
        </Text>

        <Searchbar
          placeholder="Search orders..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />

        <ScrollView horizontal style={styles.filterScroll}>
          <View style={styles.filterContainer}>
            {['all', ...Object.values(ORDER_STATUS)].map(status => (
              <Chip
                key={status}
                selected={statusFilter === status}
                onPress={() => setStatusFilter(status)}
                style={styles.filterChip}
                mode="outlined"
              >
                {status === 'all' ? 'All' : status}
              </Chip>
            ))}
          </View>
        </ScrollView>

        {filteredOrders.map(order => (
          <Card key={order.id} style={styles.orderCard}>
            <Card.Content>
              <View style={styles.orderHeader}>
                <View>
                  <Text variant="titleMedium">Order #{order.id?.substring(0, 8)}</Text>
                  <Text variant="bodySmall" style={styles.orderDate}>
                    {formatDate(order.createdAt)}
                  </Text>
                </View>
                <Chip 
                  mode="outlined"
                  textStyle={{ color: getStatusColor(order.status) }}
                >
                  {order.status}
                </Chip>
              </View>

              <View style={styles.orderItems}>
                {order.items.map((item, index) => (
                  <View key={index} style={styles.orderItem}>
                    <Text variant="bodyMedium" style={styles.itemName}>
                      {item.productName}
                    </Text>
                    <Text variant="bodySmall" style={styles.itemVariant}>
                      {item.size} / {item.color} × {item.quantity}
                    </Text>
                    <Text variant="bodyMedium" style={styles.itemPrice}>
                      ${item.finalPrice * item.quantity}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.orderFooter}>
                <Text variant="bodySmall">
                  {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                </Text>
                <View style={styles.orderTotals}>
                  <Text variant="titleMedium" style={styles.totalAmount}>
                    ${order.totalAmount.toFixed(2)}
                  </Text>
                  {order.status === 'Delivered' && (
                    <Text variant="bodySmall" style={styles.profitText}>
                      Profit: ${order.totalProfit.toFixed(2)}
                    </Text>
                  )}
                </View>
              </View>
            </Card.Content>
          </Card>
        ))}

        {filteredOrders.length === 0 && !loading && (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text variant="bodyLarge" style={styles.emptyText}>
                {orders.length === 0 
                  ? 'No orders found. Create your first order!' 
                  : 'No orders match your filters'
                }
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </View>
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
    marginBottom: scaleSize(24),
    color: '#3B3B3B',
  },
  searchbar: {
    marginBottom: scaleSize(16),
  },
  filterScroll: {
    marginBottom: scaleSize(16),
  },
  filterContainer: {
    flexDirection: 'row',
    paddingVertical: scaleSize(4),
  },
  filterChip: {
    marginRight: scaleSize(8),
  },
  orderCard: {
    marginBottom: scaleSize(16),
    backgroundColor: '#FAF9F6',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scaleSize(12),
  },
  orderDate: {
    color: '#A08B73',
    marginTop: scaleSize(4),
  },
  orderItems: {
    marginBottom: scaleSize(12),
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleSize(8),
    paddingBottom: scaleSize(8),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemName: {
    flex: 2,
    fontWeight: '500',
  },
  itemVariant: {
    flex: 1,
    color: '#A08B73',
    textAlign: 'center',
  },
  itemPrice: {
    flex: 1,
    textAlign: 'right',
    fontWeight: '500',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotals: {
    alignItems: 'flex-end',
  },
  totalAmount: {
    color: '#F7CAC9',
    fontWeight: 'bold',
  },
  profitText: {
    color: '#4CAF50',
    marginTop: scaleSize(4),
  },
  emptyCard: {
    alignItems: 'center',
    padding: scaleSize(20),
  },
  emptyText: {
    textAlign: 'center',
    color: '#A08B73',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: scaleSize(16),
    color: '#3B3B3B',
  },
});

export default MyOrdersScreen;