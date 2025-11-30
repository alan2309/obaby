// src/navigation/SalesmanStack.tsx
import React, { useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DashboardSalesman from '../screens/salesman/DashboardSalesman';
import ProductCatalogSalesman from '../screens/salesman/ProductCatalogSalesman';
import MyOrdersScreen from '../screens/salesman/MyOrdersScreen';
import PerformanceScreen from '../screens/salesman/PerformanceScreen';
import NotificationsScreen from '../screens/common/NotificationsScreen';
import ProfileScreen from '../screens/common/ProfileScreen';
import ProductDetailScreen from '../screens/salesman/ProductDetailScreen';
import OrderScreen from '../screens/salesman/OrderScreen';
import CategoriesScreen from '../screens/common/CategoriesScreen';
import CategoryProductsScreen from '../screens/salesman/CategoryProductsScreen';
import CustomersScreen from '../screens/salesman/CustomersScreen';
import WorkersScreen from '../screens/salesman/WorkersScreen';

// Define types inline
type SalesmanStackParamList = {
  SalesmanTabs: undefined;
  Performance: undefined;
  NotificationsSalesman: undefined;
  ProductDetail: { product: any };
  OrderScreen: undefined;
  CategoryProducts: { categoryId: string; categoryTitle: string };
};

const Stack = createStackNavigator<SalesmanStackParamList>();
const Tab = createBottomTabNavigator();

// Create wrapper components that accept refresh triggers
const ProductCatalogWithRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  return (
    <ProductCatalogSalesman 
      key={refreshKey}
    />
  );
};

const MyOrdersWithRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  return (
    <MyOrdersScreen 
      key={refreshKey}
    />
  );
};
const CustomersWithRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  return (
    <CustomersScreen 
      key={refreshKey}
    />
  );
};
const OrderScreenWithRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  return (
    <OrderScreen 
      key={refreshKey}
    />
  );
};
const CategoriesWithRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  return (
    <CategoriesScreen 
      key={refreshKey}
    />
  );
};
const DashboardWithRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  return (
    <DashboardSalesman 
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
const WorkerWithRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  return (
    <WorkersScreen 
      key={refreshKey}
    />
  );
};

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
        name="Catalog" 
        component={CategoriesWithRefresh}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="shopping" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // This will trigger a refresh when the tab is pressed
            navigation.setParams({ refresh: Date.now() });
          },
        })}
      />
      
      {/* Repeat for other tabs with the same listener */}
      <Tab.Screen 
        name="My Orders" 
        component={MyOrdersWithRefresh}
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
        name="Customers" 
        component={CustomersWithRefresh}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-group" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            navigation.setParams({ refresh: Date.now() });
          },
        })}
      />
      <Tab.Screen 
        name="Salesmen" 
        component={WorkerWithRefresh}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-group" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            navigation.setParams({ refresh: Date.now() });
          },
        })}
      />
      <Tab.Screen 
        name="OrderCart" 
        component={OrderScreenWithRefresh}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cart" size={size} color={color} />
          ),
          tabBarBadge: undefined,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            navigation.setParams({ refresh: Date.now() });
          },
        })}
      />
      
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

const SalesmanStack: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SalesmanTabs" component={SalesmanTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Performance" component={PerformanceScreen} />
      <Stack.Screen name="NotificationsSalesman" component={NotificationsScreen} />
      <Stack.Screen 
        name="ProductDetail" 
        component={ProductDetailScreen}
        options={{ 
          title: 'Product Details',
          headerStyle: { backgroundColor: '#FAF9F6' },
        }}
      />
      <Stack.Screen 
        name="CategoryProducts" 
        component={CategoryProductsScreen}
        options={({ route }) => ({ 
          title: (route.params as any)?.categoryTitle || 'Products',
          headerStyle: { backgroundColor: '#FAF9F6' },
        })}
      />
    </Stack.Navigator>
  );
};

export default SalesmanStack;