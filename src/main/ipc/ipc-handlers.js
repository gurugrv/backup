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

        // Backup handlers
        ipcMain.handle('start-backup', async (event, paths) => {
            console.log('IPC: Starting backup for paths:', paths);
            try {
                const backupKey = paths.sort().join('|');

                // Set up progress handler before starting backup
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
                            paths // Include paths to identify which backup this progress belongs to
                        });
                    });
                };

                // Store the handler reference
                progressHandlers.set(backupKey, progressHandler);

                // Add progress handler to progress service
                progressService.on('progress', progressHandler);

                // Start backup and wait for completion
                const result = await kopiaService.startBackup(paths);

                // Remove progress handler after backup completes
                progressService.removeListener('progress', progressHandler);
                progressHandlers.delete(backupKey);

                return result;
            } catch (error) {
                console.error('IPC: Error during backup:', error);
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
        ipcMain.handle('get-settings', () => configService.getSettings());
        ipcMain.handle('save-settings', (event, settings) => configService.saveSettings(settings));

        // Log handlers
        ipcMain.handle('get-logs', () => logger.getLogs());

        // Schedule handlers
        ipcMain.handle('schedule-backup', (event, schedule) => scheduler.scheduleBackup(schedule));
        ipcMain.handle('get-schedule', () => scheduler.getSchedule());

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
