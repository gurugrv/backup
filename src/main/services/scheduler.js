const { scheduleJob } = require('node-schedule');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const path = require('path');
const logger = require('./logger');

class BackupScheduler {
    constructor() {
        this.jobs = new Map();
        this.store = null;
        this.initialized = false;
        this.kopiaPath = process.env.NODE_ENV === 'development'
            ? path.join(__dirname, '../../../bin/kopia.exe')
            : path.join(process.resourcesPath, 'bin/kopia.exe');
    }

    async initialize() {
        try {
            // Initialize electron-store
            const { default: Store } = await import('electron-store');
            this.store = new Store();
            
            await this.loadSchedule();
            this.initialized = true;
            logger.info('Backup scheduler initialized');
        } catch (error) {
            logger.error('Failed to initialize scheduler:', error);
            throw error;
        }
    }

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    async loadSchedule() {
        try {
            await this.ensureInitialized();
            const settings = this.store.get('backup-settings');
            if (settings?.schedule) {
                await this.updateSchedule(settings.schedule);
            }
        } catch (error) {
            logger.error('Failed to load schedule:', error);
            throw error;
        }
    }

    async updateSchedule(scheduleConfig) {
        try {
            await this.ensureInitialized();
            
            // Clear existing jobs
            this.jobs.forEach(job => job.cancel());
            this.jobs.clear();

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
                    }
                    return;
            }

            if (schedule) {
                await this.scheduleBackup(schedule);
            }

            logger.info('Schedule updated:', { frequency, time });
        } catch (error) {
            logger.error('Failed to update schedule:', error);
            throw error;
        }
    }

    async scheduleBackup(schedule) {
        try {
            await this.ensureInitialized();
            
            const job = scheduleJob(schedule, async () => {
                try {
                    const paths = this.store.get('backup-paths', []);
                    logger.info('Starting scheduled backup for paths:', paths);

                    for (const path of paths) {
                        await execFileAsync(this.kopiaPath, ['snapshot', 'create', path]);
                        logger.info('Backup completed for path:', path);
                    }

                    this.store.set('backup-settings.schedule.lastRun', new Date().toISOString());
                    logger.info('Scheduled backup completed successfully');
                } catch (error) {
                    logger.error('Scheduled backup failed:', error);
                }
            });

            this.jobs.set(schedule, job);
            logger.info('Backup job scheduled:', { schedule });
        } catch (error) {
            logger.error('Failed to schedule backup:', error);
            throw error;
        }
    }

    async getNextBackupTime() {
        try {
            await this.ensureInitialized();
            
            let nextDate = null;
            this.jobs.forEach(job => {
                const nextInvocation = job.nextInvocation();
                if (!nextDate || nextInvocation < nextDate) {
                    nextDate = nextInvocation;
                }
            });
            return nextDate;
        } catch (error) {
            logger.error('Failed to get next backup time:', error);
            throw error;
        }
    }

    async cancelAllJobs() {
        try {
            this.jobs.forEach(job => job.cancel());
            this.jobs.clear();
            logger.info('All backup jobs cancelled');
        } catch (error) {
            logger.error('Failed to cancel jobs:', error);
            throw error;
        }
    }

    async getScheduleStatus() {
        try {
            await this.ensureInitialized();
            
            const activeJobs = Array.from(this.jobs.entries()).map(([schedule, job]) => ({
                schedule,
                nextRun: job.nextInvocation()
            }));

            return {
                activeJobs,
                lastRun: this.store.get('backup-settings.schedule.lastRun'),
                nextRun: await this.getNextBackupTime()
            };
        } catch (error) {
            logger.error('Failed to get schedule status:', error);
            throw error;
        }
    }
}

module.exports = new BackupScheduler();