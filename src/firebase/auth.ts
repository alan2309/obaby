// src\firebase\auth.ts 
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, firestore } from './config';
import { COLLECTIONS, USER_ROLES } from '../utils/constants';

export interface UserData {
  id?: string;
  uid: string;
  email: string;
  name: string;
  phone: string;
  city: string; // Added city field
  role: 'admin' | 'salesman' | 'customer'|'worker';
  approved: boolean;
  createdAt: Date;
  maxDiscountPercent?: number;
  totalProfitGenerated?: number;
  totalDiscountGiven?: number;
  totalSales?: number;
  salesmanId?: string;
}

// Generate custom 5-digit alphanumeric ID
export const generateCustomId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const registerSalesman = async (
  email: string, 
  password: string, 
  name: string,
  phone: string,
  city: string, // Added city parameter
  maxDiscountPercent: number = 10
) => {
  try {
    // Generate custom ID first
    const customId = generateCustomId();
    
    // Create auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Create user document with custom ID
    const userDoc: UserData = {
      uid: customId, // Use custom ID instead of Firebase UID
      email,
      name,
      phone,
      city, // Added city
      role: USER_ROLES.SALESMAN,
      approved: true, // Salesmen are auto-approved
      maxDiscountPercent,
      totalProfitGenerated: 0,
      totalDiscountGiven: 0,
      totalSales: 0,
      createdAt: new Date(),
    };
    
    // Store with custom ID as document ID
    await setDoc(doc(firestore, COLLECTIONS.USERS, customId), userDoc);
    
    // Update profile
    await updateProfile(user, {
      displayName: name,
    });
    
    return userDoc;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const registerCustomer = async (
  email: string, 
  name: string,
  phone: string,
  city: string,
  salesmanId?: string
) => {
  try {
    // Generate custom ID for the customer (similar to salesman)
    const customId = generateCustomId();
    
    // Create user document in Firestore only (no auth)
    const userDoc: UserData = {
      uid: customId, // Use custom ID
      email,
      name,
      phone,
      city,
      role: USER_ROLES.CUSTOMER,
      approved: true, // Customers need approval
      salesmanId: salesmanId || undefined,
      createdAt: new Date(),
    };
    
    // Store with custom ID as document ID
    await setDoc(doc(firestore, COLLECTIONS.USERS, customId), userDoc);
    
    console.log('✅ Customer created successfully with ID:', customId);
    return userDoc;
  } catch (error: any) {
    console.error('❌ Error creating customer:', error);
    throw new Error(error.message);
  }
};

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get user data from Firestore - search by email since we don't know if it's custom ID or Firebase UID
    const usersQuery = await getDocs(
      query(collection(firestore, COLLECTIONS.USERS), where('email', '==', email))
    );
    
    if (usersQuery.empty) {
      throw new Error('User data not found');
    }
    
    const userDoc = usersQuery.docs[0];
    const userData = userDoc.data() as UserData;
    
    // Check if customer is approved
    if (userData.role === USER_ROLES.CUSTOMER && !userData.approved) {
      throw new Error('Account pending approval');
    }
    
    return userData;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const recordLogin = async (userId: string, userRole: string) => {
  if (userRole !== USER_ROLES.SALESMAN) return;
  
  try {
    const loginRecord = {
      salesmanId: userId,
      date: new Date().toISOString().split('T')[0],
      loginTime: new Date(),
      logoutTime: null,
      totalHours: 0,
    };
    
    await addDoc(collection(firestore, COLLECTIONS.ATTENDANCE), loginRecord);
  } catch (error) {
    console.error('Error recording login:', error);
  }
};

export const recordLogout = async (userId: string, userRole: string) => {
  if (userRole !== USER_ROLES.SALESMAN) return;
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const attendanceQuery = await getDocs(
      query(
        collection(firestore, COLLECTIONS.ATTENDANCE),
        where('salesmanId', '==', userId),
        where('date', '==', today),
        where('logoutTime', '==', null)
      )
    );
    
    if (!attendanceQuery.empty) {
      const record = attendanceQuery.docs[0];
      const loginTime = record.data().loginTime.toDate();
      const logoutTime = new Date();
      const totalHours = (logoutTime.getTime() - loginTime.getTime()) / (1000 * 60 * 60);
      
      await updateDoc(doc(firestore, COLLECTIONS.ATTENDANCE, record.id), {
        logoutTime,
        totalHours: Math.round(totalHours * 100) / 100,
      });
    }
  } catch (error) {
    console.error('Error recording logout:', error);
  }
};