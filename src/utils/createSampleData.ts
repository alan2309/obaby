import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { COLLECTIONS } from './constants';

export const createSampleOrder = async (salesmanId: string, customerId: string) => {
  try {
    const orderData = {
      salesmanId,
      customerId,
      items: [
        {
          productId: 'sample-product-1',
          productName: 'Sample T-Shirt',
          size: 'M',
          color: 'Blue',
          quantity: 2,
          costPrice: 15,
          sellingPrice: 30,
          finalPrice: 30,
          discountGiven: 0,
        }
      ],
      totalAmount: 60,
      totalCost: 30,
      totalProfit: 30,
      status: 'Delivered',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(firestore, COLLECTIONS.ORDERS), orderData);
    console.log('✅ Sample order created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating sample order:', error);
  }
};

export const createSampleAttendance = async (salesmanId: string) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const attendanceData = {
      salesmanId,
      date: today,
      loginTime: Timestamp.now(),
      logoutTime: Timestamp.now(),
      totalHours: 8.5,
    };

    const docRef = await addDoc(collection(firestore, COLLECTIONS.ATTENDANCE), attendanceData);
    console.log('✅ Sample attendance created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating sample attendance:', error);
  }
};