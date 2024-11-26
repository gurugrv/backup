const { Tray, Menu, app } = require('electron');
const path = require('path');
const logger = require('./logger');

class TrayService {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.tray = null;
    }

    create() {
        try {
            const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
            this.tray = new Tray(iconPath);
            this.tray.setToolTip('BackYup');
            this.createContextMenu();
            this.setupEventHandlers();
            logger.info('Tray icon created successfully');
        } catch (error) {
            logger.error('Failed to create tray icon:', error);
        }
    }

    createContextMenu() {
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Open BackYup',
                click: () => {
                    this.mainWindow.show();
                }
            },
            {
                label: 'Start Backup',
                click: () => {
                    this.mainWindow.webContents.send('start-backup');
                }
            },
            { type: 'separator' },
            {
                label: 'Status',
                submenu: [
                    {
                        label: 'Last Backup: Never',
                        enabled: false,
                        id: 'lastBackup'
                    },
                    {
                        label: 'Next Backup: Not Scheduled',
                        enabled: false,
                        id: 'nextBackup'
                    }
                ]
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    app.quit();
                }
            }
        ]);

        this.tray.setContextMenu(contextMenu);
    }

    setupEventHandlers() {
        this.tray.on('double-click', () => {
            this.mainWindow.show();
        });
    }

    updateStatus(status) {
        const contextMenu = this.tray.contextMenu;
        const lastBackupItem = contextMenu.getMenuItemById('lastBackup');
        const nextBackupItem = contextMenu.getMenuItemById('nextBackup');

        if (status.lastBackup) {
            lastBackupItem.label = `Last Backup: ${new Date(status.lastBackup).toLocaleString()}`;
        }

        if (status.nextBackup) {
            nextBackupItem.label = `Next Backup: ${new Date(status.nextBackup).toLocaleString()}`;
        }

        this.tray.setContextMenu(contextMenu);
    }

    destroy() {
        if (this.tray) {
            this.tray.destroy();
            this.tray = null;
        }
    }
}

module.exports = TrayService;