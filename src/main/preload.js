const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    // File selection
    selectPaths: () => ipcRenderer.invoke('select-paths'),
    selectRestoreDirectory: () => ipcRenderer.invoke('select-restore-directory'),

    // Backup operations
    startBackup: (paths) => ipcRenderer.invoke('start-backup', paths),
    resumeBackup: (paths) => ipcRenderer.invoke('resume-backup', paths),
    cancelBackup: (paths) => ipcRenderer.invoke('cancel-backup', paths),
    getBackupStatus: (paths) => ipcRenderer.invoke('get-backup-status', paths),
    getDirectoryStats: (path) => ipcRenderer.invoke('get-directory-stats', path),
    
    // Repository operations
    reconnectRepository: () => ipcRenderer.invoke('reconnect-repository'),

    // Backup path management
    getBackupPaths: () => ipcRenderer.invoke('get-backup-paths'),
    addBackupPath: (path) => ipcRenderer.invoke('add-backup-path', path),
    removeBackupPath: (path) => ipcRenderer.invoke('remove-backup-path', path),
    deleteBackup: (path) => ipcRenderer.invoke('delete-backup', path),
    restoreBackup: (path, targetPath) => ipcRenderer.invoke('restore-backup', path, targetPath),

    // Snapshot operations
    getSnapshots: () => ipcRenderer.invoke('get-snapshots'),
    browseSnapshot: (snapshotId, path) => ipcRenderer.invoke('browse-snapshot', snapshotId, path),
    restoreSnapshot: (snapshotId, targetPath) => ipcRenderer.invoke('restore-snapshot', snapshotId, targetPath),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // Logs
    getLogs: () => ipcRenderer.invoke('get-logs'),

    // Schedule
    scheduleBackup: (schedule) => ipcRenderer.invoke('schedule-backup', schedule),
    getSchedule: () => ipcRenderer.invoke('get-schedule'),

    // Progress events
    onBackupProgress: (callback) => {
        const subscription = (event, data) => callback(data);
        ipcRenderer.on('backup-progress', subscription);
        return () => {
            ipcRenderer.removeListener('backup-progress', subscription);
        };
    }
});
