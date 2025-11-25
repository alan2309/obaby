import React, { createContext, useState, useContext, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, firestore } from '../firebase/config';
import { loginUser, registerCustomer, logoutUser, UserData, recordLogin, recordLogout } from '../firebase/auth';
import { COLLECTIONS, USER_ROLES } from '../utils/constants';
import { Alert } from 'react-native';

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, userData: Omit<UserData, 'uid' | 'createdAt'>) => Promise<{ success: boolean } | void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        console.log('🔄 Auth state changed:', firebaseUser?.email);
        
        // Skip auth state processing during registration
        if (isRegistering) {
          console.log('⏭️ Skipping auth state change during registration');
          return;
        }
        
        if (firebaseUser) {
          // Search for user by email since customers use Firebase UID and salesmen use custom ID
          const usersQuery = await getDocs(
            query(collection(firestore, COLLECTIONS.USERS), where('email', '==', firebaseUser.email))
          );
          
          if (!usersQuery.empty) {
            const userDoc = usersQuery.docs[0];
            const userData = userDoc.data() as UserData;
            console.log('✅ User data found:', userData);
            
            // Check if customer is approved
            if (userData.role === USER_ROLES.CUSTOMER && !userData.approved) {
              console.log('❌ Customer not approved');
              // Don't set user and show alert
              return;
            }
            
            setUser(userData);
            
            // Record login for salesman
            if (userData.role === 'salesman') {
              await recordLogin(userData.uid, userData.role);
            }
          } else {
            console.log('❌ User document not found in Firestore');
            setUser(null);
          }
        } else {
          console.log('👤 No user signed in');
          setUser(null);
        }
      } catch (error) {
        console.error('❌ Auth state change error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [isRegistering]);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      const userData = await loginUser(email, password);
      setUser(userData);
    } catch (error: any) {
      console.error('Login error:', error);
      
      // User-friendly error messages
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.message.includes('invalid-credential')) {
        errorMessage = 'Invalid email or password.';
      } else if (error.message.includes('network-request-failed')) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.message.includes('pending approval')) {
        errorMessage = 'Your account is pending approval. Please contact administrator.';
      } else if (error.message.includes('too-many-requests')) {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.message.includes('User data not found')) {
        errorMessage = 'Account not found. Please check your email or register.';
      }
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, userData: Omit<UserData, 'uid' | 'createdAt'>) => {
    try {
      setLoading(true);
      setIsRegistering(true); // Set flag to prevent auth state interference
      
      // Only allow customer registration through this flow
      if (userData.role !== 'customer') {
        throw new Error('Only customer registration is allowed');
      }

      // Validate that salesmanId is provided
      if (!userData.salesmanId) {
        throw new Error('Salesman ID is required for customer registration');
      }

      // Validate salesman ID format
      const salesmanIdRegex = /^[A-Z0-9]{5}$/;
      if (!salesmanIdRegex.test(userData.salesmanId)) {
        throw new Error('Please enter a valid 5-digit Salesman ID');
      }

      const newUser = await registerCustomer(
        email,
        password,
        userData.name,
        userData.phone,
        userData.city,
        userData.salesmanId
      );
      
      // Don't set user in context for unapproved customers
      // This prevents the auth state listener from triggering and logging them out
      
      // Show success message and stay on registration screen
      Alert.alert(
        'Registration Successful!',
        'Your customer account has been created and is pending approval.\n\nYou will receive an email notification once your account is approved by the administrator.',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Reset form and go back to login
              setIsRegistering(false);
            }
          }
        ]
      );
      
      // Return success to indicate form should be cleared
      return { success: true };
      
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // User-friendly error messages
      let errorMessage = 'Registration failed. Please try again.';
      let errorType = 'general';
      
      if (error.message.includes('email-already-in-use')) {
        errorMessage = 'This email is already registered. Please use a different email or login.';
        errorType = 'email-already-in-use';
      } else if (error.message.includes('weak-password')) {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      } else if (error.message.includes('invalid-email')) {
        errorMessage = 'Invalid email address. Please check your email.';
      } else if (error.message.includes('Salesman ID is required')) {
        errorMessage = 'Salesman ID is required for registration.';
      } else if (error.message.includes('valid 5-digit Salesman ID')) {
        errorMessage = 'Please enter a valid 5-digit Salesman ID.';
      } else if (error.message.includes('Only customer registration')) {
        errorMessage = 'Only customer registration is allowed. Salesman accounts are created by administrators.';
      } else if (error.message.includes('network-request-failed')) {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
      setIsRegistering(false); // Reset flag
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      
      // Record logout for salesman before signing out
      if (user?.role === 'salesman') {
        await recordLogout(user.uid, user.role);
      }
      
      await logoutUser();
      setUser(null);
    } catch (error: any) {
      console.error('Logout error:', error);
      throw new Error('Logout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};