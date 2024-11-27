import { UIComponents } from '../components/ui-components.js';
import { BackupOperations } from './backup-operations.js';
import { UIStateManager } from './ui-state-manager.js';
import { SnapshotManager } from './snapshot-manager.js';

export class BackupManager {
    constructor() {
        console.log('BackupManager: Initializing');
        this.initializeElements();
        this.backupOperations = new BackupOperations();
        this.uiStateManager = new UIStateManager(this.elements);
        this.snapshotManager = new SnapshotManager();
        this.selectedPaths = new Set();
        this.initialize();
    }

    initializeElements() {
        console.log('BackupManager: Initializing elements');
        this.elements = {
            statusArea: document.getElementById('backup-status'),
            addButton: document.getElementById('select-paths'),
            backupButton: document.getElementById('start-backup'),
            yourBackupsTable: document.getElementById('your-backups-body'),
            selectedPathsList: document.getElementById('selected-paths'),
            selectedCount: document.getElementById('selected-count'),
        };

        // Log which elements were found/not found
        Object.entries(this.elements).forEach(([key, element]) => {
            console.log(`BackupManager: Element '${key}' ${element ? 'found' : 'not found'}`);
        });
    }

    async initialize() {
        console.log('BackupManager: Initializing');
        this.setupEventListeners();
        await this.loadSavedPaths();
        await this.refreshSnapshots(); // Initial load of snapshots
        await this.loadBackupStates(); // Load states of any ongoing backups
    }

    async loadBackupStates() {
        try {
            // Get status for all selected paths
            const paths = Array.from(this.selectedPaths);
            for (const path of paths) {
                const status = await window.electron.getBackupStatus([path]);
                if (status.inProgress) {
                    // If backup is in progress, set up UI and tracking
                    await this.backupOperations.resumeBackup(path);
                }
            }
        } catch (error) {
            console.error('Error loading backup states:', error);
        }
    }

    setupEventListeners() {
        console.log('BackupManager: Setting up event listeners');
        if (this.elements.addButton && this.elements.backupButton) {
            this.elements.addButton.addEventListener('click', () => this.handleAddPaths());
            this.elements.backupButton.addEventListener('click', () => this.handleBackup());
        } else {
            console.warn('Some UI elements not found. Event listeners not fully set up.');
        }

        // Listen for snapshot refresh events
        window.addEventListener('refresh-snapshots', () => {
            this.refreshSnapshots();
        });
    }

    async refreshSnapshots() {
        console.log('BackupManager: Refreshing snapshots');
        try {
            await this.snapshotManager.refreshSnapshots();
            const stats = this.snapshotManager.getBackupStats();
            this.uiStateManager.updateBackupStats(stats);
            this.uiStateManager.updateBackupsTable(
                this.snapshotManager.snapshotData,
                (path) => this.restoreBackup(path),
                (path) => this.deleteBackup(path)
            );
        } catch (error) {
            console.error('Error refreshing snapshots:', error);
        }
    }

    async loadSavedPaths() {
        console.log('BackupManager: Loading saved paths');
        try {
            const paths = await window.electron.getBackupPaths();
            console.log('BackupManager: Loaded saved paths:', paths);
            
            if (paths && paths.length > 0) {
                for (const path of paths) {
                    await this.addPath(path);
                }
            }
        } catch (error) {
            console.error('BackupManager: Error loading saved paths:', error);
        }
    }

    async handleAddPaths() {
        try {
            const paths = await window.electron.selectPaths();
            if (paths) {
                for (const path of paths) {
                    await this.addPath(path);
                }
            }
        } catch (error) {
            console.error('Error selecting paths:', error);
        }
    }

    async addPath(path) {
        try {
            if (this.selectedPaths.has(path)) {
                return;
            }

            const stats = await window.electron.getDirectoryStats(path);
            await window.electron.addBackupPath(path);
            this.selectedPaths.add(path);
            
            // Add new path to UI without rebuilding entire list
            this.addPathToUI(path);
            this.updateBackupButton();

        } catch (error) {
            console.error('Error adding path:', error);
        }
    }

    addPathToUI(path) {
        if (!this.elements.selectedPathsList) return;

        // If this is the first path, clear the "No files or folders selected" message
        if (this.selectedPaths.size === 1) {
            const container = document.createElement('div');
            container.className = 'space-y-4 p-6';
            this.elements.selectedPathsList.innerHTML = '';
            this.elements.selectedPathsList.appendChild(container);
        }

        const container = this.elements.selectedPathsList.querySelector('div');
        if (!container) return;

        const pathItem = document.createElement('div');
        pathItem.id = `path-item-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;
        pathItem.className = 'flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-200';
        
        const pathInfo = document.createElement('div');
        pathInfo.className = 'flex-1';
        pathInfo.innerHTML = `
            <div class="font-medium text-gray-900">${path}</div>
            <div id="progress-info-${path.replace(/[^a-zA-Z0-9]/g, '-')}" class="text-sm text-gray-600"></div>
        `;

        const actions = document.createElement('div');
        actions.className = 'actions flex items-center gap-2';

        const actionButton = document.createElement('button');
        actionButton.className = 'backup-action p-2 text-red-500 hover:text-red-700';
        actionButton.innerHTML = '<i class="fas fa-times"></i>';
        actionButton.title = 'Remove from backup';
        actionButton.onclick = () => this.removePath(path);

        actions.appendChild(actionButton);
        pathItem.appendChild(pathInfo);
        pathItem.appendChild(actions);
        container.appendChild(pathItem);
    }

    async removePath(path) {
        try {
            // If backup is in progress, just return without showing error
            if (this.backupOperations.isBackupInProgress(path)) {
                return;
            }

            await window.electron.removeBackupPath(path);
            this.selectedPaths.delete(path);
            
            // Remove just this path's element from UI
            const pathItem = document.getElementById(`path-item-${path.replace(/[^a-zA-Z0-9]/g, '-')}`);
            if (pathItem) {
                pathItem.remove();
            }

            // If no paths left, show the empty message
            if (this.selectedPaths.size === 0) {
                this.elements.selectedPathsList.innerHTML = `
                    <div class="flex items-center justify-center py-12 text-gray-600">
                        <i class="fas fa-info-circle text-primary mr-2 text-lg"></i>
                        <span class="text-lg">No files or folders selected</span>
                    </div>
                `;
            }

            this.updateBackupButton();
        } catch (error) {
            console.error('Error removing path:', error);
        }
    }

    async clearAllPaths() {
        try {
            // Get all paths before clearing the Set
            const paths = Array.from(this.selectedPaths);
            
            // Don't clear paths that are currently backing up
            const nonActivePaths = paths.filter(path => !this.backupOperations.isBackupInProgress(path));
            
            // Clear paths from storage and UI individually
            for (const path of nonActivePaths) {
                await this.removePath(path);
            }
        } catch (error) {
            console.error('Error clearing paths:', error);
        }
    }

    updateBackupButton() {
        if (!this.elements.backupButton) return;

        const hasSelectedPaths = this.selectedPaths.size > 0;
        const hasNonActivePaths = Array.from(this.selectedPaths).some(path => !this.backupOperations.isBackupInProgress(path));
        
        this.elements.backupButton.disabled = !hasNonActivePaths;
        this.elements.backupButton.className = `inline-flex items-center px-6 py-3 rounded-lg font-medium shadow-sm transition-colors duration-200 ${
            hasNonActivePaths 
                ? 'bg-primary text-white hover:bg-primary-hover cursor-pointer'
                : 'bg-gray-400 text-white cursor-not-allowed'
        }`;
    }

    async handleBackup() {
        const paths = Array.from(this.selectedPaths);
        const nonActivePaths = paths.filter(path => !this.backupOperations.isBackupInProgress(path));

        if (nonActivePaths.length === 0) return;

        // Start backup for each non-active path
        const backupPromises = nonActivePaths.map(async (path) => {
            try {
                const result = await this.backupOperations.startBackup(path);
                
                if (result && result.success) {
                    // If backup was cancelled, don't show success message
                    if (!result.cancelled) {
                        UIComponents.showStatus('backup-status', `Backup completed successfully for ${path}`, 'success');
                    }
                    
                    // Remove path from selection if backup completed (not cancelled)
                    if (!result.cancelled) {
                        await this.removePath(path);
                    }
                }
            } catch (error) {
                console.error(`Error during backup for ${path}:`, error);
                UIComponents.showStatus('backup-status', `Backup failed for ${path}: ${error.message}`, 'error');
            }
        });

        // Wait for all backups to complete
        await Promise.all(backupPromises);
        await this.refreshSnapshots();
    }

    async restoreBackup(path) {
        try {
            await this.snapshotManager.restoreSnapshot(path);
            UIComponents.showStatus('backup-status', 'Restore started successfully', 'success');
        } catch (error) {
            console.error('Error restoring backup:', error);
            UIComponents.showStatus('backup-status', 'Restore failed: ' + error.message, 'error');
        }
    }

    async deleteBackup(path) {
        try {
            // Set the deleting state in UI
            this.uiStateManager.setPathDeleting(path, true);

            await this.snapshotManager.deleteSnapshot(path);
            await this.refreshSnapshots();
            UIComponents.showStatus('backup-status', 'Backup deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting backup:', error);
            UIComponents.showStatus('backup-status', 'Delete failed: ' + error.message, 'error');
        } finally {
            // Clear the deleting state in UI
            this.uiStateManager.setPathDeleting(path, false);
        }
    }
}
