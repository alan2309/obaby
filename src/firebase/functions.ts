import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { firestore } from './config';
import { COLLECTIONS } from '../utils/constants';

export interface Notification {
  id?: string;
  title: string;
  message: string;
  sentBy: string;
  target: 'all' | 'salesman' | 'customers' | string; // string for specific user ID
  read: boolean;
  createdAt: Date;
}

// Create notification
export const createNotification = async (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(firestore, COLLECTIONS.NOTIFICATIONS), {
      ...notification,
      read: false,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error: any) {
    throw new Error('Failed to create notification');
  }
};

// Get notifications for user
export const getNotifications = async (userId: string, userRole: string): Promise<Notification[]> => {
  try {
    let q;
    
    if (userRole === 'admin') {
      // Admin sees all notifications
      q = query(
        collection(firestore, COLLECTIONS.NOTIFICATIONS),
        orderBy('createdAt', 'desc')
      );
    } else {
      // Users see notifications sent to their role or specifically to them
      q = query(
        collection(firestore, COLLECTIONS.NOTIFICATIONS),
        where('target', 'in', ['all', userRole, userId]),
        orderBy('createdAt', 'desc')
      );
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
    })) as Notification[];
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    // In a real app, you'd update the document
    // For now, we'll handle read status locally
    console.log('Marking notification as read:', notificationId);
  } catch (error: any) {
    throw new Error('Failed to mark notification as read');
  }
};

// Get unread notification count
export const getUnreadNotificationCount = async (userId: string, userRole: string): Promise<number> => {
  try {
    const notifications = await getNotifications(userId, userRole);
    return notifications.filter(notification => !notification.read).length;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};