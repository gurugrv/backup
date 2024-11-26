const { Notification } = require('electron');
const logger = require('./logger');

class NotificationService {
    constructor() {
        this.notificationQueue = [];
        this.isProcessing = false;
    }

    async showNotification(options) {
        const defaultOptions = {
            title: 'BackYup',
            silent: false,
            timeoutType: 'default'
        };

        const notificationOptions = { ...defaultOptions, ...options };
        
        this.notificationQueue.push(notificationOptions);
        
        if (!this.isProcessing) {
            await this.processQueue();
        }
    }

    async processQueue() {
        if (this.notificationQueue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const options = this.notificationQueue.shift();

        try {
            const notification = new Notification(options);
            notification.show();

            // Log notification
            logger.info('Notification shown', {
                title: options.title,
                body: options.body
            });

            // Wait for notification to be closed or timeout
            await new Promise(resolve => {
                notification.on('close', resolve);
                notification.on('click', resolve);
                setTimeout(resolve, 5000);
            });

            // Process next notification after a small delay
            setTimeout(() => this.processQueue(), 500);
        } catch (error) {
            logger.error('Failed to show notification', { error });
            this.processQueue();
        }
    }

    async showBackupSuccess(details) {
        await this.showNotification({
            title: 'Backup Completed',
            body: `Successfully backed up ${details.fileCount} files (${details.size})`,
            icon: 'assets/success-icon.png'
        });
    }

    async showBackupError(error) {
        await this.showNotification({
            title: 'Backup Failed',
            body: error.message,
            icon: 'assets/error-icon.png'
        });
    }

    async showRestoreSuccess(details) {
        await this.showNotification({
            title: 'Restore Completed',
            body: `Successfully restored files to ${details.path}`,
            icon: 'assets/success-icon.png'
        });
    }

    async showRestoreError(error) {
        await this.showNotification({
            title: 'Restore Failed',
            body: error.message,
            icon: 'assets/error-icon.png'
        });
    }
}

module.exports = new NotificationService();
