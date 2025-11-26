import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDwhjgupppYj9_F5CB-q-Azt_9kDC7pUFU",
  authDomain: "obaby-31559.firebaseapp.com",
  projectId: "obaby-31559",
  storageBucket: "obaby-31559.appspot.com",
  messagingSenderId: "130161238285",
  appId: "1:130161238285:android:ffd82cad42bc32aae89044",
  // measurementId: "G-XXXXXXXXXX" // optional (only if Analytics is enabled)
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;