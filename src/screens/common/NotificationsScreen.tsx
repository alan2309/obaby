import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Chip, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { getNotifications, Notification, markNotificationAsRead } from '../../firebase/functions';
import { scaleSize, platformStyle } from '../../utils/constants';

const NotificationsScreen: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      if (!user) return;
      
      const notificationsData = await getNotifications(user.uid, user.role);
      setNotifications(notificationsData);
    } catch (error: any) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read && notification.id) {
      await markNotificationAsRead(notification.id);
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notification.id ? { ...n, read: true } : n
        )
      );
    }
  };

  const getTargetDisplayName = (target: string) => {
    switch (target) {
      case 'all': return 'All Users';
      case 'salesman': return 'Sales Team'; 
      case 'customers': return 'Customers';
      default: return 'Personal';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F7CAC9" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
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
          Notifications
        </Text>

        {unreadCount > 0 && (
          <Card style={styles.unreadCard}>
            <Card.Content>
              <Text style={styles.unreadText}>
                You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </Text>
            </Card.Content>
          </Card>
        )}

        {notifications.map(notification => (
          <Card 
            key={notification.id}
            style={[
              styles.notificationCard,
              !notification.read && styles.unreadNotification
            ]}
            onPress={() => handleNotificationPress(notification)}
          >
            <Card.Content>
              <View style={styles.notificationHeader}>
                <Text variant="titleMedium" style={styles.notificationTitle}>
                  {notification.title}
                </Text>
                {!notification.read && (
                  <Chip mode="outlined" style={styles.unreadChip}>
                    New
                  </Chip>
                )}
              </View>

              <Text style={styles.notificationMessage}>
                {notification.message}
              </Text>

              <View style={styles.notificationFooter}>
                <Chip 
                  mode="outlined" 
                  style={styles.targetChip}
                  textStyle={styles.chipText}
                >
                  {getTargetDisplayName(notification.target)}
                </Chip>
                <Text style={styles.dateText}>
                  {formatDate(notification.createdAt)}
                </Text>
              </View>
            </Card.Content>
          </Card>
        ))}

        {notifications.length === 0 && (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptySubtext}>
                Notifications from administrators will appear here
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
    marginBottom: scaleSize(20),
    color: '#3B3B3B',
  },
  unreadCard: {
    marginBottom: scaleSize(16),
    backgroundColor: '#FFF3E0',
    borderColor: '#FFA000',
    borderWidth: 1,
  },
  unreadText: {
    textAlign: 'center',
    color: '#FFA000',
    fontWeight: '600',
  },
  notificationCard: {
    marginBottom: scaleSize(12),
    backgroundColor: '#FAF9F6',
  },
  unreadNotification: {
    borderColor: '#F7CAC9',
    borderWidth: 2,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scaleSize(8),
  },
  notificationTitle: {
    flex: 1,
    color: '#3B3B3B',
    fontSize: scaleSize(16),
    fontWeight: '600',
  },
  unreadChip: {
    height: scaleSize(20),
    backgroundColor: '#FFEBEE',
  },
  notificationMessage: {
    color: '#3B3B3B',
    marginBottom: scaleSize(12),
    fontSize: scaleSize(14),
    lineHeight: scaleSize(18),
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetChip: {
    height: scaleSize(22),
    backgroundColor: '#E3F2FD',
  },
  chipText: {
    fontSize: scaleSize(10),
  },
  dateText: {
    fontSize: scaleSize(10),
    color: '#A08B73',
  },
  emptyCard: {
    alignItems: 'center',
    padding: scaleSize(30),
    backgroundColor: '#FAF9F6',
  },
  emptyText: {
    textAlign: 'center',
    color: '#3B3B3B',
    fontSize: scaleSize(16),
    fontWeight: '600',
    marginBottom: scaleSize(8),
  },
  emptySubtext: {
    textAlign: 'center',
    color: '#A08B73',
    fontSize: scaleSize(12),
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

export default NotificationsScreen;