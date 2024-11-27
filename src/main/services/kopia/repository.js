const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { handleKopiaError } = require('../../utils/kopia-errors');
const { KOPIA_PATH } = require('../../utils/paths');

class RepositoryService {
    constructor(kopiaPath) {
        this.kopiaPath = KOPIA_PATH;
        this.isConnected = false;
    }

    async checkRepositoryExists() {
        try {
            console.log('Checking if repository exists...');

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

            try {
                await execFileAsync(this.kopiaPath, args);
                console.log('Repository exists');
                await this.disconnectRepository();
                return true;
            } catch (error) {
                if (error.stderr && error.stderr.includes('repository not initialized')) {
                    console.log('Repository does not exist');
                    return false;
                }
                if (error.stderr && error.stderr.includes('found existing data in storage location')) {
                    console.log('Repository exists but needs initialization');
                    return true;
                }
                throw error;
            }
        } catch (error) {
            console.error('Error checking repository existence:', error);
            throw error;
        }
    }

    async createRepository() {
        try {
            const exists = await this.checkRepositoryExists();
            if (exists) {
                console.log('Repository already exists, connecting instead');
                return await this.connectRepository();
            }

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

            console.log('Creating repository...');
            await execFileAsync(this.kopiaPath, args);
            console.log('Repository created successfully');
            this.isConnected = false;

            return true;
        } catch (error) {
            this.isConnected = false;
            console.error('Failed to create repository:', error);
            throw handleKopiaError(error);
        }
    }

    async connectRepository() {
        try {
            console.log('Connecting to repository...');

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

            await execFileAsync(this.kopiaPath, args);
            console.log('Connected to repository successfully');
            this.isConnected = true;

            // Run maintenance once on app launch
            console.log('Running initial maintenance...');
            await execFileAsync(this.kopiaPath, ['maintenance', 'run', '--full']);
            console.log('Initial maintenance completed');

            await this.verifyRepository();
            return true;
        } catch (error) {
            this.isConnected = false;
            console.error('Failed to connect to repository:', error);
            throw handleKopiaError(error);
        }
    }

    async verifyRepository() {
        try {
            console.log('Verifying repository connection...');
            
            const statusResult = await this.getRepositoryStatus();
            if (!statusResult.success) {
                throw new Error('Failed to get repository status');
            }

            const { stdout } = await execFileAsync(this.kopiaPath, ['snapshot', 'list', '--json']);
            const snapshots = JSON.parse(stdout);
            console.log(`Repository verified, found ${snapshots.length} snapshots`);
            
            return true;
        } catch (error) {
            console.error('Repository verification failed:', error);
            throw error;
        }
    }

    async ensureConnected() {
        if (!this.isConnected) {
            console.log('Repository not connected, attempting to connect...');
            await this.connectRepository();
        }
        return this.isConnected;
    }

    async reconnectRepository() {
        console.log('Attempting to reconnect to repository...');
        this.isConnected = false;

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

            await execFileAsync(this.kopiaPath, args);
            this.isConnected = true;
            console.log('Repository reconnected successfully');
            return true;
        } catch (error) {
            this.isConnected = false;
            throw error;
        }
    }

    async disconnectRepository() {
        try {
            console.log('Disconnecting from repository...');
            await execFileAsync(this.kopiaPath, ['repository', 'disconnect']);
            console.log('Disconnected from repository');
            this.isConnected = false;
            return { success: true };
        } catch (error) {
            console.error('Failed to disconnect from repository:', error);
            return { success: false, error: error.message };
        }
    }

    async getRepositoryStatus() {
        try {
            console.log('Getting repository status...');
            
            const { stdout } = await execFileAsync(this.kopiaPath, ['repository', 'status', '--json']);
            const status = JSON.parse(stdout);
            
            if (!status.storage || !status.configFile) {
                this.isConnected = false;
                throw new Error('Invalid repository status response');
            }
            
            this.isConnected = true;
            return { success: true, status };
        } catch (error) {
            console.error('Failed to get repository status:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = RepositoryService;
