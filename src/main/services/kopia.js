const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const execFileAsync = promisify(execFile);
const { handleKopiaError } = require('../utils/kopia-errors');
const ProgressService = require('./kopia/progress');
const RepositoryService = require('./kopia/repository');
const BackupService = require('./kopia/backup');

class KopiaService {
    constructor() {
        const APP_ROOT = path.join(__dirname, '../../..');
        this.kopiaPath = path.join(APP_ROOT, 'bin', 'kopia.exe');
        this.progressService = new ProgressService();
        this.repositoryService = new RepositoryService(this.kopiaPath);
        this.backupService = new BackupService(this.kopiaPath, this.progressService);
        console.log('Kopia service initialized with path:', this.kopiaPath);
    }

    // Repository methods delegated to repository service
    async createRepository() {
        return this.repositoryService.createRepository();
    }

    async connectRepository() {
        return this.repositoryService.connectRepository();
    }

    async disconnectRepository() {
        return this.repositoryService.disconnectRepository();
    }

    async getRepositoryStatus() {
        return this.repositoryService.getRepositoryStatus();
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

    async getDirectoryStats(path) {
        try {
            console.log(`Getting stats for directory: ${path}`);
            // Get the latest snapshot for this path
            const { stdout: snapshotOutput } = await execFileAsync(this.kopiaPath, [
                'snapshot', 
                'list', 
                '--json',
                path
            ]);
            
            const snapshots = JSON.parse(snapshotOutput);
            if (snapshots.length === 0) {
                return {
                    success: true,
                    stats: {
                        totalFiles: 0,
                        totalSize: 0,
                        lastBackup: null
                    }
                };
            }

            // Get the most recent snapshot
            const latestSnapshot = snapshots[snapshots.length - 1];
            
            return {
                success: true,
                stats: {
                    totalFiles: (latestSnapshot.stats.fileCount || 0) + (latestSnapshot.stats.cachedFiles || 0),
                    totalSize: latestSnapshot.stats.totalSize || 0,
                    lastBackup: latestSnapshot.startTime
                }
            };
        } catch (error) {
            console.error('Failed to get directory stats:', error);
            return { success: false, error: error.message };
        }
    }

    async getSnapshots() {
        try {
            console.log('Getting snapshots...');
            const { stdout } = await execFileAsync(this.kopiaPath, ['snapshot', 'list', '--json']);
            console.log('Raw snapshot output:', stdout);
            const snapshots = JSON.parse(stdout);
            console.log('Parsed snapshots:', snapshots);

            // Format snapshots for UI
            const formattedSnapshots = snapshots.map(snapshot => ({
                id: snapshot.id,
                startTime: snapshot.startTime,
                endTime: snapshot.endTime,
                source: snapshot.source,
                stats: {
                    totalSize: snapshot.stats.totalSize,
                    totalFiles: (snapshot.stats.fileCount || 0) + (snapshot.stats.cachedFiles || 0),
                    dirCount: snapshot.stats.dirCount || 0
                }
            }));

            return { success: true, snapshots: formattedSnapshots };
        } catch (error) {
            console.error('Failed to get snapshots:', error);
            return { success: false, error: error.message };
        }
    }

    async browseSnapshot(snapshotId, path = '') {
        try {
            console.log(`Browsing snapshot ${snapshotId} path: ${path}`);
            const args = ['snapshot', 'ls', '--json'];
            
            // Construct the path argument
            const pathArg = path ? `${snapshotId}:/${path}` : `${snapshotId}:/`;
            args.push(pathArg);
            
            console.log('Browse command:', this.kopiaPath, args);
            const { stdout } = await execFileAsync(this.kopiaPath, args);
            console.log('Raw browse output:', stdout);
            const entries = JSON.parse(stdout);
            console.log('Parsed entries:', entries);

            // Format entries for UI
            const formattedContents = entries.map(entry => ({
                name: entry.name,
                path: path ? `${path}/${entry.name}` : entry.name,
                size: entry.size || 0,
                modified: entry.mtime || new Date().toISOString(),
                type: entry.type === 'd' ? 'dir' : 'file'
            }));

            return { success: true, contents: formattedContents };
        } catch (error) {
            console.error('Failed to browse snapshot:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteBackup(path) {
        try {
            console.log(`Deleting backup for path: ${path}`);
            // Get snapshots for the path
            const { stdout } = await execFileAsync(this.kopiaPath, ['snapshot', 'list', '--json', path]);
            const snapshots = JSON.parse(stdout);
            
            // Delete each snapshot for the path
            for (const snapshot of snapshots) {
                // Delete the snapshot using snapshot delete command
                await execFileAsync(this.kopiaPath, ['snapshot', 'delete', snapshot.id, '--delete']);
                console.log(`Deleted snapshot ${snapshot.id}`);
            }
            
            // Run full maintenance to clean up repository
            await execFileAsync(this.kopiaPath, ['maintenance', 'run', '--full', '--safety=none']);
            console.log('Repository maintenance completed');
            
            return { success: true, message: 'Backup deleted successfully' };
        } catch (error) {
            console.error('Failed to delete backup:', error);
            return { success: false, error: error.message };
        }
    }

    async restoreBackup(path, targetPath) {
        try {
            console.log(`Restoring backup for path: ${path} to ${targetPath}`);
            // Get the latest snapshot for this path
            const { stdout } = await execFileAsync(this.kopiaPath, ['snapshot', 'list', '--json', path]);
            const snapshots = JSON.parse(stdout);
            
            if (snapshots.length === 0) {
                throw new Error('No backup found for this path');
            }
            
            // Get the most recent snapshot
            const latestSnapshot = snapshots[snapshots.length - 1];
            
            // Restore the snapshot to the target path
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
