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
                console.log('Attempting to connect to repository...');
                await KopiaService.connectRepository();
                console.log('Connected to repository successfully');

                // After successful connection, verify repository
                await KopiaService.repositoryService.verifyRepository();
                console.log('Repository verified successfully');

                // Only clean up snapshots after successful connection
                await KopiaService.backupService.cleanupIncompleteSnapshots();
                console.log('Cleaned up incomplete snapshots');
            } catch (error) {
                console.log('Connection attempt failed:', error);

                // If repository doesn't exist, create it first
                if (error.code === 'REPO_NOT_INITIALIZED' || 
                    error.message.includes('repository not initialized') ||
                    error.message.includes('ERROR error connecting to repository: repository not initialized')) {
                    console.log('Repository not found, creating new repository...');
                    try {
                        await KopiaService.createRepository();
                        console.log('Repository created successfully');

                        console.log('Connecting to newly created repository...');
                        await KopiaService.connectRepository();
                        console.log('Connected to new repository');

                        await KopiaService.repositoryService.verifyRepository();
                        console.log('New repository verified successfully');
                    } catch (createError) {
                        console.error('Failed to create repository:', createError);
                        throw createError;
                    }
                } else if (error.message.includes('not connected') || error.message.includes('connection failed')) {
                    // If connection issues, try to reconnect
                    console.log('Connection issues detected, attempting to reconnect...');
                    await KopiaService.repositoryService.reconnectRepository();
                    await KopiaService.repositoryService.verifyRepository();
                    console.log('Reconnection successful');
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
        process.on('uncaughtException', async (error) => {
            console.error('Uncaught exception:', error);
            // Clean up any incomplete snapshots on crash
            try {
                await KopiaService.backupService.cleanupIncompleteSnapshots();
                // Also verify repository connection on error
                await KopiaService.repositoryService.verifyRepository();
            } catch (cleanupError) {
                console.error('Failed to clean up on crash:', cleanupError);
            }
            fileDialogs.showErrorBox(
                'Unexpected Error',
                'An unexpected error occurred. Check the logs for details.'
            );
        });

        process.on('unhandledRejection', async (error) => {
            console.error('Unhandled rejection:', error);
            // Verify repository connection on unhandled rejections
            try {
                await KopiaService.repositoryService.verifyRepository();
            } catch (verifyError) {
                console.error('Repository verification failed:', verifyError);
            }
        });
    }

    setupAppEvents() {
        app.on('before-quit', async (event) => {
            // Prevent immediate quit to allow cleanup
            event.preventDefault();
            
            try {
                // Clean up any incomplete snapshots
                if (KopiaService.backupService) {
                    await KopiaService.backupService.cleanupIncompleteSnapshots();
                }
                
                // Verify repository before disconnecting
                if (KopiaService.repositoryService) {
                    try {
                        await KopiaService.repositoryService.verifyRepository();
                    } catch (error) {
                        console.warn('Final repository verification failed:', error);
                    }
                }
                
                // Disconnect repository
                if (KopiaService) {
                    await KopiaService.disconnectRepository();
                }
            } catch (error) {
                console.error('Error during cleanup:', error);
            } finally {
                // Force quit after cleanup
                app.exit(0);
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
