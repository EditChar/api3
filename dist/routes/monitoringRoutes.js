"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const avatarService_1 = require("../services/avatarService");
const router = (0, express_1.Router)();
const avatarService = new avatarService_1.AvatarService();
// Basic health check
router.get('/health', async (req, res) => {
    const startTime = Date.now();
    try {
        const healthChecks = {
            timestamp: new Date().toISOString(),
            service: 'avatar-system',
            version: process.env.APP_VERSION || '1.0.0',
            uptime: process.uptime(),
            // Database health
            database: await checkDatabaseHealth(),
            // Avatar service health  
            avatarService: await checkAvatarServiceHealth(),
            // Basic metrics
            metrics: {
                responseTime: Date.now() - startTime,
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version
            }
        };
        // Overall health assessment
        const isHealthy = healthChecks.database.status === 'healthy' &&
            healthChecks.avatarService.status === 'healthy';
        res.status(isHealthy ? 200 : 503).json({
            success: isHealthy,
            ...healthChecks
        });
    }
    catch (error) {
        res.status(503).json({
            success: false,
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});
// Detailed metrics endpoint
router.get('/metrics', async (req, res) => {
    try {
        const metrics = {
            // Avatar system metrics
            avatars: await getAvatarMetrics(),
            // Database metrics
            database: await getDatabaseMetrics(),
            // System metrics
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                platform: process.platform,
                nodeVersion: process.version
            },
            // Performance metrics (last 24h)
            performance: await getPerformanceMetrics()
        };
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            metrics
        });
    }
    catch (error) {
        console.error('Metrics collection failed:', error);
        res.status(500).json({
            success: false,
            error: 'Metrics collection failed'
        });
    }
});
// Avatar-specific metrics
router.get('/avatar-stats', async (req, res) => {
    try {
        const stats = await avatarService.getAvatarStats();
        // Enhanced stats with calculations
        const enhancedStats = {
            ...stats,
            // Cost calculations
            estimatedMonthlyCost: calculateMonthlyCost(stats.totalSize),
            storageEfficiency: calculateStorageEfficiency(stats),
            // Performance indicators
            averageFileSize: Math.round(stats.totalSize / stats.totalAvatars),
            deduplicationSavings: calculateDeduplicationSavings(stats),
            // Trends (if available)
            growthRate: await calculateGrowthRate(),
            timestamp: new Date().toISOString()
        };
        res.json({
            success: true,
            stats: enhancedStats
        });
    }
    catch (error) {
        console.error('Avatar stats collection failed:', error);
        res.status(500).json({
            success: false,
            error: 'Avatar stats collection failed'
        });
    }
});
// System performance endpoint
router.get('/performance', async (req, res) => {
    const timeframe = req.query.timeframe || '24h';
    try {
        const performance = {
            timeframe,
            timestamp: new Date().toISOString(),
            // Response times
            responseTime: await getAverageResponseTime(timeframe),
            // Error rates
            errorRate: await getErrorRate(timeframe),
            // Upload metrics
            uploads: await getUploadMetrics(timeframe),
            // Cache performance
            cache: await getCacheMetrics(timeframe)
        };
        res.json({
            success: true,
            performance
        });
    }
    catch (error) {
        console.error('Performance metrics failed:', error);
        res.status(500).json({
            success: false,
            error: 'Performance metrics collection failed'
        });
    }
});
// Health check helper functions
async function checkDatabaseHealth() {
    try {
        const start = Date.now();
        const result = await database_1.default.query('SELECT 1');
        const responseTime = Date.now() - start;
        return {
            status: 'healthy',
            responseTime,
            connections: await getDatabaseConnections()
        };
    }
    catch (error) {
        return {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
async function checkAvatarServiceHealth() {
    try {
        const stats = await avatarService.getAvatarStats();
        return {
            status: 'healthy',
            totalAvatars: stats.totalAvatars,
            pendingCleanup: stats.pendingCleanup,
            storageUsage: `${Math.round(stats.totalSize / 1024 / 1024)} MB`
        };
    }
    catch (error) {
        return {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
// Metrics helper functions
async function getAvatarMetrics() {
    const stats = await avatarService.getAvatarStats();
    return {
        total: stats.totalAvatars,
        totalSizeMB: Math.round(stats.totalSize / 1024 / 1024),
        duplicates: stats.duplicateCount,
        pendingCleanup: stats.pendingCleanup,
        deduplicationRate: (stats.duplicateCount / stats.totalAvatars * 100).toFixed(2) + '%'
    };
}
async function getDatabaseMetrics() {
    const connectionInfo = await database_1.default.query(`
    SELECT 
      state, 
      COUNT(*) as count 
    FROM pg_stat_activity 
    WHERE datname = current_database() 
    GROUP BY state
  `);
    const tableStats = await database_1.default.query(`
    SELECT 
      schemaname,
      tablename,
      n_tup_ins + n_tup_upd + n_tup_del as total_ops,
      n_live_tup as live_tuples
    FROM pg_stat_user_tables 
    WHERE tablename IN ('users', 'avatar_files', 'avatar_cleanup_queue')
  `);
    return {
        connections: connectionInfo.rows,
        tableStats: tableStats.rows,
        timestamp: new Date().toISOString()
    };
}
async function getPerformanceMetrics() {
    // This would integrate with your logging/metrics collection
    // For now, return mock data structure
    return {
        averageResponseTime: 150, // ms
        requestsPerMinute: 45,
        errorRate: 0.002, // 0.2%
        successfulUploads: 1250,
        failedUploads: 3,
        cacheHitRate: 0.967 // 96.7%
    };
}
// Cost calculation helpers
function calculateMonthlyCost(totalSizeBytes) {
    const sizeGB = totalSizeBytes / 1024 / 1024 / 1024;
    // Rough AWS S3 pricing calculation
    const standardCost = sizeGB * 0.023; // $0.023/GB/month for Standard
    const optimizedCost = sizeGB * 0.0125; // $0.0125/GB/month for Standard-IA
    return {
        standard: `$${standardCost.toFixed(2)}`,
        optimized: `$${optimizedCost.toFixed(2)}`,
        savings: `$${(standardCost - optimizedCost).toFixed(2)}`
    };
}
function calculateStorageEfficiency(stats) {
    const deduplicationRate = (stats.duplicateCount / stats.totalAvatars) * 100;
    const compressionRate = 65; // Estimate based on image optimization
    return {
        deduplication: `${deduplicationRate.toFixed(1)}%`,
        compression: `${compressionRate}%`,
        overall: `${(deduplicationRate + compressionRate).toFixed(1)}%`
    };
}
function calculateDeduplicationSavings(stats) {
    const savedStorage = stats.duplicateCount * stats.averageSize;
    const savedCostMonthly = (savedStorage / 1024 / 1024 / 1024) * 0.023;
    return {
        savedBytes: savedStorage,
        savedMB: Math.round(savedStorage / 1024 / 1024),
        savedCostMonthly: `$${savedCostMonthly.toFixed(2)}`
    };
}
async function calculateGrowthRate() {
    // Implementation would analyze historical data
    // For now, return sample structure
    return {
        daily: '+2.3%',
        weekly: '+15.8%',
        monthly: '+67.2%'
    };
}
async function getAverageResponseTime(timeframe) {
    // Integration with logging system
    return Math.floor(Math.random() * 200) + 50; // Mock: 50-250ms
}
async function getErrorRate(timeframe) {
    // Integration with error tracking
    return Math.random() * 0.01; // Mock: 0-1%
}
async function getUploadMetrics(timeframe) {
    return {
        total: Math.floor(Math.random() * 1000) + 500,
        successful: Math.floor(Math.random() * 950) + 500,
        failed: Math.floor(Math.random() * 10),
        averageSize: Math.floor(Math.random() * 500) + 200 // KB
    };
}
async function getCacheMetrics(timeframe) {
    return {
        hitRate: (Math.random() * 0.1 + 0.9).toFixed(3), // 90-100%
        missRate: (Math.random() * 0.1).toFixed(3), // 0-10%
        totalRequests: Math.floor(Math.random() * 10000) + 5000
    };
}
async function getDatabaseConnections() {
    const result = await database_1.default.query('SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database()');
    return parseInt(result.rows[0].count);
}
exports.default = router;
