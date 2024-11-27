export class PathManager {
    constructor() {
        this.selectedPaths = new Set();
        this.pathStats = new Map();
    }

    async addPaths(paths) {
        if (!paths?.length) return false;

        try {
            for (const path of paths) {
                this.selectedPaths.add(path);
                await window.electron.addBackupPath(path);
            }
            await this.updatePathStats();
            return true;
        } catch (error) {
            console.error('Error adding paths:', error);
            throw error;
        }
    }

    async removePath(path) {
        try {
            this.selectedPaths.delete(path);
            await window.electron.removeBackupPath(path);
            return true;
        } catch (error) {
            console.error('Error removing path:', error);
            throw error;
        }
    }

    async updatePathStats() {
        for (const path of this.selectedPaths) {
            try {
                const stats = await window.electron.getDirectoryStats(path);
                this.pathStats.set(path, stats || { totalFiles: 0, totalSize: 0 });
            } catch (error) {
                console.error(`Error getting stats for path ${path}:`, error);
                this.pathStats.set(path, { totalFiles: 0, totalSize: 0 });
            }
        }
    }

    getSelectedPaths() {
        return Array.from(this.selectedPaths);
    }

    getPathStats(path) {
        return this.pathStats.get(path) || { totalFiles: 0, totalSize: 0 };
    }

    clearSelectedPaths() {
        this.selectedPaths.clear();
    }

    hasSelectedPaths() {
        return this.selectedPaths.size > 0;
    }

    getSelectedPathCount() {
        return this.selectedPaths.size;
    }
}
