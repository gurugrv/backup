const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const execFileAsync = promisify(execFile);

class KopiaService {
    constructor() {
        const APP_ROOT = path.join(__dirname, '../../..');
        this.kopiaPath = path.join(APP_ROOT, 'bin', 'kopia.exe');
        console.log('Kopia service initialized with path:', this.kopiaPath);
    }

    async createRepository() {
        try {
            const args = [
                'repository', 
                'create', 
                's3',
                '--bucket', 
                process.env.MINIO_BUCKET,
                '--endpoint', 
                `${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
                '--access-key', 
                process.env.MINIO_ACCESS_KEY,
                '--secret-access-key', 
                process.env.MINIO_SECRET_KEY,
                '--password', 
                process.env.REPO_PASSWORD,
                '--disable-tls'
            ];

            console.log('Creating repository with args:', args);
            await execFileAsync(this.kopiaPath, args);
            console.log('Repository created successfully');
        } catch (error) {
            console.error('Failed to create repository:', error);
            throw error;
        }
    }

    async connectRepository() {
        try {
            const args = [
                'repository', 
                'connect', 
                's3',
                '--bucket', 
                process.env.MINIO_BUCKET,
                '--endpoint', 
                `${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
                '--access-key', 
                process.env.MINIO_ACCESS_KEY,
                '--secret-access-key', 
                process.env.MINIO_SECRET_KEY,
                '--password', 
                process.env.REPO_PASSWORD,
                '--disable-tls'
            ];

            console.log('Connecting to repository...');
            await execFileAsync(this.kopiaPath, args);
            console.log('Connected to repository successfully');
        } catch (error) {
            console.error('Failed to connect to repository:', error);
            throw error;
        }
    }

    async initializeRepository() {
        try {
            const configService = require('./config');
            await configService.ensureReady();
            
            const isInitialized = await configService.get('repository.initialized', false);
            
            if (!isInitialized) {
                await this.createRepository();
                await configService.set('repository.initialized', true);
            } else {
                await this.connectRepository();
            }
            
            console.log('Kopia repository initialized');
        } catch (error) {
            console.error('Failed to initialize Kopia repository:', error);
            throw error;
        }
    }

    async createSnapshot(paths) {
        try {
            for (const path of paths) {
                await execFileAsync(this.kopiaPath, ['snapshot', 'create', path]);
                console.log(`Created snapshot for path: ${path}`);
            }
        } catch (error) {
            console.error('Failed to create snapshot:', error);
            throw error;
        }
    }

    async listSnapshots() {
        try {
            const { stdout } = await execFileAsync(this.kopiaPath, ['snapshot', 'list', '--json']);
            return JSON.parse(stdout);
        } catch (error) {
            console.error('Failed to list snapshots:', error);
            throw error;
        }
    }

    async restoreSnapshot(snapshotId, targetPath) {
        try {
            await execFileAsync(this.kopiaPath, ['snapshot', 'restore', snapshotId, targetPath]);
            console.log(`Restored snapshot ${snapshotId} to ${targetPath}`);
        } catch (error) {
            console.error('Failed to restore snapshot:', error);
            throw error;
        }
    }

    async disconnectRepository() {
        try {
            await execFileAsync(this.kopiaPath, ['repository', 'disconnect']);
            console.log('Disconnected from repository');
        } catch (error) {
            console.error('Failed to disconnect from repository:', error);
            throw error;
        }
    }

    async getRepositoryStats() {
        try {
            const { stdout } = await execFileAsync(this.kopiaPath, ['repository', 'status', '--json']);
            return JSON.parse(stdout);
        } catch (error) {
            console.error('Failed to get repository stats:', error);
            throw error;
        }
    }
}

module.exports = new KopiaService();
