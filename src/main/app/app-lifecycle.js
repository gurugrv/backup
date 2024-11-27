const { app } = require('electron');
const windowManager = require('../window/window-manager');
const ipcHandlers = require('../ipc/ipc-handlers');
const fileDialogs = require('../dialogs/file-dialogs');
const KopiaService = require('../services/kopia');
const validateEnvironment = require('../utils/validate-env');

class AppLifecycle {
    async initialize() {
        try {
            console.log('App ready, initializing...');
            await this.initializeKopiaService();
            this.setupErrorHandlers();
            this.setupAppEvents();
            windowManager.createMainWindow();
            ipcHandlers.setup();
        } catch (error) {
            console.error('Startup error:', error);
            fileDialogs.showErrorBox(
                'Startup Error',
                `Failed to start application: ${error.message}`
            );
            app.quit();
        }
    }

    async initializeKopiaService() {
        try {
            console.log('Validating environment...');
            validateEnvironment();
            
            console.log('Initializing Kopia service...');
            try {
                // First try to connect to existing repository
                await KopiaService.connectRepository();
            } catch (error) {
                // If repository doesn't exist, create it first
                if (error.code === 'REPO_NOT_INITIALIZED') {
                    console.log('Repository not found, creating new repository...');
                    await KopiaService.createRepository();
                    console.log('Repository created, connecting...');
                    await KopiaService.connectRepository();
                } else {
                    // If it's a different error, throw it
                    throw error;
                }
            }
            console.log('Kopia service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Kopia service:', error);
            throw error;
        }
    }

    setupErrorHandlers() {
        process.on('uncaughtException', (error) => {
            console.error('Uncaught exception:', error);
            fileDialogs.showErrorBox(
                'Unexpected Error',
                'An unexpected error occurred. Check the logs for details.'
            );
        });

        process.on('unhandledRejection', (error) => {
            console.error('Unhandled rejection:', error);
        });
    }

    setupAppEvents() {
        app.on('before-quit', async () => {
            if (KopiaService) {
                await KopiaService.disconnectRepository();
            }
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        app.on('activate', () => {
            if (!windowManager.getMainWindow()) {
                windowManager.createMainWindow();
            }
        });
    }
}

module.exports = new AppLifecycle();
