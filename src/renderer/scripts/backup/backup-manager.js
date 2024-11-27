import { UIComponents } from '../components/ui-components.js';
import { BackupOperations } from './backup-operations.js';
import { UIStateManager } from './ui-state-manager.js';
import { SnapshotManager } from './snapshot-manager.js';

const MAX_CONCURRENT_BACKUPS = 3; // Maximum number of concurrent backups

export class BackupManager {
    constructor() {
        console.log('BackupManager: Initializing');
        this.initializeElements();
        this.backupOperations = new BackupOperations();
        this.uiStateManager = new UIStateManager(this.elements);
        this.snapshotManager = new SnapshotManager();
        this.selectedPaths = new Set();
        this.activeBackupCount = 0;
        this.initialize();
    }

    initializeElements() {
        console.log('BackupManager: Initializing elements');
        this.elements = {
            statusArea: document.getElementById('backup-status'),
            addButton: document.getElementById('select-paths'),
            backupButton: document.getElementById('start-backup'),
            yourBackupsTable: document.getElementById('your-backups-body'),
            selectedPathsList: document.getElementById('selected-paths')
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
                    this.activeBackupCount++;
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

        // Listen for remove path events from backup operations
        window.addEventListener('remove-path', (event) => {
            this.removePath(event.detail);
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

        pathItem.appendChild(pathInfo);
        pathItem.appendChild(actions);
        container.appendChild(pathItem);

        // Initialize UI state for this path
        this.backupOperations.updatePathItemUI(path);
    }

    async removePath(path) {
        try {
            // If backup is in progress or pending, just return without showing error
            if (this.backupOperations.isBackupInProgress(path) || 
                this.backupOperations.isBackupPending(path)) {
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
            
            // Don't clear paths that are currently backing up or pending
            const nonActivePaths = paths.filter(path => 
                !this.backupOperations.isBackupInProgress(path) && 
                !this.backupOperations.isBackupPending(path)
            );
            
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
        const hasNonActivePaths = Array.from(this.selectedPaths).some(path => 
            !this.backupOperations.isBackupInProgress(path) && 
            !this.backupOperations.isBackupPending(path)
        );
        
        this.elements.backupButton.disabled = !hasNonActivePaths;
        this.elements.backupButton.className = `inline-flex items-center px-6 py-3 rounded-lg font-medium shadow-sm transition-colors duration-200 ${
            hasNonActivePaths 
                ? 'bg-primary text-white hover:bg-primary-hover cursor-pointer'
                : 'bg-gray-400 text-white cursor-not-allowed'
        }`;
    }

    async processNextPendingBackup() {
        // If we're at max concurrent backups, don't process more
        if (this.activeBackupCount >= MAX_CONCURRENT_BACKUPS) {
            return;
        }

        // Find a pending backup to process
        const pendingPath = Array.from(this.selectedPaths).find(path => 
            this.backupOperations.isBackupPending(path) && 
            !this.backupOperations.isBackupInProgress(path)
        );

        if (!pendingPath) {
            return;
        }

        try {
            this.activeBackupCount++;
            const result = await this.backupOperations.startBackup(pendingPath);
            
            if (result && result.success) {
                if (!result.cancelled) {
                    UIComponents.showStatus('backup-status', `Backup completed successfully for ${pendingPath}`, 'success');
                    await this.refreshSnapshots();
                    await this.removePath(pendingPath);
                }
            }
        } catch (error) {
            console.error(`Error during backup for ${pendingPath}:`, error);
            UIComponents.showStatus('backup-status', `Backup failed for ${pendingPath}: ${error.message}`, 'error');
            this.backupOperations.pendingBackups.delete(pendingPath);
            this.backupOperations.updatePathItemUI(pendingPath);
        } finally {
            this.activeBackupCount--;
            // Try to process next pending backup
            this.processNextPendingBackup();
        }
    }

    async handleBackup() {
        const paths = Array.from(this.selectedPaths);
        const nonActivePaths = paths.filter(path => 
            !this.backupOperations.isBackupInProgress(path) && 
            !this.backupOperations.isBackupPending(path)
        );

        if (nonActivePaths.length === 0) return;

        // Mark all paths as pending initially
        nonActivePaths.forEach(path => {
            this.backupOperations.pendingBackups.add(path);
            this.backupOperations.updatePathItemUI(path);
        });

        // Start processing backups up to the maximum concurrent limit
        const initialBatchSize = Math.min(MAX_CONCURRENT_BACKUPS - this.activeBackupCount, nonActivePaths.length);
        for (let i = 0; i < initialBatchSize; i++) {
            this.processNextPendingBackup();
        }
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
        const rowId = `backup-row-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const row = document.getElementById(rowId);
        const deleteButton = row?.querySelector('button:last-child');

        try {
            // Show confirmation dialog
            const confirmed = await UIComponents.showConfirmDialog({
                title: 'Delete Backup',
                message: `Are you sure you want to delete the backup for:<br><span class="font-medium">${path}</span>?<br><br><span class="text-red-600">This action cannot be undone.</span>`,
                confirmText: 'Yes, Delete Backup',
                cancelText: 'No, Keep Backup',
                confirmClass: 'bg-red-600 text-white hover:bg-red-700'
            });

            if (!confirmed) {
                return;
            }

            // Set the deleting state in UI
            if (deleteButton) {
                deleteButton.disabled = true;
                deleteButton.classList.remove('bg-red-600', 'hover:bg-red-700');
                deleteButton.classList.add('bg-gray-400');
                deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Deleting...';
            }

            // Delete the snapshot
            await this.snapshotManager.deleteSnapshot(path);

            // Get fresh snapshot data
            await this.snapshotManager.refreshSnapshots();

            // Update UI state with fresh data
            const stats = this.snapshotManager.getBackupStats();
            this.uiStateManager.updateBackupStats(stats);
            this.uiStateManager.updateBackupsTable(
                this.snapshotManager.snapshotData,
                (p) => this.restoreBackup(p),
                (p) => this.deleteBackup(p)
            );
            
            UIComponents.showStatus('backup-status', 'Backup deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting backup:', error);
            UIComponents.showStatus('backup-status', 'Delete failed: ' + error.message, 'error');
            
            // Reset the delete button state on error
            if (deleteButton) {
                deleteButton.disabled = false;
                deleteButton.classList.remove('bg-gray-400');
                deleteButton.classList.add('bg-red-600', 'hover:bg-red-700');
                deleteButton.innerHTML = '<i class="fas fa-trash-alt mr-2"></i>Delete';
            }
        }
    }
}
