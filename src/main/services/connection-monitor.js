// src/main/services/connection-monitor.js
class ConnectionMonitor {
    constructor(kopiaService) {
        this.kopiaService = kopiaService;
        this.interval = null;
        this.isConnected = false;
        this.listeners = new Set();
    }

    start(intervalMs = 30000) {
        this.check();
        this.interval = setInterval(() => this.check(), intervalMs);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    async check() {
        try {
            await this.kopiaService.getRepositoryStatus();
            this.updateStatus(true);
        } catch (error) {
            this.updateStatus(false);
            console.error('Repository connection check failed:', error);
        }
    }

    updateStatus(connected) {
        if (this.isConnected !== connected) {
            this.isConnected = connected;
            this.notifyListeners();
        }
    }

    addListener(callback) {
        this.listeners.add(callback);
    }

    removeListener(callback) {
        this.listeners.delete(callback);
    }

    notifyListeners() {
        for (const listener of this.listeners) {
            listener(this.isConnected);
        }
    }
}

module.exports = ConnectionMonitor;
