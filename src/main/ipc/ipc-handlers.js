const { ipcMain, BrowserWindow } = require('electron');
const fileDialogs = require('../dialogs/file-dialogs');
const kopiaService = require('../services/kopia');
const configService = require('../services/config');
const logger = require('../services/logger');
const scheduler = require('../scheduler');
const ProgressService = require('../services/kopia/progress');

function setupIpcHandlers() {
    try {
        // Initialize progress service
        const progressService = new ProgressService();
        const progressHandlers = new Map(); // Track progress handlers for each backup
        
        // File selection handlers
        ipcMain.handle('select-paths', () => fileDialogs.selectPaths());
        ipcMain.handle('select-restore-directory', () => fileDialogs.selectRestoreDirectory());

        // Helper function for setting up backup progress tracking
        const setupBackupProgress = (paths) => {
            const backupKey = paths.sort().join('|');

            // Set up progress handler
            const progressHandler = (progress) => {
                // Only handle progress for this specific backup
                if (progress && progress.paths && progress.paths.sort().join('|') !== backupKey) {
                    return;
                }

                console.log(`IPC: Sending progress update for ${backupKey}:`, progress);
                // Send to all windows
                BrowserWindow.getAllWindows().forEach(window => {
                    window.webContents.send('backup-progress', {
                        ...progress,
                        paths // Include paths to identify which backup this belongs to
                    });
                });
            };

            // Store the handler reference
            progressHandlers.set(backupKey, progressHandler);

            // Add progress handler to progress service
            progressService.on('progress', progressHandler);

            return { backupKey, progressHandler };
        };

        // Helper function for cleanup after backup
        const cleanupBackupProgress = (backupKey, progressHandler) => {
            progressService.removeListener('progress', progressHandler);
            progressHandlers.delete(backupKey);
        };

        // Repository handlers
        ipcMain.handle('reconnect-repository', async () => {
            console.log('IPC: Reconnecting to repository');
            try {
                await kopiaService.repositoryService.reconnectRepository();
                return { success: true };
            } catch (error) {
                console.error('IPC: Error reconnecting to repository:', error);
                throw error;
            }
        });

        // Backup handlers
        ipcMain.handle('start-backup', async (event, paths) => {
            console.log('IPC: Starting backup for paths:', paths);
            try {
                const { backupKey, progressHandler } = setupBackupProgress(paths);

                try {
                    // Start backup and wait for completion
                    const result = await kopiaService.startBackup(paths);
                    return result;
                } finally {
                    cleanupBackupProgress(backupKey, progressHandler);
                }
            } catch (error) {
                console.error('IPC: Error during backup:', error);
                throw error;
            }
        });

        ipcMain.handle('resume-backup', async (event, paths) => {
            console.log('IPC: Resuming backup for paths:', paths);
            try {
                const { backupKey, progressHandler } = setupBackupProgress(paths);

                try {
                    // Resume backup and wait for completion
                    const result = await kopiaService.backupService.resumeBackup(paths);
                    return result;
                } finally {
                    cleanupBackupProgress(backupKey, progressHandler);
                }
            } catch (error) {
                console.error('IPC: Error resuming backup:', error);
                throw error;
            }
        });

        ipcMain.handle('cancel-backup', (event, paths) => kopiaService.cancelBackup(paths));
        ipcMain.handle('get-backup-status', (event, paths) => kopiaService.getBackupStatus(paths));
        ipcMain.handle('get-directory-stats', (event, path) => kopiaService.getDirectoryStats(path));
        ipcMain.handle('get-backup-paths', () => configService.getBackupPaths());
        ipcMain.handle('add-backup-path', (event, path) => configService.addBackupPath(path));
        ipcMain.handle('remove-backup-path', (event, path) => configService.removeBackupPath(path));
        ipcMain.handle('delete-backup', (event, path) => kopiaService.deleteBackup(path));
        ipcMain.handle('restore-backup', (event, path, targetPath) => kopiaService.restoreBackup(path, targetPath));

        // Snapshot handlers
        ipcMain.handle('get-snapshots', () => kopiaService.getSnapshots());
        ipcMain.handle('browse-snapshot', (event, snapshotId, path) => 
            kopiaService.browseSnapshot(snapshotId, path));
        ipcMain.handle('restore-snapshot', (event, snapshotId, targetPath) => 
            kopiaService.restoreSnapshot(snapshotId, targetPath));

        // Settings handlers
        ipcMain.handle('get-settings', async () => {
            const settings = await configService.getAllSettings();
            return {
                schedule: settings.backup.schedule,
                retention: settings.backup.retention
            };
        });

        ipcMain.handle('save-settings', async (event, settings) => {
            if (settings.schedule) {
                await configService.updateSchedule(settings.schedule);
                await scheduler.updateSchedule(settings.schedule);
            }
            if (settings.retention) {
                await configService.updateRetention(settings.retention);
                await scheduler.updateRetentionPolicy(settings.retention);
            }
            return true;
        });

        // Log handlers
        ipcMain.handle('get-logs', () => logger.getLogs());

        // Schedule handlers
        ipcMain.handle('schedule-backup', async (event, schedule) => {
            await configService.updateSchedule(schedule);
            return scheduler.updateSchedule(schedule);
        });
        
        ipcMain.handle('get-schedule', () => scheduler.getScheduleStatus());

        // Cleanup on window close
        ipcMain.on('window-closing', () => {
            // Clean up all progress handlers
            progressHandlers.forEach((handler, key) => {
                progressService.removeListener('progress', handler);
            });
            progressHandlers.clear();
        });

        console.log('IPC handlers setup complete');
    } catch (error) {
        console.error('Error setting up IPC handlers:', error);
    }
}

module.exports = {
    setupIpcHandlers
};
