const { scheduleJob } = require('node-schedule');
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const execFileAsync = promisify(execFile);

class BackupScheduler {
    constructor() {
        // Initialize paths and basic properties
        const APP_ROOT = path.join(__dirname, '../../..');
        this.kopiaPath = path.join(APP_ROOT, 'bin', 'kopia.exe');
        this.jobs = new Map();
        this.initialized = false;
        this.store = null;

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

            // Load existing schedule
            const settings = this.store.get('backup-settings');
            if (settings?.schedule) {
                await this.updateSchedule(settings.schedule);
            }

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

            if (!scheduleConfig || !scheduleConfig.time) {
                console.log('No valid schedule config provided');
                return;
            }

            const { frequency, time, weekdays } = scheduleConfig;
            const [hours, minutes] = time.split(':').map(Number);

            let schedule;
            switch (frequency) {
                case 'daily':
                    schedule = `${minutes} ${hours} * * *`;
                    break;
                case 'weekly':
                    schedule = `${minutes} ${hours} * * 1`;
                    break;
                case 'monthly':
                    schedule = `${minutes} ${hours} 1 * *`;
                    break;
                case 'custom':
                    if (weekdays && Array.isArray(weekdays)) {
                        weekdays.forEach(day => {
                            const daySchedule = `${minutes} ${hours} * * ${day}`;
                            this.scheduleBackup(daySchedule);
                        });
                        return;
                    }
                    break;
                default:
                    console.log('Unknown frequency:', frequency);
                    return;
            }

            if (schedule) {
                this.scheduleBackup(schedule);
                console.log('Schedule updated successfully:', schedule);
            }
        } catch (error) {
            console.error('Failed to update schedule:', error);
            throw error;
        }
    }

    scheduleBackup(schedule) {
        try {
            console.log('Scheduling backup for:', schedule);
            
            const job = scheduleJob(schedule, async () => {
                try {
                    console.log('Starting scheduled backup...');
                    await this.executeBackup();
                    console.log('Scheduled backup completed successfully');
                } catch (error) {
                    console.error('Scheduled backup failed:', error);
                }
            });

            this.jobs.set(schedule, job);
            console.log('Backup job scheduled successfully');

            // Store the last scheduled time
            this.store?.set('backup-settings.schedule.lastScheduled', new Date().toISOString());
        } catch (error) {
            console.error('Failed to schedule backup:', error);
            throw error;
        }
    }

    async executeBackup() {
        try {
            console.log('Executing backup...');
            
            // Get backup paths from store
            const paths = this.store?.get('backup-paths', []);
            if (!paths.length) {
                console.log('No backup paths configured');
                return;
            }

            for (const path of paths) {
                console.log('Backing up path:', path);
                await execFileAsync(this.kopiaPath, ['snapshot', 'create', path]);
                console.log('Backup completed for path:', path);
            }

            // Update last successful backup time
            this.store?.set('backup-settings.schedule.lastRun', new Date().toISOString());
            console.log('Backup execution completed successfully');
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
            const activeJobs = Array.from(this.jobs.entries()).map(([schedule, job]) => ({
                schedule,
                nextRun: job.nextInvocation(),
                isActive: job.nextInvocation() !== null
            }));

            return {
                activeJobs,
                lastRun: this.store?.get('backup-settings.schedule.lastRun'),
                lastScheduled: this.store?.get('backup-settings.schedule.lastScheduled'),
                nextRun: this.getNextBackupTime(),
                isInitialized: this.initialized,
                totalJobs: this.jobs.size
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

    validateScheduleConfig(config) {
        if (!config) return false;
        
        const { frequency, time } = config;
        if (!frequency || !time) return false;
        
        const validFrequencies = ['daily', 'weekly', 'monthly', 'custom'];
        if (!validFrequencies.includes(frequency)) return false;
        
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(time)) return false;
        
        if (frequency === 'custom' && (!config.weekdays || !Array.isArray(config.weekdays))) {
            return false;
        }
        
        return true;
    }

    async manualBackup(paths) {
        try {
            console.log('Starting manual backup...');
            for (const path of paths) {
                await execFileAsync(this.kopiaPath, ['snapshot', 'create', path]);
                console.log('Manual backup completed for:', path);
            }
            console.log('Manual backup completed successfully');
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
