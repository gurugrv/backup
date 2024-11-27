const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { handleKopiaError } = require('../../utils/kopia-errors');
const { KOPIA_PATH } = require('../../utils/paths');

class SnapshotService {
    constructor(kopiaPath, repositoryService) {
        this.kopiaPath = KOPIA_PATH;
        this.repositoryService = repositoryService;
    }

    async checkRepository() {
        return this.repositoryService.ensureConnected();
    }

    async getSnapshots() {
        try {
            console.log('Getting snapshots...');
            
            // Check repository connection first
            const isConnected = await this.checkRepository();
            if (!isConnected) {
                console.error('Repository not connected');
                return { success: false, error: 'Repository not connected' };
            }

            const { stdout } = await execFileAsync(this.kopiaPath, ['snapshot', 'list', '--json']);
            console.log('Raw snapshot output:', stdout);

            // Handle empty output
            if (!stdout.trim()) {
                console.log('No snapshots found');
                return { success: true, snapshots: [] };
            }

            const snapshots = JSON.parse(stdout);
            console.log('Parsed snapshots:', snapshots);

            // Format snapshots for UI
            const formattedSnapshots = snapshots.map(snapshot => {
                // Log raw stats for debugging
                console.log('Raw snapshot stats:', snapshot.stats);
                
                const totalFiles = (snapshot.stats?.fileCount || 0) + (snapshot.stats?.cachedFiles || 0);
                console.log('Calculated total files:', totalFiles);

                return {
                    id: snapshot.id,
                    startTime: snapshot.startTime,
                    endTime: snapshot.endTime,
                    source: snapshot.source,
                    stats: {
                        totalSize: snapshot.stats?.totalSize || 0,
                        totalFiles: totalFiles,
                        dirCount: snapshot.stats?.dirCount || 0
                    }
                };
            });

            console.log('Formatted snapshots:', formattedSnapshots);
            return { success: true, snapshots: formattedSnapshots };
        } catch (error) {
            console.error('Failed to get snapshots:', error);
            return { success: false, error: error.message };
        }
    }

    async browseSnapshot(snapshotId, path = '') {
        try {
            // Check repository connection first
            const isConnected = await this.checkRepository();
            if (!isConnected) {
                return { success: false, error: 'Repository not connected' };
            }

            console.log(`Browsing snapshot ${snapshotId} path: ${path}`);
            const args = ['snapshot', 'ls', '--json'];
            
            // Construct the path argument
            const pathArg = path ? `${snapshotId}:/${path}` : `${snapshotId}:/`;
            args.push(pathArg);
            
            console.log('Browse command:', this.kopiaPath, args);
            const { stdout } = await execFileAsync(this.kopiaPath, args);
            console.log('Raw browse output:', stdout);
            const entries = JSON.parse(stdout);
            console.log('Parsed entries:', entries);

            // Format entries for UI
            const formattedContents = entries.map(entry => ({
                name: entry.name,
                path: path ? `${path}/${entry.name}` : entry.name,
                size: entry.size || 0,
                modified: entry.mtime || new Date().toISOString(),
                type: entry.type === 'd' ? 'dir' : 'file'
            }));

            return { success: true, contents: formattedContents };
        } catch (error) {
            console.error('Failed to browse snapshot:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteBackup(path) {
        try {
            console.log(`Deleting backup for path: ${path}`);
            
            // Delete all snapshots for this source using proper kopia command
            await execFileAsync(this.kopiaPath, [
                'snapshot', 
                'delete', 
                '--delete',  // Required flag for deletion
                '--all-snapshots-for-source',  // Delete all snapshots for this source
                path
            ]);
            console.log(`Deleted all snapshots for ${path}`);

            // Delete the source policy
            try {
                await execFileAsync(this.kopiaPath, [
                    'policy', 
                    'delete',
                    path
                ]);
                console.log(`Deleted policy for path ${path}`);
            } catch (policyError) {
                console.warn('Error deleting policy (may not exist):', policyError);
                // Don't throw error for policy deletion failure
            }
            
            return { success: true, message: 'Backup deleted successfully' };
        } catch (error) {
            console.error('Failed to delete backup:', error);
            return { success: false, error: error.message };
        }
    }

    async getDirectoryStats(path) {
        try {
            // Check repository connection first
            const isConnected = await this.checkRepository();
            if (!isConnected) {
                return { success: false, error: 'Repository not connected' };
            }

            console.log(`Getting stats for directory: ${path}`);
            // Get the latest snapshot for this path
            const { stdout: snapshotOutput } = await execFileAsync(this.kopiaPath, [
                'snapshot', 
                'list', 
                '--json',
                path
            ]);
            
            // Handle empty output
            if (!snapshotOutput.trim()) {
                return {
                    success: true,
                    stats: {
                        totalFiles: 0,
                        totalSize: 0,
                        lastBackup: null
                    }
                };
            }

            const snapshots = JSON.parse(snapshotOutput);
            if (snapshots.length === 0) {
                return {
                    success: true,
                    stats: {
                        totalFiles: 0,
                        totalSize: 0,
                        lastBackup: null
                    }
                };
            }

            // Get the most recent snapshot
            const latestSnapshot = snapshots[snapshots.length - 1];
            console.log('Latest snapshot stats:', latestSnapshot.stats);
            
            const totalFiles = (latestSnapshot.stats?.fileCount || 0) + (latestSnapshot.stats?.cachedFiles || 0);
            console.log('Calculated total files:', totalFiles);

            return {
                success: true,
                stats: {
                    totalFiles: totalFiles,
                    totalSize: latestSnapshot.stats?.totalSize || 0,
                    lastBackup: latestSnapshot.startTime
                }
            };
        } catch (error) {
            console.error('Failed to get directory stats:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = SnapshotService;
