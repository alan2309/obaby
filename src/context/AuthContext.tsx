import React, { createContext, useState, useContext, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from '../firebase/config';
import { loginUser, registerUser, logoutUser, UserData, recordLogin, recordLogout } from '../firebase/auth';
import { COLLECTIONS, USER_ROLES } from '../utils/constants';
import { Alert } from 'react-native';

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, userData: Omit<UserData, 'uid' | 'createdAt'>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    try {
      console.log('🔄 Auth state changed:', firebaseUser?.email);
      
      if (firebaseUser) {
        // User is signed in, get user data from Firestore
        const userDoc = await getDoc(doc(firestore, COLLECTIONS.USERS, firebaseUser.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserData;
          console.log('✅ User data found:', userData);
          
          // Check if customer is approved
          if (userData.role === USER_ROLES.CUSTOMER && !userData.approved) {
            console.log('❌ Customer not approved');
            Alert.alert(
              'Account Pending',
              'Your account is pending approval. Please contact administrator.',
              [{ text: 'OK', onPress: () => logout() }]
            );
            return;
          }
          
          setUser(userData);
          
          // Record login for salesman
          if (userData.role === 'salesman') {
            await recordLogin(firebaseUser.uid, userData.role);
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
}, []);

  // Update the login function in AuthContext.tsx
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
    }
    throw new Error(errorMessage);
  } finally {
    setLoading(false);
  }
};


  const register = async (email: string, password: string, userData: Omit<UserData, 'uid' | 'createdAt'>) => {
    const newUser = await registerUser(email, password, userData);
    setUser(newUser);
  };

  const logout = async () => {
    // Record logout for salesman before signing out
    if (user?.role === 'salesman') {
      await recordLogout(user.uid, user.role);
    }
    
    await logoutUser();
    setUser(null);
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