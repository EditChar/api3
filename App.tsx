/**
 * Sample React Native App with FCM Support
 */

import React, { useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
} from 'react-native';

// 🔥 Import FCM Service for crash prevention
import FCMService from './src/services/FCMService';

function App() {
  // 🔥 Initialize FCM Service on app start
  useEffect(() => {
    const initializeFCM = async () => {
      try {
        console.log('✅ Ana uygulama: Socket initialization tamamlandı');
        console.log('🔥 FCM initialize ediliyor...');
        
        const fcmInitialized = await FCMService.initialize();
        
        if (fcmInitialized) {
          console.log('✅ Ana uygulama: FCM initialization tamamlandı');
        } else {
          console.log('⚠️ Ana uygulama: FCM initialization başarısız, ancak uygulama devam ediyor');
        }
      } catch (error) {
        console.error('❌ Ana uygulama: FCM initialization hatası:', error);
        // Don't crash the app - just log and continue
      }
    };

    initializeFCM();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={styles.body}>
          
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>🔥 FCM Test App</Text>
            <Text style={styles.sectionDescription}>
              Bu uygulama FCM notification test'i için hazırlandı.
              Backend'den test notification gönderdiğinizde artık crash olmayacak!
            </Text>
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>✅ FCM Status</Text>
            <Text style={styles.sectionDescription}>
              FCM service başlatıldı. Logları kontrol edin.
            </Text>
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>🧪 Test Instructions</Text>
            <Text style={styles.sectionDescription}>
              1. Backend sunucusunu başlatın{'\n'}
              2. POST /api/enterprise/test-notification endpoint'ini çağırın{'\n'}
              3. Uygulama artık crash vermeyecek!
            </Text>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  body: {
    backgroundColor: '#ffffff',
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
    color: '#333333',
  },
});

export default App;
