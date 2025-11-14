import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DashboardSalesman from '../screens/salesman/DashboardSalesman';
import ProductCatalogSalesman from '../screens/salesman/ProductCatalogSalesman';
import CreateOrderScreen from '../screens/salesman/CreateOrderScreen';
import MyOrdersScreen from '../screens/salesman/MyOrdersScreen';
import PerformanceScreen from '../screens/salesman/PerformanceScreen';
import NotificationsScreen from '../screens/common/NotificationsScreen';
import ProfileScreen from '../screens/common/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const SalesmanTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#F7CAC9',
        tabBarInactiveTintColor: '#A08B73',
        tabBarStyle: { backgroundColor: '#FAF9F6' },
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardSalesman}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      /> 
       <Tab.Screen 
        name="Catalog" 
        component={ProductCatalogSalesman}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="shopping" size={size} color={color} />
          ),
        }}
      /> 
      <Tab.Screen 
        name="Create Order" 
        component={CreateOrderScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="plus-circle" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="My Orders" 
        component={MyOrdersScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-list" size={size} color={color} />
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

const SalesmanStack: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SalesmanTabs" component={SalesmanTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Performance" component={PerformanceScreen} />
      <Stack.Screen name="NotificationsSalesman" component={NotificationsScreen} />
    </Stack.Navigator>
  );
};

export default SalesmanStack;