import { UIComponents } from '../components/ui-components.js';

export class BackupOperations {
    constructor() {
        this.activeBackups = new Map(); // Track active backups by individual path
        this.progressUnsubscribers = new Map(); // Track progress listeners
        this.progressStates = new Map(); // Track progress state for each backup
        this.incompleteBackups = new Set(); // Track paths with incomplete backups
        this.pendingBackups = new Set(); // Track paths pending backup
        this.globalProgressListener = null;
        this.setupGlobalProgressListener();
    }

    isBackupInProgress(path) {
        return this.activeBackups.has(path);
    }

    isBackupPending(path) {
        return this.pendingBackups.has(path);
    }

    hasIncompleteBackup(path) {
        return this.incompleteBackups.has(path);
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

    async checkBackupStatus(path) {
        try {
            const status = await window.electron.getBackupStatus([path]);
            if (status.hasIncomplete) {
                this.incompleteBackups.add(path);
            } else {
                this.incompleteBackups.delete(path);
            }
            this.updatePathItemUI(path);
            return status;
        } catch (error) {
            console.error('BackupOperations: Error checking backup status:', error);
            throw error;
        }
    }

    async startBackup(path, resume = false) {
        console.log(`BackupOperations: ${resume ? 'Resuming' : 'Starting'} backup for path:`, path);
        const backupKey = this.getBackupKey(path);
        
        try {
            // Mark this backup as active and initialize its progress state
            this.activeBackups.set(backupKey, true);
            this.progressStates.set(backupKey, {
                phase: 'initializing',
                percentage: 0,
                estimating: true
            });
            // Remove from pending if it was pending
            this.pendingBackups.delete(path);

            // Update UI to show backup starting
            this.updatePathItemUI(path);

            console.log('BackupOperations: Initiating backup with electron');
            const result = resume ? 
                await window.electron.resumeBackup([path]) : 
                await window.electron.startBackup([path]);
            console.log('BackupOperations: Backup result:', result);

            if (result.success) {
                // Dispatch event to refresh snapshots and update stats
                window.dispatchEvent(new CustomEvent('refresh-snapshots'));
            }

            // Ensure cleanup happens after backup completes
            this.cleanup(path);
            return result;
        } catch (error) {
            console.error('BackupOperations: Error during backup:', error);
            this.cleanup(path);
            throw error;
        }
    }

    async resumeBackup(path) {
        return this.startBackup(path, true);
    }

    async cancelBackup(path) {
        console.log('BackupOperations: Attempting to cancel backup for path:', path);
        
        const confirmed = await UIComponents.showConfirmDialog({
            title: 'Cancel Backup',
            message: `Are you sure you want to cancel the backup for:<br><span class="font-medium">${path}</span>?`,
            confirmText: 'Yes, Cancel Backup',
            cancelText: 'No, Continue',
            confirmClass: 'bg-red-100 text-red-700 hover:bg-red-200'
        });

        if (!confirmed) {
            return false;
        }

        try {
            console.log('BackupOperations: Cancelling backup for path:', path);
            const result = await window.electron.cancelBackup([path]);
            if (result.success) {
                this.cleanup(path);
                // Refresh snapshots after cancellation
                window.dispatchEvent(new CustomEvent('refresh-snapshots'));
            }
            return result;
        } catch (error) {
            console.error('BackupOperations: Error cancelling backup:', error);
            throw error;
        }
    }

    async removePath(path) {
        console.log('BackupOperations: Attempting to remove path:', path);
        
        const confirmed = await UIComponents.showConfirmDialog({
            title: 'Remove Path',
            message: `Are you sure you want to remove:<br><span class="font-medium">${path}</span><br>from the backup list?`,
            confirmText: 'Yes, Remove It',
            cancelText: 'No, Keep It',
            confirmClass: 'bg-red-100 text-red-700 hover:bg-red-200'
        });

        if (!confirmed) {
            return false;
        }

        const event = new CustomEvent('remove-path', { detail: path });
        window.dispatchEvent(event);
        return true;
    }

    updatePathItemUI(path) {
        const pathItem = document.getElementById(`path-item-${path.replace(/[^a-zA-Z0-9]/g, '-')}`);
        if (!pathItem) return;

        const isBackupInProgress = this.isBackupInProgress(path);
        const isBackupPending = this.isBackupPending(path);
        const hasIncomplete = this.hasIncompleteBackup(path);
        const progress = this.progressStates.get(this.getBackupKey(path));

        // Update or create the actions container
        let actions = pathItem.querySelector('.actions');
        if (!actions) {
            actions = document.createElement('div');
            actions.className = 'actions flex items-center gap-2';
            pathItem.appendChild(actions);
        }
        actions.innerHTML = ''; // Clear existing buttons

        // Add progress/spinner button
        const progressButton = document.createElement('button');
        progressButton.className = 'backup-action flex items-center gap-2 px-3 py-1 rounded text-sm font-medium';
        progressButton.disabled = isBackupInProgress || isBackupPending;

        if (isBackupInProgress) {
            progressButton.className += ' bg-gray-100 text-gray-600';
            let buttonText;
            if ((progress?.phase === 'estimating' || progress?.phase === 'hashing') && progress?.estimating) {
                buttonText = 'Encrypting...';
            } else if (progress?.phase === 'uploading' && !progress?.estimating) {
                buttonText = `${progress?.percentage?.toFixed(1) || 0}%`;
            } else {
                buttonText = `${progress?.percentage?.toFixed(1) || 0}%`;
            }
            progressButton.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                <span>${buttonText}</span>
            `;
        } else if (isBackupPending) {
            progressButton.className += ' bg-gray-100 text-gray-600';
            progressButton.innerHTML = `
                <i class="fas fa-clock"></i>
                <span>Pending...</span>
            `;
        } else if (hasIncomplete) {
            progressButton.className += ' bg-yellow-100 text-yellow-700 hover:bg-yellow-200';
            progressButton.innerHTML = '<i class="fas fa-exclamation-triangle mr-1"></i> Resume';
            progressButton.onclick = () => this.resumeBackup(path);
        }

        // Add action button (Cancel during backup, Remove otherwise)
        const actionButton = document.createElement('button');
        actionButton.className = 'px-3 py-1 rounded text-sm font-medium transition-colors duration-200';
        
        if (isBackupInProgress) {
            actionButton.textContent = 'Cancel';
            actionButton.className += ' bg-red-100 text-red-700 hover:bg-red-200';
            actionButton.onclick = () => this.cancelBackup(path);
        } else if (!isBackupPending) {
            actionButton.textContent = 'Remove';
            actionButton.className += ' bg-gray-100 text-gray-700 hover:bg-gray-200';
            actionButton.onclick = () => this.removePath(path);
        }

        // Add buttons to actions container
        if (isBackupInProgress || hasIncomplete || isBackupPending) {
            actions.appendChild(progressButton);
        }
        if (!isBackupPending) {
            actions.appendChild(actionButton);
        }

        // Update progress info
        const progressInfo = document.getElementById(`progress-info-${path.replace(/[^a-zA-Z0-9]/g, '-')}`);
        if (progressInfo) {
            if (isBackupInProgress && progress) {
                progressInfo.innerHTML = '';
                const progressText = document.createElement('span');
                progressText.className = 'text-sm text-gray-600';
                progressText.textContent = UIComponents.formatProgressText(progress);
                progressInfo.appendChild(progressText);
            } else if (isBackupPending) {
                progressInfo.innerHTML = '<span class="text-sm text-gray-600">Waiting for other backups to complete...</span>';
            } else if (hasIncomplete) {
                progressInfo.innerHTML = '<span class="text-sm text-yellow-600">Previous backup incomplete. Click to resume.</span>';
            } else {
                progressInfo.innerHTML = '';
            }
        }
    }

    cleanup(path) {
        console.log(`BackupOperations: Cleaning up backup for ${path}`);
        const backupKey = this.getBackupKey(path);
        
        // Remove from active backups and progress states
        this.activeBackups.delete(backupKey);
        this.progressStates.delete(backupKey);
        this.incompleteBackups.delete(path);
        this.pendingBackups.delete(path);

        // Reset UI for this path
        this.updatePathItemUI(path);

        // Check for incomplete backups after cleanup
        this.checkBackupStatus(path);

        // If no more active backups, remove global progress listener
        if (this.activeBackups.size === 0 && this.globalProgressListener) {
            this.globalProgressListener();
            this.globalProgressListener = null;
        }
    }
}
