const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { handleKopiaError } = require('../../utils/kopia-errors');

class RepositoryService {
    constructor(kopiaPath) {
        this.kopiaPath = kopiaPath;
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

            console.log('Creating repository...');
            await execFileAsync(this.kopiaPath, args);
            console.log('Repository created successfully');
            return true;
        } catch (error) {
            console.error('Failed to create repository:', error);
            throw handleKopiaError(error);
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
            return true;
        } catch (error) {
            console.error('Failed to connect to repository:', error);
            throw handleKopiaError(error);
        }
    }

    async disconnectRepository() {
        try {
            console.log('Disconnecting from repository...');
            await execFileAsync(this.kopiaPath, ['repository', 'disconnect']);
            console.log('Disconnected from repository');
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
            return { success: true, status: JSON.parse(stdout) };
        } catch (error) {
            console.error('Failed to get repository status:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = RepositoryService;
