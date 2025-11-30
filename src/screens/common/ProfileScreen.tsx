import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Button, Divider } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES } from '../../utils/constants';

const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>
            Profile
          </Text>
          
          <View style={styles.infoContainer}>
            <Text variant="bodyLarge" style={styles.label}>Name:</Text>
            <Text variant="bodyLarge">{user?.name}</Text>
          </View>
          
          <Divider style={styles.divider} />
          
          <View style={styles.infoContainer}>
            <Text variant="bodyLarge" style={styles.label}>Email:</Text>
            <Text variant="bodyLarge">{user?.email}</Text>
          </View>
          
          <Divider style={styles.divider} />
          
          <View style={styles.infoContainer}>
            <Text variant="bodyLarge" style={styles.label}>Phone:</Text>
            <Text variant="bodyLarge">{user?.phone}</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoContainer}>
            <Text variant="bodyLarge" style={styles.label}>User ID:</Text>
            <Text variant="bodyLarge">{user?.uid}</Text>
          </View>
          <Divider style={styles.divider} />
          
          <View style={styles.infoContainer}>
            <Text variant="bodyLarge" style={styles.label}>Role:</Text>
            <Text variant="bodyLarge" style={styles.role}>
              {user?.role===USER_ROLES.SALESMAN?"DISTRIBUTOR":user?.role.toUpperCase()}
            </Text>
          </View>
          
          {user?.role === 'customer' && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.infoContainer}>
                <Text variant="bodyLarge" style={styles.label}>Status:</Text>
                <Text variant="bodyLarge" style={user.approved ? styles.approved : styles.pending}>
                  {user.approved ? 'Approved' : 'Pending Approval'}
                </Text>
              </View>
            </>
          )}
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        onPress={handleLogout}
        style={styles.logoutButton}
        buttonColor="#E6C76E"
      >
        Logout
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EDE0',
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#3B3B3B',
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontWeight: 'bold',
    color: '#3B3B3B',
  },
  divider: {
    marginVertical: 8,
  },
  role: {
    fontWeight: 'bold',
    color: '#F7CAC9',
  },
  approved: {
    color: 'green',
    fontWeight: 'bold',
  },
  pending: {
    color: 'orange',
    fontWeight: 'bold',
  },
  logoutButton: {
    marginTop: 'auto',
  },
});

export default ProfileScreen;