import * as admin from 'firebase-admin';
import path from 'path';
import { existsSync } from 'fs';

// Firebase service account key dosyası (environment'dan alınacak)
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';

let messaging: admin.messaging.Messaging | null = null;
let firestore: admin.firestore.Firestore | null = null;

// Firebase Admin SDK'yi initialize et
if (!admin.apps.length) {
  try {
    if (existsSync(path.resolve(serviceAccountPath))) {
      const serviceAccount = require(path.resolve(serviceAccountPath));
      
      // Demo dosyası mı kontrol et
      if (serviceAccount.private_key && serviceAccount.private_key.includes('DEMO_PRIVATE_KEY')) {
        console.warn('⚠️  Demo Firebase service account detected. Firebase notifications disabled.');
        console.warn('   To enable Firebase: Replace firebase-service-account.json with real credentials');
      } else {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.FIREBASE_DATABASE_URL,
        });
        
        messaging = admin.messaging();
        firestore = admin.firestore();
        console.log('🔥 Firebase Admin SDK initialized successfully');
      }
    } else {
      console.warn('⚠️  Firebase service account file not found. Firebase notifications disabled.');
      console.warn('   To enable Firebase: Place firebase-service-account.json in project root');
    }
  } catch (error: any) {
    console.error('❌ Firebase Admin SDK initialization failed:', error.message);
    console.warn('⚠️  Firebase notifications will be disabled. Server will continue without Firebase.');
  }
}

export { messaging, firestore };
export default admin; 