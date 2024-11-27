const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { handleKopiaError } = require('../../utils/kopia-errors');

class SnapshotService {
    constructor(kopiaPath) {
        this.kopiaPath = kopiaPath;
    }

    async checkRepository() {
        try {
            await execFileAsync(this.kopiaPath, ['repository', 'status', '--json']);
            return true;
        } catch (error) {
            console.error('Repository not connected:', error);
            return false;
        }
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
            const formattedSnapshots = snapshots.map(snapshot => ({
                id: snapshot.id,
                startTime: snapshot.startTime,
                endTime: snapshot.endTime,
                source: snapshot.source,
                stats: {
                    totalSize: snapshot.stats?.totalSize || 0,
                    totalFiles: ((snapshot.stats?.fileCount || 0) + (snapshot.stats?.cachedFiles || 0)),
                    dirCount: snapshot.stats?.dirCount || 0
                }
            }));

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
            // Check repository connection first
            const isConnected = await this.checkRepository();
            if (!isConnected) {
                return { success: false, error: 'Repository not connected' };
            }

            console.log(`Deleting backup for path: ${path}`);
            // Get snapshots for the path
            const { stdout } = await execFileAsync(this.kopiaPath, ['snapshot', 'list', '--json', path]);
            const snapshots = JSON.parse(stdout);
            
            // Delete each snapshot for the path
            for (const snapshot of snapshots) {
                // Delete the snapshot using snapshot delete command
                await execFileAsync(this.kopiaPath, ['snapshot', 'delete', snapshot.id, '--delete']);
                console.log(`Deleted snapshot ${snapshot.id}`);
            }
            
            // Run full maintenance to clean up repository
            await execFileAsync(this.kopiaPath, ['maintenance', 'run', '--full', '--safety=none']);
            console.log('Repository maintenance completed');
            
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
            
            return {
                success: true,
                stats: {
                    totalFiles: (latestSnapshot.stats?.fileCount || 0) + (latestSnapshot.stats?.cachedFiles || 0),
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
