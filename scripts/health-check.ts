import kafkaService from '../src/services/kafkaService';
import redisClient from '../src/config/redis';
import pool from '../src/config/database';

interface HealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  details: any;
  responseTime: number;
}

async function checkPostgreSQL(): Promise<HealthStatus> {
  const startTime = Date.now();
  
  try {
    const result = await pool.query('SELECT NOW()');
    return {
      service: 'PostgreSQL',
      status: 'healthy',
      details: {
        connected: true,
        serverTime: result.rows[0].now
      },
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      service: 'PostgreSQL',
      status: 'unhealthy',
      details: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      responseTime: Date.now() - startTime
    };
  }
}

async function checkRedis(): Promise<HealthStatus> {
  const startTime = Date.now();
  
  try {
    const testKey = `health_check_${Date.now()}`;
    await redisClient.set(testKey, 'test', 10);
    const value = await redisClient.get(testKey);
    await redisClient.del(testKey);
    
    return {
      service: 'Redis Cluster',
      status: value === 'test' ? 'healthy' : 'degraded',
      details: {
        connected: redisClient.isConnected(),
        usingInMemory: redisClient.isUsingInMemory(),
        testResult: value === 'test'
      },
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      service: 'Redis Cluster',
      status: 'unhealthy',
      details: {
        connected: false,
        usingInMemory: redisClient.isUsingInMemory(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      responseTime: Date.now() - startTime
    };
  }
}

async function checkKafka(): Promise<HealthStatus> {
  const startTime = Date.now();
  
  try {
    const health = await kafkaService.healthCheck();
    const isHealthy = health.producer && health.admin && health.topics.length > 0;
    
    return {
      service: 'Kafka Cluster',
      status: isHealthy ? 'healthy' : 'degraded',
      details: health,
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      service: 'Kafka Cluster',
      status: 'unhealthy',
      details: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      responseTime: Date.now() - startTime
    };
  }
}

async function performHealthCheck(): Promise<void> {
  console.log('🔍 Starting health check...\n');
  
  const checks = await Promise.all([
    checkPostgreSQL(),
    checkRedis(),
    checkKafka()
  ]);
  
  let overallHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  checks.forEach(check => {
    const statusEmoji = check.status === 'healthy' ? '✅' : 
                       check.status === 'degraded' ? '⚠️' : '❌';
    
    console.log(`${statusEmoji} ${check.service}: ${check.status.toUpperCase()} (${check.responseTime}ms)`);
    
    if (check.status === 'unhealthy') {
      overallHealth = 'unhealthy';
    } else if (check.status === 'degraded' && overallHealth === 'healthy') {
      overallHealth = 'degraded';
    }
    
    if (check.status !== 'healthy') {
      console.log(`   Details:`, JSON.stringify(check.details, null, 2));
    }
    console.log('');
  });
  
  const overallEmoji = overallHealth === 'healthy' ? '✅' : 
                      overallHealth === 'degraded' ? '⚠️' : '❌';
  
  console.log(`${overallEmoji} Overall System Health: ${overallHealth.toUpperCase()}\n`);
  
  // Exit with appropriate code
  switch (overallHealth) {
    case 'unhealthy':
      process.exit(1);
      break;
    case 'degraded':
      process.exit(2);
      break;
    default:
      process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Health check interrupted');
  process.exit(130);
});

performHealthCheck().catch(error => {
  console.error('❌ Health check failed:', error);
  process.exit(1);
}); 