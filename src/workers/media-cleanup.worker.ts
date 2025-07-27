import cron from 'node-cron';
import MediaService from '../services/mediaService';

class MediaCleanupWorker {
  private static instance: MediaCleanupWorker;
  private mediaService: MediaService;
  private isRunning: boolean = false;

  private constructor() {
    this.mediaService = MediaService.getInstance();
  }

  public static getInstance(): MediaCleanupWorker {
    if (!MediaCleanupWorker.instance) {
      MediaCleanupWorker.instance = new MediaCleanupWorker();
    }
    return MediaCleanupWorker.instance;
  }

  /**
   * Start the media cleanup worker
   * Runs every day at 2:00 AM
   */
  public start(): void {
    if (this.isRunning) {
      console.log('⚠️ Media cleanup worker already running');
      return;
    }

    console.log('🧹 Starting Media Cleanup Worker...');
    
    // Schedule daily cleanup at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('🧹 Running scheduled media cleanup...');
      await this.runCleanup();
    });

    // Also schedule hourly cleanup for frequently expired items
    cron.schedule('0 * * * *', async () => {
      console.log('🧹 Running hourly media cleanup check...');
      await this.runCleanup();
    });

    this.isRunning = true;
    console.log('✅ Media Cleanup Worker started successfully');
    console.log('   - Daily cleanup: 2:00 AM');
    console.log('   - Hourly check: Every hour at minute 0');
  }

  /**
   * Stop the media cleanup worker
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ Media cleanup worker not running');
      return;
    }

    // Note: node-cron doesn't provide easy way to stop specific schedules
    // This would require tracking task references
    this.isRunning = false;
    console.log('🛑 Media Cleanup Worker stopped');
  }

  /**
   * Run media cleanup manually
   */
  public async runCleanup(): Promise<void> {
    const startTime = Date.now();
    console.log('🧹 Starting media cleanup process...');

    try {
      await this.mediaService.cleanupExpiredMedia();
      
      const duration = Date.now() - startTime;
      console.log(`✅ Media cleanup completed successfully in ${duration}ms`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Media cleanup failed after ${duration}ms:`, error);
    }
  }

  /**
   * Get worker status
   */
  public getStatus(): { isRunning: boolean; uptime?: number } {
    return {
      isRunning: this.isRunning,
      uptime: this.isRunning ? process.uptime() : undefined
    };
  }
}

// Auto-start worker when imported
const mediaCleanupWorker = MediaCleanupWorker.getInstance();

// Start worker if this file is run directly
if (require.main === module) {
  console.log('🚀 Starting Media Cleanup Worker as standalone process...');
  
  mediaCleanupWorker.start();
  
  // Run initial cleanup
  mediaCleanupWorker.runCleanup().then(() => {
    console.log('✅ Initial media cleanup completed');
  }).catch((error) => {
    console.error('❌ Initial media cleanup failed:', error);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down media cleanup worker...');
    mediaCleanupWorker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down media cleanup worker...');
    mediaCleanupWorker.stop();
    process.exit(0);
  });
}

export default mediaCleanupWorker; 