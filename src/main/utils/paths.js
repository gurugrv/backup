const path = require('path');

// Get the application root directory
const APP_ROOT = path.join(__dirname, '../../..');

// Export common paths
module.exports = {
    APP_ROOT,
    BIN_DIR: path.join(APP_ROOT, 'bin'),
    KOPIA_PATH: path.join(APP_ROOT, 'bin', 'kopia.exe'),
    ASSETS_DIR: path.join(APP_ROOT, 'assets'),
    CONFIG_DIR: path.join(APP_ROOT, 'config')
};
