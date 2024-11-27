export class BackupOperations {
    constructor() {
        this.backupInProgress = false;
        this.currentProgress = null;
        this.progressUnsubscribe = null;
    }

    isBackupInProgress() {
        return this.backupInProgress;
    }

    getCurrentProgress() {
        return this.currentProgress;
    }

    setupProgressListener(onProgress) {
        if (this.progressUnsubscribe) {
            this.progressUnsubscribe();
        }

        // Set up progress listener
        this.progressUnsubscribe = window.electron.onBackupProgress((progress) => {
            if (progress) {
                console.log('Progress received in operations:', progress); // Debug log
                
                // Store the progress data
                this.currentProgress = {
                    uploaded: progress.uploaded,
                    estimated: progress.estimated,
                    percentage: progress.percentage,
                    timeLeft: progress.timeLeft
                };

                // Call the callback with the progress data
                if (onProgress && typeof onProgress === 'function') {
                    onProgress(this.currentProgress);
                }
            } else {
                // Clear progress when null is received (backup complete or cancelled)
                this.currentProgress = null;
                if (onProgress && typeof onProgress === 'function') {
                    onProgress(null);
                }
            }
        });

        return () => {
            if (this.progressUnsubscribe) {
                this.progressUnsubscribe();
                this.progressUnsubscribe = null;
            }
        };
    }

    async startBackup(paths) {
        if (this.backupInProgress) {
            throw new Error('Backup already in progress');
        }

        if (!paths?.length) {
            throw new Error('No directories selected for backup');
        }

        try {
            this.backupInProgress = true;
            this.currentProgress = null;

            const result = await window.electron.startBackup(paths);
            
            if (result.success && !result.cancelled) {
                return { success: true };
            } else if (result.cancelled) {
                return { success: false, cancelled: true };
            } else {
                throw new Error(result.error || 'Unknown error occurred during backup');
            }
        } catch (error) {
            console.error('Error during backup:', error);
            throw error;
        }
    }

    async cancelBackup() {
        if (!this.backupInProgress) return false;

        try {
            const result = await window.electron.cancelBackup();
            if (result.success) {
                return true;
            } else {
                throw new Error(result.message || 'Failed to cancel backup');
            }
        } catch (error) {
            console.error('Error cancelling backup:', error);
            throw error;
        } finally {
            this.cleanup();
        }
    }

    cleanup() {
        this.backupInProgress = false;
        this.currentProgress = null;
        if (this.progressUnsubscribe) {
            this.progressUnsubscribe();
            this.progressUnsubscribe = null;
        }
    }
}
