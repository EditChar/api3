const { spawn } = require('child_process');
const path = require('path');

class WorkerManager {
  constructor() {
    this.workers = new Map();
    this.isShuttingDown = false;
    
    // Define workers
    this.workerConfigs = [
      {
        name: 'Persistence Worker',
        script: 'src/workers/persistence.worker.ts',
        restartDelay: 5000
      },
      {
        name: 'Realtime Worker', 
        script: 'src/workers/realtime.worker.ts',
        restartDelay: 5000
      },
      {
        name: 'Notification Worker',
        script: 'src/workers/notification.worker.ts', 
        restartDelay: 5000
      },
      {
        name: 'Avatar Cleanup Worker',
        script: 'src/workers/avatar-cleanup.worker.ts',
        restartDelay: 10000 // Longer delay for cleanup worker
      }
    ];
  }

  startWorker(config) {
    if (this.isShuttingDown) return;

    console.log(`🚀 Starting ${config.name}...`);
    
    // Try different approaches to run TypeScript files
    let command, args;
    
    // First try: Use node with ts-node/register
    command = 'node';
    args = ['-r', 'ts-node/register', config.script];
    
    const worker = spawn(command, args, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env },
      shell: true
    });

    worker.on('exit', (code, signal) => {
      console.log(`🔚 ${config.name} exited with code ${code} and signal ${signal}`);
      
      // Remove from active workers
      this.workers.delete(config.name);
      
      // Restart if not shutting down and exit was unexpected
      if (!this.isShuttingDown && (code !== 0 || signal)) {
        console.log(`🔄 Restarting ${config.name} in ${config.restartDelay / 1000} seconds...`);
        setTimeout(() => {
          this.startWorker(config);
        }, config.restartDelay);
      }
    });

    worker.on('error', (error) => {
      console.error(`❌ ${config.name} error:`, error);
    });

    // Store worker reference
    this.workers.set(config.name, worker);
    
    return worker;
  }

  startAll() {
    console.log('🚀 Starting all Kafka workers...');
    console.log('📋 Workers to start:', this.workerConfigs.map(w => w.name));
    
    this.workerConfigs.forEach(config => {
      this.startWorker(config);
    });

    console.log(`✅ Started ${this.workerConfigs.length} workers`);
  }

  stopAll() {
    console.log('🛑 Stopping all workers...');
    this.isShuttingDown = true;
    
    this.workers.forEach((worker, name) => {
      console.log(`🔚 Stopping ${name}...`);
      worker.kill('SIGTERM');
    });

    // Force kill after 10 seconds
    setTimeout(() => {
      this.workers.forEach((worker, name) => {
        if (!worker.killed) {
          console.log(`💀 Force killing ${name}...`);
          worker.kill('SIGKILL');
        }
      });
    }, 10000);
  }

  getStatus() {
    console.log('📊 Worker Status:');
    this.workerConfigs.forEach(config => {
      const isRunning = this.workers.has(config.name);
      console.log(`  ${config.name}: ${isRunning ? '✅ Running' : '❌ Stopped'}`);
    });
  }
}

// Create manager instance
const manager = new WorkerManager();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  manager.stopAll();
  setTimeout(() => process.exit(0), 15000);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  manager.stopAll();
  setTimeout(() => process.exit(0), 15000);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  manager.stopAll();
  setTimeout(() => process.exit(1), 5000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  manager.stopAll();
  setTimeout(() => process.exit(1), 5000);
});

// Start all workers
console.log('🎯 Kafka Worker Manager Starting...');
console.log('📍 Working Directory:', process.cwd());
console.log('🔧 Node Version:', process.version);
console.log('⚡ Environment:', process.env.NODE_ENV || 'development');

manager.startAll();

// Status check every 30 seconds
setInterval(() => {
  if (!manager.isShuttingDown) {
    manager.getStatus();
  }
}, 30000);

console.log('✅ Worker Manager is running. Press Ctrl+C to stop.'); 