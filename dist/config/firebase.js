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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.firestore = exports.messaging = void 0;
const admin = __importStar(require("firebase-admin"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
// Firebase service account key dosyası (environment'dan alınacak)
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
let messaging = null;
exports.messaging = messaging;
let firestore = null;
exports.firestore = firestore;
// Firebase Admin SDK'yi initialize et
if (!admin.apps.length) {
    try {
        if ((0, fs_1.existsSync)(path_1.default.resolve(serviceAccountPath))) {
            const serviceAccount = require(path_1.default.resolve(serviceAccountPath));
            // Demo dosyası mı kontrol et
            if (serviceAccount.private_key && serviceAccount.private_key.includes('DEMO_PRIVATE_KEY')) {
                console.warn('⚠️  Demo Firebase service account detected. Firebase notifications disabled.');
                console.warn('   To enable Firebase: Replace firebase-service-account.json with real credentials');
            }
            else {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    databaseURL: process.env.FIREBASE_DATABASE_URL,
                });
                exports.messaging = messaging = admin.messaging();
                exports.firestore = firestore = admin.firestore();
                console.log('🔥 Firebase Admin SDK initialized successfully');
            }
        }
        else {
            console.warn('⚠️  Firebase service account file not found. Firebase notifications disabled.');
            console.warn('   To enable Firebase: Place firebase-service-account.json in project root');
        }
    }
    catch (error) {
        console.error('❌ Firebase Admin SDK initialization failed:', error.message);
        console.warn('⚠️  Firebase notifications will be disabled. Server will continue without Firebase.');
    }
}
exports.default = admin;
