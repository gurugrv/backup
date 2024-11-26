const winston = require('winston');
const path = require('path');
const { app } = require('electron');

// Create logs directory in user data folder
const logsDir = path.join(app.getPath('userData'), 'logs');
const { createLogger, format, transports } = winston;

// Custom format for logging
const logFormat = format.combine(
    format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
);

// Custom format for console output
const consoleFormat = format.combine(
    format.colorize(),
    format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.printf(
        info => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
    )
);

class Logger {
    constructor() {
        this.logger = createLogger({
            level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
            format: logFormat,
            defaultMeta: {
                app: 'BackYup',
                version: app.getVersion()
            },
            transports: [
                // Write all logs to separate files
                new transports.File({
                    filename: path.join(logsDir, 'error.log'),
                    level: 'error',
                    maxsize: 5242880, // 5MB
                    maxFiles: 5,
                    tailable: true
                }),
                new transports.File({
                    filename: path.join(logsDir, 'combined.log'),
                    maxsize: 5242880, // 5MB
                    maxFiles: 5,
                    tailable: true
                })
            ]
        });

        // If in development, also log to console
        if (process.env.NODE_ENV === 'development') {
            this.logger.add(new transports.Console({
                format: consoleFormat,
                handleExceptions: true
            }));
        }

        // Handle uncaught exceptions
        this.logger.exceptions.handle(
            new transports.File({
                filename: path.join(logsDir, 'exceptions.log'),
                maxsize: 5242880, // 5MB
                maxFiles: 5
            })
        );

        // Create a separate transport for backup operations
        this.logger.add(new transports.File({
            filename: path.join(logsDir, 'backup.log'),
            level: 'info',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: format.combine(
                format.timestamp(),
                format.json()
            )
        }));
    }

    // Logging methods
    error(message, meta = {}) {
        this.logger.error(message, meta);
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    // Method to get logs
    async getLogs(options = {}) {
        const { level = 'info', limit = 100, startDate, endDate, type = 'combined' } = options;
        
        return new Promise((resolve, reject) => {
            try {
                const logFile = type === 'error' ? 'error.log' : 
                              type === 'backup' ? 'backup.log' : 'combined.log';
                
                const logs = [];
                const logStream = require('fs').createReadStream(
                    path.join(logsDir, logFile), { encoding: 'utf8' }
                );
                
                const readline = require('readline').createInterface({
                    input: logStream,
                    crlfDelay: Infinity
                });

                readline.on('line', (line) => {
                    try {
                        const log = JSON.parse(line);
                        
                        // Apply filters
                        if (level && log.level !== level) return;
                        if (startDate && new Date(log.timestamp) < new Date(startDate)) return;
                        if (endDate && new Date(log.timestamp) > new Date(endDate)) return;
                        
                        logs.push(log);
                        
                        // Respect the limit
                        if (logs.length > limit) {
                            logs.shift();
                        }
                    } catch (e) {
                        // Skip malformed lines
                        console.error('Malformed log line:', e);
                    }
                });

                readline.on('close', () => {
                    resolve(logs.reverse()); // Return most recent first
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    // Method to clean old logs
    async cleanOldLogs(daysToKeep = 30) {
        try {
            const fs = require('fs').promises;
            const files = await fs.readdir(logsDir);
            const now = new Date();

            for (const file of files) {
                const filePath = path.join(logsDir, file);
                const stats = await fs.stat(filePath);
                const daysOld = (now - stats.mtime) / (1000 * 60 * 60 * 24);

                if (daysOld > daysToKeep) {
                    await fs.unlink(filePath);
                    this.info(`Deleted old log file: ${file}`);
                }
            }
        } catch (error) {
            this.error('Failed to clean old logs:', error);
        }
    }

    // Method to get log file paths
    getLogPaths() {
        return {
            error: path.join(logsDir, 'error.log'),
            combined: path.join(logsDir, 'combined.log'),
            backup: path.join(logsDir, 'backup.log'),
            exceptions: path.join(logsDir, 'exceptions.log')
        };
    }

    // Method to create a child logger with additional metadata
    child(meta) {
        return this.logger.child(meta);
    }
}

// Create logs directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = new Logger();