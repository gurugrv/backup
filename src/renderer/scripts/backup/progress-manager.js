import { UIComponents } from '../components/ui-components.js';

export class ProgressManager {
    constructor(elements) {
        this.elements = elements;
        this.progressByPath = new Map(); // Track progress for each path separately
        this.progressUnsubscribe = null;
        this.activeBackups = new Set(); // Track active backup paths
    }

    setupProgressListener(callback) {
        console.log('ProgressManager: Setting up progress listener');
        this.progressUnsubscribe = window.electron.onBackupProgress((progress) => {
            console.log('ProgressManager: Progress update received:', progress);
            if (progress && progress.paths) {
                // Update progress for each path in the update
                progress.paths.forEach(path => {
                    this.progressByPath.set(path, {
                        ...progress,
                        lastUpdate: Date.now()
                    });
                    this.activeBackups.add(path);
                });

                // Update UI with aggregated progress
                this.updateProgressUI();
                if (callback) callback(progress);
            } else if (progress && progress.completed) {
                // Handle backup completion for specific paths
                progress.paths.forEach(path => {
                    this.progressByPath.delete(path);
                    this.activeBackups.delete(path);
                });
                
                if (this.activeBackups.size === 0) {
                    this.resetProgressUI();
                } else {
                    this.updateProgressUI();
                }
            }
        });
    }

    updateProgressUI() {
        if (this.progressByPath.size === 0) {
            this.resetProgressUI();
            return;
        }

        // Calculate aggregated progress across all active backups
        let totalPercentage = 0;
        let totalUploaded = 0;
        let totalEstimated = 0;
        let totalHashed = 0;
        let totalCached = 0;
        let isEstimating = false;
        let isUploading = false;
        let activeCount = 0;

        this.progressByPath.forEach((progress, path) => {
            if (this.activeBackups.has(path)) {
                activeCount++;
                totalPercentage += progress.percentage || 0;
                totalUploaded += progress.uploaded || 0;
                totalEstimated += progress.estimated || 0;
                totalHashed += progress.hashed || 0;
                totalCached += progress.cached || 0;
                isEstimating = isEstimating || (progress.estimating && (progress.phase === 'estimating' || progress.phase === 'hashing'));
                isUploading = isUploading || (progress.phase === 'uploading' && !progress.estimating);
            }
        });

        const averagePercentage = activeCount > 0 ? totalPercentage / activeCount : 0;

        // Update global progress bar
        if (this.elements.progressBarFill) {
            const width = `${Math.min(averagePercentage, 100)}%`;
            console.log(`ProgressManager: Updating progress bar width to ${width}`);
            this.elements.progressBarFill.style.width = width;
        }
        
        // Update global percentage text
        if (this.elements.backupProgressPercentage) {
            const percentage = `${Math.min(averagePercentage, 100).toFixed(1)}%`;
            console.log(`ProgressManager: Updating percentage text to ${percentage}`);
            this.elements.backupProgressPercentage.textContent = percentage;
        }
        
        // Update global status text
        if (this.elements.backupProgressStatus) {
            let statusText;
            if (isEstimating) {
                statusText = `Encrypting backup data for ${activeCount} ${activeCount === 1 ? 'path' : 'paths'}...`;
            } else if (isUploading) {
                statusText = `Uploading data to cloud - ${this.formatBytes(totalUploaded)} of ${this.formatBytes(totalEstimated)} uploaded, ` +
                    `${totalHashed} files hashed, ${totalCached} files cached`;
            } else {
                statusText = `Backing up ${activeCount} ${activeCount === 1 ? 'path' : 'paths'} - ` +
                    `${this.formatBytes(totalUploaded)} of ${this.formatBytes(totalEstimated)} uploaded, ` +
                    `${totalHashed} files hashed, ${totalCached} files cached`;
            }
            console.log('ProgressManager: Updating status text to:', statusText);
            this.elements.backupProgressStatus.textContent = statusText;
        }

        // Update individual path items
        this.progressByPath.forEach((progress, path) => {
            if (this.activeBackups.has(path)) {
                UIComponents.updatePathItemProgress(path, progress);
            }
        });
    }

    formatBytes(bytes) {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    }

    resetProgressUI() {
        // Reset progress bar
        if (this.elements.progressBarFill) {
            this.elements.progressBarFill.style.width = '0%';
        }
        
        // Reset percentage text
        if (this.elements.backupProgressPercentage) {
            this.elements.backupProgressPercentage.textContent = '0%';
        }
        
        // Reset status text
        if (this.elements.backupProgressStatus) {
            this.elements.backupProgressStatus.textContent = 'Preparing backup...';
        }

        // Reset all path items
        this.progressByPath.clear();
        this.activeBackups.clear();
    }

    showProgress() {
        console.log('ProgressManager: Showing progress section');
        if (this.elements.backupProgress) {
            this.elements.backupProgress.classList.remove('hidden');
            this.elements.backupProgress.classList.add('active');
            this.resetProgressUI();
        }
    }

    hideProgress() {
        console.log('ProgressManager: Hiding progress section');
        if (this.elements.backupProgress) {
            this.elements.backupProgress.classList.remove('active');
            this.elements.backupProgress.classList.add('hidden');
            this.resetProgressUI();
        }
    }

    cleanup() {
        if (this.progressUnsubscribe) {
            this.progressUnsubscribe();
            this.progressUnsubscribe = null;
        }
        this.progressByPath.clear();
        this.activeBackups.clear();
        this.resetProgressUI();
    }
}
