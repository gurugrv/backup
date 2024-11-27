import { UIComponents } from '../components/ui-components.js';

export class SnapshotOperations {
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
            }
            return false;
        } catch (error) {
            UIComponents.showStatus('backup-status', `Error loading backup data: ${error.message}`, 'error');
            return false;
        }
    }

    processSnapshotData(snapshots) {
        this.snapshotData.clear();
        
        snapshots.forEach(snapshot => {
            if (!snapshot.source?.path) return;

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

    async deleteBackup(path) {
        try {
            const folderName = path.split(/[\\/]/).pop();
            const confirmed = confirm(`Are you sure you want to delete the backup for "${folderName}"?\nPath: ${path}\n\nThis will permanently delete all backup files from the repository.`);
            if (!confirmed) return false;

            const rowId = `backup-row-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;
            const row = document.getElementById(rowId);
            const deleteButton = row?.querySelector('button:last-child');
            
            if (deleteButton) {
                deleteButton.disabled = true;
                deleteButton.classList.remove('bg-red-600', 'hover:bg-red-700');
                deleteButton.classList.add('bg-gray-400');
                deleteButton.innerHTML = `
                    <i class="fas fa-spinner fa-spin mr-2"></i>Deleting...
                `;
            }

            this.deletingPaths.add(path);
            await window.electron.deleteBackup(path);
            this.deletingPaths.delete(path);
            await this.refreshSnapshots();
            
            UIComponents.showStatus('backup-status', 'Backup and associated files deleted successfully', 'success');
            return true;
        } catch (error) {
            this.deletingPaths.delete(path);
            await this.refreshSnapshots();
            UIComponents.showStatus('backup-status', `Error deleting backup: ${error.message}`, 'error');
            return false;
        }
    }

    async restoreBackup(path) {
        try {
            const folderName = path.split(/[\\/]/).pop();
            const confirmed = confirm(`Are you sure you want to restore the backup for "${folderName}"?\nPath: ${path}`);
            if (!confirmed) return false;

            UIComponents.showStatus('backup-status', 'Starting restore...', 'info');

            const targetPath = await window.electron.selectRestoreDirectory();
            if (!targetPath) return false;

            const result = await window.electron.restoreBackup(path, targetPath);
            
            if (result.success) {
                UIComponents.showStatus('backup-status', 'Backup restored successfully', 'success');
                return true;
            } else {
                throw new Error(result.error || 'Unknown error occurred during restore');
            }
        } catch (error) {
            UIComponents.showStatus('backup-status', `Error restoring backup: ${error.message}`, 'error');
            return false;
        }
    }

    getSnapshotData() {
        return this.snapshotData;
    }

    isDeleting(path) {
        return this.deletingPaths.has(path);
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
