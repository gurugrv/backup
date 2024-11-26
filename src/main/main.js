const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
require('dotenv').config();

const logger = require('./services/logger');

// Force development mode and set app root path
process.env.NODE_ENV = 'development';
const APP_ROOT = path.join(__dirname, '../..');

console.log('Application starting...');
console.log('Current directory:', __dirname);
console.log('Development mode:', process.env.NODE_ENV === 'development');
console.log('Resource path:', process.resourcesPath);

// Import base dependencies first
let mainWindow;
let trayService;
let isQuitting = false;
let store;

// Declare service variables
let KopiaService;
let ConfigService;
let NotificationService;
let StatusMonitor;
let scheduler;

async function initializeStore() {
    try {
        console.log('Initializing store...');
        const { default: Store } = await import('electron-store');
        store = new Store();
        console.log('Store initialized successfully');
    } catch (error) {
        console.error('Failed to initialize store:', error);
        throw error;
    }
}

async function verifyRequirements() {
    console.log('Verifying requirements...');
    const fs = require('fs').promises;
    
    // Use APP_ROOT to resolve the bin path
    const binPath = path.join(APP_ROOT, 'bin', 'kopia.exe');
    console.log('Looking for Kopia binary at:', binPath);

    try {
        await fs.access(binPath);
        console.log('Kopia binary found successfully');
        return binPath;
    } catch (error) {
        console.error('Kopia binary not found!');
        console.error('Expected path:', binPath);
        throw new Error(`Kopia binary not found. Please ensure it exists at: ${binPath}`);
    }
}

async function verifyFileStructure() {
    const fs = require('fs').promises;
    const requiredPaths = [
        path.join(__dirname, '../renderer/index.html'),
        path.join(__dirname, '../renderer/styles.css'),
        path.join(__dirname, '../renderer/scripts/renderer.js')
    ];

    console.log('Verifying file structure...');
    for (const filePath of requiredPaths) {
        try {
            await fs.access(filePath);
            console.log(`Found: ${filePath}`);
        } catch (error) {
            console.error(`Missing required file: ${filePath}`);
            throw new Error(`Missing required file: ${filePath}`);
        }
    }
    console.log('File structure verified');
}

async function initializeServices() {
    try {
        console.log('Starting services initialization...');

        // Initialize store first
        console.log('Step 1: Initializing store...');
        await initializeStore();
        console.log('Store initialized');

        // Import services
        console.log('Step 2: Importing services...');
        try {
            KopiaService = require('./services/kopia');
            ConfigService = require('./services/config');
            NotificationService = require('./services/notifications');
            StatusMonitor = require('./services/status-monitor');
            scheduler = require('./services/scheduler');
            console.log('All services imported');
        } catch (error) {
            console.error('Failed to import services:', error);
            throw error;
        }

        // Initialize services
        console.log('Step 3: Loading configuration...');
        await ConfigService.load();
        console.log('Configuration loaded');

        // Remove scheduler initialization step since it's now synchronous
        console.log('Step 4: Initializing Kopia repository...');
        await KopiaService.initializeRepository();
        console.log('Kopia repository initialized');

        // Load initial schedule if exists
        const backupSettings = await ConfigService.get('backup.schedule');
        if (backupSettings) {
            scheduler.updateSchedule(backupSettings);
        }

        console.log('All services initialized successfully');
        return true;
    } catch (error) {
        console.error('Service initialization failed:', error);
        throw error;
    }
}



async function createWindow() {
    try {
        console.log('Creating main window...');
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: true
            },
            show: false,
            backgroundColor: '#ffffff'
        });

        const indexPath = path.join(__dirname, '../renderer/index.html');
        console.log('Loading index.html from:', indexPath);

        // Add error handling for file loading
        try {
            const fs = require('fs');
            if (!fs.existsSync(indexPath)) {
                throw new Error(`index.html not found at: ${indexPath}`);
            }
        } catch (error) {
            console.error('Failed to verify index.html:', error);
            throw error;
        }
		
// Set up IPC handlers before loading the file
        setupIPCHandlers();
        console.log('IPC handlers registered');

        await mainWindow.loadFile(indexPath);
        console.log('Index file loaded successfully');

        mainWindow.once('ready-to-show', () => {
            console.log('Window ready to show');
            mainWindow.show();
            
            if (process.env.NODE_ENV === 'development') {
                mainWindow.webContents.openDevTools();
            }
        });

        // Add error handlers
        mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            console.error('Failed to load window:', errorCode, errorDescription);
        });

        mainWindow.on('closed', () => {
            mainWindow = null;
        });
console.log('Window created successfully');
        
    } catch (error) {
        console.error('Error creating window:', error);
        throw error;
    }
}



async function cleanup() {
    try {
        logger.info('Starting cleanup...');
        
        // Stop all scheduled jobs
        await scheduler.cancelAllJobs();
        
        // Disconnect from repository
        await KopiaService.disconnectRepository();
        
        // Stop monitoring
        StatusMonitor.stop();
        
        // Clean up tray
        if (trayService) {
            trayService.destroy();
        }
        
        // Final logs
        await logger.cleanOldLogs();
        
        logger.info('Cleanup completed successfully');
    } catch (error) {
        logger.error('Cleanup failed:', error);
        throw error;
    }
}

// IPC Handlers
function setupIPCHandlers() {
    const handlers = {
        // Backup operations
        'select-backup-paths': async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
                properties: ['openFile', 'openDirectory', 'multiSelections']
            });
            return result.filePaths;
        },

        'start-backup': async (event, paths) => {
            try {
                StatusMonitor.setBackupProgress(true);
                await KopiaService.createSnapshot(paths);
                await ConfigService.set('backup.schedule.lastRun', new Date().toISOString());
                StatusMonitor.setBackupProgress(false);
                NotificationService.showBackupSuccess({ paths });
                return { success: true };
            } catch (error) {
                StatusMonitor.setBackupProgress(false);
                logger.error('Backup failed:', error);
                NotificationService.showBackupError(error);
                return { success: false, error: error.message };
            }
        },

        // Restore operations
        'list-snapshots': async () => {
            try {
                const snapshots = await KopiaService.listSnapshots();
                return { success: true, snapshots };
            } catch (error) {
                logger.error('Failed to list snapshots:', error);
                return { success: false, error: error.message };
            }
        },

        'select-restore-directory': async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
                properties: ['openDirectory']
            });
            return result.filePaths[0];
        },

        'restore-snapshot': async (event, snapshotId, targetPath) => {
            try {
                StatusMonitor.setRestoreProgress(true);
                await KopiaService.restoreSnapshot(snapshotId, targetPath);
                StatusMonitor.setRestoreProgress(false);
                NotificationService.showRestoreSuccess({ path: targetPath });
                return { success: true };
            } catch (error) {
                StatusMonitor.setRestoreProgress(false);
                logger.error('Restore failed:', error);
                NotificationService.showRestoreError(error);
                return { success: false, error: error.message };
            }
        },

        // Settings operations
        'get-settings': async () => {
            try {
                const settings = await ConfigService.getAllSettings();
                return { success: true, settings };
            } catch (error) {
                logger.error('Failed to get settings:', error);
                return { success: false, error: error.message };
            }
        },

        'update-settings': async (event, settings) => {
            try {
                await ConfigService.updateSettings(settings);
                if (settings.schedule) {
                    await scheduler.updateSchedule(settings.schedule);
                }
                return { success: true };
            } catch (error) {
                logger.error('Failed to update settings:', error);
                return { success: false, error: error.message };
            }
        },

        // Status operations
        'get-backup-status': async () => {
            try {
                const status = StatusMonitor.getStatus();
                return { success: true, status };
            } catch (error) {
                logger.error('Failed to get backup status:', error);
                return { success: false, error: error.message };
            }
        },

        'get-repository-stats': async () => {
            try {
                const stats = await KopiaService.getRepositoryStats();
                return { success: true, stats };
            } catch (error) {
                logger.error('Failed to get repository stats:', error);
                return { success: false, error: error.message };
            }
        },

        'verify-repository': async () => {
            try {
                await KopiaService.verifyRepository();
                return { success: true };
            } catch (error) {
                logger.error('Repository verification failed:', error);
                return { success: false, error: error.message };
            }
        },

        // Log operations
        'get-logs': async (event, options = {}) => {
            try {
                const logs = await logger.getLogs(options);
                return { success: true, logs };
            } catch (error) {
                logger.error('Failed to get logs:', error);
                return { success: false, error: error.message };
            }
        },

        'clear-logs': async () => {
            try {
                await logger.cleanOldLogs();
                return { success: true };
            } catch (error) {
                logger.error('Failed to clear logs:', error);
                return { success: false, error: error.message };
            }
        },

        // Backup path management
        'get-backup-paths': async () => {
            try {
                const paths = await ConfigService.getBackupPaths();
                return { success: true, paths };
            } catch (error) {
                logger.error('Failed to get backup paths:', error);
                return { success: false, error: error.message };
            }
        },

        'add-backup-path': async (event, path) => {
            try {
                await ConfigService.addBackupPath(path);
                return { success: true };
            } catch (error) {
                logger.error('Failed to add backup path:', error);
                return { success: false, error: error.message };
            }
        },

        'remove-backup-path': async (event, path) => {
            try {
                await ConfigService.removeBackupPath(path);
                return { success: true };
            } catch (error) {
                logger.error('Failed to remove backup path:', error);
                return { success: false, error: error.message };
            }
        },

        'get-schedule-status': async () => {
            try {
                const status = await scheduler.getScheduleStatus();
                return { success: true, status };
            } catch (error) {
                logger.error('Failed to get schedule status:', error);
                return { success: false, error: error.message };
            }
        },

        'check-kopia-version': async () => {
            try {
                const version = await KopiaService.getVersion();
                return { success: true, version };
            } catch (error) {
                logger.error('Failed to check Kopia version:', error);
                return { success: false, error: error.message };
            }
        }
    };

    // Register all handlers
    Object.entries(handlers).forEach(([channel, handler]) => {
        console.log(`Registering IPC handler: ${channel}`);
        ipcMain.handle(channel, handler);
    });

    console.log('All IPC handlers registered successfully');
}

app.whenReady().then(async () => {
    try {
        console.log('Electron app ready...');
        await verifyRequirements();
        await verifyFileStructure();
        console.log('Starting application initialization...');
        await initializeServices();
        console.log('Services initialized, creating window...');
        await createWindow();
        
        // Initialize tray and status monitor
        const TrayService = require('./services/tray');
        trayService = new TrayService(mainWindow);
        trayService.create();
        StatusMonitor.start();
        
        console.log('Application startup complete');
    } catch (error) {
        console.error('Startup error:', error);
        dialog.showErrorBox(
            'Startup Error',
            `Failed to start application: ${error.message}\n\nCheck the console for more details.`
        );
        app.quit();
    }
});


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        isQuitting = true;
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', async () => {
    try {
        isQuitting = true;
        logger.info('Application shutting down...');
        
        StatusMonitor.stop();
        await KopiaService.disconnectRepository();
        if (trayService) {
            trayService.destroy();
        }
        
        logger.info('Application shutdown complete');
    } catch (error) {
        logger.error('Error during shutdown:', error);
    }
});

// Handle app quit with cleanup
app.on('will-quit', async (event) => {
    if (!isQuitting) {
        event.preventDefault();
        try {
            await cleanup();
            isQuitting = true;
            app.quit();
        } catch (error) {
            logger.error('Failed to quit cleanly:', error);
            app.exit(1);
        }
    }
});

// Global error handlers
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    dialog.showErrorBox(
        'Unexpected Error',
        'An unexpected error occurred. The application will attempt to continue running.'
    );
});

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled rejection:', error);
    dialog.showErrorBox(
        'Unexpected Error',
        'An unhandled promise rejection occurred. The application will attempt to continue running.'
    );
});


// Development helpers
if (process.env.NODE_ENV === 'development') {
    ipcMain.handle('dev-reset-config', async () => {
        try {
            await ConfigService.resetToDefaults();
            return { success: true };
        } catch (error) {
            logger.error('Failed to reset configuration:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('dev-get-all-config', async () => {
        try {
            const config = await ConfigService.getAllSettings();
            return { success: true, config };
        } catch (error) {
            logger.error('Failed to get configuration:', error);
            return { success: false, error: error.message };
        }
    });
}

// Export cleanup function for graceful shutdown




// Export for testing
if (process.env.NODE_ENV === 'test') {
    module.exports = {
        cleanup,
        mainWindow,
        store
    };
}