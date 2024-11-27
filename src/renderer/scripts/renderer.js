import { BackupManager } from './backup/backup-manager.js';
import { SettingsManager } from './settings/settings-manager.js';
import { TabManager } from './components/tab-manager.js';

class Renderer {
    constructor() {
        console.log('Initializing application...');
        this.initializeManagers();
        this.setupErrorHandling();
    }

    async initializeManagers() {
        try {
            // Initialize tab manager first
            console.log('Initializing TabManager...');
            this.tabManager = new TabManager();

            // Initialize settings manager before backup manager
            // since backup manager might need settings
            console.log('Initializing SettingsManager...');
            this.settingsManager = new SettingsManager();

            // Initialize backup manager and expose it globally
            console.log('Initializing BackupManager...');
            this.backupManager = new BackupManager();
            window.backupManager = this.backupManager; // Expose to window for UI event handlers

            console.log('All managers initialized successfully');
        } catch (error) {
            console.error('Error initializing managers:', error);
            this.showError('Failed to initialize application');
        }
    }

    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Window Error:', event.error);
            this.showError(event.error.message);
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled Promise Rejection:', event.reason);
            this.showError(event.reason.message);
        });
    }

    showError(message) {
        const notification = document.createElement('div');
        notification.className = 'notification bg-red-500';
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing application...');
    const app = new Renderer();
    console.log('Application initialized');
});
