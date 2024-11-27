const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { handleKopiaError } = require('../../utils/kopia-errors');
const { KOPIA_PATH } = require('../../utils/paths');

class RestoreService {
    constructor(kopiaPath) {
        this.kopiaPath = KOPIA_PATH;
    }

    async restoreBackup(path, targetPath) {
        try {
            console.log(`Restoring backup for path: ${path} to ${targetPath}`);
            // Get the latest snapshot for this path
            const { stdout } = await execFileAsync(this.kopiaPath, ['snapshot', 'list', '--json', path]);
            const snapshots = JSON.parse(stdout);
            
            if (snapshots.length === 0) {
                throw new Error('No backup found for this path');
            }
            
            // Get the most recent snapshot
            const latestSnapshot = snapshots[snapshots.length - 1];
            
            // Restore the snapshot to the target path
            await execFileAsync(this.kopiaPath, ['snapshot', 'restore', latestSnapshot.id, targetPath]);
            
            return { success: true, message: 'Backup restored successfully' };
        } catch (error) {
            console.error('Failed to restore backup:', error);
            return { success: false, error: error.message };
        }
    }

    async restoreSnapshot(snapshotId, targetPath) {
        try {
            console.log(`Restoring snapshot ${snapshotId} to ${targetPath}`);
            await execFileAsync(this.kopiaPath, [
                'snapshot', 
                'restore', 
                snapshotId, 
                targetPath
            ]);
            console.log('Restore completed successfully');
            return { success: true };
        } catch (error) {
            console.error('Failed to restore snapshot:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = RestoreService;
