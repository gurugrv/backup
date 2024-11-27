const path = require('path');
const RepositoryService = require('./repository');
const BackupService = require('./backup');
const SnapshotService = require('./snapshot');
const RestoreService = require('./restore');
const ProgressService = require('./progress');

class KopiaService {
    constructor() {
        const APP_ROOT = path.join(__dirname, '../../..');
        this.kopiaPath = path.join(APP_ROOT, 'bin', 'kopia.exe');
        console.log('Kopia service initialized with path:', this.kopiaPath);

        // Initialize all services
        this.progressService = new ProgressService();
        this.repositoryService = new RepositoryService(this.kopiaPath);
        this.backupService = new BackupService(this.kopiaPath, this.progressService);
        this.snapshotService = new SnapshotService(this.kopiaPath);
        this.restoreService = new RestoreService(this.kopiaPath);
    }

    // Repository operations
    createRepository() {
        return this.repositoryService.createRepository();
    }

    connectRepository() {
        return this.repositoryService.connectRepository();
    }

    disconnectRepository() {
        return this.repositoryService.disconnectRepository();
    }

    getRepositoryStatus() {
        return this.repositoryService.getRepositoryStatus();
    }

    // Backup operations
    startBackup(paths) {
        return this.backupService.startBackup(paths);
    }

    cancelBackup(paths) {
        return this.backupService.cancelBackup(paths);
    }

    getBackupStatus(paths) {
        return this.backupService.getBackupStatus(paths);
    }

    // Snapshot operations
    getSnapshots() {
        return this.snapshotService.getSnapshots();
    }

    browseSnapshot(snapshotId, path) {
        return this.snapshotService.browseSnapshot(snapshotId, path);
    }

    deleteBackup(path) {
        return this.snapshotService.deleteBackup(path);
    }

    getDirectoryStats(path) {
        return this.snapshotService.getDirectoryStats(path);
    }

    // Restore operations
    restoreBackup(path, targetPath) {
        return this.restoreService.restoreBackup(path, targetPath);
    }

    restoreSnapshot(snapshotId, targetPath) {
        return this.restoreService.restoreSnapshot(snapshotId, targetPath);
    }
}

// Export a singleton instance
module.exports = new KopiaService();
