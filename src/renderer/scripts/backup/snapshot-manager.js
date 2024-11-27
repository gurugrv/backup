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
                this.snapshotData.set(sourcePath, {
                    startTime: snapshot.startTime,
                    stats: snapshot.stats || { totalFiles: 0, totalSize: 0 },
                    path: sourcePath
                });
            }
        });
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
            await window.electron.deleteBackup(path);
            this.deletingPaths.delete(path);
            await this.refreshSnapshots();
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

        this.snapshotData.forEach(snapshot => {
            if (snapshot && snapshot.stats) {
                totalSize += snapshot.stats.totalSize || 0;
                totalFiles += snapshot.stats.totalFiles || 0;
                
                const snapshotTime = new Date(snapshot.startTime);
                if (!lastBackupTime || snapshotTime > lastBackupTime) {
                    lastBackupTime = snapshotTime;
                }
            }
        });

        return {
            totalSize,
            totalFiles,
            lastBackupTime
        };
    }
}
