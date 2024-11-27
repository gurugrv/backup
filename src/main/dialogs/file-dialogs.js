const { dialog } = require('electron');
const windowManager = require('../window/window-manager');

class FileDialogs {
    async selectPaths() {
        console.log('Opening folder selection dialog...');
        
        const result = await dialog.showOpenDialog(windowManager.getMainWindow(), {
            title: 'Select Folders to Backup',
            buttonLabel: 'Select',
            properties: ['openDirectory', 'multiSelections'],
        });
        
        const selectedPaths = result.canceled ? [] : result.filePaths;
        console.log('Selected paths:', selectedPaths);
        return selectedPaths;
    }

    async selectRestoreDirectory() {
        const result = await dialog.showOpenDialog(windowManager.getMainWindow(), {
            properties: ['openDirectory'],
            title: 'Select Restore Location',
            buttonLabel: 'Select'
        });
        return result.filePaths[0];
    }

    showErrorBox(title, message) {
        dialog.showErrorBox(title, message);
    }
}

module.exports = new FileDialogs();
