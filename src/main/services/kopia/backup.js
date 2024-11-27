const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { handleKopiaError } = require('../../utils/kopia-errors');

class BackupService {
    constructor(kopiaPath, progressService) {
        this.kopiaPath = kopiaPath;
        this.progressService = progressService;
        this.backupProcesses = new Map(); // Map to store multiple backup processes
        this.isCancelling = new Set(); // Track cancelling state for each backup
    }

    getProcessKey(paths) {
        return paths.sort().join('|');
    }

    handleProcessOutput(data, processKey) {
        const text = data.toString();
        console.log(`Backup output for ${processKey}:`, text);

        // Try to parse progress
        const progress = this.progressService.parseProgress(text);
        if (progress) {
            console.log(`Parsed progress for ${processKey}:`, progress);
            // Include the paths in the progress update so UI can identify which backup it belongs to
            this.progressService.sendProgressUpdate({ ...progress, paths: processKey.split('|') });
        }
    }

    async startBackup(paths) {
        try {
            console.log('Starting backup for paths:', paths);
            const processKey = this.getProcessKey(paths);

            return new Promise((resolve, reject) => {
                const args = ['snapshot', 'create', '--parallel=1', '--progress-update-interval=1s', ...paths];
                console.log('Executing backup command:', this.kopiaPath, args.join(' '));
                
                const backupProcess = execFile(this.kopiaPath, args);
                this.backupProcesses.set(processKey, backupProcess);
                
                // Handle both stdout and stderr for progress updates
                backupProcess.stdout?.on('data', (data) => {
                    this.handleProcessOutput(data, processKey);
                });

                backupProcess.stderr?.on('data', (data) => {
                    this.handleProcessOutput(data, processKey);
                });

                backupProcess.on('close', (code) => {
                    this.backupProcesses.delete(processKey);

                    // Send final progress update to clear the progress display for this backup
                    this.progressService.sendProgressUpdate({ 
                        paths: processKey.split('|'), 
                        completed: true 
                    });

                    // If we were cancelling this specific backup, treat it as a success
                    if (this.isCancelling.has(processKey)) {
                        this.isCancelling.delete(processKey);
                        resolve({ 
                            success: true, 
                            cancelled: true, 
                            message: 'Backup cancelled successfully', 
                            paths: processKey.split('|') 
                        });
                        return;
                    }

                    if (code === 0) {
                        console.log(`Backup completed successfully for ${processKey}`);
                        resolve({ 
                            success: true, 
                            cancelled: false, 
                            message: 'Backup completed successfully', 
                            paths: processKey.split('|') 
                        });
                    } else {
                        console.error(`Backup failed with code ${code} for ${processKey}`);
                        reject(new Error(`Backup failed with code ${code}`));
                    }
                });

                backupProcess.on('error', (error) => {
                    this.backupProcesses.delete(processKey);

                    // Send final progress update to clear the progress display for this backup
                    this.progressService.sendProgressUpdate({ 
                        paths: processKey.split('|'), 
                        completed: true 
                    });

                    // If we were cancelling this specific backup, don't treat it as an error
                    if (this.isCancelling.has(processKey)) {
                        this.isCancelling.delete(processKey);
                        resolve({ 
                            success: true, 
                            cancelled: true, 
                            message: 'Backup cancelled successfully', 
                            paths: processKey.split('|') 
                        });
                        return;
                    }

                    console.error(`Backup process error for ${processKey}:`, error);
                    reject(error);
                });
            });
        } catch (error) {
            console.error('Failed to create backup:', error);
            throw handleKopiaError(error);
        }
    }

    async cancelBackup(paths) {
        const processKey = this.getProcessKey(paths);
        const backupProcess = this.backupProcesses.get(processKey);

        if (backupProcess) {
            console.log(`Canceling backup for ${processKey}...`);
            try {
                this.isCancelling.add(processKey);

                // First try graceful termination
                backupProcess.kill('SIGTERM');
                
                // Give it a moment to terminate gracefully
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Force kill if still running
                if (this.backupProcesses.has(processKey)) {
                    backupProcess.kill('SIGKILL');
                    this.backupProcesses.delete(processKey);
                }
                
                console.log(`Backup cancelled successfully for ${processKey}`);
                
                // Clean up any partial snapshots
                try {
                    await execFileAsync(this.kopiaPath, ['snapshot', 'list', '--incomplete', '--json'])
                        .then(async ({stdout}) => {
                            const incompleteSnapshots = JSON.parse(stdout);
                            for (const snapshot of incompleteSnapshots) {
                                await execFileAsync(this.kopiaPath, ['snapshot', 'delete', snapshot.id, '--delete']);
                                console.log(`Cleaned up incomplete snapshot ${snapshot.id}`);
                            }
                        });
                } catch (cleanupError) {
                    console.warn('Error during cleanup:', cleanupError);
                }
                
                return { 
                    success: true, 
                    cancelled: true, 
                    message: 'Backup cancelled successfully', 
                    paths: processKey.split('|') 
                };
            } catch (error) {
                console.error(`Error cancelling backup for ${processKey}:`, error);
                return { success: false, message: error.message };
            } finally {
                this.isCancelling.delete(processKey);
                // Send final progress update to clear the progress display for this backup
                this.progressService.sendProgressUpdate({ 
                    paths: processKey.split('|'), 
                    completed: true 
                });
            }
        }
        return { success: false, message: 'No backup in progress for specified paths' };
    }

    async getBackupStatus(paths) {
        try {
            const processKey = this.getProcessKey(paths);
            const isInProgress = this.backupProcesses.has(processKey);

            return {
                inProgress: isInProgress,
                progress: isInProgress ? 50 : 100, // Simplified progress indication
                message: isInProgress ? 'Backup in progress...' : 'Backup completed',
                paths: processKey.split('|')
            };
        } catch (error) {
            console.error('Failed to get backup status:', error);
            throw handleKopiaError(error);
        }
    }
}

module.exports = BackupService;
