// src/screens/salesman/Workers.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { registerWorker } from '../../firebase/auth';
import { getWorkersBySalesman } from '../../firebase/firestore';
import { getAuth } from 'firebase/auth';
import { UserData } from '../../firebase/auth';
import { USER_ROLES } from '../../utils/constants';

const WorkersScreen: React.FC = () => {
  const [workers, setWorkers] = useState<UserData[]>([]);
  const [filteredWorkers, setFilteredWorkers] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newWorker, setNewWorker] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
  });
  const [creating, setCreating] = useState(false);

  const currentUser = getAuth().currentUser;

  const loadWorkers = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const workersData = await getWorkersBySalesman(currentUser.uid);
      setWorkers(workersData);
      setFilteredWorkers(workersData);
    } catch (error) {
      console.error('Error loading workers:', error);
      Alert.alert('Error', 'Failed to load workers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  // Filter workers based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredWorkers(workers);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = workers.filter(worker =>
        (worker.name?.toLowerCase() || '').includes(query) ||
        (worker.email?.toLowerCase() || '').includes(query) ||
        (worker.phone || '').includes(query) ||
        (worker.city?.toLowerCase() || '').includes(query)
      );
      setFilteredWorkers(filtered);
    }
  }, [searchQuery, workers]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadWorkers();
  };

  const handleCreateWorker = async () => {
    if (!newWorker.name || !newWorker.email || !newWorker.phone || !newWorker.city) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setCreating(true);
    try {
      await registerWorker(
        newWorker.email,
        newWorker.name,
        newWorker.phone,
        newWorker.city,
        currentUser.uid,
      );

      Alert.alert('Success', 'Salesman created successfully. They will appear in the system once approved.');
      
      // Reset form and close modal
      setNewWorker({ name: '', email: '', phone: '', city: '' });
      setModalVisible(false);
      
      // Refresh the list
      loadWorkers();
    } catch (error: any) {
      console.error('Error creating Salesman:', error);
      Alert.alert('Error', error.message || 'Failed to create salesman');
    } finally {
      setCreating(false);
    }
  };

  const renderWorkerItem = ({ item }: { item: UserData }) => (
    <View style={styles.workerCard}>
      <View style={styles.workerInfo}>
        <Text style={styles.workerName}>{item.name || 'No Name'}</Text>
        <Text style={styles.workerDetail}>Email: {item.email || 'No Email'}</Text>
        <Text style={styles.workerDetail}>Phone: {item.phone || 'No Phone'}</Text>
        <Text style={styles.workerDetail}>City: {item.city || 'No City'}</Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: item.approved ? '#4CAF50' : '#FF9800' }
        ]}>
          <Text style={styles.statusText}>
            {item.approved ? 'Approved' : 'Pending Approval'}
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Loading workers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Salesman</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search workers by name, email, phone, or city..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <MaterialCommunityIcons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Results Info */}
      {searchQuery.length > 0 && (
        <View style={styles.searchInfo}>
          <Text style={styles.searchInfoText}>
            {filteredWorkers.length} Salesman{filteredWorkers.length !== 1 ? 's' : ''} found for "{searchQuery}"
          </Text>
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearSearchText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Workers List */}
      <FlatList
        data={filteredWorkers}
        renderItem={renderWorkerItem}
        keyExtractor={(item) => item.id || item.uid || Math.random().toString()}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons 
              name={searchQuery ? "account-search" : "account-hard-hat"} 
              size={64} 
              color="#CCC" 
            />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No workers found' : 'No workers found'}
            </Text>
            <Text style={styles.emptySubText}>
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'Add your first Salesman to get started'
              }
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={styles.createButtonEmpty}
                onPress={() => setModalVisible(true)}
              >
                <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
                <Text style={styles.createButtonEmptyText}>Create Your First Salesman</Text>
              </TouchableOpacity>
            )}
            {searchQuery && (
              <TouchableOpacity
                style={styles.clearSearchButton}
                onPress={() => setSearchQuery('')}
              >
                <Text style={styles.clearSearchButtonText}>Clear Search</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Create Worker Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Salesman</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={newWorker.name}
                onChangeText={(text) => setNewWorker(prev => ({ ...prev, name: text }))}
                placeholder="Enter salesmen name"
              />

              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={newWorker.email}
                onChangeText={(text) => setNewWorker(prev => ({ ...prev, email: text }))}
                placeholder="Enter email address"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Phone *</Text>
              <TextInput
                style={styles.input}
                value={newWorker.phone}
                onChangeText={(text) => setNewWorker(prev => ({ ...prev, phone: text }))}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>City *</Text>
              <TextInput
                style={styles.input}
                value={newWorker.city}
                onChangeText={(text) => setNewWorker(prev => ({ ...prev, city: text }))}
                placeholder="Enter city"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}
                  disabled={creating}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.createButton, creating && styles.disabledButton]}
                  onPress={handleCreateWorker}
                  disabled={creating}
                >
                  <Text style={styles.createButtonText}>
                    {creating ? 'Creating...' : 'Create Salesman'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#f55d5aff',
    padding: 12,
    borderRadius: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  searchInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchInfoText: {
    fontSize: 14,
    color: '#666',
  },
  clearSearchText: {
    fontSize: 14,
    color: '#F7CAC9',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  workerCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  workerDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    flex: 1,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  createButtonEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7CAC9',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  createButtonEmptyText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  clearSearchButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F7CAC9',
  },
  clearSearchButtonText: {
    color: '#F7CAC9',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  form: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#FFF',
  },
  note: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  createButton: {
    backgroundColor: '#F7CAC9',
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  createButtonText: {
    color: '#000',
    fontWeight: '600',
  },
});

export default WorkersScreen;