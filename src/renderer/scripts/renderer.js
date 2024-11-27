import { BackupManager } from './backup/backup-manager.js';
import { SettingsManager } from './settings/settings-manager.js';
import { TabManager } from './components/tab-manager.js';

class Renderer {
    constructor() {
        console.log('Initializing application...');
        this.initializeManagers();
        this.setupErrorHandling();
    }

    initializeManagers() {
        // Initialize tab manager
        this.tabManager = new TabManager();

        // Initialize backup manager and expose it globally
        this.backupManager = new BackupManager();
        window.backupManager = this.backupManager; // Expose to window for UI event handlers

        // Initialize settings manager
        this.settingsManager = new SettingsManager();
    }

    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.log('Window Error:', event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.log('Unhandled Promise Rejection:', event.reason);
        });
    }
}

// Initialize the application
const app = new Renderer();
console.log('Application initialized');
