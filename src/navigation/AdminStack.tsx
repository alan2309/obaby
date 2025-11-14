import React from 'react';
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
import { Platform } from 'react-native';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const screenOptions = {
  headerShown: false,
  gestureEnabled: Platform.OS !== 'web', // Disable gestures on web
};
const AdminTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
  tabBarActiveTintColor: '#F7CAC9',
  tabBarInactiveTintColor: '#A08B73',
  tabBarStyle: {
    backgroundColor: '#FAF9F6',
    ...Platform.select({
      web: {
        maxWidth: 500,
        alignSelf: 'center',
        marginHorizontal: 'auto',
      },
    }),
  },
  headerStyle: {
    backgroundColor: '#FAF9F6',
  },
}}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
  name="Inventory" 
  component={InventoryScreen}
  options={{
    tabBarIcon: ({ color, size }) => (
      <MaterialCommunityIcons name="warehouse" size={size} color={color} />
    ),
  }}
/>
      <Tab.Screen 
        name="Products" 
        component={ProductManagement}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="package-variant" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Orders" 
        component={OrderManagement}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-list" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Reports" 
        component={ReportsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-bar" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="notifications" 
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const AdminStack: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AdminTabs" component={AdminTabs} options={{ headerShown: false }} />
      <Stack.Screen name="SalesmanManagement" component={SalesmanManagement} />
      <Stack.Screen name="CustomerManagement" component={CustomerManagement} />
      <Stack.Screen name="NotificationsAdmin" component={NotificationsAdmin} />
    </Stack.Navigator>
  );
};

export default AdminStack;