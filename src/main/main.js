const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const validateEnvironment = require('./utils/validate-env');
const ConfigService = require('./services/config');
const { setupIpcHandlers } = require('./ipc/ipc-handlers');
require('dotenv').config();

let mainWindow;
let KopiaService;

// Initialize Kopia Service
async function initializeKopiaService() {
    try {
        console.log('Validating environment...');
        validateEnvironment();
        
        console.log('Initializing Kopia service...');
        KopiaService = require('./services/kopia');
        
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

function createWindow() {
    console.log('Creating window...');
    
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Set CSP headers
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; " +
                    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
                    "font-src 'self' https://cdnjs.cloudflare.com; " +
                    "script-src 'self' 'unsafe-inline'; " +
                    "img-src 'self' data:"
                ]
            }
        });
    });

    console.log('Setting up IPC handlers...');
    setupIpcHandlers();

    const indexPath = path.join(__dirname, '../renderer/index.html');
    console.log('Loading index from:', indexPath);

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load:', errorCode, errorDescription);
    });

    mainWindow.loadFile(indexPath)
        .then(() => console.log('Index loaded successfully'))
        .catch(err => console.error('Failed to load index:', err));

    // Only open DevTools in development mode
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(async () => {
    try {
        console.log('App ready, initializing...');
        await initializeKopiaService();
        createWindow();
    } catch (error) {
        console.error('Startup error:', error);
        dialog.showErrorBox(
            'Startup Error',
            `Failed to start application: ${error.message}`
        );
        app.quit();
    }
});

// Add cleanup on app quit
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
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Error handlers
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    dialog.showErrorBox(
        'Unexpected Error',
        'An unexpected error occurred. Check the logs for details.'
    );
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
});
