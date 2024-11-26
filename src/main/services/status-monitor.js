const EventEmitter = require('events');
const logger = require('./logger');
const kopiaService = require('./kopia');
const configService = require('./config');

class StatusMonitor extends EventEmitter {
    constructor() {
        super();
        this.status = {
            isConnected: false,
            lastBackup: null,
            nextBackup: null,
            backupInProgress: false,
            restoreInProgress: false,
            errors: [],
            stats: {
                totalSize: 0,
                totalFiles: 0,
                lastBackupSize: 0,
                lastBackupFiles: 0
            }
        };
        this.updateInterval = null;
    }

    start() {
        this.updateInterval = setInterval(() => this.updateStatus(), 60000); // Update every minute
        this.updateStatus(); // Initial update
        logger.info('Status monitor started');
    }

    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        logger.info('Status monitor stopped');
    }

    async updateStatus() {
        try {
            const repoStatus = await kopiaService.getRepositoryStatus();
            const backupSchedule = configService.get('backup.schedule');
            
            this.status.isConnected = repoStatus.connected;
            this.status.lastBackup = configService.get('backup.schedule.lastRun');
            
            // Calculate next backup time
            if (backupSchedule.frequency !== 'manual') {
                this.status.nextBackup = this.calculateNextBackup(backupSchedule);
            } else {
                this.status.nextBackup = null;
            }

            // Update stats
            if (repoStatus.stats) {
                this.status.stats = {
                    totalSize: repoStatus.stats.totalSize,
                    totalFiles: repoStatus.stats.totalFiles,
                    lastBackupSize: repoStatus.stats.lastBackupSize,
                    lastBackupFiles: repoStatus.stats.lastBackupFiles
                };
            }

            // Clear old errors
            this.status.errors = this.status.errors.filter(error => 
                Date.now() - error.timestamp < 24 * 60 * 60 * 1000 // Keep errors for 24 hours
            );

            this.emit('status-updated', this.status);
            logger.info('Status updated successfully');
        } catch (error) {
            logger.error('Failed to update status:', error);
            this.addError('Status update failed: ' + error.message);
        }
    }

    calculateNextBackup(schedule) {
        const now = new Date();
        let nextBackup = new Date(now);
        
        const [hours, minutes] = schedule.time.split(':').map(Number);
        nextBackup.setHours(hours, minutes, 0, 0);

        if (nextBackup <= now) {
            nextBackup.setDate(nextBackup.getDate() + 1);
        }

        switch (schedule.frequency) {
            case 'daily':
                // Already handled above
                break;
            case 'weekly':
                while (!schedule.weekdays.includes(nextBackup.getDay())) {
                    nextBackup.setDate(nextBackup.getDate() + 1);
                }
                break;
            case 'monthly':
                nextBackup.setDate(1);
                if (nextBackup <= now) {
                    nextBackup.setMonth(nextBackup.getMonth() + 1);
                }
                break;
        }

        return nextBackup;
    }

    addError(message) {
        const error = {
            message,
            timestamp: Date.now()
        };
        this.status.errors.push(error);
        this.emit('error', error);
    }

    getStatus() {
        return { ...this.status };
    }

    setBackupProgress(inProgress) {
        this.status.backupInProgress = inProgress;
        this.emit('status-updated', this.status);
    }

    setRestoreProgress(inProgress) {
        this.status.restoreInProgress = inProgress;
        this.emit('status-updated', this.status);
    }
}

module.exports = new StatusMonitor();