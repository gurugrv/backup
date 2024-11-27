const { BrowserWindow } = require('electron');
const { EventEmitter } = require('events');

class ProgressService extends EventEmitter {
    constructor() {
        super();
    }

    sendProgressUpdate(progress) {
        console.log('ProgressService: Sending progress update:', progress);
        // Emit the progress event
        this.emit('progress', progress);
        
        // Also send directly to windows for backward compatibility
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.webContents.send('backup-progress', progress);
        });
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
        // Also matches "- 1 hashing, 0 hashed (52.3 MB), 0 cached (0 B), uploaded 50 MB, estimated 874.5 MB (6.0%) 10m8s left"
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

            const uploaded = this.convertToBytes(uploadedSize, uploadedUnit);

            return {
                phase: 'uploading',
                hashing: parseInt(hashing),
                hashed: parseInt(hashed),
                hashedBytes: this.convertToBytes(hashedSize, hashedUnit),
                cached: parseInt(cached),
                cachedBytes: this.convertToBytes(cachedSize, cachedUnit),
                uploaded,
                estimated: 0,
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
        // Example: "0 files (170 Bytes) · 0 files cached (0 Bytes) · 170 Bytes / 340 Bytes (0.0%)"
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
}

module.exports = ProgressService;
