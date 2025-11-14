import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { Text, Card, Button, Searchbar, ActivityIndicator, Menu, Divider } from 'react-native-paper';
import { 
  getUsers, 
  approveUser, 
  revokeUserApproval, 
  deleteUser, 
  changeUserRole 
} from '../../firebase/firestore';
import { UserData } from '../../firebase/auth';
import { auth } from '../../firebase/config';

const CustomerManagement: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch all users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersData = await getUsers();
      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to fetch users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user =>
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.phone?.includes(searchQuery)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // Handle user approval
  const handleApproveUser = async (userId: string, userName: string) => {
    try {
      setActionLoading(userId);
      await approveUser(userId);
      Alert.alert('Success', `${userName} has been approved successfully`);
      fetchUsers(); // Refresh the list
    } catch (error: any) {
      console.error('Error approving user:', error);
      Alert.alert('Error', error.message || 'Failed to approve user');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle revoke approval
  const handleRevokeApproval = async (userId: string, userName: string) => {
    try {
      setActionLoading(userId);
      await revokeUserApproval(userId);
      Alert.alert('Success', `Approval revoked for ${userName}`);
      fetchUsers(); // Refresh the list
    } catch (error: any) {
      console.error('Error revoking approval:', error);
      Alert.alert('Error', error.message || 'Failed to revoke approval');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle delete user
  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      setActionLoading(userId);
      await deleteUser(userId);
      Alert.alert('Success', `${userName} has been deleted successfully`);
      fetchUsers(); // Refresh the list
    } catch (error: any) {
      console.error('Error deleting user:', error);
      Alert.alert('Error', error.message || 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle role change
  const handleRoleChange = async (userId: string, newRole: 'admin' | 'salesman' | 'customer', userName: string) => {
    try {
      setActionLoading(userId);
      await changeUserRole(userId, newRole);
      Alert.alert('Success', `${userName} is now a ${newRole}`);
      fetchUsers(); // Refresh the list
    } catch (error: any) {
      console.error('Error changing role:', error);
      Alert.alert('Error', error.message || 'Failed to change user role');
    } finally {
      setActionLoading(null);
    }
  };

  // Show confirmation dialog for actions
  const showConfirmation = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = 'Confirm',
    destructive = false
  ) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: confirmText, 
          style: destructive ? 'destructive' : 'default',
          onPress: onConfirm
        }
      ]
    );
  };

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

  // Check if action is loading for a specific user
  const isActionLoading = (userId: string) => actionLoading === userId;

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
      
      <Searchbar
        placeholder="Search users by name, email, or phone..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      <Card style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text variant="titleLarge" style={styles.statNumber}>
                {users.length}
              </Text>
              <Text variant="bodyMedium" style={styles.statLabel}>
                Total Users
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="titleLarge" style={styles.statNumber}>
                {users.filter(u => u.approved).length}
              </Text>
              <Text variant="bodyMedium" style={styles.statLabel}>
                Approved
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="titleLarge" style={styles.statNumber}>
                {users.filter(u => !u.approved).length}
              </Text>
              <Text variant="bodyMedium" style={styles.statLabel}>
                Pending
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Card style={styles.usersCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              User Accounts ({filteredUsers.length})
            </Text>
            
            {filteredUsers.length === 0 ? (
              <Text style={styles.noUsersText}>
                {searchQuery ? 'No users found matching your search.' : 'No users found.'}
              </Text>
            ) : (
              filteredUsers.map((user) => (
                <Card key={user.uid} style={styles.userCard}>
                  <Card.Content>
                    <View style={styles.userHeader}>
                      <View style={styles.userInfo}>
                        <Text variant="titleMedium" style={styles.userName}>
                          {user.name}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(user) }]}>
                          <Text style={styles.statusText}>
                            {getStatusText(user)}
                          </Text>
                        </View>
                      </View>
                      
                      <Menu
                        visible={menuVisible === user.uid}
                        onDismiss={() => setMenuVisible(null)}
                        anchor={
                          <Button 
                            mode="outlined" 
                            onPress={() => setMenuVisible(user.uid)}
                            icon="dots-vertical"
                            disabled={isActionLoading(user.uid!)}
                            loading={isActionLoading(user.uid!)}
                          >
                            Actions
                          </Button>
                        }
                      >
                        {user.role !== 'admin' && (
                          <>
                            {!user.approved ? (
                              <Menu.Item
                                leadingIcon="check"
                                title="Approve User"
                                onPress={() => {
                                  setMenuVisible(null);
                                  showConfirmation(
                                    'Approve User',
                                    `Are you sure you want to approve ${user.name}?`,
                                    () => handleApproveUser(user.uid!, user.name)
                                  );
                                }}
                              />
                            ) : (
                              <Menu.Item
                                leadingIcon="close"
                                title="Revoke Approval"
                                onPress={() => {
                                  setMenuVisible(null);
                                  showConfirmation(
                                    'Revoke Approval',
                                    `Are you sure you want to revoke approval for ${user.name}?`,
                                    () => handleRevokeApproval(user.uid!, user.name),
                                    'Revoke',
                                    true
                                  );
                                }}
                              />
                            )}
                            <Divider />
                            <Menu.Item
                              leadingIcon="account-convert"
                              title="Make Admin"
                              onPress={() => {
                                setMenuVisible(null);
                                showConfirmation(
                                  'Make Admin',
                                  `Are you sure you want to make ${user.name} an admin?`,
                                  () => handleRoleChange(user.uid!, 'admin', user.name)
                                );
                              }}
                            />
                            <Menu.Item
                              leadingIcon="account"
                              title="Make Salesman"
                              onPress={() => {
                                setMenuVisible(null);
                                showConfirmation(
                                  'Make Salesman',
                                  `Are you sure you want to make ${user.name} a salesman?`,
                                  () => handleRoleChange(user.uid!, 'salesman', user.name)
                                );
                              }}
                            />
                            <Menu.Item
                              leadingIcon="account-outline"
                              title="Make Customer"
                              onPress={() => {
                                setMenuVisible(null);
                                showConfirmation(
                                  'Make Customer',
                                  `Are you sure you want to make ${user.name} a customer?`,
                                  () => handleRoleChange(user.uid!, 'customer', user.name)
                                );
                              }}
                            />
                            <Divider />
                          </>
                        )}
                        
                        {user.uid !== auth.currentUser?.uid && (
                          <Menu.Item
                            leadingIcon="delete"
                            title="Delete Account"
                            titleStyle={{ color: 'red' }}
                            onPress={() => {
                              setMenuVisible(null);
                              showConfirmation(
                                'Delete User',
                                `Are you sure you want to delete ${user.name}? This action cannot be undone.`,
                                () => handleDeleteUser(user.uid!, user.name),
                                'Delete',
                                true
                              );
                            }}
                          />
                        )}
                      </Menu>
                    </View>

                    <View style={styles.userDetails}>
                      <Text style={styles.userDetail}>
                        <Text style={styles.detailLabel}>Email: </Text>
                        {user.email}
                      </Text>
                      <Text style={styles.userDetail}>
                        <Text style={styles.detailLabel}>Phone: </Text>
                        {user.phone || 'Not provided'}
                      </Text>
                      <Text style={styles.userDetail}>
                        <Text style={styles.detailLabel}>Role: </Text>
                        {user.role}
                      </Text>
                      {user.role === 'salesman' && (
                        <>
                          <Text style={styles.userDetail}>
                            <Text style={styles.detailLabel}>Max Discount: </Text>
                            {user.maxDiscountPercent || 0}%
                          </Text>
                          <Text style={styles.userDetail}>
                            <Text style={styles.detailLabel}>Total Sales: </Text>
                            ${user.totalSales || 0}
                          </Text>
                        </>
                      )}
                      <Text style={styles.userDetail}>
                        <Text style={styles.detailLabel}>Joined: </Text>
                        {user.createdAt?.toLocaleDateString()}
                      </Text>
                    </View>
                  </Card.Content>
                </Card>
              ))
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F5EDE0',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  searchBar: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  card: {
    marginBottom: 16,
  },
  cardContent: {
    paddingVertical: 8,
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
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  usersCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  noUsersText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginVertical: 20,
  },
  userCard: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userDetails: {
    marginTop: 8,
  },
  userDetail: {
    marginBottom: 4,
    fontSize: 14,
  },
  detailLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
});

export default CustomerManagement;