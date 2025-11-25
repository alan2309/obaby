// src/screens/admin/CustomerManagement.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Searchbar,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { getUsers } from '../../firebase/firestore';
import { UserData } from '../../firebase/auth';
import { auth } from '../../firebase/config';
import { scaleSize, scaleFont, platformStyle } from '../../utils/constants';

interface SalesmanWithCustomers {
  salesman: UserData;
  customers: UserData[];
}

const CustomerManagement: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [salesmenWithCustomers, setSalesmenWithCustomers] = useState<SalesmanWithCustomers[]>([]);
  const [unassignedCustomers, setUnassignedCustomers] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSalesmen, setExpandedSalesmen] = useState<Set<string>>(new Set());

  // previous action imports commented out for easy re-enable
  // import { approveUser, revokeUserApproval, deleteUser, changeUserRole } from '../../firebase/firestore';

  const { width } = useWindowDimensions();
  const columns = width >= 900 ? 4 : width >= 600 ? 3 : 2; // responsive: 2/3/4
  const gap = 12;

  // Fetch all users and organize by salesman
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersData = await getUsers();
      setUsers(usersData);
      organizeUsersBySalesman(usersData);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to fetch users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Organize users by salesman
  const organizeUsersBySalesman = (usersData: UserData[]) => {
    const salesmen = usersData.filter(user => user.role === 'salesman');
    const customers = usersData.filter(user => user.role === 'customer');

    const salesmanMap = new Map<string, SalesmanWithCustomers>();

    // Initialize all salesmen
    salesmen.forEach(salesman => {
      salesmanMap.set(salesman.uid, {
        salesman,
        customers: []
      });
    });

    // Assign customers to their salesmen
    const unassigned: UserData[] = [];

    customers.forEach(customer => {
      if (customer.salesmanId && salesmanMap.has(customer.salesmanId)) {
        const salesmanData = salesmanMap.get(customer.salesmanId)!;
        salesmanData.customers.push(customer);
      } else {
        unassigned.push(customer);
      }
    });

    // Convert map to array and sort by salesman name
    const salesmanArray = Array.from(salesmanMap.values()).sort((a, b) =>
      (a.salesman.name || '').localeCompare(b.salesman.name || '')
    );

    // Sort unassigned customers by name
    const sortedUnassigned = unassigned.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    setSalesmenWithCustomers(salesmanArray);
    setUnassignedCustomers(sortedUnassigned);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      organizeUsersBySalesman(users);
    } else {
      const q = searchQuery.toLowerCase();
      const filteredUsers = users.filter(user =>
        (user.name || '').toLowerCase().includes(q) ||
        (user.email || '').toLowerCase().includes(q) ||
        (user.phone || '').includes(searchQuery) ||
        (user.city || '').toLowerCase().includes(q)
      );
      organizeUsersBySalesman(filteredUsers);
    }
  }, [searchQuery, users]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // Toggle salesman expansion
  const toggleSalesmanExpansion = (salesmanId: string) => {
    const newExpanded = new Set(expandedSalesmen);
    if (newExpanded.has(salesmanId)) {
      newExpanded.delete(salesmanId);
    } else {
      newExpanded.add(salesmanId);
    }
    setExpandedSalesmen(newExpanded);
  };

  // --------------------------
  // PREVIOUS ACTION FUNCTIONS — COMMENTED OUT FOR SAFETY / EASE OF RE-ENABLE
  // --------------------------
  /*
  const handleApproveUser = async (userId: string, userName: string) => {
    // await approveUser(userId);
    // fetchUsers();
  };

  const handleRevokeApproval = async (userId: string, userName: string) => {
    // await revokeUserApproval(userId);
    // fetchUsers();
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    // await deleteUser(userId);
    // fetchUsers();
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'salesman' | 'customer', userName: string) => {
    // await changeUserRole(userId, newRole);
    // fetchUsers();
  };

  const showConfirmation = (title: string, message: string, onConfirm: () => void) => {
    // Alert.alert(title, message, [
    //   { text: 'Cancel', style: 'cancel' },
    //   { text: 'Confirm', onPress: onConfirm },
    // ]);
  };
  */
  // --------------------------
  // end commented-out action functions
  // --------------------------

  // Get status badge color
  const getStatusColor = (user: UserData) => {
    if (user.role === 'admin') return '#4CAF50';
    if (!user.approved) return '#FF9800';
    return '#2196F3';
  };

  // Get status text
  const getStatusText = (user: UserData) => {
    if (user.role === 'admin') return 'Admin';
    if (!user.approved) return 'Pending Approval';
    return 'Approved';
  };

  // Get total statistics
  const totalCustomers = users.filter(u => u.role === 'customer').length;
  const approvedCustomers = users.filter(u => u.role === 'customer' && u.approved).length;
  const pendingCustomers = users.filter(u => u.role === 'customer' && !u.approved).length;
  const totalSalesmen = users.filter(u => u.role === 'salesman').length;

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading users...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Customer Management
      </Text>

      <Card style={[styles.searchAreaCard]}>
        {/* Wrap Card.Content children in a plain View so we can use overflow there if needed
            This prevents setting overflow: 'hidden' on the Card/Surface itself (preserves shadow) */}
        <View style={styles.cardInnerWrap}>
          <Searchbar
            placeholder="Search customers by name, city, mail..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardInnerWrap}>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text variant="titleLarge" style={styles.statNumber}>
                {totalCustomers}
              </Text>
              <Text variant="bodyMedium" style={styles.statLabel}>
                Total Customers
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="titleLarge" style={styles.statNumber}>
                {approvedCustomers}
              </Text>
              <Text variant="bodyMedium" style={styles.statLabel}>
                Approved
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="titleLarge" style={styles.statNumber}>
                {pendingCustomers}
              </Text>
              <Text variant="bodyMedium" style={styles.statLabel}>
                Pending
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="titleLarge" style={styles.statNumber}>
                {totalSalesmen}
              </Text>
              <Text variant="bodyMedium" style={styles.statLabel}>
                Salesmen
              </Text>
            </View>
          </View>
        </View>
      </Card>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Salesmen with their customers */}
        {salesmenWithCustomers.map(({ salesman, customers }) => (
          <Card key={salesman.uid} style={styles.salesmanCard}>
            <View style={styles.cardInnerWrap}>
              <View style={styles.salesmanHeader}>
                <View style={styles.salesmanInfo}>
                  <Text variant="titleMedium" style={styles.salesmanName}>
                    {salesman.name}
                  </Text>
                  <View style={styles.salesmanDetails}>
                    <Text style={styles.salesmanEmail}>{salesman.email}</Text>
                    <Text style={styles.salesmanCity}>📍 {salesman.city || 'No city'}</Text>
                    <Text style={styles.salesmanId}>ID: {salesman.uid}</Text>
                  </View>
                </View>
                <View style={styles.salesmanStats}>
                  <Chip mode="outlined" style={styles.customerCountChip}>
                    {customers.length} customers
                  </Chip>

                  {/* Actions removed from UI as requested */}

                  <Button
                    mode="text"
                    onPress={() => toggleSalesmanExpansion(salesman.uid)}
                    icon={expandedSalesmen.has(salesman.uid) ? "chevron-up" : "chevron-down"}
                  >
                    {expandedSalesmen.has(salesman.uid) ? "Hide" : "Show"}
                  </Button>
                </View>
              </View>

              {expandedSalesmen.has(salesman.uid) && (
                <View style={styles.customersContainer}>
                  {customers.length === 0 ? (
                    <Text style={styles.noCustomersText}>
                      No customers assigned to this salesman
                    </Text>
                  ) : (
                    <View style={[styles.customersGrid, { marginHorizontal: -Math.round(gap / 2) }]}>
                      {customers.map((customer) => (
                        <View
                          key={customer.uid}
                          style={[
                            styles.customerWrapper,
                            {
                              width: `${100 / columns}%`,
                              paddingHorizontal: Math.round(gap / 2),
                              marginBottom: gap,
                            },
                          ]}
                        >
                          <Card style={styles.customerCard}>
                            {/* wrap content in inner view to allow overflow hiding without clipping Card shadow */}
                            <View style={styles.cardInnerWrap}>
                              <Card.Content>
                                <View style={styles.customerHeader}>
                                  <View style={styles.customerInfo}>
                                    <Text variant="titleSmall" style={styles.customerName}>
                                      {customer.name}
                                    </Text>
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(customer) }]}>
                                      <Text style={styles.statusText}>
                                        {getStatusText(customer)}
                                      </Text>
                                    </View>
                                  </View>

                                  {/* Actions removed from UI as requested */}
                                </View>

                                <View style={styles.customerDetails}>
                                  <Text style={styles.customerDetail}>
                                    <Text style={styles.detailLabel}>Email: </Text>
                                    {customer.email}
                                  </Text>
                                  <Text style={styles.customerDetail}>
                                    <Text style={styles.detailLabel}>Phone: </Text>
                                    {customer.phone || 'Not provided'}
                                  </Text>
                                  <Text style={styles.customerDetail}>
                                    <Text style={styles.detailLabel}>City: </Text>
                                    {customer.city || 'Not provided'}
                                  </Text>
                                  <Text style={styles.customerDetail}>
                                    <Text style={styles.detailLabel}>Joined: </Text>
                                    {customer.createdAt?.toLocaleDateString()}
                                  </Text>
                                </View>
                              </Card.Content>
                            </View>
                          </Card>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          </Card>
        ))}

        {/* Unassigned customers */}
        {unassignedCustomers.length > 0 && (
          <Card style={styles.unassignedCard}>
            <View style={styles.cardInnerWrap}>
              <Text variant="titleLarge" style={styles.sectionTitle}>
                Unassigned Customers ({unassignedCustomers.length})
              </Text>

              <View style={[styles.customersGrid, { marginHorizontal: -Math.round(gap / 2) }]}>
                {unassignedCustomers.map((customer) => (
                  <View
                    key={customer.uid}
                    style={[
                      styles.customerWrapper,
                      {
                        width: `${100 / columns}%`,
                        paddingHorizontal: Math.round(gap / 2),
                        marginBottom: gap,
                      },
                    ]}
                  >
                    <Card style={styles.customerCard}>
                      <View style={styles.cardInnerWrap}>
                        <Card.Content>
                          <View style={styles.customerHeader}>
                            <View style={styles.customerInfo}>
                              <Text variant="titleSmall" style={styles.customerName}>
                                {customer.name}
                              </Text>
                              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(customer) }]}>
                                <Text style={styles.statusText}>
                                  {getStatusText(customer)}
                                </Text>
                              </View>
                              <Chip mode="outlined" compact style={styles.unassignedChip}>
                                No Salesman
                              </Chip>
                            </View>

                            {/* Actions removed from UI as requested */}
                          </View>

                          <View style={styles.customerDetails}>
                            <Text style={styles.customerDetail}>
                              <Text style={styles.detailLabel}>Email: </Text>
                              {customer.email}
                            </Text>
                            <Text style={styles.customerDetail}>
                              <Text style={styles.detailLabel}>Phone: </Text>
                              {customer.phone || 'Not provided'}
                            </Text>
                            <Text style={styles.customerDetail}>
                              <Text style={styles.detailLabel}>City: </Text>
                              {customer.city || 'Not provided'}
                            </Text>
                            <Text style={styles.customerDetail}>
                              <Text style={styles.detailLabel}>Joined: </Text>
                              {customer.createdAt?.toLocaleDateString()}
                            </Text>
                          </View>
                        </Card.Content>
                      </View>
                    </Card>
                  </View>
                ))}
              </View>
            </View>
          </Card>
        )}

        {salesmenWithCustomers.length === 0 && unassignedCustomers.length === 0 && (
          <Card style={styles.noDataCard}>
            <View style={styles.cardInnerWrap}>
              <Card.Content>
                <Text style={styles.noUsersText}>
                  {searchQuery ? 'No customers found matching your search.' : 'No customers found.'}
                </Text>
              </Card.Content>
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: platformStyle.padding ?? 16,
    backgroundColor: '#F5EDE0',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // cardInnerWrap is the wrapper INSIDE every Card where we put overflow if needed.
  // We purposefully do NOT set overflow: 'hidden' on the Card itself so shadows render correctly.
  cardInnerWrap: {
    borderRadius: scaleSize(8),
    overflow: 'hidden',
  },

  title: {
    marginBottom: scaleSize(12),
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    fontSize: scaleFont(18),
  },
  searchBar: {
    backgroundColor: '#fff',
    color: '#00000014',
  },

  searchAreaCard: {
    marginBottom: scaleSize(12),
    borderRadius: scaleSize(8),
  },

  card: {
    marginBottom: scaleSize(12),
    borderRadius: scaleSize(10),
    padding:scaleSize(10),
    // no overflow here — wrapper handles clipping
  },
  cardContent: {
    paddingVertical: scaleSize(8),
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: '700',
    color: '#333',
    fontSize: scaleFont(18),
  },
  statLabel: {
    color: '#666',
    marginTop: scaleSize(4),
    fontSize: scaleFont(12),
  },
  scrollView: {
    flex: 1,
  },
  salesmanCard: {
    marginBottom: scaleSize(12),
    backgroundColor: '#FAF9F6',
    borderRadius: scaleSize(8),
    // no overflow on card
  },
  unassignedCard: {
    marginBottom: scaleSize(12),
    backgroundColor: '#FFF9F2',
    borderRadius: scaleSize(8),
  },
  noDataCard: {
    marginBottom: scaleSize(12),
  },
  salesmanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: scaleSize(12),
  },
  salesmanInfo: {
    flex: 1,
  },
  salesmanName: {
    fontWeight: '700',
    marginBottom: scaleSize(4),
    color: '#333',
    fontSize: scaleFont(16),
  },
  salesmanDetails: {
    marginTop: scaleSize(4),
  },
  salesmanEmail: {
    fontSize: scaleFont(12),
    color: '#666',
    marginBottom: scaleSize(2),
  },
  salesmanCity: {
    fontSize: scaleFont(12),
    color: '#1976D2',
    marginBottom: scaleSize(2),
  },
  salesmanId: {
    fontSize: scaleFont(11),
    color: '#888',
    fontFamily: 'monospace',
  },
  salesmanStats: {
    alignItems: 'flex-end',
  },
  customerCountChip: {
    marginBottom: scaleSize(8),
    color: '#1976D2',
  },

  // customers responsive grid
  customersContainer: {
    marginTop: scaleSize(12),
    paddingTop: scaleSize(12),
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingHorizontal: scaleSize(8),
  },
  customersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  customerWrapper: {
    // width set inline according to columns
    paddingVertical: 4,
    minWidth: 0,
  },
  customerCard: {
    marginBottom: scaleSize(8),
    backgroundColor: '#fff',
    borderLeftWidth: scaleSize(3),
    borderLeftColor: '#F7CAC9',
    borderRadius: scaleSize(8),
    // no overflow here
  },

  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: scaleSize(10),
    marginBottom: scaleSize(8),
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontWeight: '700',
    marginBottom: scaleSize(4),
    fontSize: scaleFont(14),
  },
  statusBadge: {
    paddingHorizontal: scaleSize(8),
    paddingVertical: scaleSize(4),
    borderRadius: scaleSize(12),
    alignSelf: 'flex-start',
    marginBottom: scaleSize(4),
  },
  statusText: {
    color: '#fff',
    fontSize: scaleFont(11),
    fontWeight: '700',
  },
  unassignedChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3E0',
    marginTop: scaleSize(4),
  },
  customerDetails: {
    marginTop: scaleSize(4),
    paddingBottom: scaleSize(8),
  },
  customerDetail: {
    marginBottom: scaleSize(6),
    fontSize: scaleFont(12),
  },
  detailLabel: {
    fontWeight: '700',
    color: '#333',
  },
  noCustomersText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: scaleSize(16),
    fontSize: scaleFont(12),
  },
  noUsersText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginVertical: scaleSize(20),
    fontSize: scaleFont(12),
  },
  sectionTitle: {
    marginBottom: scaleSize(12),
    fontWeight: '700',
    color: '#333',
    fontSize: scaleFont(16),
    padding: scaleSize(12),
  },
  loadingText: {
    marginTop: scaleSize(12),
    color: '#666',
    fontSize: scaleFont(12),
  },
});

export default CustomerManagement;
