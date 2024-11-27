const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    // File selection
    selectPaths: () => ipcRenderer.invoke('select-paths'),
    selectRestoreDirectory: () => ipcRenderer.invoke('select-restore-directory'),

    // Backup operations
    startBackup: (paths) => ipcRenderer.invoke('start-backup', paths),
    cancelBackup: (paths) => ipcRenderer.invoke('cancel-backup', paths),
    getBackupStatus: (paths) => ipcRenderer.invoke('get-backup-status', paths),
    getDirectoryStats: (path) => ipcRenderer.invoke('get-directory-stats', path),
    getBackupPaths: () => ipcRenderer.invoke('get-backup-paths'),
    addBackupPath: (path) => ipcRenderer.invoke('add-backup-path', path),
    removeBackupPath: (path) => ipcRenderer.invoke('remove-backup-path', path),
    deleteBackup: (path) => ipcRenderer.invoke('delete-backup', path),
    restoreBackup: (path, targetPath) => ipcRenderer.invoke('restore-backup', path, targetPath),

    // Snapshot operations
    getSnapshots: () => ipcRenderer.invoke('get-snapshots'),
    browseSnapshot: (snapshotId, path) => ipcRenderer.invoke('browse-snapshot', snapshotId, path),
    restoreSnapshot: (snapshotId, targetPath) => ipcRenderer.invoke('restore-snapshot', snapshotId, targetPath),

    // Settings operations
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // Log operations
    getLogs: () => ipcRenderer.invoke('get-logs'),

    // Schedule operations
    scheduleBackup: (schedule) => ipcRenderer.invoke('schedule-backup', schedule),
    getSchedule: () => ipcRenderer.invoke('get-schedule'),

    // Events
    onBackupProgress: (callback) => {
        console.log('Setting up backup progress listener');
        
        // Create a wrapper function that we can reference for removal
        const wrappedCallback = (event, progress) => {
            console.log('Progress event received in preload:', progress);
            callback(progress);
        };
        
        // Remove any existing listeners to prevent duplicates
        ipcRenderer.removeAllListeners('backup-progress');
        
        // Add the event listener with our wrapper
        ipcRenderer.on('backup-progress', wrappedCallback);
        
        // Return a cleanup function that properly removes the specific listener
        return () => {
            console.log('Removing progress event listener');
            ipcRenderer.removeListener('backup-progress', wrappedCallback);
        };
    }
});
