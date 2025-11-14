// src\firebase\auth.ts
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc,collection, addDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, firestore } from './config';
import { COLLECTIONS, USER_ROLES } from '../utils/constants';

export interface UserData {
  id?: string;
  uid: string;
  email: string;
  name: string;
  phone: string;
  role: 'admin' | 'salesman' | 'customer';
  approved: boolean;
  createdAt: Date;
  maxDiscountPercent?: number;
  totalProfitGenerated?: number;
  totalDiscountGiven?: number;
  totalSales?: number;
}

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get user data from Firestore
    const userDoc = await getDoc(doc(firestore, COLLECTIONS.USERS, user.uid));
    
    if (!userDoc.exists()) {
      throw new Error('User data not found');
    }
    
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

export const registerUser = async (
  email: string, 
  password: string, 
  userData: Omit<UserData, 'uid' | 'createdAt'>
) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Create user document in Firestore
    const userDoc: UserData = {
      uid: user.uid,
      ...userData,
      createdAt: new Date(),
    };
    
    await setDoc(doc(firestore, COLLECTIONS.USERS, user.uid), userDoc);
    
    // Update profile
    await updateProfile(user, {
      displayName: userData.name,
    });
    
    return userDoc;
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
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
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
        totalHours: Math.round(totalHours * 100) / 100, // 2 decimal places
      });
    }
  } catch (error) {
    console.error('Error recording logout:', error);
  }
};