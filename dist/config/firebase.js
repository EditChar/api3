"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.firestore = exports.messaging = void 0;
const admin = __importStar(require("firebase-admin"));
let messaging = null;
exports.messaging = messaging;
let firestore = null;
exports.firestore = firestore;
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
        }
        else {
            // Demo key kontrolü
            if (serviceAccountConfig.private_key.includes('DEMO_PRIVATE_KEY')) {
                console.warn('⚠️  Demo Firebase private key detected. Firebase notifications disabled.');
                console.warn('   To enable Firebase: Update FIREBASE_PRIVATE_KEY in .env with real credentials');
            }
            else {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccountConfig),
                    databaseURL: process.env.FIREBASE_DATABASE_URL,
                });
                exports.messaging = messaging = admin.messaging();
                exports.firestore = firestore = admin.firestore();
                console.log('🔥 Firebase Admin SDK initialized successfully from environment variables');
                console.log(`📱 Project: ${serviceAccountConfig.project_id}`);
                console.log(`✉️  Client Email: ${serviceAccountConfig.client_email?.substring(0, 30)}...`);
            }
        }
    }
    catch (error) {
        console.error('❌ Firebase Admin SDK initialization failed:', error.message);
        console.warn('⚠️  Firebase notifications will be disabled. Server will continue without Firebase.');
        console.warn('   Check your .env file and ensure all Firebase environment variables are set correctly');
    }
}
exports.default = admin;
