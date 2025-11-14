import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, TextInput, Button, Chip, DataTable, SegmentedButtons, FAB } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { createNotification, getNotifications, Notification } from '../../firebase/functions';
import { scaleSize, platformStyle } from '../../utils/constants';

const NotificationsAdmin: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'all' | 'salesman' | 'customers'>('all');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const notificationsData = await getNotifications(user?.uid || '', user?.role || '');
      setNotifications(notificationsData);
    } catch (error: any) {
      console.error('Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Error', 'Please fill in both title and message');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User not found');
      return;
    }

    try {
      setSending(true);
      
      await createNotification({
        title: title.trim(),
        message: message.trim(),
        sentBy: user.uid,
        target,
      });

      Alert.alert('Success', 'Notification sent successfully!');
      
      // Reset form
      setTitle('');
      setMessage('');
      setTarget('all');
      
      // Reload notifications
      loadNotifications();
    } catch (error: any) {
      console.error('Error sending notification:', error);
      Alert.alert('Error', 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const getTargetDisplayName = (target: string) => {
    switch (target) {
      case 'all': return 'All Users';
      case 'salesman': return 'Sales Team';
      case 'customers': return 'Customers';
      default: return target;
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Send Notifications
        </Text>

        {/* Notification Form */}
        <Card style={styles.formCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.formTitle}>
              Create New Notification
            </Text>

            <TextInput
              label="Notification Title"
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              mode="outlined"
              maxLength={100}
            />

            <TextInput
              label="Message"
              value={message}
              onChangeText={setMessage}
              style={[styles.input, styles.messageInput]}
              mode="outlined"
              multiline
              numberOfLines={4}
              maxLength={500}
            />

            <Text variant="bodyMedium" style={styles.targetLabel}>
              Send To:
            </Text>

            <SegmentedButtons
              value={target}
              onValueChange={(value) => setTarget(value as any)}
              buttons={[
                { value: 'all', label: 'All Users' },
                { value: 'salesman', label: 'Sales Team' },
                { value: 'customers', label: 'Customers' },
              ]}
              style={styles.segment}
            />

            <Button
              mode="contained"
              onPress={handleSendNotification}
              loading={sending}
              disabled={sending || !title.trim() || !message.trim()}
              style={styles.sendButton}
              icon="send"
            >
              Send Notification
            </Button>
          </Card.Content>
        </Card>

        {/* Notification History */}
        <Card style={styles.historyCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.historyTitle}>
              Notification History
            </Text>

            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Title</DataTable.Title>
                <DataTable.Title>Target</DataTable.Title>
                <DataTable.Title>Date</DataTable.Title>
              </DataTable.Header>

              {notifications.slice(0, 10).map(notification => (
                <DataTable.Row key={notification.id}>
                  <DataTable.Cell>
                    <View style={styles.notificationCell}>
                      <Text style={styles.notificationTitle} numberOfLines={1}>
                        {notification.title}
                      </Text>
                      <Text style={styles.notificationMessage} numberOfLines={1}>
                        {notification.message}
                      </Text>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <Chip 
                      mode="outlined" 
                      style={styles.targetChip}
                      textStyle={styles.chipText}
                    >
                      {getTargetDisplayName(notification.target)}
                    </Chip>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <Text style={styles.dateText}>
                      {formatDate(notification.createdAt)}
                    </Text>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>

            {notifications.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No notifications sent yet</Text>
                <Text style={styles.emptySubtext}>
                  Send your first notification to get started!
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      <FAB
        icon="refresh"
        style={styles.fab}
        onPress={loadNotifications}
        loading={loading}
      />
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
    paddingBottom: 100,
  },
  title: {
    textAlign: 'center',
    marginBottom: scaleSize(24),
    color: '#3B3B3B',
  },
  formCard: {
    marginBottom: scaleSize(20),
    backgroundColor: '#FAF9F6',
  },
  formTitle: {
    textAlign: 'center',
    marginBottom: scaleSize(16),
    color: '#3B3B3B',
  },
  input: {
    marginBottom: scaleSize(12),
  },
  messageInput: {
    height: scaleSize(100),
  },
  targetLabel: {
    marginBottom: scaleSize(8),
    color: '#3B3B3B',
    fontWeight: '500',
  },
  segment: {
    marginBottom: scaleSize(16),
  },
  sendButton: {
    backgroundColor: '#F7CAC9',
  },
  historyCard: {
    backgroundColor: '#FAF9F6',
  },
  historyTitle: {
    textAlign: 'center',
    marginBottom: scaleSize(16),
    color: '#3B3B3B',
  },
  notificationCell: {
    maxWidth: scaleSize(120),
  },
  notificationTitle: {
    fontSize: scaleSize(12),
    fontWeight: '600',
    color: '#3B3B3B',
    marginBottom: scaleSize(2),
  },
  notificationMessage: {
    fontSize: scaleSize(10),
    color: '#A08B73',
  },
  targetChip: {
    height: scaleSize(24),
    backgroundColor: '#E3F2FD',
  },
  chipText: {
    fontSize: scaleSize(9),
  },
  dateText: {
    fontSize: scaleSize(10),
    color: '#A08B73',
  },
  emptyState: {
    alignItems: 'center',
    padding: scaleSize(20),
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
  fab: {
    position: 'absolute',
    margin: scaleSize(16),
    right: 0,
    bottom: 0,
    backgroundColor: '#E6C76E',
  },
});

export default NotificationsAdmin;