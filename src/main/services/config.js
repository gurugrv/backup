const { app } = require('electron');
const path = require('path');
const logger = require('./logger');

let Store;
let store;

async function initializeStore() {
    const { default: ElectronStore } = await import('electron-store');
    Store = ElectronStore;
    store = new Store({
        name: 'config',
        defaults: {
            repository: {
                initialized: false,
                lastConnection: null
            },
            backup: {
                schedule: {
                    frequency: 'daily',
                    time: '00:00',
                    weekdays: [],
                    lastRun: null
                },
                retention: {
                    keepLatest: 5,
                    keepDaily: 7,
                    keepWeekly: 4,
                    keepMonthly: 6
                },
                paths: []
            },
            preferences: {
                theme: 'system',
                minimizeToTray: true,
                startAtLogin: false,
                notifications: true,
                autoUpdate: true
            },
            cache: {
                lastSnapshotList: null,
                lastStats: null
            }
        }
    });
}

class ConfigService {
    constructor() {
        this.ready = initializeStore();
        this.migrationVersion = 1; // Increment this when adding migrations
    }

    async load() {
        await this.ready;
        await this.runMigrations();
        await this.validateConfig();
    }

    async ensureReady() {
        await this.ready;
    }

    async get(key, defaultValue = null) {
        await this.ensureReady();
        try {
            const value = store.get(key);
            return value === undefined ? defaultValue : value;
        } catch (error) {
            logger.error('Error reading config:', { key, error });
            return defaultValue;
        }
    }

    async set(key, value) {
        await this.ensureReady();
        try {
            store.set(key, value);
            logger.info('Config updated:', { key });
        } catch (error) {
            logger.error('Error writing config:', { key, error });
            throw error;
        }
    }

    async delete(key) {
        await this.ensureReady();
        try {
            store.delete(key);
            logger.info('Config deleted:', { key });
        } catch (error) {
            logger.error('Error deleting config:', { key, error });
            throw error;
        }
    }

    async getAllSettings() {
        await this.ensureReady();
        try {
            return store.store;
        } catch (error) {
            logger.error('Error getting all settings:', error);
            throw error;
        }
    }

    async updateSettings(settings) {
        await this.ensureReady();
        try {
            // Update each section individually to maintain structure
            if (settings.backup) {
                const currentBackup = await this.get('backup');
                await this.set('backup', { ...currentBackup, ...settings.backup });
            }

            if (settings.preferences) {
                const currentPrefs = await this.get('preferences');
                await this.set('preferences', { ...currentPrefs, ...settings.preferences });

                // Handle special cases
                if (settings.preferences.startAtLogin !== undefined) {
                    this.setStartAtLogin(settings.preferences.startAtLogin);
                }
            }

            if (settings.repository) {
                const currentRepo = await this.get('repository');
                await this.set('repository', { ...currentRepo, ...settings.repository });
            }

            logger.info('Settings updated successfully');
            return true;
        } catch (error) {
            logger.error('Failed to update settings:', error);
            throw error;
        }
    }

    async addBackupPath(path) {
        await this.ensureReady();
        try {
            const paths = await this.get('backup.paths', []);
            if (!paths.includes(path)) {
                paths.push(path);
                await this.set('backup.paths', paths);
                logger.info('Backup path added:', path);
            }
        } catch (error) {
            logger.error('Error adding backup path:', error);
            throw error;
        }
    }

    async removeBackupPath(path) {
        await this.ensureReady();
        try {
            const paths = await this.get('backup.paths', []);
            const index = paths.indexOf(path);
            if (index !== -1) {
                paths.splice(index, 1);
                await this.set('backup.paths', paths);
                logger.info('Backup path removed:', path);
            }
        } catch (error) {
            logger.error('Error removing backup path:', error);
            throw error;
        }
    }

    async getBackupPaths() {
        return this.get('backup.paths', []);
    }

    async updateSchedule(schedule) {
        await this.ensureReady();
        try {
            const currentSchedule = await this.get('backup.schedule');
            await this.set('backup.schedule', { ...currentSchedule, ...schedule });
            logger.info('Schedule updated');
        } catch (error) {
            logger.error('Error updating schedule:', error);
            throw error;
        }
    }

    async updateRetention(retention) {
        await this.ensureReady();
        try {
            const currentRetention = await this.get('backup.retention');
            await this.set('backup.retention', { ...currentRetention, ...retention });
            logger.info('Retention policy updated');
        } catch (error) {
            logger.error('Error updating retention:', error);
            throw error;
        }
    }

    setStartAtLogin(enable) {
        try {
            app.setLoginItemSettings({
                openAtLogin: enable,
                openAsHidden: true,
                path: app.getPath('exe')
            });
        } catch (error) {
            logger.error('Error setting start at login:', error);
            throw error;
        }
    }

    async validateConfig() {
        await this.ensureReady();
        try {
            const config = await this.getAllSettings();

            // Validate backup paths exist
            const fs = require('fs').promises;
            const paths = config.backup.paths || [];
            for (const path of paths) {
                try {
                    await fs.access(path);
                } catch (error) {
                    logger.warn('Backup path no longer exists:', path);
                    await this.removeBackupPath(path);
                }
            }

            // Validate schedule
            const schedule = config.backup.schedule;
            if (schedule.frequency === 'custom' && (!schedule.weekdays || schedule.weekdays.length === 0)) {
                schedule.weekdays = [1]; // Default to Monday
                await this.set('backup.schedule', schedule);
            }

            // Validate retention policy
            const retention = config.backup.retention;
            if (retention.keepLatest < 1) retention.keepLatest = 1;
            if (retention.keepDaily < 1) retention.keepDaily = 1;
            if (retention.keepWeekly < 1) retention.keepWeekly = 1;
            if (retention.keepMonthly < 1) retention.keepMonthly = 1;
            await this.set('backup.retention', retention);

            logger.info('Config validation completed');
        } catch (error) {
            logger.error('Config validation failed:', error);
            throw error;
        }
    }

    async runMigrations() {
        await this.ensureReady();
        try {
            const currentVersion = await this.get('migrationVersion', 0);
            
            if (currentVersion < this.migrationVersion) {
                // Add migration logic here when needed
                // Example:
                // if (currentVersion < 1) {
                //     await this.migrateToV1();
                // }
                // if (currentVersion < 2) {
                //     await this.migrateToV2();
                // }

                await this.set('migrationVersion', this.migrationVersion);
                logger.info('Migrations completed successfully');
            }
        } catch (error) {
            logger.error('Migration failed:', error);
            throw error;
        }
    }

    async migrateToV1() {
        try {
            // Example migration: Add new preferences
            const preferences = await this.get('preferences', {});
            if (preferences.autoUpdate === undefined) {
                preferences.autoUpdate = true;
            }
            await this.set('preferences', preferences);

            // Add cache section if it doesn't exist
            const cache = await this.get('cache', {});
            if (!cache.lastSnapshotList) {
                cache.lastSnapshotList = null;
            }
            if (!cache.lastStats) {
                cache.lastStats = null;
            }
            await this.set('cache', cache);

            logger.info('Migration to V1 completed');
        } catch (error) {
            logger.error('Migration to V1 failed:', error);
            throw error;
        }
    }

    async backup() {
        await this.ensureReady();
        try {
            const configData = await this.getAllSettings();
            const backupPath = path.join(app.getPath('userData'), 'config.backup.json');
            
            await require('fs').promises.writeFile(
                backupPath,
                JSON.stringify(configData, null, 2)
            );
            
            logger.info('Config backup created successfully');
        } catch (error) {
            logger.error('Config backup failed:', error);
            throw error;
        }
    }

    async restore(backupPath) {
        await this.ensureReady();
        try {
            const backupData = JSON.parse(
                await require('fs').promises.readFile(backupPath, 'utf8')
            );

            // Validate backup data structure
            if (!this.validateBackupData(backupData)) {
                throw new Error('Invalid backup data structure');
            }

            // Clear current config
            store.clear();

            // Restore from backup
            for (const [key, value] of Object.entries(backupData)) {
                await this.set(key, value);
            }

            logger.info('Config restored successfully');
            return true;
        } catch (error) {
            logger.error('Config restore failed:', error);
            throw error;
        }
    }

    validateBackupData(data) {
        // Add validation rules for backup data
        const requiredSections = ['repository', 'backup', 'preferences'];
        return requiredSections.every(section => 
            data.hasOwnProperty(section) && 
            typeof data[section] === 'object'
        );
    }

    async resetToDefaults() {
        await this.ensureReady();
        try {
            // Create backup before reset
            await this.backup();

            // Clear all settings
            store.clear();

            // Reset to default values
            store = new Store();

            logger.info('Config reset to defaults');
            return true;
        } catch (error) {
            logger.error('Config reset failed:', error);
            throw error;
        }
    }

    async importConfig(configData) {
        await this.ensureReady();
        try {
            // Validate imported data
            if (!this.validateBackupData(configData)) {
                throw new Error('Invalid config data structure');
            }

            // Backup current config
            await this.backup();

            // Clear current config
            store.clear();

            // Import new config
            for (const [key, value] of Object.entries(configData)) {
                await this.set(key, value);
            }

            await this.validateConfig();
            logger.info('Config imported successfully');
            return true;
        } catch (error) {
            logger.error('Config import failed:', error);
            throw error;
        }
    }

    async exportConfig() {
        await this.ensureReady();
        try {
            const configData = await this.getAllSettings();
            
            // Remove sensitive data
            if (configData.repository) {
                delete configData.repository.credentials;
            }
            
            return configData;
        } catch (error) {
            logger.error('Config export failed:', error);
            throw error;
        }
    }

    async updateCacheData(key, value) {
        await this.ensureReady();
        try {
            const cache = await this.get('cache', {});
            cache[key] = value;
            await this.set('cache', cache);
        } catch (error) {
            logger.error('Cache update failed:', error);
            throw error;
        }
    }

    async getCacheData(key) {
        return this.get(`cache.${key}`, null);
    }

    async clearCache() {
        await this.ensureReady();
        try {
            await this.set('cache', {
                lastSnapshotList: null,
                lastStats: null
            });
            logger.info('Cache cleared successfully');
        } catch (error) {
            logger.error('Cache clear failed:', error);
            throw error;
        }
    }

    // Utility method to check if config is initialized
    async isInitialized() {
        return this.get('repository.initialized', false);
    }

    // Method to set initialization status
    async setInitialized(status) {
        await this.set('repository.initialized', status);
        if (status) {
            await this.set('repository.lastConnection', new Date().toISOString());
        }
    }
}

module.exports = new ConfigService();
