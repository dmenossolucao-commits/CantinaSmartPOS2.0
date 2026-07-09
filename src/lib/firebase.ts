import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore using the database ID from the applet configuration
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
