import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/common/LoginScreen';
import AdminStack from './AdminStack';
import SalesmanStack from './SalesmanStack';
// import CustomerStack from './CustomerStack';
import LoadingScreen from '../screens/common/LoadingScreen';

const Stack = createStackNavigator();

const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();

  console.log('🔐 Auth State:', { 
    user: user ? `${user.name} (${user.role})` : 'No user', 
    loading, 
    userExists: !!user 
  });

  if (loading) {
    console.log('🔄 Showing loading screen...');
    return <LoadingScreen />;
  }

  console.log('🎯 Routing to:', !user ? 'Login' : user.role);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user.role === 'admin' ? (
          <Stack.Screen name="AdminStack" component={AdminStack} />
        ) : user.role === 'salesman' ? (
          <Stack.Screen name="SalesmanStack" component={SalesmanStack} />
        // ) : user.role === 'customer' ? (
        //   <Stack.Screen name="CustomerStack" component={CustomerStack} />
        ) : (
          // Fallback for unknown roles
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;