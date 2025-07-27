/**
 * Enterprise Avatar System Monitoring Dashboard
 * Real-time monitoring and analytics interface
 */

class MonitoringDashboard {
    constructor() {
        this.isAutoRefresh = false;
        this.refreshInterval = null;
        this.refreshRate = 30000; // 30 seconds
        this.lastUpdateTime = null;
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Enterprise Monitoring Dashboard');
        
        // Initial data load
        await this.loadDashboardData();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Update last updated time
        this.updateLastUpdatedTime();
        
        console.log('✅ Dashboard initialized successfully');
    }

    setupEventListeners() {
        // Logout button
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminUser');
                window.location.href = 'index.html';
            });
        }

        // Time selector buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all buttons
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');
                
                const timeframe = e.target.dataset.timeframe;
                this.loadPerformanceData(timeframe);
            });
        });
    }

    async loadDashboardData() {
        try {
            this.showLoading(true);
            
            // Load all monitoring data in parallel
            const [healthData, metricsData, avatarStats, performanceData] = await Promise.all([
                this.fetchHealthData(),
                this.fetchMetricsData(),
                this.fetchAvatarStats(),
                this.fetchPerformanceData('24h')
            ]);

            // Update UI with fetched data
            this.updateSystemStatus(healthData);
            this.updateMetricsCards(metricsData, avatarStats);
            this.updatePerformanceChart(performanceData);
            this.updateAlerts();
            
            this.showLoading(false);
            
        } catch (error) {
            console.error('❌ Failed to load dashboard data:', error);
            this.showError('Failed to load dashboard data');
            this.showLoading(false);
        }
    }

    async fetchHealthData() {
        try {
            const adminToken = localStorage.getItem('adminToken');
            const response = await fetch('/api/monitoring/health', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.status === 401 || response.status === 403) {
                this.handleAuthError();
                throw new Error('Authentication failed');
            }
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            return { success: false, error: error.message };
        }
    }

    async fetchMetricsData() {
        try {
            const adminToken = localStorage.getItem('adminToken');
            const response = await fetch('/api/monitoring/metrics', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.status === 401 || response.status === 403) {
                this.handleAuthError();
                throw new Error('Authentication failed');
            }
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Metrics fetch failed:', error);
            return { success: false, metrics: {} };
        }
    }

    async fetchAvatarStats() {
        try {
            const adminToken = localStorage.getItem('adminToken');
            const response = await fetch('/api/monitoring/avatar-stats', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.status === 401 || response.status === 403) {
                this.handleAuthError();
                throw new Error('Authentication failed');
            }
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Avatar stats fetch failed:', error);
            return { success: false, stats: {} };
        }
    }

    async fetchPerformanceData(timeframe = '24h') {
        try {
            const adminToken = localStorage.getItem('adminToken');
            const response = await fetch(`/api/monitoring/performance?timeframe=${timeframe}`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.status === 401 || response.status === 403) {
                this.handleAuthError();
                throw new Error('Authentication failed');
            }
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Performance data fetch failed:', error);
            return { success: false, performance: {} };
        }
    }

    updateSystemStatus(healthData) {
        const statusElement = document.getElementById('systemStatus');
        
        if (healthData.success) {
            statusElement.className = 'system-status status-healthy';
            statusElement.innerHTML = '<span>●</span> System Healthy';
        } else {
            statusElement.className = 'system-status status-critical';
            statusElement.innerHTML = '<span>●</span> System Issues Detected';
        }
    }

    updateMetricsCards(metricsData, avatarStats) {
        // Storage Usage
        if (avatarStats.success && avatarStats.stats) {
            const storageUsage = avatarStats.stats.totalSizeMB || 0;
            document.getElementById('storageUsage').textContent = `${storageUsage} MB`;
        }

        // Update trends from real data
        if (metricsData.success && metricsData.metrics && metricsData.metrics.trends) {
            this.updateTrendDisplays(metricsData.metrics.trends);
        }

        // Response Time
        if (metricsData.success && metricsData.metrics) {
            const responseTime = metricsData.metrics.performance?.averageResponseTime || 0;
            document.getElementById('responseTime').textContent = `${responseTime}ms`;
            
            // Update trend based on response time
            const responseTrend = document.getElementById('responseTrend');
            if (responseTime > 2000) {
                responseTrend.className = 'metric-trend trend-down';
                responseTrend.innerHTML = '<span>⚠️</span> High latency';
            } else if (responseTime > 1000) {
                responseTrend.className = 'metric-trend trend-stable';
                responseTrend.innerHTML = '<span>📊</span> Acceptable';
            } else {
                responseTrend.className = 'metric-trend trend-up';
                responseTrend.innerHTML = '<span>⚡</span> Excellent';
            }
        }

        // Active Users (Real data from performance metrics)
        if (metricsData.success && metricsData.metrics && metricsData.metrics.performance) {
            const activeUsers = metricsData.metrics.performance.dailyActiveUsers || 0;
            document.getElementById('activeUsers').textContent = activeUsers.toLocaleString();
        } else {
            document.getElementById('activeUsers').textContent = '0';
        }

        // Monthly Cost
        if (avatarStats.success && avatarStats.stats.estimatedMonthlyCost) {
            document.getElementById('monthlyCost').textContent = avatarStats.stats.estimatedMonthlyCost.optimized || '$0.00';
        }

        // Error Rate
        if (metricsData.success && metricsData.metrics) {
            const errorRate = (metricsData.metrics.performance?.errorRate * 100) || 0;
            document.getElementById('errorRate').textContent = `${errorRate.toFixed(2)}%`;
            
            // Update error trend
            const errorTrend = document.getElementById('errorTrend');
            if (errorRate > 5) {
                errorTrend.className = 'metric-trend trend-down';
                errorTrend.innerHTML = '<span>🚨</span> High error rate';
            } else if (errorRate > 1) {
                errorTrend.className = 'metric-trend trend-stable';
                errorTrend.innerHTML = '<span>⚠️</span> Monitor closely';
            } else {
                errorTrend.className = 'metric-trend trend-up';
                errorTrend.innerHTML = '<span>✅</span> Within SLA';
            }
        }

        // Upload Success Rate
        if (metricsData.success && metricsData.metrics) {
            const successfulUploads = metricsData.metrics.performance?.successfulUploads || 0;
            const totalUploads = metricsData.metrics.performance?.successfulUploads + metricsData.metrics.performance?.failedUploads || 1;
            const successRate = (successfulUploads / totalUploads * 100).toFixed(1);
            document.getElementById('uploadSuccess').textContent = `${successRate}%`;
        }
    }

    updatePerformanceChart(performanceData) {
        const chartElement = document.getElementById('performanceChart');
        
        if (performanceData.success && performanceData.performance) {
            const perf = performanceData.performance;
            
            chartElement.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <h3 style="color: #2c3e50; margin-bottom: 20px;">📊 Real Performance Data</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px;">
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #28a745;">
                            <div style="font-size: 1.8em; font-weight: bold; color: #28a745;">
                                ${perf.responseTime || 'N/A'}ms
                            </div>
                            <div style="color: #6c757d; font-size: 0.9em;">Database Response</div>
                        </div>
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #007bff;">
                            <div style="font-size: 1.8em; font-weight: bold; color: #007bff;">
                                ${perf.uploads?.total || 0}
                            </div>
                            <div style="color: #6c757d; font-size: 0.9em;">Total Uploads</div>
                        </div>
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #ffc107;">
                            <div style="font-size: 1.8em; font-weight: bold; color: #ffc107;">
                                ${(perf.cache?.hitRate * 100).toFixed(1) || 'N/A'}%
                            </div>
                            <div style="color: #6c757d; font-size: 0.9em;">Cache Hit Rate</div>
                        </div>
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #dc3545;">
                            <div style="font-size: 1.8em; font-weight: bold; color: #dc3545;">
                                ${(perf.errorRate * 100).toFixed(2) || 'N/A'}%
                            </div>
                            <div style="color: #6c757d; font-size: 0.9em;">Error Rate</div>
                        </div>
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #6f42c1;">
                            <div style="font-size: 1.8em; font-weight: bold; color: #6f42c1;">
                                ${perf.uploads?.averageSize || 0}KB
                            </div>
                            <div style="color: #6c757d; font-size: 0.9em;">Avg File Size</div>
                        </div>
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #20c997;">
                            <div style="font-size: 1.8em; font-weight: bold; color: #20c997;">
                                ${perf.cache?.totalRequests || 0}
                            </div>
                            <div style="color: #6c757d; font-size: 0.9em;">Cache Requests</div>
                        </div>
                    </div>
                    <div style="margin-top: 25px; padding: 15px; background: #e8f5e8; border-radius: 8px; color: #155724;">
                        <strong>📈 Real-time metrics</strong> from your PostgreSQL database and avatar system
                    </div>
                </div>
            `;
        } else {
            chartElement.innerHTML = `
                <div style="text-align: center; color: #dc3545; padding: 40px;">
                    ⚠️ Unable to load performance data - Check database connection
                </div>
            `;
        }
    }

    updateAlerts() {
        const alertsList = document.getElementById('alertsList');
        
        // Generate sample alerts based on current system state
        const alerts = this.generateSampleAlerts();
        
        if (alerts.length === 0) {
            alertsList.innerHTML = `
                <div style="text-align: center; color: #28a745; padding: 20px;">
                    ✅ No active alerts - System operating normally
                </div>
            `;
        } else {
            alertsList.innerHTML = alerts.map(alert => `
                <div class="alert-item alert-${alert.type}">
                    <div class="alert-icon" style="background: ${alert.color};">
                        ${alert.icon}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; margin-bottom: 5px;">${alert.title}</div>
                        <div style="color: #6c757d; font-size: 0.9em;">${alert.message}</div>
                    </div>
                    <div style="color: #6c757d; font-size: 0.8em;">
                        ${alert.time}
                    </div>
                </div>
            `).join('');
        }
    }

    generateSampleAlerts() {
        const alerts = [];
        
        // Get current metrics for alert generation
        const currentStorageElement = document.getElementById('storageUsage');
        const currentErrorElement = document.getElementById('errorRate');
        const currentResponseElement = document.getElementById('responseTime');
        
        // Storage alerts based on actual data
        if (currentStorageElement) {
            const storageText = currentStorageElement.textContent;
            const storageMB = parseInt(storageText);
            
            if (storageMB > 500) {
                alerts.push({
                    type: 'warning',
                    icon: '💾',
                    color: '#ed8936',
                    title: 'Storage Usage Alert',
                    message: `Avatar storage is at ${storageMB} MB - consider cleanup`,
                    time: '5 minutes ago'
                });
            }
        }
        
        // Response time alerts
        if (currentResponseElement) {
            const responseText = currentResponseElement.textContent;
            const responseTime = parseInt(responseText);
            
            if (responseTime > 1000) {
                alerts.push({
                    type: 'warning',
                    icon: '⚡',
                    color: '#ed8936',
                    title: 'High Response Time',
                    message: `Database response time is ${responseTime}ms - monitoring performance`,
                    time: '2 minutes ago'
                });
            }
        }
        
        // Error rate alerts
        if (currentErrorElement) {
            const errorText = currentErrorElement.textContent;
            const errorRate = parseFloat(errorText);
            
            if (errorRate > 1.0) {
                alerts.push({
                    type: 'critical',
                    icon: '🚨',
                    color: '#f56565',
                    title: 'Error Rate Alert',
                    message: `System error rate is ${errorRate}% - requires attention`,
                    time: 'Just now'
                });
            }
        }
        
        // System health info
        const uptime = this.formatUptime(process?.uptime || 0);
        if (uptime) {
            alerts.push({
                type: 'info',
                icon: '✅',
                color: '#4299e1',
                title: 'System Status',
                message: `Avatar system running stable - uptime: ${uptime}`,
                time: '30 seconds ago'
            });
        }
        
        return alerts;
    }

    formatUptime(seconds) {
        if (!seconds) return null;
        
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    updateTrendDisplays(trends) {
        // Storage trend
        const storageTrendElement = document.getElementById('storageTrend');
        if (storageTrendElement && trends.storage) {
            storageTrendElement.className = `metric-trend ${trends.storage.trendClass}`;
            storageTrendElement.innerHTML = `<span>${trends.storage.trendIcon}</span> ${trends.storage.weeklyGrowth} ${trends.storage.trend}`;
        }

        // User growth trend
        const userGrowthTrendElement = document.getElementById('userGrowthTrend');
        if (userGrowthTrendElement && trends.users) {
            userGrowthTrendElement.className = `metric-trend ${trends.users.trendClass}`;
            userGrowthTrendElement.innerHTML = `<span>${trends.users.trendIcon}</span> ${trends.users.dailyGrowth} ${trends.users.trend}`;
        }

        // Cost trend
        const costTrendElement = document.getElementById('costTrend');
        if (costTrendElement && trends.cost) {
            costTrendElement.className = `metric-trend ${trends.cost.trendClass}`;
            costTrendElement.innerHTML = `<span>${trends.cost.trendIcon}</span> ${trends.cost.optimization} ${trends.cost.trend}`;
        }

        // Response time trend
        const responseTrendElement = document.getElementById('responseTrend');
        if (responseTrendElement && trends.response) {
            responseTrendElement.className = `metric-trend ${trends.response.trendClass}`;
            responseTrendElement.innerHTML = `<span>${trends.response.trendIcon}</span> ${trends.response.trend}`;
        }

        // Error rate trend
        const errorTrendElement = document.getElementById('errorTrend');
        if (errorTrendElement && trends.error) {
            errorTrendElement.className = `metric-trend ${trends.error.trendClass}`;
            errorTrendElement.innerHTML = `<span>${trends.error.trendIcon}</span> ${trends.error.trend}`;
        }

        // Upload success trend
        const uploadSuccessTrendElement = document.getElementById('uploadSuccessTrend');
        if (uploadSuccessTrendElement && trends.upload) {
            uploadSuccessTrendElement.className = `metric-trend ${trends.upload.trendClass}`;
            uploadSuccessTrendElement.innerHTML = `<span>${trends.upload.trendIcon}</span> ${trends.upload.trend}`;
        }
    }

    async loadPerformanceData(timeframe) {
        try {
            this.showLoading(true);
            const performanceData = await this.fetchPerformanceData(timeframe);
            this.updatePerformanceChart(performanceData);
            this.showLoading(false);
        } catch (error) {
            console.error('Failed to load performance data:', error);
            this.showLoading(false);
        }
    }

    showLoading(show) {
        const loadingElement = document.getElementById('loadingIndicator');
        if (show) {
            loadingElement.classList.add('active');
        } else {
            loadingElement.classList.remove('active');
        }
    }

    showError(message) {
        // Simple error notification
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f8d7da;
            color: #721c24;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 1000;
            max-width: 400px;
        `;
        errorDiv.innerHTML = `<strong>Error:</strong> ${message}`;
        
        document.body.appendChild(errorDiv);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    updateLastUpdatedTime() {
        const now = new Date();
        document.getElementById('lastUpdated').textContent = now.toLocaleTimeString();
        this.lastUpdateTime = now;
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(async () => {
            console.log('🔄 Auto-refreshing dashboard data...');
            await this.loadDashboardData();
            this.updateLastUpdatedTime();
        }, this.refreshRate);
        
        this.isAutoRefresh = true;
        document.getElementById('autoRefreshStatus').textContent = 'Auto-refresh: ON';
        document.getElementById('autoRefreshStatus').style.color = '#28a745';
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        this.isAutoRefresh = false;
        document.getElementById('autoRefreshStatus').textContent = 'Auto-refresh: OFF';
        document.getElementById('autoRefreshStatus').style.color = '#6c757d';
    }

    handleAuthError() {
        // Clean up invalid tokens
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        
        // Redirect to login with return URL  
        const currentPage = 'monitoring.html';
        window.location.href = `index.html?redirect=${encodeURIComponent(currentPage)}`;
    }
}

// Global functions for button clicks
async function refreshDashboard() {
    console.log('🔄 Manual refresh triggered');
    if (window.dashboard) {
        await window.dashboard.loadDashboardData();
        window.dashboard.updateLastUpdatedTime();
    }
}

function toggleAutoRefresh() {
    if (window.dashboard) {
        if (window.dashboard.isAutoRefresh) {
            window.dashboard.stopAutoRefresh();
            console.log('⏸️ Auto-refresh disabled');
        } else {
            window.dashboard.startAutoRefresh();
            console.log('▶️ Auto-refresh enabled');
        }
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new MonitoringDashboard();
});

// Additional utility functions for enterprise monitoring

class EnterpriseMetrics {
    static calculateUptimePercentage(uptime, totalTime) {
        return ((uptime / totalTime) * 100).toFixed(3);
    }
    
    static formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    static calculateCostEfficiency(currentCost, originalCost) {
        const savings = originalCost - currentCost;
        const efficiency = (savings / originalCost) * 100;
        return {
            savings: savings.toFixed(2),
            efficiency: efficiency.toFixed(1)
        };
    }
    
    static generatePerformanceGrade(metrics) {
        let score = 100;
        
        // Response time penalty
        if (metrics.responseTime > 2000) score -= 30;
        else if (metrics.responseTime > 1000) score -= 15;
        else if (metrics.responseTime > 500) score -= 5;
        
        // Error rate penalty
        if (metrics.errorRate > 0.05) score -= 25;
        else if (metrics.errorRate > 0.01) score -= 10;
        
        // Cache hit rate bonus/penalty
        if (metrics.cacheHitRate < 0.8) score -= 20;
        else if (metrics.cacheHitRate > 0.95) score += 5;
        
        // Uptime penalty
        if (metrics.uptime < 0.99) score -= 15;
        
        if (score >= 95) return { grade: 'A+', color: '#28a745' };
        if (score >= 90) return { grade: 'A', color: '#28a745' };
        if (score >= 85) return { grade: 'B+', color: '#ffc107' };
        if (score >= 80) return { grade: 'B', color: '#ffc107' };
        if (score >= 75) return { grade: 'C+', color: '#fd7e14' };
        if (score >= 70) return { grade: 'C', color: '#fd7e14' };
        return { grade: 'D', color: '#dc3545' };
    }
}

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MonitoringDashboard, EnterpriseMetrics };
} 