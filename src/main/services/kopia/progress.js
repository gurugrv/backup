const { BrowserWindow } = require('electron');
const { EventEmitter } = require('events');

class ProgressService extends EventEmitter {
    constructor() {
        super();
        this.progressByPath = new Map(); // Track progress for each path
        this.lastUpdateTime = new Map(); // Track last update time for each path
        this.updateDebounceTime = 100; // Minimum time between updates in ms
    }

    sendProgressUpdate(progress) {
        if (!progress) return;

        console.log('ProgressService: Sending progress update:', progress);
        
        const currentTime = Date.now();
        const paths = progress.paths || [];

        // Update progress for each path
        paths.forEach(path => {
            const lastUpdate = this.lastUpdateTime.get(path) || 0;
            
            // Only update if enough time has passed since last update
            if (currentTime - lastUpdate >= this.updateDebounceTime) {
                this.progressByPath.set(path, {
                    ...progress,
                    timestamp: currentTime
                });
                this.lastUpdateTime.set(path, currentTime);
            }
        });

        // Create aggregated progress update
        const aggregatedProgress = this.createAggregatedProgress(paths);

        // Emit the progress event
        this.emit('progress', aggregatedProgress);
        
        // Also send directly to windows for backward compatibility
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.webContents.send('backup-progress', aggregatedProgress);
        });
    }

    createAggregatedProgress(paths) {
        // If no paths provided, aggregate all active paths
        const pathsToAggregate = paths.length > 0 ? paths : Array.from(this.progressByPath.keys());
        
        if (pathsToAggregate.length === 0) return null;

        let totalHashing = 0;
        let totalHashed = 0;
        let totalHashedBytes = 0;
        let totalCached = 0;
        let totalCachedBytes = 0;
        let totalUploaded = 0;
        let totalEstimated = 0;
        let isEstimating = false;
        let activeCount = 0;

        pathsToAggregate.forEach(path => {
            const progress = this.progressByPath.get(path);
            if (progress) {
                activeCount++;
                totalHashing += progress.hashing || 0;
                totalHashed += progress.hashed || 0;
                totalHashedBytes += progress.hashedBytes || 0;
                totalCached += progress.cached || 0;
                totalCachedBytes += progress.cachedBytes || 0;
                totalUploaded += progress.uploaded || 0;
                totalEstimated += progress.estimated || 0;
                isEstimating = isEstimating || progress.estimating;
            }
        });

        // Calculate overall percentage
        let percentage = 0;
        if (totalEstimated > 0 && !isEstimating) {
            percentage = (totalUploaded / totalEstimated) * 100;
        }

        return {
            phase: isEstimating ? 'estimating' : 'uploading',
            hashing: totalHashing,
            hashed: totalHashed,
            hashedBytes: totalHashedBytes,
            cached: totalCached,
            cachedBytes: totalCachedBytes,
            uploaded: totalUploaded,
            estimated: totalEstimated,
            percentage: percentage,
            estimating: isEstimating,
            paths: pathsToAggregate,
            activeCount
        };
    }

    convertToBytes(value, unit) {
        const units = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024,
            'TB': 1024 * 1024 * 1024 * 1024
        };
        return parseFloat(value) * units[unit];
    }

    parseProgress(data) {
        const text = data.toString();
        console.log('ProgressService: Parsing progress data:', text);

        // Handle initial "Snapshotting" message
        if (text.includes('Snapshotting')) {
            return {
                phase: 'initializing',
                percentage: 0,
                message: text.trim(),
                hashing: 0,
                hashed: 0,
                hashedBytes: 0,
                cached: 0,
                cachedBytes: 0,
                uploaded: 0,
                estimated: 0,
                timeLeft: 0,
                uploadSpeed: 0,
                estimating: true
            };
        }

        // Handle "Scanning..." message
        if (text.includes('Scanning...')) {
            return {
                phase: 'scanning',
                percentage: 0,
                message: 'Scanning files...',
                hashing: 0,
                hashed: 0,
                hashedBytes: 0,
                cached: 0,
                cachedBytes: 0,
                uploaded: 0,
                estimated: 0,
                timeLeft: 0,
                uploadSpeed: 0,
                estimating: true
            };
        }

        // Pattern for "/ 0 hashing, 35 hashed (21 MB), 0 cached (0 B), uploaded 21 MB, estimated 63.1 MB (33.3%) 31s left"
        const mainPattern = /[-|/\\*]\s+(\d+)\s+hashing,\s+(\d+)\s+hashed\s+\(([\d.]+)\s+([KMG]?B)\),\s+(\d+)\s+cached\s+\(([\d.]+)\s+([KMG]?B)\),\s+uploaded\s+([\d.]+)\s+([KMG]?B),\s+estimated\s+([\d.]+)\s+([KMG]?B)\s+\(([\d.]+)%\)\s+(\d+)([ms])?(\d+)?s\s+left/;

        // Alternative pattern without estimated size
        const altPattern = /[-|/\\*]\s+(\d+)\s+hashing,\s+(\d+)\s+hashed\s+\(([\d.]+)\s+([KMG]?B)\),\s+(\d+)\s+cached\s+\(([\d.]+)\s+([KMG]?B)\),\s+uploaded\s+([\d.]+)\s+([KMG]?B)/;

        // Pattern for simple hashing status
        const hashingPattern = /[-|/\\*]\s+(\d+)\s+hashing,\s+(\d+)\s+hashed\s+\(([\d.]+)\s+([KMG]?B)\)/;

        // Try main pattern first
        const mainMatch = text.match(mainPattern);
        if (mainMatch) {
            const [
                ,
                hashing,
                hashed,
                hashedSize,
                hashedUnit,
                cached,
                cachedSize,
                cachedUnit,
                uploadedSize,
                uploadedUnit,
                estimatedSize,
                estimatedUnit,
                percentage,
                minutes,
                timeUnit,
                seconds
            ] = mainMatch;

            const uploaded = this.convertToBytes(uploadedSize, uploadedUnit);
            const estimated = this.convertToBytes(estimatedSize, estimatedUnit);

            // Calculate total seconds
            let totalSeconds = 0;
            if (timeUnit === 'm') {
                totalSeconds = parseInt(minutes) * 60 + (parseInt(seconds) || 0);
            } else {
                totalSeconds = parseInt(minutes); // In this case, 'minutes' is actually seconds
            }

            return {
                phase: 'uploading',
                hashing: parseInt(hashing),
                hashed: parseInt(hashed),
                hashedBytes: this.convertToBytes(hashedSize, hashedUnit),
                cached: parseInt(cached),
                cachedBytes: this.convertToBytes(cachedSize, cachedUnit),
                uploaded,
                estimated,
                percentage: parseFloat(percentage),
                timeLeft: totalSeconds,
                uploadSpeed: totalSeconds > 0 ? uploaded / totalSeconds : 0,
                estimating: false
            };
        }

        // Try alternative pattern
        const altMatch = text.match(altPattern);
        if (altMatch) {
            const [
                ,
                hashing,
                hashed,
                hashedSize,
                hashedUnit,
                cached,
                cachedSize,
                cachedUnit,
                uploadedSize,
                uploadedUnit
            ] = altMatch;

            const hashedBytes = this.convertToBytes(hashedSize, hashedUnit);
            const uploaded = this.convertToBytes(uploadedSize, uploadedUnit);

            return {
                phase: 'uploading',
                hashing: parseInt(hashing),
                hashed: parseInt(hashed),
                hashedBytes,
                cached: parseInt(cached),
                cachedBytes: this.convertToBytes(cachedSize, cachedUnit),
                uploaded,
                estimated: null,
                percentage: 0,
                timeLeft: 0,
                uploadSpeed: 0,
                estimating: true
            };
        }

        // Try simple hashing pattern
        const hashingMatch = text.match(hashingPattern);
        if (hashingMatch) {
            const [
                ,
                hashing,
                hashed,
                hashedSize,
                hashedUnit
            ] = hashingMatch;

            return {
                phase: 'hashing',
                hashing: parseInt(hashing),
                hashed: parseInt(hashed),
                hashedBytes: this.convertToBytes(hashedSize, hashedUnit),
                cached: 0,
                cachedBytes: 0,
                uploaded: 0,
                estimated: 0,
                percentage: 0,
                timeLeft: 0,
                uploadSpeed: 0,
                estimating: true
            };
        }

        // Pattern for "files processed" format
        const filesPattern = /(\d+)\s+files?\s+\(([\d.]+)\s+([KMG]?B)\)\s+·\s+(\d+)\s+files?\s+cached\s+\(([\d.]+)\s+([KMG]?B)\)\s+·\s+([\d.]+)\s+([KMG]?B)\s+\/\s+([\d.]+)\s+([KMG]?B)\s+\(([\d.]+)%\)/;
        const filesMatch = text.match(filesPattern);
        if (filesMatch) {
            const [
                ,
                files,
                processedSize,
                processedUnit,
                cachedFiles,
                cachedSize,
                cachedUnit,
                uploadedSize,
                uploadedUnit,
                totalSize,
                totalUnit,
                percentage
            ] = filesMatch;

            return {
                phase: 'processing',
                files: parseInt(files),
                processedBytes: this.convertToBytes(processedSize, processedUnit),
                cached: parseInt(cachedFiles),
                cachedBytes: this.convertToBytes(cachedSize, cachedUnit),
                uploaded: this.convertToBytes(uploadedSize, uploadedUnit),
                estimated: this.convertToBytes(totalSize, totalUnit),
                percentage: parseFloat(percentage),
                timeLeft: 0,
                uploadSpeed: 0,
                estimating: false
            };
        }

        // If we're still estimating, create a basic progress object
        if (text.includes('estimating...')) {
            const basicPattern = /(\d+)\s+hashed\s+\(([\d.]+)\s+([KMG]?B)\)/;
            const basicMatch = text.match(basicPattern);
            if (basicMatch) {
                const [, hashed, hashedSize, hashedUnit] = basicMatch;
                const hashedBytes = this.convertToBytes(hashedSize, hashedUnit);
                return {
                    phase: 'estimating',
                    hashing: 0,
                    hashed: parseInt(hashed),
                    hashedBytes,
                    cached: 0,
                    cachedBytes: 0,
                    uploaded: hashedBytes,
                    estimated: 0,
                    percentage: 0,
                    timeLeft: 0,
                    uploadSpeed: 0,
                    estimating: true
                };
            }
        }

        // If no pattern matched but text contains useful information, log it
        if (text.trim() && !text.includes('Connecting to repository') && !text.includes('Connected to repository')) {
            console.log('ProgressService: No progress pattern matched for:', text.trim());
        }

        return null;
    }

    clearProgress(paths) {
        if (paths && paths.length > 0) {
            paths.forEach(path => {
                this.progressByPath.delete(path);
                this.lastUpdateTime.delete(path);
            });
        } else {
            this.progressByPath.clear();
            this.lastUpdateTime.clear();
        }
    }
}

module.exports = ProgressService;
