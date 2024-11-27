const { scheduleJob } = require('node-schedule');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const kopiaService = require('./services/kopia');
const { KOPIA_PATH } = require('./utils/paths');

class BackupScheduler {
    constructor() {
        this.kopiaPath = KOPIA_PATH;
        this.jobs = new Map();
        this.initialized = false;
        this.store = null;

        // Default schedule configurations
        this.defaultSchedule = {
            daily: {
                frequency: 'daily',
                time: '02:00',
                type: 'incremental'
            },
            frequent: {
                frequency: 'custom',
                cronExpression: '0 */4 8-20 * * *',
                type: 'incremental'
            },
            weekly: {
                frequency: 'weekly',
                time: '02:00',
                dayOfWeek: 0, // Sunday
                type: 'full'
            }
        };

        // Default retention policy
        this.defaultRetention = {
            keepLatest: 1,
            keepHourly: 48,     // 48 hours as requested
            keepDaily: 30,      // 30 days
            keepWeekly: 12,     // 12 weeks
            keepMonthly: 12,    // 12 months as requested
            keepAnnual: 1       // 1 year
        };

        console.log('Scheduler initialized with Kopia path:', this.kopiaPath);
    }

    async initialize() {
        if (this.initialized) {
            console.log('Scheduler already initialized');
            return;
        }

        try {
            console.log('Initializing scheduler...');
            
            // Initialize store
            const { default: Store } = await import('electron-store');
            this.store = new Store();

            // Load or set default settings
            let settings = this.store.get('backup-settings');
            if (!settings) {
                settings = {
                    schedule: this.defaultSchedule,
                    retention: this.defaultRetention
                };
                this.store.set('backup-settings', settings);
            }

            // Apply settings
            await this.updateSchedule(settings.schedule);
            await this.updateRetentionPolicy(settings.retention);

            this.initialized = true;
            console.log('Scheduler initialized successfully');
        } catch (error) {
            console.error('Failed to initialize scheduler:', error);
            throw error;
        }
    }

    async updateSchedule(scheduleConfig) {
        try {
            console.log('Updating schedule with config:', scheduleConfig);
            
            // Clear existing jobs
            this.cancelAllJobs();

            // Schedule each type of backup
            if (scheduleConfig.daily) {
                await this.scheduleBackup('daily', scheduleConfig.daily);
            }
            if (scheduleConfig.frequent) {
                await this.scheduleBackup('frequent', scheduleConfig.frequent);
            }
            if (scheduleConfig.weekly) {
                await this.scheduleBackup('weekly', scheduleConfig.weekly);
            }

            // Store the schedule
            this.store?.set('backup-settings.schedule', scheduleConfig);
            console.log('All schedules updated successfully');
        } catch (error) {
            console.error('Failed to update schedule:', error);
            throw error;
        }
    }

    async updateRetentionPolicy(retentionConfig) {
        try {
            console.log('Updating retention policy:', retentionConfig);
            
            // Store the retention policy
            this.store?.set('backup-settings.retention', retentionConfig);

            // Apply retention policy to repository
            const args = ['policy', 'set'];
            
            if (retentionConfig.keepLatest) {
                args.push('--keep-latest', retentionConfig.keepLatest);
            }
            if (retentionConfig.keepHourly) {
                args.push('--keep-hourly', retentionConfig.keepHourly);
            }
            if (retentionConfig.keepDaily) {
                args.push('--keep-daily', retentionConfig.keepDaily);
            }
            if (retentionConfig.keepWeekly) {
                args.push('--keep-weekly', retentionConfig.keepWeekly);
            }
            if (retentionConfig.keepMonthly) {
                args.push('--keep-monthly', retentionConfig.keepMonthly);
            }
            if (retentionConfig.keepAnnual) {
                args.push('--keep-annual', retentionConfig.keepAnnual);
            }

            await execFileAsync(this.kopiaPath, args);
            console.log('Retention policy updated successfully');

            // Run snapshot expiration to apply new policies
            await execFileAsync(this.kopiaPath, ['snapshot', 'expire', '--all']);
            console.log('Snapshot expiration completed');
        } catch (error) {
            console.error('Failed to update retention policy:', error);
            throw error;
        }
    }

    async scheduleBackup(type, config) {
        try {
            console.log(`Scheduling ${type} backup with config:`, config);
            
            let schedule;
            if (config.cronExpression) {
                schedule = config.cronExpression;
            } else {
                const [hours, minutes] = config.time.split(':').map(Number);
                
                switch (config.frequency) {
                    case 'daily':
                        schedule = `${minutes} ${hours} * * *`;
                        break;
                    case 'weekly':
                        schedule = `${minutes} ${hours} * * ${config.dayOfWeek}`;
                        break;
                    case 'monthly':
                        schedule = `${minutes} ${hours} ${config.dayOfMonth} * *`;
                        break;
                    default:
                        console.log('Unknown frequency:', config.frequency);
                        return;
                }
            }

            if (schedule) {
                const job = scheduleJob(schedule, async () => {
                    try {
                        console.log(`Starting scheduled ${type} backup...`);
                        await this.executeBackup(config.type);
                        console.log(`Scheduled ${type} backup completed successfully`);
                    } catch (error) {
                        console.error(`Scheduled ${type} backup failed:`, error);
                    }
                });

                this.jobs.set(`${type}-${schedule}`, job);
                console.log(`${type} backup job scheduled successfully`);

                // Store the last scheduled time
                this.store?.set(`backup-settings.schedule.${type}.lastScheduled`, new Date().toISOString());
            }
        } catch (error) {
            console.error(`Failed to schedule ${type} backup:`, error);
            throw error;
        }
    }

    async executeBackup(type = 'incremental') {
        try {
            console.log(`Executing ${type} backup...`);
            
            // Get backup paths from store
            const paths = this.store?.get('backup-paths', []);
            if (!paths.length) {
                console.log('No backup paths configured');
                return;
            }

            // Create snapshots for each path
            for (const path of paths) {
                console.log('Backing up path:', path);
                const args = ['snapshot', 'create', path];
                
                if (type === 'incremental') {
                    args.push('--snapshot-time', 'latest');
                }

                await execFileAsync(this.kopiaPath, args);
                console.log('Backup completed for path:', path);
            }

            // Run snapshot expiration to apply retention policies
            console.log('Running snapshot expiration...');
            await execFileAsync(this.kopiaPath, ['snapshot', 'expire', '--all']);

            // Run maintenance to clean up repository
            console.log('Running maintenance...');
            await kopiaService.cleanupRepository();

            // Update last successful backup time
            this.store?.set('backup-settings.schedule.lastRun', new Date().toISOString());
            console.log('Backup execution and cleanup completed successfully');
        } catch (error) {
            console.error('Backup execution failed:', error);
            throw error;
        }
    }

    getNextBackupTime() {
        try {
            let nextDate = null;
            this.jobs.forEach(job => {
                const nextInvocation = job.nextInvocation();
                if (!nextDate || nextInvocation < nextDate) {
                    nextDate = nextInvocation;
                }
            });
            return nextDate;
        } catch (error) {
            console.error('Failed to get next backup time:', error);
            return null;
        }
    }

    cancelAllJobs() {
        try {
            console.log('Cancelling all scheduled jobs...');
            this.jobs.forEach(job => job.cancel());
            this.jobs.clear();
            console.log('All jobs cancelled successfully');
        } catch (error) {
            console.error('Failed to cancel jobs:', error);
            throw error;
        }
    }

    getScheduleStatus() {
        try {
            const settings = this.store?.get('backup-settings') || {};
            const activeJobs = Array.from(this.jobs.entries()).map(([schedule, job]) => ({
                schedule,
                nextRun: job.nextInvocation(),
                isActive: job.nextInvocation() !== null
            }));

            return {
                activeJobs,
                lastRun: settings.schedule?.lastRun,
                lastScheduled: settings.schedule?.lastScheduled,
                nextRun: this.getNextBackupTime(),
                isInitialized: this.initialized,
                totalJobs: this.jobs.size,
                currentSchedule: settings.schedule,
                currentRetention: settings.retention
            };
        } catch (error) {
            console.error('Failed to get schedule status:', error);
            return {
                activeJobs: [],
                lastRun: null,
                lastScheduled: null,
                nextRun: null,
                isInitialized: this.initialized,
                totalJobs: 0,
                error: error.message
            };
        }
    }

    async manualBackup(paths) {
        try {
            console.log('Starting manual backup...');
            for (const path of paths) {
                await execFileAsync(this.kopiaPath, [
                    'snapshot', 
                    'create',
                    path,
                    '--snapshot-time', 'latest'
                ]);
                console.log('Manual backup completed for:', path);
            }

            // Run snapshot expiration to apply retention policies
            console.log('Running snapshot expiration...');
            await execFileAsync(this.kopiaPath, ['snapshot', 'expire', '--all']);

            // Run maintenance to clean up repository
            console.log('Running maintenance...');
            await kopiaService.cleanupRepository();

            console.log('Manual backup and cleanup completed successfully');
        } catch (error) {
            console.error('Manual backup failed:', error);
            throw error;
        }
    }
}

// Create and export a single instance
const scheduler = new BackupScheduler();
console.log('Backup scheduler instance created');
module.exports = scheduler;
