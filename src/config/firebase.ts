import * as admin from 'firebase-admin';

let messaging: admin.messaging.Messaging | null = null;
let firestore: admin.firestore.Firestore | null = null;

// 🔐 Firebase Admin SDK'yi environment variables ile initialize et (Güvenli)
if (!admin.apps.length) {
  try {
    // Environment variables'dan service account bilgilerini al
    const serviceAccountConfig = {
      type: process.env.FIREBASE_TYPE || 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Escape karakterleri düzelt
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
      token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
      universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN || 'googleapis.com'
    };

    // Gerekli alanları kontrol et
    if (!serviceAccountConfig.project_id || !serviceAccountConfig.private_key || !serviceAccountConfig.client_email) {
      console.warn('⚠️  Firebase environment variables missing. Firebase notifications disabled.');
      console.warn('   Required: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
      console.warn('   Make sure .env file exists and contains Firebase credentials');
    } else {
      // Demo key kontrolü
      if (serviceAccountConfig.private_key.includes('DEMO_PRIVATE_KEY')) {
        console.warn('⚠️  Demo Firebase private key detected. Firebase notifications disabled.');
        console.warn('   To enable Firebase: Update FIREBASE_PRIVATE_KEY in .env with real credentials');
      } else {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountConfig as admin.ServiceAccount),
          databaseURL: process.env.FIREBASE_DATABASE_URL,
        });
        
        messaging = admin.messaging();
        firestore = admin.firestore();
        console.log('🔥 Firebase Admin SDK initialized successfully from environment variables');
        console.log(`📱 Project: ${serviceAccountConfig.project_id}`);
        console.log(`✉️  Client Email: ${serviceAccountConfig.client_email?.substring(0, 30)}...`);
      }
    }
  } catch (error: any) {
    console.error('❌ Firebase Admin SDK initialization failed:', error.message);
    console.warn('⚠️  Firebase notifications will be disabled. Server will continue without Firebase.');
    console.warn('   Check your .env file and ensure all Firebase environment variables are set correctly');
  }
}

export { messaging, firestore };
export default admin; 