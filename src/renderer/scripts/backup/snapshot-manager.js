import { UIComponents } from '../components/ui-components.js';

export class SnapshotManager {
    constructor() {
        this.snapshotData = new Map();
        this.deletingPaths = new Set();
    }

    async refreshSnapshots() {
        try {
            const result = await window.electron.getSnapshots();
            if (result.success) {
                console.log('Received snapshots from server:', result.snapshots);
                this.processSnapshotData(result.snapshots);
                return true;
            } else {
                console.error('Failed to load recent backups:', result.error);
                return false;
            }
        } catch (error) {
            console.error('Error loading recent backups:', error);
            throw error;
        }
    }

    processSnapshotData(snapshots) {
        this.snapshotData.clear();
        
        snapshots.forEach(snapshot => {
            if (!snapshot.source?.path) {
                console.warn('Snapshot missing source path:', snapshot);
                return;
            }

            const sourcePath = snapshot.source.path;
            const existingSnapshot = this.snapshotData.get(sourcePath);
            
            if (!existingSnapshot || new Date(snapshot.startTime) > new Date(existingSnapshot.startTime)) {
                console.log(`Processing snapshot for ${sourcePath}:`, snapshot);
                
                // Map the stats directly from the snapshot
                const stats = {
                    totalFiles: snapshot.stats?.totalFiles || 0, // This comes from the backend already calculated
                    totalSize: snapshot.stats?.totalSize || 0,
                    dirCount: snapshot.stats?.dirCount || 0
                };

                console.log(`Mapped stats for ${sourcePath}:`, stats);

                this.snapshotData.set(sourcePath, {
                    startTime: snapshot.startTime,
                    stats: stats,
                    path: sourcePath
                });
            }
        });

        console.log('Final processed snapshot data:', Array.from(this.snapshotData.entries()));
    }

    getSnapshotInfo(path) {
        return this.snapshotData.get(path);
    }

    hasSnapshot(path) {
        return this.snapshotData.has(path);
    }

    getAllSnapshotPaths() {
        return Array.from(this.snapshotData.keys());
    }

    isDeleting(path) {
        return this.deletingPaths.has(path);
    }

    async deleteSnapshot(path) {
        try {
            this.deletingPaths.add(path);
            
            // Delete the backup from repository
            const result = await window.electron.deleteBackup(path);
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to delete backup');
            }
            
            // Remove the path from backup paths list
            await window.electron.removeBackupPath(path);
            
            // Get fresh snapshot data after deletion
            await this.refreshSnapshots();
            
            // Remove from deleting paths set
            this.deletingPaths.delete(path);
            
            // Dispatch event to notify backup manager to update UI
            window.dispatchEvent(new CustomEvent('remove-path', { detail: path }));
            
            return true;
        } catch (error) {
            console.error('Error deleting backup:', error);
            this.deletingPaths.delete(path);
            throw error;
        }
    }

    async restoreSnapshot(path) {
        try {
            const targetPath = await window.electron.selectRestoreDirectory();
            if (!targetPath) return false;

            const result = await window.electron.restoreBackup(path, targetPath);
            return result.success;
        } catch (error) {
            console.error('Error restoring backup:', error);
            throw error;
        }
    }

    getBackupStats() {
        let totalSize = 0;
        let totalFiles = 0;
        let lastBackupTime = null;

        console.log('Starting backup stats calculation...');

        this.snapshotData.forEach((snapshot, path) => {
            if (snapshot && snapshot.stats) {
                console.log(`Processing stats for ${path}:`, snapshot.stats);
                
                // Add the stats from each snapshot
                totalFiles += snapshot.stats.totalFiles || 0;
                totalSize += snapshot.stats.totalSize || 0;

                console.log(`Running totals - Files: ${totalFiles}, Size: ${totalSize}`);
                
                const snapshotTime = new Date(snapshot.startTime);
                if (!lastBackupTime || snapshotTime > lastBackupTime) {
                    lastBackupTime = snapshotTime;
                }
            }
        });

        const stats = {
            totalSize,
            totalFiles,
            lastBackupTime
        };

        console.log('Final calculated backup stats:', stats);
        return stats;
    }
}
