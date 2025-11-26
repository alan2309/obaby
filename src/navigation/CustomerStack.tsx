import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HomeCatalog from '../screens/customer/HomeCatalog';
import PlaceOrder from '../screens/customer/PlaceOrder';
import MyOrders from '../screens/customer/MyOrders';
import NotificationsScreen from '../screens/common/NotificationsScreen';
import ProfileScreen from '../screens/common/ProfileScreen';
import { Platform } from 'react-native';
import CategoriesScreen from '../screens/common/CategoriesScreen';
import CategoryProductsScreen from '../screens/salesman/CategoryProductsScreen';
import ProductDetailScreen from '../screens/salesman/ProductDetailScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const CustomerTabs = () => {
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
        name="Home" 
        component={CategoriesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="My Orders" 
        component={MyOrders}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-list" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bell" size={size} color={color} />
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

const CustomerStack: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="CustomerTabs" component={CustomerTabs} options={{ headerShown: false }} />
      <Stack.Screen name="PlaceOrder" component={PlaceOrder} />
    <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
    </Stack.Navigator>
  );
};

export default CustomerStack;