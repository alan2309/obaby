import React, { useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DashboardScreen from '../screens/admin/DashboardScreen';
import InventoryScreen from '../screens/admin/InventoryScreen';
import ProductManagement from '../screens/admin/ProductManagement';
import OrderManagement from '../screens/admin/OrderManagement';
import SalesmanManagement from '../screens/admin/SalesmanManagement';
import CustomerManagement from '../screens/admin/CustomerManagement';
import ReportsScreen from '../screens/admin/ReportsScreen';
import NotificationsAdmin from '../screens/admin/NotificationsAdmin';
import ProfileScreen from '../screens/common/ProfileScreen';
import { Platform, Dimensions, StyleSheet } from 'react-native';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const screenOptions = {
  headerShown: false,
  gestureEnabled: Platform.OS !== 'web',
};

// Create wrapper components that accept refresh triggers
const DashboardWithRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  return (
    <DashboardScreen 
      key={refreshKey}
    />
  );
};

const InventoryWithRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  return (
    <InventoryScreen 
      key={refreshKey}
    />
  );
};

const ProductManagementWithRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  return (
    <ProductManagement 
      key={refreshKey}
    />
  );
};

const OrderManagementWithRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  return (
    <OrderManagement 
      key={refreshKey}
    />
  );
};

const ReportsWithRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  return (
    <ReportsScreen 
      key={refreshKey}
    />
  );
};

const ProfileWithRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  return (
    <ProfileScreen 
      key={refreshKey}
    />
  );
};

const SalesmanManagementWithRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  return (
    <SalesmanManagement 
      key={refreshKey}
    />
  );
};

const CustomerManagementWithRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  return (
    <CustomerManagement 
      key={refreshKey}
    />
  );
};

const NotificationsAdminWithRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  return (
    <NotificationsAdmin 
      key={refreshKey}
    />
  );
};

const AdminTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#F7CAC9',
        tabBarInactiveTintColor: '#A08B73',
        tabBarStyle: styles.tabBar,
        headerStyle: {
          backgroundColor: '#FAF9F6',
        },
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardWithRefresh}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // This will trigger a refresh when the tab is pressed
            navigation.setParams({ refresh: Date.now() });
          },
        })}
      />
      <Tab.Screen 
        name="Inventory" 
        component={InventoryWithRefresh}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="warehouse" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            navigation.setParams({ refresh: Date.now() });
          },
        })}
      />
      <Tab.Screen 
        name="Products" 
        component={ProductManagementWithRefresh}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="package-variant" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            navigation.setParams({ refresh: Date.now() });
          },
        })}
      />
      <Tab.Screen 
        name="Orders" 
        component={OrderManagementWithRefresh}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-list" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            navigation.setParams({ refresh: Date.now() });
          },
        })}
      />
      <Tab.Screen 
        name="Reports" 
        component={ReportsWithRefresh}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-bar" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            navigation.setParams({ refresh: Date.now() });
          },
        })}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileWithRefresh}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            navigation.setParams({ refresh: Date.now() });
          },
        })}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FAF9F6',
    ...Platform.select({
      web: {
        width: '100%',
        maxWidth: '100%',
        alignSelf: 'stretch',
        marginHorizontal: 0,
        left: 0,
        right: 0,
      } as any,
    }),
  },
  tabBarItem: Platform.select({
    web: {
      flex: 1,
      minWidth: 0,
    },
    default: {},
  }) as any,
});

const AdminStack: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AdminTabs" component={AdminTabs} options={{ headerShown: false }} />
      <Stack.Screen 
        name="SalesmanManagement" 
        component={SalesmanManagementWithRefresh}
        options={{
          title: 'Salesman Management',
          headerStyle: { backgroundColor: '#FAF9F6' },
        }}
      />
      <Stack.Screen 
        name="CustomerManagement" 
        component={CustomerManagementWithRefresh}
        options={{
          title: 'Customer Management',
          headerStyle: { backgroundColor: '#FAF9F6' },
        }}
      />
      <Stack.Screen 
        name="NotificationsAdmin" 
        component={NotificationsAdminWithRefresh}
        options={{
          title: 'Notifications',
          headerStyle: { backgroundColor: '#FAF9F6' },
        }}
      />
    </Stack.Navigator>
  );
};

export default AdminStack;