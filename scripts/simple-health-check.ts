import kafkaService from '../src/services/kafkaService';
import redisClient from '../src/config/redis';
import pool from '../src/config/database';

async function simpleHealthCheck() {
  console.log('🔍 Enterprise System Health Check\n');
  
  let allHealthy = true;
  
  // PostgreSQL Check
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL: HEALTHY');
  } catch (error) {
    console.log('❌ PostgreSQL: UNHEALTHY');
    allHealthy = false;
  }
  
  // Redis Check
  try {
    await redisClient.set('health_test', 'ok', 10);
    const result = await redisClient.get('health_test');
    if (result === 'ok') {
      console.log('✅ Redis Cluster: HEALTHY');
    } else {
      console.log('⚠️ Redis Cluster: DEGRADED');
    }
  } catch (error) {
    console.log('❌ Redis Cluster: UNHEALTHY');
    allHealthy = false;
  }
  
  // Kafka Check
  try {
    const health = await kafkaService.healthCheck();
    if (health.producer && health.admin) {
      console.log('✅ Kafka Cluster: HEALTHY');
    } else {
      console.log('⚠️ Kafka Cluster: DEGRADED');
    }
  } catch (error) {
    console.log('❌ Kafka Cluster: UNHEALTHY');
    allHealthy = false;
  }
  
  console.log('\n' + (allHealthy ? '✅ System Status: HEALTHY' : '❌ System Status: ISSUES DETECTED'));
  
  process.exit(allHealthy ? 0 : 1);
}

simpleHealthCheck().catch(error => {
  console.error('Health check failed:', error);
  process.exit(1);
}); 