const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { handleKopiaError } = require('../utils/kopia-errors');
const ProgressService = require('./kopia/progress');
const RepositoryService = require('./kopia/repository');
const BackupService = require('./kopia/backup');
const SnapshotService = require('./kopia/snapshot');
const { KOPIA_PATH } = require('../utils/paths');

class KopiaService {
    constructor() {
        this.kopiaPath = KOPIA_PATH;
        this.progressService = new ProgressService();
        this.repositoryService = new RepositoryService(this.kopiaPath);
        this.backupService = new BackupService(this.kopiaPath, this.progressService, this.repositoryService);
        this.snapshotService = new SnapshotService(this.kopiaPath, this.repositoryService);
        console.log('Kopia service initialized with path:', this.kopiaPath);
    }

    // Repository methods delegated to repository service
    async createRepository() {
        try {
            const result = await this.repositoryService.createRepository();
            if (!result) {
                throw new Error('Failed to create repository');
            }
            return result;
        } catch (error) {
            console.error('Error in createRepository:', error);
            throw handleKopiaError(error);
        }
    }

    async connectRepository() {
        try {
            const result = await this.repositoryService.connectRepository();
            if (!result) {
                throw new Error('Failed to connect to repository');
            }
            return result;
        } catch (error) {
            console.error('Error in connectRepository:', error);
            throw handleKopiaError(error);
        }
    }

    async disconnectRepository() {
        try {
            const result = await this.repositoryService.disconnectRepository();
            if (!result.success) {
                throw new Error(result.error || 'Failed to disconnect repository');
            }
            return result;
        } catch (error) {
            console.error('Error in disconnectRepository:', error);
            throw handleKopiaError(error);
        }
    }

    async getRepositoryStatus() {
        try {
            const result = await this.repositoryService.getRepositoryStatus();
            if (!result.success) {
                throw new Error(result.error || 'Failed to get repository status');
            }
            return result;
        } catch (error) {
            console.error('Error in getRepositoryStatus:', error);
            throw handleKopiaError(error);
        }
    }

    // Delegate backup operations to BackupService
    async startBackup(paths) {
        return this.backupService.startBackup(paths);
    }

    async cancelBackup(paths) {
        return this.backupService.cancelBackup(paths);
    }

    async getBackupStatus(paths) {
        return this.backupService.getBackupStatus(paths);
    }

    async runMaintenance() {
        try {
            console.log('Starting repository maintenance...');
            await this.repositoryService.ensureConnected();

            // Run full maintenance
            await execFileAsync(this.kopiaPath, ['maintenance', 'run', '--full']);
            console.log('Full maintenance completed');

            return {
                success: true,
                message: 'Repository maintenance completed successfully'
            };
        } catch (error) {
            console.error('Failed to maintain repository:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getDirectoryStats(path) {
        return this.snapshotService.getDirectoryStats(path);
    }

    async getSnapshots() {
        return this.snapshotService.getSnapshots();
    }

    async browseSnapshot(snapshotId, path = '') {
        return this.snapshotService.browseSnapshot(snapshotId, path);
    }

    async deleteBackup(path) {
        return this.snapshotService.deleteBackup(path);
    }

    async restoreBackup(path, targetPath) {
        try {
            console.log(`Restoring backup for path: ${path} to ${targetPath}`);
            await this.repositoryService.ensureConnected();
            
            const { stdout } = await execFileAsync(this.kopiaPath, ['snapshot', 'list', '--json', path]);
            const snapshots = JSON.parse(stdout);
            
            if (snapshots.length === 0) {
                throw new Error('No backup found for this path');
            }
            
            const latestSnapshot = snapshots[snapshots.length - 1];
            await execFileAsync(this.kopiaPath, ['snapshot', 'restore', latestSnapshot.id, targetPath]);
            
            return { success: true, message: 'Backup restored successfully' };
        } catch (error) {
            console.error('Failed to restore backup:', error);
            return { success: false, error: error.message };
        }
    }

    async restoreSnapshot(snapshotId, targetPath) {
        try {
            console.log(`Restoring snapshot ${snapshotId} to ${targetPath}`);
            await this.repositoryService.ensureConnected();
            
            await execFileAsync(this.kopiaPath, [
                'snapshot', 
                'restore', 
                snapshotId, 
                targetPath
            ]);
            console.log('Restore completed successfully');
            return { success: true };
        } catch (error) {
            console.error('Failed to restore snapshot:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new KopiaService();
