const { BrowserWindow } = require('electron');
const path = require('path');

class WindowManager {
    constructor() {
        this.mainWindow = null;
    }

    createMainWindow() {
        console.log('Creating window...');
        
        this.mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                webSecurity: true,
                allowRunningInsecureContent: false,
                enableRemoteModule: false,
                preload: path.join(__dirname, '../preload.js')
            }
        });

        // Set CSP headers
        this.mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [
                        "default-src 'self'; " +
                        "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
                        "font-src 'self' https://cdnjs.cloudflare.com; " +
                        "script-src 'self'"
                    ]
                }
            });
        });

        const indexPath = path.join(__dirname, '../../renderer/index.html');
        console.log('Loading index from:', indexPath);

        this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            console.error('Failed to load:', errorCode, errorDescription);
        });

        this.mainWindow.loadFile(indexPath)
            .then(() => console.log('Index loaded successfully'))
            .catch(err => console.error('Failed to load index:', err));

        // Only open DevTools in development mode
        if (process.env.NODE_ENV === 'development') {
            this.mainWindow.webContents.openDevTools();
        }

        return this.mainWindow;
    }

    getMainWindow() {
        return this.mainWindow;
    }
}

module.exports = new WindowManager();
