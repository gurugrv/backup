import { UIComponents } from '../components/ui-components.js';

export class BackupOperations {
    constructor() {
        this.activeBackups = new Map(); // Track active backups by individual path
        this.progressUnsubscribers = new Map(); // Track progress listeners
        this.progressStates = new Map(); // Track progress state for each backup
        this.globalProgressListener = null;
        this.setupGlobalProgressListener();
    }

    isBackupInProgress(path) {
        return this.activeBackups.has(path);
    }

    getBackupKey(path) {
        return path;
    }

    setupGlobalProgressListener() {
        if (this.globalProgressListener) {
            this.globalProgressListener();
        }

        this.globalProgressListener = window.electron.onBackupProgress((progress) => {
            if (!progress || !progress.paths) return;

            // Update all paths mentioned in this progress update
            progress.paths.forEach(path => {
                if (this.isBackupInProgress(path)) {
                    // Store progress state
                    this.progressStates.set(this.getBackupKey(path), progress);
                    // Update UI
                    this.updatePathItemUI(path);
                }
            });
        });
    }

    async startBackup(path) {
        console.log('BackupOperations: Starting backup for path:', path);
        const backupKey = this.getBackupKey(path);
        
        try {
            // Mark this backup as active and initialize its progress state
            this.activeBackups.set(backupKey, true);
            this.progressStates.set(backupKey, {
                phase: 'initializing',
                percentage: 0,
                estimating: true
            });

            // Update UI to show backup starting
            this.updatePathItemUI(path);

            console.log('BackupOperations: Initiating backup with electron');
            const result = await window.electron.startBackup([path]); // Pass as array for backend compatibility
            console.log('BackupOperations: Backup result:', result);

            // Ensure cleanup happens after backup completes
            this.cleanup(path);
            return result;
        } catch (error) {
            console.error('BackupOperations: Error during backup:', error);
            this.cleanup(path);
            throw error;
        }
    }

    async cancelBackup(path) {
        console.log('BackupOperations: Cancelling backup for path:', path);
        try {
            const result = await window.electron.cancelBackup([path]); // Pass as array for backend compatibility
            if (result.success) {
                this.cleanup(path);
            }
            return result;
        } catch (error) {
            console.error('BackupOperations: Error cancelling backup:', error);
            throw error;
        }
    }

    updatePathItemUI(path) {
        const pathItem = document.getElementById(`path-item-${path.replace(/[^a-zA-Z0-9]/g, '-')}`);
        if (!pathItem) return;

        const isBackupInProgress = this.isBackupInProgress(path);
        const progress = this.progressStates.get(this.getBackupKey(path));

        const actionButton = pathItem.querySelector('.backup-action');
        if (actionButton) {
            if (isBackupInProgress) {
                actionButton.className = 'backup-action p-2 text-primary flex items-center gap-2';
                actionButton.innerHTML = `
                    <i class="fas fa-spinner fa-spin"></i>
                    ${progress?.estimating ? 
                        '<span class="text-sm font-medium">Estimating...</span>' :
                        `<span class="text-sm font-medium progress-percentage">${progress?.percentage?.toFixed(1) || 0}%</span>`
                    }
                `;
                actionButton.disabled = true;
                actionButton.title = 'Backup in progress';

                // Add cancel button if it doesn't exist
                if (!pathItem.querySelector('.cancel-backup')) {
                    const actions = pathItem.querySelector('.actions');
                    if (actions) {
                        const cancelBtn = document.createElement('button');
                        cancelBtn.className = 'cancel-backup p-2 text-red-500 hover:text-red-700';
                        cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
                        cancelBtn.title = 'Cancel backup';
                        cancelBtn.onclick = () => this.cancelBackup(path);
                        actions.appendChild(cancelBtn);
                    }
                }
            } else {
                actionButton.className = 'backup-action p-2 text-red-500 hover:text-red-700';
                actionButton.innerHTML = '<i class="fas fa-times"></i>';
                actionButton.disabled = false;
                actionButton.title = 'Remove from backup';

                // Remove cancel button if it exists
                const cancelButton = pathItem.querySelector('.cancel-backup');
                if (cancelButton) {
                    cancelButton.remove();
                }
            }
        }

        // Update progress info
        const progressInfo = document.getElementById(`progress-info-${path.replace(/[^a-zA-Z0-9]/g, '-')}`);
        if (progressInfo && progress) {
            const progressText = document.createElement('span');
            progressText.className = 'text-sm text-gray-600';
            if (progress.estimating) {
                progressText.textContent = progress.phase === 'initializing' ? 
                    'Preparing backup...' : 
                    'Estimating backup size...';
            } else {
                progressText.textContent = UIComponents.formatProgressText(progress);
            }
            progressInfo.innerHTML = '';
            progressInfo.appendChild(progressText);
        } else if (progressInfo && !isBackupInProgress) {
            progressInfo.innerHTML = '';
        }
    }

    cleanup(path) {
        console.log(`BackupOperations: Cleaning up backup for ${path}`);
        const backupKey = this.getBackupKey(path);
        
        // Remove from active backups and progress states
        this.activeBackups.delete(backupKey);
        this.progressStates.delete(backupKey);

        // Reset UI for this path
        this.updatePathItemUI(path);

        // If no more active backups, remove global progress listener
        if (this.activeBackups.size === 0 && this.globalProgressListener) {
            this.globalProgressListener();
            this.globalProgressListener = null;
        }
    }
}
