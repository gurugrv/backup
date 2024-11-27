const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { handleKopiaError } = require('../../utils/kopia-errors');
const { KOPIA_PATH } = require('../../utils/paths');

class BackupService {
    constructor(kopiaPath, progressService, repositoryService) {
        this.kopiaPath = KOPIA_PATH;
        this.progressService = progressService;
        this.repositoryService = repositoryService;
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

    async startBackup(paths, isResume = false) {
        try {
            console.log(`${isResume ? 'Resuming' : 'Starting'} backup for paths:`, paths);
            const processKey = this.getProcessKey(paths);

            // Ensure repository is connected
            await this.repositoryService.ensureConnected();

            return new Promise((resolve, reject) => {
                // Base arguments for backup
                const args = [
                    'snapshot', 
                    'create',
                    '--parallel=8',  // Upload 8 files in parallel
                    '--progress-update-interval=1s',
                    '--fail-fast'    // Fail immediately on first error
                ];

                // Add paths at the end
                args.push(...paths);

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

                backupProcess.on('close', async (code) => {
                    this.backupProcesses.delete(processKey);

                    // Clean up if backup failed, but only for the specific paths
                    if (code !== 0 && !this.isCancelling.has(processKey)) {
                        const { stdout } = await execFileAsync(this.kopiaPath, ['snapshot', 'list', '--incomplete', '--json']);
                        const incompleteSnapshots = JSON.parse(stdout);
                        const relevantSnapshots = incompleteSnapshots.filter(snapshot => 
                            paths.some(path => snapshot.source === path)
                        );
                        
                        if (relevantSnapshots.length > 0) {
                            await this.cleanupIncompleteSnapshots(relevantSnapshots);
                        }
                    }

                    // Send final progress update
                    this.progressService.sendProgressUpdate({ 
                        paths: processKey.split('|'), 
                        completed: true 
                    });

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

                backupProcess.on('error', async (error) => {
                    this.backupProcesses.delete(processKey);

                    // Clean up on error, but only for the specific paths
                    if (!this.isCancelling.has(processKey)) {
                        const { stdout } = await execFileAsync(this.kopiaPath, ['snapshot', 'list', '--incomplete', '--json']);
                        const incompleteSnapshots = JSON.parse(stdout);
                        const relevantSnapshots = incompleteSnapshots.filter(snapshot => 
                            paths.some(path => snapshot.source === path)
                        );
                        
                        if (relevantSnapshots.length > 0) {
                            await this.cleanupIncompleteSnapshots(relevantSnapshots);
                        }
                    }

                    // Send final progress update
                    this.progressService.sendProgressUpdate({ 
                        paths: processKey.split('|'), 
                        completed: true 
                    });

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

    async resumeBackup(paths) {
        try {
            console.log('Attempting to resume backup for paths:', paths);
            const processKey = this.getProcessKey(paths);

            // Ensure repository is connected
            await this.repositoryService.ensureConnected();

            // Check for incomplete snapshots first
            const { stdout } = await execFileAsync(this.kopiaPath, ['snapshot', 'list', '--incomplete', '--json']);
            const incompleteSnapshots = JSON.parse(stdout);
            
            // Only clean up incomplete snapshots for the specific paths being resumed
            if (incompleteSnapshots.length > 0) {
                const relevantSnapshots = incompleteSnapshots.filter(snapshot => 
                    paths.some(path => snapshot.source === path)
                );
                
                if (relevantSnapshots.length > 0) {
                    await this.cleanupIncompleteSnapshots(relevantSnapshots);
                }
            }

            return this.startBackup(paths, true);
        } catch (error) {
            console.error('Failed to resume backup:', error);
            throw handleKopiaError(error);
        }
    }

    async cleanupIncompleteSnapshots(snapshots) {
        try {
            console.log('Cleaning up incomplete snapshots...');
            
            // Ensure repository is connected
            await this.repositoryService.ensureConnected();
            
            // Delete incomplete snapshots using proper kopia command
            for (const snapshot of snapshots) {
                if (snapshot.incomplete) {
                    await execFileAsync(this.kopiaPath, ['snapshot', 'delete', snapshot.id, '--delete']);
                    console.log(`Cleaned up incomplete snapshot ${snapshot.id}`);
                }
            }
        } catch (error) {
            console.warn('Error during cleanup:', error);
            // Try to reconnect if we encounter connection issues
            try {
                await this.repositoryService.reconnectRepository();
            } catch (reconnectError) {
                console.error('Failed to reconnect during cleanup:', reconnectError);
            }
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
                
                // Clean up any partial snapshots for the specific paths
                const { stdout } = await execFileAsync(this.kopiaPath, ['snapshot', 'list', '--incomplete', '--json']);
                const incompleteSnapshots = JSON.parse(stdout);
                const relevantSnapshots = incompleteSnapshots.filter(snapshot => 
                    paths.some(path => snapshot.source === path)
                );
                
                if (relevantSnapshots.length > 0) {
                    await this.cleanupIncompleteSnapshots(relevantSnapshots);
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
                // Send final progress update
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

            // Check for incomplete snapshots if not in progress
            if (!isInProgress) {
                const { stdout } = await execFileAsync(this.kopiaPath, ['snapshot', 'list', '--incomplete', '--json']);
                const incompleteSnapshots = JSON.parse(stdout);
                const relevantSnapshots = incompleteSnapshots.filter(snapshot => 
                    paths.some(path => snapshot.source === path)
                );
                
                if (relevantSnapshots.length > 0) {
                    return {
                        inProgress: false,
                        hasIncomplete: true,
                        canResume: true,
                        progress: 0,
                        message: 'Previous backup incomplete. Can be resumed.',
                        paths: processKey.split('|')
                    };
                }
            }

            return {
                inProgress: isInProgress,
                hasIncomplete: false,
                canResume: false,
                progress: isInProgress ? 50 : 100,
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
