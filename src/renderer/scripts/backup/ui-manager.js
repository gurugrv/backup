import { UIComponents } from '../components/ui-components.js';

export class UIStateManager {
    constructor() {
        this.elements = {};
    }

    initializeElements() {
        this.elements = {
            statusArea: document.getElementById('backup-status'),
            addButton: document.getElementById('select-paths'),
            backupButton: document.getElementById('start-backup'),
            yourBackupsTable: document.getElementById('your-backups-body'),
            selectedPathsList: document.getElementById('selected-paths'),
            backupProgress: document.getElementById('backup-progress'),
            backupProgressBar: document.querySelector('#backup-progress .progress-bar-fill'),
            backupProgressText: document.querySelector('#backup-progress p')
        };

        if (this.elements.backupButton) {
            this.elements.backupButton.disabled = true;
        }

        if (this.elements.backupProgress) {
            this.elements.backupProgress.classList.add('hidden');
            if (this.elements.backupProgressBar) {
                this.elements.backupProgressBar.style.width = '0%';
            }
            if (this.elements.backupProgressText) {
                this.elements.backupProgressText.textContent = 'Preparing backup...';
            }
        }
    }

    setupEventListeners(onAddDirectory, onStartBackup) {
        if (this.elements.addButton) {
            this.elements.addButton.addEventListener('click', onAddDirectory);
        }
        if (this.elements.backupButton) {
            this.elements.backupButton.addEventListener('click', onStartBackup);
        }
    }

    updateSelectedPathsUI(selectedPaths, onRemovePath, isBackupInProgress, currentProgress) {
        if (!this.elements.selectedPathsList || !this.elements.backupButton) {
            return;
        }

        const count = selectedPaths.size;
        this.elements.backupButton.disabled = count === 0;
        this.elements.selectedPathsList.innerHTML = '';

        if (count > 0) {
            const list = document.createElement('div');
            list.className = 'space-y-2 p-4';

            Array.from(selectedPaths).forEach(path => {
                const item = UIComponents.createPathItem(
                    path,
                    onRemovePath,
                    isBackupInProgress,
                    isBackupInProgress ? currentProgress : null
                );
                list.appendChild(item);
            });

            this.elements.selectedPathsList.appendChild(list);
        }

        this.updateBackupProgress(isBackupInProgress, currentProgress);
    }

    updateBackupProgress(isBackupInProgress, progress) {
        if (!this.elements.backupProgress) return;

        if (isBackupInProgress && progress) {
            this.elements.backupProgress.classList.remove('hidden');
            
            if (this.elements.backupProgressBar) {
                this.elements.backupProgressBar.style.width = `${progress.percentage}%`;
            }
            
            if (this.elements.backupProgressText) {
                this.elements.backupProgressText.textContent = 
                    `uploaded ${progress.uploaded}, estimated ${progress.estimated} (${progress.percentage.toFixed(1)}%)`;
            }
        } else {
            this.elements.backupProgress.classList.add('hidden');
            if (this.elements.backupProgressBar) {
                this.elements.backupProgressBar.style.width = '0%';
            }
            if (this.elements.backupProgressText) {
                this.elements.backupProgressText.textContent = 'Preparing backup...';
            }
        }
    }

    updateBackupButton(isBackupInProgress, onStartBackup, onCancelBackup) {
        if (!this.elements.backupButton) return;

        if (isBackupInProgress) {
            this.elements.backupButton.innerHTML = '<i class="fas fa-times mr-2"></i>Cancel Backup';
            this.elements.backupButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            this.elements.backupButton.classList.add('bg-red-600', 'hover:bg-red-700');
            this.elements.backupButton.onclick = onCancelBackup;
        } else {
            this.elements.backupButton.innerHTML = '<i class="fas fa-play mr-2"></i>Start Backup';
            this.elements.backupButton.classList.remove('bg-red-600', 'hover:bg-red-700');
            this.elements.backupButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
            this.elements.backupButton.onclick = onStartBackup;
        }
        this.elements.backupButton.disabled = false;
    }

    updateBackupStats(stats) {
        const totalSizeElement = document.getElementById('total-size');
        const totalFilesElement = document.getElementById('total-files');
        const lastBackupElement = document.getElementById('last-backup-time');

        if (totalSizeElement) {
            totalSizeElement.textContent = UIComponents.formatBytes(stats.totalSize);
        }
        if (totalFilesElement) {
            totalFilesElement.textContent = (stats.totalFiles || 0).toLocaleString();
        }
        if (lastBackupElement) {
            lastBackupElement.textContent = stats.lastBackupTime ? 
                `Last backup: ${UIComponents.formatDate(stats.lastBackupTime)}` : 
                'No backups yet';
        }
    }

    updateBackupsTable(pathsArray, snapshotManager, onRestoreBackup, onDeleteBackup) {
        const tbody = this.elements.yourBackupsTable;
        if (!tbody) return;

        tbody.innerHTML = '';

        pathsArray.forEach(({ directoryPath, stats }) => {
            const row = document.createElement('tr');
            row.id = `backup-row-${directoryPath.replace(/[^a-zA-Z0-9]/g, '-')}`;
            const displayPath = directoryPath.split('\\').join('/');
            
            const hasBackup = snapshotManager.hasSnapshot(directoryPath);
            const isDeleting = snapshotManager.isDeleting(directoryPath);
            
            let deleteButton;
            if (isDeleting) {
                deleteButton = `
                    <button class="inline-flex items-center px-3 py-1.5 bg-gray-400 text-white rounded" disabled>
                        <i class="fas fa-spinner fa-spin mr-1.5"></i>
                        <span>Deleting...</span>
                    </button>`;
            } else {
                deleteButton = `
                    <button class="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors" onclick="window.backupManager.deleteBackup('${displayPath}')">
                        <i class="fas fa-trash mr-1.5"></i>
                        <span>Delete</span>
                    </button>`;
            }

            const actionButtons = hasBackup ? `
                <div class="flex items-center justify-end gap-2">
                    <button class="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors" onclick="window.backupManager.restoreBackup('${displayPath}')">
                        <i class="fas fa-undo mr-1.5"></i>
                        <span>Restore</span>
                    </button>
                    ${deleteButton}
                </div>
            ` : '';

            row.innerHTML = `
                <td title="${displayPath}">${displayPath}</td>
                <td>${(stats.totalFiles || 0).toLocaleString()}</td>
                <td>${UIComponents.formatBytes(stats.totalSize || 0)}</td>
                <td>${UIComponents.formatDate(stats.lastBackup)}</td>
                <td>${actionButtons}</td>
            `;
            tbody.appendChild(row);
        });
    }

    showStatus(message, type = 'info') {
        UIComponents.showStatus('backup-status', message, type);
    }
}
