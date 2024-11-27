import { UIComponents } from '../components/ui-components.js';

export class UIStateManager {
    constructor(elements) {
        this.elements = elements;
        this.selectedPaths = new Set();
        this.pathStats = new Map();
        this.deletingPaths = new Set(); // Track which paths are being deleted
    }

    async addPath(path) {
        try {
            this.selectedPaths.add(path);
            await this.updatePathStats();
            this.updateUI();
        } catch (error) {
            console.error('UIStateManager: Error adding path:', error);
            UIComponents.showStatus('backup-status', `Error adding path: ${error.message}`, 'error');
        }
    }

    async addDirectory(onBackupConfirmed) {
        try {
            const paths = await window.electron.selectPaths();
            if (paths?.length > 0) {
                const folderNames = paths.map(p => p.split(/[\\/]/).pop()).join('", "');
                const confirmed = confirm(`Do you want to backup "${folderNames}" now?`);
                
                for (const path of paths) {
                    this.selectedPaths.add(path);
                    await window.electron.addBackupPath(path);
                }
                await this.updatePathStats();
                this.updateUI();
                UIComponents.showStatus('backup-status', 'Directory added successfully', 'success');

                if (confirmed && onBackupConfirmed) {
                    await onBackupConfirmed();
                }
            }
        } catch (error) {
            UIComponents.showStatus('backup-status', `Error adding directory: ${error.message}`, 'error');
        }
    }

    async updatePathStats() {
        for (const path of this.selectedPaths) {
            try {
                const stats = await window.electron.getDirectoryStats(path);
                this.pathStats.set(path, stats || { totalFiles: 0, totalSize: 0 });
            } catch (error) {
                this.pathStats.set(path, { totalFiles: 0, totalSize: 0 });
            }
        }
    }

    updateSelectedPathsUI(backupInProgress, currentProgress) {
        if (!this.elements.selectedPathsList || !this.elements.backupButton) {
            return;
        }

        const count = this.selectedPaths.size;
        this.elements.backupButton.disabled = count === 0;

        this.elements.selectedPathsList.innerHTML = '';

        if (count > 0) {
            const list = document.createElement('div');
            list.className = 'space-y-2 p-4';

            Array.from(this.selectedPaths).forEach(path => {
                const item = UIComponents.createPathItem(path, async (pathToRemove) => {
                    this.selectedPaths.delete(pathToRemove);
                    await window.electron.removeBackupPath(pathToRemove);
                    this.updateSelectedPathsUI(backupInProgress, currentProgress);
                    this.updateUI();
                }, backupInProgress, currentProgress);
                list.appendChild(item);
            });

            this.elements.selectedPathsList.appendChild(list);
        } else {
            this.elements.selectedPathsList.innerHTML = `
                <div class="flex items-center justify-center py-12 text-gray-600">
                    <i class="fas fa-info-circle text-primary mr-2 text-lg"></i>
                    <span class="text-lg">No files or folders selected</span>
                </div>
            `;
        }
    }

    updateBackupStats(stats) {
        const { totalSize, totalFiles, lastBackupTime } = stats;

        const totalSizeElement = document.getElementById('total-size');
        const totalFilesElement = document.getElementById('total-files');
        const lastBackupElement = document.getElementById('last-backup-time');

        if (totalSizeElement) {
            totalSizeElement.textContent = UIComponents.formatBytes(totalSize);
        }
        if (totalFilesElement) {
            totalFilesElement.textContent = (totalFiles || 0).toLocaleString();
        }
        if (lastBackupElement) {
            lastBackupElement.textContent = lastBackupTime ? 
                `Last backup: ${UIComponents.formatDate(lastBackupTime)}` : 
                'No backups yet';
        }
    }

    setPathDeleting(path, isDeleting) {
        if (isDeleting) {
            this.deletingPaths.add(path);
        } else {
            this.deletingPaths.delete(path);
        }
        this.updateDeleteButton(path);
    }

    updateDeleteButton(path) {
        const row = document.getElementById(`backup-row-${path.replace(/[^a-zA-Z0-9]/g, '-')}`);
        if (!row) return;

        const deleteButton = row.querySelector('button:last-child');
        if (!deleteButton) return;

        if (this.deletingPaths.has(path)) {
            deleteButton.disabled = true;
            deleteButton.className = 'inline-flex items-center px-4 py-2 bg-gray-400 text-white rounded-lg shadow-sm font-medium cursor-not-allowed';
            deleteButton.innerHTML = `
                <i class="fas fa-spinner fa-spin mr-2"></i>
                Deleting...
            `;
        }
    }

    updateBackupsTable(snapshotData, onRestore, onDelete) {
        const tbody = this.elements.yourBackupsTable;
        if (!tbody) return;

        tbody.innerHTML = '';

        const allPaths = new Set([...snapshotData.keys()]);
        if (allPaths.size === 0) return;

        const pathsArray = Array.from(allPaths).map(directoryPath => {
            const snapshotInfo = snapshotData.get(directoryPath);
            const stats = {
                totalFiles: snapshotInfo?.stats?.totalFiles || 0,
                totalSize: snapshotInfo?.stats?.totalSize || 0,
                lastBackup: snapshotInfo?.startTime || null
            };

            return { directoryPath, stats };
        });

        pathsArray.sort((a, b) => {
            if (!a.stats.lastBackup && !b.stats.lastBackup) return 0;
            if (!a.stats.lastBackup) return 1;
            if (!b.stats.lastBackup) return -1;
            return new Date(b.stats.lastBackup) - new Date(a.stats.lastBackup);
        });

        pathsArray.forEach(({ directoryPath, stats }) => {
            const displayPath = directoryPath.split('\\').join('/');
            const hasBackup = snapshotData.has(directoryPath);
            const isDeleting = this.deletingPaths.has(displayPath);

            let actionButtons = '';
            if (hasBackup) {
                // Use window.backupManager for the event handlers
                const restoreButton = `<button class="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors duration-200 shadow-sm hover:shadow-md font-medium mr-2" onclick="window.backupManager.restoreBackup('${displayPath.replace(/'/g, "\\'")}')">
                    <i class="fas fa-undo-alt mr-2"></i>Restore
                </button>`;

                const deleteButton = isDeleting ?
                    `<button disabled class="inline-flex items-center px-4 py-2 bg-gray-400 text-white rounded-lg shadow-sm font-medium cursor-not-allowed">
                        <i class="fas fa-spinner fa-spin mr-2"></i>Deleting...
                    </button>` :
                    `<button class="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 shadow-sm hover:shadow-md font-medium" onclick="window.backupManager.deleteBackup('${displayPath.replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash-alt mr-2"></i>Delete
                    </button>`;

                actionButtons = restoreButton + deleteButton;
            }

            const row = UIComponents.createTableRow([
                `<div class="flex items-center">
                    <i class="fas fa-folder text-primary mr-2"></i>
                    <span title="${displayPath}">${displayPath}</span>
                </div>`,
                (stats.totalFiles || 0).toLocaleString(),
                UIComponents.formatBytes(stats.totalSize || 0),
                UIComponents.formatDate(stats.lastBackup),
                actionButtons
            ]);

            row.id = `backup-row-${directoryPath.replace(/[^a-zA-Z0-9]/g, '-')}`;
            tbody.appendChild(row);
        });
    }

    updateUI() {
        const backupInProgress = false; // This will be updated by the backup manager
        const currentProgress = null; // This will be updated by the progress manager
        this.updateSelectedPathsUI(backupInProgress, currentProgress);
    }

    getSelectedPaths() {
        return Array.from(this.selectedPaths);
    }

    async clearSelectedPaths() {
        // Clear paths from storage
        for (const path of this.selectedPaths) {
            await window.electron.removeBackupPath(path);
        }
        // Clear paths from memory
        this.selectedPaths.clear();
        this.pathStats.clear();
        // Update UI to show no paths selected
        if (this.elements.selectedPathsList) {
            this.elements.selectedPathsList.innerHTML = `
                <div class="flex items-center justify-center py-12 text-gray-600">
                    <i class="fas fa-info-circle text-primary mr-2 text-lg"></i>
                    <span class="text-lg">No files or folders selected</span>
                </div>
            `;
        }
        // Disable backup button
        if (this.elements.backupButton) {
            this.elements.backupButton.disabled = true;
        }
    }
}
