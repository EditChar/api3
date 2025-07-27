"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.avatarCleanupWorker = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const avatarService_1 = require("../services/avatarService");
const avatarService = new avatarService_1.AvatarService();
// Cleanup interval from environment (default: 1 hour)
const CLEANUP_INTERVAL = process.env.AVATAR_CLEANUP_CRON || '0 */1 * * *'; // Every hour cron pattern
const WORKER_ID = `avatar-cleanup-${process.pid}`;
console.log(`🧹 [${WORKER_ID}] Avatar Cleanup Worker Starting...`);
console.log(`📅 [${WORKER_ID}] Cleanup interval: ${CLEANUP_INTERVAL}`);
/**
 * Avatar Cleanup Background Worker
 * Runs periodic cleanup of orphaned avatar files
 */
class AvatarCleanupWorker {
    constructor() {
        this.isRunning = false;
        this.totalProcessed = 0;
        this.totalErrors = 0;
        this.lastRunTime = null;
        this.startTime = new Date();
        this.setupCleanupSchedule();
        this.setupGracefulShutdown();
    }
    /**
     * Setup cron schedule for cleanup
     */
    setupCleanupSchedule() {
        node_cron_1.default.schedule(CLEANUP_INTERVAL, async () => {
            if (this.isRunning) {
                console.log(`⚠️  [${WORKER_ID}] Previous cleanup still running, skipping...`);
                return;
            }
            await this.runCleanup();
        });
        console.log(`✅ [${WORKER_ID}] Cleanup schedule established`);
    }
    /**
     * Run a single cleanup cycle
     */
    async runCleanup() {
        this.isRunning = true;
        const cleanupId = `cleanup-${Date.now()}`;
        try {
            console.log(`🚀 [${WORKER_ID}] Starting cleanup cycle: ${cleanupId}`);
            const startTime = Date.now();
            // Run the cleanup
            await avatarService.cleanupOrphanedAvatars();
            const duration = Date.now() - startTime;
            this.totalProcessed++;
            this.lastRunTime = new Date();
            console.log(`✅ [${WORKER_ID}] Cleanup cycle completed: ${cleanupId} (${duration}ms)`);
            // Log statistics periodically
            if (this.totalProcessed % 10 === 0) {
                await this.logStatistics();
            }
        }
        catch (error) {
            this.totalErrors++;
            console.error(`❌ [${WORKER_ID}] Cleanup cycle failed: ${cleanupId}`, error);
            // Don't throw - we want the worker to continue
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Manual cleanup trigger (for testing/admin)
     */
    async triggerManualCleanup() {
        console.log(`🔧 [${WORKER_ID}] Manual cleanup triggered`);
        await this.runCleanup();
    }
    /**
     * Log worker statistics
     */
    async logStatistics() {
        try {
            const stats = await avatarService.getAvatarStats();
            const uptime = Date.now() - this.startTime.getTime();
            console.log(`📊 [${WORKER_ID}] Worker Statistics:`);
            console.log(`   • Uptime: ${Math.round(uptime / 1000 / 60)} minutes`);
            console.log(`   • Total cleanup cycles: ${this.totalProcessed}`);
            console.log(`   • Total errors: ${this.totalErrors}`);
            console.log(`   • Last run: ${this.lastRunTime?.toISOString() || 'Never'}`);
            console.log(`   • Currently running: ${this.isRunning}`);
            console.log(`📈 [${WORKER_ID}] Avatar System Stats:`);
            console.log(`   • Total avatars: ${stats.totalAvatars}`);
            console.log(`   • Pending cleanup: ${stats.pendingCleanup}`);
            console.log(`   • Duplicate count: ${stats.duplicateCount}`);
            console.log(`   • Total size: ${Math.round(stats.totalSize / 1024 / 1024)} MB`);
        }
        catch (error) {
            console.warn(`⚠️  [${WORKER_ID}] Failed to get statistics:`, error);
        }
    }
    /**
     * Get current worker status
     */
    getStatus() {
        return {
            workerId: WORKER_ID,
            isRunning: this.isRunning,
            totalProcessed: this.totalProcessed,
            totalErrors: this.totalErrors,
            lastRunTime: this.lastRunTime,
            startTime: this.startTime,
            uptime: Date.now() - this.startTime.getTime()
        };
    }
    /**
     * Setup graceful shutdown handlers
     */
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            console.log(`🛑 [${WORKER_ID}] Received ${signal}, shutting down gracefully...`);
            // Wait for current cleanup to finish
            if (this.isRunning) {
                console.log(`⏳ [${WORKER_ID}] Waiting for current cleanup to finish...`);
                while (this.isRunning) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            // Log final statistics
            await this.logStatistics();
            console.log(`✅ [${WORKER_ID}] Avatar cleanup worker shutdown complete`);
            process.exit(0);
        };
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
    }
}
// Start the worker
const worker = new AvatarCleanupWorker();
exports.avatarCleanupWorker = worker;
// Health check endpoint for monitoring
process.on('message', (message) => {
    if (message === 'health-check') {
        const status = worker.getStatus();
        process.send?.({
            type: 'health-response',
            data: status
        });
    }
    else if (message === 'manual-cleanup') {
        worker.triggerManualCleanup().catch(error => {
            console.error(`❌ [${WORKER_ID}] Manual cleanup failed:`, error);
        });
    }
});
// Log startup completion
setTimeout(() => {
    console.log(`🎯 [${WORKER_ID}] Avatar Cleanup Worker fully initialized`);
    worker.logStatistics();
}, 1000);
