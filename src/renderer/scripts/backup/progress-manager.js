import { UIComponents } from '../components/ui-components.js';

export class ProgressManager {
    constructor(elements) {
        this.elements = elements;
        this.currentProgress = null;
        this.progressUnsubscribe = null;
    }

    setupProgressListener(callback) {
        console.log('ProgressManager: Setting up progress listener');
        this.progressUnsubscribe = window.electron.onBackupProgress((progress) => {
            console.log('ProgressManager: Progress update received:', progress);
            if (progress) {
                this.currentProgress = progress;
                this.updateProgressUI(progress);
                if (callback) callback(progress);
            } else {
                // When progress is null (backup complete), reset UI
                this.resetProgressUI();
            }
        });
    }

    updateProgressUI(progress) {
        if (!progress) return;

        // Update progress bar
        if (this.elements.progressBarFill) {
            const width = `${Math.min(progress.percentage || 0, 100)}%`;
            console.log(`ProgressManager: Updating progress bar width to ${width}`);
            this.elements.progressBarFill.style.width = width;
        }
        
        // Update percentage text
        if (this.elements.backupProgressPercentage) {
            const percentage = `${Math.min(progress.percentage || 0, 100).toFixed(1)}%`;
            console.log(`ProgressManager: Updating percentage text to ${percentage}`);
            this.elements.backupProgressPercentage.textContent = percentage;
        }
        
        // Update status text
        if (this.elements.backupProgressStatus) {
            const statusText = UIComponents.formatProgressText(progress);
            console.log('ProgressManager: Updating status text to:', statusText);
            this.elements.backupProgressStatus.textContent = statusText;
        }

        // Update all path items with current progress
        const pathItems = document.querySelectorAll('[id^="path-item-"]');
        pathItems.forEach(item => {
            const pathId = item.id;
            const path = pathId.replace('path-item-', '').replace(/-/g, '\\');
            UIComponents.updatePathItemProgress(path, progress);
        });
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
        this.currentProgress = null;
        this.resetProgressUI();
    }
}
